# Synology NAS Deployment Guide

This guide explains how to deploy TrendRadar on Synology NAS using the Container
Manager GUI.

## 1. Package Image Locally

Run on Mac:

```bash
pixi run build-nas
```

Output file: `trendradar-nas.tar` (in project root directory)

## 2. Upload to NAS

### Option 1: File Station (Recommended)

1. Open File Station
2. Upload `trendradar-nas.tar` to NAS, e.g.: `/volume1/docker/trendradar/`

### Option 2: SCP

```bash
scp trendradar-nas.tar admin@nas-ip:/volume1/docker/trendradar/
```

## 3. Container Manager GUI Deployment

### 3.1 Import Images

1. Open **Container Manager**
2. Go to **Image** > **Add** > **Import from file**
3. Select uploaded `trendradar-nas.tar`
4. Wait for import, verify images exist:

    - `docker-trendradar:latest`
    - `docker-trendradar-mcp:latest`

### 3.2 Create Config Directory

Create directory on NAS (via File Station or terminal):

```bash
/volume1/docker/trendradar/
├── config/
│   ├── config.yaml         # Upload your config file
│   └── frequency_words.txt # Upload your keywords file
└── output/
```

### 3.3 Create Containers

#### Create trendradar container

1. Go to **Container** > **Create**
2. Configure:

    - Container Name: `trendradar`
    - Image: `docker-trendradar:latest`
    - Network: `bridge` (default)
    - Restart Policy: `unless-stopped`

3. **Port Settings**:

    - Local Port: `8080` > Container Port: `8080` (TCP)
    - **Important**: Use `8080` only, NOT `127.0.0.1:8080` for external access

4. Volume Settings:

    - `/volume1/docker/trendradar/config` > `/app/config` (read-only)
    - `/volume1/docker/trendradar/output` > `/app/output` (read-write)

5. **Environment Variables**:

    - Default values are pre-filled from the Docker image
    - Modify as needed (especially TZ and ENABLE_WEBSERVER)
    - Add notification channel credentials if enabling notifications

6. Complete creation

#### Create trendradar-mcp container

1. Go to **Container** > **Create**
2. Configure:

    - Container Name: `trendradar-mcp`
    - Image: `docker-trendradar-mcp:latest`
    - Network: `bridge` (default)
    - Restart Policy: `unless-stopped`

3. Port Settings: Local 3333 > Container 3333 (TCP)

4. Volume Settings:

    - `/volume1/docker/trendradar/config` > `/app/config` (read-only)
    - `/volume1/docker/trendradar/output` > `/app/output` (read-write)

5. Environment Variables:

    - TZ: `America/Phoenix`

6. Complete creation

#### MCP Server Mode Configuration

The MCP server supports two transport modes:

| Mode               | Access Method           | Use Case                                     |
| ------------------ | ----------------------- | -------------------------------------------- |
| **HTTP** (Default) | `http://<NAS-IP>:3333/` | n8n, curl, browser, other HTTP clients       |
| stdio              | Standard input/output   | Claude Desktop, direct process communication |

The Dockerfile is pre-configured for HTTP mode to support n8n integration. If
you need stdio mode, modify the command in Dockerfile.mcp:

```dockerfile
# HTTP Mode (Default - for n8n)
CMD ["python", "-c", "from mcp_server.server import run_server; run_server('http', '0.0.0.0', 3333)"]

# stdio Mode (for Claude Desktop)
CMD ["python", "-c", "from mcp_server.server import run_server; run_server('stdio')"]
```

To change modes, rebuild the image after modifying the Dockerfile.

#### n8n Integration (HTTP Mode)

To use MCP server with n8n in HTTP mode:

1. **Create HTTP Request Node** in n8n workflow
2. Configure endpoint: `http://trendradar-mcp:3333/<tool-name>`
3. Use POST method with JSON body

Example n8n node configuration:

```json
{
  "method": "POST",
  "url": "http://trendradar-mcp:3000/analyze_topic_trend_unified",
  "sendHeaders": true,
  "headerValues": {
    "Content-Type": "application/json"
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "topic",
        "value": "人工智能"
      },
      {
        "name": "analysis_type",
        "value": "trend"
      }
    ]
  }
}
```

**Note**: When running n8n and MCP server in the same Docker network, use
container name `trendradar-mcp` instead of IP address. For external access
(outside Docker network), use NAS IP: `http://<NAS-IP>:3333/`

## 4. Verify Deployment

1. Go to **Container**, confirm both containers are **Running**
2. Click container to view **Logs**, verify no errors
3. Check logs for successful startup messages

## 5. Web Server Access

After deployment, the web server can be accessed at:

-   **URL**: http://<NAS-IP>:8080 (use HTTP, not HTTPS)
-   **Files**: HTML reports, TXT snapshots, etc.
-   **Important**: The container serves HTTP on port 8080. For HTTPS access, use
    Synology WebStation or Reverse Proxy.

