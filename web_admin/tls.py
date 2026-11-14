# coding=utf-8
"""域名与 HTTPS 证书校验工具。"""

from __future__ import annotations

import re
import ssl
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import store

DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(\.(?!-)[A-Za-z0-9-]{1,63})+$"
)


def normalize_domain(value: str) -> str:
    domain = (value or "").strip().lower().rstrip(".")
    if domain.startswith("http://") or domain.startswith("https://"):
        domain = domain.split("://", 1)[1]
    domain = domain.split("/", 1)[0].split(":", 1)[0]
    return domain


def validate_domain(value: str) -> Tuple[bool, str]:
    if not value:
        return False, "请填写访问域名，例如 td.example.com"
    if not DOMAIN_RE.match(value):
        return False, "域名格式不正确，只能包含字母、数字、短横线和点"
    return True, ""


def resolve_path(value: str) -> Path:
    """把配置中的相对路径解析到项目根目录内，禁止越界。"""
    raw = (value or "").strip()
    if not raw:
        raise ValueError("路径不能为空")
    path = Path(raw)
    if not path.is_absolute():
        path = store.PROJECT_ROOT / path
    resolved = path.resolve()
    root = store.PROJECT_ROOT.resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError("证书路径必须位于项目目录内")
    return resolved


def _name_dict(name: Any) -> Dict[str, str]:
    """把 ssl 解码出的 DN 结构（可能是嵌套元组）拍平成字典。"""
    result: Dict[str, str] = {}
    for item in name or []:
        if (
            isinstance(item, (tuple, list))
            and len(item) == 2
            and isinstance(item[0], str)
        ):
            result[item[0]] = str(item[1])
            continue
        for pair in item or []:
            if isinstance(pair, (tuple, list)) and len(pair) == 2:
                result[str(pair[0])] = str(pair[1])
    return result


def certificate_info(cert_path: Path) -> Optional[Dict[str, Any]]:
    if not cert_path.is_file():
        return None
    try:
        decoded = ssl._ssl._test_decode_cert(str(cert_path))  # type: ignore[attr-defined]
    except Exception:
        return None
    subject = _name_dict(decoded.get("subject", []))
    issuer = _name_dict(decoded.get("issuer", []))
    sans: List[str] = []
    for key, value in decoded.get("subjectAltName", []):
        if key in ("DNS", "IP Address", "IP"):
            sans.append(str(value))
    not_after_raw = decoded.get("notAfter")
    days_left = None
    not_after = None
    if not_after_raw:
        try:
            not_after = datetime.strptime(
                not_after_raw.replace("GMT", "UTC").strip(), "%b %d %H:%M:%S %Y %Z"
            ).replace(tzinfo=timezone.utc)
            days_left = (not_after - datetime.now(timezone.utc)).days
        except ValueError:
            pass
    return {
        "subject": subject.get("commonName", ""),
        "issuer": issuer.get("organizationName", "") or issuer.get("commonName", ""),
        "sans": sans,
        "not_after": not_after.strftime("%Y-%m-%d %H:%M UTC") if not_after else None,
        "days_left": days_left,
        "path": str(cert_path),
    }


def domain_matches(domain: str, info: Optional[Dict[str, Any]]) -> bool:
    if not domain or not info:
        return False
    for entry in info.get("sans") or []:
        entry = str(entry).lower()
        if entry == domain:
            return True
        if (
            entry.startswith("*.")
            and domain.endswith(entry[1:])
            and domain.count(".") == entry.count(".")
        ):
            return True
    return False


def validate_pair(
    cert_path: Path, key_path: Path, domain: str = ""
) -> Tuple[bool, List[str], Optional[Dict[str, Any]]]:
    """校验证书/私钥可加载、未过期，并与域名匹配。"""
    errors: List[str] = []
    if not cert_path.is_file():
        errors.append(f"证书文件不存在：{cert_path}")
    if not key_path.is_file():
        errors.append(f"私钥文件不存在：{key_path}")
    if errors:
        return False, errors, None
    try:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
    except Exception as exc:
        return False, [f"证书与私钥无法加载或不匹配：{exc}"], None

    info = certificate_info(cert_path)
    if not info:
        return False, ["证书格式无法解析"], None
    if info.get("days_left") is not None and info["days_left"] < 0:
        errors.append("证书已过期")
    if domain and not domain_matches(domain, info):
        errors.append(f"证书不包含域名 {domain}，请确认证书 SAN 是否覆盖该域名")
    return not errors, errors, info


def status_payload() -> Dict[str, Any]:
    settings = store.load_settings()
    cert_value = str(settings.get("https_cert") or "")
    key_value = str(settings.get("https_key") or "")
    cert_path = None
    key_path = None
    path_errors: List[str] = []
    try:
        cert_path = resolve_path(cert_value)
    except ValueError as exc:
        path_errors.append(f"证书路径：{exc}")
    try:
        key_path = resolve_path(key_value)
    except ValueError as exc:
        path_errors.append(f"私钥路径：{exc}")

    info = certificate_info(cert_path) if cert_path else None
    domain = str(settings.get("domain") or "")
    valid = False
    errors = list(path_errors)
    if cert_path and key_path:
        valid, pair_errors, info = validate_pair(cert_path, key_path, domain)
        errors.extend(pair_errors)
    return {
        "domain": domain,
        "https_enabled": bool(settings.get("https_enabled")),
        "https_cert": cert_value,
        "https_key": key_value,
        "https_email": str(settings.get("https_email") or ""),
        "cert": info,
        "domain_match": domain_matches(domain, info) if domain else False,
        "valid": valid and not errors,
        "errors": errors,
    }
