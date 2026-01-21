# TrendRadar Next-web

TrendRadar 的现代化 Web 管理后台，基于 NiceGUI、FastAPI 和 MySQL 构建。

## 功能特性
- **数据大屏 (Dashboard)**: 集成 ECharts 实现数据可视化。
- **新闻管理**: 支持全文搜索、服务端分页、AI 润色及 Edge-TTS 语音合成。
- **系统管理**: 配置文件编辑器（支持原子写入）、同步日志查看。
- **架构设计**: 采用 Sidecar Sync 模式（SQLite -> MySQL 5.7），读写分离。

## 安装与运行

### 1. 环境要求
- Docker & Docker Compose

### 2. 启动服务
```bash
cd Next-web
docker-compose up -d --build
```

### 3. 访问系统
- Web 界面: http://localhost:8086
- 默认管理员账号: `admin` / `123456`

## 开发说明
- `app` 目录已挂载到容器中，支持热重载（NiceGUI 特性）。
- 配置文件从 `../config` 挂载。
- 爬虫输出数据以只读方式从 `../output` 挂载。

## 环境变量
默认值请参考 `docker-compose.yml`。
- `ENABLE_AUTO_CLEANUP`: 设置为 `True` 以开启每日清理旧音频文件和日志的功能。
