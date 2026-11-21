/**
 * TrendRadar i18n - Internationalization Engine
 */
(function () {
    'use strict';

    const STORAGE_KEY_LANG = 'trendradar_lang';
    let currentLang = 'zh';

    const T = { zh: {}, en: {} };

    function add(entries) {
        entries.forEach(function (e) {
            T.zh[e[0]] = e[1];
            T.en[e[0]] = e[2];
        });
    }

    // ═══════════════════════════════════════
    //  Navigation & Top Bar
    // ═══════════════════════════════════════
    add([
        ['nav.subtitle', '可视化配置编辑器', 'Visual Config Editor'],
        ['nav.privacy', '纯静态页面，数据仅保存在你的本地浏览器，请放心使用', 'Static page — data is stored only in your browser'],
        ['nav.loadLatest', '加载官网最新配置', 'Load Latest Config'],
        ['nav.copyConfig', '复制配置', 'Copy Config'],
        ['nav.copied', '已复制!', 'Copied!'],
    ]);

    // ═══════════════════════════════════════
    //  Save Status
    // ═══════════════════════════════════════
    add([
        ['save.saved', '已保存: ', 'Saved: '],
        ['save.notSaved', '未保存', 'Not saved'],
        ['time.justNow', '刚刚', 'Just now'],
        ['time.minutesAgo', ' 分钟前', ' min ago'],
        ['time.hoursAgo', ' 小时前', ' hr ago'],
        ['time.daysAgo', ' 天前', ' days ago'],
    ]);

    // ═══════════════════════════════════════
    //  Right Panel Header
    // ═══════════════════════════════════════
    add([
        ['panel.configModules', '配置模块', 'Config Modules'],
        ['panel.frequencyEdit', '频率词编辑', 'Keyword Editing'],
        ['panel.searchEdit', '联网搜索任务', 'Web Search Topics'],
        ['panel.timelineSchedule', '时间线调度', 'Timeline Schedule'],
        ['panel.versionCheck', '版本检测', 'Check Version'],
        ['panel.readOnly', '只读 (请在左侧编辑)', 'Read-only (edit on the left)'],
    ]);

    // ═══════════════════════════════════════
    //  Module Names (MODULE_DEFS)
    // ═══════════════════════════════════════
    add([
        ['mod.app', '1. 基础设置', '1. Basic Settings'],
        ['mod.platforms', '2. 数据源 - 热榜平台', '2. Data Source - Hot Platforms'],
        ['mod.rss', '3. 数据源 - RSS 订阅', '3. Data Source - RSS Feeds'],
        ['mod.web_search', '3.5 数据源 - 联网搜索', '3.5 Data Source - Web Search'],
        ['mod.report', '4. 报告模式', '4. Report Mode'],
        ['mod.filter', '4.5 筛选策略', '4.5 Filter Strategy'],
        ['mod.ai_filter', '4.6 AI 智能筛选', '4.6 AI Smart Filter'],
        ['mod.display', '5. 推送内容控制', '5. Push Content Control'],
        ['mod.notification', '6. 推送通知', '6. Push Notification'],
        ['mod.storage', '7. 存储配置', '7. Storage Config'],
        ['mod.ai', '8. AI 模型配置', '8. AI Model Config'],
        ['mod.ai_analysis', '9. AI 分析功能', '9. AI Analysis'],
        ['mod.ai_translation', '10. AI 翻译功能', '10. AI Translation'],
        ['mod.advanced', '11. 高级设置', '11. Advanced Settings'],
    ]);

    // ═══════════════════════════════════════
    //  Control Labels (renderControls)
    // ═══════════════════════════════════════
    add([
        // Platforms
        ['ctrl.enableHotlist', '启用热榜抓取', 'Enable hot list crawling'],
        ['ctrl.platformList', '平台列表', 'Platform List'],
        ['ctrl.dragToSort', '可拖拽排序', 'drag to reorder'],
        ['ctrl.addPlatform', '添加平台', 'Add Platform'],
        ['ctrl.addOtherPlatform', '添加其它平台', 'Add Other Platforms'],

        // RSS
        ['ctrl.enableRss', '启用 RSS 抓取', 'Enable RSS crawling'],
        ['ctrl.freshnessFilter', '新鲜度过滤', 'Freshness Filter'],
        ['ctrl.enableFreshness', '启用新鲜度过滤', 'Enable freshness filter'],
        ['ctrl.maxAgeDays', '最大文章年龄 (天)', 'Max article age (days)'],
        ['ctrl.rssFeedList', 'RSS 源列表', 'RSS Feed List'],
        ['ctrl.addRss', '添加 RSS 源', 'Add RSS Feed'],
        ['ctrl.rssLibHint', '(内附 RSS 源参考库)', '(RSS feed reference library included)'],
        ['ctrl.rssWarning', '部分海外媒体内容可能涉及敏感话题，AI 模型可能拒绝翻译或分析，建议根据实际需求筛选订阅源。', 'Some overseas media may involve sensitive topics. AI models may refuse to translate or analyze. Filter feeds based on actual needs.'],

        // Web Search
        ['ctrl.enableWebSearch', '开启联网搜索', 'Enable Web Search'],
        ['ctrl.wsIntro', '按你写的主题主动搜全网，结果独立展示，不会被频率词二次过滤。', 'Actively searches the web for topics you define. Results are shown separately without being re-filtered by keywords.'],
        ['ctrl.wsGoEditQueries', '去编辑搜索任务', 'Edit Search Tasks'],
        ['ctrl.wsProvider', '搜索引擎', 'Search Engine'],
        ['ctrl.wsProviderDeepseek', 'DeepSeek（内置默认）', 'DeepSeek (Built-in Default)'],
        ['ctrl.wsProviderCustom', '其他自定义引擎...', 'Other Custom Engine...'],
        ['ctrl.wsProviderCustomLabel', '自定义引擎名称', 'Custom Engine Name'],
        ['ctrl.wsProviderCustomPlaceholder', '填写搜索引擎名称（如 tavily）', 'Enter provider name (e.g. tavily)'],
        ['ctrl.wsQueriesFile', '搜索任务文件（可选）', 'Search Tasks File (optional)'],
        ['ctrl.wsQueriesFilePlaceholder', '留空默认使用 config/search_queries.txt', 'Empty uses config/search_queries.txt'],
        ['ctrl.wsQueriesFileHint', '自定义文件可放在 config/custom/search/ 目录，直接填文件名即可。', 'Place custom files in config/custom/search/ and enter the filename.'],
        ['ctrl.wsQueryMode', '搜索词处理方式', 'How to Run Queries'],
        ['ctrl.wsQueryModeDirect', '直接拿去搜（推荐，不额外花 AI 费用）', 'Search directly (recommended, no extra AI cost)'],
        ['ctrl.wsQueryModeSmart', 'AI 自动提炼长话（把自然语言变短词，当天缓存不重复收费）', 'AI smart distill (condenses long prompts, cached daily)'],
        ['ctrl.wsQualitySection', '条数与质量把关', 'Count & Quality Control'],
        ['ctrl.wsQualityHint', '先多拉一些候选结果，再按下面标准筛出最靠谱的展示。', 'Fetch broadly first, then filter down to the most reliable items.'],
        ['ctrl.wsFetchCount', '每次拉取候选条数 (1~50)', 'Candidates per query (1~50)'],
        ['ctrl.wsFetchCountHint', 'DeepSeek 支持 1~50 条，多拉不加钱', 'DeepSeek supports 1~50 items at the same price'],
        ['ctrl.wsMaxItemsPerTopic', '每个主题最多展示条数 (0=不限)', 'Max items per topic (0=unlimited)'],
        ['ctrl.wsFreshnessDays', '只看最近几天发布 (天，0=不限)', 'Only keep last N days (0=unlimited)'],
        ['ctrl.wsDedupDays', '几天内搜过不再标为“新增” (0=仅当天)', 'Dedup window for "new" badge (days, 0=today)'],
        ['ctrl.wsMinScore', '最低质量分 (0.0 ~ 1.0)', 'Min Quality Score (0.0 ~ 1.0)'],
        ['ctrl.wsMinScoreScale0', '0 不过滤', '0 No filter'],
        ['ctrl.wsMinScoreScale035', '0.35 宽松', '0.35 Relaxed'],
        ['ctrl.wsMinScoreScale05', '0.50 官方优质线', '0.50 Quality bar'],
        ['ctrl.wsMinScoreScale1', '1.0 极严', '1.0 Strict'],
        ['ctrl.wsMinScoreBadgeOff', '不过滤', 'No filter'],
        ['ctrl.wsMinScoreBadgeRelaxed', '宽松（冷门话题）', 'Relaxed (niche topics)'],
        ['ctrl.wsMinScoreBadgeGood', '官方优质线（推荐）', 'Recommended quality bar'],
        ['ctrl.wsMinScoreBadgeStrict', '严格筛选', 'Strict filter'],
        ['ctrl.wsMinAuthority', '网站权威度门槛', 'Source Authority Level'],
        ['ctrl.wsAuthAny', '-1 · 不限制（所有正常网站）', '-1 · No limit (all normal sites)'],
        ['ctrl.wsAuth0', '0 级以上 · 基础过滤', '0+ · Basic filtering'],
        ['ctrl.wsAuth1', '1 级以上 · 正规站点/媒体', '1+ · Regular media & sites'],
        ['ctrl.wsAuth2', '2 级以上 · 较权威媒体（财经推荐）', '2+ · Reputable media (good for finance)'],
        ['ctrl.wsAuth3', '3 级以上 · 官网/权威媒体（政策推荐）', '3+ · Official & authoritative (good for policy)'],
        ['ctrl.wsAuth4', '4 级 · 仅顶级权威官网', '4 · Top official sources only'],
        ['ctrl.wsAllowUnknownAuth', '保留暂无权威评分的网站（防误杀新网页）', 'Keep sites without authority score (avoid missing fresh pages)'],
        ['ctrl.wsNeedContent', '顺带抓取整篇网页正文（一般无需开启）', 'Fetch full webpage content (usually not needed)'],
        ['ctrl.wsNotifySnippet', '推送消息里附带一小段摘要（网页报告始终显示）', 'Show snippet in IM/webhook notifications (web report always shows)'],
        ['ctrl.wsDeepseekSection', 'DeepSeek 引擎账号设置', 'DeepSeek Engine Credentials'],
        ['ctrl.wsApiKey', 'DeepSeek API Key（可选）', 'DeepSeek API Key (optional)'],
        ['ctrl.wsApiKeyPlaceholder', '留空自动复用环境变量或 AI 密钥', 'Empty auto-reuses env var or AI key'],
        ['ctrl.wsApiKeyHint', '留空时自动读取 WEB_SEARCH_API_KEY；如果下方 AI 模型用的也是 DeepSeek，会自动复用 AI_API_KEY，无需重复填写。建议在 .env 或 GitHub Secrets 中配置。', 'Empty reads WEB_SEARCH_API_KEY, or automatically reuses AI_API_KEY when ai.model uses DeepSeek. Prefer storing keys in .env or GitHub Secrets.'],
        ['ctrl.wsApiBase', 'DeepSeek 接口地址', 'DeepSeek API Base URL'],
        ['ctrl.wsLocalization', '地区偏好 IP（可选）', 'Localization IP (optional)'],
        ['ctrl.wsLocalizationPlaceholder', '留空不限，可填 IP 地址影响搜索地区偏好', 'Optional IP address to localize search results'],
        ['ctrl.wsAdvancedTitle', '高级网络参数（一般无需修改）', 'Advanced Network Settings (optional)'],
        ['ctrl.wsRequestInterval', '两次搜索间隔 (毫秒)', 'Request interval (ms)'],
        ['ctrl.wsTimeout', '单次搜索超时 (秒)', 'Search timeout (sec)'],
        ['ctrl.wsMaxRetries', '失败最多重试次数', 'Max retries on failure'],
        ['ctrl.wsUseProxy', '联网搜索走代理', 'Use proxy for web search'],
        ['ctrl.wsProxyUrl', '联网搜索专属代理地址（留空复用爬虫默认代理）', 'Dedicated proxy URL (empty uses crawler default)'],
        ['ctrl.wsProxyPlaceholder', '例如 http://127.0.0.1:10801', 'e.g. http://127.0.0.1:10801'],
        ['ctrl.togglePassword', '显示/隐藏密钥', 'Show/Hide key'],

        // Report
        ['ctrl.reportMode', '报告模式', 'Report Mode'],
        ['ctrl.displayMode', '分组维度', 'Group Dimension'],
        ['ctrl.sortByPosition', '按定义顺序排序', 'Sort by defined order'],
        ['ctrl.rankThreshold', '排名高亮阈值', 'Rank highlight threshold'],
        ['ctrl.maxNewsPerKeyword', '每个关键词最大显示数量', 'Max items per keyword'],

        // Filter
        ['ctrl.filterMethod', '筛选方法', 'Filter Method'],
        ['ctrl.prioritySort', 'AI 模式按标签优先级排序', 'AI mode: sort by tag priority'],
        ['ctrl.filterNote', '使用', 'uses'],

        // AI Filter
        ['ctrl.aiFilterNote', '仅当 filter.method=ai 时生效。', 'Only effective when filter.method=ai.'],
        ['ctrl.batchSize', '每批标题数量', 'Titles per batch'],
        ['ctrl.batchInterval', '分批间隔 (秒)', 'Batch interval (sec)'],
        ['ctrl.minScore', '最低分数阈值 (0~1)', 'Min score threshold (0~1)'],
        ['ctrl.interestsFile', '兴趣描述文件 (可选)', 'Interests file (optional)'],
        ['ctrl.interestsFileHint', '留空时使用', 'When empty, uses'],
        ['ctrl.reclassifyThreshold', '全量重分类阈值 (0~1)', 'Full reclassification threshold (0~1)'],
        ['ctrl.promptFile', '分类提示词文件', 'Classification prompt file'],
        ['ctrl.extractPromptFile', '标签提取提示词文件', 'Tag extraction prompt file'],
        ['ctrl.updateTagsPromptFile', '标签更新提示词文件', 'Tag update prompt file'],

        // Display
        ['ctrl.pushContentControl', '推送内容控制', 'Push Content Control'],
        ['ctrl.displayOrderHint', '列表顺序决定了报告中的显示顺序', 'List order determines display order in the report'],
        ['ctrl.standaloneConfig', '独立展示区配置', 'Standalone Display Config'],
        ['ctrl.standaloneNote', '推送展示由上方开关控制，AI 分析由 AI 模块的开关独立控制', 'Push display is controlled by toggles above; AI analysis is controlled independently by the AI module'],
        ['ctrl.maxStandaloneItems', '每个源最多展示条数', 'Max items per source'],
        ['ctrl.selectPlatforms', '选择要展示的热榜平台', 'Select hot list platforms to display'],
        ['ctrl.selectRssFeeds', '选择要展示的 RSS 源', 'Select RSS feeds to display'],

        // Notification
        ['ctrl.notificationNote', '推送时间由 timeline.yaml 控制，切换到 timeline.yaml 标签页可可视化编辑调度规则。此处仅配置通知渠道（Telegram / 企业微信等），请在左侧编辑器中修改。', 'Push timing is controlled by timeline.yaml. Switch to the timeline.yaml tab for visual schedule editing. Configure notification channels (Telegram / WeCom, etc.) in the left editor.'],

        // AI
        ['ctrl.modelName', '模型名称', 'Model Name'],
        ['ctrl.apiKey', 'API Key', 'API Key'],
        ['ctrl.apiBase', 'API Base URL (可选)', 'API Base URL (optional)'],
        ['ctrl.timeout', '请求超时 (秒)', 'Request timeout (sec)'],
        ['ctrl.temperature', '采样温度 (0.0-2.0)', 'Temperature (0.0-2.0)'],
        ['ctrl.maxTokens', '最大生成 Token 数', 'Max tokens'],

        // AI Analysis
        ['ctrl.enableAnalysis', '开启 AI 分析报告', 'Enable AI analysis report'],
        ['ctrl.analysisTimeNote', 'AI 分析的执行时间已由 timeline.yaml 统一控制。', 'AI analysis timing is now controlled by timeline.yaml.'],
        ['ctrl.analysisContentConfig', '分析内容配置', 'Analysis Content Config'],
        ['ctrl.outputLanguage', '输出语言', 'Output Language'],
        ['ctrl.promptConfigFile', '提示词配置文件', 'Prompt config file'],
        ['ctrl.aiAnalysisMode', 'AI 分析模式', 'AI Analysis Mode'],
        ['ctrl.maxNewsForAnalysis', '最大分析条数', 'Max items for analysis'],
        ['ctrl.includeRss', '包含 RSS 内容', 'Include RSS content'],
        ['ctrl.includeWebSearch', '包含联网搜索结果（含摘要）', 'Include web search results (with snippets)'],
        ['ctrl.searchSummaryMaxChars', '每条搜索结果发给 AI 的最大摘要字数', 'Max summary chars per search item for AI'],
        ['ctrl.includeStandalone', '包含独立展示区数据', 'Include standalone data'],
        ['ctrl.includeRankTimeline', '传递完整排名时间线', 'Pass full rank timeline'],

        // AI Translation
        ['ctrl.enableTranslation', '开启 AI 自动翻译', 'Enable AI auto-translation'],
        ['ctrl.targetLanguage', '目标语言', 'Target Language'],
        ['ctrl.translationBatchSize', '每批翻译标题数', 'Titles per translation batch'],
        ['ctrl.translationScope', '翻译范围', 'Translation Scope'],
        ['ctrl.translationScopeHint', '若推送内容控制中关闭了某个区域，这里开启也不会翻译。', 'Regions turned off in Push Content Control will not be translated even if enabled here.'],
        ['ctrl.transScopeHotlist', '翻译热榜标题', 'Translate hot list titles'],
        ['ctrl.transScopeRss', '翻译 RSS 标题', 'Translate RSS titles'],
        ['ctrl.transScopeWebSearch', '翻译联网搜索标题与摘要（搜外文时建议开启）', 'Translate web search titles & snippets'],
        ['ctrl.transScopeStandalone', '翻译独立展示区标题', 'Translate standalone titles'],
    ]);

    // ═══════════════════════════════════════
    //  Display Regions
    // ═══════════════════════════════════════
    add([
        ['region.hotlist', '热榜区域', 'Hot List'],
        ['region.new_items', '新增热点区域', 'New Items'],
        ['region.rss', 'RSS 订阅区域', 'RSS Feeds'],
        ['region.web_search', '联网搜索区域', 'Web Search'],
        ['region.standalone', '独立展示区', 'Standalone'],
        ['region.ai_analysis', 'AI 分析区域', 'AI Analysis'],
    ]);

    // ═══════════════════════════════════════
    //  Toast Messages
    // ═══════════════════════════════════════
    add([
        ['toast.configRestored', '已恢复上次保存的配置', 'Previous config restored'],
        ['toast.manualSave', '已手动保存配置', 'Config saved manually'],
        ['toast.resetDone', '已重置为初始状态', 'Reset to initial state'],
        ['toast.loadingConfig', '正在加载最新配置...', 'Loading latest config...'],
        ['toast.loaded', '已加载: ', 'Loaded: '],
        ['toast.loadFailed', '加载失败: ', 'Load failed: '],
        ['toast.yamlError', 'YAML 语法错误: ', 'YAML syntax error: '],
        ['toast.fileReadFail', '文件读取失败', 'File read failed'],
        ['toast.selectOneFile', '请至少选择一个文件', 'Please select at least one file'],
        ['toast.allSourcesFailed', '所有源均不可用，请检查网络连接', 'All sources unavailable, check network connection'],
        ['toast.updatedToLatest', '已更新到最新版本', 'Updated to latest version'],
        ['toast.updateFailed', '更新失败: ', 'Update failed: '],
        ['toast.loadingLatest', '正在加载最新版本...', 'Loading latest version...'],
        ['toast.versionCheckFailed', '版本检测失败: ', 'Version check failed: '],
        ['toast.platformAdded', '平台 {0} 已添加', 'Platform {0} added'],
        ['toast.switchedToMode', '已切换至「{0}」模式', 'Switched to "{0}" mode'],
        ['toast.presetCreated', '调度模式「{0}」创建成功', 'Schedule mode "{0}" created'],
        ['toast.periodAdded', '时间段「{0}」添加成功', 'Period "{0}" added'],
        ['toast.periodDeleted', '时间段「{0}」已删除', 'Period "{0}" deleted'],
        ['toast.duplicatedAs', '已复制为「{0}」', 'Duplicated as "{0}"'],
        ['toast.presetDeleted', '调度模式「{0}」已删除', 'Schedule mode "{0}" deleted'],
        ['toast.dayPlanAdded', '日计划「{0}」已添加', 'Day plan "{0}" added'],
        ['toast.dayPlanDeleted', '日计划「{0}」已删除', 'Day plan "{0}" deleted'],
        ['toast.weekMapUpdated', '周映射已更新', 'Week map updated'],
        ['toast.builtinNoDelete', '内置预设不可删除，可使用复制功能', 'Built-in presets cannot be deleted. Use duplicate instead.'],
        ['toast.customNoDelete', 'custom 模式不可删除', 'Custom mode cannot be deleted'],
        ['toast.enterPresetKey', '请输入模式标识 (key)', 'Please enter mode key'],
        ['toast.invalidKey', 'key 仅支持英文、数字和下划线，且不能以数字开头', 'Key: letters, digits and underscores only, cannot start with a digit'],
        ['toast.enterName', '请输入显示名称', 'Please enter display name'],
        ['toast.presetExists', '预设「{0}」已存在', 'Preset "{0}" already exists'],
        ['toast.noCustomKey', '不能使用 "custom" 作为预设名', 'Cannot use "custom" as a preset name'],
        ['toast.enterPeriodKey', '请输入时间段标识 (key)', 'Please enter period key'],
        ['toast.enterPeriodName', '请输入显示名称', 'Please enter display name'],
        ['toast.setTime', '请设置开始和结束时间', 'Please set start and end time'],
        ['toast.sameTime', '开始时间和结束时间不能相同', 'Start and end time cannot be the same'],
        ['toast.periodExists', '时间段「{0}」已存在', 'Period "{0}" already exists'],
        ['toast.presetSectionNotFound', '未找到预设配置段', 'Preset config section not found'],
        ['toast.periodsNotFound', '未找到 periods 配置段', 'Periods config section not found'],
        ['toast.noDayPlans', '没有可用的日计划', 'No day plans available'],
        ['toast.needTwoDayPlans', '需要至少两个日计划来分离工作日/周末', 'Need at least two day plans to separate weekday/weekend'],
        ['toast.cannotDeleteDayPlan', '无法删除：「{0}」正在被 {1} 使用。请先修改周映射。', 'Cannot delete: "{0}" is in use by {1}. Modify the week map first.'],
        ['toast.invalidKeyFormat', 'key 仅支持英文、数字和下划线', 'Key: letters, digits and underscores only'],
        ['toast.dayPlanExists', '日计划「{0}」已存在', 'Day plan "{0}" already exists'],
        ['toast.platformExists', '平台 {0} 已存在！', 'Platform {0} already exists!'],
        ['toast.dragYaml', '请拖入 YAML 文件', 'Please drag a YAML file'],
        ['toast.dragTxt', '请拖入 TXT 文件', 'Please drag a TXT file'],
    ]);

    // ═══════════════════════════════════════
    //  Confirm / Alert Dialogs
    // ═══════════════════════════════════════
    add([
        ['confirm.reset', '确定要重置为初始状态吗？未保存的修改将丢失。', 'Reset to initial state? Unsaved changes will be lost.'],
        ['confirm.deletePlatform', '确定要删除平台 "{0}" 吗？', 'Delete platform "{0}"?'],
        ['confirm.deleteRss', '确定要删除 RSS 源 "{0}" 吗？', 'Delete RSS feed "{0}"?'],
        ['confirm.deletePeriod', '确定删除时间段「{0}」？', 'Delete period "{0}"?'],
        ['confirm.periodInUse', '\n\n⚠️ 该时间段被以下日计划引用，将同时移除引用：\n', '\n\n⚠️ This period is referenced by the following day plans and will be removed:\n'],
        ['confirm.deletePreset', '确定删除调度模式「{0}」？\n此操作不可撤销。', 'Delete schedule mode "{0}"?\nThis cannot be undone.'],
        ['confirm.deleteDayPlan', '确定删除日计划「{0}」？', 'Delete day plan "{0}"?'],
        ['confirm.updateFile', '确定要从 GitHub 更新 {0} 到最新版本吗？\n\n你当前的自定义配置将被覆盖，建议先复制保存。', 'Update {0} to latest from GitHub?\n\nYour custom config will be overwritten. Save a copy first.'],
        ['alert.fillRequired', '请填写完整信息：ID、名称和 URL 都是必填项', 'Please fill in all required fields: ID, Name, and URL'],
        ['alert.enterPlatformKey', '请输入平台 Key', 'Please enter platform key'],
        ['alert.clickToAdd', '请直接点击上方列表中的平台进行添加', 'Click a platform in the list above to add it'],
        ['prompt.enterDayPlanKey', '请输入日计划标识 (key)，如 holiday：', 'Enter day plan key (e.g., holiday):'],
        ['prompt.enterCoreKeyword', '请输入核心关键词（例如：华为）：', 'Enter core keyword (e.g., Huawei):'],
    ]);

    // ═══════════════════════════════════════
    //  Load Config Modal
    // ═══════════════════════════════════════
    add([
        ['loadModal.title', '加载官网最新配置', 'Load Latest Config'],
        ['loadModal.desc', '选择要从 GitHub 加载的配置文件：', 'Select config files to load from GitHub:'],
        ['loadModal.configDesc', '系统配置、平台、AI、通知等', 'System config, platforms, AI, notifications, etc.'],
        ['loadModal.frequencyDesc', '关键词组、过滤规则、正则逻辑', 'Keyword groups, filter rules, regex logic'],
        ['loadModal.searchDesc', '联网搜索主题、搜索词与全局屏蔽规则', 'Web search topics, queries & global exclusions'],
        ['loadModal.timelineDesc', '调度时间线、预设模板、自定义时间段', 'Scheduling timeline, presets, custom periods'],
        ['loadModal.source', '数据来源：', 'Data source: '],
        ['loadModal.cancel', '取消', 'Cancel'],
        ['loadModal.loadSelected', '加载选中', 'Load Selected'],
    ]);

    // ═══════════════════════════════════════
    //  Version Comparison Modal
    // ═══════════════════════════════════════
    add([
        ['version.title', '版本检测结果', 'Version Check Result'],
        ['version.noVersion', '未检测到版本信息', 'Version info not detected'],
        ['version.newVersion', '发现新版本', 'New version available'],
        ['version.devVersion', '当前版本较新（开发版本？）', 'Current version is newer (dev version?)'],
        ['version.upToDate', '已是最新版本', 'Up to date'],
        ['version.close', '关闭', 'Close'],
        ['version.updateNow', '立即更新', 'Update Now'],
        ['version.updateLater', '稍后更新', 'Update Later'],
        ['version.updateToLatest', '更新到最新版本', 'Update to Latest'],
        ['version.configFile', '配置文件', 'Config File'],
        ['version.currentVersion', '当前版本', 'Current Version'],
        ['version.latestVersion', '最新版本', 'Latest Version'],
        ['version.unknown', '未知', 'Unknown'],
        ['version.updateHint', '更新将从 GitHub 加载最新的 {0}，你当前的修改将被覆盖。建议先复制保存你的自定义配置。', 'Update will load the latest {0} from GitHub. Your changes will be overwritten. Save a copy of your config first.'],
        ['version.notFoundRemote', '未在远程版本清单中找到 {0}', '{0} not found in remote version list'],
        ['version.fetchFailed', '版本信息获取失败: {0}', 'Failed to fetch version info: {0}'],
        ['version.checking', '检测中...', 'Checking...'],
    ]);

    // ═══════════════════════════════════════
    //  RSS Modal
    // ═══════════════════════════════════════
    add([
        ['rssModal.addTitle', '添加 RSS 源', 'Add RSS Feed'],
        ['rssModal.editTitle', '编辑 RSS 源', 'Edit RSS Feed'],
        ['rssModal.idLabel', '源 ID（唯一标识，英文）', 'Feed ID (unique, alphanumeric)'],
        ['rssModal.idPlaceholder', '例如: my-blog', 'e.g., my-blog'],
        ['rssModal.nameLabel', '显示名称', 'Display Name'],
        ['rssModal.namePlaceholder', '例如: 我的博客', 'e.g., My Blog'],
        ['rssModal.urlLabel', 'RSS URL', 'RSS URL'],
        ['rssModal.maxAgeLabel', '最大文章年龄（天，可选）', 'Max article age (days, optional)'],
        ['rssModal.maxAgePlaceholder', '留空使用全局设置', 'Leave empty to use global setting'],
        ['rssModal.tipsTitle', 'RSS 订阅灵感 & 参考库', 'RSS Inspiration & Reference Library'],
        ['rssModal.tipsHasFeeds', '(内附常用源)', '(common feeds included)'],
        ['rssModal.bingNews', 'Bing 新闻 (支持任意关键词)', 'Bing News (supports any keyword)'],
        ['rssModal.bingTip', '小贴士：修改 URL 中的', 'Tip: Modify the'],
        ['rssModal.bingTipSuffix', '参数即可监控任何你感兴趣的话题。', 'parameter to monitor any topic you like.'],
        ['rssModal.moreRef', '更多 RSS 源参考', 'More RSS Feed References'],
        ['rssModal.techProgramming', '科技/编程', 'Tech/Programming'],
        ['rssModal.globalNews', '全球新闻', 'Global News'],
        ['rssModal.ai', '人工智能', 'AI'],
        ['rssModal.finance', '黄金/财经', 'Gold/Finance'],
        ['rssModal.disclaimer', '免责声明：以上 RSS 示例及第三方工具均源自互联网，开发者未一一验证其长期有效性，请你在使用前自行核实。', 'Disclaimer: The RSS examples and third-party tools above are from the internet. The developer has not verified their long-term availability. Please verify before use.'],
        ['rssModal.cancel', '取消', 'Cancel'],
        ['rssModal.add', '添加', 'Add'],
        ['rssModal.disabled', '已禁用', 'Disabled'],
    ]);

    // ═══════════════════════════════════════
    //  Platform Modal
    // ═══════════════════════════════════════
    add([
        ['platModal.title', '添加热榜平台', 'Add Hot List Platform'],
        ['platModal.selectPreset', '选择预设', 'Select Preset'],
        ['platModal.manualInput', '手动输入', 'Manual Input'],
        ['platModal.customNote', '自定义平台需要后端爬虫支持，此处仅用于配置占位。', 'Custom platforms require backend crawler support. This is for config placeholder only.'],
        ['platModal.keyLabel', '平台 Key（英文）', 'Platform Key (alphanumeric)'],
        ['platModal.keyPlaceholder', '例如: sspai', 'e.g., sspai'],
        ['platModal.nameLabel', '显示名称', 'Display Name'],
        ['platModal.namePlaceholder', '例如: 少数派', 'e.g., Sspai'],
        ['platModal.allAdded', '所有预设平台已添加', 'All preset platforms added'],
        ['platModal.cancel', '取消', 'Cancel'],
        ['platModal.add', '添加', 'Add'],
    ]);

    // ═══════════════════════════════════════
    //  Word Group Type Modal
    // ═══════════════════════════════════════
    add([
        ['wgModal.title', '选择词组类型', 'Select Word Group Type'],
        ['wgModal.groupAlias', '组别名', 'Group Alias'],
        ['wgModal.groupAliasDesc', '多关键词词组（推荐）', 'Multi-keyword group (recommended)'],
        ['wgModal.groupAliasUse', '适用于：多个关键词归为一组，统一显示为组名', 'Use for: grouping multiple keywords under one display name'],
        ['wgModal.singleAlias', '单个别名', 'Single Alias'],
        ['wgModal.singleAliasDesc', '正则/关键词 + 别名', 'Regex/keyword + alias'],
        ['wgModal.singleAliasUse', '适用于：用正则匹配多个词，显示为一个别名（前后有空行分隔）', 'Use for: matching multiple words via regex, displayed as one alias'],
        ['wgModal.multiAlias', '连续别名组', 'Multi-alias Group'],
        ['wgModal.multiAliasDesc', '多个相关品牌/词组', 'Multiple related brands/phrases'],
        ['wgModal.multiAliasUse', '适用于：多个相关品牌放在一起（无空行分隔）', 'Use for: related brands together (no blank line separator)'],
        ['wgModal.plain', '普通词组', 'Plain Keywords'],
        ['wgModal.plainDesc', '简单关键词', 'Simple keywords'],
        ['wgModal.plainUse', '适用于：单个或少量普通关键词', 'Use for: one or a few plain keywords'],
        ['wgModal.cancel', '取消', 'Cancel'],
    ]);

    // ═══════════════════════════════════════
    //  Timeline Modals
    // ═══════════════════════════════════════
    add([
        ['tlModal.newPreset', '新建调度模式', 'New Schedule Mode'],
        ['tlModal.presetKeyLabel', '模式标识 (key)', 'Mode Key'],
        ['tlModal.presetKeyPlaceholder', '英文标识，如 my_schedule', 'Alphanumeric key, e.g., my_schedule'],
        ['tlModal.presetKeyHint', '仅支持英文、数字和下划线，将作为 YAML 中的 key', 'Letters, digits and underscores only, used as YAML key'],
        ['tlModal.nameLabel', '显示名称', 'Display Name'],
        ['tlModal.descLabel', '描述（可选）', 'Description (optional)'],
        ['tlModal.templateLabel', '基于模板', 'Based on Template'],
        ['tlModal.emptyTemplate', '空白模板（仅采集，不推送不分析）', 'Blank template (collect only, no push/analysis)'],
        ['tlModal.templateHint', '复制已有模式的全部配置作为起点', 'Copy all config from an existing mode as starting point'],
        ['tlModal.cancel', '取消', 'Cancel'],
        ['tlModal.create', '创建', 'Create'],

        ['tlModal.newPeriod', '新增时间段', 'New Period'],
        ['tlModal.periodKeyLabel', '时间段标识 (key)', 'Period Key'],
        ['tlModal.periodKeyPlaceholder', '英文标识，如 morning_push', 'Alphanumeric key, e.g., morning_push'],
        ['tlModal.periodKeyHint', '仅支持英文、数字和下划线', 'Letters, digits and underscores only'],
        ['tlModal.periodNamePlaceholder', '如：晨间推送', 'e.g., Morning Push'],
        ['tlModal.startTime', '开始时间', 'Start Time'],
        ['tlModal.endTime', '结束时间', 'End Time'],
        ['tlModal.crossMidnight', '如果开始时间 > 结束时间（如 22:00～01:00），将自动识别为跨午夜时间段。', 'If start > end (e.g., 22:00–01:00), it will be treated as a cross-midnight period.'],
        ['tlModal.add', '添加', 'Add'],
    ]);

    // ═══════════════════════════════════════
    //  Sidebar
    // ═══════════════════════════════════════
    add([
        ['sidebar.title', '支持项目', 'Support'],
        ['sidebar.quote', '若 TrendRadar 曾为你捕捉价值，不妨为它注入动力，助其持续进化', 'If TrendRadar has been valuable to you, help fuel its growth'],
        ['sidebar.star', '点亮 Star', 'Star Us'],
        ['sidebar.starDesc', '让更多人发现它', 'Help others discover it'],
        ['sidebar.goGithub', '前往 GitHub', 'Go to GitHub'],
        ['sidebar.follow', '不迷路', 'Stay Updated'],
        ['sidebar.followDesc', '获取更新通知', 'Get update notifications'],
        ['sidebar.scanFollow', '扫码关注公众号', 'Scan to follow on WeChat'],
        ['sidebar.donate', '随心赞赏', 'Donate'],
        ['sidebar.donateDesc', '1 元也是鼓励', 'Every bit helps'],
        ['sidebar.scanDonate', '微信扫码 · 丰俭由人', 'WeChat scan · any amount'],
        ['sidebar.explore', '探索更多', 'Explore More'],
        ['sidebar.exploreDesc', '另一个用心的作品', 'Another well-crafted project'],
        ['sidebar.goExplore', '去看看', 'Check it out'],
        ['sidebar.footer', '"开源不易，感谢支持"', '"Open source isn\'t easy — thanks for your support"'],
        ['sidebar.clickEnlarge', '点击放大', 'Click to enlarge'],
        ['sidebar.expand', '展开侧栏', 'Expand sidebar'],
        ['sidebar.collapse', '收起侧栏', 'Collapse sidebar'],
    ]);

    // ═══════════════════════════════════════
    //  QR Modal
    // ═══════════════════════════════════════
    add([
        ['qr.weixin.title', '不迷路', 'Stay Updated'],
        ['qr.weixin.subtitle', '第一时间获取更新通知', 'Get notified of updates first'],
        ['qr.weixin.hint', '微信扫码关注公众号', 'Scan to follow our WeChat account'],
        ['qr.donate.title', '随心赞赏', 'Donate'],
        ['qr.donate.subtitle', '金额随意，1 元也是鼓励 (´▽`ʃ♡ƪ)', 'Any amount is an encouragement (´▽`ʃ♡ƪ)'],
        ['qr.donate.hint', '微信扫码 · 丰俭由人', 'WeChat scan · any amount'],
    ]);

    // ═══════════════════════════════════════
    //  Frequency Editor
    // ═══════════════════════════════════════
    add([
        ['freq.typesTitle', '四种词组类型说明', 'Four Word Group Types'],
        ['freq.groupAlias', '组别名', 'Group Alias'],
        ['freq.groupAliasDesc', '多个关键词，统一显示为组名', 'Multiple keywords, displayed as group name'],
        ['freq.singleAlias', '单个别名', 'Single Alias'],
        ['freq.singleAliasDesc', '正则匹配，显示为别名', 'Regex match, displayed as alias'],
        ['freq.multiAlias', '连续别名组', 'Multi-alias Group'],
        ['freq.multiAliasDesc', '多个别名无空行分隔', 'Multiple aliases, no blank line separator'],
        ['freq.plain', '普通词组', 'Plain Keywords'],
        ['freq.plainDesc', '普通关键词', 'Plain keywords'],
        ['freq.globalFilter', '全局过滤词', 'Global Filter'],
        ['freq.globalFilterPlaceholder', '输入过滤词后按回车...', 'Enter a filter word, press Enter...'],
        ['freq.regexHint', '支持正则表达式（用 /.../ 包裹）', 'Supports regex (wrap with /.../)'],
        ['freq.keywordGroups', '关键词组', 'Keyword Groups'],
        ['freq.nGroups', ' 个词组', ' groups'],
        ['freq.addGroup', '添加词组', 'Add Group'],
        ['freq.addGroupBottom', '在底部添加词组', 'Add group at bottom'],
        ['freq.keywordList', '关键词列表：', 'Keyword list:'],
        ['freq.keywordPlaceholder', '输入关键词后按回车...', 'Enter keyword, press Enter...'],
        ['freq.nKeywords', ' 个关键词', ' keywords'],
        ['freq.aiWriteRegex', 'AI 写正则', 'AI Generate Regex'],
        ['freq.aliasList', '别名列表（无空行分隔）：', 'Alias list (no blank line separator):'],
        ['freq.aliasHint', '这些别名行在配置文件中无空行分隔，属于同一组', 'These alias lines have no blank line separator in the config and belong to the same group'],
        ['freq.aliasExample', '示例：/胖东来|于东来/ => 胖东来', 'Example: /term1|term2/ => DisplayName'],
        ['freq.relatedGroup', '相关组', 'Related'],
        ['freq.required', '必须', 'Required'],
        ['freq.exclude', '排除', 'Exclude'],
        ['freq.limit', '限制', 'Limit'],
        ['freq.regex', '正则', 'Regex'],
        ['freq.alias', '别名', 'Alias'],
        ['freq.groupNamePlaceholder', '组别名（如：东亚）', 'Group alias (e.g., East Asia)'],
        ['freq.regexPlaceholder', '/正则/ 或 关键词', '/regex/ or keyword'],
        ['freq.aliasPlaceholder', '别名', 'Alias'],
        ['freq.noPlatforms', '暂无平台，请添加', 'No platforms yet'],
        ['freq.noRssFeeds', '暂无 RSS 源，请添加', 'No RSS feeds yet'],
        ['freq.noAvailPlatforms', '暂无可用平台', 'No platforms available'],
        ['freq.noAvailRss', '暂无可用 RSS 源', 'No RSS feeds available'],
    ]);

    // ═══════════════════════════════════════
    //  Timeline Editor
    // ═══════════════════════════════════════
    add([
        ['tl.scheduleMode', '调度模式', 'Schedule Mode'],
        ['tl.weekView', '周视图', 'Week View'],
        ['tl.recommend', '推荐', 'Recommended'],
        ['tl.current', '当前', 'Active'],
        ['tl.newMode', '新建模式', 'New Mode'],
        ['tl.newModeDesc', '创建自定义调度方案', 'Create custom schedule'],
        ['tl.presetNotFound', '未找到预设「{0}」的配置', 'Config for preset "{0}" not found'],
        ['tl.pasteTimeline', '请在左侧粘贴 timeline.yaml 内容', 'Paste timeline.yaml content on the left'],
        ['tl.orLoadConfig', '或点击右上角「加载官网最新配置」', 'Or click "Load Latest Config" at top right'],

        ['tl.defaultConfig', '默认配置 (default)', 'Default Config'],
        ['tl.defaultDesc', '不在任何时间段内时，使用以下配置：', 'Config used when outside any period:'],
        ['tl.periods', '时间段 (Periods)', 'Periods'],
        ['tl.addNew', '新增', 'Add'],
        ['tl.noPeriods', '此模式无自定义时间段，全天使用 default 配置', 'No custom periods. Default config used all day.'],
        ['tl.dayPlans', '日计划 (Day Plans)', 'Day Plans'],
        ['tl.weekMap', '周映射 (Week Map)', 'Week Map'],
        ['tl.overlapPolicy', '冲突策略 (Overlap)', 'Overlap Policy'],
        ['tl.allWeekSame', '全周统一', 'All Week Same'],
        ['tl.weekdaySame', '工作日统一', 'Weekdays Same'],
        ['tl.weekdayWeekend', '工作日/周末', 'Weekday/Weekend'],

        ['tl.legend.push', '推送', 'Push'],
        ['tl.legend.analyze', 'AI 分析', 'AI Analysis'],
        ['tl.legend.pushAnalyze', '推送 + 分析', 'Push + Analysis'],
        ['tl.legend.collect', '仅采集', 'Collect Only'],
        ['tl.legend.default', '默认 (default)', 'Default'],

        ['tl.collect', '采集', 'Collect'],
        ['tl.analyze', '分析', 'Analyze'],
        ['tl.push', '推送', 'Push'],
        ['tl.report', '报告:', 'Report:'],
        ['tl.aiMode', 'AI:', 'AI:'],
        ['tl.analyzeOnce', '仅分析一次', 'Analyze once'],
        ['tl.pushOnce', '仅推送一次', 'Push once'],
        ['tl.searchOnce', '仅搜一次', 'Search once'],
        ['tl.time', '时间:', 'Time:'],
        ['tl.filterOverride', '筛选与联网搜索覆盖（可选）', 'Filter & Web Search Override (optional)'],
        ['tl.searchSwitch', '本时段联网搜索', 'Web search in this period'],
        ['tl.searchFollowCollect', '跟随采集（默认）', 'Follow collect (default)'],
        ['tl.searchInherit', '继承默认设置', 'Inherit default'],
        ['tl.searchOn', '开启联网搜索', 'Enable web search'],
        ['tl.searchOff', '关闭（跳过搜索）', 'Disable (skip search)'],
        ['tl.searchFile', '自定义搜索任务文件 (search_file)', 'Custom search file (search_file)'],
        ['tl.searchFilePlaceholder', '如 policy.txt（留空用默认）', 'e.g. policy.txt (empty = default)'],
        ['tl.searchOverrideHint', '联网搜索不填则默认跟随“采集”开关；自定义任务文件从 config/custom/search/ 查找，留空恢复默认。', 'Web search follows Collect when unset; custom search_file resolves from config/custom/search/ (empty restores default).'],
        ['tl.legend.searchOn', '联网搜索', 'Web Search'],
        ['tl.legend.searchOff', '跳过搜索', 'Skip Search'],
        ['tl.inherit', '继承', 'Inherit'],
        ['tl.emptyDayPlan', '空 (全天走 default)', 'Empty (default all day)'],
        ['tl.notSet', '(未设置)', '(not set)'],
        ['tl.dayPlanLabel', '日计划:', 'Day plan:'],
        ['tl.usesDefault', '使用 default 配置', 'Uses default config'],
        ['tl.copy', '副本', 'Copy'],

        ['tl.presetHint', '直接在上方调整开关和下拉框，左侧 YAML 会同步更新。如需更精细的控制，可直接编辑左侧 YAML 或修改 timeline.yaml。', 'Adjust toggles and dropdowns above — the YAML on the left updates in sync. For finer control, edit the YAML directly.'],
        ['tl.customHint', '自定义模式支持完全自由编辑。可直接在上方调整控件，或在左侧编辑 YAML 文本，两边实时同步。', 'Custom mode supports full editing. Adjust controls above or edit YAML text on the left — both sync in real time.'],
        ['tl.filterMethodHint.default', '不填则跟随全局 filter.method', 'Leave empty to follow global filter.method'],
        ['tl.filterMethodHint.period', '不填则继承 default（再回退全局）', 'Leave empty to inherit from default (then fall back to global)'],
        ['tl.filterFileHint', '。frequency_file 从 config/custom/keyword/ 查找，interests_file 从 config/custom/ai/ 查找；留空会删除该字段并恢复继承。', '. frequency_file resolves from config/custom/keyword/, interests_file from config/custom/ai/; empty removes the field and restores inheritance.'],
        ['tl.overlapHint', 'error_on_overlap 会在时间段重叠时直接报错；last_wins 会按 day_plans 中靠后的时间段覆盖。', 'error_on_overlap raises an error on overlap; last_wins lets later periods in day_plans take precedence.'],
        ['tl.errorOnOverlap', 'error_on_overlap（推荐）', 'error_on_overlap (recommended)'],
        ['tl.lastWins', 'last_wins（后定义优先）', 'last_wins (last defined wins)'],
        ['tl.addPeriod', '+ 添加', '+ Add'],
        ['tl.custom', '自定义', 'Custom'],
    ]);

    // ═══════════════════════════════════════
    //  Day Names
    // ═══════════════════════════════════════
    add([
        ['day.1', '周一', 'Mon'],
        ['day.2', '周二', 'Tue'],
        ['day.3', '周三', 'Wed'],
        ['day.4', '周四', 'Thu'],
        ['day.5', '周五', 'Fri'],
        ['day.6', '周六', 'Sat'],
        ['day.7', '周日', 'Sun'],
    ]);

    // ═══════════════════════════════════════
    //  Preset Platform Names
    // ═══════════════════════════════════════
    add([
        ['plat.toutiao', '今日头条', 'Toutiao'],
        ['plat.baidu', '百度热搜', 'Baidu Hot'],
        ['plat.wallstreetcn-hot', '华尔街见闻', 'WallStreetCN'],
        ['plat.thepaper', '澎湃新闻', 'The Paper'],
        ['plat.bilibili-hot-search', 'bilibili 热搜', 'Bilibili Hot'],
        ['plat.cls-hot', '财联社热门', 'CLS Hot'],
        ['plat.ifeng', '凤凰网', 'iFeng'],
        ['plat.tieba', '贴吧', 'Tieba'],
        ['plat.weibo', '微博', 'Weibo'],
        ['plat.douyin', '抖音', 'Douyin'],
        ['plat.zhihu', '知乎', 'Zhihu'],
    ]);

    // ═══════════════════════════════════════
    //  Initial / Placeholder Text
    // ═══════════════════════════════════════
    add([
        ['init.configPlaceholder', '# 在此粘贴你的 config.yaml...\n# 或拖拽文件到编辑器区域\n# 或点击右上角"加载官网最新配置"', '# Paste your config.yaml here...\n# Or drag a file into the editor\n# Or click "Load Latest Config" at top right'],
        ['init.frequencyPlaceholder', '# 在此粘贴你的 frequency_words.txt 内容...\n# 或拖拽文件到编辑器区域\n\n[GLOBAL_FILTER]\n\n[WORD_GROUPS]\n', '# Paste your frequency_words.txt here...\n# Or drag a file into the editor\n\n[GLOBAL_FILTER]\n\n[WORD_GROUPS]\n'],
        ['init.timelinePlaceholder', '# 在此粘贴你的 timeline.yaml...\n# 或拖拽文件到编辑器区域\n# 或点击右上角"加载官网最新配置"', '# Paste your timeline.yaml here...\n# Or drag a file into the editor\n# Or click "Load Latest Config" at top right'],
        ['init.releaseToLoad', '释放以加载文件', 'Release to load file'],
    ]);

    // ═══════════════════════════════════════
    //  Search Queries Editor
    // ═══════════════════════════════════════
    add([
        ['search.guideTitle', '怎么写联网搜索任务？', 'How to Write Search Tasks'],
        ['search.guideDesc', '直接像平时上网搜索那样写你想关注的话题即可！每个卡片是一个独立的搜索主题，支持拖拉排序，左右两边实时同步。', 'Write what you want to track just like searching the web. Each card is a separate search topic — drag to reorder, synced in real time.'],
        ['search.loadZhTemplate', '中文示例', 'Chinese Example'],
        ['search.loadEnTemplate', 'English Example', 'English Example'],
        ['search.templateLoaded', '已载入默认示例模板', 'Default example template loaded'],
        ['search.confirmLoadTemplate', '载入示例将覆盖当前 search_queries.txt 中的内容，确定继续吗？', 'Loading the example will replace your current search_queries.txt content. Continue?'],
        ['search.syntaxSummary', '常用小技巧：', 'Quick tips: '],
        ['search.tipTopic', '[主题名] 起名字', '[Topic] name'],
        ['search.tipSite', 'site:gov.cn 只看官网', 'site:domain only'],
        ['search.tipExcludeSite', '-site:域名 屏蔽网站', '-site:domain exclude'],
        ['search.tipExcludeWord', '!词 排除词', '!word exclude'],
        ['search.tipLimit', '@5 最多5条', '@5 max items'],
        ['search.tipDays', '~7d 近7天', '~7d last N days'],
        ['search.tipProvider', '@provider:引擎 换引擎', '@provider:name engine'],

        ['search.globalFilterTitle', '全局屏蔽区（可选）', 'Global Exclusions (optional)'],
        ['search.globalFilterDesc', '写在这里的词或网站，所有搜索任务都会自动避开。', 'Words or websites listed here are automatically filtered out from all search topics.'],
        ['search.globalWordPlaceholder', '输入不想看到的词（如：震惊），按回车添加...', 'Type a word to exclude (e.g. clickbait) and press Enter...'],
        ['search.globalSitePlaceholder', '输入要屏蔽的网站域名（如：baijiahao.baidu.com）', 'Domain to block (e.g. example.com)'],
        ['search.addExcludeSite', '屏蔽网站', 'Block Site'],
        ['search.noGlobalFilter', '暂无全局屏蔽规则', 'No global exclusions yet'],

        ['search.topicsTitle', '搜索任务列表', 'Search Topics'],
        ['search.nTopics', ' 个任务', ' topics'],
        ['search.addTopic', '新增任务', 'Add Topic'],
        ['search.addTopicBottom', '在底部新增搜索任务', 'Add Search Topic'],
        ['search.noTopics', '还没有搜索任务，点击上方「新增任务」开始添加吧！', 'No search topics yet. Click "Add Topic" above to create one!'],
        ['search.topicNamePlaceholder', '给这组搜索起个名字（可选，留空自动用第一条搜索词当标题）', 'Topic name (optional; uses first query if blank)'],
        ['search.queriesLabel', '想搜什么？（同一主题下可写多条，结果自动合并去重）', 'What to search? (Multiple lines are merged & deduplicated)'],
        ['search.queryPlaceholder', '输入想搜的关键词或问题，例如：低空经济 最新政策 site:gov.cn', 'Enter keywords or a question, e.g. AI policy latest update'],
        ['search.addQueryLine', '再加一条搜索词', 'Add another query'],
        ['search.insertSiteHelper', '+ 只看某官网 (site:)', '+ Only site:'],
        ['search.promptSiteDomain', '请输入只看哪个网站的域名（例如 gov.cn 或 github.com）：', 'Enter domain to search exclusively (e.g. gov.cn or github.com):'],
        ['search.optionsLabel', '本主题独立设置（留空则跟随 config.yaml 全局设置）', 'Per-topic overrides (empty follows config.yaml defaults)'],
        ['search.optMaxItems', '最多展示条数 (@数字)', 'Max items (@N)'],
        ['search.optMaxItemsPh', '跟随全局', 'Global default'],
        ['search.optFreshness', '只看近几天 (~Nd，0=不限)', 'Last N days (~Nd, 0=any)'],
        ['search.optFreshnessPh', '跟随全局', 'Global default'],
        ['search.optProvider', '指定搜索引擎 (@provider:)', 'Search engine (@provider:)'],
        ['search.optProviderPh', '跟随全局', 'Global default'],
        ['search.topicExcludesLabel', '本主题额外屏蔽（可选）', 'Topic-specific exclusions (optional)'],
        ['search.topicExcludePlaceholder', '输入排除词（按回车）或 -site:域名...', 'Type word to exclude (Enter) or -site:domain...'],
        ['search.newTopicDefaultName', '新搜索主题', 'New Search Topic'],
        ['search.newTopicDefaultQuery', '请输入你要搜索的关键词或问题', 'Enter your search query here'],
        ['search.confirmDeleteTopic', '确定删除搜索任务「{0}」吗？', 'Delete search topic "{0}"?'],
    ]);

    // ═══════════════════════════════════════
    //  Common / Misc
    // ═══════════════════════════════════════
    add([
        ['common.cancel', '取消', 'Cancel'],
        ['common.add', '添加', 'Add'],
        ['common.delete', '删除', 'Delete'],
        ['common.edit', '编辑', 'Edit'],
        ['common.enable', '启用', 'Enable'],
        ['common.disable', '禁用', 'Disable'],
        ['common.close', '关闭', 'Close'],
        ['common.copy', '复制', 'Copy'],
        ['common.save', '保存', 'Save'],
        ['common.hint', '提示：', 'Tip: '],
        ['common.note', '注意：', 'Note: '],
        ['common.warning', '注意：', 'Warning: '],
        ['common.description', '说明：', 'Description: '],
        ['common.jumpToEditor', '跳转到左侧编辑器', 'Jump to left editor'],
    ]);

    // ═══════════════════════════════════════
    //  DeepSeek AI Prompt
    // ═══════════════════════════════════════
    add([
        ['ai.promptCopied', '提示词已复制到剪贴板！', 'Prompt copied to clipboard!'],
        ['ai.keyword', '关键词：', 'Keyword: '],
        ['ai.goDeepSeek', '点击【确定】跳转 DeepSeek 官网，直接粘贴 (Ctrl+V) 即可。', 'Click OK to open DeepSeek and paste (Ctrl+V).'],
        ['ai.copyFailed', '自动复制失败，请手动复制以下内容，然后自行打开 DeepSeek:', 'Auto-copy failed. Please copy the text below manually, then open DeepSeek:'],
    ]);

    // ═══════════════════════════════════════
    //  I18N Engine
    // ═══════════════════════════════════════

    window.t = function (key, replacements) {
        var dict = T[currentLang] || T.zh;
        var text = dict[key] || T.zh[key] || key;
        if (replacements) {
            if (typeof replacements === 'string') {
                text = text.replace('{0}', replacements);
            } else if (Array.isArray(replacements)) {
                replacements.forEach(function (val, i) {
                    text = text.replace('{' + i + '}', val);
                });
            }
        }
        return text;
    };

    window.getLang = function () {
        return currentLang;
    };

    window.switchLang = function (lang) {
        if (lang !== 'zh' && lang !== 'en') return;
        currentLang = lang;
        localStorage.setItem(STORAGE_KEY_LANG, lang);
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        applyI18n();
        updateLangToggleUI();
        if (typeof renderModules === 'function') renderModules();
        if (typeof syncYamlToUI === 'function') syncYamlToUI();
        if (typeof onLanguageSwitched === 'function') onLanguageSwitched(lang);
        if (typeof switchTab === 'function') switchTab(typeof currentTab !== 'undefined' ? currentTab : 'config');
    };

    function applyI18n(root) {
        var scope = root || document;
        scope.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            var text = t(key);
            if (text !== key) el.textContent = text;
        });
        scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-html');
            var text = t(key);
            if (text !== key) el.innerHTML = text;
        });
        scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-placeholder');
            var text = t(key);
            if (text !== key) el.placeholder = text;
        });
        scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-title');
            var text = t(key);
            if (text !== key) el.title = text;
        });
    }

    window.applyI18n = applyI18n;

    function updateLangToggleUI() {
        var btn = document.getElementById('lang-toggle-btn');
        var label = document.getElementById('lang-toggle-label');
        if (btn) {
            btn.title = currentLang === 'zh' ? 'Switch to English' : '切换到中文';
        }
        if (label) {
            label.textContent = currentLang === 'zh' ? 'EN' : '中';
        }
    }

    // Auto-init
    (function init() {
        var saved = localStorage.getItem(STORAGE_KEY_LANG);
        if (saved === 'zh' || saved === 'en') {
            currentLang = saved;
        } else {
            currentLang = (navigator.language || '').startsWith('zh') ? 'zh' : 'en';
        }
        document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                applyI18n();
                updateLangToggleUI();
            });
        } else {
            applyI18n();
            updateLangToggleUI();
        }
    })();
})();
