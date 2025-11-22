# TrendRadar × Cherry Studio 部署指南 🍒

> **适合人群**：零编程基础的用户
> **客户端**：Cherry Studio（免费开源 GUI 客户端）

---

## 📥 第一步：下载 Cherry Studio

### Windows 用户

访问官网下载：https://cherry-ai.com/
或直接下载：[Cherry-Studio-Windows.exe](https://github.com/kangfenmao/cherry-studio/releases/latest)

### Mac 用户

访问官网下载：https://cherry-ai.com/
或直接下载：[Cherry-Studio-Mac.dmg](https://github.com/kangfenmao/cherry-studio/releases/latest)


---

## 📦 第二步：获取项目代码

为什么需要获取项目代码？

AI 分析功能需要读取项目中的新闻数据才能工作。无论你使用 GitHub Actions 还是 Docker 部署，爬虫生成的新闻数据都保存在项目的 output 目录中。因此，在配置 MCP 服务器之前，需要先获取完整的项目代码（包含数据文件）。

根据你的技术水平，可以选择以下任一方式获取：：

### 方法一：Git Clone（推荐给技术用户）

如果你熟悉 Git，可以使用以下命令克隆项目：

```bash
git clone https://github.com/你的用户名/你的项目名.git
cd 你的项目名
```

**优点**：

- 可以随时拉取一个命令就可以更新最新数据到本地了（`git pull`）

### 方法二：直接下载 ZIP 压缩包（推荐给初学者）


1. **访问 GitHub 项目页面**

   - 项目链接：`https://github.com/你的用户名/你的项目名`

2. **下载压缩包**

   - 点击绿色的 "Code" 按钮
   - 选择 "Download ZIP"
   - 或直接访问：`https://github.com/你的用户名/你的项目名/archive/refs/heads/master.zip`


**注意事项**：

- 步骤稍微麻烦，后续更新数据需要重复上面步骤，然后覆盖本地数据(output 目录)

---

## 🚀 第三步：一键部署 MCP 服务器

### Windows 用户

1. **双击运行**项目文件夹中的 `setup-windows.bat`
2. **等待安装完成**
3. **记录显示的配置信息**（命令路径和参数）

### Mac 用户

1. **打开终端**（在启动台搜索"终端"）
2. **拖拽**项目文件夹中的 `setup-mac.sh` 到终端窗口
3. **按回车键**
4. **记录显示的配置信息**

---

## 🔧 第四步：配置 Cherry Studio

### 1. 打开设置

启动 Cherry Studio，点击右上角 ⚙️ **设置** 按钮

### 2. 添加 MCP 服务器

在设置页面找到：**MCP** → 点击 **添加**

### 3. 填写配置（重要！）

根据刚才的安装脚本显示的信息填写

### 4. 保存并启用

- 点击 **保存** 按钮
- 确保 MCP 服务器列表中的开关是 **开启** 状态 ✅

---

## ✅ 第五步：验证是否成功

### 1. 测试连接

在 Cherry Studio 的对话框中输入：

```
帮我爬取最新的新闻
```

或者尝试其他测试命令：

```
搜索最近3天关于"人工智能"的新闻
查找2025年1月的"特斯拉"相关报道
分析"iPhone"的热度趋势
```

**提示**：当你说"最近3天"时，AI会自动计算日期范围并搜索。

### 2. 成功标志

如果配置成功，AI 会：

- ✅ 调用 TrendRadar 工具
- ✅ 返回真实的新闻数据
- ✅ 显示平台、标题、排名等信息


---

## 🎯 进阶配置

### HTTP 模式（可选）

如果需要远程访问或多客户端共享，可以使用 HTTP 模式：

#### Windows

双击运行 `start-http.bat`

#### Mac

```bash
./start-http.sh
```

然后在 Cherry Studio 中配置：

```
类型: streamableHttp
URL: http://localhost:3333/mcp
```