-   **Report Structure**:

    -   Homepage: http://<NAS-IP>:8080/index.html (if exists)
    -   Daily reports: http://<NAS-IP>:8080/html/YYYY-MM-DD/
    -   Text snapshots: http://<NAS-IP>:8080/txt/YYYY-MM-DD/

### Generating Reports

HTML reports are generated when the crawler runs. To generate reports
immediately:

```bash
docker exec trendradar python -m trendradar
```

After execution, check available reports:

```bash
docker exec trendradar ls -la /app/output/html/
```

Then access reports at:

```bash
http://<NAS-IP>:8080/2026-01-08/html/当前榜单汇总.html
```

### Port Configuration Important

For external access, ensure port is configured as `8080` only (not
`127.0.0.1:8080`):

**Correct:**

```bash
Local Port: 8080 > Container Port: 8080
```

**Incorrect (will block external access):**

```bash
Local Port: 127.0.0.1:8080 > Container Port: 8080
```

### Subdomain Access (Recommended)

For production access via subdomain (e.g., `trendradar.<your-domain>`):

1. **Container Manager** > **Network** > **Create**:

    - Name: `trendradar-network`
    - Driver: `bridge`

2. **Reverse Proxy** (Control Panel > Portal > Reverse Proxy):

    - Protocol: `HTTPS`
    - Hostname: `trendradar` (your subdomain)
    - Destination:

        - Protocol: `HTTP`
        - Hostname: `localhost`
        - Port: `8080`

3. **Container port configuration**:

    - Port Settings: Local `8080` > Container `8080` (TCP)
    - **Important**: Must be `8080` only (not `127.0.0.1:8080`) for
      WebStation/reverse proxy to work

4. Access: <http://trendradar.<your-domain>>

### WebStation Integration

The Dockerfile includes `EXPOSE 8080` so Synology Container Manager recognizes
it as a web service. To use with WebStation:

1. **Ensure port is exposed**:

    - Container Manager should show port 8080 as exposed
    - If not visible, rebuild the image after Dockerfile update

2. **WebStation Configuration**:

    - Open **Web Station**
    - Go to **PHP Settings** or **Web Service Portal**
    - Add a new virtual host or modify existing one
    - Set up reverse proxy to forward requests to the container

3. **Alternative: Manual Reverse Proxy**:

    - Control Panel > Application Portal > Reverse Proxy
    - Create new rule:
        - Protocol: `HTTPS`
        - Hostname: `trendradar` (or your subdomain)
        - Destination: `localhost:8080`

## 6. Management Commands

This section documents all available management commands for operating the
TrendRadar container. These commands can be executed via Docker exec in the NAS
terminal or through Container Manager's terminal feature.

### Container Management

```bash
# Restart container
docker restart trendradar

# Stop container
docker stop trendradar

# Start container
docker start trendradar

# Delete container (preserves data volumes)
docker rm trendradar

# View container logs
docker logs trendradar

# Follow logs in real-time
docker logs -f trendradar
```

### Container Terminal Access

```bash
# Interactive shell access
docker exec -it trendradar /bin/bash

# Run a single command
docker exec trendradar python manage.py status
```

### TrendRadar Management Commands

TrendRadar provides a `manage.py` script for container management. Access the
container terminal and run these commands:

#### Status and Information

```bash
# View current service status
docker exec -it trendradar python manage.py status

# Display current configuration
docker exec -it trendradar python manage.py config

# Show output files
docker exec -it trendradar python manage.py files

# View web server status
docker exec -it trendradar python manage.py webserver_status
```

#### Crawler Operations

```bash
# Manually execute crawler once
docker exec -it trendradar python manage.py run

# View real-time logs
docker exec -it trendradar python manage.py logs
```

#### Web Server Management

The web server serves generated reports via HTTP on port 8080. Use these
commands to manage it:

```bash
# Start web server
docker exec -it trendradar python manage.py start_webserver

# Stop web server
docker exec -it trendradar python manage.py stop_webserver

# Check web server status
docker exec -it trendradar python manage.py webserver_status
```

#### Help

```bash
# Display all available commands
docker exec -it trendradar python manage.py help
```

### Container Manager GUI Operations

#### View Logs

In Container Manager, select the container and view the **Action Logs** tab.

#### Restart Container

In Container Manager, select the container and click **Action** > **Restart**.

#### Edit Configuration

1. In Container Manager, select the container
2. Click **Action** > **Edit**
3. Modify settings as needed
4. Restart container for changes to take effect

### Update Image

1. Repackage locally: `pixi run build-nas`
2. Upload new `trendradar-nas.tar` to NAS
3. In Container Manager: stop/delete old containers, import new image, recreate
   containers

### Environment Variables Reference

The following environment variables are **bundled in the Docker image** and will
be pre-filled when creating the modify them container. You can in Container
Manager GUI:

