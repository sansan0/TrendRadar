#!/usr/bin/env python3
# coding=utf-8
"""
为 GitHub Pages 生成带播客的 index.html
- 可配置：每个主题的新闻数量、生成的 token 数量
- 生成播客音频
- 在 index.html 中集成播放器
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import pytz
import requests
from typing import Optional
import asyncio

# ==================== 配置参数 ====================
# 可以通过环境变量覆盖这些默认值

# AI 生成配置
MAX_TOKENS = int(os.environ.get("PODCAST_MAX_TOKENS", "6000"))  # 最大生成 token 数
TEMPERATURE = float(os.environ.get("PODCAST_TEMPERATURE", "0.8"))  # 生成温度
MODEL_NAME = os.environ.get("PODCAST_MODEL_NAME", "qwen/qwen-2.5-72b-instruct")  # 模型名称
# 另外你需要在 GithubRepo 中配置你的 OPENROUTER_API_KEY Secrets 为你的 OpenRouter API Key (https://openrouter.ai/settings/keys)


# 新闻内容配置
MAX_NEWS_PER_PLATFORM = int(os.environ.get("PODCAST_NEWS_PER_PLATFORM", "10"))  # 每个平台最多取几条新闻
MAX_PLATFORMS = int(os.environ.get("PODCAST_MAX_PLATFORMS", "999"))  # 最多取几个平台（建议10-15个）

# =================================================


def get_beijing_time():
    """获取北京时间"""
    return datetime.now(pytz.timezone("Asia/Shanghai"))


def format_date_folder():
    """格式化日期文件夹"""
    return get_beijing_time().strftime("%Y年%m月%d日")


def ensure_directory_exists(directory: str):
    """确保目录存在"""
    Path(directory).mkdir(parents=True, exist_ok=True)


def read_latest_news_for_summary() -> tuple[Optional[str], Optional[str]]:
    """读取最新的新闻文件用于生成摘要

    Returns:
        (content, filename): 文件内容和文件名（不含扩展名）
    """
    date_folder = format_date_folder()
    txt_dir = Path("output") / date_folder / "txt"

    if not txt_dir.exists():
        print(f"❌ 目录不存在: {txt_dir}")
        return None, None

    txt_files = sorted([f for f in txt_dir.iterdir() if f.suffix == ".txt"])
    if not txt_files:
        print(f"❌ 没有找到txt文件")
        return None, None

    latest_file = txt_files[-1]
    print(f"✅ 读取新闻文件: {latest_file.name}")

    with open(latest_file, "r", encoding="utf-8") as f:
        content = f.read()

    return content, latest_file.name


def parse_and_simplify_news(news_content: str, max_items_per_platform: int = 10) -> list:
    """解析并简化新闻内容，保留链接

    Args:
        news_content: 新闻文本内容
        max_items_per_platform: 每个平台最多取几条新闻

    Returns:
        list: 包含平台和新闻条目的列表，每个新闻包含标题和链接
    """
    lines = news_content.strip().split("\n")

    news_data = []
    current_platform = ""
    current_platform_news = []

    for line in lines:
        line = line.strip()
        if not line or "==== 以下ID请求失败 ====" in line:
            continue

        # 检测平台名称行
        if not line[0].isdigit() and ("|" in line or "[" not in line):
            # 保存上一个平台的数据
            if current_platform_news and current_platform:
                news_data.append({
                    "platform": current_platform,
                    "items": current_platform_news[:max_items_per_platform]
                })
                current_platform_news = []

            # 解析新平台
            if "|" in line:
                parts = line.split("|")
                current_platform = parts[1].strip() if len(parts) > 1 else parts[0].strip()
            else:
                current_platform = line

        elif line[0].isdigit() and ". " in line:
            # 新闻条目行
            full_line = line.split(". ", 1)[1]

            # 提取标题和链接
            title = full_line
            url = ""

            # 提取 URL
            if "[URL:" in full_line:
                parts = full_line.split("[URL:")
                title = parts[0].strip()
                url_part = parts[1].split("]")[0].strip()
                url = url_part

            # 如果没有 URL，尝试提取 MOBILE
            if not url and "[MOBILE:" in full_line:
                parts = full_line.split("[MOBILE:")
                title = parts[0].strip()
                url_part = parts[1].split("]")[0].strip()
                url = url_part

            # 清理标题中残留的链接标记
            if "[URL:" in title:
                title = title.split("[URL:")[0].strip()
            if "[MOBILE:" in title:
                title = title.split("[MOBILE:")[0].strip()

            current_platform_news.append({
                "title": title,
                "url": url
            })

    # 处理最后一个平台
    if current_platform_news and current_platform:
        news_data.append({
            "platform": current_platform,
            "items": current_platform_news[:max_items_per_platform]
        })

    return news_data


def generate_podcast_script_with_ai(news_data: list, api_key: str, max_tokens: int = MAX_TOKENS) -> Optional[str]:
    """使用 OpenRouter Model 生成播客脚本

    Args:
        news_data: 解析后的新闻数据
        api_key: OpenRouter API Key
        max_tokens: 最大生成 token 数
    """

    # 构建提示词，限制平台数量
    news_summary = ""
    platforms_count = min(len(news_data), MAX_PLATFORMS)

    for platform_data in news_data[:platforms_count]:
        platform = platform_data["platform"]
        items = platform_data["items"]
        news_summary += f"\n【{platform}】\n"
        for i, item in enumerate(items, 1):
            title = item["title"] if isinstance(item, dict) else item
            url = item.get("url", "") if isinstance(item, dict) else ""

            # 包含链接信息（如果有）
            if url:
                news_summary += f"{i}. {title} (链接: {url})\n"
            else:
                news_summary += f"{i}. {title}\n"

    # 估算目标字数（基于 max_tokens）
    estimated_words = int(max_tokens * 0.6)  # 粗略估算中文字数

    prompt = f"""你是一位专业的播客主播，需要将以下新闻热点改编成一篇自然、流畅的播客稿。

