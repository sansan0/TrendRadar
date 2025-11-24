<div align="center" id="trendradar">

<a href="https://github.com/sansan0/TrendRadar" title="TrendRadar">
  <img src="/_image/banner.webp" alt="TrendRadar Banner" width="80%">
</a>

🚀 最快<strong>30秒</strong>部署的热点助手 —— 告别无效刷屏，只看真正关心的新闻资讯

<a href="https://trendshift.io/repositories/14726" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14726" alt="sansan0%2FTrendRadar | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

<a href="https://share.302.ai/mEOUzG" target="_blank" title="一站式 AI 模型和 API 平台"><img src="_image/302ai.png" alt="302.AI logo" height="52"/></a>
<a href="https://shandianshuo.cn" target="_blank" title="AI 语音输入，比打字快 4 倍 ⚡"><img src="_image/shandianshuo.png" alt="闪电说 logo" height="53"/></a>

[![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-v3.3.0-blue.svg)](https://github.com/sansan0/TrendRadar)
[![MCP](https://img.shields.io/badge/MCP-v1.0.2-green.svg)](https://github.com/sansan0/TrendRadar)

[![企业微信通知](https://img.shields.io/badge/企业微信-通知-00D4AA?style=flat-square)](https://work.weixin.qq.com/)
[![个人微信通知](https://img.shields.io/badge/个人微信-通知-00D4AA?style=flat-square)](https://weixin.qq.com/)
[![Telegram通知](https://img.shields.io/badge/Telegram-通知-00D4AA?style=flat-square)](https://telegram.org/)
[![dingtalk通知](https://img.shields.io/badge/钉钉-通知-00D4AA?style=flat-square)](#)
[![飞书通知](https://img.shields.io/badge/飞书-通知-00D4AA?style=flat-square)](https://www.feishu.cn/)
[![邮件通知](https://img.shields.io/badge/Email-通知-00D4AA?style=flat-square)](#) 
[![ntfy通知](https://img.shields.io/badge/ntfy-通知-00D4AA?style=flat-square)](https://github.com/binwiederhier/ntfy)
[![Bark通知](https://img.shields.io/badge/Bark-通知-00D4AA?style=flat-square)](https://github.com/Finb/Bark)


[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-自动化-2088FF?style=flat-square&logo=github-actions&logoColor=white)](https://github.com/sansan0/TrendRadar)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-部署-4285F4?style=flat-square&logo=github&logoColor=white)](https://sansan0.github.io/TrendRadar)
[![Docker](https://img.shields.io/badge/Docker-部署-2496ED?style=flat-square&logo=docker&logoColor=white)](https://hub.docker.com/r/wantcat/trendradar)
[![MCP Support](https://img.shields.io/badge/MCP-AI分析支持-FF6B6B?style=flat-square&logo=ai&logoColor=white)](https://modelcontextprotocol.io/)

</div>

<div align="center">

**中文** | **[English](README-EN.md)**

</div>

> 本项目以轻量，易部署为目标

<details>
<summary>⚠️ 点击展开：<strong>查看最新文档</strong>（Fork 用户必读）</summary>
<br>

最近有很多第一次接触 GitHub 的新用户使用本项目，因此特别补充这个说明。

**问题**：如果你是通过 **Fork** 使用本项目，你看到的可能是旧版文档。

**原因**：Fork 时会复制当时的文档版本，但原项目可能已更新。

**👉 [点击查看最新官方文档](https://github.com/sansan0/TrendRadar?tab=readme-ov-file)**

**如何判断？** 看页面顶部的仓库地址：
- `github.com/你的用户名/TrendRadar` ← 你 fork 的版本
- `github.com/sansan0/TrendRadar` ← 最新官方版本

</details>

## 📑 快速导航

<div align="center">

| [🚀 快速开始](#-快速开始) | [🤖 AI 智能分析](#-ai-智能分析) | [⚙️ 配置详解](#配置详解) | [📝 更新日志](#-更新日志) | [❓ 答疑与交流](#问题答疑与交流) |
|:---:|:---:|:---:|:---:|:---:|
| [🐳 Docker部署](#-docker-部署) | [🔌 MCP客户端](#-mcp-客户端) | [⭐ 项目相关](#项目相关) | [🪄 赞助商](#-赞助商) | |

</div>

- 感谢**耐心反馈 bug** 的贡献者，你们的每一条反馈让项目更加完善😉;  
- 感谢**为项目点 star** 的观众们，**fork** 你所欲也，**star** 我所欲也，两者得兼😍是对开源精神最好的支持;  
- 感谢**关注[公众号](#问题答疑与交流)** 的读者们，你们的留言、点赞、分享和推荐等积极互动让内容更有温度😎。  

<details>
<summary>👉 点击展开：<strong>致谢名单</strong> (当前 <strong>🔥72🔥</strong> 位)</summary>

### 基础设施支持

感谢 **GitHub** 免费提供的基础设施，这是本项目得以**一键 fork**便捷运行的最大前提。

### 数据支持

本项目使用 [newsnow](https://github.com/ourongxing/newsnow) 项目的 API 获取多平台数据，特别感谢作者提供的服务。

经联系，作者表示无需担心服务器压力，但这是基于他的善意和信任。请大家：
- **前往 [newsnow 项目](https://github.com/ourongxing/newsnow) 点 star 支持**
- Docker 部署时，请合理控制推送频率，勿竭泽而渔

### 推广助力

> 感谢以下平台和个人的推荐(按时间排列)

- [小众软件](https://mp.weixin.qq.com/s/fvutkJ_NPUelSW9OGK39aA) - 开源软件推荐平台
- [LinuxDo 社区](https://linux.do/) - 技术爱好者的聚集地
- [阮一峰周刊](https://github.com/ruanyf/weekly) - 技术圈有影响力的周刊

### 观众支持

> 感谢**给予资金支持**的朋友们，你们的慷慨已化身为键盘旁的零食饮料，陪伴着项目的每一次迭代。
>
> **"一元点赞"已暂停**，如仍想支持作者，可前往[公众号](#问题答疑与交流)文章底部点击"喜欢作者"。

|           点赞人            |  金额  |  日期  |             备注             |
| :-------------------------: | :----: | :----: | :-----------------------: |
|           *鬼          |  1 | 2025.11.17  |    | 
|           *超          |  10 | 2025.11.17  |    | 
|           R*w          |  10 | 2025.11.17  | 这 agent 做的牛逼啊,兄弟    | 
|           J*o          |  1 | 2025.11.17  | 感谢开源,祝大佬事业有成    | 
|           *晨          |  8.88  | 2025.11.16  | 项目不错,研究学习中    | 
|           *海          |  1  | 2025.11.15  |    | 
|           *德          |  1.99  | 2025.11.15  |    | 
|           *疏          |  8.8  | 2025.11.14  |  感谢开源，项目很棒，支持一下   | 
|           M*e          |  10  | 2025.11.14  |  开源不易，大佬辛苦了   | 
|           **柯          |  1  | 2025.11.14  |     | 
|           *云          |  88  | 2025.11.13  |    好项目，感谢开源  | 
|           *W          |  6  | 2025.11.13  |      | 
|           *凯          |  1  | 2025.11.13  |      | 
|           对*.          |  1  | 2025.11.13  |    Thanks for your TrendRadar  | 
|           s*y          |  1  | 2025.11.13  |      | 
|           **翔          |  10  | 2025.11.13  |   好项目，相见恨晚，感谢开源！     | 
|           *韦          |  9.9  | 2025.11.13  |   TrendRadar超赞，请老师喝咖啡~     | 
|           h*p          |  5  | 2025.11.12  |   支持中国开源力量，加油！     | 
|           c*r          |  6  | 2025.11.12  |        | 
|           a*n          |  5  | 2025.11.12  |        | 
|           。*c          |  1  | 2025.11.12  |    感谢开源分享    | 
|           *记          |  1  | 2025.11.11  |        | 
|           *主          |  1  | 2025.11.10  |        | 
|           *了          |  10  | 2025.11.09  |        | 
|           *杰          |  5  | 2025.11.08  |        | 
|           *点          |  8.80  | 2025.11.07  |   开发不易，支持一下。     | 
|           Q*Q          |  6.66  | 2025.11.07  |   感谢开源！     | 
|           C*e          |  1  | 2025.11.05  |        | 
|           Peter Fan          |  20  | 2025.10.29  |        | 
|           M*n          |  1  | 2025.10.27  |      感谢开源  | 
|           *许          |  8.88  | 2025.10.23  |      老师 小白一枚，摸了几天了还没整起来，求教  | 
|           Eason           |  1  | 2025.10.22  |      还没整明白，但你在做好事  | 
|           P*n           |  1  | 2025.10.20  |          |
|           *杰           |  1  | 2025.10.19  |          |
|           *徐           |  1  | 2025.10.18  |          |
|           *志           |  1  | 2025.10.17  |          |
|           *😀           |  10  | 2025.10.16  |     点赞     |
|           **杰           |  10  | 2025.10.16  |          |
|           *啸           |  10  | 2025.10.16  |          |
|           *纪           |  5  | 2025.10.14  | TrendRadar         |
|           J*d           |  1  | 2025.10.14  | 谢谢你的工具，很好玩...          |
|           *H           |  1  | 2025.10.14  |           |
|           那*O           |  10  | 2025.10.13  |           |
|           *圆           |  1  | 2025.10.13  |           |
|           P*g           |  6  | 2025.10.13  |           |
|           Ocean           |  20  | 2025.10.12  |  ...真的太棒了！！！小白级别也能直接用...         |
|           **培           |  5.2  | 2025.10.2  |  github-yzyf1312:开源万岁         |
|           *椿           |  3  | 2025.9.23  |  加油，很不错         |
|           *🍍           |  10  | 2025.9.21  |           |
|           E*f           |  1  | 2025.9.20  |           |
|           *记            |  1  | 2025.9.20  |           |
|           z*u            |  2  | 2025.9.19  |           |
|           **昊            |  5  | 2025.9.17  |           |
|           *号            |  1  | 2025.9.15  |           |
|           T*T            |  2  | 2025.9.15  |  点赞         |
|           *家            |  10  | 2025.9.10  |           |
|           *X            |  1.11  | 2025.9.3  |           |
|           *飙            |  20  | 2025.8.31  |  来自老童谢谢         |
|           *下            |  1  | 2025.8.30  |           |
|           2*D            |  88  | 2025.8.13 下午 |           |
|           2*D            |  1  | 2025.8.13 上午 |           |
|           S*o            |  1  | 2025.8.05 |   支持一下        |
|           *侠            |  10  | 2025.8.04 |           |
|           x*x            |  2  | 2025.8.03 |  trendRadar 好项目 点赞          |
|           *远            |  1  | 2025.8.01 |            |
|           *邪            |  5  | 2025.8.01 |            |
|           *梦            |  0.1  | 2025.7.30 |            |
|           **龙            |  10  | 2025.7.29 |      支持一下      |


</details>


## ✨ 核心功能

### **全网热点聚合**

- 知乎
- 抖音
- bilibili 热搜
- 华尔街见闻
- 贴吧
- 百度热搜
- 财联社热门
- 澎湃新闻
- 凤凰网
- 今日头条
- 微博

默认监控 11 个主流平台，也可自行增加额外的平台

> 💡 详细配置教程见 [配置详解 - 平台配置](#1-平台配置)

### **智能推送策略**

**三种推送模式**：

| 模式 | 适用场景 | 推送特点 |
|------|---------|---------|
| **当日汇总** (daily) | 企业管理者/普通用户 | 按时推送当日所有匹配新闻（会包含之前推送过的） |
| **当前榜单** (current) | 自媒体人/内容创作者 | 按时推送当前榜单匹配新闻（持续在榜的每次都出现） |
| **增量监控** (incremental) | 投资者/交易员 | 仅推送新增内容，零重复 |

> 💡 **快速选择指南：**
> - 🔄 不想看到重复新闻 → 用 `incremental`（增量监控）
> - 📊 想看完整榜单趋势 → 用 `current`（当前榜单）
> - 📝 需要每日汇总报告 → 用 `daily`（当日汇总）
>
> 详细对比和配置教程见 [配置详解 - 推送模式详解](#3-推送模式详解)

**附加功能 - 推送时间窗口控制**（可选）：

- 设定推送时间范围（如 09:00-18:00），只在指定时间内推送
- 可配置窗口内多次推送或每天仅推送一次
- 避免非工作时间打扰

> 💡 此功能默认关闭，配置方法见 [快速开始](#-快速开始)

### **精准内容筛选**

设置个人关键词（如：AI、比亚迪、教育政策），只推送相关热点，过滤无关信息

**基础语法**（4种）：
- 普通词：基础匹配
- 必须词 `+`：限定范围
- 过滤词 `!`：排除干扰
- 数量限制 `@`：控制显示数量（v3.2.0 新增）

**高级功能**（v3.2.0 新增）：
- 🔢 **关键词排序控制**：按热度优先 or 配置顺序优先
- 📊 **显示数量精准限制**：全局配置 + 单独配置，灵活控制推送长度

**词组化管理**：
- 空行分隔，独立统计不同主题热点

> 💡 **基础配置教程**：[关键词配置 - 基础语法](#关键词基础语法)
>
> 💡 **高级配置教程**：[关键词配置 - 高级配置](#关键词高级配置)
>
> 💡 也可以不做筛选，完整推送所有热点（将 frequency_words.txt 留空）

### **热点趋势分析**

实时追踪新闻热度变化，让你不仅知道"什么在热搜"，更了解"热点如何演变"

- **时间轴追踪**：记录每条新闻从首次出现到最后出现的完整时间跨度
- **热度变化**：统计新闻在不同时间段的排名变化和出现频次
- **新增检测**：实时识别新出现的热点话题，用🆕标记第一时间提醒
- **持续性分析**：区分一次性热点话题和持续发酵的深度新闻
- **跨平台对比**：同一新闻在不同平台的排名表现，看出媒体关注度差异

> 💡 推送格式说明见 [配置详解 - 推送格式参考](#5-推送格式参考)

### **个性化热点算法**

不再被各个平台的算法牵着走，TrendRadar 会重新整理全网热搜：

- **看重排名高的新闻**（占60%）：各平台前几名的新闻优先显示
- **关注持续出现的话题**（占30%）：反复出现的新闻更重要
- **考虑排名质量**（占10%）：不仅多次出现，还经常排在前列

> 💡 这三个比例可以调整，详见 [配置详解 - 热点权重调整](#4-热点权重调整)

### **多渠道实时推送**

支持**企业微信**(+ 微信推送方案)、**飞书**、**钉钉**、**Telegram**、**邮件**、**ntfy**，消息直达手机和邮箱

### **多端适配**
- **GitHub Pages**：自动生成精美网页报告，PC/移动端适配
- **Docker部署**：支持多架构容器化运行
- **数据持久化**：HTML/TXT多格式历史记录保存


### **AI 智能分析（v3.0.0 新增）**

基于 MCP (Model Context Protocol) 协议的 AI 对话分析系统，让你用自然语言深度挖掘新闻数据

- **对话式查询**：用自然语言提问，如"查询昨天知乎的热点"、"分析比特币最近的热度趋势"
- **13 种分析工具**：涵盖基础查询、智能检索、趋势分析、数据洞察、情感分析等
- **多客户端支持**：Cherry Studio（GUI 配置）、Claude Desktop、Cursor、Cline 等
- **深度分析能力**：
  - 话题趋势追踪（热度变化、生命周期、爆火检测、趋势预测）
  - 跨平台数据对比（活跃度统计、关键词共现）
  - 智能摘要生成、相似新闻查找、历史关联检索

> **💡 使用提示**：AI 功能需要本地新闻数据支持
> - 项目自带 **11月1-15日** 测试数据，可立即体验
> - 建议自行部署运行项目，获取更实时的数据
>
> 详见 [AI 智能分析](#-ai-智能分析)

### **零技术门槛部署**

GitHub 一键 Fork 即可使用，无需编程基础。

> 30秒部署： GitHub Pages（网页浏览）支持一键保存成图片，随时分享给他人
>
> 1分钟部署： 企业微信（手机通知）

**💡 提示：** 想要**实时更新**的网页版？fork 后，进入你的仓库 Settings → Pages，启用 GitHub Pages。[效果预览](https://sansan0.github.io/TrendRadar/)。

### **减少 APP 依赖**

从"被算法推荐绑架"变成"主动获取自己想要的信息"

**适合人群：** 投资者、自媒体人、企业公关、关心时事的普通用户

**典型场景：** 股市投资监控、品牌舆情追踪、行业动态关注、生活资讯获取


| Github Pages 效果(手机端适配、邮箱推送效果) | 飞书推送效果 |
|:---:|:---:|
| ![Github Pages效果](_image/github-pages.png) | ![飞书推送效果](_image/feishu.jpg) |


## 📝 更新日志

>**升级说明**：
- **📌 查看最新更新**：**[原仓库更新日志](https://github.com/sansan0/TrendRadar?tab=readme-ov-file#-更新日志)**
- **提示**：不要通过 **Sync fork** 更新本项目，建议查看【历史更新】，明确具体的【升级方式】和【功能内容】
- **小版本更新**：从 v2.x 升级到 v2.y，用本项目的 `main.py` 代码替换你 fork 仓库中的对应文件
- **大版本升级**：从 v1.x 升级到 v2.y，建议删除现有 fork 后重新 fork，这样更省力且避免配置冲突


### 2025/11/24 - v3.3.0

**🎉 新增 Bark 推送支持**

1. **iOS 专属推送渠道**
   - 支持 Bark 推送（基于 APNs，iOS 平台）
   - 免费开源，简洁高效，无广告干扰
   - 支持官方服务器和自建服务器两种方式

2. **多种部署方式**
   - GitHub Actions：配置 `BARK_URL` Secret
   - Docker：环境变量 `BARK_URL`
   - 本地运行：`config/config.yaml` 配置文件

> 📖 **详细配置教程**：[快速开始 - Bark 推送](#-快速开始)

**🐛 Bug 修复**
- 修复 `config.yaml` 中 `ntfy_server_url` 配置不生效的问题 ([#345](https://github.com/sansan0/TrendRadar/issues/345))

**🔧 升级说明**：
- **GitHub Fork 用户**：更新 `main.py`、`config/config.yaml`、`.github/workflows/crawler.yml`


<details>
<summary>👉 点击展开：<strong>历史更新</strong></summary>


### 2025/11/23 - v3.2.0

**🎯 新增高级定制功能**

1. **关键词排序优先级配置**
   - 支持两种排序策略：热度优先 vs 配置顺序优先
   - 满足不同使用场景：热点追踪 or 个性化关注

2. **显示数量精准控制**
   - 全局配置：统一限制所有关键词显示数量
   - 单独配置：使用 `@数字` 语法为特定关键词设置限制
   - 有效控制推送长度，突出重点内容

> 📖 **详细配置教程**：[关键词配置 - 高级配置](#关键词高级配置)

**🔧 升级说明**：
- **GitHub Fork 用户**：更新 `main.py`、`config/config.yaml`

### 2025/11/18 - mcp-v1.0.2

  **MCP 模块更新:**
  - 优化查询今日新闻却可能错误返回过去日期的情况


### 2025/11/22 - v3.1.1

- **修复数据异常导致的崩溃问题**：解决部分用户在 GitHub Actions 环境中遇到的 `'float' object has no attribute 'lower'` 错误
- 新增双重防护机制：在数据获取阶段过滤无效标题（None、float、空字符串），同时在函数调用处添加类型检查
- 提升系统稳定性，确保在数据源返回异常格式时仍能正常运行

**升级说明**（GitHub Fork 用户）：
- 必须更新：`main.py`
- 建议使用小版本升级方式：复制替换上述文件


### 2025/11/20 - v3.1.0

- **新增个人微信推送支持**：企业微信应用可推送到个人微信，无需安装企业微信 APP
- 支持两种消息格式：`markdown`（企业微信群机器人）和 `text`（个人微信应用）
- 新增 `WEWORK_MSG_TYPE` 环境变量配置，支持 GitHub Actions、Docker、docker-compose 等多种部署方式
- `text` 模式自动清除 Markdown 语法，提供纯文本推送效果
- 详见快速开始中的「个人微信推送」配置说明

**升级说明**（GitHub Fork 用户）：
- 必须更新：`main.py`、`config/config.yaml`
- 可选更新：`.github/workflows/crawler.yml`（如使用 GitHub Actions 部署）
- 建议使用小版本升级方式：复制替换上述文件

### 2025/11/12 - v3.0.5

- 修复邮件发送 SSL/TLS 端口配置逻辑错误
- 优化邮箱服务商（QQ/163/126）默认使用 465 端口（SSL）
- **新增 Docker 环境变量支持**：核心配置项（`enable_crawler`、`report_mode`、`push_window` 等）支持通过环境变量覆盖，解决 NAS 用户修改配置文件不生效的问题（详见 [🐳 Docker 部署](#-docker-部署) 章节）


### 2025/10/26 - mcp-v1.0.1

  **MCP 模块更新:**
  - 修复日期查询参数传递错误
  - 统一所有工具的时间参数格式


### 2025/10/31 - v3.0.4

- 解决飞书因推送内容过长而产生的错误，实现了分批推送


### 2025/10/23 - v3.0.3

- 扩大 ntfy 错误信息显示范围


### 2025/10/21 - v3.0.2

- 修复 ntfy 推送编码问题

### 2025/10/20 - v3.0.0

**重大更新 - AI 分析功能上线** 🤖

- **核心功能**：
  - 新增基于 MCP (Model Context Protocol) 的 AI 分析服务器
  - 支持13种智能分析工具：基础查询、智能检索、高级分析、系统管理
  - 自然语言交互：通过对话方式查询和分析新闻数据
  - 多客户端支持：Claude Desktop、Cherry Studio、Cursor、Cline 等

- **分析能力**：
  - 话题趋势分析（热度追踪、生命周期、爆火检测、趋势预测）
  - 数据洞察（平台对比、活跃度统计、关键词共现）
  - 情感分析、相似新闻查找、智能摘要生成
  - 历史相关新闻检索、多模式搜索

- **更新提示**：
  - 这是独立的 AI 分析功能，不影响现有的推送功能
  - 可选择性使用，无需升级现有部署


### 2025/10/15 - v2.4.4

- **更新内容**：
    - 修复 ntfy 推送编码问题 + 1
    - 修复推送时间窗口判断问题

- **更新提示**：
  - 建议【小版本升级】


### 2025/10/10 - v2.4.3

> 感谢 [nidaye996](https://github.com/sansan0/TrendRadar/issues/98) 发现的体验问题

- **更新内容**：
    - 重构"静默推送模式"命名为"推送时间窗口控制"，提升功能理解度
    - 明确推送时间窗口作为可选附加功能，可与三种推送模式搭配使用
    - 改进注释和文档描述，使功能定位更加清晰

- **更新提示**：
  - 这个仅仅是重构，可以不用升级


### 2025/10/8 - v2.4.2

- **更新内容**：
    - 修复 ntfy 推送编码问题
    - 修复配置文件缺失问题
    - 优化 ntfy 推送效果
    - 增加 github page 图片分段导出功能

- **更新提示**：
  - 建议使用【大版本更新】


### 2025/10/2 - v2.4.0

**新增 ntfy 推送通知**

- **核心功能**：
  - 支持 ntfy.sh 公共服务和自托管服务器

- **使用场景**：
  - 适合追求隐私的用户（支持自托管）
  - 跨平台推送（iOS、Android、Desktop、Web）
  - 无需注册账号（公共服务器）
  - 开源免费（MIT 协议）

- **更新提示**：
  - 建议使用【大版本更新】


### 2025/09/26 - v2.3.2

- 修正了邮件通知配置检查被遗漏的问题（[#88](https://github.com/sansan0/TrendRadar/issues/88)）

**修复说明**：
- 解决了即使正确配置邮件通知，系统仍提示"未配置任何webhook"的问题

### 2025/09/22 - v2.3.1

- **新增邮件推送功能**，支持将热点新闻报告发送到邮箱
- **智能 SMTP 识别**：自动识别 Gmail、QQ邮箱、Outlook、网易邮箱等 10+ 种邮箱服务商配置
- **HTML 精美格式**：邮件内容采用与网页版相同的 HTML 格式，排版精美，移动端适配
- **批量发送支持**：支持多个收件人，用逗号分隔即可同时发送给多人
- **自定义 SMTP**：可自定义 SMTP 服务器和端口
- 修复Docker构建网络连接问题

**使用说明**：
- 适用场景：适合需要邮件归档、团队分享、定时报告的用户
- 支持邮箱：Gmail、QQ邮箱、Outlook/Hotmail、163/126邮箱、新浪邮箱、搜狐邮箱等

**更新提示**：
- 此次更新的内容比较多，如果想升级，建议采用【大版本升级】

### 2025/09/17 - v2.2.0

- 新增一键保存新闻图片功能，让你轻松分享关注的热点

**使用说明**：
- 适用场景：当你按照教程开启了网页版功能后(GitHub Pages)
- 使用方法：用手机或电脑打开该网页链接，点击页面顶部的"保存为图片"按钮
- 实际效果：系统会自动将当前的新闻报告制作成一张精美图片，保存到你的手机相册或电脑桌面
- 分享便利：你可以直接把这张图片发给朋友、发到朋友圈，或分享到工作群，让别人也能看到你发现的重要资讯

### 2025/09/13 - v2.1.2

- 解决钉钉的推送容量限制导致的新闻推送失败问题(采用分批推送)

### 2025/09/04 - v2.1.1

- 修复docker在某些架构中无法正常运行的问题
- 正式发布官方 Docker 镜像 wantcat/trendradar，支持多架构
- 优化 Docker 部署流程，无需本地构建即可快速使用

### 2025/08/30 - v2.1.0

**核心改进**：
- **推送逻辑优化**：从"每次执行都推送"改为"时间窗口内可控推送"
- **时间窗口控制**：可设定推送时间范围，避免非工作时间打扰
- **推送频率可选**：时间段内支持单次推送或多次推送

**更新提示**：
- 本功能默认关闭，需手动在 config.yaml 中开启推送时间窗口控制
- 升级需同时更新 main.py 和 config.yaml 两个文件

### 2025/08/27 - v2.0.4

- 本次版本不是功能修复，而是重要提醒
- 请务必妥善保管好 webhooks，不要公开，不要公开，不要公开
- 如果你以 fork 的方式将本项目部署在 GitHub 上，请将 webhooks 填入 GitHub Secret，而非 config.yaml
- 如果你已经暴露了 webhooks 或将其填入了 config.yaml，建议删除后重新生成

### 2025/08/06 - v2.0.3

- 优化 github page 的网页版效果，方便移动端使用

### 2025/07/28 - v2.0.2

- 重构代码
- 解决版本号容易被遗漏修改的问题

### 2025/07/27 - v2.0.1

**修复问题**: 

1. docker 的 shell 脚本的换行符为 CRLF 导致的执行异常问题
2. frequency_words.txt 为空时，导致新闻发送也为空的逻辑问题
  - 修复后，当你选择 frequency_words.txt 为空时，将**推送所有新闻**，但受限于消息推送大小限制，请做如下调整
    - 方案一：关闭手机推送，只选择 Github Pages 布置(这是能获得最完整信息的方案，将把所有平台的热点按照你**自定义的热搜算法**进行重新排序)
    - 方案二：减少推送平台，优先选择**企业微信**或**Telegram**，这两个推送我做了分批推送功能(因为分批推送影响推送体验，且只有这两个平台只给一点点推送容量，所以才不得已做了分批推送功能，但至少能保证获得的信息完整)
    - 方案三：可与方案二结合，模式选择 current 或 incremental 可有效减少一次性推送的内容 

### 2025/07/17 - v2.0.0

**重大重构**：
- 配置管理重构：所有配置现在通过 `config/config.yaml` 文件管理（main.py 我依旧没拆分，方便你们复制升级）
- 运行模式升级：支持三种模式 - `daily`（当日汇总）、`current`（当前榜单）、`incremental`（增量监控）
- Docker 支持：完整的 Docker 部署方案，支持容器化运行

**配置文件说明**：
- `config/config.yaml` - 主配置文件（应用设置、爬虫配置、通知配置、平台配置等）
- `config/frequency_words.txt` - 关键词配置（监控词汇设置）

### 2025/07/09 - v1.4.1

**功能新增**：增加增量推送(在 main.py 头部配置 FOCUS_NEW_ONLY)，该开关只关心新话题而非持续热度，只在有新内容时才发通知。

**修复问题**: 某些情况下，由于新闻本身含有特殊符号导致的偶发性排版异常。

### 2025/06/23 - v1.3.0

企业微信 和 Telegram 的推送消息有长度限制，对此我采用将消息拆分推送的方式。开发文档详见[企业微信](https://developer.work.weixin.qq.com/document/path/91770) 和 [Telegram](https://core.telegram.org/bots/api)

### 2025/06/21 - v1.2.1

在本版本之前的旧版本，不仅 main.py 需要复制替换， crawler.yml 也需要你复制替换
https://github.com/sansan0/TrendRadar/blob/master/.github/workflows/crawler.yml

### 2025/06/19 - v1.2.0

> 感谢 claude research 整理的各平台 api ,让我快速完成各平台适配（虽然代码更多冗余了~

1. 支持 telegram ，企业微信，钉钉推送渠道, 支持多渠道配置和同时推送

### 2025/06/18 - v1.1.0

> **200 star⭐** 了, 继续给大伙儿助兴~近期，在我的"怂恿"下，挺多人在我公众号点赞分享推荐助力了我，我都在后台看见了具体账号的鼓励数据，很多都成了天使轮老粉（我玩公众号才一个多月，虽然注册是七八年前的事了哈哈，属于上车早，发车晚），但因为你们没有留言或私信我，所以我也无法一一回应并感谢支持，在此一并谢谢！

1. 重要的更新，加了权重，你现在看到的新闻都是最热点最有关注度的出现在最上面
2. 更新文档使用，因为近期更新了很多功能，而且之前的使用文档我偷懒写的简单（见下面的 ⚙️ frequency_words.txt 配置完整教程）

### 2025/06/16 - v1.0.0

1. 增加了一个项目新版本更新提示，默认打开，如要关掉，可以在 main.py 中把 "FEISHU_SHOW_VERSION_UPDATE": True 中的 True 改成 False 即可

### 2025/06/13+14

1. 去掉了兼容代码，之前 fork 的同学，直接复制代码会在当天显示异常（第二天会恢复正常）
2. feishu 和 html 底部增加一个新增新闻显示

### 2025/06/09

**100 star⭐** 了，写个小功能给大伙儿助助兴
frequency_words.txt 文件增加了一个【必须词】功能，使用 + 号

1. 必须词语法如下：  
   唐僧或者猪八戒必须在标题里同时出现，才会收录到推送新闻中

```
+唐僧
+猪八戒
```

2. 过滤词的优先级更高：  
   如果标题中过滤词匹配到唐僧念经，那么即使必须词里有唐僧，也不显示

```
+唐僧
!唐僧念经
```

### 2025/06/02

1. **网页**和**飞书消息**支持手机直接跳转详情新闻
2. 优化显示效果 + 1

### 2025/05/26

1. 飞书消息显示效果优化

<table>
<tr>
<td align="center">
优化前<br>
<img src="_image/before.jpg" alt="飞书消息界面 - 优化前" width="400"/>
</td>
<td align="center">
优化后<br>
<img src="_image/after.jpg" alt="飞书消息界面 - 优化后" width="400"/>
</td>
</tr>
</table>

</details>


## 🚀 快速开始

> **📖 提醒**：Fork 用户建议先 **[查看最新官方文档](https://github.com/sansan0/TrendRadar?tab=readme-ov-file)**，确保配置步骤是最新的。

1. **Fork 本项目**到你的 GitHub 账户

   - 点击本页面右上角的"Fork"按钮

2. **设置 GitHub Secrets（选择你需要的平台）**:

   在你 Fork 后的仓库中，进入 `Settings` > `Secrets and variables` > `Actions` > `New repository secret`

   **📌 重要说明（请务必仔细阅读）：**

   - ✅ **一个 Name 对应一个 Secret**：每添加一个配置项，点击一次"New repository secret"按钮，填写一对"Name"和"Secret"
   - ✅ **保存后看不到值是正常的**：出于安全考虑，保存后重新编辑时，只能看到 Name（名称），看不到 Secret（值）的内容
   - ⚠️ **严禁自创名称**：Secret 的 Name（名称）必须**严格使用**下方列出的名称（如 `WEWORK_WEBHOOK_URL`、`FEISHU_WEBHOOK_URL` 等），不能自己随意修改或创造新名称，否则系统无法识别
   - 💡 **可以同时配置多个平台**：系统会向所有配置的平台发送通知

   **配置示例：**

   <img src="_image/secrets.png" alt="GitHub Secrets 配置示例"/>

   如上图所示，每一行是一个配置项：
   - **Name（名称）**：必须使用下方展开内容中列出的固定名称（如 `WEWORK_WEBHOOK_URL`）
   - **Secret（值）**：填写你从对应平台获取的实际内容（如 Webhook 地址、Token 等）

   <br>


   <details>
   <summary>👉 点击展开：<strong>企业微信机器人</strong>（配置最简单最迅速）</summary>
   <br>

   **GitHub Secret 配置（⚠️ Name 名称必须严格一致）：**
   - **Name（名称）**：`WEWORK_WEBHOOK_URL`（请复制粘贴此名称，不要手打，避免打错）
   - **Secret（值）**：你的企业微信机器人 Webhook 地址

   <br>

   **机器人设置步骤：**

   #### 手机端设置：
   1. 打开企业微信 App → 进入目标内部群聊
   2. 点击右上角"…"按钮 → 选择"消息推送"
   3. 点击"添加" → 名称输入"TrendRadar"
   4. 复制 Webhook 地址，点击保存，复制的内容配置到上方的 GitHub Secret 中

   #### PC 端设置流程类似
   </details>

   <details>
   <summary>👉 点击展开：<strong>个人微信推送</strong>（基于企业微信应用，推送到个人微信）</summary>
   <br>

   > 由于该方案是基于企业微信的插件机制，推送样式为纯文本（无 markdown 格式），但可以直接推送到个人微信，无需安装企业微信 App。

   **GitHub Secret 配置（⚠️ Name 名称必须严格一致）：**
   - **Name（名称）**：`WEWORK_WEBHOOK_URL`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：你的企业微信应用 Webhook 地址

   - **Name（名称）**：`WEWORK_MSG_TYPE`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：`text`

   <br>

   **设置步骤：**

   1. 完成上方的企业微信机器人 Webhook 设置
   2. 添加 `WEWORK_MSG_TYPE` Secret，值设为 `text`
   3. 按照下面图片操作，关联个人微信
   4. 配置好后，手机上的企业微信 App 可以删除

   <img src="_image/wework.png" title="个人微信推送配置"/>

   **说明**：
   - 与企业微信机器人使用相同的 Webhook 地址
   - 区别在于消息格式：`text` 为纯文本，`markdown` 为富文本（默认）
   - 纯文本格式会自动去除所有 markdown 语法（粗体、链接等）

   </details>

   <details>
   <summary>👉 点击展开：<strong>飞书机器人</strong>（消息显示最友好）</summary>
   <br>

   **GitHub Secret 配置（⚠️ Name 名称必须严格一致）：**
   - **Name（名称）**：`FEISHU_WEBHOOK_URL`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：你的飞书机器人 Webhook 地址（该链接开头类似 https://www.feishu.cn/flow/api/trigger-webhook/********）
   <br>

   有两个方案，**方案一**配置简单，**方案二**配置复杂(但是稳定推送)

   其中方案一，由 **ziventian**发现并提供建议，在这里感谢他，默认是个人推送，也可以配置群组推送操作[#97](https://github.com/sansan0/TrendRadar/issues/97) ，

   **方案一：**

   > 对部分人存在额外操作，否则会报"系统错误"。需要手机端搜索下机器人，然后开启飞书机器人应用(该建议来自于网友，可参考)

   1. 电脑浏览器打开 https://botbuilder.feishu.cn/home/my-command

   2. 点击"新建机器人指令" 

   3. 点击"选择触发器"，往下滑动，点击"Webhook 触发"

   4. 此时你会看到"Webhook 地址"，把这个链接先复制到本地记事本暂存，继续接下来的操作

   5. "参数"里面放上下面的内容，然后点击"完成"

   ```json
   {
     "message_type": "text",
     "content": {
       "total_titles": "{{内容}}",
       "timestamp": "{{内容}}",
       "report_type": "{{内容}}",
       "text": "{{内容}}"
     }
   }
   ```

   6. 点击"选择操作" > "通过官方机器人发消息"

   7. 消息标题填写"TrendRadar 热点监控"

   8. 最关键的部分来了，点击 + 按钮，选择"Webhook 触发"，然后按照下面的图片摆放

   ![飞书机器人配置示例](_image/image.png)

   9. 配置完成后，将第 4 步复制的 Webhook 地址配置到 GitHub Secrets 中的 `FEISHU_WEBHOOK_URL`

   <br>

   **方案二：**

   1. 电脑浏览器打开 https://botbuilder.feishu.cn/home/my-app

   2. 点击"新建机器人应用"

   3. 进入创建的应用后，点击"流程涉及" > "创建流程" > "选择触发器"

   4. 往下滑动，点击"Webhook 触发"

   5. 此时你会看到"Webhook 地址"，把这个链接先复制到本地记事本暂存，继续接下来的操作

   6. "参数"里面放上下面的内容，然后点击"完成"

   ```json
   {
     "message_type": "text",
     "content": {
       "total_titles": "{{内容}}",
       "timestamp": "{{内容}}",
       "report_type": "{{内容}}",
       "text": "{{内容}}"
     }
   }
   ```

   7. 点击"选择操作" > "发送飞书消息"，勾选 "群消息"，然后点击下面的输入框，点击"我管理的群组"（如果没有群组，你可以在飞书 app 上创建群组）

   8. 消息标题填写"TrendRadar 热点监控"

   9. 最关键的部分来了，点击 + 按钮，选择"Webhook 触发"，然后按照下面的图片摆放

   ![飞书机器人配置示例](_image/image.png)

   10. 配置完成后，将第 5 步复制的 Webhook 地址配置到 GitHub Secrets 中的 `FEISHU_WEBHOOK_URL`

   </details>

   <details>
   <summary>👉 点击展开：<strong>钉钉机器人</strong></summary>
   <br>

   **GitHub Secret 配置（⚠️ Name 名称必须严格一致）：**
   - **Name（名称）**：`DINGTALK_WEBHOOK_URL`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：你的钉钉机器人 Webhook 地址

   <br>

   **机器人设置步骤：**

   1. **创建机器人（仅 PC 端支持）**：
      - 打开钉钉 PC 客户端，进入目标群聊
      - 点击群设置图标（⚙️）→ 往下翻找到"机器人"点开
      - 选择"添加机器人" → "自定义"

   2. **配置机器人**：
      - 设置机器人名称
      - **安全设置**：
        - **自定义关键词**：设置 "热点"

   3. **完成设置**：
      - 勾选服务条款协议 → 点击"完成"
      - 复制获得的 Webhook URL
      - 将 URL 配置到 GitHub Secrets 中的 `DINGTALK_WEBHOOK_URL`

   **注意**：移动端只能接收消息，无法创建新机器人。
   </details>

   <details>
   <summary>👉 点击展开：<strong>Telegram Bot</strong></summary>
   <br>

   **GitHub Secret 配置（⚠️ Name 名称必须严格一致）：**
   - **Name（名称）**：`TELEGRAM_BOT_TOKEN`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：你的 Telegram Bot Token

   - **Name（名称）**：`TELEGRAM_CHAT_ID`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：你的 Telegram Chat ID

   **说明**：Telegram 需要配置**两个** Secret，请分别点击两次"New repository secret"按钮添加

   <br>

   **机器人设置步骤：**

   1. **创建机器人**：
      - 在 Telegram 中搜索 `@BotFather`（大小写注意，有蓝色徽章勾勾，有类似 37849827 monthly users，这个才是官方的，有一些仿官方的账号注意辨别）
      - 发送 `/newbot` 命令创建新机器人
      - 设置机器人名称（必须以"bot"结尾，很容易遇到重复名字，所以你要绞尽脑汁想不同的名字）
      - 获取 Bot Token（格式如：`123456789:AAHfiqksKZ8WmR2zSjiQ7_v4TMAKdiHm9T0`）

   2. **获取 Chat ID**：

      **方法一：通过官方 API 获取**
      - 先向你的机器人发送一条消息
      - 访问：`https://api.telegram.org/bot<你的Bot Token>/getUpdates`
      - 在返回的 JSON 中找到 `"chat":{"id":数字}` 中的数字

      **方法二：使用第三方工具**
      - 搜索 `@userinfobot` 并发送 `/start`
      - 获取你的用户 ID 作为 Chat ID

   3. **配置到 GitHub**：
      - `TELEGRAM_BOT_TOKEN`：填入第 1 步获得的 Bot Token
      - `TELEGRAM_CHAT_ID`：填入第 2 步获得的 Chat ID
   </details>

   <details>
   <summary>👉 点击展开：<strong>邮件推送</strong>（支持所有主流邮箱）</summary>
   <br>

   - 注意事项：为防止邮件群发功能被**滥用**，当前的群发是所有收件人都能看到彼此的邮箱地址。
   - 如果你没有过配置下面这种邮箱发送的经历，不建议尝试 

   <br>

   **GitHub Secret 配置（⚠️ Name 名称必须严格一致）：**
   - **Name（名称）**：`EMAIL_FROM`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：发件人邮箱地址

   - **Name（名称）**：`EMAIL_PASSWORD`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：邮箱密码或授权码

   - **Name（名称）**：`EMAIL_TO`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：收件人邮箱地址（多个收件人用英文逗号分隔，也可以和 EMAIL_FROM 一样，自己发送给自己）

   - **Name（名称）**：`EMAIL_SMTP_SERVER`（可选配置，请复制粘贴此名称）
   - **Secret（值）**：SMTP服务器地址（可留空，系统会自动识别）

   - **Name（名称）**：`EMAIL_SMTP_PORT`（可选配置，请复制粘贴此名称）
   - **Secret（值）**：SMTP端口（可留空，系统会自动识别）

   **说明**：邮件推送需要配置至少**3个必需** Secret（EMAIL_FROM、EMAIL_PASSWORD、EMAIL_TO），后两个为可选配置

   <br>

   **支持的邮箱服务商**（自动识别 SMTP 配置）：

   | 邮箱服务商 | 域名 | SMTP 服务器 | 端口 | 加密方式 |
   |-----------|------|------------|------|---------|
   | **Gmail** | gmail.com | smtp.gmail.com | 587 | TLS |
   | **QQ邮箱** | qq.com | smtp.qq.com | 465 | SSL |
   | **Outlook** | outlook.com | smtp-mail.outlook.com | 587 | TLS |
   | **Hotmail** | hotmail.com | smtp-mail.outlook.com | 587 | TLS |
   | **Live** | live.com | smtp-mail.outlook.com | 587 | TLS |
   | **163邮箱** | 163.com | smtp.163.com | 465 | SSL |
   | **126邮箱** | 126.com | smtp.126.com | 465 | SSL |
   | **新浪邮箱** | sina.com | smtp.sina.com | 465 | SSL |
   | **搜狐邮箱** | sohu.com | smtp.sohu.com | 465 | SSL |
   | **天翼邮箱** | 189.cn | smtp.189.cn | 465 | SSL |
   | **阿里云邮箱** | aliyun.com | smtp.aliyun.com | 465 | TLS |

   > **自动识别**：使用以上邮箱时，无需手动配置 `EMAIL_SMTP_SERVER` 和 `EMAIL_SMTP_PORT`，系统会自动识别。
   >
   > **反馈说明**：
   > - 如果你使用**其他邮箱**测试成功，欢迎开 [Issues](https://github.com/sansan0/TrendRadar/issues) 告知，我会添加到支持列表
   > - 如果上述邮箱配置有误或无法使用，也请开 [Issues](https://github.com/sansan0/TrendRadar/issues) 反馈，帮助改进项目
   >
   > **特别感谢**：
   > - 感谢 [@DYZYD](https://github.com/DYZYD) 贡献天翼邮箱（189.cn）配置并完成自发自收测试 ([#291](https://github.com/sansan0/TrendRadar/issues/291))
   > - 感谢 [@longzhenren](https://github.com/longzhenren) 贡献阿里云邮箱（aliyun.com）配置并完成测试 ([#344](https://github.com/sansan0/TrendRadar/issues/344))

   **常见邮箱设置：**

   #### QQ邮箱：
   1. 登录 QQ邮箱网页版 → 设置 → 账户
   2. 开启 POP3/SMTP 服务
   3. 生成授权码（16位字母）
   4. `EMAIL_PASSWORD` 填写授权码，而非 QQ 密码

   #### Gmail：
   1. 开启两步验证
   2. 生成应用专用密码
   3. `EMAIL_PASSWORD` 填写应用专用密码

   #### 163/126邮箱：
   1. 登录网页版 → 设置 → POP3/SMTP/IMAP
   2. 开启 SMTP 服务
   3. 设置客户端授权码
   4. `EMAIL_PASSWORD` 填写授权码
   <br>

   **高级配置**：
   如果自动识别失败，可手动配置 SMTP：
   - `EMAIL_SMTP_SERVER`：如 smtp.gmail.com
   - `EMAIL_SMTP_PORT`：如 587（TLS）或 465（SSL）
   <br>

   **如果有多个收件人(注意是英文逗号分隔)**：
   - EMAIL_TO="user1@example.com,user2@example.com,user3@example.com"

   </details>

   <details>
   <summary>👉 点击展开：<strong>ntfy 推送</strong>（开源免费，支持自托管）</summary>
   <br>

   **两种使用方式：**

   ### 方式一：免费使用（推荐新手） 🆓

   **特点**：
   - ✅ 无需注册账号，立即使用
   - ✅ 每天 250 条消息（足够 90% 用户）
   - ✅ Topic 名称即"密码"（需选择不易猜测的名称）
   - ⚠️ 消息未加密，不适合敏感信息, 但适合我们这个项目的不敏感信息

   **快速开始：**

   1. **下载 ntfy 应用**：
      - Android：[Google Play](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [F-Droid](https://f-droid.org/en/packages/io.heckel.ntfy/)
      - iOS：[App Store](https://apps.apple.com/us/app/ntfy/id1625396347)
      - 桌面：访问 [ntfy.sh](https://ntfy.sh)

   2. **订阅主题**（选择一个难猜的名称）：
      ```
      建议格式：trendradar-{你的名字缩写}-{随机数字}
   
      不能使用中文
      
      ✅ 好例子：trendradar-zs-8492
      ❌ 坏例子：news、alerts（太容易被猜到）
      ```

   3. **配置 GitHub Secret（⚠️ Name 名称必须严格一致）**：
      - **Name（名称）**：`NTFY_TOPIC`（请复制粘贴此名称，不要手打）
      - **Secret（值）**：填写你刚才订阅的主题名称

      - **Name（名称）**：`NTFY_SERVER_URL`（可选配置，请复制粘贴此名称）
      - **Secret（值）**：留空（默认使用 ntfy.sh）

      - **Name（名称）**：`NTFY_TOKEN`（可选配置，请复制粘贴此名称）
      - **Secret（值）**：留空

      **说明**：ntfy 至少需要配置 1 个必需 Secret (NTFY_TOPIC)，后两个为可选配置

   4. **测试**：
      ```bash
      curl -d "测试消息" ntfy.sh/你的主题名称
      ```

   ---

   ### 方式二：自托管（完全隐私控制） 🔒

   **适合人群**：有服务器、追求完全隐私、技术能力强

   **优势**：
   - ✅ 完全开源（Apache 2.0 + GPLv2）
   - ✅ 数据完全自主控制
   - ✅ 无任何限制
   - ✅ 零费用

   **Docker 一键部署**：
   ```bash
   docker run -d \
     --name ntfy \
     -p 80:80 \
     -v /var/cache/ntfy:/var/cache/ntfy \
     binwiederhier/ntfy \
     serve --cache-file /var/cache/ntfy/cache.db
   ```

   **配置 TrendRadar**：
   ```yaml
   NTFY_SERVER_URL: https://ntfy.yourdomain.com
   NTFY_TOPIC: trendradar-alerts  # 自托管可用简单名称
   NTFY_TOKEN: tk_your_token  # 可选：启用访问控制
   ```

   **在应用中订阅**：
   - 点击"Use another server"
   - 输入你的服务器地址
   - 输入主题名称
   - （可选）输入登录凭据

   ---

   **常见问题：**

   <details>
   <summary><strong>Q1: 免费版够用吗？</strong></summary>

   每天 250 条消息对大多数用户足够。按 30 分钟抓取一次计算，每天约 48 次推送，完全够用。
   </details>

   <details>
   <summary><strong>Q2: Topic 名称真的安全吗？</strong></summary>

   如果你选择随机的、足够长的名称（如 `trendradar-zs-8492-news`），暴力破解几乎不可能：
   - ntfy 有严格的速率限制（1 秒 1 次请求）
   - 64 个字符选择（A-Z, a-z, 0-9, _, -）
   - 10 位随机字符串有 64^10 种可能性（需要数年才能破解）
   </details>

   ---

   **推荐选择：**

   | 用户类型 | 推荐方案 | 理由 |
   |---------|---------|------|
   | 普通用户 | 方式一（免费） | 简单快速，够用 |
   | 技术用户 | 方式二（自托管） | 完全控制，无限制 |
   | 高频用户 | 方式三（付费） | 这个自己去官网看吧 |

   **相关链接：**
   - [ntfy 官方文档](https://docs.ntfy.sh/)
   - [自托管教程](https://docs.ntfy.sh/install/)
   - [GitHub 仓库](https://github.com/binwiederhier/ntfy)

   </details>

   <details>
   <summary>👉 点击展开：<strong>Bark 推送</strong>（iOS 专属，简洁高效）</summary>
   <br>

   **GitHub Secret 配置（⚠️ Name 名称必须严格一致）：**
   - **Name（名称）**：`BARK_URL`（请复制粘贴此名称，不要手打）
   - **Secret（值）**：你的 Bark 推送 URL

   <br>

   **Bark 简介：**

   Bark 是一款 iOS 平台的免费开源推送工具，特点是简单、快速、无广告。

   **使用方式：**

   ### 方式一：使用官方服务器（推荐新手） 🆓

   1. **下载 Bark App**：
      - iOS：[App Store](https://apps.apple.com/cn/app/bark-给你的手机发推送/id1403753865)

   2. **获取推送 URL**：
      - 打开 Bark App
      - 复制首页显示的推送 URL（格式如：`https://api.day.app/your_device_key`）
      - 将 URL 配置到 GitHub Secrets 中的 `BARK_URL`

   ### 方式二：自建服务器（完全隐私控制） 🔒

   **适合人群**：有服务器、追求完全隐私、技术能力强

   **Docker 一键部署**：
   ```bash
   docker run -d \
     --name bark-server \
     -p 8080:8080 \
     finab/bark-server
   ```

   **配置 TrendRadar**：
   ```yaml
   BARK_URL: http://your-server-ip:8080/your_device_key
   ```

   ---

   **注意事项：**
   - ✅ Bark 使用 APNs 推送，单条消息最大 4KB
   - ✅ 支持自动分批推送，无需担心消息过长
   - ✅ 推送格式为纯文本（自动去除 Markdown 语法）
   - ⚠️ 仅支持 iOS 平台

   **相关链接：**
   - [Bark 官方网站](https://bark.day.app/)
   - [Bark GitHub 仓库](https://github.com/Finb/Bark)
   - [Bark Server 自建教程](https://github.com/Finb/bark-server)

   </details>

3. **手动测试新闻推送**：

   > 💡 **完成第1-2步后，请立即测试！** 测试成功后再根据需要调整配置（第4步）。
   >
   > ⚠️ **重要提醒：请进入你自己 fork 的项目，不是本项目！**

   **如何找到你的 Actions 页面**：

   - **方法一**：打开你 fork 的项目主页，点击顶部的 **Actions** 标签
   - **方法二**：直接访问 `https://github.com/你的用户名/TrendRadar/actions`

   **示例对比**：
   - ❌ 作者的项目：`https://github.com/sansan0/TrendRadar/actions`
   - ✅ 你的项目：`https://github.com/你的用户名/TrendRadar/actions`

   **测试步骤**：
   1. 进入你项目的 Actions 页面
   2. 找到 **"Hot News Crawler"** 点进去
      - 如果看不到该字样，参照 [#109](https://github.com/sansan0/TrendRadar/issues/109) 解决
   3. 点击右侧的 **"Run workflow"** 按钮运行
   4. 等待 1 分钟左右，消息会推送到你配置的平台

4. **配置说明（可选）**：

    > 💡 默认配置已可正常使用，如需个性化调整，可参考以下选项

    - **推送设置**：在 [config/config.yaml](config/config.yaml) 中配置推送模式和通知选项
    - **关键词设置**：在 [config/frequency_words.txt](config/frequency_words.txt) 中添加你关心的关键词
    - **推送频率调整**：在 [.github/workflows/crawler.yml](.github/workflows/crawler.yml) 请谨慎调整，别贪心

    **注意**：建议只调整文档中明确说明的配置项,其他选项主要供作者开发时测试使用

5. **🎉 部署成功！分享你的使用体验**

   恭喜你完成了 TrendRadar 的配置！现在你可以开始追踪热点资讯了。

   💬 **有更多小伙伴在公众号交流使用心得，期待你的分享~**

   - 想了解更多玩法和高级技巧？
   - 遇到问题需要快速解答？
   - 有好的想法想要交流？

   👉 **欢迎关注公众号「硅基茶水间」**，你的点赞和留言都是项目持续更新的动力。

   详细的交流方式，请查看 → [问题答疑与交流](#问题答疑与交流)

6. **想要更智能的分析？试试 AI 增强功能**（可选）

   基础配置已经能满足日常使用，但如果你想要：

   - 📊 让 AI 自动分析热点趋势和数据洞察
   - 🔍 通过自然语言搜索和查询新闻
   - 💡 获得情感分析、话题预测等深度分析
   - ⚡ 在 Claude、Cursor 等 AI 工具中直接调用数据

   👉 **了解更多**：[AI 智能分析](#-ai-智能分析) — 解锁项目的隐藏能力，让热点追踪更高效！


<a name="配置详解"></a>

## ⚙️ 配置详解

> **📖 提醒**：本章节提供详细的配置说明，建议先完成 [快速开始](#-快速开始) 的基础配置，再根据需要回来查看详细选项。

### 1. 平台配置

<details id="自定义监控平台">
<summary>👉 点击展开：<strong>自定义监控平台</strong></summary>
<br>

本项目的资讯数据来源于 [newsnow](https://github.com/ourongxing/newsnow) ，你可以点击[网站](https://newsnow.busiyi.world/)，点击[更多]，查看是否有你想要的平台。

具体添加可访问 [项目源代码](https://github.com/ourongxing/newsnow/tree/main/server/sources)，根据里面的文件名，在 `config/config.yaml` 文件中修改 `platforms` 配置：

```yaml
platforms:
  - id: "toutiao"
    name: "今日头条"
  - id: "baidu"
    name: "百度热搜"
  - id: "wallstreetcn-hot"
    name: "华尔街见闻"
  # 添加更多平台...
```
如果不会看的话，就直接复制他人整理好的部分[平台配置](https://github.com/sansan0/TrendRadar/issues/95)

</details>

### 2. 关键词配置

在 `frequency_words.txt` 文件中配置监控的关键词，支持四种语法和词组功能。

| 语法类型 | 符号 | 作用 | 示例 | 匹配逻辑 |
|---------|------|------|------|---------|
| **普通词** | 无 | 基础匹配 | `华为` | 包含任意一个即可 |
| **必须词** | `+` | 限定范围 | `+手机` | 必须同时包含 |
| **过滤词** | `!` | 排除干扰 | `!广告` | 包含则直接排除 |
| **数量限制** | `@` | 控制显示数量 | `@10` | 最多显示10条新闻（v3.2.0新增） |

#### 2.1 基础语法

<a name="关键词基础语法"></a>

<details>
<summary>👉 点击展开：<strong>基础语法教程</strong></summary>
<br>

##### 1. **普通关键词** - 基础匹配
```txt
华为
OPPO
苹果
```
**作用：** 新闻标题包含其中**任意一个词**就会被捕获

##### 2. **必须词** `+词汇` - 限定范围
```txt
华为
OPPO
+手机
```
**作用：** 必须同时包含普通词**和**必须词才会被捕获

##### 3. **过滤词** `!词汇` - 排除干扰
```txt
苹果
华为
!水果
!价格
```
**作用：** 包含过滤词的新闻会被**直接排除**，即使包含关键词

##### 4. **数量限制** `@数字` - 控制显示数量（v3.2.0 新增）
```txt
特斯拉
马斯克
@5
```
**作用：** 限制该关键词组最多显示的新闻条数

**配置优先级：** `@数字` > 全局配置 > 不限制

---

#### 🔗 词组功能 - 空行分隔的重要作用

**核心规则：** 用**空行**分隔不同的词组，每个词组独立统计

##### 示例配置：
```txt
iPhone
华为
OPPO
+发布

A股
上证
深证
+涨跌
!预测

世界杯
欧洲杯
亚洲杯
+比赛
```

##### 词组解释及匹配效果：

**第1组 - 手机新品类：**
- 关键词：iPhone、华为、OPPO
- 必须词：发布
- 效果：必须包含手机品牌名，同时包含"发布"

**匹配示例：**
- ✅ "iPhone 15正式发布售价公布" ← 有"iPhone"+"发布"
- ✅ "华为Mate60系列发布会直播" ← 有"华为"+"发布"
- ✅ "OPPO Find X7发布时间确定" ← 有"OPPO"+"发布"
- ❌ "iPhone销量创新高" ← 有"iPhone"但缺少"发布"

**第2组 - 股市行情类：**
- 关键词：A股、上证、深证
- 必须词：涨跌
- 过滤词：预测
- 效果：关注股市涨跌实况，排除预测类内容

**匹配示例：**
- ✅ "A股今日大幅涨跌分析" ← 有"A股"+"涨跌"
- ✅ "上证指数涨跌幅创新高" ← 有"上证"+"涨跌"
- ❌ "专家预测A股涨跌趋势" ← 有"A股"+"涨跌"但包含"预测"

**第3组 - 足球赛事类：**
- 关键词：世界杯、欧洲杯、亚洲杯
- 必须词：比赛
- 效果：只关注比赛相关新闻

---

#### 📝 配置技巧

##### 1. **从宽到严**
```txt
# 第一步：先用宽泛关键词测试
人工智能
AI
ChatGPT

# 第二步：发现误匹配后，加入必须词限定
人工智能
AI
ChatGPT
+技术

# 第三步：发现干扰内容后，加入过滤词
人工智能
AI
ChatGPT
+技术
!广告
!培训
```

##### 2. **避免过度复杂**

❌ **不推荐：** 一个词组包含太多词汇
```txt
华为
OPPO
苹果
三星
vivo
一加
魅族
+手机
+发布
+销量
!假货
!维修
!二手
```

✅ **推荐：** 拆分成多个精确的词组
```txt
华为
OPPO
+新品

苹果
三星
+发布

手机
销量
+市场
```

</details>

#### 2.2 高级配置（v3.2.0 新增）

<a name="关键词高级配置"></a>

<details>
<summary>👉 点击展开：<strong>高级配置教程</strong></summary>
<br>

##### 关键词排序优先级

**配置位置：** `config/config.yaml`

```yaml
report:
  sort_by_position_first: false  # 排序优先级配置
```

| 配置值 | 排序规则 | 适用场景 |
|--------|---------|---------|
| `false`（默认） | 热点条数 ↓ → 配置位置 ↑ | 关注热度趋势 |
| `true` | 配置位置 ↑ → 热点条数 ↓ | 关注个人优先级 |

**示例：** 配置顺序 A、B、C，热点数 A(3条)、B(10条)、C(5条)
- `false`：B(10条) → C(5条) → A(3条)
- `true`：A(3条) → B(10条) → C(5条)

##### 全局显示数量限制

```yaml
report:
  max_news_per_keyword: 10  # 每个关键词最多显示10条（0=不限制）
```

**Docker 环境变量：**
```bash
SORT_BY_POSITION_FIRST=true
MAX_NEWS_PER_KEYWORD=10
```

**综合示例：**
```yaml
# config.yaml
report:
  sort_by_position_first: true   # 按配置顺序优先
  max_news_per_keyword: 10       # 全局默认每个关键词最多10条
```

```txt
# frequency_words.txt
特斯拉
马斯克
@20              # 重点关注，显示20条（覆盖全局配置）

华为            # 使用全局配置，显示10条

比亚迪
@5               # 限制5条
```

**最终效果：** 按配置顺序显示 特斯拉(20条) → 华为(10条) → 比亚迪(5条)

</details>

### 3. 推送模式详解

<details>
<summary>👉 点击展开：<strong>三种推送模式详细对比</strong></summary>
<br>

#### 详细对比表格

| 模式 | 适用人群 | 推送时机 | 显示内容 | 典型使用场景 |
|------|----------|----------|----------|------------|
| **当日汇总**<br/>`daily` | 📋 企业管理者/普通用户 | 按时推送(默认每小时推送一次) | 当日所有匹配新闻<br/>+ 新增新闻区域 | **案例**：每天下午6点查看今天所有重要新闻<br/>**特点**：看全天完整趋势，不漏掉任何热点<br/>**提醒**：会包含之前推送过的新闻 |
| **当前榜单**<br/>`current` | 📰 自媒体人/内容创作者 | 按时推送(默认每小时推送一次) | 当前榜单匹配新闻<br/>+ 新增新闻区域 | **案例**：每小时追踪"哪些话题现在最火"<br/>**特点**：实时了解当前热度排名变化<br/>**提醒**：持续在榜的新闻每次都会出现 |
| **增量监控**<br/>`incremental` | 📈 投资者/交易员 | 有新增才推送 | 新出现的匹配频率词新闻 | **案例**：监控"特斯拉"，只在有新消息时通知<br/>**特点**：零重复，只看首次出现的新闻<br/>**适合**：高频监控、避免信息打扰 |

#### 实际推送效果举例

假设你监控"苹果"关键词，每小时执行一次：

| 时间 | daily 模式推送 | current 模式推送 | incremental 模式推送 |
|-----|--------------|----------------|-------------------|
| 10:00 | 新闻A、新闻B | 新闻A、新闻B | 新闻A、新闻B |
| 11:00 | 新闻A、新闻B、新闻C | 新闻B、新闻C、新闻D | **仅**新闻C |
| 12:00 | 新闻A、新闻B、新闻C | 新闻C、新闻D、新闻E | **仅**新闻D、新闻E |

**说明**：
- `daily`：累积展示当天所有新闻（A、B、C 都保留）
- `current`：展示当前榜单的新闻（排名变化，新闻D上榜，新闻A掉榜）
- `incremental`：**只推送新出现的新闻**（避免重复干扰）

#### 常见问题

> **💡 遇到这个问题？** 👉 "每个小时执行一次，第一次执行完输出的新闻，在下一个小时执行时还会出现"
> - **原因**：你可能选择了 `daily`（当日汇总）或 `current`（当前榜单）模式
> - **解决**：改用 `incremental`（增量监控）模式，只推送新增内容

</details>

### 4. 热点权重调整

<details>
<summary>👉 点击展开：<strong>热点权重调整</strong></summary>
<br>

当前默认的配置是平衡性配置

#### 两个核心场景

**追实时热点型**：
```yaml
weight:
  rank_weight: 0.8    # 主要看排名
  frequency_weight: 0.1  # 不太在乎持续性
  hotness_weight: 0.1
```
**适用人群**：自媒体博主、营销人员、想快速了解当下最火话题的用户

**追深度话题型**：
```yaml
weight:
  rank_weight: 0.4    # 适度看排名
  frequency_weight: 0.5  # 重视当天内的持续热度
  hotness_weight: 0.1
```
**适用人群**：投资者、研究人员、新闻工作者、需要深度分析趋势的用户

#### 调整的方法
1. **三个数字加起来必须等于 1.0**
2. **哪个重要就调大哪个**：在乎排名就调大 rank_weight，在乎持续性就调大 frequency_weight
3. **建议每次只调 0.1-0.2**，观察效果

核心思路：追求速度和时效性的用户提高排名权重，追求深度和稳定性的用户提高频次权重。

</details>

### 5. 推送格式参考

<details>
<summary>👉 点击展开：<strong>推送格式说明</strong></summary>
<br>

#### 推送示例

📊 热点词汇统计

🔥 [1/3] AI ChatGPT : 2 条

  1. [百度热搜] 🆕 ChatGPT-5正式发布 [**1**] - 09时15分 (1次)

  2. [今日头条] AI芯片概念股暴涨 [**3**] - [08时30分 ~ 10时45分] (3次)

━━━━━━━━━━━━━━━━━━━

📈 [2/3] 比亚迪 特斯拉 : 2 条

  1. [微博] 🆕 比亚迪月销量破纪录 [**2**] - 10时20分 (1次)

  2. [抖音] 特斯拉降价促销 [**4**] - [07时45分 ~ 09时15分] (2次)

━━━━━━━━━━━━━━━━━━━

📌 [3/3] A股 股市 : 1 条

  1. [华尔街见闻] A股午盘点评分析 [**5**] - [11时30分 ~ 12时00分] (2次)

🆕 本次新增热点新闻 (共 2 条)

**百度热搜** (1 条):
  1. ChatGPT-5正式发布 [**1**]

**微博** (1 条):
  1. 比亚迪月销量破纪录 [**2**]

更新时间：2025-01-15 12:30:15

#### 消息格式说明

| 格式元素      | 示例                        | 含义         | 说明                                    |
| ------------- | --------------------------- | ------------ | --------------------------------------- |
| 🔥📈📌        | 🔥 [1/3] AI ChatGPT        | 热度等级     | 🔥高热度(≥10条) 📈中热度(5-9条) 📌普通热度(<5条) |
| [序号/总数]   | [1/3]                       | 排序位置     | 当前词组在所有匹配词组中的排名          |
| 频率词组      | AI ChatGPT                  | 关键词组     | 配置文件中的词组，标题必须包含其中词汇   |
| : N 条        | : 2 条                      | 匹配数量     | 该词组匹配的新闻总数                    |
| [平台名]      | [百度热搜]                  | 来源平台     | 新闻所属的平台名称                      |
| 🆕            | 🆕 ChatGPT-5正式发布        | 新增标记     | 本轮抓取中首次出现的热点                |
| [**数字**]    | [**1**]                     | 高排名       | 排名≤阈值的热搜，红色加粗显示           |
| [数字]        | [7]                         | 普通排名     | 排名>阈值的热搜，普通显示               |
| - 时间        | - 09时15分                  | 首次时间     | 该新闻首次被发现的时间                  |
| [时间~时间]   | [08时30分 ~ 10时45分]       | 持续时间     | 从首次出现到最后出现的时间范围          |
| (N次)         | (3次)                       | 出现频率     | 在监控期间出现的总次数                  |
| **新增区域**  | 🆕 **本次新增热点新闻**      | 新话题汇总   | 单独展示本轮新出现的热点话题            |

</details>


## 🐳 Docker 部署

#### 方式一：快速体验（一行命令）

**Linux/macOS 系统：**
```bash
# 创建配置目录并下载配置文件
mkdir -p config output
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/
```
或者**手动创建**：
1. 在当前目录创建 `config` 文件夹
2. 下载配置文件：
   - 访问 https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml → 右键"另存为" → 保存到 `config\config.yaml`
   - 访问 https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt → 右键"另存为" → 保存到 `config\frequency_words.txt`

完成后的目录结构应该是：
```
当前目录/
└── config/
    ├── config.yaml
    └── frequency_words.txt
```

```bash
docker run -d --name trend-radar \
  -v ./config:/app/config:ro \
  -v ./output:/app/output \
  -e FEISHU_WEBHOOK_URL="你的飞书webhook" \
  -e DINGTALK_WEBHOOK_URL="你的钉钉webhook" \
  -e WEWORK_WEBHOOK_URL="你的企业微信webhook" \
  -e TELEGRAM_BOT_TOKEN="你的telegram_bot_token" \
  -e TELEGRAM_CHAT_ID="你的telegram_chat_id" \
  -e EMAIL_FROM="你的发件邮箱" \
  -e EMAIL_PASSWORD="你的邮箱密码或授权码" \
  -e EMAIL_TO="收件人邮箱" \
  -e CRON_SCHEDULE="*/30 * * * *" \
  -e RUN_MODE="cron" \
  -e IMMEDIATE_RUN="true" \
  wantcat/trendradar:latest
```

#### 方式二：使用 docker-compose（推荐）

1. **创建项目目录和配置**:
   ```bash
   # 创建目录结构
   mkdir -p trendradar/{config,docker}
   cd trendradar
   
   # 下载配置文件模板
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/
   
   # 下载 docker-compose 配置
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/.env
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/docker-compose.yml
   ```

完成后的目录结构应该是：
```
当前目录/
├── config/
│   ├── config.yaml
│   └── frequency_words.txt
└── docker/
    ├── .env
    └── docker-compose.yml
```

2. **配置文件说明**:
   - `config/config.yaml` - 应用主配置（报告模式、推送设置等）
   - `config/frequency_words.txt` - 关键词配置（设置你关心的热点词汇）
   - `.env` - 环境变量配置（webhook URLs 和定时任务）

   **⚙️ 环境变量覆盖机制（v3.0.5+）**

   如果你在 NAS 或其他 Docker 环境中遇到**修改 `config.yaml` 后配置不生效**的问题，可以通过环境变量直接覆盖配置：

   | 环境变量 | 对应配置 | 示例值 | 说明 |
   |---------|---------|-------|------|
   | `ENABLE_CRAWLER` | `crawler.enable_crawler` | `true` / `false` | 是否启用爬虫 |
   | `ENABLE_NOTIFICATION` | `notification.enable_notification` | `true` / `false` | 是否启用通知 |
   | `REPORT_MODE` | `report.mode` | `daily` / `incremental` / `current`| 报告模式 |
   | `PUSH_WINDOW_ENABLED` | `notification.push_window.enabled` | `true` / `false` | 推送时间窗口开关 |
   | `PUSH_WINDOW_START` | `notification.push_window.time_range.start` | `08:00` | 推送开始时间 |
   | `PUSH_WINDOW_END` | `notification.push_window.time_range.end` | `22:00` | 推送结束时间 |
   | `FEISHU_WEBHOOK_URL` | `notification.webhooks.feishu_url` | `https://...` | 飞书 Webhook |

   **配置优先级**：环境变量 > config.yaml

   **使用方法**：
   - 修改 `.env` 文件，取消注释并填写需要的配置
   - 或在 NAS/群晖 Docker 管理界面的"环境变量"中直接添加
   - 重启容器后生效：`docker-compose restart`


3. **启动服务**:
   ```bash
   # 拉取最新镜像并启动
   docker-compose pull
   docker-compose up -d
   ```

4. **查看运行状态**:
   ```bash
   # 查看日志
   docker logs -f trend-radar
   
   # 查看容器状态
   docker ps | grep trend-radar
   ```

#### 方式三：本地构建（开发者选项）

如果需要自定义修改代码或构建自己的镜像：

```bash
# 克隆项目
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar

# 修改配置文件
vim config/config.yaml
vim config/frequency_words.txt

# 使用构建版本的 docker-compose
cd docker
cp docker-compose-build.yml docker-compose.yml

# 构建并启动
docker-compose build
docker-compose up -d
```

#### 镜像更新

```bash
# 方式一：手动更新
docker pull wantcat/trendradar:latest
docker-compose down
docker-compose up -d

# 方式二：使用 docker-compose 更新
docker-compose pull
docker-compose up -d
```

#### 服务管理命令

```bash
# 查看运行状态
docker exec -it trend-radar python manage.py status

# 手动执行一次爬虫
docker exec -it trend-radar python manage.py run

# 查看实时日志
docker exec -it trend-radar python manage.py logs

# 显示当前配置
docker exec -it trend-radar python manage.py config

# 显示输出文件
docker exec -it trend-radar python manage.py files

# 查看帮助信息
docker exec -it trend-radar python manage.py help

# 重启容器
docker restart trend-radar

# 停止容器
docker stop trend-radar

# 删除容器（保留数据）
docker rm trend-radar
```

#### 数据持久化

生成的报告和数据默认保存在 `./output` 目录下，即使容器重启或删除，数据也会保留。

#### 故障排查

```bash
# 检查容器状态
docker inspect trend-radar

# 查看容器日志
docker logs --tail 100 trend-radar

# 进入容器调试
docker exec -it trend-radar /bin/bash

# 验证配置文件
docker exec -it trend-radar ls -la /app/config/
```


## 🤖 AI 智能分析

TrendRadar v3.0.0 新增了基于 **MCP (Model Context Protocol)** 的 AI 分析功能，让你可以通过自然语言与新闻数据对话，进行深度分析。


### ⚠️ 使用前必读


**重要提示：AI 功能需要本地新闻数据支持**

AI 分析功能**不是**直接查询网络实时数据，而是分析你**本地已积累的新闻数据**（存储在 `output` 文件夹中）


#### 使用说明：

1. **项目自带测试数据**：`output` 目录默认包含 **2025年11月1日～11月15日** 的新闻数据，可用于快速体验 AI 功能

2. **查询限制**：
   - ✅ 只能查询已有日期范围内的数据（11月1-15日）
   - ❌ 无法查询实时新闻或未来日期

3. **获取最新数据**：
   - 测试数据仅供快速体验，**建议自行部署项目**获取实时数据
   - 按照 [快速开始](#-快速开始) 部署运行项目
   - 等待至少 1 天积累新闻数据后，即可查询最新热点

---

### 1. 快速部署

Cherry Studio 提供 GUI 配置界面， 5 分钟快速部署， 复杂的部分是一键安装的。

**图文部署教程**：现已更新到我的[公众号](#问题答疑与交流)，回复 "mcp" 即可

**详细部署教程**：[README-Cherry-Studio.md](README-Cherry-Studio.md)

### 2. 学习与 AI 对话的姿势

**详细对话教程**：[README-MCP-FAQ.md](README-MCP-FAQ.md)

**提问效果**：

> 实际不建议一次性问多个问题。如果你选择的 ai 模型连下图的按顺序调用都无法做到，建议换一个。

<img src="/_image/ai3.png" alt="mcp 使用效果图" width="600">


## 🔌 MCP 客户端

TrendRadar MCP 服务支持标准的 Model Context Protocol (MCP) 协议，可以接入各种支持 MCP 的 AI 客户端进行智能分析。

### 支持的客户端

**注意事项**：
- 将 `/path/to/TrendRadar` 替换为你的项目实际路径
- Windows 路径使用双反斜杠：`C:\\Users\\YourName\\TrendRadar`
- 保存后记得重启

<details>
<summary>👉 点击展开：<b>Claude Desktop</b></summary>

#### 配置文件方式

编辑 Claude Desktop 的 MCP 配置文件：

**Windows**：
`%APPDATA%\Claude\claude_desktop_config.json`

**Mac**：
`~/Library/Application Support/Claude/claude_desktop_config.json`

**配置内容**：
```json
{
  "mcpServers": {
    "trendradar": {
      "command": "uv",
      "args": [
        "--directory",
        "/path/to/TrendRadar",
        "run",
        "python",
        "-m",
        "mcp_server.server"
      ],
      "env": {},
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

</details>

<details>
<summary>👉 点击展开：<b>Cursor</b></summary>

#### 方式一：HTTP 模式

1. **启动 HTTP 服务**：
   ```bash
   # Windows
   start-http.bat
   
   # Mac/Linux
   ./start-http.sh
   ```

2. **配置 Cursor**：

   **项目级配置**（推荐）：
   在项目根目录创建 `.cursor/mcp.json`：
   ```json
   {
     "mcpServers": {
       "trendradar": {
         "url": "http://localhost:3333/mcp",
         "description": "TrendRadar 新闻热点聚合分析"
       }
     }
   }
   ```

   **全局配置**：
   在用户目录创建 `~/.cursor/mcp.json`（同样内容）

3. **使用步骤**：
   - 保存配置文件后重启 Cursor
   - 在聊天界面的 "Available Tools" 中查看已连接的工具
   - 开始使用：`搜索今天的"AI"相关新闻`

#### 方式二：STDIO 模式（推荐）

创建 `.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "trendradar": {
      "command": "uv",
      "args": [
        "--directory",
        "/path/to/TrendRadar",
        "run",
        "python",
        "-m",
        "mcp_server.server"
      ]
    }
  }
}
```

</details>

<details>
<summary>👉 点击展开：<b>VSCode (Cline/Continue)</b></summary>

#### Cline 配置

在 Cline 的 MCP 设置中添加：

**HTTP 模式**：
```json
{
  "trendradar": {
    "url": "http://localhost:3333/mcp",
    "type": "streamableHttp",
    "autoApprove": [],
    "disabled": false
  }
}
```

**STDIO 模式**（推荐）：
```json
{
  "trendradar": {
    "command": "uv",
    "args": [
      "--directory",
      "/path/to/TrendRadar",
      "run",
      "python",
      "-m",
      "mcp_server.server"
    ],
    "type": "stdio",
    "disabled": false
  }
}
```

#### Continue 配置

编辑 `~/.continue/config.json`：
```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "uv",
          "args": [
            "--directory",
            "/path/to/TrendRadar",
            "run",
            "python",
            "-m",
            "mcp_server.server"
          ]
        }
      }
    ]
  }
}
```

**使用示例**：
```
分析最近7天"特斯拉"的热度变化趋势
生成今天的热点摘要报告
搜索"比特币"相关新闻并分析情感倾向
```

</details>

<details>
<summary>👉 点击展开：<b>Claude Code CLI</b></summary>

#### HTTP 模式配置

```bash
# 1. 启动 HTTP 服务
# Windows: start-http.bat
# Mac/Linux: ./start-http.sh

# 2. 添加 MCP 服务器
claude mcp add --transport http trendradar http://localhost:3333/mcp

# 3. 验证连接（确保服务已启动）
claude mcp list
```

#### 使用示例

```bash
# 查询新闻
claude "搜索今天知乎的热点新闻，前10条"

# 趋势分析
claude "分析'人工智能'这个话题最近一周的热度趋势"

# 数据对比
claude "对比知乎和微博平台对'比特币'的关注度"
```

</details>

<details>
<summary>👉 点击展开：<b>MCP Inspector</b>（调试工具）</summary>
<br>

MCP Inspector 是官方调试工具，用于测试 MCP 连接：

#### 使用步骤

1. **启动 TrendRadar HTTP 服务**：
   ```bash
   # Windows
   start-http.bat
   
   # Mac/Linux
   ./start-http.sh
   ```

2. **启动 MCP Inspector**：
   ```bash
   npx @modelcontextprotocol/inspector
   ```

3. **在浏览器中连接**：
   - 访问：`http://localhost:3333/mcp`
   - 测试 "Ping Server" 功能验证连接
   - 检查 "List Tools" 是否返回 13 个工具：
     - 基础查询：get_latest_news, get_news_by_date, get_trending_topics
     - 智能检索：search_news, search_related_news_history
     - 高级分析：analyze_topic_trend, analyze_data_insights, analyze_sentiment, find_similar_news, generate_summary_report
     - 系统管理：get_current_config, get_system_status, trigger_crawl

</details>

<details>
<summary>👉 点击展开：<b>其他支持 MCP 的客户端</b></summary>
<br>

任何支持 Model Context Protocol 的客户端都可以连接 TrendRadar：

#### HTTP 模式

**服务地址**：`http://localhost:3333/mcp`

**基本配置模板**：
```json
{
  "name": "trendradar",
  "url": "http://localhost:3333/mcp",
  "type": "http",
  "description": "新闻热点聚合分析"
}
```

#### STDIO 模式（推荐）

**基本配置模板**：
```json
{
  "name": "trendradar",
  "command": "uv",
  "args": [
    "--directory",
    "/path/to/TrendRadar",
    "run",
    "python",
    "-m",
    "mcp_server.server"
  ],
  "type": "stdio"
}
```

**注意事项**：
- 替换 `/path/to/TrendRadar` 为实际项目路径
- Windows 路径使用反斜杠转义：`C:\\Users\\...`
- 确保已完成项目依赖安装（运行过 setup 脚本）

</details>



### 常见问题

<details>
<summary>👉 点击展开：<b>Q1: HTTP 服务无法启动？</b></summary>
<br>

**检查步骤**：
1. 确认端口 3333 未被占用：
   ```bash
   # Windows
   netstat -ano | findstr :3333
   
   # Mac/Linux
   lsof -i :3333
   ```

2. 检查项目依赖是否安装：
   ```bash
   # 重新运行安装脚本
   # Windows: setup-windows.bat 或者 setup-windows-en.bat
   # Mac/Linux: ./setup-mac.sh
   ```

3. 查看详细错误日志：
   ```bash
   uv run python -m mcp_server.server --transport http --port 3333
   ```
4. 尝试自定义端口:
   ```bash
   uv run python -m mcp_server.server --transport http --port 33333
   ```

</details>

<details>
<summary>👉 点击展开：<b>Q2: 客户端无法连接到 MCP 服务？</b></summary>
<br>

**解决方案**：

1. **STDIO 模式**：
   - 确认 UV 路径正确（运行 `which uv` 或 `where uv`）
   - 确认项目路径正确且无中文字符
   - 查看客户端错误日志

2. **HTTP 模式**：
   - 确认服务已启动（访问 `http://localhost:3333/mcp`）
   - 检查防火墙设置
   - 尝试使用 127.0.0.1 替代 localhost

3. **通用检查**：
   - 重启客户端应用
   - 查看 MCP 服务日志
   - 使用 MCP Inspector 测试连接

</details>

<details>
<summary>👉 点击展开：<b>Q3: 工具调用失败或返回错误？</b></summary>
<br>

**可能原因**：

1. **数据不存在**：
   - 确认已运行过爬虫（有 output 目录数据）
   - 检查查询日期范围是否有数据
   - 查看 output 目录的可用日期

2. **参数错误**：
   - 检查日期格式：`YYYY-MM-DD`
   - 确认平台 ID 正确：`zhihu`, `weibo` 等
   - 查看工具文档中的参数说明

3. **配置问题**：
   - 确认 `config/config.yaml` 存在
   - 确认 `config/frequency_words.txt` 存在
   - 检查配置文件格式是否正确

</details>


## ☕问题答疑与交流

> 如果你想支持本项目，可通过微信搜索**腾讯公益**，对里面的**助学**相关的项目随心捐助
>
> 感谢参与过**一元点赞**的朋友，已收录至顶部**致谢名单**！你们的支持让开源维护更有动力，个人打赏码现已移除。

- **GitHub Issues**：适合针对性强的解答。提问时请提供完整信息（截图、错误日志、系统环境等）。
- **公众号交流**：适合快速咨询。建议优先在相关文章下的公共留言区交流，如私信，请文明礼貌用语😉
- 💡 部署成功了？来公众号说说感受吧，你的点赞和留言都是我继续更新的动力~


<div align="center">

|公众号关注 |
|:---:|
| <img src="_image/weixin.png" width="400" title="硅基茶水间"/> |

</div>

<br>

---

## 🪄 赞助商

> **302.AI** 是按用量付费的企业级 AI 资源平台      
> 提供市场上最新、最全面的 **AI 模型**和 **API**，以及多种开箱即用的在线 AI 应用

<div align="center">

[![注册领取](https://img.shields.io/badge/注册_302.AI-领取_1_美元免费测试额度-8B5CF6?style=for-the-badge&logo=openai&logoColor=white)](https://share.302.ai/mEOUzG)
<a href="https://share.302.ai/mEOUzG" target="_blank">
  <img src="_image/banner-302ai-zh.jpg" alt="302.AI" width="700"/>
</a>
</div>


<details id="sponsor-tutorial">
<summary>👉 点击展开：<b>302.AI 使用教程</b></summary>
<br>

> 领取的 1 美元可用于调用各种 AI 大模型（如 Claude、GPT 等）
> 本项目 AI 分析功能需配置大模型使用，配置教程详见 [AI 智能分析](#-ai-智能分析)

### 第 1 步：获取 API Key

1. 注册后，进入右上角 [管理后台](https://302.ai/dashboard/overview)
2. 点击左侧 [API Keys](https://302.ai/apis/list)
3. 在页面下方找到默认 API KEY，**点击眼睛图标查看**，然后复制
   （⚠️ 注意：不是点最右侧的复制按钮）


### 第 2 步：在 Cherry Studio 中配置

1. 打开 Cherry Studio，进入设置
2. 模型提供商选择 **"302.AI"**
3. 粘贴刚才复制的 API Key
4. 点击**管理**，现在可以使用所有支持的 AI 模型了

**提示：** Cherry Studio 已原生集成 302.AI，配置后即可看到完整模型列表。


**Q: 1 美元免费额度能用多久？**
A: 取决于使用频率和模型选择，可以进行多次测试体验。

**Q: 免费额度用完后怎么办？**
A: 可以按需充值，按量付费。目前大厂模型价格已相对亲民。

</details>


> 每天追踪这么多热点，写报告、回复消息是否让手腕疲惫？        
> 试试「闪电说」AI 语音输入法 —— 用说的，比打字快 4 倍 ⚡ 。从看热点到输出内容，让效率翻倍 👇

<div align="center">

[![Mac下载](https://img.shields.io/badge/Mac-免费下载-FF6B6B?style=for-the-badge&logo=apple&logoColor=white)](https://shandianshuo.cn) [![Windows下载](https://img.shields.io/badge/Windows-免费下载-FF6B6B?style=for-the-badge&logo=lightning&logoColor=white)](https://shandianshuo.cn)
<a href="https://shandianshuo.cn" target="_blank">
  <img src="_image/banner-shandianshuo.png" alt="闪电说" width="700"/>
</a>
</div>



---

### 项目相关

> **4 篇文章**：

- [可在该文章下方留言，方便项目作者用手机答疑](https://mp.weixin.qq.com/s/KYEPfTPVzZNWFclZh4am_g)
- [2个月破 1000 star，我的GitHub项目推广实战经验](https://mp.weixin.qq.com/s/jzn0vLiQFX408opcfpPPxQ)
- [github fork 运行本项目的注意事项 ](https://mp.weixin.qq.com/s/C8evK-U7onG1sTTdwdW2zg)
- [基于本项目，如何开展公众号或者新闻资讯类文章写作](https://mp.weixin.qq.com/s/8ghyfDAtQZjLrnWTQabYOQ)

>**AI 开发**：
- 如果你有小众需求，完全可以基于我的项目自行开发，零编程基础的也可以试试
- 我所有的开源项目或多或少都使用了自己写的**AI辅助软件**来提升开发效率，这款工具已开源
- **核心功能**：迅速筛选项目代码喂给AI，你只需要补充个人需求即可
- **项目地址**：https://github.com/sansan0/ai-code-context-helper

### 其余项目

> 📍 毛主席足迹地图 - 交互式动态展示1893-1976年完整轨迹。欢迎诸位同志贡献数据

- https://github.com/sansan0/mao-map

> 哔哩哔哩(bilibili)评论区数据可视化分析软件

- https://github.com/sansan0/bilibili-comment-analyzer


### 本项目流程图

```mermaid
flowchart TD
    A[👤 用户开始] --> B{🚀 选择部署方式}
    
    B -->|云端部署| C1[🍴 Fork 项目到 GitHub]
    B -->|本地部署| C2[🐳 Docker 部署]
    
    C1 --> D[⚙️ 配置通知渠道<br/>可同时配置多个]
    C2 --> D
    
    D --> E[选择通知方式：<br/>📱企业微信 💬飞书 🔔钉钉<br/>📟Telegram 📧邮件]
    
    E --> F[🔑 填写通知参数<br/>GitHub Secrets 或环境变量]
    
    F --> G[📝 配置关键词<br/>config/frequency_words.txt<br/>普通词/必须词+/过滤词!]
    
    G --> H[🎯 选择运行模式<br/>config/config.yaml]
    
    H --> H1[📋 daily - 当日汇总<br/>定时推送所有匹配新闻]
    H --> H2[📰 current - 当前榜单<br/>定时推送最新榜单]
    H --> H3[📈 incremental - 增量监控<br/>仅推送新增内容]
    
    H1 --> I[可选：推送时间窗口控制<br/>⏰ 限制推送时间范围]
    H2 --> I
    H3 --> I
    
    I --> J[✅ 配置完成]
    
    J --> K[🤖 系统自动运行]
    
    K --> L[🕷️ 爬取11+平台热点]
    L --> M[🔍 关键词筛选]
    M --> N[⚖️ 权重算法排序<br/>排名60% + 频次30% + 热度10%]
    N --> O[📊 生成报告<br/>HTML网页 + 推送消息]
    O --> P[📱 多渠道推送通知]
    
    P --> Q[🎉 持续接收精准推送<br/>告别信息过载]
    
    style A fill:#e3f2fd
    style B fill:#f3e5f5
    style D fill:#fff3e0
    style F fill:#fff9c4
    style G fill:#e8f5e9
    style H fill:#e0f2f1
    style I fill:#fce4ec
    style O fill:#e1bee7
    style Q fill:#c8e6c9
```

[![Star History Chart](https://api.star-history.com/svg?repos=sansan0/TrendRadar&type=Date)](https://www.star-history.com/#sansan0/TrendRadar&Date)


## 📄 许可证

GPL-3.0 License

---

<div align="center">

[🔝 回到顶部](#trendradar)

</div>