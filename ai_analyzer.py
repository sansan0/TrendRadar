"""
AI分析模块 - 与SiliconFlow API交互
"""

import os
import json
import time
import yaml
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime


class AIAnalyzer:
    """AI分析器类"""
    
    def __init__(self, config_path: str = "config/ai_config.yaml"):
        """初始化AI分析器"""
        self.config = self._load_config(config_path)
        self.api_url = self.config["ai"]["api"]["endpoint"]
        self.model = self.config["ai"]["api"]["model"]
        self.timeout = self.config["ai"]["api"]["timeout"]
        self.max_retries = self.config["ai"]["api"]["max_retries"]
        self.retry_delay = self.config["ai"]["api"]["retry_delay"]
        
        # 认证配置
        self.auth_token = self.config["ai"]["auth"]["authorization_token"]
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.auth_token}"
        }
        
        # 分析参数
        self.max_news_count = self.config["ai"]["analysis"]["max_news_count"]
        self.max_content_length = self.config["ai"]["analysis"]["max_content_length"]
        
        # 输出格式
        self.max_output_length = self.config["ai"]["output"]["max_analysis_length"]
        
        # 错误处理
        self.enable_fallback = self.config["ai"]["error_handling"]["fallback_to_original"]
        self.enable_logging = self.config["ai"]["error_handling"]["log_errors"]
        
        # 加载系统提示词
        self.system_prompt = self._load_system_prompt()
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """加载AI配置文件"""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            # 验证必要配置项 - 与实际配置文件结构匹配
            required_fields = [
                "ai.api.endpoint", "ai.api.model", "ai.api.timeout", 
                "ai.auth.authorization_token", "ai.analysis.max_news_count"
            ]
            
            for field in required_fields:
                keys = field.split('.')
                current = config
                for key in keys:
                    if key not in current:
                        raise ValueError(f"缺少必要配置项: {field}")
                    current = current[key]
            
            return config
            
        except FileNotFoundError:
            raise FileNotFoundError(f"AI配置文件不存在: {config_path}")
        except yaml.YAMLError as e:
            raise ValueError(f"AI配置文件格式错误: {e}")
        except Exception as e:
            raise RuntimeError(f"加载AI配置文件失败: {e}")
    
    def _load_system_prompt(self) -> str:
        """加载系统提示词"""
        prompt_path = "config/ai_prompt.txt"
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            # 使用默认提示词
            return """请对提供的新闻数据进行专业、客观的分析，提取有价值的信息见解和背景解读。
分析要求：
1. 从杂乱的新闻中提取出有价值的信息见解和背景解读
2. 保持中立客观的立场
3. 语言表达清晰、专业且易于理解
4. 分析结果控制在500字符以内"""
    
    def _prepare_news_data(self, news_data: List[Dict]) -> str:
        """准备新闻数据用于AI分析"""
        # 限制新闻数量
        limited_news = news_data[:self.max_news_count]
        
        # 按平台分组
        platform_groups = {}
        for news in limited_news:
            platform = news.get('source_name', '未知平台')
            if platform not in platform_groups:
                platform_groups[platform] = []
            platform_groups[platform].append(news)
        
        # 构建分析数据
        analysis_data = []
        for platform, news_list in platform_groups.items():
            platform_data = {
                "platform": platform,
                "news_count": len(news_list),
                "titles": [news.get('title', '') for news in news_list[:5]]  # 每个平台最多5条标题
            }
            analysis_data.append(platform_data)
        
        # 转换为JSON格式
        return json.dumps(analysis_data, ensure_ascii=False, indent=2)
    
    def _call_api(self, payload: Dict) -> Optional[str]:
        """调用AI API"""
        for attempt in range(self.max_retries):
            try:
                response = requests.post(
                    self.api_url,
                    headers=self.headers,
                    json=payload,
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if "choices" in result and len(result["choices"]) > 0:
                        return result["choices"][0]["message"]["content"]
                    else:
                        raise ValueError("API响应格式异常")
                
                elif response.status_code == 401:
                    raise PermissionError("API认证失败，请检查token配置")
                
                elif response.status_code == 429:
                    raise RuntimeError("API调用频率限制，请稍后重试")
                
                else:
                    raise RuntimeError(f"API调用失败，状态码: {response.status_code}")
            
            except requests.exceptions.Timeout:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                raise TimeoutError("API调用超时")
            
            except requests.exceptions.ConnectionError:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                raise ConnectionError("网络连接错误")
            
            except Exception as e:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                raise e
        
        return None
    
    def analyze_news(self, news_data: List[Dict]) -> Optional[str]:
        """分析新闻数据"""
        try:
            # 检查是否启用AI分析
            if not self.config["ai"]["enable_ai_analysis"]:
                if self.enable_logging:
                    print("AI分析功能未启用，跳过分析")
                return None
            
            # 检查API配置是否有效
            if not self.auth_token or self.auth_token.strip() == "":
                if self.enable_logging:
                    print("AI API token未配置，跳过分析")
                return None
            
            # 准备新闻数据
            prepared_data = self._prepare_news_data(news_data)
            
            # 构建API请求
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"请分析以下新闻数据:\n{prepared_data}"}
                ],
                "max_tokens": self.max_output_length,
                "temperature": 0.7
            }
            
            # 调用API
            analysis_result = self._call_api(payload)
            
            if analysis_result:
                # 清理和格式化结果
                analysis_result = self._format_analysis_result(analysis_result)
                
                if self.enable_logging:
                    print(f"AI分析完成，结果长度: {len(analysis_result)}")
                
                return analysis_result
            
            return None
            
        except Exception as e:
            error_msg = f"AI分析失败: {e}"
            
            if self.enable_logging:
                print(error_msg)
            
            # 如果启用回退，返回默认分析结果
            if self.enable_fallback:
                return self._get_fallback_analysis(news_data)
            
            return None
    
    def _format_analysis_result(self, result: str) -> str:
        """格式化分析结果"""
        # 清理多余的空格和换行
        result = ' '.join(result.split())
        
        # 限制长度
        if len(result) > self.max_output_length:
            result = result[:self.max_output_length] + "..."
        
        # 添加AI分析标识
        formatted_result = f"🤖 AI分析报告\n━━━━━━━━━━━━━━━━━━━\n\n{result}"
        
        return formatted_result
    
    def _get_fallback_analysis(self, news_data: List[Dict]) -> str:
        """获取回退分析结果"""
        # 简单的统计分析作为回退
        total_news = len(news_data)
        platforms = set()
        keywords = {}
        
        for news in news_data:
            platform = news.get('source_name', '未知平台')
            platforms.add(platform)
            
            # 简单的关键词提取（基于标题长度和热度）
            title = news.get('title', '')
            if len(title) > 10:  # 只分析较长的标题
                words = title.split()
                for word in words:
                    if len(word) > 2:  # 只考虑长度大于2的词
                        keywords[word] = keywords.get(word, 0) + 1
        
        # 排序关键词
        sorted_keywords = sorted(keywords.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # 构建回退分析
        fallback_analysis = f"🤖 AI分析报告（回退模式）\n━━━━━━━━━━━━━━━━━━━\n\n"
        fallback_analysis += f"📊 数据概览：共 {total_news} 条新闻，来自 {len(platforms)} 个平台\n\n"
        
        if sorted_keywords:
            fallback_analysis += f"🔥 热点关键词："
            for i, (word, count) in enumerate(sorted_keywords):
                if i > 0:
                    fallback_analysis += "、"
                fallback_analysis += f"{word}({count}次)"
            fallback_analysis += "\n\n"
        
        fallback_analysis += "💡 提示：AI分析服务暂时不可用，此为基于统计的简单分析"
        
        return fallback_analysis
    
    def is_enabled(self) -> bool:
        """检查AI分析是否启用"""
        return self.config.get("enabled", False)


def create_ai_analyzer() -> Optional[AIAnalyzer]:
    """创建AI分析器实例"""
    try:
        return AIAnalyzer()
    except Exception as e:
        print(f"创建AI分析器失败: {e}")
        return None