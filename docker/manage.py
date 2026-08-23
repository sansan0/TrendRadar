#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新闻爬虫容器管理工具 - supercronic
"""

import os
import sys
import subprocess
import time
import signal
from pathlib import Path

# Web 服务器配置
_raw_port = int(os.environ.get("WEBSERVER_PORT", "8080"))
WEBSERVER_PORT = _raw_port if 1 <= _raw_port <= 65535 else 8080
WEBSERVER_DIR = "/app/output"
WEBSERVER_PID_FILE = "/tmp/webserver.pid"


def manual_run():
    """手动执行一次爬虫"""
    print("🔄 手动执行爬虫...")
    try:
        result = subprocess.run(
            ["python", "-m", "trendradar"], cwd="/app", capture_output=False, text=True
        )
        if result.returncode == 0:
            print("✅ 执行完成")
        else:
            print(f"❌ 执行失败，退出码: {result.returncode}")
    except Exception as e:
        print(f"❌ 执行出错: {e}")


def parse_cron_schedule(cron_expr):
    """解析cron表达式并返回人类可读的描述"""
    if not cron_expr or cron_expr == "未设置":
        return "未设置"
    
    try:
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            return f"原始表达式: {cron_expr}"
        
        minute, hour, day, month, weekday = parts
        
        # 分析分钟
        if minute == "*":
            minute_desc = "每分钟"
        elif minute.startswith("*/"):
            interval = minute[2:]
            minute_desc = f"每{interval}分钟"
        elif "," in minute:
            minute_desc = f"在第{minute}分钟"
        else:
            minute_desc = f"在第{minute}分钟"
        
        # 分析小时
        if hour == "*":
            hour_desc = "每小时"
        elif hour.startswith("*/"):
            interval = hour[2:]
            hour_desc = f"每{interval}小时"
        elif "," in hour:
            hour_desc = f"在{hour}点"
        else:
            hour_desc = f"在{hour}点"
        
        # 分析日期
        if day == "*":
            day_desc = "每天"
        elif day.startswith("*/"):
            interval = day[2:]
            day_desc = f"每{interval}天"
        else:
            day_desc = f"每月{day}号"
        
        # 分析月份
        if month == "*":
            month_desc = "每月"
        else:
            month_desc = f"在{month}月"
        
        # 分析星期
        weekday_names = {
            "0": "周日", "1": "周一", "2": "周二", "3": "周三", 
            "4": "周四", "5": "周五", "6": "周六", "7": "周日"
        }
        if weekday == "*":
            weekday_desc = ""
        else:
            weekday_desc = f"在{weekday_names.get(weekday, weekday)}"
        
        # 组合描述
        if minute.startswith("*/") and hour == "*" and day == "*" and month == "*" and weekday == "*":
            # 简单的间隔模式，如 */30 * * * *
            return f"每{minute[2:]}分钟执行一次"
        elif hour != "*" and minute != "*" and day == "*" and month == "*" and weekday == "*":
            # 每天特定时间，如 0 9 * * *
            return f"每天{hour}:{minute.zfill(2)}执行"
        elif weekday != "*" and day == "*":
            # 每周特定时间
            return f"{weekday_desc}{hour}:{minute.zfill(2)}执行"
        else:
            # 复杂模式，显示详细信息
            desc_parts = [part for part in [month_desc, day_desc, weekday_desc, hour_desc, minute_desc] if part and part != "每月" and part != "每天" and part != "每小时"]
            if desc_parts:
                return " ".join(desc_parts) + "执行"
            else:
                return f"复杂表达式: {cron_expr}"
    
    except Exception as e:
        return f"解析失败: {cron_expr}"


def show_status():
    """显示容器状态"""
    print("📊 容器状态:")

    # 检查 PID 1 状态
    supercronic_is_pid1 = False
    pid1_cmdline = ""
    try:
        with open('/proc/1/cmdline', 'rb') as f:
            pid1_cmdline = f.read().replace(b'\x00', b' ').decode('utf-8', errors='ignore').strip()
        print(f"  🔍 PID 1 进程: {pid1_cmdline}")

        if "supercronic" in pid1_cmdline.lower():
            print("  ✅ supercronic 正确运行为 PID 1")
            supercronic_is_pid1 = True
        else:
            print("  ❌ PID 1 不是 supercronic")
            print(f"  📋 实际的 PID 1: {pid1_cmdline}")
    except Exception as e:
        print(f"  ❌ 无法读取 PID 1 信息: {e}")

    # 检查环境变量
    cron_schedule = os.environ.get("CRON_SCHEDULE", "未设置")
    run_mode = os.environ.get("RUN_MODE", "未设置")
    immediate_run = os.environ.get("IMMEDIATE_RUN", "未设置")
    
    print(f"  ⚙️ 运行配置:")
    print(f"    CRON_SCHEDULE: {cron_schedule}")
    
    # 解析并显示cron表达式的含义
    cron_description = parse_cron_schedule(cron_schedule)
    print(f"    ⏰ 执行频率: {cron_description}")
    
    print(f"    RUN_MODE: {run_mode}")
    print(f"    IMMEDIATE_RUN: {immediate_run}")

    # 检查配置文件
    config_files = ["/app/config/config.yaml", "/app/config/frequency_words.txt"]
    print("  📁 配置文件:")
    for file_path in config_files:
        if Path(file_path).exists():
            print(f"    ✅ {Path(file_path).name}")
        else:
            print(f"    ❌ {Path(file_path).name} 缺失")

    # 检查关键文件
    key_files = [
        ("/usr/local/bin/supercronic-linux-amd64", "supercronic二进制文件"),
        ("/usr/local/bin/supercronic", "supercronic软链接"),
        ("/tmp/crontab", "crontab文件"),
        ("/entrypoint.sh", "启动脚本")
    ]
    
    print("  📂 关键文件检查:")
    for file_path, description in key_files:
        if Path(file_path).exists():
            print(f"    ✅ {description}: 存在")
            # 对于crontab文件，显示内容
            if file_path == "/tmp/crontab":
                try:
                    with open(file_path, 'r') as f:
                        crontab_content = f.read().strip()
                        print(f"         内容: {crontab_content}")
                except Exception:
                    pass
        else:
            print(f"    ❌ {description}: 不存在")

    # 检查容器运行时间
    print("  ⏱️ 容器时间信息:")
    try:
        # 检查 PID 1 的启动时间
        with open('/proc/1/stat', 'r') as f:
            stat_content = f.read().strip().split()
            if len(stat_content) >= 22:
                # starttime 是第22个字段（索引21）
                starttime_ticks = int(stat_content[21])
                
                # 读取系统启动时间
                with open('/proc/stat', 'r') as stat_f:
                    for line in stat_f:
                        if line.startswith('btime'):
                            boot_time = int(line.split()[1])
                            break
                    else:
                        boot_time = 0
                
                # 读取系统时钟频率
                clock_ticks = os.sysconf(os.sysconf_names['SC_CLK_TCK'])
                
                if boot_time > 0:
                    pid1_start_time = boot_time + (starttime_ticks / clock_ticks)
                    current_time = time.time()
                    uptime_seconds = int(current_time - pid1_start_time)
                    uptime_minutes = uptime_seconds // 60
                    uptime_hours = uptime_minutes // 60
                    
                    if uptime_hours > 0:
                        print(f"    PID 1 运行时间: {uptime_hours} 小时 {uptime_minutes % 60} 分钟")
                    else:
                        print(f"    PID 1 运行时间: {uptime_minutes} 分钟 ({uptime_seconds} 秒)")
                else:
                    print(f"    PID 1 运行时间: 无法精确计算")
            else:
                print("    ❌ 无法解析 PID 1 统计信息")
    except Exception as e:
        print(f"    ❌ 时间检查失败: {e}")

    # 状态总结和建议
    print("  📊 状态总结:")
    if supercronic_is_pid1:
        print("    ✅ supercronic 正确运行为 PID 1")
        print("    ✅ 定时任务应该正常工作")
        
        # 显示当前的调度信息
        if cron_schedule != "未设置":
            print(f"    ⏰ 当前调度: {cron_description}")
            
            # 提供一些常见的调度建议
            if "分钟" in cron_description and "每30分钟" not in cron_description and "每60分钟" not in cron_description:
                print("    💡 频繁执行模式，适合实时监控")
            elif "小时" in cron_description:
                print("    💡 按小时执行模式，适合定期汇总")
            elif "天" in cron_description:
                print("    💡 每日执行模式，适合日报生成")
        
        print("    💡 如果定时任务不执行，检查:")
        print("       • crontab 格式是否正确")
        print("       • 时区设置是否正确")
        print("       • 应用程序是否有错误")
    else:
        print("    ❌ supercronic 状态异常")
        if pid1_cmdline:
            print(f"    📋 当前 PID 1: {pid1_cmdline}")
        print("    💡 建议操作:")
        print("       • 重启容器: docker restart trendradar")
        print("       • 检查容器日志: docker logs trendradar")

    # 显示日志检查建议
    print("  📋 运行状态检查:")
    print("    • 查看完整容器日志: docker logs trendradar")
    print("    • 查看实时日志: docker logs -f trendradar")
    print("    • 手动执行测试: python manage.py run")
    print("    • 重启容器服务: docker restart trendradar")


def show_config():
    """显示当前配置"""
    print("⚙️ 当前配置:")

    env_vars = [
        # 运行配置
        "CRON_SCHEDULE",
        "RUN_MODE",
        "IMMEDIATE_RUN",
        # 通知渠道
        "FEISHU_WEBHOOK_URL",
        "DINGTALK_WEBHOOK_URL",
        "WEWORK_WEBHOOK_URL",
        "WEWORK_MSG_TYPE",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "NTFY_SERVER_URL",
        "NTFY_TOPIC",
        "NTFY_TOKEN",
        "BARK_URL",
        "SLACK_WEBHOOK_URL",
        # AI 分析配置
        "AI_ANALYSIS_ENABLED",
        "AI_API_KEY",
        "AI_PROVIDER",
        "AI_MODEL",
        "AI_BASE_URL",
        # 远程存储配置
        "S3_BUCKET_NAME",
        "S3_ACCESS_KEY_ID",
        "S3_ENDPOINT_URL",
        "S3_REGION",
    ]

    for var in env_vars:
        value = os.environ.get(var, "未设置")
        # 隐藏敏感信息
        if var == "BARK_URL" or any(sensitive in var for sensitive in ["WEBHOOK", "TOKEN", "KEY", "SECRET"]):
            if value and value != "未设置":
                masked_value = value[:10] + "***" if len(value) > 10 else "***"
                print(f"  {var}: {masked_value}")
            else:
                print(f"  {var}: {value}")
        else:
            print(f"  {var}: {value}")

    crontab_file = "/tmp/crontab"
    if Path(crontab_file).exists():
        print("  📅 Crontab内容:")
        try:
            with open(crontab_file, "r") as f:
                content = f.read().strip()
                print(f"    {content}")
        except Exception as e:
            print(f"    读取失败: {e}")
    else:
        print("  📅 Crontab文件不存在")


def show_files():
    """显示输出文件"""
    print("📁 输出文件:")

    output_dir = Path("/app/output")
    if not output_dir.exists():
        print("  📭 输出目录不存在")
        return

    # 新结构：扁平化目录
    # - output/news/*.db
    # - output/rss/*.db
    # - output/txt/{date}/*.txt
    # - output/html/{date}/*.html

    # 检查 news 数据库
    news_dir = output_dir / "news"
    if news_dir.exists():
        db_files = sorted(news_dir.glob("*.db"), key=lambda x: x.name, reverse=True)
        if db_files:
            print(f"  💾 热榜数据库 (news/): {len(db_files)} 个")
            for db_file in db_files[:5]:
                mtime = time.ctime(db_file.stat().st_mtime)
                size_kb = db_file.stat().st_size // 1024
                print(f"    📀 {db_file.name} ({size_kb}KB, {mtime.split()[3][:5]})")
            if len(db_files) > 5:
                print(f"    ... 还有 {len(db_files) - 5} 个")

    # 检查 RSS 数据库
    rss_dir = output_dir / "rss"
    if rss_dir.exists():
        db_files = sorted(rss_dir.glob("*.db"), key=lambda x: x.name, reverse=True)
        if db_files:
            print(f"  📰 RSS 数据库 (rss/): {len(db_files)} 个")
            for db_file in db_files[:5]:
                mtime = time.ctime(db_file.stat().st_mtime)
                size_kb = db_file.stat().st_size // 1024
                print(f"    📀 {db_file.name} ({size_kb}KB, {mtime.split()[3][:5]})")
            if len(db_files) > 5:
                print(f"    ... 还有 {len(db_files) - 5} 个")

    # 检查 TXT 快照目录
    txt_dir = output_dir / "txt"
    if txt_dir.exists():
        date_dirs = sorted([d for d in txt_dir.iterdir() if d.is_dir()], reverse=True)
        if date_dirs:
            print(f"  📄 TXT 快照 (txt/): {len(date_dirs)} 天")
            for date_dir in date_dirs[:3]:
                txt_files = list(date_dir.glob("*.txt"))
                if txt_files:
                    recent = sorted(txt_files, key=lambda x: x.stat().st_mtime, reverse=True)[0]
                    mtime = time.ctime(recent.stat().st_mtime)
                    print(f"    📅 {date_dir.name}: {len(txt_files)} 个文件 (最新: {mtime.split()[3][:5]})")

    # 检查 HTML 报告目录
    html_dir = output_dir / "html"
    if html_dir.exists():
        date_dirs = sorted([d for d in html_dir.iterdir() if d.is_dir()], reverse=True)
        if date_dirs:
            print(f"  🌐 HTML 报告 (html/): {len(date_dirs)} 天")
            for date_dir in date_dirs[:3]:
                html_files = list(date_dir.glob("*.html"))
                if html_files:
                    recent = sorted(html_files, key=lambda x: x.stat().st_mtime, reverse=True)[0]
                    mtime = time.ctime(recent.stat().st_mtime)
                    print(f"    📅 {date_dir.name}: {len(html_files)} 个文件 (最新: {mtime.split()[3][:5]})")


def show_logs():
    """显示实时日志"""
    print("📋 实时日志 (按 Ctrl+C 退出):")
    print("💡 提示: 这将显示 PID 1 进程的输出")
    try:
        # 尝试多种方法查看日志
        log_files = [
            "/proc/1/fd/1",  # PID 1 的标准输出
            "/proc/1/fd/2",  # PID 1 的标准错误
        ]
        
        for log_file in log_files:
            if Path(log_file).exists():
                print(f"📄 尝试读取: {log_file}")
                subprocess.run(["tail", "-f", log_file], check=True)
                break
        else:
            print("📋 无法找到标准日志文件，建议使用: docker logs trendradar")
            
    except KeyboardInterrupt:
        print("\n👋 退出日志查看")
    except Exception as e:
        print(f"❌ 查看日志失败: {e}")
        print("💡 建议使用: docker logs trendradar")


def restart_supercronic():
    """重启supercronic进程"""
    print("🔄 重启supercronic...")
    print("⚠️ 注意: supercronic 是 PID 1，无法直接重启")

    # 检查当前 PID 1
    try:
        with open('/proc/1/cmdline', 'rb') as f:
            pid1_cmdline = f.read().replace(b'\x00', b' ').decode('utf-8', errors='ignore').strip()
        print(f"  🔍 当前 PID 1: {pid1_cmdline}")

        if "supercronic" in pid1_cmdline.lower():
            print("  ✅ PID 1 是 supercronic")
            print("  💡 要重启 supercronic，需要重启整个容器:")
            print("    docker restart trendradar")
        else:
            print("  ❌ PID 1 不是 supercronic，这是异常状态")
            print("  💡 建议重启容器以修复问题:")
            print("    docker restart trendradar")
    except Exception as e:
        print(f"  ❌ 无法检查 PID 1: {e}")
        print("  💡 建议重启容器: docker restart trendradar")


def _read_proc_cmdline(pid: int) -> str:
    """读取进程 cmdline，失败时返回空字符串。"""
    proc_cmdline = Path(f"/proc/{pid}/cmdline")
    if not proc_cmdline.exists():
        return ""
    try:
        with open(proc_cmdline, "rb") as f:
            return f.read().replace(b"\x00", b" ").decode("utf-8", errors="ignore").strip()
    except Exception:
        return ""


def _is_expected_webserver_process(pid: int) -> bool:
    """检查 pid 是否是当前端口的 http.server 进程。"""
    cmdline = _read_proc_cmdline(pid)
    if not cmdline:
        return False
    return (
        str(WEBSERVER_PORT) in cmdline
        and ("http.server" in cmdline or "trendradar.web_control" in cmdline)
    )


def _terminate_webserver_process(pid: int, require_expected: bool = True) -> bool:
    """尝试终止 Web 服务器进程。

    require_expected=True 时，仅终止确认是 http.server 的进程，避免误杀。
    """
    try:
        os.kill(pid, 0)
    except OSError:
        return True

    if require_expected and not _is_expected_webserver_process(pid):
        print(f"  ⚠️ PID {pid} 存在但并非 Web 服务器进程，跳过终止")
        return False

    try:
        os.kill(pid, signal.SIGTERM)
        time.sleep(0.5)
        try:
            os.kill(pid, 0)
            os.kill(pid, signal.SIGKILL)
            print(f"  ⚠️ 强制停止 Web 服务器 (PID: {pid})")
        except OSError:
            print(f"  ✅ Web 服务器已停止 (PID: {pid})")
        return True
    except OSError:
        return True


def _is_webserver_running(pid: int) -> bool:
    """检查 Web 服务器进程是否真正在运行。"""
    try:
        os.kill(pid, 0)
    except OSError:
        return False

    if not _is_expected_webserver_process(pid):
        return False

    try:
        import urllib.request
        class _NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)
        opener = urllib.request.build_opener(_NoRedirect)
        req = urllib.request.Request(f"http://127.0.0.1:{WEBSERVER_PORT}/", method="HEAD")
        opener.open(req, timeout=3)
        return True
    except Exception:
        try:
            time.sleep(1)
            opener.open(req, timeout=3)
            return True
        except Exception:
            return False


def _cleanup_stale_pid():
    """清理失效的 PID 文件"""
    if not Path(WEBSERVER_PID_FILE).exists():
        return False

    try:
        with open(WEBSERVER_PID_FILE, 'r') as f:
            old_pid = int(f.read().strip())
        os.remove(WEBSERVER_PID_FILE)
        print(f"  🧹 清理失效 PID 文件 (PID: {old_pid})")
        return True
    except Exception:
        return False


def start_webserver():
    """启动 Web 服务器托管 output 目录"""
    print(f"🌐 启动 Web 服务器 (端口: {WEBSERVER_PORT})...")
    print(f"  🔒 报告目录: {WEBSERVER_DIR}；控制面板可手动抓取 / 分析")

    # 检查是否已经运行
    if Path(WEBSERVER_PID_FILE).exists():
        try:
            with open(WEBSERVER_PID_FILE, 'r') as f:
                old_pid = int(f.read().strip())

            # 使用增强的进程检查
            if _is_webserver_running(old_pid):
                print(f"  ⚠️ Web 服务器已在运行 (PID: {old_pid})")
                print(f"  💡 访问: http://localhost:{WEBSERVER_PORT}")
                print("  💡 停止服务: python manage.py stop_webserver")
                return

            # 进程异常时优先尝试终止旧进程，避免端口占用导致重启失败
            _terminate_webserver_process(old_pid, require_expected=True)
            _cleanup_stale_pid()
            print(f"  ℹ️ 检测到失效的 PID 文件，已清理")

        except Exception as e:
            print(f"  ⚠️ 清理旧的 PID 文件: {e}")
            _cleanup_stale_pid()

    # 检查目录是否存在
    if not Path(WEBSERVER_DIR).exists():
        print(f"  ❌ 目录不存在: {WEBSERVER_DIR}")
        return

    try:
        # 启动 HTTP 服务器
        # 使用 --bind 绑定到 0.0.0.0 使容器内部可访问
        # 工作目录限制在 WEBSERVER_DIR，防止访问其他目录
        here = Path(__file__).resolve().parent
        project_root = str(here if (here / "trendradar").is_dir() else here.parent)
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "trendradar.web_control",
                str(WEBSERVER_PORT),
                WEBSERVER_DIR,
                project_root,
            ],
            cwd=project_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

        # 等待一下确保服务器启动
        time.sleep(1)

        # 检查进程是否还在运行
        if process.poll() is None:
            # 保存 PID
            with open(WEBSERVER_PID_FILE, 'w') as f:
                f.write(str(process.pid))
            print(f"  ✅ Web 服务器已启动 (PID: {process.pid})")
            print(f"  📁 服务目录: {WEBSERVER_DIR}")
            print(f"  🎛️ 控制面板: 报告页顶部可手动抓取 / AI 分析 / 切换预设")
            print(f"  🌐 访问地址: http://localhost:{WEBSERVER_PORT}")
            print(f"  📄 首页: http://localhost:{WEBSERVER_PORT}/index.html")
            print("  💡 停止服务: python manage.py stop_webserver")
        else:
            print(f"  ❌ Web 服务器启动失败")
    except Exception as e:
        print(f"  ❌ 启动失败: {e}")


def stop_webserver():
    """停止 Web 服务器"""
    print("🛑 停止 Web 服务器...")

    if not Path(WEBSERVER_PID_FILE).exists():
        print("  ℹ️ Web 服务器未运行")
        return

    try:
        with open(WEBSERVER_PID_FILE, 'r') as f:
            pid = int(f.read().strip())
        _terminate_webserver_process(pid, require_expected=True)
        if Path(WEBSERVER_PID_FILE).exists():
            os.remove(WEBSERVER_PID_FILE)
    except Exception as e:
        print(f"  ❌ 停止失败: {e}")
        # 尝试清理 PID 文件
        try:
            os.remove(WEBSERVER_PID_FILE)
        except Exception:
            pass


def webserver_status():
    """查看 Web 服务器状态"""
    print("🌐 Web 服务器状态:")

    if not Path(WEBSERVER_PID_FILE).exists():
        print("  ⭕ 未运行")
        print(f"  💡 启动服务: python manage.py start_webserver")
        return

    try:
        with open(WEBSERVER_PID_FILE, 'r') as f:
            pid = int(f.read().strip())

        # 使用增强的进程检查
        if _is_webserver_running(pid):
            print(f"  ✅ 运行中 (PID: {pid})")
            print(f"  📁 服务目录: {WEBSERVER_DIR}")
            print(f"  🌐 访问地址: http://localhost:{WEBSERVER_PORT}")
            print(f"  📄 首页: http://localhost:{WEBSERVER_PORT}/index.html")
            print("  💡 停止服务: python manage.py stop_webserver")
        else:
            print(f"  ⭕ 未运行 (PID 文件存在但进程不可用)")
            _cleanup_stale_pid()
            print("  💡 启动服务: python manage.py start_webserver")
    except Exception as e:
        print(f"  ❌ 状态检查失败: {e}")


def show_help():
    """显示帮助信息"""
    help_text = """