要求：
1. 语言风格专业，像在听新闻联播
2. 每条新闻要简洁精炼，突出关键信息
3. 平台之间的过渡要自然
4. 开头要有欢迎语，结尾要有总结
5. 目标字数约 {estimated_words} 字左右
6. 避免使用过度专业的术语，确保播客内容对一般听众也有价值
7. 不要提及链接URL，这些链接仅供你理解新闻背景

新闻内容：
{news_summary}

请直接输出播客稿，不要有其他说明文字，不要用Markdown格式以及标点以保证TTS友好。"""

    print(f"🤖 正在调用 {MODEL_NAME} 生成播客脚本...")
    print(f"📊 配置: {platforms_count}个平台, 每平台{MAX_NEWS_PER_PLATFORM}条新闻, max_tokens={max_tokens}")
    print(f"📏 提示词长度: {len(prompt)} 字符")

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL_NAME,  # 使用配置的模型
                "messages": [{"role": "user", "content": prompt}],
                "temperature": TEMPERATURE,  # 可配置的温度
                "max_tokens": max_tokens,  # 可配置的最大 token 数
            },
            timeout=120  # 增加超时时间
        )

        if response.status_code == 200:
            result = response.json()

            # 调试：打印响应结构
            if "choices" in result and len(result["choices"]) > 0:
                script = result["choices"][0]["message"]["content"]
                print(f"✅ AI 脚本生成成功，长度: {len(script)} 字符")

                if not script or len(script) == 0:
                    print("⚠️  警告: 脚本内容为空!")
                    print(f"完整响应: {result}")
                    return None

                return script
            else:
                print(f"❌ 响应格式异常: {result}")
                return None
        else:
            print(f"❌ API 调用失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            return None

    except Exception as e:
        print(f"❌ 生成脚本时出错: {e}")
        import traceback
        traceback.print_exc()
        return None


def generate_audio_with_edge_tts(script: str, output_path: Path) -> bool:
    """使用 Edge TTS 生成音频"""
    try:
        print("🎙️  使用 Edge TTS 生成音频...")

        import edge_tts

        async def generate():
            communicate = edge_tts.Communicate(script, "zh-CN-YunyangNeural")
            await communicate.save(str(output_path))

        asyncio.run(generate())
        print(f"✅ 音频生成成功: {output_path}")
        return True

    except ImportError:
        print("⚠️  edge-tts 未安装，跳过音频生成")
        return False
    except Exception as e:
        print(f"❌ 生成音频时出错: {e}")
        return False


def inject_audio_player_to_index(audio_filename: str):
    """将音频播放器注入到现有的 index.html 中"""

    index_path = Path("index.html")

    if not index_path.exists():
        print("❌ index.html 不存在，请先运行 main.py 生成")
        return False

    # 读取现有的 index.html
    with open(index_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # 检查是否已经有音频播放器
    if "audio-player-container" in html_content and audio_filename in html_content:
        print("✅ index.html 已包含音频播放器，无需重复添加")
        return True

    # 构建音频播放器 HTML
    date_folder = format_date_folder()
    audio_path = f"output/{date_folder}/audio/{audio_filename}"

    audio_player_html = f"""
                <div class="audio-player-container">
                    <div class="audio-player-label">
                        <span>🎧</span>
                        <span>播客音频</span>
                    </div>
                    <audio controls class="audio-player">
                        <source src="{audio_path}" type="audio/mpeg">
                        您的浏览器不支持音频播放。
                    </audio>
                </div>"""

    # 查找插入位置：在 </div> 之前（header 的结束位置）
    # 寻找包含 "生成时间" 后的第一个 </div></div>
    import re

    # 方法1: 在 header div 结束前插入
    pattern = r'(生成时间.*?</div>\s*</div>\s*</div>)'

    if re.search(pattern, html_content, re.DOTALL):
        # 在匹配的位置前插入音频播放器
        html_content = re.sub(
            pattern,
            lambda m: m.group(1).replace('</div>\n            </div>',
                                        audio_player_html + '\n            </div>\n            </div>'),
            html_content,
            count=1,
            flags=re.DOTALL
        )

        # 写回文件
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        print(f"✅ 音频播放器已成功注入到 index.html")
        return True
    else:
        print("⚠️  未找到合适的插入位置，尝试备用方案...")

        # 备用方案：在 <div class="content"> 之前插入
        if '<div class="content">' in html_content:
            html_content = html_content.replace(
                '<div class="content">',
                f'            </div>{audio_player_html}\n            \n            <div class="content">',
                1
            )

            with open(index_path, "w", encoding="utf-8") as f:
                f.write(html_content)

            print(f"✅ 音频播放器已成功注入到 index.html（备用位置）")
            return True
        else:
            print("❌ 无法找到插入位置")
            return False


def main():
    """主函数"""
    print("=" * 60)
    print("🎙️  生成带播客的 index.html for GitHub Pages")
    print("=" * 60)
    print(f"\n⚙️  当前配置:")
    print(f"   - 每个平台最多新闻数: {MAX_NEWS_PER_PLATFORM}")
    print(f"   - 最多平台数: {MAX_PLATFORMS if MAX_PLATFORMS < 999 else '全部'}")
    print(f"   - AI 最大 tokens: {MAX_TOKENS}")
    print(f"   - AI 温度: {TEMPERATURE}")
    print()

    # 1. 检查 API Key
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("❌ 警告: 未找到 OPENROUTER_API_KEY 环境变量， 跳过播客生成")
        return 0

    # 2. 读取最新新闻
    news_content, news_filename = read_latest_news_for_summary()
    if not news_content:
        print("❌ 无法读取新闻内容")
        return 1
    
    print(f"✅ 读取新闻文件: {news_filename}")



    # 3. 解析并简化新闻
    print(f"📝 解析新闻内容（每个平台取{MAX_NEWS_PER_PLATFORM}条）...")
    news_data = parse_and_simplify_news(news_content, max_items_per_platform=MAX_NEWS_PER_PLATFORM)
    print(f"✅ 解析到 {len(news_data)} 个平台的新闻")

    # 4. 准备音频文件路径
    date_folder = format_date_folder()
    audio_dir = Path("output") / date_folder / "audio"
    ensure_directory_exists(str(audio_dir))

    audio_filename = news_filename.replace(".txt", ".mp3")  # 新闻文件名
    audio_path = audio_dir / audio_filename
    script_path = audio_dir / f"script_{news_filename}"

    # 5. 生成播客脚本
    script = generate_podcast_script_with_ai(news_data, api_key, max_tokens=MAX_TOKENS)
    if not script:
        print("❌ 脚本生成失败")
        return 1

    # 保存脚本
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(script)
    print(f"✅ 播客脚本已保存: {script_path}")

    # 6. 生成音频
    audio_generated = generate_audio_with_edge_tts(script, audio_path)

    if not audio_generated:
        print("⚠️  音频生成失败，但会继续生成 HTML")
        # 创建一个空文件占位
        audio_path.touch()

    # 7. 将音频播放器注入到现有的 index.html
    print("📄 注入音频播放器到 index.html...")
    inject_audio_player_to_index(audio_filename)

    # 8. 完成
    print("\n" + "=" * 60)
    print("✅ 完成！")
    print("=" * 60)
    print(f"📝 播客脚本: {script_path}")
    if audio_path.exists():
        print(f"🎵 音频文件: {audio_path} ({audio_path.stat().st_size / 1024:.1f} KB)")
    print(f"📄 首页: index.html")
    print("\n💡 index.html 已包含音频播放器，可直接部署到 GitHub Pages")

    return 0


if __name__ == "__main__":
    sys.exit(main())
