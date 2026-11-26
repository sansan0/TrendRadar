# TrendRadar Web 管理台

本项目在原 TrendRadar 6.11 的基础上增加了 **Web 管理台**：所有常用配置都可以在浏览器里完成，不需要再登录服务器改 YAML 或命令行参数。管理台与采集程序在同一个 Python 环境中运行，内置定时调度器，不依赖 supercronic 或 GitHub Actions。

## 部署示例（请替换为你的域名与服务器 IP）

| 项目 | 值 |
|---|---|
| 访问地址 | https://td.example.com/ |
| 登录用户名 | `admin` |
| 服务名 | `trendradar-web` |
| 安装目录 | `/opt/trendradar` |
| 运行用户 | `trendradar`（systemd 服务，开机自启） |
| 监听端口 | `443`（HTTPS），`80` 自动跳转 |
| 证书 | Let's Encrypt（示例），`data/tls/fullchain.pem` |
| 时区 | `Asia/Shanghai` |

初始密码在部署命令输出中给出；如果遗失，可在服务器执行：

```bash
cd /opt/trendradar
sudo -u trendradar .venv/bin/python -m web_admin --set-password '新的强密码'
sudo systemctl restart trendradar-web
```

登录后建议立刻在「系统设置 → 管理员密码」中改成自己的密码。

## 管理台能做什么

- **配置全覆盖**：115 个字段，覆盖 `config.yaml` 中基础、调度、数据源、报告、筛选、展示、AI、通知、存储、高级全部配置块。
- **数据源可视化管理**：热榜平台和 RSS 源支持增删、排序、启用/禁用。
- **敏感信息保护**：Webhook、Bot Token、API Key、S3 密钥等字段只显示“已设置（尾号 xxxx）”，留空保存不会覆盖原值；需要清空时有单独的「清除」按钮。
- **关键词可视化配置**：「关键词」页面按词组管理词条，支持组别名、最大条数、`+` 必须词、`!` 过滤词、`/正则/`、`=>` 显示别名与全局过滤词；保存前自动备份，可直接看到每组词条数量。
- **推送配置指南**：「推送通知」页面内置飞书、钉钉、企业微信、Telegram、邮件、ntfy、Bark、Slack、通用 Webhook 的逐步配置说明、地址示例与常见错误提示，保存后可直接发送测试通知。
- **文本配置编辑**：AI 兴趣描述、各类提示词、时间线文件、原始 `config.yaml` 都可以在网页里编辑；关键词原始文件也保留在「文件编辑」中，便于查看或批量粘贴。
- **运行控制**：立即采集/分析/推送、测试通知渠道、配置体检、停止任务、实时日志与历史日志。
- **内置调度**：5 段 cron 表达式（分 时 日 月 周），保存后 20 秒内生效；可设置“仅手动运行”和“启动时立即运行一次”。
- **报告浏览**：运行生成的 HTML 报告可直接在管理台打开，报告访问需要登录。
- **访问安全**：密码登录、CSRF 校验、登录失败限速、会话过期、可选 IP/网段白名单、可选 TLS 证书。
- **保存安全**：保存前做类型与跨字段校验（时区、权重和、平台 ID 唯一、RSS URL、区域顺序等），写入前自动备份到 `data/backups/`，原子替换文件。

## 首次使用建议

1. 用 `admin` 和初始密码登录，先改密码。
2. 打开「AI 能力」，填写 API Key（也可以留空，仅使用关键词筛选）。
3. 打开「推送通知」，展开页面顶部的「配置指南」，按步骤填入至少一个渠道；保存后点右上角「发送测试通知」验证。
4. 打开「关键词」，按词组维护自己要关注的主题；保存后下一次采集生效。
5. 按需调整「数据源」「筛选与展示」「基础与报告」。
6. 在「系统设置」确认 cron（默认每 30 分钟）和时区。
7. 点「立即运行」跑一次，确认日志无报错、报告能打开。

> 未配置 AI Key 时，采集与关键词筛选仍然正常，AI 分析和翻译会被跳过并在日志中提示。

## 域名与 HTTPS

以 `td.example.com` 为例，域名、HTTPS 开关和证书路径都可以在「系统设置 → 域名与 HTTPS」中维护。域名、HTTPS 开关和证书路径都可以在「系统设置 → 域名与 HTTPS」中维护。

配置步骤：

1. 域名 A 记录指向 `203.0.113.10`。如果使用 Cloudflare 代理，SSL/TLS 模式选 **Full (strict)**，源站证书就是本机 Let's Encrypt 证书。
2. 登录管理台，在「系统设置 → 域名与 HTTPS」填写域名、打开 HTTPS、确认证书与私钥路径（默认 `data/tls/fullchain.pem`、`data/tls/privkey.pem`），点「保存并应用」。
3. 服务会在约 5 秒内重启，当前页面会断开；之后用 `https://td.example.com/` 重新登录。HTTP 80 会 301 跳转到该域名。
4. 如果证书或私钥校验不通过，服务会记录原因并自动回退到 HTTP，避免配置错误导致失联；修正后再应用即可。

