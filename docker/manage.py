#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
뉴스 크롤러 컨테이너 관리 도구 - supercronic
"""

import os
import sys
import subprocess
import time
from pathlib import Path


def run_command(cmd, shell=True, capture_output=True):
    """시스템 명령 실행"""
    try:
        result = subprocess.run(
            cmd, shell=shell, capture_output=capture_output, text=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def manual_run():
    """크롤러 수동 실행"""
    print("🔄 크롤러 수동 실행 중...")
    try:
        result = subprocess.run(
            ["python", "main.py"], cwd="/app", capture_output=False, text=True
        )
        if result.returncode == 0:
            print("✅ 실행 완료")
        else:
            print(f"❌ 실행 실패, 종료 코드: {result.returncode}")
    except Exception as e:
        print(f"❌ 실행 오류: {e}")


def parse_cron_schedule(cron_expr):
    """cron 표현식 파싱 및 사람이 읽을 수 있는 설명 반환"""
    if not cron_expr or cron_expr == "설정 안 됨":
        return "설정 안 됨"

    try:
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            return f"원본 표현식: {cron_expr}"

        minute, hour, day, month, weekday = parts

        # 분 분석
        if minute == "*":
            minute_desc = "매분"
        elif minute.startswith("*/"):
            interval = minute[2:]
            minute_desc = f"{interval}분마다"
        elif "," in minute:
            minute_desc = f"{minute}분에"
        else:
            minute_desc = f"{minute}분에"

        # 시간 분석
        if hour == "*":
            hour_desc = "매시간"
        elif hour.startswith("*/"):
            interval = hour[2:]
            hour_desc = f"{interval}시간마다"
        elif "," in hour:
            hour_desc = f"{hour}시에"
        else:
            hour_desc = f"{hour}시에"

        # 일 분석
        if day == "*":
            day_desc = "매일"
        elif day.startswith("*/"):
            interval = day[2:]
            day_desc = f"{interval}일마다"
        else:
            day_desc = f"매월 {day}일"

        # 월 분석
        if month == "*":
            month_desc = "매월"
        else:
            month_desc = f"{month}월에"

        # 요일 분석
        weekday_names = {
            "0": "일요일", "1": "월요일", "2": "화요일", "3": "수요일",
            "4": "목요일", "5": "금요일", "6": "토요일", "7": "일요일"
        }
        if weekday == "*":
            weekday_desc = ""
        else:
            weekday_desc = f"{weekday_names.get(weekday, weekday)}에"

        # 설명 조합
        if minute.startswith("*/") and hour == "*" and day == "*" and month == "*" and weekday == "*":
            # 단순 간격 패턴, 예: */30 * * * *
            return f"{minute[2:]}분마다 실행"
        elif hour != "*" and minute != "*" and day == "*" and month == "*" and weekday == "*":
            # 매일 특정 시간, 예: 0 9 * * *
            return f"매일 {hour}:{minute.zfill(2)}에 실행"
        elif weekday != "*" and day == "*":
            # 매주 특정 시간
            return f"{weekday_desc} {hour}:{minute.zfill(2)}에 실행"
        else:
            # 복잡한 패턴, 상세 정보 표시
            desc_parts = [part for part in [month_desc, day_desc, weekday_desc, hour_desc, minute_desc] if part and part != "매월" and part != "매일" and part != "매시간"]
            if desc_parts:
                return " ".join(desc_parts) + " 실행"
            else:
                return f"복잡한 표현식: {cron_expr}"

    except Exception as e:
        return f"파싱 실패: {cron_expr}"


def show_status():
    """컨테이너 상태 표시"""
    print("📊 컨테이너 상태:")

    # PID 1 상태 확인
    supercronic_is_pid1 = False
    pid1_cmdline = ""
    try:
        with open('/proc/1/cmdline', 'r') as f:
            pid1_cmdline = f.read().replace('\x00', ' ').strip()
        print(f"  🔍 PID 1 프로세스: {pid1_cmdline}")

        if "supercronic" in pid1_cmdline.lower():
            print("  ✅ supercronic이 PID 1로 정상 실행 중")
            supercronic_is_pid1 = True
        else:
            print("  ❌ PID 1이 supercronic이 아닙니다")
            print(f"  📋 실제 PID 1: {pid1_cmdline}")
    except Exception as e:
        print(f"  ❌ PID 1 정보를 읽을 수 없습니다: {e}")

    # 환경 변수 확인
    cron_schedule = os.environ.get("CRON_SCHEDULE", "설정 안 됨")
    run_mode = os.environ.get("RUN_MODE", "설정 안 됨")
    immediate_run = os.environ.get("IMMEDIATE_RUN", "설정 안 됨")

    print(f"  ⚙️ 실행 설정:")
    print(f"    CRON_SCHEDULE: {cron_schedule}")

    # cron 표현식 파싱 및 표시
    cron_description = parse_cron_schedule(cron_schedule)
    print(f"    ⏰ 실행 빈도: {cron_description}")

    print(f"    RUN_MODE: {run_mode}")
    print(f"    IMMEDIATE_RUN: {immediate_run}")

    # 설정 파일 확인
    config_files = ["/app/config/config.yaml", "/app/config/frequency_words.txt"]
    print("  📁 설정 파일:")
    for file_path in config_files:
        if Path(file_path).exists():
            print(f"    ✅ {Path(file_path).name}")
        else:
            print(f"    ❌ {Path(file_path).name} 누락")

    # 주요 파일 확인
    key_files = [
        ("/usr/local/bin/supercronic-linux-amd64", "supercronic 바이너리"),
        ("/usr/local/bin/supercronic", "supercronic 심볼릭 링크"),
        ("/tmp/crontab", "crontab 파일"),
        ("/entrypoint.sh", "시작 스크립트")
    ]

    print("  📂 주요 파일 확인:")
    for file_path, description in key_files:
        if Path(file_path).exists():
            print(f"    ✅ {description}: 존재")
            # crontab 파일의 경우 내용 표시
            if file_path == "/tmp/crontab":
                try:
                    with open(file_path, 'r') as f:
                        crontab_content = f.read().strip()
                        print(f"         내용: {crontab_content}")
                except:
                    pass
        else:
            print(f"    ❌ {description}: 존재하지 않음")

    # 컨테이너 실행 시간 확인
    print("  ⏱️ 컨테이너 시간 정보:")
    try:
        # PID 1 시작 시간 확인
        with open('/proc/1/stat', 'r') as f:
            stat_content = f.read().strip().split()
            if len(stat_content) >= 22:
                # starttime은 22번째 필드 (인덱스 21)
                starttime_ticks = int(stat_content[21])

                # 시스템 부팅 시간 읽기
                with open('/proc/stat', 'r') as stat_f:
                    for line in stat_f:
                        if line.startswith('btime'):
                            boot_time = int(line.split()[1])
                            break
                    else:
                        boot_time = 0

                # 시스템 클록 주파수 읽기
                clock_ticks = os.sysconf(os.sysconf_names['SC_CLK_TCK'])

                if boot_time > 0:
                    pid1_start_time = boot_time + (starttime_ticks / clock_ticks)
                    current_time = time.time()
                    uptime_seconds = int(current_time - pid1_start_time)
                    uptime_minutes = uptime_seconds // 60
                    uptime_hours = uptime_minutes // 60

                    if uptime_hours > 0:
                        print(f"    PID 1 실행 시간: {uptime_hours}시간 {uptime_minutes % 60}분")
                    else:
                        print(f"    PID 1 실행 시간: {uptime_minutes}분 ({uptime_seconds}초)")
                else:
                    print(f"    PID 1 실행 시간: 정확히 계산할 수 없음")
            else:
                print("    ❌ PID 1 통계 정보를 파싱할 수 없음")
    except Exception as e:
        print(f"    ❌ 시간 확인 실패: {e}")

    # 상태 요약 및 제안
    print("  📊 상태 요약:")
    if supercronic_is_pid1:
        print("    ✅ supercronic이 PID 1로 정상 실행 중")
        print("    ✅ 정기 작업이 정상 작동해야 합니다")

        # 현재 스케줄 정보 표시
        if cron_schedule != "설정 안 됨":
            print(f"    ⏰ 현재 스케줄: {cron_description}")

            # 일반적인 스케줄 제안 제공
            if "분마다" in cron_description and "30분마다" not in cron_description and "60분마다" not in cron_description:
                print("    💡 빈번 실행 모드, 실시간 모니터링에 적합")
            elif "시간마다" in cron_description:
                print("    💡 시간별 실행 모드, 정기 집계에 적합")
            elif "매일" in cron_description:
                print("    💡 일일 실행 모드, 일일 보고서 생성에 적합")

        print("    💡 정기 작업이 실행되지 않으면 확인:")
        print("       • crontab 형식이 올바른지")
        print("       • 시간대 설정이 올바른지")
        print("       • 애플리케이션에 오류가 있는지")
    else:
        print("    ❌ supercronic 상태 이상")
        if pid1_cmdline:
            print(f"    📋 현재 PID 1: {pid1_cmdline}")
        print("    💡 권장 조치:")
        print("       • 컨테이너 재시작: docker restart trend-radar")
        print("       • 컨테이너 로그 확인: docker logs trend-radar")

    # 로그 확인 제안 표시
    print("  📋 실행 상태 확인:")
    print("    • 전체 컨테이너 로그 보기: docker logs trend-radar")
    print("    • 실시간 로그 보기: docker logs -f trend-radar")
    print("    • 수동 실행 테스트: python manage.py run")
    print("    • 컨테이너 서비스 재시작: docker restart trend-radar")


def show_config():
    """현재 설정 표시"""
    print("⚙️ 현재 설정:")

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
        value = os.environ.get(var, "설정 안 됨")
        # 민감 정보 숨김
        if any(sensitive in var for sensitive in ["WEBHOOK", "TOKEN", "KEY"]):
            if value and value != "설정 안 됨":
                masked_value = value[:10] + "***" if len(value) > 10 else "***"
                print(f"  {var}: {masked_value}")
            else:
                print(f"  {var}: {value}")
        else:
            print(f"  {var}: {value}")

    crontab_file = "/tmp/crontab"
    if Path(crontab_file).exists():
        print("  📅 Crontab 내용:")
        try:
            with open(crontab_file, "r") as f:
                content = f.read().strip()
                print(f"    {content}")
        except Exception as e:
            print(f"    읽기 실패: {e}")
    else:
        print("  📅 Crontab 파일이 존재하지 않음")


def show_files():
    """출력 파일 표시"""
    print("📁 출력 파일:")

    output_dir = Path("/app/output")
    if not output_dir.exists():
        print("  📭 출력 디렉터리가 존재하지 않음")
        return

    # 최근 파일 표시
    date_dirs = sorted([d for d in output_dir.iterdir() if d.is_dir()], reverse=True)

    if not date_dirs:
        print("  📭 출력 디렉터리가 비어있음")
        return

    # 최근 2일 파일 표시
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
                    print(f"    📂 {subdir}: {len(files)}개 파일")
                    for file in recent_files:
                        mtime = time.ctime(file.stat().st_mtime)
                        size_kb = file.stat().st_size // 1024
                        print(
                            f"      📄 {file.name} ({size_kb}KB, {mtime.split()[3][:5]})"
                        )
                else:
                    print(f"    📂 {subdir}: 비어있음")


def show_logs():
    """실시간 로그 표시"""
    print("📋 실시간 로그 (Ctrl+C로 종료):")
    print("💡 팁: PID 1 프로세스의 출력을 표시합니다")
    try:
        # 여러 방법으로 로그 보기 시도
        log_files = [
            "/proc/1/fd/1",  # PID 1 표준 출력
            "/proc/1/fd/2",  # PID 1 표준 오류
        ]

        for log_file in log_files:
            if Path(log_file).exists():
                print(f"📄 읽기 시도: {log_file}")
                subprocess.run(["tail", "-f", log_file], check=True)
                break
        else:
            print("📋 표준 로그 파일을 찾을 수 없음, 권장 명령: docker logs trend-radar")

    except KeyboardInterrupt:
        print("\n👋 로그 보기 종료")
    except Exception as e:
        print(f"❌ 로그 보기 실패: {e}")
        print("💡 권장 명령: docker logs trend-radar")


def restart_supercronic():
    """supercronic 프로세스 재시작"""
    print("🔄 supercronic 재시작 중...")
    print("⚠️ 주의: supercronic이 PID 1이므로 직접 재시작할 수 없습니다")

    # 현재 PID 1 확인
    try:
        with open('/proc/1/cmdline', 'r') as f:
            pid1_cmdline = f.read().replace('\x00', ' ').strip()
        print(f"  🔍 현재 PID 1: {pid1_cmdline}")

        if "supercronic" in pid1_cmdline.lower():
            print("  ✅ PID 1이 supercronic입니다")
            print("  💡 supercronic을 재시작하려면 전체 컨테이너를 재시작해야 합니다:")
            print("    docker restart trend-radar")
        else:
            print("  ❌ PID 1이 supercronic이 아닙니다, 비정상 상태입니다")
            print("  💡 문제를 해결하려면 컨테이너를 재시작하세요:")
            print("    docker restart trend-radar")
    except Exception as e:
        print(f"  ❌ PID 1을 확인할 수 없습니다: {e}")
        print("  💡 컨테이너 재시작 권장: docker restart trend-radar")


def show_help():
    """도움말 정보 표시"""
    help_text = """