| Variable            | Default           | Bundled | Description                               |
| ------------------- | ----------------- | ------- | ----------------------------------------- |
| TZ                  | `America/Phoenix` | Yes     | Container timezone                        |
| CRON_SCHEDULE       | `0 */2 * * *`     | Yes     | Cron expression for scheduled execution   |
| RUN_MODE            | `cron`            | Yes     | `cron` (scheduled) or `once` (single run) |
| IMMEDIATE_RUN       | `true`            | Yes     | Execute immediately on startup            |
| ENABLE_WEBSERVER    | `true`            | Yes     | Enable web server on port 8080            |
| WEBSERVER_PORT      | `8080`            | Yes     | Web server port                           |
| ENABLE_CRAWLER      | (empty)           | No      | Enable news crawler                       |
| ENABLE_NOTIFICATION | `false`           | Yes     | Enable notification channels              |
| REPORT_MODE         | (empty)           | No      | Report generation mode                    |
| DISPLAY_MODE        | (empty)           | No      | Display mode for reports                  |

#### Notification Channels (Sensitive - Configure Manually)

| Variable             | Default | Description                          |
| -------------------- | ------- | ------------------------------------ |
| FEISHU_WEBHOOK_URL   | (empty) | Feishu Webhook URL                   |
| TELEGRAM_BOT_TOKEN   | (empty) | Telegram Bot Token                   |
| TELEGRAM_CHAT_ID     | (empty) | Telegram Chat ID                     |
| DINGTALK_WEBHOOK_URL | (empty) | DingTalk Webhook URL                 |
| WEWORK_WEBHOOK_URL   | (empty) | WeChat Work Webhook URL              |
| WEWORK_MSG_TYPE      | (empty) | WeChat Work message type (text/card) |
| SLACK_WEBHOOK_URL    | (empty) | Slack Webhook URL                    |
| BARK_URL             | (empty) | Bark URL (iOS push notifications)    |

#### Email Configuration (Sensitive - Configure Manually)

| Variable          | Default | Description                                |
| ----------------- | ------- | ------------------------------------------ |
| EMAIL_FROM        | (empty) | Email sender address                       |
| EMAIL_PASSWORD    | (empty) | Email password or app password             |
| EMAIL_TO          | (empty) | Email recipient address                    |
| EMAIL_SMTP_SERVER | (empty) | SMTP server address                        |
| EMAIL_SMTP_PORT   | (empty) | SMTP port (e.g., 587 for TLS, 465 for SSL) |

#### ntfy Configuration (Sensitive - Configure Manually)

| Variable        | Default           | Description               |
| --------------- | ----------------- | ------------------------- |
| NTFY_SERVER_URL | `https://ntfy.sh` | ntfy server URL           |
| NTFY_TOPIC      | (empty)           | ntfy topic                |
| NTFY_TOKEN      | (empty)           | ntfy authentication token |

#### S3 Remote Storage (Sensitive - Configure Manually)

| Variable             | Default | Description                |
| -------------------- | ------- | -------------------------- |
| S3_ENDPOINT_URL      | (empty) | S3-compatible endpoint URL |
| S3_BUCKET_NAME       | (empty) | S3 bucket name             |
| S3_ACCESS_KEY_ID     | (empty) | S3 access key ID           |
| S3_SECRET_ACCESS_KEY | (empty) | S3 secret access key       |
| S3_REGION            | (empty) | S3 region                  |

#### Cron Schedule Reference

The `CRON_SCHEDULE` variable controls when the crawler runs. Cron expressions
have 5 fields:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6, Sunday = 0)
│ │ │ │ │
* * * * *

```

| Frequency     | Cron Expression | Description                       |
| ------------- | --------------- | --------------------------------- |
| Every hour    | `0 * * * *`     | At minute 0 of every hour         |
| Every 2 hours | `0 */2 * * *`   | At 00:00, 02:00, 04:00...         |
| Every 30 mins | `*/30 * * * *`  | At minutes 0 and 30 of every hour |
| Every 6 hours | `0 */6 * * *`   | At 00:00, 06:00, 12:00, 18:00     |
| Daily at 3 AM | `0 3 * * *`     | Every day at 3:00 AM              |
| Weekly (Mon)  | `0 0 * * 1`     | Every Monday at midnight          |

**To modify:**

1. In Container Manager, select the container
2. Click **Action** > **Edit**
3. Go to **Environment** tab
4. Modify `CRON_SCHEDULE` value
5. Restart container for changes to take effect

## 7. Troubleshooting

### Container Fails to Start

Check **Logs** for error messages. Common issues:

-   **Missing config files**: Ensure `config.yaml` and `frequency_words.txt` are
    uploaded to NAS config directory
-   **Port conflict**: Check if ports 8080 and 3333 are in use
-   **Permission issues**: Verify directory permissions are correct

### Config File Check

Login to NAS terminal and run:

```bash
ls -la /volume1/docker/trendradar/config/
```

Expected output:

```text
config.yaml
frequency_words.txt
```

## 8. Directory Structure Summary

```bash
/volume1/docker/trendradar/
├── config/                  # Config files directory
│   ├── config.yaml
│   └── frequency_words.txt
├── output/                  # Data output directory
│   └── (various output files)
└── trendradar-nas.tar       # Image backup (optional to keep)
```
