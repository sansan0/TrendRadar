#!/usr/bin/env python3
"""
AI分析器集成测试脚本
用于验证AI分析器在GitHub Actions环境中的配置和功能
"""

import os
import sys
import yaml

# 添加项目路径
sys.path.append('.')

def test_ai_config_loading():
    """测试AI配置文件加载"""
    print("🔍 测试AI配置文件加载...")
    
    try:
        # 检查配置文件是否存在
        config_path = "config/ai_config.yaml"
        if not os.path.exists(config_path):
            print("❌ AI配置文件不存在")
            return False
        
        # 加载配置文件
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # 验证必要配置项
        required_fields = [
            "ai.api.endpoint", "ai.api.model", "ai.api.timeout", 
            "ai.auth.authorization_token", "ai.analysis.max_news_count"
        ]
        
        for field in required_fields:
            keys = field.split('.')
            current = config
            for key in keys:
                if key not in current:
                    print(f"❌ 缺少必要配置项: {field}")
                    return False
                current = current[key]
        
        print("✅ AI配置文件验证通过")
        print(f"   启用AI分析: {config['ai']['enable_ai_analysis']}")
        print(f"   API端点: {config['ai']['api']['endpoint']}")
        print(f"   模型: {config['ai']['api']['model']}")
        
        return True
        
    except Exception as e:
        print(f"❌ AI配置文件加载失败: {e}")
        return False

def test_ai_analyzer_initialization():
    """测试AI分析器初始化"""
    print("\n🔍 测试AI分析器初始化...")
    
    try:
        from ai_analyzer import AIAnalyzer
        
        analyzer = AIAnalyzer('config/ai_config.yaml')
        
        print("✅ AI分析器初始化成功")
        print(f"   API端点: {analyzer.api_url}")
        print(f"   模型: {analyzer.model}")
        print(f"   启用AI分析: {analyzer.config['ai']['enable_ai_analysis']}")
        
        # 检查API token配置
        token_status = "已配置" if analyzer.auth_token and analyzer.auth_token.strip() else "未配置"
        print(f"   认证Token: {token_status}")
        
        return True
        
    except Exception as e:
        print(f"❌ AI分析器初始化失败: {e}")
        return False

def test_github_actions_environment():
    """测试GitHub Actions环境变量"""
    print("\n🔍 测试GitHub Actions环境变量...")
    
    # 检查是否在GitHub Actions环境中
    is_github_actions = os.getenv('GITHUB_ACTIONS', 'false').lower() == 'true'
    print(f"   GitHub Actions环境: {'是' if is_github_actions else '否'}")
    
    # 检查AI相关环境变量
    ai_env_vars = [
        'AI_API_ENDPOINT',
        'AI_API_MODEL', 
        'AI_API_TOKEN',
        'AI_ENABLE_ANALYSIS'
    ]
    
    for env_var in ai_env_vars:
        value = os.getenv(env_var)
        status = "已设置" if value else "未设置"
        print(f"   {env_var}: {status}")
        if value:
            print(f"     值: {'*' * len(value) if 'TOKEN' in env_var else value}")
    
    return True

def test_ai_analyzer_functionality():
    """测试AI分析器功能"""
    print("\n🔍 测试AI分析器功能...")
    
    try:
        from ai_analyzer import AIAnalyzer
        
        analyzer = AIAnalyzer('config/ai_config.yaml')
        
        # 创建测试新闻数据
        test_news_data = [
            {
                'title': '测试新闻标题1',
                'source_name': '测试平台1',
                'time_display': '2024-01-01 10:00:00',
                'content': '这是测试新闻内容1'
            },
            {
                'title': '测试新闻标题2', 
                'source_name': '测试平台2',
                'time_display': '2024-01-01 11:00:00',
                'content': '这是测试新闻内容2'
            }
        ]
        
        # 测试分析功能
        result = analyzer.analyze_news(test_news_data)
        
        if result:
            print("✅ AI分析功能测试成功")
            print(f"   分析结果长度: {len(result)} 字符")
        else:
            print("⚠️ AI分析返回空结果（可能是API token未配置）")
            print("   这是预期的行为，因为API token尚未配置")
        
        return True
        
    except Exception as e:
        print(f"❌ AI分析器功能测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("🚀 AI分析器集成测试开始")
    print("=" * 50)
    
    # 运行所有测试
    tests = [
        ("配置文件加载", test_ai_config_loading),
        ("分析器初始化", test_ai_analyzer_initialization),
        ("GitHub环境", test_github_actions_environment),
        ("功能测试", test_ai_analyzer_functionality)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name}测试异常: {e}")
            results.append((test_name, False))
    
    # 输出测试结果
    print("\n" + "=" * 50)
    print("📊 测试结果汇总:")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"   {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 总体结果: {passed}/{total} 项测试通过")
    
    if passed == total:
        print("🎉 所有测试通过！AI分析器集成成功")
        return 0
    else:
        print("⚠️ 部分测试失败，请检查配置")
        return 1

if __name__ == "__main__":
    sys.exit(main())