🐳 TrendRadar 컨테이너 관리 도구

📋 명령어 목록:
  run         - 크롤러 수동 실행
  status      - 컨테이너 실행 상태 표시
  config      - 현재 설정 표시
  files       - 출력 파일 표시
  logs        - 실시간 로그 보기
  restart     - 재시작 안내
  help        - 이 도움말 표시

📖 사용 예제:
  # 컨테이너 내부에서 실행
  python manage.py run
  python manage.py status
  python manage.py logs

  # 호스트에서 실행
  docker exec -it trend-radar python manage.py run
  docker exec -it trend-radar python manage.py status
  docker logs trend-radar

💡 일반 작업 가이드:
  1. 실행 상태 확인: status
     - supercronic이 PID 1인지 확인
     - 설정 파일 및 주요 파일 확인
     - cron 스케줄 설정 확인

  2. 수동 실행 테스트: run
     - 뉴스 크롤링 즉시 한 번 실행
     - 프로그램이 정상 작동하는지 테스트

  3. 로그 보기: logs
     - 실행 상황 실시간 모니터링
     - 다음 명령도 사용 가능: docker logs trend-radar

  4. 서비스 재시작: restart
     - supercronic이 PID 1이므로 전체 컨테이너를 재시작해야 함
     - 사용: docker restart trend-radar
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
        "help": show_help,
    }

    if command in commands:
        try:
            commands[command]()
        except KeyboardInterrupt:
            print("\n👋 작업이 취소되었습니다")
        except Exception as e:
            print(f"❌ 실행 오류: {e}")
    else:
        print(f"❌ 알 수 없는 명령: {command}")
        print("'python manage.py help'를 실행하여 사용 가능한 명령을 확인하세요")


if __name__ == "__main__":
    main()