🐳 TrendRadar 容器管理工具

📋 命令列表:
  run              - 手动执行一次爬虫
  status           - 显示容器运行状态
  config           - 显示当前配置
  files            - 显示输出文件
  logs             - 实时查看日志
  restart          - 重启说明
  start_webserver  - 启动 Web 服务器托管 output 目录
  stop_webserver   - 停止 Web 服务器
  webserver_status - 查看 Web 服务器状态
  help             - 显示此帮助

📖 使用示例:
  # 在容器中执行
  python manage.py run
  python manage.py status
  python manage.py logs
  python manage.py start_webserver

  # 在宿主机执行
  docker exec -it trendradar python manage.py run
  docker exec -it trendradar python manage.py status
  docker exec -it trendradar python manage.py start_webserver
  docker logs trendradar

💡 常用操作指南:
  1. 检查运行状态: status
     - 查看 supercronic 是否为 PID 1
     - 检查配置文件和关键文件
     - 查看 cron 调度设置

  2. 手动执行测试: run
     - 立即执行一次新闻爬取
     - 测试程序是否正常工作

  3. 查看日志: logs
     - 实时监控运行情况
     - 也可使用: docker logs trendradar

  4. 重启服务: restart
     - 由于 supercronic 是 PID 1，需要重启整个容器
     - 使用: docker restart trendradar

  5. Web 服务器管理:
     - 启动: start_webserver
     - 停止: stop_webserver
     - 状态: webserver_status
     - 访问: http://localhost:8080
"""
    print(help_text)


def main():
    if len(sys.argv) < 2:
        show_help()
        return

    command = sys.argv[1]
    commands = {
        "run": manual_run,
        "status": show_status,
        "config": show_config,
        "files": show_files,
        "logs": show_logs,
        "restart": restart_supercronic,
        "start_webserver": start_webserver,
        "stop_webserver": stop_webserver,
        "webserver_status": webserver_status,
        "help": show_help,
    }

    if command in commands:
        try:
            commands[command]()
        except KeyboardInterrupt:
            print("\n👋 操作已取消")
        except Exception as e:
            print(f"❌ 执行出错: {e}")
    else:
        print(f"❌ 未知命令: {command}")
        print("运行 'python manage.py help' 查看可用命令")


if __name__ == "__main__":
    main()