证书签发与续期（服务器 root）：

```bash
/root/.acme.sh/acme.sh --issue --server letsencrypt -d td.example.com \
  --webroot /opt/trendradar/data/acme --keylength ec-256

/root/.acme.sh/acme.sh --install-cert -d td.example.com --ecc \
  --key-file /opt/trendradar/data/tls/privkey.pem \
  --fullchain-file /opt/trendradar/data/tls/fullchain.pem \
  --reloadcmd "chown -R trendradar:trendradar /opt/trendradar/data/tls && systemctl restart trendradar-web"
```

安装后 acme.sh 会写入 root crontab 每日检查并自动续期。ACME 校验文件由管理台在 `/.well-known/acme-challenge/` 路径直接提供，因此续期不需要停服务。

Cloudflare 常见问题：访问 `https://` 出现 **521** 表示 Cloudflare 连不上源站 443，先确认管理台已启用 HTTPS、证书有效且服务监听 443；HTTP 能打开而 HTTPS 不行时，优先看 `journalctl -u trendradar-web` 中的启动回退原因。

> 经 Cloudflare 代理时，管理台看到的访问 IP 是 Cloudflare 回源地址，因此「IP 白名单」应留空，访问控制请在 Cloudflare 侧用 WAF 或 Access 完成。

## 服务管理

```bash
# 状态
systemctl status trendradar-web

# 重启（修改启动参数或升级代码后）
systemctl restart trendradar-web

# 服务日志（管理台自身的访问与错误）
journalctl -u trendradar-web -f

# 采集任务日志
ls -lt /opt/trendradar/data/logs | head
```

## 目录与数据

| 路径 | 用途 |
|---|---|
| `config/config.yaml` | 主配置（网页保存后会重写，原文件备份在 `data/backups/`） |
| `config/frequency_words.txt` | 关键词规则 |
| `config/timeline.yaml` | 时间线模板 |
| `data/admin.json` | 管理员密码哈希（PBKDF2，不存明文） |
| `data/settings.json` | cron、运行模式、IP 白名单 |
| `data/backups/` | 配置保存前的自动备份（保留最近 60 份） |
| `data/logs/` | 每次运行的日志 |
| `output/` | SQLite 数据库与 HTML 报告 |

配置备份恢复：

```bash
ls -lt /opt/trendradar/data/backups | head
cp /opt/trendradar/data/backups/<备份文件> /opt/trendradar/config/config.yaml
chown trendradar:trendradar /opt/trendradar/config/config.yaml
```

## 公网安全说明

当前实例通过 **HTTP 80** 提供服务，适合直接用公网 IP 访问，但密码与配置在传输中是明文。长期使用建议二选一：

1. **绑定域名 + TLS**（推荐）：申请证书后，把启动参数改为
   `python -m web_admin --host 0.0.0.0 --port 443 --cert /path/fullchain.pem --key /path/privkey.pem`，
   并在 systemd 中放开 443。
2. **限制来源 IP**：在「系统设置 → IP 白名单」填入自己的固定出口 IP 或网段；不固定时不要填写，否则会把自己锁在外面（保存时会校验当前 IP 是否在名单内）。

另外建议：

- 不要把 80/443 以外的管理端口暴露到公网。
- 定期查看「运行与日志」中的失败记录。
- 初始密码只通过可信渠道传递，登录后立即修改。

## 本地开发 / 重新部署

本地运行（需要 Python 3.10+ 与 PyYAML）：

```bash
pip install pyyaml
ADMIN_PASSWORD='本地测试密码' python -m web_admin --port 8080
```

重新在 Ubuntu/Debian VPS 部署（在项目根执行，需要 root）：

```bash
sudo ADMIN_PASSWORD='你的强密码' bash deploy-vps.sh
```

脚本会安装 uv 与 Python 3.12、创建虚拟环境与依赖、创建 `trendradar` 用户、写入并启动 systemd 服务。默认安装到 `/opt/trendradar`，可用 `APP_DIR=/srv/trendradar PORT=8080` 覆盖。

## 与原始项目的兼容性

- 原有 `python -m trendradar`、`--doctor`、`--test-notification`、`--show-schedule` 命令保持不变。
- 原有 Docker 部署文件保留，仍可按原方式使用；Docker 中不会自动启动管理台。
- 新增的 `web_admin/` 包只依赖标准库与 PyYAML，不改变采集、分析、推送逻辑。
- 仅调整了无图形界面 Linux 服务器上“运行结束自动打开浏览器”的行为，避免 VPS 上无意义的打开尝试。