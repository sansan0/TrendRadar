# OpenClaw 集成（MVP）

本页提供 TrendRadar 与 OpenClaw 的最小可用集成方案：

- 稳定执行入口（scheduled/manual）
- 结构化执行回执（JSON）
- 状态文件（`last_sent_at / latest_db / checksum`）
- 失败时降级信息（避免静默）

## 1. 执行入口

新增脚本：`tools/openclaw_runner.py`

```bash
python tools/openclaw_runner.py --run-mode scheduled
```

手动补跑：

```bash
python tools/openclaw_runner.py --run-mode manual
```

失败时附带降级提示（可用于告警通知）：

```bash
python tools/openclaw_runner.py --run-mode scheduled --fallback-last-on-failure
```

## 2. 输出回执格式

脚本会输出结构化 JSON，字段示例：

```json
{
  "status": "success|failed",
  "run_mode": "scheduled|manual",
  "duration_seconds": 12.34,
  "error_type": "fetch_failed|db_missing|notify_failed|pipeline_failed|process_nonzero|unknown",
  "summary": "TrendRadar run succeeded",
  "latest_db": "output/news/2026-02-12.db",
  "latest_db_mtime": "2026-02-12T21:09:26+08:00",
  "latest_db_checksum": "...",
  "changed_since_last": true,
  "state_file": "output/openclaw/openclaw_state.json",
  "log_file": "output/openclaw/openclaw_runner.log"
}
```

## 3. 状态文件（幂等/去重基础）

默认状态文件路径：`output/openclaw/openclaw_state.json`

主要字段：

- `last_sent_at`
- `latest_db`
- `latest_db_mtime`
- `latest_db_checksum`
- `changed_since_last`

OpenClaw 可基于 `changed_since_last=false` 决定是否跳过重复发送。

## 4. OpenClaw Cron 示例

> 在 OpenClaw cron job 的 `agentTurn` 中执行：

```bash
cd /path/to/TrendRadar
python tools/openclaw_runner.py --run-mode scheduled --fallback-last-on-failure
```

并将 JSON 回执发送到目标渠道（如 Feishu/Telegram）。

## 5. 故障排查

- 运行日志：`output/openclaw/openclaw_runner.log`
- TrendRadar 原生日志：终端输出 + 既有 `output/` 产物
- 若 `status=failed`，优先看 `error_type` 与 `summary`

---

说明：该集成为 MVP，不改变 TrendRadar 现有抓取/分析/推送主流程，仅新增 OpenClaw 场景下的统一入口与回执能力。
