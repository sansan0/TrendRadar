#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新闻爬虫容器管理工具 - supercronic
(Modified with Translation Features)
"""

import os
import sys
import subprocess
import time
from pathlib import Path
import importlib.util

# ==========================================
# [New Feature] Title Translation Utilities
# ==========================================

def ensure_translator_library():
    """Check and install deep-translator library if missing"""
    if importlib.util.find_spec("deep_translator") is None:
        print("📦 Installing translation library (deep-translator)...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "deep-translator"], check=True)
            print("✅ Library installed successfully.")
        except Exception as e:
            print(f"❌ Failed to install library: {e}")
            return False
    return True

def translate_text(text, target='en'):
    """
    Translate text to English
    NOTE: This function uses Google Translate API via deep-translator.
    """
    try:
        from deep_translator import GoogleTranslator
        # Split text to handle potential length limits or formatting, though deep-translator handles chunks well.
        # Translating from auto-detected language to English
        translator = GoogleTranslator(source='auto', target=target)
        return translator.translate(text)
    except Exception as e:
        return f"[Translation Error] {text}"

def translate_latest_report():
    """
    Find the latest output file and translate it to English.
    """
    print("🔄 Starting translation of the latest report...")

    if not ensure_translator_library():
        return

    output_dir = Path("/app/output")
    if not output_dir.exists():
        print("❌ Output directory not found (/app/output)")
        return

    # Find latest date directory
    date_dirs = sorted([d for d in output_dir.iterdir() if d.is_dir()], key=lambda x: x.stat().st_mtime, reverse=True)
    if not date_dirs:
        print("❌ No data found in output directory")
        return

    latest_dir = date_dirs[0]
    txt_dir = latest_dir / "txt"

    if not txt_dir.exists():
        print(f"❌ No txt directory in {latest_dir}")
        return

    # Find all txt files
    txt_files = list(txt_dir.glob("*.txt"))
    if not txt_files:
        print("❌ No text files found to translate")
        return

    print(f"📂 Processing files in: {latest_dir.name}")

    for file_path in txt_files:
        if "_en" in file_path.name:
            continue # Skip already translated files

        print(f"  📄 Translating {file_path.name}...")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            translated_lines = []
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source='auto', target='en')

            # Batch translation strategy is better, but doing line-by-line for safety with simple formats
            for line in lines:
                line = line.strip()
                if not line:
                    translated_lines.append("\n")
                    continue

                # Simple heuristic: if line is just separator or symbols, skip
                if all(c in "=-*# \t" for c in line):
                    translated_lines.append(line + "\n")
                    continue

                try:
                    # Translate content
                    trans = translator.translate(line)
                    translated_lines.append(f"{trans}\n")
                    # Sleep briefly to avoid rate limiting
                    time.sleep(0.2)
                except:
                    translated_lines.append(line + "\n")

            # Save as new file
            new_filename = file_path.stem + "_en.txt"
            new_path = file_path.parent / new_filename

            with open(new_path, 'w', encoding='utf-8') as f:
                f.writelines(translated_lines)

            print(f"  ✅ Saved English version: {new_filename}")

        except Exception as e:
            print(f"  ❌ Error translating {file_path.name}: {e}")

# ==========================================
# End of Translation Utilities
# ==========================================

def run_command(cmd, shell=True, capture_output=True):
    """执行系统命令"""
    try:
        result = subprocess.run(
            cmd, shell=shell, capture_output=capture_output, text=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def manual_run():
    """手动执行一次爬虫"""
    print("🔄 手动执行爬虫...")
    try:
        result = subprocess.run(
            ["python", "main.py"], cwd="/app", capture_output=False, text=True
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
        with open('/proc/1/cmdline', 'r') as f:
            pid1_cmdline = f.read().replace('\x00', ' ').strip()
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
                except:
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
        print("        • crontab 格式是否正确")
        print("        • 时区设置是否正确")
        print("        • 应用程序是否有错误")
    else:
        print("    ❌ supercronic 状态异常")
        if pid1_cmdline:
            print(f"    📋 当前 PID 1: {pid1_cmdline}")
        print("    💡 建议操作:")
        print("        • 重启容器: docker restart trend-radar")
        print("        • 检查容器日志: docker logs trend-radar")

    # 显示日志检查建议
    print("  📋 运行状态检查:")
    print("    • 查看完整容器日志: docker logs trend-radar")
    print("    • 查看实时日志: docker logs -f trend-radar")
    print("    • 手动执行测试: python manage.py run")
    print("    • 重启容器服务: docker restart trend-radar")


def show_config():
    """显示当前配置"""
    print("⚙️ 当前配置:")

    env_vars = [
        "CRON_SCHEDULE",
        "RUN_MODE",
        "IMMEDIATE_RUN",
        "FEISHU_WEBHOOK_URL",
        "DINGTALK_WEBHOOK_URL",
        "WEWORK_WEBHOOK_URL",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "CONFIG_PATH",
        "FREQUENCY_WORDS_PATH",
    ]

    for var in env_vars:
        value = os.environ.get(var, "未设置")
        # 隐藏敏感信息
        if any(sensitive in var for sensitive in ["WEBHOOK", "TOKEN", "KEY"]):
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

    # 显示最近的文件
    date_dirs = sorted([d for d in output_dir.iterdir() if d.is_dir()], reverse=True)

    if not date_dirs:
        print("  📭 输出目录为空")
        return

    # 显示最近2天的文件
    for date_dir in date_dirs[:2]:
        print(f"  📅 {date_dir.name}:")
        for subdir in ["html", "txt"]:
            sub_path = date_dir / subdir
            if sub_path.exists():
                files = list(sub_path.glob("*"))
                if files:
                    recent_files = sorted(
                        files, key=lambda x: x.stat().st_mtime, reverse=True
                    )[:3]
                    print(f"    📂 {subdir}: {len(files)} 个文件")
                    for file in recent_files:
                        mtime = time.ctime(file.stat().st_mtime)
                        size_kb = file.stat().st_size // 1024
                        print(
                            f"      📄 {file.name} ({size_kb}KB, {mtime.split()[3][:5]})"
                        )
                else:
                    print(f"    📂 {subdir}: 空")


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
            print("📋 无法找到标准日志文件，建议使用: docker logs trend-radar")

    except KeyboardInterrupt:
        print("\n👋 退出日志查看")
    except Exception as e:
        print(f"❌ 查看日志失败: {e}")
        print("💡 建议使用: docker logs trend-radar")


def restart_supercronic():
    """重启supercronic进程"""
    print("🔄 重启supercronic...")
    print("⚠️ 注意: supercronic 是 PID 1，无法直接重启")

    # 检查当前 PID 1
    try:
        with open('/proc/1/cmdline', 'r') as f:
            pid1_cmdline = f.read().replace('\x00', ' ').strip()
        print(f"  🔍 当前 PID 1: {pid1_cmdline}")

        if "supercronic" in pid1_cmdline.lower():
            print("  ✅ PID 1 是 supercronic")
            print("  💡 要重启 supercronic，需要重启整个容器:")
            print("    docker restart trend-radar")
        else:
            print("  ❌ PID 1 不是 supercronic，这是异常状态")
            print("  💡 建议重启容器以修复问题:")
            print("    docker restart trend-radar")
    except Exception as e:
        print(f"  ❌ 无法检查 PID 1: {e}")
        print("  💡 建议重启容器: docker restart trend-radar")


def show_help():
    """显示帮助信息"""
    help_text = """
🐳 TrendRadar 容器管理工具

📋 命令列表:
