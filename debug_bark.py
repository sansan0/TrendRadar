#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bark 推送问题诊断脚本
用于排查 GitHub Actions 中 Bark 推送不工作的问题
"""

import os
import sys

def check_environment_variables():
    """检查环境变量配置"""
    print("=" * 60)
    print("1. 检查环境变量配置")
    print("=" * 60)
    
    bark_vars = {
        "BARK_DEVICE_KEY": os.environ.get("BARK_DEVICE_KEY", ""),
        "BARK_SERVER_URL": os.environ.get("BARK_SERVER_URL", ""),
        "BARK_GROUP": os.environ.get("BARK_GROUP", ""),
        "BARK_SOUND": os.environ.get("BARK_SOUND", ""),
        "BARK_ICON": os.environ.get("BARK_ICON", ""),
    }
    
    found = False
    for key, value in bark_vars.items():
        if value:
            # 隐藏敏感信息
            if key == "BARK_DEVICE_KEY":
                display_value = value[:10] + "..." if len(value) > 10 else value
            else:
                display_value = value
            print(f"✅ {key}: {display_value}")
            found = True
        else:
            print(f"❌ {key}: 未设置")
    
    if not found:
        print("\n⚠️ 警告：没有找到任何 Bark 环境变量！")
        print("   请检查 GitHub Secrets 配置：")
        print("   - 进入仓库 Settings > Secrets and variables > Actions")
        print("   - 确保已添加 BARK_DEVICE_KEY")
        return False
    
    # 检查必需的变量
    if not bark_vars["BARK_DEVICE_KEY"]:
        print("\n❌ 错误：BARK_DEVICE_KEY 未设置（必需）")
        return False
    
    print("\n✅ 环境变量检查通过")
    return True

def check_config_file():
    """检查配置文件"""
    print("\n" + "=" * 60)
    print("2. 检查配置文件")
    print("=" * 60)
    
    try:
        import yaml
        
        config_path = "config/config.yaml"
        if not os.path.exists(config_path):
            print(f"❌ 配置文件不存在: {config_path}")
            return False
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # 检查通知配置
        notification = config.get("notification", {})
        enable_notification = notification.get("enable_notification", True)
        
        print(f"通知功能启用: {'✅ 是' if enable_notification else '❌ 否'}")
        
        # 检查 Bark 配置
        webhooks = notification.get("webhooks", {})
        bark_device_key = webhooks.get("bark_device_key", "")
        
        if bark_device_key:
            print(f"配置文件中的 bark_device_key: ✅ 已设置")
        else:
            print(f"配置文件中的 bark_device_key: ⚠️ 未设置（将使用环境变量）")
        
        return True
        
    except ImportError:
        print("⚠️ 无法导入 yaml 模块，跳过配置文件检查")
        return True
    except Exception as e:
        print(f"❌ 读取配置文件失败: {e}")
        return False

def check_code_logic():
    """检查代码逻辑"""
    print("\n" + "=" * 60)
    print("3. 检查代码逻辑")
    print("=" * 60)
    
    try:
        # 模拟加载配置
        sys.path.insert(0, '.')
        from main import CONFIG, load_config
        
        # 重新加载配置（模拟 GitHub Actions 环境）
        config = load_config()
        
        bark_device_key = config.get("BARK_DEVICE_KEY", "")
        bark_server_url = config.get("BARK_SERVER_URL", "https://api.day.app")
        
        print(f"BARK_DEVICE_KEY: {'✅ 已配置' if bark_device_key else '❌ 未配置'}")
        print(f"BARK_SERVER_URL: {bark_server_url}")
        
        # 检查通知渠道配置
        notification_sources = []
        if bark_device_key:
            source = "环境变量" if os.environ.get("BARK_DEVICE_KEY") else "配置文件"
            notification_sources.append(f"Bark({source})")
        
        if notification_sources:
            print(f"通知渠道: {', '.join(notification_sources)}")
        else:
            print("⚠️ 警告：未检测到 Bark 配置")
        
        # 检查通知功能是否启用
        enable_notification = config.get("ENABLE_NOTIFICATION", True)
        print(f"通知功能启用: {'✅ 是' if enable_notification else '❌ 否'}")
        
        # 检查推送窗口控制
        push_window = config.get("PUSH_WINDOW", {})
        if push_window.get("ENABLED", False):
            print(f"⚠️ 推送窗口控制已启用")
            print(f"   时间范围: {push_window.get('TIME_RANGE', {}).get('START', 'N/A')} - {push_window.get('TIME_RANGE', {}).get('END', 'N/A')}")
            print(f"   每天只推送一次: {push_window.get('ONCE_PER_DAY', False)}")
        
        return True
        
    except Exception as e:
        print(f"❌ 检查代码逻辑失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_github_actions_workflow():
    """检查 GitHub Actions 工作流配置"""
    print("\n" + "=" * 60)
    print("4. 检查 GitHub Actions 工作流配置")
    print("=" * 60)
    
    workflow_path = ".github/workflows/crawler.yml"
    if not os.path.exists(workflow_path):
        print(f"❌ 工作流文件不存在: {workflow_path}")
        return False
    
    with open(workflow_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    required_vars = [
        "BARK_DEVICE_KEY",
        "BARK_SERVER_URL",
        "BARK_GROUP",
        "BARK_SOUND",
        "BARK_ICON",
    ]
    
    found_vars = []
    missing_vars = []
    
    for var in required_vars:
        if var in content:
            found_vars.append(var)
            print(f"✅ {var}: 已在工作流中配置")
        else:
            missing_vars.append(var)
            if var == "BARK_DEVICE_KEY":
                print(f"❌ {var}: 未在工作流中配置（必需）")
            else:
                print(f"⚠️ {var}: 未在工作流中配置（可选）")
    
    if "BARK_DEVICE_KEY" in missing_vars:
        print("\n❌ 错误：工作流中缺少必需的 BARK_DEVICE_KEY 环境变量")
        print("   请检查 .github/workflows/crawler.yml 文件")
        return False
    
    print("\n✅ 工作流配置检查通过")
    return True

def provide_solutions():
    """提供解决方案"""
    print("\n" + "=" * 60)
    print("5. 排查建议")
    print("=" * 60)
    
    print("\n请按以下步骤排查：")
    print("\n【步骤 1】检查 GitHub Secrets 配置")
    print("  1. 进入你的 GitHub 仓库")
    print("  2. 点击 Settings > Secrets and variables > Actions")
    print("  3. 确认已添加以下 Secret：")
    print("     - Name: BARK_DEVICE_KEY")
    print("     - Value: X9Nj52vwrTJz9qEXVgt5h（你的设备密钥）")
    print("  4. 可选配置（可留空）：")
    print("     - BARK_SERVER_URL（默认: https://api.day.app）")
    print("     - BARK_GROUP（默认: TrendRadar）")
    print("     - BARK_SOUND（默认: bell）")
    print("     - BARK_ICON（可选）")
    
    print("\n【步骤 2】检查 GitHub Actions 日志")
    print("  1. 进入你的 GitHub 仓库")
    print("  2. 点击 Actions 标签")
    print("  3. 查看最新的工作流运行日志")
    print("  4. 查找以下关键信息：")
    print("     - '通知渠道配置来源: Bark(环境变量)'")
    print("     - 'Bark消息分为 X 批次发送'")
    print("     - 'Bark第 X/X 批次发送成功'")
    print("     - 或任何错误信息")
    
    print("\n【步骤 3】检查推送条件")
    print("  1. 确认 config.yaml 中 enable_notification: true")
    print("  2. 检查是否有推送窗口控制（push_window.enabled）")
    print("  3. 确认有匹配的新闻内容（frequency_words.txt 配置）")
    print("  4. 检查推送模式设置（daily/current/incremental）")
    
    print("\n【步骤 4】手动触发测试")
    print("  1. 在 Actions 页面点击 'Run workflow'")
    print("  2. 选择分支后点击 'Run workflow'")
    print("  3. 查看运行日志确认推送情况")
    
    print("\n【步骤 5】检查 Bark 应用")
    print("  1. 确认 iOS 设备上的 Bark 应用已安装并运行")
    print("  2. 检查设备密钥是否正确")
    print("  3. 尝试手动发送测试推送（使用 test_bark.py）")

def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("Bark 推送问题诊断工具")
    print("=" * 60)
    print("\n正在检查配置...\n")
    
    results = []
    
    # 检查环境变量
    results.append(("环境变量", check_environment_variables()))
    
    # 检查配置文件
    results.append(("配置文件", check_config_file()))
    
    # 检查代码逻辑
    results.append(("代码逻辑", check_code_logic()))
    
    # 检查工作流配置
    results.append(("工作流配置", check_github_actions_workflow()))
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("诊断结果汇总")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{status}: {name}")
    
    all_passed = all(result for _, result in results)
    
    if not all_passed:
        provide_solutions()
    else:
        print("\n✅ 所有检查通过！")
        print("   如果仍然没有收到推送，请检查：")
        print("   1. GitHub Actions 运行日志")
        print("   2. 是否有匹配的新闻内容")
        print("   3. 推送窗口控制设置")
        print("   4. Bark 应用是否正常运行")

if __name__ == "__main__":
    main()

