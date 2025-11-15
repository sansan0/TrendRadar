# Repository Guidelines

## 项目结构与模块组织
根目录的 `main.py` 与 `config/config.yaml` 构成传统爬取与通知入口，`config/frequency_words.txt` 维护关注词；`mcp_server/` 包含 FastMCP 服务器实现（`tools/` 提供查询、分析、配置与系统工具，`services/`、`utils/` 负责数据与共享逻辑）；`docker/` 保存 Dockerfile、compose 模板与入口脚本；`_image/`、`README-*.md`、`setup-*.sh|bat`、`start-http.*` 属于文档与启动资产。按照模块职责放置代码，避免在脚本中混入配置或长常量，改为集中在 `config/`。

## 构建、测试与开发命令
运行 `uv sync`（macOS/Linux 可先执行 `./setup-mac.sh`，Windows 用 bat 脚本）以创建虚拟环境；本地调试 CLI 逻辑时使用 `uv run python main.py` 并确保相关环境变量（如 `CONFIG_PATH`、`REPORT_MODE`）已设置；启动 MCP STDIO 服务器：`uv run python -m mcp_server.server --transport stdio`，HTTP 调试可执行 `./start-http.sh`（监听 `http://localhost:3333/mcp`）；容器化部署可在 `docker` 目录运行 `docker compose -f docker/docker-compose.yml up -d` 或 `docker compose -f docker/docker-compose-build.yml build`。

## 编码风格与命名约定
所有 Python 代码遵循 PEP 8 与 4 空格缩进，保持类型注解（项目已有 `typing` 与 dataclass 风格）并通过模块层常量（如 `VERSION`）集中配置；模块、文件、函数均使用 `snake_case`，类采用 `PascalCase`，常量使用 `UPPER_SNAKE_CASE`；访问外部资源时优先通过注入的路径或配置对象，避免隐藏的全局依赖，必要时加入快速注释解释复杂控制流，保持 KISS/YAGNI。

## 测试指南
仓库当前缺少自动化测试，新增功能需同步补充 `tests/` 下的 `pytest` 用例（建议按工具或服务模块分层命名，如 `test_tools_data_query.py`），并以 `uv run pytest` 运行；对主要路径至少验证一轮偏差（合法配置、不完整配置、网络异常）。在提交前手动执行 `uv run python main.py` 与所需的 `mcp_server` 传输模式，确认 webhook、队列与 HTTP 入口日志均无异常，同时附带必要的截图或日志片段。

## 提交与 Pull Request 准则
Git 历史采用简化的 Conventional Commits（`fix: ...`、`docs: ...`、`chore: ...`），保持 `<type>: <scope?> summary` 的命名，并将改动拆分为原子提交；PR 需说明动机、关键实现、测试覆盖、潜在回归点，关联 issue（`Closes #123`）并在涉及 UI/HTTP 交互时附运行截图或 curl 输出，确保 docs、配置示例与脚本同步更新。

## 安全与配置提示
`config/config.yaml` 与通知密钥仅应存在于本地或私有仓库，公共讨论中请示例化敏感值；CI/CD 推荐通过环境变量注入 `FEISHU_WEBHOOK_URL` 等信息，并可使用 `CONFIG_PATH` 指向脱敏版本；Docker 与 MCP 启动脚本默认开放本地端口，如需公网暴露必须加反向代理、API key 或 VPN 保护，同时勿将 `.venv`、`__pycache__`、日志及带凭证的临时文件纳入版本控制。
