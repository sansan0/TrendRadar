# TrendRadar Docker 部署问题排查与解决指南

## 📋 目录

1. [部署问题概述](#部署问题概述)
2. [问题1：配置文件缺失](#问题1配置文件缺失)
3. [问题2：端口绑定导致外部无法访问](#问题2端口绑定导致外部无法访问)
4. [问题3：配置文件同步问题](#问题3配置文件同步问题)
5. [完整部署流程](#完整部署流程)
6. [常见部署问题](#常见部署问题)
7. [最佳实践](#最佳实践)

---

## 部署问题概述

在部署 TrendRadar Docker 容器的过程中，我们遇到了以下主要问题：

| 问题 | 现象 | 根本原因 | 解决方案 |
|------|------|----------|----------|
| **配置文件缺失** | `❌ 配置文件缺失` | 启动目录错误 | 从正确的目录启动 |
| **端口绑定问题** | `127.0.0.1:9800` | 配置文件同步问题 | 在服务器上直接修改配置 |
| **文件同步延迟** | Windows 编辑未同步到服务器 | 网络共享/缓存问题 | 在服务器上直接编辑 |

---

## 问题1：配置文件缺失

### 问题描述

**错误信息**：
```
❌ 配置文件缺失
```

**容器日志**：
```
检查配置文件...
config.yaml 不存在或不可读
frequency_words.txt 不存在或不可读
```

### 根本原因

**目录结构错误**：在错误的目录下执行 `docker compose up -d`

**错误的目录结构**：
```
❌ 错误：在项目根目录启动
TrendRadar/
├── docker/
├── config/
└── docker compose up -d  # 在这里执行会失败
```

**正确的目录结构**：
```
✅ 正确：在 docker 目录下启动
TrendRadar/
├── config/
├── docker/
└── cd docker && docker compose up -d  # 在这里执行
```

**原因分析**：
- `docker-compose.yml` 使用相对路径挂载配置：
  ```yaml
  volumes:
    - ../config:/app/config:ro  # 相对上一级目录
  ```
- 如果在 `docker/` 目录外启动，`../config` 路径会指向错误位置

### 解决方案

#### 步骤 1：确认目录结构

```bash
# 检查当前目录
pwd

# 应该在以下目录之一：
# h:\zskj\AI\TrendRadar\TrendRadar\docker
# /soft/TrendRadar/docker

# 验证相对路径
ls ../config
```

**预期输出**：
```
config.yaml
frequency_words.txt
ai_analysis_prompt.txt
ai_translation_prompt.txt
```

#### 步骤 2：进入正确的目录

```bash
# Windows
cd h:\zskj\AI\TrendRadar\TrendRadar\docker

# Linux 服务器
cd /soft/TrendRadar/docker
```

#### 步骤 3：验证配置文件

```bash
# 确认配置文件存在
ls ../config/config.yaml
ls ../config/frequency_words.txt
```

#### 步骤 4：启动容器

```bash
# 在 docker 目录下执行
docker compose up -d

# 查看日志验证
docker compose logs -f trendradar
```

**成功标志**：
```
✅ 配置文件检查通过
⏰ 启动supercronic: */30 * * * *
▶️ 立即执行一次
```

---

## 问题2：端口绑定导致外部无法访问

### 问题描述

**现象**：
- ✅ 服务器本地访问 `curl http://localhost:9800` 成功
- ✅ 服务器浏览器访问 `http://localhost:9800` 成功
- ❌ 其他主机 `curl http://服务器IP:9800` 失败
- ❌ 其他主机浏览器访问 `http://服务器IP:9800` 失败

**错误信息**：
```
curl: (7) Failed to connect to 172.16.5.132 port 9800: Connection refused
```

**端口映射状态**：
```bash
docker port trendradar
# 输出：9800/tcp -> 127.0.0.1:9800
```

### 根本原因

**端口绑定错误**：容器端口绑定到了 `127.0.0.1`，只允许本地访问。

**问题演化过程**：

1. **初始配置**（Windows）
   - 在 Windows 上修改了 `docker-compose.yml`
   - 将 `127.0.0.1:8080` 改为 `0.0.0.0:8080`

2. **文件未同步**
   - 项目在 Windows H: 盘
   - 通过某种方式映射到 Linux 服务器 `/soft/TrendRadar`
   - Windows 修改未实时同步到服务器

3. **容器使用旧配置**
   - Docker Compose 读取的是服务器上的旧配置
   - 仍然是 `127.0.0.1:9800`

### 诊断过程

#### 诊断 1：检查 Docker Compose 实际读取的配置

```bash
cd /soft/TrendRadar/docker
docker compose config
```

**输出结果**：
```yaml
ports:
  - mode: ingress
    host_ip: 127.0.0.1    # ← 问题在这里！
    target: 9800
    published: "9800"
    protocol: tcp
```

#### 诊断 2：检查服务器上的配置文件

```bash
cat /soft/TrendRadar/docker/docker-compose.yml | grep -A 2 ports
```

**输出**：
```yaml
ports:
  - "0.0.0.0:${WEBSERVER_PORT:-8080}:${WEBSERVER_PORT:-8080}"  # Windows 上已修改
```

**结论**：配置文件在 Windows 和 Linux 服务器上不一致。

### 解决方案

#### 方法 1：在服务器上直接修改配置文件（推荐）

```bash
# 1. 进入服务器上的 docker 目录
cd /soft/TrendRadar/docker

# 2. 使用 sed 直接替换
sed -i 's/127.0.0.1:9800/0.0.0.0:9800/g' docker-compose.yml

# 3. 验证修改
cat docker-compose.yml | grep 9800
# 应该看到 0.0.0.0:9800

# 4. 重建容器
docker compose down
docker compose up -d --force-recreate

# 5. 验证端口映射
docker port trendradar
# 应该输出：9800/tcp -> 0.0.0.0:9800
```

#### 方法 2：使用 vi/nano 手动编辑

```bash
cd /soft/TrendRadar/docker
vi docker-compose.yml
# 或
nano docker-compose.yml

# 找到这一行：
#     - "127.0.0.1:9800:9800"
# 改为：
#     - "0.0.0.0:9800:9800"

# 保存后重建容器
docker compose down
docker compose up -d --force-recreate
```

#### 方法 3：使用 extra_hosts（临时方案）

如果其他方法不行，检查网络配置：

```yaml
# docker-compose.yml
services:
  trendradar:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### 验证步骤

#### 步骤 1：检查端口映射

```bash
docker port trendradar
```

**正确输出**：
```
9800/tcp -> 0.0.0.0:9800
```

#### 步骤 2：检查端口监听

```bash
netstat -tulnp | grep 9800
```

**正确输出**：
```
tcp        0      0.0.0.0:9800            0.0.0.0:*               LISTEN
```

#### 步骤 3：从其他主机测试

```bash
# 从其他机器执行
curl http://172.16.5.132:9800
```

**成功标志**：返回 HTML 内容或 HTTP 200

---

## 问题3：配置文件同步问题

### 问题描述

**现象**：
- 在 Windows 上编辑了配置文件
- 服务器上读取的仍是旧配置
- 需要手动在服务器上同步修改

### 根本原因

**文件同步延迟**：
- 项目通过某种方式（可能是网络共享、WSL2、FTP等）映射到服务器
- Windows 上的修改不会立即同步到服务器
- Docker Compose 读取服务器上的文件，而不是 Windows 上的

### 解决方案

#### 方案 1：在服务器上直接编辑（推荐）

```bash
# SSH 连接到服务器
ssh user@172.16.5.132

# 进入配置目录
cd /soft/TrendRadar/docker

# 使用 vi/nano 编辑
vi docker-compose.yml
vi .env

# 保存后重启容器
docker compose restart
```

#### 方案 2：使用 SCP 上传配置文件

```bash
# 在 Windows 上编辑好文件后，上传到服务器
scp h:\zskj\AI\TrendRadar\TrendRadar\docker\.env \
    user@172.16.5.132:/soft/TrendRadar/docker/.env

# 重启容器
ssh user@172.16.5.132 "cd /soft/TrendRadar/docker && docker compose restart"
```

#### 方案 3：使用 Git 同步（推荐长期方案）

```bash
# 在项目目录初始化 Git
cd /soft/TrendRadar
git init
git add .
git commit -m "Update configuration"

# 在 Windows 上修改后
git add .
git commit -m "Update docker-compose.yml"
git push

# 在服务器上拉取更新
git pull
```

---

## 完整部署流程

### 标准部署步骤（经过验证）

#### 步骤 1：准备项目文件

```bash
# 1. 确认项目完整
cd h:\zskj\AI\TrendRadar\TrendRadar

# 2. 检查必要的文件
ls -la config/
# 应包含：config.yaml, frequency_words.txt 等

# 3. 检查 docker 目录
ls -la docker/
# 应包含：docker-compose.yml, .env, Dockerfile
```

#### 步骤 2：配置环境变量

```bash
cd docker

# 编辑 .env 文件
notepad .env

# 最小配置（只启用必要项）
ENABLE_WEBSERVER=true
WEBSERVER_PORT=9800
```

#### 步骤 3：修改端口绑定（在服务器上）

```bash
# SSH 到服务器
ssh user@172.16.5.132

# 进入目录
cd /soft/TrendRadar/docker

# 修改端口绑定
sed -i 's/127.0.0.1:9800/0.0.0.0:9800/g' docker-compose.yml

# 验证修改
cat docker-compose.yml | grep 9800
```

#### 步骤 4：启动容器

```bash
# 在服务器上执行
cd /soft/TrendRadar/docker

# 停止旧容器（如果存在）
docker compose down

# 启动新容器
docker compose up -d

# 查看日志
docker compose logs -f trendradar
```

#### 步骤 5：验证部署

```bash
# 1. 检查容器状态
docker ps | grep trendradar

# 2. 检查端口映射
docker port trendradar
# 应该输出：9800/tcp -> 0.0.0.0:9800

# 3. 本地测试
curl http://localhost:9800

# 4. 远程测试
# 从其他机器执行
curl http://172.16.5.132:9800
```

---

## 常见部署问题

### 问题1：容器启动失败

**检查**：
```bash
docker compose logs trendradar
```

**常见原因**：
1. 配置文件路径错误
2. 端口被占用
3. 镜像未下载

**解决**：
```bash
# 1. 检查配置文件
ls -la ../config
ls -la ../config/config.yaml

# 2. 检查端口占用
netstat -tulnp | grep 9800

# 3. 拉取镜像
docker pull wantcat/trendradar:latest
```

---

### 问题2：防火墙阻止访问

**检查**：
```bash
# 检查防火墙状态
sudo firewall-cmd --state

# 查看开放的端口
sudo firewall-cmd --list-ports
```

**解决**：
```bash
# 开放 9800 端口
sudo firewall-cmd --add-port=9800/tcp --permanent
sudo firewall-cmd --reload

# 或者临时关闭防火墙（测试用）
sudo systemctl stop firewalld
```

---

### 问题3：SELinux 阻止访问

**检查**：
```bash
sudo getenforce
```

**如果是 Enforcing**，可能需要调整 SELinux 策略。

---

### 问题4：网络模式问题

**症状**：容器无法访问外网 API

**检查**：
```bash
docker exec -it trendradar curl https://newsnow-api.vercel.app/api/news
```

**解决**：
```yaml
# docker-compose.yml
services:
  trendradar:
    # 添加网络模式
    network_mode: bridge
```

---

### 问题5：容器内进程异常

**检查**：
```bash
docker exec -it trendradar ps aux
docker exec -it trendradar python manage.py status
```

**解决**：
```bash
# 重启容器
docker compose restart

# 或完全重建
docker compose down
docker compose up -d --force-recreate
```

---

## 最佳实践

### 1. 目录结构规范

```
TrendRadar/
├── config/              # 配置文件（只读挂载）
│   ├── config.yaml
│   ├── frequency_words.txt
│   └── ...
├── docker/             # Docker 配置和脚本
│   ├── docker-compose.yml
│   ├── .env
│   ├── Dockerfile
│   └── entrypoint.sh
├── output/             # 输出文件（读写挂载）
└── trendradar/         # 源代码（只读挂载）
```

### 2. 配置修改流程

#### 推荐：直接在服务器上修改

```bash
# 1. SSH 连接
ssh user@server_ip

# 2. 进入目录
cd /soft/TrendRadar/docker

# 3. 编辑配置
vi docker-compose.yml
vi .env

# 4. 重启容器
docker compose restart
```

#### 备选：使用 Git 管理

```bash
# 1. 修改配置
vi docker-compose.yml

# 2. 提交更改
git add docker-compose.yml
git commit -m "Fix port binding"

# 3. 推送到服务器
git push

# 4. 在服务器上拉取
ssh user@server_ip "cd /soft/TrendRadar && git pull"
```

### 3. 端口配置规范

#### 本地测试环境

```yaml
ports:
  - "0.0.0.0:8080:8080"  # 允许所有访问
```

#### 生产环境（推荐）

```yaml
ports:
  - "127.0.0.1:8080:8080"  # 只允许本地访问
  # 配置反向代理（Nginx）对外提供服务
```

### 4. 防火墙配置

#### 开发/测试环境

```bash
# 关闭防火墙（简单）
sudo systemctl stop firewalld
```

#### 生产环境

```bash
# 只开放必要端口
sudo firewall-cmd --add-port=9800/tcp --permanent
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload

# 或只允许特定 IP
sudo firewall-cmd --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port="9800" accept' --permanent
```

### 5. 日志和监控

#### 查看日志

```bash
# 实时日志
docker compose logs -f trendradar

# 最近 100 行日志
docker compose logs --tail=100 trendrad

# 带时间戳的日志
docker compose logs -f trendradar | grep ERROR
```

#### 监控容器健康

```bash
# 检查容器状态
docker ps | grep trendradar

# 检查容器资源使用
docker stats trendradar

# 检查容器进程
docker exec -it trendradar ps aux
```

---

## 快速参考

### 常用命令

| 操作 | 命令 |
|------|------|
| 启动容器 | `docker compose up -d` |
| 停止容器 | `docker compose down` |
| 重启容器 | `docker compose restart` |
| 查看日志 | `docker compose logs -f trendradar` |
| 查看状态 | `docker exec -it trendradar python manage.py status` |
| 手动执行 | `docker exec -it trendradar python manage.py run` |
| 查看端口映射 | `docker port trendradar` |
| 进入容器 | `docker exec -it trendradar sh` |

### 诊断流程图

```
问题定位
    │
    ├─→ 查看容器日志
    │   docker compose logs trendradar
    │
    ├─→ 检查容器状态
    │   docker ps
    │   docker exec -it trendradar python manage.py status
    │
    ├─→ 检查端口映射
    │   docker port trendradar
    │   netstat -tulnp | grep 9800
    │
    └─→ 检查防火墙
        sudo firewall-cmd --list-ports
        sudo getenforce
```

---

## 总结

### 核心问题回顾

| 问题 | 关键点 | 解决方案 |
|------|--------|----------|
| **配置文件缺失** | 目录错误 | 从 `docker/` 目录启动 |
| **外部无法访问** | 端口绑定 127.0.0.1 | 修改为 0.0.0.0 |
| **配置不同步** | Windows ↔ Linux 同步延迟 | 在服务器上直接修改 |

### 经验教训

1. **始终从正确的目录启动**
   ```bash
   cd docker/  # 必须在 docker 目录下
   docker compose up -d
   ```

2. **验证配置文件**
   ```bash
   ls ../config  # 确认配置文件存在
   ```

3. **检查端口映射**
   ```bash
   docker port trendradar  # 确认是 0.0.0.0 而不是 127.0.0.1
   ```

4. **优先在服务器上修改配置**
   - 避免 Windows/Linux 同步问题
   - 确保配置立即生效

5. **使用管理工具诊断**
   ```bash
   docker exec -it trendradar python manage.py status
   docker exec -it trendradar python manage.py webserver_status
   ```

---

**部署愉快！🚀**

如有问题，请参考：
- [Docker 部署指南](08-docker-deployment-guide.md)
- [AI 集成指南](11-ai-integration-guide.md)
- [用户手册](07-user-manual.md)
