# coding=utf-8
"""本地 Web 控制面板：静态报告 + 手动抓取 / AI 分析 / 预设 / 进度与日志。"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

import yaml

from trendradar.webui_settings import (
    PRESETS,
    _validate_feeds,
    load_overlay,
    mask_secret,
    remove_overlay_keys,
    save_overlay,
    validate_frequency_words,
)

TOOLBAR_MARKER = "tr-toolbar"
JOB_LOG_NAME = ".webui-job.log"
LOG_TAIL_DEFAULT = 400
LOG_TAIL_MAX = 2000

# 从任务日志中识别阶段 / 当前条目
_RE_PLATFORM_LIST = re.compile(r"配置的监控平台:\s*(\[[^\]]*\])")
_RE_FETCHING = re.compile(r"正在获取\s+(.+?)（(\d+)/(\d+)）")
_RE_FETCHED = re.compile(r"获取\s+(\S+)\s+成功")
_RE_FETCH_FAIL = re.compile(r"请求\s+(\S+)\s+失败")
_RE_RSS_START = re.compile(r"\[RSS\]\s*开始抓取\s+(\d+)\s+个")
_RE_RSS_FETCHING = re.compile(r"\[RSS\]\s*正在获取\s+(.+?)（(\d+)/(\d+)）")
_RE_RSS_DONE = re.compile(r"\[RSS\]\s*(.+?):\s*(获取\s+\d+\s*条|.+)")
_RE_AI = re.compile(r"\[AI\]\s*(.+)")
_RE_TRANSLATE = re.compile(r"\[翻译\]\s*(.+)")
_RE_PUSH = re.compile(r"\[推送\]\s*(.+)")
_RE_HTML = re.compile(r"HTML报告已生成")
_RE_CRAWL_START = re.compile(r"开始爬取数据")
_RE_SUCCESS_SUMMARY = re.compile(r"^成功:\s*")


def _safe_literal_list(text: str) -> List[str]:
    try:
        value = json.loads(text.replace("'", '"'))
        if isinstance(value, list):
            return [str(x) for x in value]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _parse_words_for_api(content: str):
    """解析主题词文本用于统计预览，异常时按空配置处理。"""
    try:
        from trendradar.core.frequency import parse_frequency_words_content

        return parse_frequency_words_content(content)
    except Exception:
        return [], [], []


def parse_job_progress(log_text: str, mode: Optional[str] = None) -> Dict[str, Any]:
    """从任务日志解析当前阶段与进度百分比。"""
    lines = [ln.strip() for ln in (log_text or "").splitlines() if ln.strip()]
    phase = "starting"
    message = "准备中…"
    current = ""
    step = 0
    total = 0
    platforms_total = 0
    rss_total = 0
    platforms_done = 0
    rss_done = 0
    weight_platform = 55
    weight_rss = 25
    weight_pipeline = 20

    for line in lines:
        m = _RE_PLATFORM_LIST.search(line)
        if m:
            platforms_total = max(platforms_total, len(_safe_literal_list(m.group(1))))
            continue

        if _RE_CRAWL_START.search(line):
            phase = "platforms"
            message = "开始抓取热榜平台"
            continue

        m = _RE_FETCHING.search(line)
        if m:
            phase = "platforms"
            current = m.group(1).strip()
            step = int(m.group(2))
            total = int(m.group(3))
            platforms_total = max(platforms_total, total)
            platforms_done = max(platforms_done, step - 1)
            message = f"正在抓取热榜：{current}（{step}/{total}）"
            continue

        m = _RE_FETCHED.search(line)
        if m:
            phase = "platforms"
            platforms_done += 1
            if platforms_total:
                platforms_done = min(platforms_done, platforms_total)
            current = m.group(1)
            message = f"已完成热榜：{current}"
            continue

        m = _RE_FETCH_FAIL.search(line)
        if m:
            phase = "platforms"
            current = m.group(1)
            message = f"热榜失败：{current}"
            continue

        if _RE_SUCCESS_SUMMARY.search(line):
            phase = "platforms_done"
            if platforms_total:
                platforms_done = platforms_total
            message = "热榜抓取完成"
            continue

        m = _RE_RSS_START.search(line)
        if m:
            phase = "rss"
            rss_total = max(rss_total, int(m.group(1)))
            message = f"开始抓取 RSS（{rss_total} 个源）"
            continue

        m = _RE_RSS_FETCHING.search(line)
        if m:
            phase = "rss"
            current = m.group(1).strip()
            step = int(m.group(2))
            total = int(m.group(3))
            rss_total = max(rss_total, total)
            rss_done = max(rss_done, step - 1)
            message = f"正在抓取 RSS：{current}（{step}/{total}）"
            continue

        m = _RE_RSS_DONE.search(line)
        if m and "开始抓取" not in line and "抓取完成" not in line and "正在获取" not in line:
            name = m.group(1).strip()
            if name and not name.startswith("["):
                phase = "rss"
                current = name
                rss_done += 1
                if rss_total:
                    rss_done = min(rss_done, rss_total)
                detail = m.group(2).strip()
                message = f"RSS {name}：{detail}"
            continue

        if "[RSS] 抓取完成" in line:
            phase = "rss_done"
            if rss_total:
                rss_done = rss_total
            message = "RSS 抓取完成"
            continue

        m = _RE_AI.search(line)
        if m:
            phase = "ai"
            current = m.group(1).strip()
            message = f"AI：{current}"
            continue

        m = _RE_TRANSLATE.search(line)
        if m:
            phase = "translate"
            current = m.group(1).strip()
            message = f"翻译：{current}"
            continue

        m = _RE_PUSH.search(line)
        if m:
            phase = "push"
            current = m.group(1).strip()
            message = f"推送：{current}"
            continue

        if _RE_HTML.search(line):
            phase = "report"
            message = "正在生成报告"
            continue

    # 估算百分比
    percent = 0
    if mode == "analyze":
        if phase in ("starting",):
            percent = 5
        elif phase in ("platforms", "platforms_done", "rss", "rss_done"):
            percent = 15
        elif phase == "ai":
            percent = 55
        elif phase == "translate":
            percent = 75
        elif phase == "push":
            percent = 88
        elif phase == "report":
            percent = 95
        else:
            percent = 30
    else:
        p_part = 0.0
        if platforms_total > 0:
            # 正在抓第 step 项时，算 step-0.3 完成感
            active = platforms_done
            if phase == "platforms" and step and total:
                active = max(active, step - 0.3)
            p_part = min(1.0, active / platforms_total) * weight_platform
        elif phase in ("platforms", "platforms_done"):
            p_part = weight_platform * (0.5 if phase == "platforms" else 1.0)

        r_part = 0.0
        if phase in ("rss", "rss_done") or rss_done or rss_total:
            if rss_total > 0:
                active = rss_done
                if phase == "rss" and step and total and "RSS" in message:
                    active = max(active, step - 0.3)
                r_part = min(1.0, active / rss_total) * weight_rss
            elif phase == "rss_done":
                r_part = float(weight_rss)
            else:
                r_part = weight_rss * 0.4
        if phase in ("platforms_done",) and not rss_total:
            # 尚不知是否有 RSS
            r_part = 0

        pipe = 0.0
        if phase == "ai":
            pipe = weight_pipeline * 0.45
        elif phase == "translate":
            pipe = weight_pipeline * 0.65
        elif phase == "push":
            pipe = weight_pipeline * 0.85
        elif phase == "report":
            pipe = weight_pipeline * 0.95
        elif phase in ("rss_done",) or (platforms_total and platforms_done >= platforms_total and rss_total and rss_done >= rss_total):
            pipe = weight_pipeline * 0.2

        if phase == "starting":
            percent = 2
        else:
            base = 0
            if platforms_total or phase in ("platforms", "platforms_done", "rss", "rss_done", "ai", "translate", "push", "report"):
                base = p_part + r_part + pipe
            percent = int(max(2, min(99, round(base))))

    return {
        "phase": phase,
        "message": message,
        "current": current,
        "step": step or None,
        "total": total or None,
        "platforms_done": platforms_done or None,
        "platforms_total": platforms_total or None,
        "rss_done": rss_done or None,
        "rss_total": rss_total or None,
        "percent": percent,
    }


TOOLBAR_HTML = """
<style>
#tr-toolbar{position:sticky;top:0;z-index:9999;margin:-16px -16px 16px;padding:12px 16px 10px;background:#fff;border-bottom:1px solid #eee;box-shadow:0 2px 12px rgba(0,0,0,.06);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#333}
#tr-toolbar .tr-row{max-width:720px;margin:0 auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#tr-toolbar button,#tr-toolbar select{border:1px solid #ddd;background:#fff;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer}
#tr-toolbar button.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}
#tr-toolbar button:disabled{opacity:.5;cursor:not-allowed}
#tr-toolbar button.ghost{background:#f8fafc;color:#334155}
#tr-toolbar button.ghost.active{background:#eef2ff;border-color:#c7d2fe;color:#4338ca}
#tr-toolbar label.switch{display:flex;align-items:center;gap:6px;font-size:13px;margin-left:auto}
#tr-toolbar .tr-status{width:100%;font-size:12px;color:#666;line-height:1.4}
#tr-toolbar .tr-err{color:#b91c1c}
#tr-toolbar .tr-progress-wrap{width:100%;display:none;margin-top:2px}
#tr-toolbar .tr-progress-wrap.show{display:block}
#tr-toolbar .tr-progress-meta{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#475569;margin-bottom:6px}
#tr-toolbar .tr-progress-meta strong{color:#0f172a;font-weight:600}
#tr-toolbar .tr-progress-track{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden}
#tr-toolbar .tr-progress-bar{height:100%;width:0%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:999px;transition:width .35s ease}
#tr-toolbar .tr-progress-bar.indeterminate{width:35% !important;animation:tr-indeterminate 1.2s ease-in-out infinite}
@keyframes tr-indeterminate{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
#tr-log-panel{display:none;max-width:720px;margin:10px auto 0;border:1px solid #e2e8f0;border-radius:10px;background:#0b1220;overflow:hidden}
#tr-log-panel.open{display:block}
#tr-log-panel .tr-log-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:#111827;color:#e5e7eb;font-size:12px}
#tr-log-panel .tr-log-head button{border:1px solid #334155;background:#1f2937;color:#e5e7eb;border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer}
#tr-log-panel pre{margin:0;max-height:280px;overflow:auto;padding:10px 12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d1d5db;white-space:pre-wrap;word-break:break-word}
#tr-config-overlay{display:none;position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.45);backdrop-filter:blur(2px)}
#tr-config-overlay.open{display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto}
.tr-config-card{width:100%;max-width:680px;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#1e293b;display:flex;flex-direction:column;max-height:calc(100vh - 64px)}
.tr-config-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e2e8f0;font-size:15px}
.tr-config-head button{border:none;background:#f1f5f9;border-radius:8px;width:28px;height:28px;cursor:pointer;color:#475569;font-size:13px}
.tr-config-head button:hover{background:#e2e8f0}
.tr-config-tabs{display:flex;gap:6px;padding:10px 18px;border-bottom:1px solid #e2e8f0}
.tr-tab-btn{border:1px solid #e2e8f0;background:#f8fafc;color:#475569;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer}
.tr-tab-btn.active{background:#eef2ff;border-color:#c7d2fe;color:#4338ca;font-weight:600}
.tr-tab-panel{padding:12px 18px 0;display:flex;flex-direction:column;gap:10px;overflow:auto}
/* display:flex 会覆盖 hidden 属性的默认 display:none，必须显式声明 */
#tr-config-overlay [hidden]{display:none!important}
.tr-config-meta{display:flex;align-items:center;gap:10px;font-size:12px;color:#64748b}
.tr-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;background:#f1f5f9;color:#475569}
.tr-badge.overlay{background:#eef2ff;color:#4338ca}
#tr-topics-text{width:100%;box-sizing:border-box;min-height:280px;resize:vertical;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0f172a;background:#f8fafc}
#tr-topics-text:focus{outline:2px solid #c7d2fe;border-color:#818cf8;background:#fff}
.tr-config-hint{font-size:12px;color:#64748b;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}
.tr-config-hint code{background:#e2e8f0;border-radius:4px;padding:1px 5px;font-size:11px}
.tr-config-actions{display:flex;gap:8px;padding:4px 0 8px}
.tr-config-actions button{border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;border:1px solid #ddd;background:#fff}
.tr-config-actions button.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}
.tr-config-actions button.primary:disabled{opacity:.5;cursor:not-allowed}
.tr-config-actions button.ghost{background:#f8fafc;color:#334155}
.tr-switch-row{display:flex;align-items:center;gap:8px;font-size:13px}
.tr-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#475569}
.tr-field-row{display:flex;gap:6px;align-items:stretch}
.tr-field-row input{flex:1}
.tr-field input,.tr-field select{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;color:#0f172a;box-sizing:border-box;width:100%;background:#fff}
.tr-field input:focus,.tr-field select:focus{outline:2px solid #c7d2fe;border-color:#818cf8}
.tr-field .tr-mini{border:1px solid #ddd;background:#f8fafc;color:#334155;border-radius:8px;padding:0 12px;font-size:12px;cursor:pointer;white-space:nowrap}
.tr-field .tr-mini:hover{background:#e2e8f0}
.tr-feeds-list{display:flex;flex-direction:column;gap:8px}
.tr-feed-row{display:grid;grid-template-columns:auto 1fr 2fr 86px 30px;gap:6px;align-items:center}
.tr-feed-row input[type=text]{border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:12px;color:#0f172a;width:100%;box-sizing:border-box}
.tr-feed-row input[type=text]:focus{outline:2px solid #c7d2fe;border-color:#818cf8}
.tr-feed-row .tr-feed-del{border:none;background:#fee2e2;color:#b91c1c;border-radius:8px;height:30px;cursor:pointer;font-size:13px}
.tr-feed-row .tr-feed-del:hover{background:#fecaca}
.tr-feed-row .tr-feed-url{font-size:11px;color:#64748b}
.tr-feed-add{align-self:flex-start;border:1px dashed #cbd5e1;background:#f8fafc;color:#475569;border-radius:8px;padding:7px 12px;font-size:12px;cursor:pointer}
.tr-config-status{padding:8px 18px 14px;font-size:12px;color:#475569;min-height:20px}
.tr-config-status.err{color:#b91c1c}
.tr-config-status.ok{color:#15803d}
</style>
<div id="tr-toolbar">
  <div class="tr-row">
    <button class="primary" id="tr-crawl" type="button">抓取</button>
    <button id="tr-analyze" type="button">AI 分析</button>
    <select id="tr-preset" title="调度预设"></select>
    <label class="switch"><input id="tr-ai" type="checkbox">定时分析</label>
    <button class="ghost" id="tr-log-toggle" type="button" title="查看任务日志">日志</button>
    <button class="ghost" id="tr-config-toggle" type="button" title="主题词与订阅管理">⚙️ 配置</button>
    <div class="tr-status" id="tr-status"></div>
    <div class="tr-progress-wrap" id="tr-progress-wrap">
      <div class="tr-progress-meta">
        <span id="tr-progress-text"><strong>准备中…</strong></span>
        <span id="tr-progress-pct">0%</span>
      </div>
      <div class="tr-progress-track"><div class="tr-progress-bar" id="tr-progress-bar"></div></div>
    </div>
  </div>
  <div id="tr-log-panel">
    <div class="tr-log-head">
      <span id="tr-log-title">任务日志</span>
      <span>
        <button type="button" id="tr-log-refresh">刷新</button>
        <button type="button" id="tr-log-close">收起</button>
      </span>
    </div>
    <pre id="tr-log-body">暂无日志</pre>
  </div>
</div>
<div id="tr-config-overlay">
  <div class="tr-config-card" role="dialog" aria-modal="true" aria-label="主题词与订阅管理">
    <div class="tr-config-head">
      <strong>配置管理</strong>
      <button type="button" id="tr-config-close" title="关闭">✕</button>
    </div>
    <div class="tr-config-tabs">
      <button type="button" class="tr-tab-btn active" data-tab="topics">主题词</button>
      <button type="button" class="tr-tab-btn" data-tab="feeds">订阅管理</button>
      <button type="button" class="tr-tab-btn" data-tab="ai">AI 配置</button>
    </div>
    <div class="tr-tab-panel" id="tr-panel-topics">
      <div class="tr-config-meta">
        <span id="tr-topics-source" class="tr-badge"></span>
        <span id="tr-topics-stats"></span>
      </div>
      <textarea id="tr-topics-text" spellcheck="false" placeholder="[GLOBAL_FILTER]&#10;震惊&#10;&#10;[WORD_GROUPS]&#10;华为&#10;/抖音|TikTok/ => 字节跳动"></textarea>
      <div class="tr-config-hint">
        词组用空行分隔；支持 <code>/正则/</code>、<code>=&gt; 别名</code>、<code>[组名]</code>、<code>+必须词</code>、<code>!排除词</code>、<code>@数量</code>。<code>[GLOBAL_FILTER]</code> 区为全局过滤词。
      </div>
      <div class="tr-config-actions">
        <button type="button" class="primary" id="tr-topics-save">保存主题词</button>
        <button type="button" class="ghost" id="tr-topics-reset" title="放弃面板修改，恢复为配置文件内容">恢复文件配置</button>
      </div>
    </div>
    <div class="tr-tab-panel" id="tr-panel-feeds" hidden>
      <label class="tr-switch-row"><input type="checkbox" id="tr-rss-enabled"> 启用 RSS 抓取</label>
      <div class="tr-config-meta">
        <span id="tr-feeds-source" class="tr-badge"></span>
        <span id="tr-feeds-stats"></span>
      </div>
      <div class="tr-feeds-list" id="tr-feeds-list"></div>
      <button type="button" class="ghost tr-feed-add" id="tr-feed-add">＋ 添加订阅</button>
      <div class="tr-config-hint">
        每个订阅需填写名称与 RSS 地址；「保留天数」留空使用全局设置，0 表示不过滤。保存后下次抓取生效。
      </div>
      <div class="tr-config-actions">
        <button type="button" class="primary" id="tr-feeds-save">保存订阅</button>
        <button type="button" class="ghost" id="tr-feeds-reset" title="放弃面板修改，恢复为 config.yaml 中的订阅">恢复文件配置</button>
      </div>
    </div>
    <div class="tr-tab-panel" id="tr-panel-ai" hidden>
      <div class="tr-config-meta">
        <span id="tr-ai-source" class="tr-badge"></span>
        <span id="tr-ai-keyinfo"></span>
      </div>
      <label class="tr-field">
        <span>API Key</span>
        <span class="tr-field-row">
          <input type="password" id="tr-ai-key" autocomplete="new-password" spellcheck="false" placeholder="输入 API Key">
          <button type="button" class="tr-mini" id="tr-ai-key-eye" title="显示/隐藏输入内容">显示</button>
        </span>
      </label>
      <label class="tr-field">
        <span>模型（LiteLLM 格式：提供商/模型名）</span>
        <input type="text" id="tr-ai-model" spellcheck="false" placeholder="deepseek/deepseek-v4-flash">
      </label>
      <label class="tr-field">
        <span>API 地址（可选，仅非主流服务商需要）</span>
        <input type="text" id="tr-ai-base" spellcheck="false" placeholder="https://your-provider.com/v1">
      </label>
      <label class="tr-field">
        <span>推理强度（仅推理型模型有效，留空不发送）</span>
        <select id="tr-ai-effort">
          <option value="">不设置（默认）</option>
          <option value="minimal">minimal · 最快</option>
          <option value="low">low · 低</option>
          <option value="medium">medium · 中</option>
          <option value="high">high · 最深度</option>
        </select>
      </label>
      <div class="tr-config-hint">
        模型为 LiteLLM 格式，如 <code>deepseek/deepseek-v4-flash</code>、<code>openai/gpt-4o</code>、<code>ollama/llama3</code>；
        使用国内中转或私有部署时填写 API 地址，且模型名加 <code>openai/</code> 前缀。
        推理强度仅对支持的模型生效（gpt-5 / o 系列 / grok 等），普通模型保持「不设置」。
        优先级：面板 &gt; 环境变量 &gt; config.yaml；密钥留空保存表示保持不变，输入框为空时点「显示」可查看已保存密钥。
      </div>
      <div class="tr-config-actions">
        <button type="button" class="primary" id="tr-ai-save">保存 AI 配置</button>
        <button type="button" class="ghost" id="tr-ai-reset" title="放弃面板修改（含已存密钥），恢复为环境变量 / config.yaml">恢复文件配置</button>
      </div>
    </div>
    <div class="tr-config-status" id="tr-config-status"></div>
  </div>
</div>
<script>
(function(){
  const statusEl=document.getElementById('tr-status');
  const crawlBtn=document.getElementById('tr-crawl');
  const analyzeBtn=document.getElementById('tr-analyze');
  const presetEl=document.getElementById('tr-preset');
  const aiEl=document.getElementById('tr-ai');
  const logToggle=document.getElementById('tr-log-toggle');
  const logPanel=document.getElementById('tr-log-panel');
  const logBody=document.getElementById('tr-log-body');
  const logTitle=document.getElementById('tr-log-title');
  const logRefresh=document.getElementById('tr-log-refresh');
  const logClose=document.getElementById('tr-log-close');
  const progressWrap=document.getElementById('tr-progress-wrap');
  const progressText=document.getElementById('tr-progress-text');
  const progressPct=document.getElementById('tr-progress-pct');
  const progressBar=document.getElementById('tr-progress-bar');
  let pollTimer=null;
  let logTimer=null;
  let logOpen=false;
  let stickBottom=true;

  function setBusy(on){
    crawlBtn.disabled=on;analyzeBtn.disabled=on;presetEl.disabled=on;aiEl.disabled=on;
  }
  function setStatus(msg, isErr){
    statusEl.textContent=msg||'';
    statusEl.className='tr-status'+(isErr?' tr-err':'');
  }
  function showProgress(on){
    progressWrap.classList.toggle('show', !!on);
    if(!on){
      progressBar.style.width='0%';
      progressBar.classList.remove('indeterminate');
      progressPct.textContent='0%';
      progressText.innerHTML='<strong>准备中…</strong>';
    }
  }
  function renderProgress(job){
    if(!job||!job.running){
      showProgress(false);
      return;
    }
    showProgress(true);
    const p=job.progress||{};
    const pct=typeof p.percent==='number'?p.percent:null;
    const msg=p.message||('正在'+(job.mode==='analyze'?'分析':'抓取')+'…');
    progressText.innerHTML='<strong>'+escapeHtml(msg)+'</strong>';
    if(pct==null || pct<=0){
      progressPct.textContent='…';
      progressBar.classList.add('indeterminate');
      progressBar.style.width='35%';
    }else{
      progressBar.classList.remove('indeterminate');
      progressBar.style.width=Math.max(2,Math.min(99,pct))+'%';
      progressPct.textContent=Math.max(2,Math.min(99,pct))+'%';
    }
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  async function loadSettings(){
    const r=await fetch('/api/settings');
    const s=await r.json();
    presetEl.innerHTML=(s.presets||[]).map(p=>'<option value="'+p.id+'">'+p.label+'</option>').join('');
    presetEl.value=s.schedule_preset||'off';
    aiEl.checked=!!s.ai_analysis_enabled;
    if(s.job&&s.job.running){
      setBusy(true);
      setStatus('正在'+(s.job.mode==='analyze'?'分析':'抓取')+'…');
      renderProgress(s.job);
      poll();
      if(logOpen) refreshLog(true);
    }
  }
  async function saveSettings(){
    await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ai_analysis_enabled:aiEl.checked,schedule_preset:presetEl.value})});
  }
  async function run(mode){
    setBusy(true);
    setStatus(mode==='analyze'?'正在分析…':'正在抓取…');
    showProgress(true);
    progressText.innerHTML='<strong>任务启动中…</strong>';
    progressBar.classList.add('indeterminate');
    const r=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:mode})});
    const s=await r.json();
    if(r.status===409){setBusy(true);setStatus('已有任务在运行');poll();if(logOpen)refreshLog(true);return;}
    if(!r.ok){setBusy(false);showProgress(false);setStatus('失败：'+(s.error||r.status),true);return;}
    if(logOpen) refreshLog(true);
    poll();
  }
  async function poll(){
    clearTimeout(pollTimer);
    const r=await fetch('/api/status');
    const s=await r.json();
    if(s.running){
      setBusy(true);
      setStatus('正在'+(s.mode==='analyze'?'分析':'抓取')+'…');
      renderProgress(s);
      if(logOpen) refreshLog(false);
      pollTimer=setTimeout(poll,1200);
      return;
    }
    showProgress(false);
    if(s.error){setBusy(false);setStatus('失败：'+s.error,true);if(logOpen)refreshLog(true);return;}
    setBusy(false);
    setStatus(s.mode?'完成，正在刷新…':'');
    if(s.mode) location.reload();
  }
  async function refreshLog(force){
    try{
      const nearBottom=logBody.scrollHeight-logBody.scrollTop-logBody.clientHeight<48;
      if(force) stickBottom=true;
      const r=await fetch('/api/logs?tail=500');
      const s=await r.json();
      const text=(s.text&&s.text.length)?s.text:'暂无日志';
      const prev=logBody.textContent;
      if(prev!==text){
        logBody.textContent=text;
        if(stickBottom||nearBottom) logBody.scrollTop=logBody.scrollHeight;
      }
      logTitle.textContent=s.running?('任务日志 · 进行中'+(s.mode?(' · '+s.mode):'')):'任务日志';
    }catch(e){
      logBody.textContent='读取日志失败：'+e;
    }
  }
  function openLog(){
    logOpen=true;
    logPanel.classList.add('open');
    logToggle.classList.add('active');
    refreshLog(true);
    clearInterval(logTimer);
    logTimer=setInterval(function(){ if(logOpen) refreshLog(false); },1500);
  }
  function closeLog(){
    logOpen=false;
    logPanel.classList.remove('open');
    logToggle.classList.remove('active');
    clearInterval(logTimer);
    logTimer=null;
  }
  logToggle.addEventListener('click',function(){ if(logOpen) closeLog(); else openLog(); });
  logClose.addEventListener('click',closeLog);
  logRefresh.addEventListener('click',function(){ refreshLog(true); });
  logBody.addEventListener('scroll',function(){
    stickBottom=logBody.scrollHeight-logBody.scrollTop-logBody.clientHeight<48;
  });
  crawlBtn.addEventListener('click',()=>run('crawl'));
  analyzeBtn.addEventListener('click',()=>run('analyze'));
  presetEl.addEventListener('change',saveSettings);
  aiEl.addEventListener('change',saveSettings);

  // ===== 配置管理（主题词 / RSS 订阅）=====
  const configToggle=document.getElementById('tr-config-toggle');
  const configOverlay=document.getElementById('tr-config-overlay');
  const configClose=document.getElementById('tr-config-close');
  const configStatus=document.getElementById('tr-config-status');
  const tabBtns=Array.prototype.slice.call(document.querySelectorAll('.tr-tab-btn'));
  const topicsText=document.getElementById('tr-topics-text');
  const topicsSource=document.getElementById('tr-topics-source');
  const topicsStats=document.getElementById('tr-topics-stats');
  const feedsList=document.getElementById('tr-feeds-list');
  const rssEnabledEl=document.getElementById('tr-rss-enabled');
  const feedsSource=document.getElementById('tr-feeds-source');
  const feedsStats=document.getElementById('tr-feeds-stats');
  let topicsFileContent='';

  function setConfigStatus(msg,cls){
    configStatus.textContent=msg||'';
    configStatus.className='tr-config-status'+(cls?(' '+cls):'');
  }
  function badgeText(source){ return source==='overlay'?'面板配置（覆盖文件）':(source==='env'?'环境变量':'配置文件'); }
  function sourceName(s){ return s==='overlay'?'面板':(s==='env'?'环境变量':(s==='config'?'配置文件':'')); }
  function openConfig(){
    configOverlay.classList.add('open');
    setConfigStatus('');
    loadTopics();
    loadFeeds();
    loadAI();
  }
  function closeConfig(){ configOverlay.classList.remove('open'); }
  configToggle.addEventListener('click',openConfig);
  configClose.addEventListener('click',closeConfig);
  configOverlay.addEventListener('click',function(e){ if(e.target===configOverlay) closeConfig(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&configOverlay.classList.contains('open')) closeConfig(); });
  tabBtns.forEach(function(btn){
    btn.addEventListener('click',function(){
      tabBtns.forEach(function(b){b.classList.toggle('active',b===btn);});
      ['topics','feeds','ai'].forEach(function(t){
        document.getElementById('tr-panel-'+t).hidden=btn.dataset.tab!==t;
      });
      setConfigStatus('');
    });
  });

  async function loadTopics(){
    try{
      const r=await fetch('/api/topics');
      const s=await r.json();
      topicsText.value=s.content||'';
      topicsFileContent=s.file_content||'';
      topicsSource.textContent=badgeText(s.source);
      topicsSource.className='tr-badge'+(s.source==='overlay'?' overlay':'');
      topicsStats.textContent=s.source==='overlay'?('已定义 '+s.group_count+' 个词组（文件配置已被覆盖）'):('已定义 '+s.group_count+' 个词组');
    }catch(e){ setConfigStatus('读取主题词失败：'+e,'err'); }
  }
  async function saveTopics(){
    const btn=document.getElementById('tr-topics-save');
    btn.disabled=true;
    try{
      const r=await fetch('/api/topics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:topicsText.value})});
      const s=await r.json();
      if(!r.ok){ setConfigStatus('保存失败：'+(s.error||r.status),'err'); return; }
      topicsText.value=s.content||'';
      topicsFileContent=s.file_content||'';
      topicsSource.textContent=badgeText(s.source);
      topicsSource.className='tr-badge'+(s.source==='overlay'?' overlay':'');
      topicsStats.textContent='已定义 '+s.group_count+' 个词组';
      if(!s.group_count){ setConfigStatus('已保存，但未解析到任何词组——将匹配所有新闻！如非本意请检查内容','err'); }
      else{ setConfigStatus('主题词已保存，下次抓取/分析生效','ok'); }
    }catch(e){ setConfigStatus('保存失败：'+e,'err'); }
    finally{ btn.disabled=false; }
  }
  async function resetTopics(){
    if(!confirm('恢复为配置文件中的主题词？面板修改将被放弃。')) return;
    try{
      const r=await fetch('/api/topics',{method:'DELETE'});
      const s=await r.json();
      if(!r.ok){ setConfigStatus('恢复失败：'+(s.error||r.status),'err'); return; }
      topicsText.value=s.content||'';
      topicsFileContent=s.file_content||'';
      topicsSource.textContent=badgeText(s.source);
      topicsSource.className='tr-badge';
      topicsStats.textContent='已定义 '+s.group_count+' 个词组';
      setConfigStatus('已恢复为配置文件内容','ok');
    }catch(e){ setConfigStatus('恢复失败：'+e,'err'); }
  }
  document.getElementById('tr-topics-save').addEventListener('click',saveTopics);
  document.getElementById('tr-topics-reset').addEventListener('click',resetTopics);

  function feedRow(feed){
    const row=document.createElement('div');
    row.className='tr-feed-row';
    const enabled=document.createElement('input');
    enabled.type='checkbox';
    enabled.checked=feed.enabled!==false;
    enabled.title='是否启用';
    const name=document.createElement('input');
    name.type='text'; name.value=feed.name||''; name.placeholder='名称';
    const url=document.createElement('input');
    url.type='text'; url.className='tr-feed-url'; url.value=feed.url||''; url.placeholder='https://example.com/feed.xml';
    const maxAge=document.createElement('input');
    maxAge.type='text'; maxAge.value=feed.max_age_days==null?'':String(feed.max_age_days); maxAge.placeholder='天数';
    maxAge.title='保留天数（留空=全局，0=不过滤）';
    const del=document.createElement('button');
    del.type='button'; del.className='tr-feed-del'; del.textContent='✕'; del.title='删除';
    del.addEventListener('click',function(){ row.remove(); });
    row.appendChild(enabled); row.appendChild(name); row.appendChild(url); row.appendChild(maxAge); row.appendChild(del);
    return row;
  }
  async function loadFeeds(){
    try{
      const r=await fetch('/api/feeds');
      const s=await r.json();
      rssEnabledEl.checked=!!s.rss_enabled;
      feedsList.innerHTML='';
      (s.feeds||[]).forEach(function(f){ feedsList.appendChild(feedRow(f)); });
      feedsSource.textContent=badgeText(s.source);
      feedsSource.className='tr-badge'+(s.source==='overlay'?' overlay':'');
      const enabledCount=(s.feeds||[]).filter(function(f){return f.enabled!==false;}).length;
      feedsStats.textContent='共 '+(s.feeds||[]).length+' 个订阅，启用 '+enabledCount+' 个';
    }catch(e){ setConfigStatus('读取订阅失败：'+e,'err'); }
  }
  function collectFeeds(){
    const rows=Array.prototype.slice.call(feedsList.querySelectorAll('.tr-feed-row'));
    return rows.map(function(row){
      const inputs=row.querySelectorAll('input[type=text]');
      const maxAgeRaw=inputs[2].value.trim();
      return {
        name:inputs[0].value.trim(),
        url:inputs[1].value.trim(),
        enabled:row.querySelector('input[type=checkbox]').checked,
        max_age_days:maxAgeRaw===''?null:Number(maxAgeRaw)
      };
    });
  }
  async function saveFeeds(){
    const btn=document.getElementById('tr-feeds-save');
    btn.disabled=true;
    try{
      const feeds=collectFeeds();
      const r=await fetch('/api/feeds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rss_enabled:rssEnabledEl.checked,feeds:feeds})});
      const s=await r.json();
      if(!r.ok){ setConfigStatus('保存失败：'+(s.error||r.status),'err'); return; }
      feedsList.innerHTML='';
      (s.feeds||[]).forEach(function(f){ feedsList.appendChild(feedRow(f)); });
      rssEnabledEl.checked=!!s.rss_enabled;
      feedsSource.textContent=badgeText(s.source);
      feedsSource.className='tr-badge'+(s.source==='overlay'?' overlay':'');
      const enabledCount=(s.feeds||[]).filter(function(f){return f.enabled!==false;}).length;
      feedsStats.textContent='共 '+(s.feeds||[]).length+' 个订阅，启用 '+enabledCount+' 个';
      if(!(s.feeds||[]).length){ setConfigStatus('已保存 0 个订阅——RSS 将不会抓取任何源！如非本意请添加订阅','err'); }
      else{ setConfigStatus('订阅已保存，下次抓取生效','ok'); }
    }catch(e){ setConfigStatus('保存失败：'+e,'err'); }
    finally{ btn.disabled=false; }
  }
  async function resetFeeds(){
    if(!confirm('恢复为 config.yaml 中的订阅配置？面板修改将被放弃。')) return;
    try{
      const r=await fetch('/api/feeds',{method:'DELETE'});
      const s=await r.json();
      if(!r.ok){ setConfigStatus('恢复失败：'+(s.error||r.status),'err'); return; }
      feedsList.innerHTML='';
      (s.feeds||[]).forEach(function(f){ feedsList.appendChild(feedRow(f)); });
      rssEnabledEl.checked=!!s.rss_enabled;
      feedsSource.textContent=badgeText(s.source);
      feedsSource.className='tr-badge';
      const enabledCount=(s.feeds||[]).filter(function(f){return f.enabled!==false;}).length;
      feedsStats.textContent='共 '+(s.feeds||[]).length+' 个订阅，启用 '+enabledCount+' 个';
      setConfigStatus('已恢复为配置文件内容','ok');
    }catch(e){ setConfigStatus('恢复失败：'+e,'err'); }
  }
  document.getElementById('tr-feed-add').addEventListener('click',function(){ feedsList.appendChild(feedRow({enabled:true})); });
  document.getElementById('tr-feeds-save').addEventListener('click',saveFeeds);
  document.getElementById('tr-feeds-reset').addEventListener('click',resetFeeds);

  // ===== AI 配置 =====
  const aiModel=document.getElementById('tr-ai-model');
  const aiBase=document.getElementById('tr-ai-base');
  const aiEffort=document.getElementById('tr-ai-effort');
  const aiKey=document.getElementById('tr-ai-key');
  const aiEye=document.getElementById('tr-ai-key-eye');
  const aiSource=document.getElementById('tr-ai-source');
  const aiKeyInfo=document.getElementById('tr-ai-keyinfo');

  function renderAI(s){
    aiModel.value=s.model||'';
    aiBase.value=s.api_base||'';
    aiEffort.value=s.reasoning_effort||'';
    aiKey.value='';
    aiKey.dataset.keySet=s.api_key_set?'1':'0';
    aiKey.placeholder=s.api_key_set?('已保存 '+s.api_key_masked+'，留空保持不变，点「显示」查看'):'未设置，输入 API Key';
    aiSource.textContent=badgeText(s.source);
    aiSource.className='tr-badge'+(s.source==='overlay'?' overlay':'');
    aiKeyInfo.textContent=s.api_key_set?('密钥来源：'+sourceName(s.api_key_source)):'未配置 API Key';
  }
  async function loadAI(){
    try{
      const r=await fetch('/api/ai');
      renderAI(await r.json());
    }catch(e){ setConfigStatus('读取 AI 配置失败：'+e,'err'); }
  }
  async function saveAI(){
    const btn=document.getElementById('tr-ai-save');
    btn.disabled=true;
    try{
      const body={
        model:aiModel.value.trim(),
        api_base:aiBase.value.trim(),
        reasoning_effort:aiEffort.value,
        api_key:aiKey.value.trim()
      };
      const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const s=await r.json();
      if(!r.ok){ setConfigStatus('保存失败：'+(s.error||r.status),'err'); return; }
      renderAI(s);
      setConfigStatus('AI 配置已保存，下次抓取/分析生效','ok');
    }catch(e){ setConfigStatus('保存失败：'+e,'err'); }
    finally{ btn.disabled=false; }
  }
  async function resetAI(){
    if(!confirm('恢复为环境变量 / config.yaml 中的 AI 配置？面板修改（含已保存的密钥）将被清除。')) return;
    try{
      const r=await fetch('/api/ai',{method:'DELETE'});
      const s=await r.json();
      if(!r.ok){ setConfigStatus('恢复失败：'+(s.error||r.status),'err'); return; }
      renderAI(s);
      setConfigStatus('已恢复为文件/环境变量配置','ok');
    }catch(e){ setConfigStatus('恢复失败：'+e,'err'); }
  }
  aiEye.addEventListener('click',async function(){
    // 输入为空且已配置密钥时，先拉取已保存密钥的明文（面板本地查看用）
    if(!aiKey.value && aiKey.dataset.keySet==='1'){
      try{
        const r=await fetch('/api/ai?reveal=1');
        const s=await r.json();
        if(s.api_key){ aiKey.value=s.api_key; }
      }catch(e){ /* 拉取失败则退回普通切换 */ }
    }
    const show=aiKey.type==='password';
    aiKey.type=show?'text':'password';
    aiEye.textContent=show?'隐藏':'显示';
  });
  document.getElementById('tr-ai-save').addEventListener('click',saveAI);
  document.getElementById('tr-ai-reset').addEventListener('click',resetAI);

  loadSettings().catch(e=>setStatus('面板加载失败',true));
})();
</script>
"""


class JobRunner:
    def __init__(self, project_root: str | Path = ".", output_dir: str | Path = "output"):
        self.project_root = Path(project_root)
        self.output_dir = Path(output_dir)
        self._lock = threading.Lock()
        self._proc: Optional[subprocess.Popen] = None
        self._mode: Optional[str] = None
        self._error: Optional[str] = None
        self._log_path = self.output_dir / JOB_LOG_NAME

    def is_running(self) -> bool:
        with self._lock:
            return self._proc is not None and self._proc.poll() is None

    def log_path(self) -> Path:
        return self._log_path

    def read_log(self, tail: int = LOG_TAIL_DEFAULT) -> Dict[str, Any]:
        path = self._log_path
        tail = max(1, min(int(tail or LOG_TAIL_DEFAULT), LOG_TAIL_MAX))
        if not path.exists():
            return {"text": "", "lines": 0, "path": str(path.name), "exists": False}
        try:
            # 任务日志通常不大；按行截取尾部即可
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            return {"text": f"[读取日志失败] {exc}", "lines": 0, "path": str(path.name), "exists": True}
        lines = content.splitlines()
        sliced = lines[-tail:] if tail < len(lines) else lines
        text = "\n".join(sliced)
        if len(lines) > tail:
            text = f"… 已省略前 {len(lines) - tail} 行 …\n" + text
        return {
            "text": text,
            "lines": len(lines),
            "tail": len(sliced),
            "path": str(path.name),
            "exists": True,
        }

    def status(self) -> Dict[str, Any]:
        with self._lock:
            running = self._proc is not None and self._proc.poll() is None
            mode = self._mode
            error = self._error
        log_info = self.read_log(tail=LOG_TAIL_DEFAULT)
        progress = parse_job_progress(log_info.get("text") or "", mode=mode)
        if not running and not mode and not (log_info.get("text") or "").strip():
            progress = {
                "phase": "idle",
                "message": "",
                "current": "",
                "percent": 0,
                "step": None,
                "total": None,
                "platforms_done": None,
                "platforms_total": None,
                "rss_done": None,
                "rss_total": None,
            }
        elif not running and mode and not error:
            progress = dict(progress)
            progress["phase"] = "done"
            progress["message"] = progress.get("message") or "已完成"
            progress["percent"] = 100
        return {
            "running": running,
            "mode": mode,
            "error": error,
            "progress": progress,
            "log_lines": log_info.get("lines") or 0,
        }

    def start(self, mode: str) -> None:
        if mode not in ("crawl", "analyze"):
            raise ValueError(f"未知模式: {mode}")
        with self._lock:
            if self._proc is not None and self._proc.poll() is None:
                raise RuntimeError("running")
            env = os.environ.copy()
            if mode == "analyze":
                env["WEBUI_RUN_AI"] = "true"
                env["SCHEDULE_ENABLED"] = "false"
            else:
                env["WEBUI_RUN_AI"] = "false"
            self.output_dir.mkdir(parents=True, exist_ok=True)
            log_file = open(self._log_path, "w", encoding="utf-8")
            # 行缓冲，便于前端实时看到进度
            try:
                if hasattr(log_file, "reconfigure"):
                    log_file.reconfigure(line_buffering=True)
            except Exception:
                pass
            self._error = None
            self._mode = mode
            self._proc = subprocess.Popen(
                [sys.executable, "-u", "-m", "trendradar"],
                cwd=str(self.project_root),
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            threading.Thread(target=self._watch, args=(log_file,), daemon=True).start()

    def _watch(self, log_file) -> None:
        proc = self._proc
        if proc is None:
            log_file.close()
            return
        code = proc.wait()
        try:
            log_file.flush()
        except Exception:
            pass
        log_file.close()
        with self._lock:
            if code != 0:
                self._error = f"退出码 {code}"
            self._proc = None


class ControlState:
    def __init__(
        self,
        output_dir: str | Path,
        runner: Any = None,
        project_root: str | Path = ".",
    ):
        self.output_dir = Path(output_dir)
        self.runner = runner or JobRunner(project_root=project_root, output_dir=self.output_dir)
        self.project_root = Path(project_root)

    # === 配置文件定位 ===

    def _config_dir(self) -> Path:
        env_path = os.environ.get("CONFIG_PATH", "")
        if env_path:
            return Path(env_path).expanduser().resolve().parent
        return self.project_root / "config"

    def _frequency_words_path(self) -> Path:
        env_path = os.environ.get("FREQUENCY_WORDS_PATH", "")
        if env_path and Path(env_path).exists():
            return Path(env_path)
        candidate = self._config_dir() / "frequency_words.txt"
        if candidate.exists():
            return candidate
        return Path(env_path) if env_path else candidate

    def _config_yaml_path(self) -> Path:
        env_path = os.environ.get("CONFIG_PATH", "")
        if env_path:
            return Path(env_path).expanduser()
        return self._config_dir() / "config.yaml"

    # === 主题词 ===

    def _read_frequency_file(self) -> str:
        try:
            return self._frequency_words_path().read_text(encoding="utf-8")
        except OSError:
            return ""

    def topics_payload(self) -> Dict[str, Any]:
        overlay = load_overlay(self.output_dir)
        override = overlay.get("frequency_words")
        file_content = self._read_frequency_file()
        using_override = isinstance(override, str) and override.strip() != ""
        content = override if isinstance(override, str) else file_content
        groups, _filters, _global_filters = _parse_words_for_api(content)
        return {
            "content": content,
            "source": "overlay" if using_override else "file",
            "file_content": file_content,
            "file_path": str(self._frequency_words_path()),
            "group_count": len(groups),
        }

    # === RSS 订阅 ===

    def _read_yaml_feeds(self) -> Dict[str, Any]:
        try:
            data = yaml.safe_load(self._config_yaml_path().read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError):
            return {"enabled": None, "feeds": []}
        if not isinstance(data, dict):
            return {"enabled": None, "feeds": []}
        rss = data.get("rss", {}) or {}
        feeds = rss.get("feeds", []) or []
        return {"enabled": rss.get("enabled"), "feeds": feeds if isinstance(feeds, list) else []}

    def feeds_payload(self) -> Dict[str, Any]:
        overlay = load_overlay(self.output_dir)
        override = overlay.get("rss")
        yaml_data = self._read_yaml_feeds()
        if isinstance(override, dict) and (override.get("feeds") is not None):
            feeds = override.get("feeds") or []
            enabled = override.get("enabled")
            if enabled is None:
                enabled = yaml_data.get("enabled")
            if enabled is None:
                enabled = True
            source = "overlay"
        else:
            feeds = yaml_data.get("feeds") or []
            enabled = yaml_data.get("enabled")
            if enabled is None:
                enabled = True
            source = "config"
        normalized = [
            {
                "id": str(f.get("id") or ""),
                "name": str(f.get("name") or f.get("id") or ""),
                "url": str(f.get("url") or ""),
                "enabled": bool(f.get("enabled", True)),
                "max_age_days": f.get("max_age_days"),
            }
            for f in feeds
            if isinstance(f, dict)
        ]
        return {
            "rss_enabled": bool(enabled),
            "feeds": normalized,
            "source": source,
            "config_path": str(self._config_yaml_path()),
        }

    # === AI 配置 ===

    def _read_yaml_ai(self) -> Dict[str, Any]:
        try:
            data = yaml.safe_load(self._config_yaml_path().read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError):
            return {}
        if not isinstance(data, dict):
            return {}
        ai = data.get("ai", {})
        return ai if isinstance(ai, dict) else {}

    def _effective_ai(self) -> Dict[str, Any]:
        """计算生效的 AI 配置（overlay > 环境变量 > config.yaml），含明文密钥。"""
        overlay_ai = load_overlay(self.output_dir).get("ai")
        has_overlay = isinstance(overlay_ai, dict)
        env_key = os.environ.get("AI_API_KEY", "").strip()
        env_model = os.environ.get("AI_MODEL", "").strip()
        env_base = os.environ.get("AI_API_BASE", "").strip()
        yaml_ai = self._read_yaml_ai()
        yaml_key = str(yaml_ai.get("api_key") or "").strip()

        def pick(*candidates: Any) -> str:
            for candidate in candidates:
                if candidate:
                    return str(candidate)
            return ""

        effective_key = pick(
            has_overlay and overlay_ai.get("api_key"),
            env_key,
            yaml_key,
        )
        if has_overlay and str(overlay_ai.get("api_key") or "").strip():
            key_source = "overlay"
        elif env_key:
            key_source = "env"
        elif yaml_key:
            key_source = "config"
        else:
            key_source = None

        if has_overlay:
            source = "overlay"
        elif env_key or env_model or env_base:
            source = "env"
        else:
            source = "config"
        # overlay 存在时 api_base / reasoning_effort 以 overlay 为准（空串 = 用户已清空，不回落）
        if has_overlay:
            api_base = str(overlay_ai.get("api_base") or "")
            reasoning_effort = str(overlay_ai.get("reasoning_effort") or "")
        else:
            api_base = pick(env_base, str(yaml_ai.get("api_base") or ""))
            reasoning_effort = str(yaml_ai.get("reasoning_effort") or "").strip().lower()
        return {
            "model": pick(
                has_overlay and overlay_ai.get("model"),
                env_model,
                str(yaml_ai.get("model") or ""),
            ),
            "api_base": api_base,
            "reasoning_effort": reasoning_effort,
            "api_key": effective_key,
            "api_key_source": key_source,
            "source": source,
        }

    def ai_payload(self, reveal: bool = False) -> Dict[str, Any]:
        payload = self._effective_ai()
        key = payload.pop("api_key")
        payload.update(
            {
                "api_key_set": bool(key),
                "api_key_masked": mask_secret(key),
            }
        )
        # 明文密钥仅在显式请求 reveal 时返回（供面板“显示”按钮查看已保存密钥）
        if reveal:
            payload["api_key"] = key
        return payload

    def settings(self) -> Dict[str, Any]:
        overlay = load_overlay(self.output_dir)
        env_ai = os.environ.get("AI_ANALYSIS_ENABLED", "").strip().lower()
        default_ai = True if not env_ai else env_ai in ("true", "1", "yes")
        preset = overlay.get("schedule_preset") or "off"
        enabled = overlay.get("schedule_enabled")
        if enabled is None:
            enabled = preset != "off"
        payload = {
            "ai_analysis_enabled": overlay.get("ai_analysis_enabled", default_ai),
            "schedule_enabled": bool(enabled),
            "schedule_preset": preset,
            "presets": [dict(item) for item in PRESETS],
            "job": self.runner.status(),
        }
        return payload


def _json_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def make_handler(state: ControlState):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(state.output_dir), **kwargs)

        def log_message(self, format, *args):
            sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

        def _send_json(self, status: int, payload: Dict[str, Any]):
            body = _json_bytes(payload)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> Dict[str, Any]:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            if not raw:
                return {}
            data = json.loads(raw.decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("JSON 必须是对象")
            return data

        def do_HEAD(self):
            # manage.py 用 HEAD / 探活；API 与注入 HTML 走同一路由
            parsed = urlparse(self.path)
            path = parsed.path
            if path.startswith("/api/"):
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", "2")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            if path in ("/", "/index.html") or path.endswith(".html"):
                target = state.output_dir / "index.html" if path in ("/", "/index.html") else Path(self.translate_path(self.path))
                if target.is_file():
                    body = target.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    return
                self.send_error(404, "File not found")
                return
            super().do_HEAD()

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            if path == "/api/settings":
                self._send_json(200, state.settings())
                return
            if path == "/api/topics":
                self._send_json(200, state.topics_payload())
                return
            if path == "/api/feeds":
                self._send_json(200, state.feeds_payload())
                return
            if path == "/api/ai":
                qs = parse_qs(parsed.query or "")
                reveal = (qs.get("reveal") or [""])[0].strip().lower() in ("1", "true", "yes")
                self._send_json(200, state.ai_payload(reveal=reveal))
                return
            if path == "/api/status":
                self._send_json(200, state.runner.status())
                return
            if path == "/api/logs":
                qs = parse_qs(parsed.query or "")
                try:
                    tail = int((qs.get("tail") or [LOG_TAIL_DEFAULT])[0])
                except (TypeError, ValueError):
                    tail = LOG_TAIL_DEFAULT
                log_payload = state.runner.read_log(tail=tail)
                st = state.runner.status()
                log_payload.update(
                    {
                        "running": st.get("running"),
                        "mode": st.get("mode"),
                        "error": st.get("error"),
                        "progress": st.get("progress"),
                    }
                )
                self._send_json(200, log_payload)
                return
            if path in ("/", "/index.html"):
                self._serve_html(state.output_dir / "index.html")
                return
            if path.endswith(".html"):
                fs_path = Path(self.translate_path(self.path))
                if fs_path.is_file():
                    self._serve_html(fs_path)
                    return
            super().do_GET()

        def do_POST(self):
            path = urlparse(self.path).path
            try:
                payload = self._read_json()
            except (ValueError, json.JSONDecodeError) as exc:
                self._send_json(400, {"error": str(exc)})
                return
            if path == "/api/settings":
                try:
                    save_overlay(payload, state.output_dir)
                except ValueError as exc:
                    self._send_json(400, {"error": str(exc)})
                    return
                self._send_json(200, state.settings())
                return
            if path == "/api/topics":
                try:
                    content = validate_frequency_words(payload.get("content"))
                except ValueError as exc:
                    self._send_json(400, {"error": str(exc)})
                    return
                try:
                    save_overlay({"frequency_words": content}, state.output_dir)
                except ValueError as exc:
                    self._send_json(400, {"error": str(exc)})
                    return
                self._send_json(200, state.topics_payload())
                return
            if path == "/api/feeds":
                try:
                    feeds = _validate_feeds(payload.get("feeds"))
                except ValueError as exc:
                    self._send_json(400, {"error": str(exc)})
                    return
                rss_enabled = payload.get("rss_enabled")
                try:
                    save_overlay(
                        {"rss": {"enabled": bool(rss_enabled), "feeds": feeds}},
                        state.output_dir,
                    )
                except ValueError as exc:
                    self._send_json(400, {"error": str(exc)})
                    return
                self._send_json(200, state.feeds_payload())
                return
            if path == "/api/ai":
                model = str(payload.get("model") or "").strip()
                if not model:
                    self._send_json(400, {"error": "model 不能为空"})
                    return
                api_base = str(payload.get("api_base") or "").strip()
                if api_base and not api_base.startswith(("http://", "https://")):
                    self._send_json(400, {"error": "api_base 必须以 http:// 或 https:// 开头"})
                    return
                effort = str(payload.get("reasoning_effort") or "").strip().lower()
                # 密钥留空 = 保持已保存的密钥不变（不回传明文，前端无法回填）
                new_key = str(payload.get("api_key") or "").strip()
                existing_ai = load_overlay(state.output_dir).get("ai")
                ai_data: Dict[str, Any] = {
                    "model": model,
                    "api_base": api_base,
                    "reasoning_effort": effort,
                }
                if new_key:
                    ai_data["api_key"] = new_key
                elif isinstance(existing_ai, dict) and existing_ai.get("api_key"):
                    ai_data["api_key"] = existing_ai["api_key"]
                try:
                    save_overlay({"ai": ai_data}, state.output_dir)
                except ValueError as exc:
                    self._send_json(400, {"error": str(exc)})
                    return
                self._send_json(200, state.ai_payload())
                return
            if path == "/api/run":
                mode = payload.get("mode")
                if mode not in ("crawl", "analyze"):
                    self._send_json(400, {"error": "mode 必须是 crawl 或 analyze"})
                    return
                if state.runner.is_running():
                    self._send_json(409, {"error": "running", "job": state.runner.status()})
                    return
                try:
                    state.runner.start(mode)
                except RuntimeError:
                    self._send_json(409, {"error": "running", "job": state.runner.status()})
                    return
                self._send_json(202, {"ok": True, "mode": mode, "job": state.runner.status()})
                return
            self._send_json(404, {"error": "not found"})

        def do_DELETE(self):
            path = urlparse(self.path).path
            if path == "/api/topics":
                remove_overlay_keys(["frequency_words"], state.output_dir)
                self._send_json(200, state.topics_payload())
                return
            if path == "/api/feeds":
                remove_overlay_keys(["rss"], state.output_dir)
                self._send_json(200, state.feeds_payload())
                return
            if path == "/api/ai":
                remove_overlay_keys(["ai"], state.output_dir)
                self._send_json(200, state.ai_payload())
                return
            self._send_json(404, {"error": "not found"})

        def _serve_html(self, path: Path):
            if not path.is_file():
                self.send_error(404, "File not found")
                return
            html = path.read_text(encoding="utf-8")
            if TOOLBAR_MARKER not in html:
                injected = TOOLBAR_HTML
                lower = html.lower()
                idx = lower.find("<body")
                if idx >= 0:
                    gt = html.find(">", idx)
                    html = html[: gt + 1] + injected + html[gt + 1 :]
                else:
                    html = injected + html
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

    return Handler


def start_control_server(
    port: int,
    output_dir: str | Path,
    project_root: str | Path = ".",
    bind: str = "0.0.0.0",
) -> None:
    state = ControlState(output_dir=output_dir, project_root=project_root)
    handler = make_handler(state)
    server = ThreadingHTTPServer((bind, port), handler)
    print(f"  🎛️ 控制面板: http://127.0.0.1:{port}/")
    server.serve_forever()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("WEBSERVER_PORT", "8080"))
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("WEBSERVER_DIR", "output")
    project_root = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("TRENDRADAR_ROOT", ".")
    start_control_server(port, output_dir, project_root=project_root)


if __name__ == "__main__":
    main()
