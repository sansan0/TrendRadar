<div align="center">

# 🎯TrendRadar

🚀 最快<strong>30秒</strong>部署的热点助手 —— 告别无效刷屏，只看真正关心的新闻资讯

[![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-v2.1.1-green.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)

[![企业微信通知](https://img.shields.io/badge/企业微信-通知支持-00D4AA?style=flat-square)](https://work.weixin.qq.com/)
[![Telegram通知](https://img.shields.io/badge/Telegram-通知支持-00D4AA?style=flat-square)](https://telegram.org/)
[![dingtalk通知](https://img.shields.io/badge/钉钉-通知支持-00D4AA?style=flat-square)](#)
[![飞书通知](https://img.shields.io/badge/飞书-通知支持-00D4AA?style=flat-square)](https://www.feishu.cn/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-自动化-2088FF?style=flat-square&logo=github-actions&logoColor=white)](https://github.com/sansan0/TrendRadar)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-部署-4285F4?style=flat-square&logo=github&logoColor=white)](https://sansan0.github.io/TrendRadar)
[![Docker](https://img.shields.io/badge/Docker-部署-2496ED?style=flat-square&logo=docker&logoColor=white)](https://hub.docker.com/)

</div>


> 本项目以轻量，易部署为目标，主要处理 issues
>
> 遇到问题提 issues，或【硅基茶水间】公众号留言

<details>
<summary>👉 点击查看<strong>致谢名单</strong> (当前 <strong>🔥16🔥</strong> 位)</summary>

### 数据支持

本项目使用了 [newsnow](https://github.com/ourongxing/newsnow) 项目提供的 API 接口获取多平台数据

### 推广助力

> 感谢以下平台和个人的推荐(按时间排列)，以及各微信群，qq群等给到这个项目帮助的人

- [小众软件](https://mp.weixin.qq.com/s/fvutkJ_NPUelSW9OGK39aA) - 开源软件推荐平台
- [LinuxDo 社区](https://linux.do/) - 技术爱好者的聚集地
- [阮一峰周刊](https://github.com/ruanyf/weekly) - 技术圈有影响力的周刊

### 观众支持

> 感谢以下热心观众的信任与支持

|           点赞人            |  金额  |  日期  |             备注             |
| :-------------------------: | :----: | :----: | :-----------------------: |
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


<details>
<summary>👉 <strong>核心功能</strong></summary>

## ✨ 核心功能

### **全网热点聚合**

- 今日头条
- 百度热搜
- 华尔街见闻
- 澎湃新闻
- bilibili 热搜
- 财联社热门
- 凤凰网
- 贴吧
- 微博
- 抖音
- 知乎

默认监控 11 个主流平台，如想额外增加，可看最下方的**自定义监控平台**

### **智能推送策略**

**三种推送模式**：

- **📈 投资者/交易员** → 选择 `incremental`，及时获取新增资讯
- **📰 自媒体人/内容创作者** → 选择 `current`，掌握实时热点趋势  
- **📋 企业管理者/普通用户** → 选择 `daily`，定时获取完整日报


**静默推送模式**：

- **时间范围控制**：设定推送时间窗口（如 9:00-18:00），仅在指定时间内推送
- **适用场景**：
  - 时间内每次执行都推送
  - 时间范围内只推送一次

### **精准内容筛选**

设置个人关键词（如：AI、比亚迪、教育政策），只推送相关热点，过滤无关信息

- 支持普通词、必须词(+)、过滤词(!)三种语法，具体见【frequency_words.txt 配置教程】
- 词组化管理，独立统计不同主题热点

> 也可以不做筛选，完整的推送所有热点，具体见【历史更新】中的 v2.0.1

### **个性化热点算法**

不再被各个平台的算法牵着走，TrendRadar 会重新整理全网热搜：

- **看重排名高的新闻**（占60%）：各平台前几名的新闻优先显示
- **关注持续出现的话题**（占30%）：反复出现的新闻更重要  
- **考虑排名质量**（占10%）：不仅多次出现，还经常排在前列

**实际效果**：把分散在各个平台的热搜合并起来，按照你关心的热度重新排序

> 这三个比例可以选择适合自己的场景进行调整，具体见【热点权重调整】

### **多渠道实时推送**

支持**企业微信**、**飞书**、**钉钉**、**Telegram**，消息直达手机

### **多端适配**
- **GitHub Pages**：自动生成精美网页报告，PC/移动端适配
- **Docker部署**：支持多架构容器化运行
- **数据持久化**：HTML/TXT多格式历史记录保存

### **零技术门槛部署**

GitHub 一键 Fork 即可使用，无需编程基础。

> 30秒部署： GitHub Pages（网页浏览）
>
> 1分钟部署： 企业微信（手机通知）

**💡 提示：** 想要**实时更新**的网页版？fork 后，进入你的仓库 Settings → Pages，启用 GitHub Pages。[效果预览](https://sansan0.github.io/TrendRadar/)。

### **减少 APP 依赖**

从"被算法推荐绑架"变成"主动获取自己想要的信息"

**适合人群：** 投资者、自媒体人、企业公关、关心时事的普通用户

**典型场景：** 股市投资监控、品牌舆情追踪、行业动态关注、生活资讯获取

</details>

| Github Pages 网页效果(手机端也适配) | 飞书推送效果 |
|:---:|:---:|
| ![Github Pages效果](_image/github-pages.png) | ![飞书推送效果](_image/feishu.jpg) |

<details>
<summary><strong>👉 推送格式说明</strong></summary>

## **通知示例：**

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


## **消息格式说明**

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


## 📝 更新日志

>**升级说明：** 
- **注意**：请通过以下方式更新项目(或根据**更新提示**升级)，不要通过 Sync fork 更新
- **小版本更新**：一般情况，直接在 GitHub 网页编辑器中，用本项目的 `main.py` 代码替换你 fork 仓库中的对应文件 
- **大版本升级**：从 v1.x 升级到 v2.0 建议删除现有 fork 后重新 fork，这样更省力且避免配置冲突


> 感谢各位朋友的支持与厚爱，特别感谢：
> 
> **fork 并为项目点 star** 的观众们，你们的认可是我前进的动力
> 
> **关注公众号并积极互动** 的读者们，你们的留言和点赞让内容更有温度
> 
> **给予资金点赞支持** 的朋友们，你们的慷慨让项目得以持续发展
> 
> 下一次**新功能**，大概会是 ai 分析功能(大概(●'◡'●)

### 2025/09/04 - v2.1.1

- 修复docker在某些架构中无法正常运行的问题
- 正式发布官方 Docker 镜像 wantcat/trendradar，支持多架构
- 优化 Docker 部署流程，无需本地构建即可快速使用

<details>
<summary><strong>👉 历史更新</strong></summary>

### 2025/08/30 - v2.1.0

**核心改进**：
- **推送逻辑优化**：从"每次执行都推送"改为"时间窗口内可控推送"
- **时间窗口控制**：可设定推送时间范围，避免非工作时间打扰
- **推送频率可选**：时间段内支持单次推送或多次推送

**更新提示**：
- 本功能默认关闭，需手动在 config.yaml 中开启静默推送模式
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


## 🚀 使用方式

1. **Fork 本项目**到你的 GitHub 账户

   - 点击本页面右上角的"Fork"按钮

2. **设置 GitHub Secrets（选择你需要的平台）**:

   在你 Fork 后的仓库中，进入 `Settings` > `Secrets and variables` > `Actions` > `New repository secret`，然后根据需要配置以下任一或多个通知平台：

   可以同时配置多个平台，系统会向所有配置的平台发送通知。

   <details>
   <summary> <strong>👉 企业微信机器人</strong>（配置最简单最迅速）</summary>
   <br>

   **GitHub Secret 配置：**
   - 名称：`WEWORK_WEBHOOK_URL`
   - 值：你的企业微信机器人 Webhook 地址

   **机器人设置步骤：**

   #### 手机端设置：
   1. 打开企业微信 App → 进入目标内部群聊
   2. 点击右上角"…"按钮 → 选择"群机器人"
   3. 点击"添加" → 点击"新建" → 设置机器人昵称
   4. 复制 Webhook 地址，配置到上方的 GitHub Secret 中

   #### PC 端设置流程类似
   </details>

   <details>
   <summary> <strong>👉 飞书机器人</strong>（消息显示最友好）</summary>
   <br>

   **GitHub Secret 配置：**
   - 名称：`FEISHU_WEBHOOK_URL`
   - 值：你的飞书机器人 Webhook 地址

   **机器人设置步骤：**

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
   <summary> <strong>👉 钉钉机器人</strong></summary>
   <br>

   **GitHub Secret 配置：**
   - 名称：`DINGTALK_WEBHOOK_URL`
   - 值：你的钉钉机器人 Webhook 地址

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
   <summary> <strong>👉 Telegram Bot</strong></summary>
   <br>

   **GitHub Secret 配置：**
   - 名称：`TELEGRAM_BOT_TOKEN` - 你的 Telegram Bot Token
   - 名称：`TELEGRAM_CHAT_ID` - 你的 Telegram Chat ID

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

3. **主要配置**:

    - **推送设置：** : 在 [config/config.yaml](config/config.yaml) 中进行，可根据里面的描述文字操作，这里不重复了
    - 比如: 在 `config/config.yaml` 中修改 `report.mode` 设置：

      | 模式 | 推送时机 | 显示内容 | 适用场景 |
        |------|----------|----------|----------|
        | **当日汇总模式**<br/>`daily` | 按时推送 | 当日所有匹配新闻<br/>+ 新增新闻区域 | 日报总结<br/>全面了解当日热点趋势 |
        | **当前榜单模式**<br/>`current` | 按时推送 | 当前榜单匹配新闻<br/>+ 新增新闻区域 | 实时热点追踪<br/>了解当前最火的内容 |
        | **增量监控模式**<br/>`incremental` | 有新增才推送 | 新出现的匹配频率词新闻 | 避免重复信息干扰<br/>高频监控场景 |

    - **关键词配置**: 修改 [config/frequency_words.txt](config/frequency_words.txt) 文件，添加你关心的关键词
    
    <details>
    <summary><strong>👉 frequency_words.txt 配置教程</strong></summary>
    <br>

    在 `frequency_words.txt` 文件中配置监控的关键词，支持三种语法和词组功能。

    关键词越靠前，新闻的优先级越高，你可以根据自己的关注度调整关键词顺序

    ### 📋 基础语法说明

    #### 1. **普通关键词** - 基础匹配
    ```txt
    华为
    OPPO
    苹果
    ```
    **作用：** 新闻标题包含其中**任意一个词**就会被捕获

    #### 2. **必须词** `+词汇` - 限定范围  
    ```txt
    华为
    OPPO
    +手机
    ```
    **作用：** 必须同时包含普通词**和**必须词才会被捕获

    #### 3. **过滤词** `!词汇` - 排除干扰
    ```txt
    苹果
    华为
    !水果
    !价格
    ```
    **作用：** 包含过滤词的新闻会被**直接排除**，即使包含关键词

    ### 🔗 词组功能 - 空行分隔的重要作用

    **核心规则：** 用**空行**分隔不同的词组，每个词组独立统计

    #### 示例配置：
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

    #### 词组解释及匹配效果：

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
    - 效果：包含股市相关词，同时包含"涨跌"，但排除包含"预测"的内容

    **匹配示例：**
    - ✅ "A股今日大幅涨跌分析" ← 有"A股"+"涨跌"
    - ✅ "上证指数涨跌原因解读" ← 有"上证"+"涨跌"
    - ❌ "专家预测A股涨跌趋势" ← 有"A股"+"涨跌"但包含"预测"
    - ❌ "A股成交量创新高" ← 有"A股"但缺少"涨跌"

    **第3组 - 足球赛事类：**
    - 关键词：世界杯、欧洲杯、亚洲杯
    - 必须词：比赛
    - 效果：必须包含杯赛名称，同时包含"比赛"

    **匹配示例：**
    - ✅ "世界杯小组赛比赛结果" ← 有"世界杯"+"比赛"
    - ✅ "欧洲杯决赛比赛时间" ← 有"欧洲杯"+"比赛"
    - ❌ "世界杯门票开售" ← 有"世界杯"但缺少"比赛"

    ### 🎯 配置技巧

    #### 1. **从宽到严的配置策略**
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

    #### 2. **避免过度复杂**
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


   
    


<details>
<summary><strong>👉 自定义监控平台</strong></summary>

### 🔧 自定义监控平台

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
</details>

<details>
<summary><strong>👉 Docker 部署</strong></summary>

### 🐳 Docker 部署

#### 方式一：快速体验（一行命令）

```bash
# 直接运行，使用默认配置（仅体验功能，无推送通知）
docker run -d --name trend-radar \
  -v ./config:/app/config:ro \
  -v ./output:/app/output \
  -e CRON_SCHEDULE="*/30 * * * *" \
  -e RUN_MODE="cron" \
  -e IMMEDIATE_RUN="true" \
  wantcat/trendradar:latest

# 或者配置环境变量启用推送通知
docker run -d --name trend-radar \
  -v ./config:/app/config:ro \
  -v ./output:/app/output \
  -e FEISHU_WEBHOOK_URL="你的飞书webhook" \
  -e DINGTALK_WEBHOOK_URL="你的钉钉webhook" \
  -e WEWORK_WEBHOOK_URL="你的企业微信webhook" \
  -e TELEGRAM_BOT_TOKEN="你的telegram_bot_token" \
  -e TELEGRAM_CHAT_ID="你的telegram_chat_id" \
  -e CRON_SCHEDULE="*/30 * * * *" \
  -e RUN_MODE="cron" \
  -e IMMEDIATE_RUN="true" \
  wantcat/trendradar:latest
```

**注意**：快速体验模式需要先准备配置文件：

**Linux/macOS 系统：**
```bash
# 创建配置目录并下载配置文件
mkdir -p config output
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/
```
或者**手动创建**：
1. 在当前目录下创建两个文件夹：`config` 和 `output`
2. 下载配置文件到对应位置：
   - 访问 https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml → 右键"另存为" → 保存到 `config\config.yaml`
   - 访问 https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt → 右键"另存为" → 保存到 `config\frequency_words.txt`

完成后的目录结构应该是：
```
当前目录/
├── config/
│   ├── config.yaml
│   └── frequency_words.txt
└── output/
```

#### 方式二：使用 docker-compose（推荐）

1. **创建项目目录和配置**:
   ```bash
   # 创建目录结构
   mkdir -p trendradar/{config,output}
   cd trendradar
   
   # 下载配置文件模板
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/
   
   # 下载 docker-compose 配置
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/.env
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/docker-compose.yml
   ```

2. **配置文件说明**:
   - `config/config.yaml` - 应用主配置（报告模式、推送设置等）
   - `config/frequency_words.txt` - 关键词配置（设置你关心的热点词汇）
   - `.env` - 环境变量配置（webhook URLs 和定时任务）

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

</details>

<details>
<summary><strong>👉 热点权重调整</strong></summary>
<br>

当前默认的配置是平衡性配置

### 两个核心场景

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

### 调整的方法
1. **三个数字加起来必须等于 1.0**
2. **哪个重要就调大哪个**：在乎排名就调大 rank_weight，在乎持续性就调大 frequency_weight
3. **建议每次只调 0.1-0.2**，观察效果

核心思路：追求速度和时效性的用户提高排名权重，追求深度和稳定性的用户提高频次权重。

</details>


## ☕ 学习交流与1元点赞

> 心意到就行，收到的点赞用于提高开发者开源的积极性

<div align="center">

|公众号关注 |微信点赞 | 支付宝点赞 |
|:---:|:---:|:---:| 
| <img src="_image/weixin.png" width="300" title="硅基茶水间"/> | <img src="https://cdn-1258574687.cos.ap-shanghai.myqcloud.com/img/%2F2025%2F07%2F17%2F2ae0a88d98079f7e876c2b4dc85233c6-9e8025.JPG" width="300" title="微信支付"/> | <img src="https://cdn-1258574687.cos.ap-shanghai.myqcloud.com/img/%2F2025%2F07%2F17%2Fed4f20ab8e35be51f8e84c94e6e239b4-fe4947.JPG" width="300" title="支付宝支付"/> |

</div>

<details>
<summary><strong>👉 项目相关推荐</strong></summary>
<br>

> 附项目相关的两篇文章，欢迎留言交流

- [2个月破 1000 star，我的GitHub项目推广实战经验](https://mp.weixin.qq.com/s/jzn0vLiQFX408opcfpPPxQ)
- [基于本项目，如何开展公众号或者新闻资讯类文章写作](https://mp.weixin.qq.com/s/8ghyfDAtQZjLrnWTQabYOQ)

>**AI 开发：**
- 如果你有小众需求，完全可以基于我的项目自行开发，零编程基础的也可以试试
- 我所有的开源项目或多或少都使用了自己写的**AI辅助软件**来提升开发效率，这款工具已开源
- **核心功能**：迅速筛选项目代码喂给AI，你只需要补充个人需求即可
- **项目地址**：[https://github.com/sansan0/ai-code-context-helper](https://github.com/sansan0/ai-code-context-helper)

</details>

<details>
<summary><strong>👉 微信推送通知方案</strong></summary>
<br>

> 由于该方案是基于企业微信的插件机制，推送样式也十分不同，所以相关实现我暂时不准备纳入当前项目

- fork 这位兄台的项目 https://github.com/jayzqj/TrendRadar
- 完成上方的企业微信推送设置 
- 按照下面图片操作
- 配置好后，手机上的企业微信 app 删除掉也没事

<img src="_image/wework.png"  title="github"/>

</details>

<details>
<summary><strong>👉 本项目流程图</strong></summary>

```mermaid
flowchart TD
    A[👤 用户开始] --> B[🍴 Fork 项目]
    B --> C[⚙️ 选择通知方式]
    
    C --> D1[📱 企业微信群机器人<br/>最简单快速]
    C --> D2[💬 飞书机器人<br/>显示效果最佳]
    C --> D3[🔔 钉钉机器人<br/>]
    C --> D4[📟 Telegram Bot<br/>]
    
    D1 --> E[🔑 配置 GitHub Secrets<br/>填入机器人 Webhook 地址]
    D2 --> E
    D3 --> E  
    D4 --> E
    
    E --> F[📝 编辑关键词配置<br/>config/frequency_words.txt<br/>添加你关心的词汇]
    F --> G[🎯 选择运行模式<br/>config/config.yaml<br/>daily/current/incremental]
    
    G --> H[✅ 配置完成]
    H --> I[🤖 系统根据设定时间自动运行]
    
    I --> J[📊 爬取各大平台热点]
    J --> K[🔍 根据关键词筛选]
    K --> L[📱 推送到你的手机]
    
    L --> M[📈 查看推送结果]
    M --> N{满意效果?}
    N -->|不满意| F
    N -->|满意| O[🎉 持续接收精准推送]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style E fill:#fff3e0
    style F fill:#e8f5e8
    style G fill:#e8f5e8
    style L fill:#ffebee
    style O fill:#e8f5e8
```

</details>

[![Star History Chart](https://api.star-history.com/svg?repos=sansan0/TrendRadar&type=Date)](https://www.star-history.com/#sansan0/TrendRadar&Date)


## 📄 许可证

GPL-3.0 License

---

<div align="center">

**⭐ 如果这个工具对你有帮助，请给项目点个 Star 支持开发！**

[🔝 回到顶部](#trendradar)

</div>
