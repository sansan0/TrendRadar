<div align="center" id="trendradar">

<a href="https://github.com/sansan0/TrendRadar" title="TrendRadar">
  <img src="/_image/banner.webp" alt="TrendRadar Banner" width="80%">
</a>

🚀 Deploy in <strong>30 seconds</strong> — Your Smart Trending News Assistant

</div>

<div align="center">

**English**

</div>


> This project is designed to be lightweight and easy to deploy.

<br>

## 📑 Quick Navigation

<div align="center">

| [🚀 Quick Start](#-quick-start) | [⚙️ Configuration Guide](#️-configuration-guide) |
|:---:|:---:|

</div>

<br>

## ✨ Core Features

### **Multi-Platform Trending News Aggregation**

-   CNN
-   Fox News
-   Reuters

Default monitoring of 3 mainstream platforms, with support for adding custom platforms.

> 💡 For detailed configuration, see [Configuration Guide - Platform Configuration](#1-platform-configuration)

### **Smart Push Strategies**

**Three Push Modes**:

| Mode | Target Users | Push Feature |
| --- | --- | --- |
| **Daily Summary** (daily) | Managers/Regular Users | Push all matched news of the day (includes previously pushed) |
| **Current Rankings** (current) | Content Creators | Push current ranking matches (continuously ranked news appear each time) |
| **Incremental Monitor** (incremental)| Traders/Investors | Push only new content, zero duplication |

> 💡 **Quick Selection Guide:**
> - 🔄 Don't want duplicate news → Use `incremental`
> - 📊 Want complete ranking trends → Use `current`
> - 📝 Need daily summary reports → Use `daily`
>
> For detailed comparison and configuration, see [Configuration Guide - Push Mode Details](#3-push-mode-details)

**Additional Feature - Push Time Window Control** (Optional):

-   Set push time range (e.g., 09:00-18:00), push only within specified time
-   Configure multiple pushes within window or once per day
-   Avoid notifications during non-work hours

> 💡 This feature is disabled by default, see [Quick Start](#-quick-start) for configuration

### **Precise Content Filtering**

Set personal keywords (e.g., AI, Tech, Politics) to receive only relevant trending news, filtering out noise.

**Basic Syntax** (4 types):
-   Normal words: Basic matching
-   Required words `+`: Narrow scope
-   Filter words `!`: Exclude noise
-   Count limit `@`: Control display count

**Advanced Features**:
-   🔢 **Keyword Sorting Control**: Sort by popularity or config order
-   📊 **Display Count Limit**: Global config + individual override for flexible control

**Group-based Management**:
-   Separate with blank lines, independent statistics for different topics

> 💡 **Basic Configuration**: [Keyword Configuration - Basic Syntax](#keyword-basic-syntax)
>
> 💡 **Advanced Configuration**: [Keyword Configuration - Advanced Settings](#keyword-advanced-settings)
>
> 💡 You can also skip filtering and receive all trending news (leave frequency_words.txt empty)


### **Trending Analysis**

Real-time tracking of news popularity changes helps you understand not just "what's trending" but "how trends evolve."

-   **Timeline Tracking**: Records complete time span from first to last appearance
-   **Popularity Changes**: Tracks ranking changes and appearance frequency across time periods
-   **New Detection**: Real-time identification of emerging topics, marked with 🆕
-   **Continuity Analysis**: Distinguishes between one-time hot topics and continuously developing news
-   **Cross-Platform Comparison**: Same news across different platforms, showing media attention differences

> 💡 Push format reference: [Configuration Guide - Push Format Reference](#5-push-format-reference)

### **Personalized Trending Algorithm**

No longer controlled by platform algorithms, TrendRadar reorganizes all trending searches:

-   **Prioritize High-Ranking News** (60%): Top-ranked news from each platform appears first
-   **Focus on Persistent Topics** (30%): Repeatedly appearing news is more important
-   **Consider Ranking Quality** (10%): Not just frequent, but consistently top-ranked

> 💡 Weight adjustment guide: [Configuration Guide - Advanced Configuration](#4-advanced-configuration---hotspot-weight-adjustment)

### **Multi-Channel Real-Time Push**

Supports **Slack**, **Telegram**, **Email**, **ntfy**, and **Bark** — messages delivered directly to your phone and email.

### **Multi-Platform Support**
-   **GitHub Pages**: Auto-generate beautiful web reports, PC/mobile adapted
-   **Docker Deployment**: Supports multi-architecture containerized operation
-   **Data Persistence**: HTML/TXT multi-format history saving

### **Zero Technical Barrier Deployment**

One-click GitHub Fork to use, no programming required.

> 30-second deployment: GitHub Pages (web browsing) supports one-click save as image for easy sharing.

**💡 Tip:** Want a **real-time updated** web version? After forking, go to your repo Settings → Pages and enable GitHub Pages.

### **Reduce APP Dependencies**

Transform from "algorithm recommendation captivity" to "actively getting the information you want"

**Target Users:** Investors, content creators, PR professionals, news-conscious general users

**Typical Scenarios:** Stock investment monitoring, brand sentiment tracking, industry trend watching, lifestyle news gathering

| Github Pages Effect (Mobile Adapted, Email Push) |
|:---:|
| ![Github Pages Effect](_image/github-pages.png) |

<br>

## 🚀 Quick Start

1.  **Fork this project** to your GitHub account.

2.  **Setup GitHub Secrets**: In your forked repo, go to `Settings` > `Secrets and variables` > `Actions` > `New repository secret`. You will need to add secrets for the notification platforms you want to use (e.g., `SLACK_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, etc.).

3.  **Manual Test News Push**: Go to your project's `Actions` page, find "Hot News Crawler", and click "Run workflow".

4.  **Configuration Notes (Optional)**:
    -   **Push Settings**: Configure push mode and notification options in `config/config.yaml`.
    -   **Keyword Settings**: Add your interested keywords in `config/frequency_words.txt`.
    -   **Push Frequency Adjustment**: In `.github/workflows/crawler.yml` adjust the schedule.

<br>

<a name="configuration-guide"></a>

## ⚙️ Configuration Guide

### 1. Platform Configuration

This project's news data comes from [newsnow](https://github.com/ourongxing/newsnow). You can find a list of supported platforms and their IDs to add to the `platforms` section in `config/config.yaml`.

### 2. Keyword Configuration

Configure monitoring keywords in `frequency_words.txt` with four syntax types and grouping features.

| Syntax Type | Symbol | Purpose |
|---|---|---|
| **Normal** | None | Basic matching |
| **Required** | `+` | Scope limiting |
| **Filter** | `!` | Noise exclusion |
| **Count Limit** | `@` | Control display count |

### 3. Push Mode Details

| Mode | Target Users | Push Timing | Display Content |
|---|---|---|---|
| **Daily Summary**<br/>`daily` | 📋 Managers/Regular Users | Scheduled push (default hourly) | All matched news of the day<br/>+ New news section |
| **Current Rankings**<br/>`current` | 📰 Content Creators | Scheduled push (default hourly) | Current ranking matches<br/>+ New news section |
| **Incremental Monitor**<br/>`incremental` | 📈 Traders/Investors | Push only when new | Newly appeared frequency word matches |

### 4. Advanced Configuration - Hotspot Weight Adjustment

You can adjust the weights in `config/config.yaml` to prioritize different aspects of the trending algorithm. The three weights (`rank_weight`, `frequency_weight`, `hotness_weight`) must sum to 1.0.

### 5. Push Format Reference

The push messages are formatted to provide a clear overview of the trending topics, including popularity level, rank position, source platform, and time tracking.

### 6. Docker Deployment

This project supports Docker for easy deployment. You can use the provided `docker-compose.yml` and `.env` files to configure and run the application in a container.

<br>

## 📄 License

GPL-3.0 License

---

<div align="center">

[🔝 Back to Top](#trendradar)

</div>
