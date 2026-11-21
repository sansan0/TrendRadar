/**
 * TrendRadar 配置文件编辑器核心逻辑
 * 特点：确保原始 YAML 的注释和格式 100% 保留
 */

// 编辑器常量
const EDITOR_LINE_HEIGHT = 19.5;  // 编辑器行高（px），用于滚动定位计算

// ==========================================
// 0. 注释高亮功能
// ==========================================

/**
 * 对文本应用高亮，# 后的内容显示为灰色
 */
function applyHighlight(text) {
    const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text.split('\n').map(line => {
        const idx = line.indexOf('#');
        if (idx === -1) return escape(line);
        return escape(line.slice(0, idx)) + '<span class="syntax-comment">' + escape(line.slice(idx)) + '</span>';
    }).join('\n');
}

/**
 * 对 search_queries.txt 应用专用语法高亮
 * 支持：# 注释、[GLOBAL_FILTER]/[SEARCH_TOPICS]、[主题名]、!排除词、-site:/site:、@数字、~Nd、@provider:
 */
function applySearchHighlight(text) {
    const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return escape(line);

        // 整行注释
        if (trimmed.startsWith('#')) {
            return '<span class="syntax-comment">' + escape(line) + '</span>';
        }

        // 区段头 [GLOBAL_FILTER] / [SEARCH_TOPICS]
        if (/^\s*\[(GLOBAL_FILTER|SEARCH_TOPICS)\]\s*$/i.test(line)) {
            return '<span class="syntax-section">' + escape(line) + '</span>';
        }

        // 主题名 [主题名称]
        if (/^\s*\[[^\]]+\]\s*$/.test(line)) {
            return '<span class="syntax-topic">' + escape(line) + '</span>';
        }

        // 引擎指令 @provider:xxx
        if (/^\s*@provider:\s*\S+\s*$/i.test(line)) {
            return '<span class="syntax-provider">' + escape(line) + '</span>';
        }

        // 条数限制 @数字
        if (/^\s*@\d+\s*$/.test(line)) {
            return '<span class="syntax-limit">' + escape(line) + '</span>';
        }

        // 时效限制 ~Nd
        if (/^\s*~\d+[dD]\s*$/.test(line)) {
            return '<span class="syntax-freshness">' + escape(line) + '</span>';
        }

        // 整行排除词 !xxx
        if (trimmed.startsWith('!')) {
            return '<span class="syntax-exclude">' + escape(line) + '</span>';
        }

        // 整行屏蔽网站 -site:xxx
        if (/^\s*-site:\s*\S+\s*$/i.test(line)) {
            return '<span class="syntax-site-exclude">' + escape(line) + '</span>';
        }

        // 普通搜索词行：高亮其中的 -site:域名 与 site:域名
        let escaped = escape(line);
        escaped = escaped.replace(/(^|\s)(-site:\S+)/gi, '$1<span class="syntax-site-exclude">$2</span>');
        escaped = escaped.replace(/(^|\s)(site:\S+)/gi, '$1<span class="syntax-site-include">$2</span>');
        return escaped;
    }).join('\n');
}

/**
 * 更新高亮层
 */
function updateBackdrop(textareaId, backdropId) {
    const ta = document.getElementById(textareaId);
    const bd = document.getElementById(backdropId);
    if (ta && bd) {
        const html = textareaId === 'search-editor' ? applySearchHighlight(ta.value) : applyHighlight(ta.value);
        bd.innerHTML = html + '\n';
    }
}

/**
 * 同步滚动
 */
function syncScroll(textareaId, backdropId) {
    const ta = document.getElementById(textareaId);
    const bd = document.getElementById(backdropId);
    if (ta && bd) {
        bd.scrollTop = ta.scrollTop;
        bd.scrollLeft = ta.scrollLeft;
    }
}

// ==========================================
// 12. 二维码放大弹窗逻辑
// ==========================================

function getQrModalData() {
    return {
        weixin: {
            icon: '<i class="fa-brands fa-weixin text-green-600"></i>',
            iconBg: 'bg-green-100',
            title: t('qr.weixin.title'),
            subtitle: t('qr.weixin.subtitle'),
            img: './assets/weixin.webp',
            alt: '微信公众号',
            hint: t('qr.weixin.hint')
        },
        donate: {
            icon: '<i class="fa-solid fa-hand-holding-heart text-emerald-600"></i>',
            iconBg: 'bg-emerald-100',
            title: t('qr.donate.title'),
            subtitle: t('qr.donate.subtitle'),
            img: 'https://cdn-1258574687.cos.ap-shanghai.myqcloud.com/img/%2F2026%2F01%2F18ecce7c224ce0ea4c59394c29e408f8-e0d1db45.webp',
            alt: '微信支付',
            hint: t('qr.donate.hint')
        }
    };
}

function openQrModal(type) {
    const data = getQrModalData()[type];
    if (!data) return;
    const modal = document.getElementById('qr-modal');
    document.getElementById('qr-modal-icon').className = 'w-10 h-10 rounded-xl flex items-center justify-center text-lg ' + data.iconBg;
    document.getElementById('qr-modal-icon').innerHTML = data.icon;
    document.getElementById('qr-modal-title').textContent = data.title;
    document.getElementById('qr-modal-subtitle').textContent = data.subtitle;
    document.getElementById('qr-modal-img').src = data.img;
    document.getElementById('qr-modal-img').alt = data.alt;
    document.getElementById('qr-modal-hint').textContent = data.hint;
    modal.classList.remove('hidden');
}

function closeQrModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) modal.classList.add('hidden');
}

window.openQrModal = openQrModal;
window.closeQrModal = closeQrModal;
const MODULE_DEFS = [
    { id: 1, nameKey: "mod.app", key: "app", editable: false },
    { id: 2, nameKey: "mod.platforms", key: "platforms", editable: true },
    { id: 3, nameKey: "mod.rss", key: "rss", editable: true },
    { id: "3.5", nameKey: "mod.web_search", key: "web_search", editable: true },
    { id: 4, nameKey: "mod.report", key: "report", editable: true },
    { id: "4.5", nameKey: "mod.filter", key: "filter", editable: true },
    { id: "4.6", nameKey: "mod.ai_filter", key: "ai_filter", editable: true },
    { id: 5, nameKey: "mod.display", key: "display", editable: true },
    { id: 6, nameKey: "mod.notification", key: "notification", editable: true, partial: true },
    { id: 7, nameKey: "mod.storage", key: "storage", editable: false },
    { id: 8, nameKey: "mod.ai", key: "ai", editable: true },
    { id: 9, nameKey: "mod.ai_analysis", key: "ai_analysis", editable: true },
    { id: 10, nameKey: "mod.ai_translation", key: "ai_translation", editable: true },
    { id: 11, nameKey: "mod.advanced", key: "advanced", editable: false }
];

// 旧版占位符（用于识别历史缓存）
const INITIAL_YAML = `# 在此粘贴你的 config.yaml...
# 或拖拽文件到编辑器区域
# 或点击右上角"加载官网最新配置"`;

// 获取内置默认 config.yaml（按中英文返回）
function getDefaultYaml(lang) {
    const target = lang || (typeof getLang === 'function' ? getLang() : 'zh');
    if (target === 'en' && typeof DEFAULT_YAML_EN === 'string' && DEFAULT_YAML_EN.trim()) {
        return DEFAULT_YAML_EN;
    }
    if (typeof DEFAULT_YAML_ZH === 'string' && DEFAULT_YAML_ZH.trim()) {
        return DEFAULT_YAML_ZH;
    }
    return t('init.configPlaceholder');
}
function getInitialYaml() { return getDefaultYaml(); }

// 获取内置默认 search_queries.txt（按中英文返回）
function getDefaultSearchQueries(lang) {
    const target = lang || (typeof getLang === 'function' ? getLang() : 'zh');
    if (target === 'en' && typeof DEFAULT_SEARCH_QUERIES_EN === 'string' && DEFAULT_SEARCH_QUERIES_EN.trim()) {
        return DEFAULT_SEARCH_QUERIES_EN;
    }
    if (typeof DEFAULT_SEARCH_QUERIES_ZH === 'string' && DEFAULT_SEARCH_QUERIES_ZH.trim()) {
        return DEFAULT_SEARCH_QUERIES_ZH;
    }
    return '[GLOBAL_FILTER]\n\n[SEARCH_TOPICS]\n';
}

// LocalStorage 键名
const STORAGE_KEY_CONFIG = 'trendradar_config_yaml';
const STORAGE_KEY_FREQUENCY = 'trendradar_frequency_txt';
const STORAGE_KEY_SEARCH = 'trendradar_search_txt';
const STORAGE_KEY_TIMELINE = 'trendradar_timeline_yaml';
const STORAGE_KEY_CONFIG_TIME = 'trendradar_config_time';
const STORAGE_KEY_FREQUENCY_TIME = 'trendradar_frequency_time';
const STORAGE_KEY_SEARCH_TIME = 'trendradar_search_time';
const STORAGE_KEY_TIMELINE_TIME = 'trendradar_timeline_time';

// 官网配置文件 URL（GitHub 主源）
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/';
const REMOTE_VERSION_URL = GITHUB_RAW_BASE + 'version_configs';

// 远程配置文件路径随当前语言切换：中文用 config.yaml，英文用 config.en.yaml 等
// 仅文件名不同，复用同一上游仓库与 CDN 回退源
function remoteConfigPath(type) {
    const en = (typeof getLang === 'function' && getLang() === 'en');
    const suffix = en ? '.en' : '';
    const names = {
        config: 'config/config' + suffix + '.yaml',
        frequency: 'config/frequency_words' + suffix + '.txt',
        search: 'config/search_queries' + suffix + '.txt',
        timeline: 'config/timeline' + suffix + '.yaml'
    };
    return names[type];
}
// 当前语言对应的完整远程配置 URL（供 fetchWithFallback 使用，须以 GITHUB_RAW_BASE 开头）
function remoteConfigUrl(type) {
    return GITHUB_RAW_BASE + remoteConfigPath(type);
}
// 当前语言对应的配置文件名（用于弹窗展示与提示，如 "config.yaml" / "config.en.yaml"）
function remoteConfigName(type) {
    return remoteConfigPath(type).split('/').pop();
}

// 所有源（GitHub 主源 + CDN 备用源），按优先级排列
const ALL_SOURCES = [
    GITHUB_RAW_BASE,
    'https://fastly.jsdelivr.net/gh/sansan0/TrendRadar@master/',
    'https://cdn.jsdelivr.net/gh/sansan0/TrendRadar@master/',
    'https://gcore.jsdelivr.net/gh/sansan0/TrendRadar@master/',
];
let lastOkIndex = 0;

async function fetchWithTimeout(url, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return resp;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

async function fetchWithFallback(url, timeout = 5000) {
    const path = url.startsWith(GITHUB_RAW_BASE) ? url.slice(GITHUB_RAW_BASE.length) : null;
    if (!path) return fetch(url);

    const n = ALL_SOURCES.length;
    for (let offset = 0; offset < n; offset++) {
        const idx = (lastOkIndex + offset) % n;
        try {
            const resp = await fetchWithTimeout(ALL_SOURCES[idx] + path, timeout);
            if (resp.ok) {
                if (idx !== lastOkIndex) {
                    console.log(`[CDN] 已切换到: ${ALL_SOURCES[idx].split('//')[1].split('/')[0]}`);
                }
                lastOkIndex = idx;
                return resp;
            }
        } catch {}
    }
    throw new Error(t('toast.allSourcesFailed'));
}

let currentYaml = "";
let currentFrequency = "";
let currentSearch = "";
let currentTimeline = "";
let currentFrequencyData = null;  // 缓存解析后的数据，避免重复解析导致索引错位
let currentSearchData = null;     // 缓存解析后的联网搜索任务数据
let currentTab = "config";

// ==========================================
// 2. 初始化与事件绑定
// ==========================================
// 防抖定时器
let configSaveTimer = null;
let frequencySaveTimer = null;
let searchSaveTimer = null;
let timelineSaveTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    const yamlEditor = document.getElementById('yaml-editor');
    const frequencyEditor = document.getElementById('frequency-editor');
    const searchEditor = document.getElementById('search-editor');

    // 尝试从 LocalStorage 恢复配置
    const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
    const savedFrequency = localStorage.getItem(STORAGE_KEY_FREQUENCY);
    const savedSearch = localStorage.getItem(STORAGE_KEY_SEARCH);

    // 初始化编辑器
    const isOldConfigPlaceholder = (val) => !val || !val.trim() || val.trim() === INITIAL_YAML.trim() || val.trim() === t('init.configPlaceholder').trim();
    if (!isOldConfigPlaceholder(savedConfig)) {
        yamlEditor.value = savedConfig;
        currentYaml = savedConfig;
        showToast(t('toast.configRestored'), 'info');
    } else {
        const initYaml = getDefaultYaml();
        yamlEditor.value = initYaml;
        currentYaml = initYaml;
    }

    if (savedFrequency && savedFrequency.trim()) {
        frequencyEditor.value = savedFrequency;
        currentFrequency = savedFrequency;
    } else {
        frequencyEditor.value = t('init.frequencyPlaceholder');
        currentFrequency = frequencyEditor.value;
    }

    if (savedSearch && savedSearch.trim()) {
        searchEditor.value = savedSearch;
        currentSearch = savedSearch;
    } else {
        const initSearch = getDefaultSearchQueries();
        searchEditor.value = initSearch;
        currentSearch = initSearch;
    }

    // 初始化 Timeline 编辑器
    const timelineEditor = document.getElementById('timeline-editor');
    const savedTimeline = localStorage.getItem(STORAGE_KEY_TIMELINE);

    const INITIAL_TIMELINE = t('init.timelinePlaceholder');

    if (savedTimeline && savedTimeline.trim() && savedTimeline !== INITIAL_TIMELINE) {
        timelineEditor.value = savedTimeline;
        currentTimeline = savedTimeline;
    } else {
        timelineEditor.value = INITIAL_TIMELINE;
        currentTimeline = INITIAL_TIMELINE;
    }

    // 渲染右侧模块列表
    renderModules();

    // 监听编辑器输入（实时同步到 UI + 防抖保存）
    yamlEditor.addEventListener('input', (e) => {
        currentYaml = e.target.value;
        updateBackdrop('yaml-editor', 'yaml-backdrop');
        syncYamlToUI();
        debounceSaveConfig();
    });

    frequencyEditor.addEventListener('input', (e) => {
        currentFrequency = e.target.value;
        updateBackdrop('frequency-editor', 'frequency-backdrop');
        currentFrequencyData = null;
        syncFrequencyToUI();
        debounceSaveFrequency();
    });

    searchEditor.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        updateBackdrop('search-editor', 'search-backdrop');
        currentSearchData = null;
        syncSearchToUI();
        debounceSaveSearch();
    });

    timelineEditor.addEventListener('input', (e) => {
        currentTimeline = e.target.value;
        updateBackdrop('timeline-editor', 'timeline-backdrop');
        syncTimelineToUI();
        debounceSaveTimeline();
    });

    // 同步滚动
    yamlEditor.addEventListener('scroll', () => syncScroll('yaml-editor', 'yaml-backdrop'));
    frequencyEditor.addEventListener('scroll', () => syncScroll('frequency-editor', 'frequency-backdrop'));
    searchEditor.addEventListener('scroll', () => syncScroll('search-editor', 'search-backdrop'));
    timelineEditor.addEventListener('scroll', () => syncScroll('timeline-editor', 'timeline-backdrop'));

    // 初始化拖拽上传功能
    initDragAndDrop(yamlEditor, 'config');
    initDragAndDrop(frequencyEditor, 'frequency');
    initDragAndDrop(searchEditor, 'search');
    initDragAndDrop(timelineEditor, 'timeline');

    // 页面关闭/刷新时立即保存
    window.addEventListener('beforeunload', saveAllToLocalStorage);

    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveAllToLocalStorage();
            showToast(t('toast.manualSave'), 'success');
        }
    });

    syncYamlToUI();

    updateBackdrop('yaml-editor', 'yaml-backdrop');
    updateBackdrop('frequency-editor', 'frequency-backdrop');
    updateBackdrop('search-editor', 'search-backdrop');
    updateBackdrop('timeline-editor', 'timeline-backdrop');

    updateSaveTimeDisplay();
});

// 防抖保存 config.yaml
function debounceSaveConfig() {
    if (configSaveTimer) clearTimeout(configSaveTimer);
    configSaveTimer = setTimeout(() => {
        saveConfigToLocalStorage();
    }, 1000);
}

// 防抖保存 frequency_words.txt
function debounceSaveFrequency() {
    if (frequencySaveTimer) clearTimeout(frequencySaveTimer);
    frequencySaveTimer = setTimeout(() => {
        saveFrequencyToLocalStorage();
    }, 1000);
}

// 防抖保存 search_queries.txt
function debounceSaveSearch() {
    if (searchSaveTimer) clearTimeout(searchSaveTimer);
    searchSaveTimer = setTimeout(() => {
        saveSearchToLocalStorage();
    }, 1000);
}

// 防抖保存 timeline.yaml
function debounceSaveTimeline() {
    if (timelineSaveTimer) clearTimeout(timelineSaveTimer);
    timelineSaveTimer = setTimeout(() => {
        saveTimelineToLocalStorage();
    }, 1000);
}

// 切换全站中英文时：若编辑器中仍是未改动的内置默认模板，自动切换语言版本
window.onLanguageSwitched = function(lang) {
    const otherLang = lang === 'en' ? 'zh' : 'en';
    const yamlEditor = document.getElementById('yaml-editor');
    if (yamlEditor && currentYaml === getDefaultYaml(otherLang)) {
        const nextYaml = getDefaultYaml(lang);
        yamlEditor.value = nextYaml;
        currentYaml = nextYaml;
        updateBackdrop('yaml-editor', 'yaml-backdrop');
        syncYamlToUI();
    }

    const searchEditor = document.getElementById('search-editor');
    if (searchEditor && currentSearch === getDefaultSearchQueries(otherLang)) {
        const nextSearch = getDefaultSearchQueries(lang);
        searchEditor.value = nextSearch;
        currentSearch = nextSearch;
        currentSearchData = null;
        updateBackdrop('search-editor', 'search-backdrop');
    }

    updateSaveTimeDisplay();
};

// ==========================================
// 2.1 拖拽上传功能
// ==========================================
function initDragAndDrop(editor, type) {
    const container = editor.parentElement;

    const dropFileName = type === 'config'
        ? 'config.yaml'
        : type === 'timeline'
        ? 'timeline.yaml'
        : type === 'search'
        ? 'search_queries.txt'
        : 'frequency_words.txt';

    const dropOverlay = document.createElement('div');
    dropOverlay.className = 'drop-overlay hidden';
    dropOverlay.innerHTML = `
        <div class="drop-overlay-content">
            <i class="fa-solid fa-cloud-arrow-up text-4xl mb-2"></i>
            <div class="text-sm font-bold">${t('init.releaseToLoad')}</div>
            <div class="text-xs opacity-75">${dropFileName}</div>
        </div>
    `;
    container.style.position = 'relative';
    container.appendChild(dropOverlay);

    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.classList.remove('hidden');
    });

    editor.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!container.contains(e.relatedTarget)) {
            dropOverlay.classList.add('hidden');
        }
    });

    dropOverlay.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!container.contains(e.relatedTarget)) {
            dropOverlay.classList.add('hidden');
        }
    });

    dropOverlay.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    dropOverlay.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.classList.add('hidden');
        handleFileDrop(e, type);
    });

    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.classList.add('hidden');
        handleFileDrop(e, type);
    });
}

function handleFileDrop(e, type) {
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];

    const validExtensions = type === 'config'
        ? ['.yaml', '.yml', '.txt']
        : type === 'timeline'
        ? ['.yaml', '.yml']
        : type === 'search'
        ? ['.txt']
        : ['.txt', '.yaml', '.yml'];

    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
        showToast(type === 'config' || type === 'timeline' ? t('toast.dragYaml') : t('toast.dragTxt'), 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target.result;

        if (type === 'config') {
            try {
                jsyaml.load(content);
                document.getElementById('yaml-editor').value = content;
                currentYaml = content;
                updateBackdrop('yaml-editor', 'yaml-backdrop');
                syncYamlToUI();
                debounceSaveConfig();
                showToast(t('toast.loaded') + file.name, 'success');
            } catch (err) {
                showToast(t('toast.yamlError') + err.message, 'error');
                // 仍然加载，让用户修复
                document.getElementById('yaml-editor').value = content;
                currentYaml = content;
                updateBackdrop('yaml-editor', 'yaml-backdrop');
            }
        } else if (type === 'timeline') {
            try {
                jsyaml.load(content);
                document.getElementById('timeline-editor').value = content;
                currentTimeline = content;
                updateBackdrop('timeline-editor', 'timeline-backdrop');
                syncTimelineToUI();
                debounceSaveTimeline();
                showToast(t('toast.loaded') + file.name, 'success');
            } catch (err) {
                showToast(t('toast.yamlError') + err.message, 'error');
                document.getElementById('timeline-editor').value = content;
                currentTimeline = content;
                updateBackdrop('timeline-editor', 'timeline-backdrop');
            }
        } else if (type === 'search') {
            document.getElementById('search-editor').value = content;
            currentSearch = content;
            currentSearchData = null;
            updateBackdrop('search-editor', 'search-backdrop');
            syncSearchToUI();
            debounceSaveSearch();
            showToast(t('toast.loaded') + file.name, 'success');
        } else {
            document.getElementById('frequency-editor').value = content;
            currentFrequency = content;
            currentFrequencyData = null;
            updateBackdrop('frequency-editor', 'frequency-backdrop');
            syncFrequencyToUI();
            debounceSaveFrequency();
            showToast(t('toast.loaded') + file.name, 'success');
        }
    };

    reader.onerror = () => {
        showToast(t('toast.fileReadFail'), 'error');
    };

    reader.readAsText(file);
}

// ==========================================
// 2.2 LocalStorage 保存与恢复
// ==========================================

// 通用 LocalStorage 保存函数
function _saveToStorage(content, storageKey, timeKey, label) {
    try {
        if (content && content.trim().length > 10) {
            const now = new Date().toISOString();
            localStorage.setItem(storageKey, content);
            localStorage.setItem(timeKey, now);
            updateSaveTimeDisplay();
        }
    } catch (e) {
        console.warn(`LocalStorage 保存 ${label} 失败:`, e);
    }
}

function saveConfigToLocalStorage() {
    _saveToStorage(currentYaml, STORAGE_KEY_CONFIG, STORAGE_KEY_CONFIG_TIME, 'config');
}

function saveFrequencyToLocalStorage() {
    _saveToStorage(currentFrequency, STORAGE_KEY_FREQUENCY, STORAGE_KEY_FREQUENCY_TIME, 'frequency');
}

function saveSearchToLocalStorage() {
    _saveToStorage(currentSearch, STORAGE_KEY_SEARCH, STORAGE_KEY_SEARCH_TIME, 'search');
}

function saveTimelineToLocalStorage() {
    _saveToStorage(currentTimeline, STORAGE_KEY_TIMELINE, STORAGE_KEY_TIMELINE_TIME, 'timeline');
}

// 保存全部（页面关闭时调用）
function saveAllToLocalStorage() {
    saveConfigToLocalStorage();
    saveFrequencyToLocalStorage();
    saveSearchToLocalStorage();
    saveTimelineToLocalStorage();
}

// 兼容旧调用
function saveToLocalStorage() {
    saveAllToLocalStorage();
}

// 格式化时间显示
function formatSaveTime(isoString) {
    if (!isoString) return t('save.notSaved');
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('time.justNow');
    if (diffMins < 60) return diffMins + t('time.minutesAgo');
    if (diffHours < 24) return diffHours + t('time.hoursAgo');
    if (diffDays < 7) return diffDays + t('time.daysAgo');

    return date.toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// 更新保存时间显示
function updateSaveTimeDisplay() {
    const configTime = localStorage.getItem(STORAGE_KEY_CONFIG_TIME);
    const frequencyTime = localStorage.getItem(STORAGE_KEY_FREQUENCY_TIME);

    // 更新 config.yaml 的时间显示
    const configTimeEl = document.getElementById('config-save-time');
    const configLabelEl = document.getElementById('config-save-label');
    if (configTimeEl) {
        configTimeEl.textContent = formatSaveTime(configTime);
        configTimeEl.title = configTime ? new Date(configTime).toLocaleString(getLang() === 'zh' ? 'zh-CN' : 'en-US') : t('save.notSaved');
        if (configLabelEl) {
            if (configTime) {
                configLabelEl.classList.remove('hidden');
            } else {
                configLabelEl.classList.add('hidden');
            }
        }
    }

    // 更新 frequency_words.txt 的时间显示
    const frequencyTimeEl = document.getElementById('frequency-save-time');
    const frequencyLabelEl = document.getElementById('frequency-save-label');
    if (frequencyTimeEl) {
        frequencyTimeEl.textContent = formatSaveTime(frequencyTime);
        frequencyTimeEl.title = frequencyTime ? new Date(frequencyTime).toLocaleString(getLang() === 'zh' ? 'zh-CN' : 'en-US') : t('save.notSaved');
        if (frequencyLabelEl) {
            if (frequencyTime) {
                frequencyLabelEl.classList.remove('hidden');
            } else {
                frequencyLabelEl.classList.add('hidden');
            }
        }
    }

    // 更新 search_queries.txt 的时间显示
    const searchTime = localStorage.getItem(STORAGE_KEY_SEARCH_TIME);
    const searchTimeEl = document.getElementById('search-save-time');
    const searchLabelEl = document.getElementById('search-save-label');
    if (searchTimeEl) {
        searchTimeEl.textContent = formatSaveTime(searchTime);
        searchTimeEl.title = searchTime ? new Date(searchTime).toLocaleString(getLang() === 'zh' ? 'zh-CN' : 'en-US') : t('save.notSaved');
        if (searchLabelEl) {
            if (searchTime) {
                searchLabelEl.classList.remove('hidden');
            } else {
                searchLabelEl.classList.add('hidden');
            }
        }
    }

    // 更新 timeline.yaml 的时间显示
    const timelineTime = localStorage.getItem(STORAGE_KEY_TIMELINE_TIME);
    const timelineTimeEl = document.getElementById('timeline-save-time');
    const timelineLabelEl = document.getElementById('timeline-save-label');
    if (timelineTimeEl) {
        timelineTimeEl.textContent = formatSaveTime(timelineTime);
        timelineTimeEl.title = timelineTime ? new Date(timelineTime).toLocaleString(getLang() === 'zh' ? 'zh-CN' : 'en-US') : t('save.notSaved');
        if (timelineLabelEl) {
            if (timelineTime) {
                timelineLabelEl.classList.remove('hidden');
            } else {
                timelineLabelEl.classList.add('hidden');
            }
        }
    }
}

// ==========================================
// 2.3 加载官网最新配置
// ==========================================
window.openLoadConfigModal = function() {
    // 创建选择弹窗
    const modal = document.createElement('div');
    modal.id = 'load-config-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 420px;">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800"><i class="fa-solid fa-cloud-arrow-down mr-2 text-blue-500"></i>${t('loadModal.title')}</h3>
                <button onclick="closeLoadConfigModal()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-times text-xl"></i></button>
            </div>
            <div class="text-sm text-gray-600 mb-4">
                ${t('loadModal.desc')}
            </div>
            <div class="space-y-3">
                <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
                    <input type="checkbox" id="load-config-yaml" checked class="w-4 h-4 text-blue-600 rounded">
                    <div class="flex-1">
                        <div class="font-medium text-gray-800">${remoteConfigName('config')}</div>
                        <div class="text-xs text-gray-500">${t('loadModal.configDesc')}</div>
                    </div>
                    <i class="fa-solid fa-file-code text-blue-400"></i>
                </label>
                <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
                    <input type="checkbox" id="load-frequency-txt" checked class="w-4 h-4 text-blue-600 rounded">
                    <div class="flex-1">
                        <div class="font-medium text-gray-800">${remoteConfigName('frequency')}</div>
                        <div class="text-xs text-gray-500">${t('loadModal.frequencyDesc')}</div>
                    </div>
                    <i class="fa-solid fa-filter text-orange-400"></i>
                </label>
                <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
                    <input type="checkbox" id="load-search-txt" checked class="w-4 h-4 text-blue-600 rounded">
                    <div class="flex-1">
                        <div class="font-medium text-gray-800">${remoteConfigName('search')}</div>
                        <div class="text-xs text-gray-500">${t('loadModal.searchDesc')}</div>
                    </div>
                    <i class="fa-solid fa-magnifying-glass text-emerald-500"></i>
                </label>
                <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
                    <input type="checkbox" id="load-timeline-yaml" checked class="w-4 h-4 text-blue-600 rounded">
                    <div class="flex-1">
                        <div class="font-medium text-gray-800">${remoteConfigName('timeline')}</div>
                        <div class="text-xs text-gray-500">${t('loadModal.timelineDesc')}</div>
                    </div>
                    <i class="fa-solid fa-calendar-week text-purple-400"></i>
                </label>
            </div>
            <div class="text-xs text-gray-400 mt-3 p-2 bg-gray-50 rounded">
                <i class="fa-solid fa-info-circle mr-1"></i>
                ${t('loadModal.source')}<a href="https://github.com/sansan0/TrendRadar" target="_blank" class="text-blue-500 hover:underline">sansan0/TrendRadar</a>
            </div>
            <div class="flex justify-end gap-2 mt-4">
                <button onclick="closeLoadConfigModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">${t('loadModal.cancel')}</button>
                <button onclick="confirmLoadConfig()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fa-solid fa-download mr-1"></i>${t('loadModal.loadSelected')}
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.closeLoadConfigModal = function() {
    const modal = document.getElementById('load-config-modal');
    if (modal) modal.remove();
}

window.confirmLoadConfig = async function() {
    const loadConfig = document.getElementById('load-config-yaml')?.checked;
    const loadFrequency = document.getElementById('load-frequency-txt')?.checked;
    const loadSearch = document.getElementById('load-search-txt')?.checked;
    const loadTimeline = document.getElementById('load-timeline-yaml')?.checked;

    if (!loadConfig && !loadFrequency && !loadSearch && !loadTimeline) {
        showToast(t('toast.selectOneFile'), 'warning');
        return;
    }

    closeLoadConfigModal();
    showToast(t('toast.loadingConfig'), 'info');

    try {
        const promises = [];
        if (loadConfig) promises.push(fetchWithFallback(remoteConfigUrl('config')).then(r => ({ type: 'config', res: r })));
        if (loadFrequency) promises.push(fetchWithFallback(remoteConfigUrl('frequency')).then(r => ({ type: 'frequency', res: r })));
        if (loadSearch) promises.push(fetchWithFallback(remoteConfigUrl('search')).then(r => ({ type: 'search', res: r })));
        if (loadTimeline) promises.push(fetchWithFallback(remoteConfigUrl('timeline')).then(r => ({ type: 'timeline', res: r })));

        const results = await Promise.all(promises);

        for (const { type, res } of results) {
            if (!res.ok) {
                throw new Error(`${remoteConfigName(type)} ${t('toast.loadFailed')}${res.status}`);
            }

            const text = await res.text();

            if (type === 'config') {
                try {
                    jsyaml.load(text);
                } catch (yamlErr) {
                    showToast(t('toast.yamlError') + yamlErr.message, 'error');
                    continue;
                }
                document.getElementById('yaml-editor').value = text;
                currentYaml = text;
                updateBackdrop('yaml-editor', 'yaml-backdrop');
                syncYamlToUI();
            } else if (type === 'timeline') {
                try {
                    jsyaml.load(text);
                } catch (yamlErr) {
                    showToast(t('toast.yamlError') + yamlErr.message, 'error');
                    continue;
                }
                document.getElementById('timeline-editor').value = text;
                currentTimeline = text;
                updateBackdrop('timeline-editor', 'timeline-backdrop');
                syncTimelineToUI();
            } else if (type === 'search') {
                document.getElementById('search-editor').value = text;
                currentSearch = text;
                currentSearchData = null;
                updateBackdrop('search-editor', 'search-backdrop');
                syncSearchToUI();
            } else {
                document.getElementById('frequency-editor').value = text;
                currentFrequency = text;
                currentFrequencyData = null;
                updateBackdrop('frequency-editor', 'frequency-backdrop');
                syncFrequencyToUI();
            }
        }

        saveToLocalStorage();

        const loadedFiles = [];
        if (loadConfig) loadedFiles.push(remoteConfigName('config'));
        if (loadFrequency) loadedFiles.push(remoteConfigName('frequency'));
        if (loadSearch) loadedFiles.push(remoteConfigName('search'));
        if (loadTimeline) loadedFiles.push(remoteConfigName('timeline'));
        showToast(t('toast.loaded') + loadedFiles.join(', '), 'success');

    } catch (err) {
        console.error('加载远程配置失败:', err);
        showToast(t('toast.loadFailed') + err.message, 'error');
    }
}

// ==========================================
// 2.4 Toast 提示
// ==========================================
function showToast(message, type = 'info') {
    // 移除已有的 toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };

    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // 动画入场
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 自动消失
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// 3. 渲染逻辑
// ==========================================
function renderModules() {
    const container = document.getElementById('config-panel');
    container.innerHTML = '';

    renderModuleNav();

    MODULE_DEFS.forEach(mod => {
        const card = document.createElement('div');
        card.className = `module-card ${mod.editable ? 'active' : 'disabled'}`;
        card.id = `module-${mod.key}`;

        const header = `
            <div class="module-header px-4 py-3 flex items-center justify-between cursor-pointer" onclick="scrollToModuleInEditor('${mod.key}')">
                <div class="flex items-center">
                    <span class="text-sm font-bold">${t(mod.nameKey)}</span>
                    <i class="fa-solid fa-arrow-up-right-from-square text-blue-400 text-[10px] ml-2 opacity-0 group-hover:opacity-100" title="${t('common.jumpToEditor')}"></i>
                </div>
                ${!mod.editable ?
                    '<span class="locked-badge text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">' + t('panel.readOnly') + '</span>' :
                    '<i class="fa-solid fa-chevron-down text-gray-400 text-xs"></i>'}
            </div>
        `;

        const body = mod.editable ? `<div class="module-body p-5 border-t border-gray-50 space-y-4" id="controls-${mod.key}"></div>` : '';

        card.innerHTML = header + body;
        container.appendChild(card);

        if (mod.editable) {
            renderControls(mod);
        }
    });
}

// 渲染模块导航栏
function renderModuleNav() {
    const nav = document.getElementById('module-nav');
    if (!nav) return;

    nav.innerHTML = MODULE_DEFS.map(mod => `
        <button onclick="scrollToModuleInEditor('${mod.key}')"
                class="module-nav-btn text-[10px] px-2 py-1 rounded ${mod.editable ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} transition-colors"
                title="${t(mod.nameKey)}">
            ${mod.id}
        </button>
    `).join('');
}

// 切换组名编辑状态
window.toggleGroupNameEdit = function(btn) {
    const container = btn.parentNode;
    const span = container.querySelector('span.text-sm');
    const input = container.querySelector('input[type="text"]');

    if (input.classList.contains('hidden')) {
        // 进入编辑模式
        span.classList.add('hidden');
        input.classList.remove('hidden');
        input.focus();
        btn.innerHTML = '<i class="fa-solid fa-check text-green-600"></i>';
    } else {
        // 退出编辑模式
        span.classList.remove('hidden');
        input.classList.add('hidden');
        btn.innerHTML = '<i class="fa-solid fa-pen"></i>';

        // 如果内容变化，已经通过 onchange 触发更新
        span.textContent = input.value;
    }
}

// 跳转到左侧编辑器中对应词组的位置
window.scrollToWordGroupInEditor = function(groupIndex) {
    const editor = document.getElementById('frequency-editor');
    // 重新解析以确保行号准确
    const data = parseFrequencyText(editor.value);

    if (!data.wordGroups[groupIndex]) return;

    const targetLineIndex = data.wordGroups[groupIndex].startLine;
    if (targetLineIndex === undefined || targetLineIndex === -1) return;

    const lines = editor.value.split('\n');
    const lineHeight = EDITOR_LINE_HEIGHT;
    const scrollPosition = targetLineIndex * lineHeight;

    // 设置光标选区
    let charCount = 0;
    for (let i = 0; i < targetLineIndex; i++) {
        charCount += lines[i].length + 1; // +1 for newline
    }

    editor.focus();
    editor.setSelectionRange(charCount, charCount + lines[targetLineIndex].length);
    editor.scrollTop = scrollPosition - 50;

    // 高亮效果
    editor.style.transition = 'background-color 0.3s';
    const originalBg = editor.style.backgroundColor;
    editor.style.backgroundColor = '#2d4a7c';
    setTimeout(() => {
        editor.style.backgroundColor = originalBg;
    }, 300);
}

// 跳转到左侧编辑器中对应模块的位置
window.scrollToModuleInEditor = function(modKey) {
    const editor = document.getElementById('yaml-editor');
    const yaml = editor.value;
    const lines = yaml.split('\n');

    // 查找模块标题注释行（# N. 模块名）
    let targetLineIndex = -1;
    const mod = MODULE_DEFS.find(m => m.key === modKey);
    if (!mod) return;

    // 直接匹配包含模块编号的标题行，兼容 "4." 和 "4.5" 两种编号格式
    const escapedId = String(mod.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const moduleTitlePattern = new RegExp(`^#\\s*${escapedId}(?:\\.)?\\s+`, 'i');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 匹配模块标题行（包含编号的注释行）
        if (moduleTitlePattern.test(line)) {
            targetLineIndex = i;
            break;
        }
    }

    // 如果没找到标题行，尝试查找模块键名（如 platforms:）
    if (targetLineIndex === -1) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(new RegExp(`^${modKey}:\\s*`))) {
                targetLineIndex = i;
                break;
            }
        }
    }

    if (targetLineIndex === -1) return;

    // 计算目标位置并滚动
    const lineHeight = EDITOR_LINE_HEIGHT;
    const scrollPosition = targetLineIndex * lineHeight;

    // 设置光标位置
    const textBeforeTarget = lines.slice(0, targetLineIndex).join('\n').length + (targetLineIndex > 0 ? 1 : 0);
    editor.focus();
    editor.setSelectionRange(textBeforeTarget, textBeforeTarget + lines[targetLineIndex].length);

    editor.scrollTop = scrollPosition - 5;

    // 高亮提示（闪烁效果）
    editor.style.transition = 'background-color 0.3s';
    const originalBg = editor.style.backgroundColor;
    editor.style.backgroundColor = '#2d4a7c';
    setTimeout(() => {
        editor.style.backgroundColor = originalBg;
    }, 300);
}

function renderControls(mod) {
    const body = document.getElementById(`controls-${mod.key}`);

    // 根据模块 key 定义不同的 UI 控件
    let html = "";

    switch(mod.key) {
        case "platforms":
            html = createToggleControl(mod.key, "enabled", t('ctrl.enableHotlist'));
            html += `<div class="mt-4 mb-2 text-xs font-bold text-gray-700">${t('ctrl.platformList')} <span class="text-gray-400 font-normal">(${t('ctrl.dragToSort')})</span></div>`;
            html += `<div id="platforms-list" class="space-y-2"></div>`;
            html += `<div class="flex items-center gap-2 mt-3">
                        <button onclick="openPlatformModal()" class="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors">
                            <i class="fa-solid fa-plus mr-1"></i>${t('ctrl.addPlatform')}
                        </button>
                        <a href="https://github.com/sansan0/TrendRadar?tab=readme-ov-file#%E9%85%8D%E7%BD%AE%E8%AF%A6%E8%A7%A3" target="_blank" class="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors border border-gray-200 flex items-center gap-1 no-underline">
                            <i class="fa-solid fa-circle-question text-gray-400"></i>${t('ctrl.addOtherPlatform')}
                        </a>
                     </div>`;
            break;
        case "rss":
            html = createToggleControl(mod.key, "enabled", t('ctrl.enableRss'));
            html += `<div class="mt-3 mb-2 text-xs font-bold text-gray-700">${t('ctrl.freshnessFilter')}</div>`;
            html += createToggleControl(mod.key, "freshness_filter.enabled", t('ctrl.enableFreshness'));
            html += createNumberControl(mod.key, "freshness_filter.max_age_days", t('ctrl.maxAgeDays'));
            html += `<div class="mt-4 mb-2 text-xs font-bold text-gray-700">${t('ctrl.rssFeedList')}</div>`;
            html += `<div id="rss-feeds-list" class="space-y-2"></div>`;
            html += `<div class="flex items-center gap-2 mt-3">
                        <button onclick="openRssModal()" class="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors">
                            <i class="fa-solid fa-plus mr-1"></i>${t('ctrl.addRss')}
                        </button>
                        <div class="text-xs text-gray-500 italic">
                            ${t('ctrl.rssLibHint')}
                        </div>
                     </div>`;
            html += `<div class="text-xs text-orange-600 mt-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                        <strong>${t('common.warning')}</strong>${t('ctrl.rssWarning')}
                     </div>`;
            break;
        case "web_search":
            html = createToggleControl(mod.key, "enabled", t('ctrl.enableWebSearch'));
            html += `<div class="text-xs text-gray-600 mt-2 p-2.5 bg-emerald-50 rounded border border-emerald-200 flex items-center justify-between gap-2">
                        <span><i class="fa-solid fa-magnifying-glass mr-1.5 text-emerald-600"></i>${t('ctrl.wsIntro')}</span>
                        <button type="button" onclick="switchTab('search')" class="flex-shrink-0 text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded hover:bg-emerald-700 transition-colors">
                            ${t('ctrl.wsGoEditQueries')} <i class="fa-solid fa-arrow-right ml-1"></i>
                        </button>
                     </div>`;

            // 搜索引擎（下拉 + 自定义输入）
            html += `<div class="space-y-2 mt-3">
                        <div>
                            <label class="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">${t('ctrl.wsProvider')}</label>
                            <select id="ws-provider-select" data-custom-bind="true" class="bg-white border-gray-300">
                                <option value="deepseek">${t('ctrl.wsProviderDeepseek')}</option>
                                <option value="__custom__">${t('ctrl.wsProviderCustom')}</option>
                            </select>
                        </div>
                        <div id="ws-provider-custom-wrap" class="hidden">
                            <label class="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">${t('ctrl.wsProviderCustomLabel')}</label>
                            <input type="text" id="ws-provider-custom" data-custom-bind="true" class="bg-white border-gray-300 focus:border-blue-500" placeholder="${t('ctrl.wsProviderCustomPlaceholder')}">
                        </div>
                     </div>`;

            // 搜索任务文件
            html += createInputControl(mod.key, "queries_file", t('ctrl.wsQueriesFile'), "text", t('ctrl.wsQueriesFilePlaceholder'));
            html += `<div class="text-[11px] text-gray-500 -mt-2">
                        <i class="fa-solid fa-folder-open mr-1 text-amber-500"></i>${t('ctrl.wsQueriesFileHint')}
                     </div>`;

            // 处理方式
            html += createSelectControl(mod.key, "query_mode", t('ctrl.wsQueryMode'), [
                { value: "direct", label: t('ctrl.wsQueryModeDirect') },
                { value: "smart", label: t('ctrl.wsQueryModeSmart') }
            ]);

            // 条数与质量把关
            html += `<div class="border-t border-gray-200 pt-4 mt-4 space-y-3">
                        <div>
                            <div class="text-xs font-bold text-gray-700"><i class="fa-solid fa-sliders mr-1.5 text-blue-500"></i>${t('ctrl.wsQualitySection')}</div>
                            <div class="text-[11px] text-gray-400 mt-0.5">${t('ctrl.wsQualityHint')}</div>
                        </div>`;
            html += createNumberControl(mod.key, "fetch_count", t('ctrl.wsFetchCount'), { min: 1, max: 50, step: 1 });
            html += `<div class="text-[10px] text-gray-400 -mt-2 text-right">${t('ctrl.wsFetchCountHint')}</div>`;
            html += createNumberControl(mod.key, "max_items_per_topic", t('ctrl.wsMaxItemsPerTopic'), { min: 0, step: 1 });
            html += createNumberControl(mod.key, "freshness_days", t('ctrl.wsFreshnessDays'), { min: 0, step: 1 });
            html += createNumberControl(mod.key, "dedup_days", t('ctrl.wsDedupDays'), { min: 0, step: 1 });

            // 最低质量分滑块 + 数字同步
            html += `<div class="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
                        <div class="flex items-center justify-between gap-2">
                            <label for="ws-min-score-number" class="text-xs font-medium text-gray-700">${t('ctrl.wsMinScore')}</label>
                            <div class="flex items-center gap-2">
                                <span id="ws-min-score-badge" class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">${t('ctrl.wsMinScoreBadgeGood')}</span>
                                <input type="number" id="ws-min-score-number" data-custom-bind="true" min="0" max="1" step="0.05" value="0.5"
                                       class="text-right bg-white border-gray-300" style="width: 72px; padding: 0.25rem 0.5rem;">
                            </div>
                        </div>
                        <input type="range" id="ws-min-score-range" data-custom-bind="true" min="0" max="1" step="0.05" value="0.5" class="ws-score-range">
                        <div class="flex justify-between text-[10px] text-gray-400">
                            <span>${t('ctrl.wsMinScoreScale0')}</span>
                            <span>${t('ctrl.wsMinScoreScale035')}</span>
                            <span class="text-blue-600 font-semibold">${t('ctrl.wsMinScoreScale05')}</span>
                            <span>${t('ctrl.wsMinScoreScale1')}</span>
                        </div>
                     </div>`;

            // 网站权威度下拉
            html += createSelectControl(mod.key, "min_authority", t('ctrl.wsMinAuthority'), [
                { value: "-1", label: t('ctrl.wsAuthAny') },
                { value: "0", label: t('ctrl.wsAuth0') },
                { value: "1", label: t('ctrl.wsAuth1') },
                { value: "2", label: t('ctrl.wsAuth2') },
                { value: "3", label: t('ctrl.wsAuth3') },
                { value: "4", label: t('ctrl.wsAuth4') }
            ], { dataType: "number" });

            html += createToggleControl(mod.key, "allow_unknown_authority", t('ctrl.wsAllowUnknownAuth'));
            html += createToggleControl(mod.key, "need_content", t('ctrl.wsNeedContent'));
            html += createToggleControl(mod.key, "notification_show_snippet", t('ctrl.wsNotifySnippet'));
            html += `</div>`;

            // DeepSeek 引擎账号设置
            html += `<div class="border-t border-gray-200 pt-4 mt-4 space-y-3">
                        <div class="text-xs font-bold text-gray-700"><i class="fa-solid fa-key mr-1.5 text-indigo-500"></i>${t('ctrl.wsDeepseekSection')}</div>`;
            html += createPasswordControl(mod.key, "providers.deepseek.api_key", t('ctrl.wsApiKey'), t('ctrl.wsApiKeyPlaceholder'));
            html += `<div class="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded p-2 -mt-1">
                        <i class="fa-solid fa-lightbulb mr-1 text-blue-500"></i>${t('ctrl.wsApiKeyHint')}
                     </div>`;
            html += createInputControl(mod.key, "providers.deepseek.api_base", t('ctrl.wsApiBase'), "text", "https://api.deepseek.com");
            html += createInputControl(mod.key, "providers.deepseek.localization", t('ctrl.wsLocalization'), "text", t('ctrl.wsLocalizationPlaceholder'));
            html += `</div>`;

            // 高级网络参数（可折叠，同步写入 advanced.web_search）
            html += `<div class="border border-gray-200 rounded-lg overflow-hidden mt-4">
                        <button type="button" onclick="toggleWsAdvanced()" class="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 transition-colors">
                            <span><i class="fa-solid fa-wrench mr-1.5 text-gray-400"></i>${t('ctrl.wsAdvancedTitle')} <span class="font-normal text-[10px] text-gray-400 ml-1">(advanced.web_search)</span></span>
                            <i id="ws-advanced-icon" class="fa-solid fa-chevron-down text-gray-400 text-[10px] transition-transform duration-200"></i>
                        </button>
                        <div id="ws-advanced-body" class="hidden p-3 space-y-3 border-t border-gray-200 bg-white">
                            ${createNumberControl(mod.key, "web_search.request_interval", t('ctrl.wsRequestInterval'), { min: 0, step: 100, targetModule: "advanced" })}
                            ${createNumberControl(mod.key, "web_search.timeout", t('ctrl.wsTimeout'), { min: 5, step: 1, targetModule: "advanced" })}
                            ${createNumberControl(mod.key, "web_search.max_retries", t('ctrl.wsMaxRetries'), { min: 0, max: 10, step: 1, targetModule: "advanced" })}
                            ${createToggleControl(mod.key, "web_search.use_proxy", t('ctrl.wsUseProxy'), "advanced")}
                            ${createInputControl(mod.key, "web_search.proxy_url", t('ctrl.wsProxyUrl'), "text", t('ctrl.wsProxyPlaceholder'), "advanced")}
                        </div>
                     </div>`;
            break;
        case "report":
            html = createSelectControl(mod.key, "mode", t('ctrl.reportMode'), ["current", "daily", "incremental"]);
            html += createSelectControl(mod.key, "display_mode", t('ctrl.displayMode'), ["keyword", "platform"]);
            html += createToggleControl(mod.key, "sort_by_position_first", t('ctrl.sortByPosition'));
            html += createNumberControl(mod.key, "rank_threshold", t('ctrl.rankThreshold'));
            html += createNumberControl(mod.key, "max_news_per_keyword", t('ctrl.maxNewsPerKeyword'));
            break;
        case "filter":
            html = createSelectControl(mod.key, "method", t('ctrl.filterMethod'), ["keyword", "ai"]);
            html += createToggleControl(mod.key, "priority_sort_enabled", t('ctrl.prioritySort'));
            html += `<div class="text-xs text-gray-500 mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <i class="fa-solid fa-info-circle mr-1 text-blue-500"></i>
                        <strong>${t('common.description')}</strong><code>method=keyword</code> ${t('ctrl.filterNote')} <code>frequency_words.txt</code>;
                        <code>method=ai</code> ${t('ctrl.filterNote')} <code>ai_interests.txt</code> + AI filter config.<br>
                        <code>priority_sort_enabled</code> ${t('ctrl.aiFilterNote')}
                     </div>`;
            break;
        case "ai_filter":
            html = `<div class="text-xs text-gray-500 mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <i class="fa-solid fa-info-circle mr-1 text-blue-500"></i>
                        ${t('ctrl.aiFilterNote')}
                    </div>`;
            html += createNumberControl(mod.key, "batch_size", t('ctrl.batchSize'));
            html += createNumberControl(mod.key, "batch_interval", t('ctrl.batchInterval'));
            html += createNumberControl(mod.key, "min_score", t('ctrl.minScore'));
            html += createInputControl(mod.key, "interests_file", t('ctrl.interestsFile'));
            html += `<div class="text-xs text-amber-700 mt-1 mb-3 p-2 bg-amber-50 rounded border border-amber-200">
                        <i class="fa-solid fa-folder-tree mr-1"></i>
                        ${t('ctrl.interestsFileHint')} <code>config/ai_interests.txt</code>;
                        <code>config/custom/ai/</code>
                     </div>`;
            html += createNumberControl(mod.key, "reclassify_threshold", t('ctrl.reclassifyThreshold'));
            html += createInputControl(mod.key, "prompt_file", t('ctrl.promptFile'));
            html += createInputControl(mod.key, "extract_prompt_file", t('ctrl.extractPromptFile'));
            html += createInputControl(mod.key, "update_tags_prompt_file", t('ctrl.updateTagsPromptFile'));
            break;
        case "display":
            html = `<div class="text-xs font-bold text-gray-700 mb-2">${t('ctrl.pushContentControl')} <span class="text-gray-400 font-normal">(${t('ctrl.dragToSort')})</span></div>`;
            html += `<div id="display-regions-list" class="space-y-2"></div>`;
            html += `<div class="text-xs text-gray-500 mt-2 mb-6">
                        <i class="fa-solid fa-lightbulb mr-1"></i>
                        ${t('common.hint')}${t('ctrl.displayOrderHint')}
                     </div>`;

            // Standalone Configuration Section
            html += `<div class="border-t border-gray-200 pt-4 mt-4">`;
            html += `<div class="text-xs font-bold text-gray-700 mb-3">${t('ctrl.standaloneConfig')} <span class="text-gray-400 font-normal">(${t('ctrl.standaloneNote')})</span></div>`;

            html += createNumberControl(mod.key, "standalone.max_items", t('ctrl.maxStandaloneItems'));

            html += `<div class="mt-3 mb-2 text-xs font-medium text-gray-700">${t('ctrl.selectPlatforms')}</div>`;
            html += `<div id="standalone-platforms-list" class="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50 grid grid-cols-2 gap-2"></div>`;

            html += `<div class="mt-3 mb-2 text-xs font-medium text-gray-700">${t('ctrl.selectRssFeeds')}</div>`;
            html += `<div id="standalone-rss-list" class="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50 grid grid-cols-1 gap-2"></div>`;

            html += `</div>`;

            setTimeout(() => {
                renderDisplayRegionsList();
                renderStandaloneLists();
            }, 0);
            break;
        case "notification":
            html = `<div class="text-xs text-gray-500 mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <i class="fa-solid fa-info-circle mr-1 text-blue-500"></i>
                        ${t('ctrl.notificationNote')}
                    </div>`;
            break;
        case "ai":
            html = createInputControl(mod.key, "model", t('ctrl.modelName'));
            html += createInputControl(mod.key, "api_key", t('ctrl.apiKey'), "password");
            html += createInputControl(mod.key, "api_base", t('ctrl.apiBase'));
            html += createNumberControl(mod.key, "timeout", t('ctrl.timeout'));
            html += createNumberControl(mod.key, "temperature", t('ctrl.temperature'));
            html += createNumberControl(mod.key, "max_tokens", t('ctrl.maxTokens'));
            break;
        case "ai_analysis":
            html = createToggleControl(mod.key, "enabled", t('ctrl.enableAnalysis'));

            // 提示：分析时间窗口已迁移到 timeline.yaml
            html += `<div class="text-xs text-gray-500 mt-3 mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <i class="fa-solid fa-info-circle mr-1 text-blue-500"></i>
                        ${t('ctrl.analysisTimeNote')}
                    </div>`;

            // 其他 AI 分析配置
            html += `<div class="text-xs font-bold text-blue-600 mb-2">${t('ctrl.analysisContentConfig')}</div>`;
            html += createInputControl(mod.key, "language", t('ctrl.outputLanguage'));
            html += createInputControl(mod.key, "prompt_file", t('ctrl.promptConfigFile'));
            html += createSelectControl(mod.key, "mode", t('ctrl.aiAnalysisMode'), ["follow_report", "daily", "current", "incremental"]);
            html += createNumberControl(mod.key, "max_news_for_analysis", t('ctrl.maxNewsForAnalysis'));
            html += createToggleControl(mod.key, "include_rss", t('ctrl.includeRss'));
            html += createToggleControl(mod.key, "include_web_search", t('ctrl.includeWebSearch'));
            html += createNumberControl(mod.key, "search_summary_max_chars", t('ctrl.searchSummaryMaxChars'), { min: 0, step: 50 });
            html += createToggleControl(mod.key, "include_standalone", t('ctrl.includeStandalone'));
            html += createToggleControl(mod.key, "include_rank_timeline", t('ctrl.includeRankTimeline'));
            break;
        case "ai_translation":
            html = createToggleControl(mod.key, "enabled", t('ctrl.enableTranslation'));
            html += createInputControl(mod.key, "language", t('ctrl.targetLanguage'));
            html += createInputControl(mod.key, "prompt_file", t('ctrl.promptConfigFile'));
            html += createNumberControl(mod.key, "batch_size", t('ctrl.translationBatchSize'));
            html += createNumberControl(mod.key, "batch_interval", t('ctrl.batchInterval'));
            html += `<div class="border-t border-gray-200 pt-3 mt-3 space-y-2.5">
                        <div class="text-xs font-bold text-gray-700">${t('ctrl.translationScope')}</div>
                        ${createToggleControl(mod.key, "scope.hotlist", t('ctrl.transScopeHotlist'))}
                        ${createToggleControl(mod.key, "scope.rss", t('ctrl.transScopeRss'))}
                        ${createToggleControl(mod.key, "scope.web_search", t('ctrl.transScopeWebSearch'))}
                        ${createToggleControl(mod.key, "scope.standalone", t('ctrl.transScopeStandalone'))}
                        <div class="text-[11px] text-gray-400">
                            <i class="fa-solid fa-info-circle mr-1"></i>${t('ctrl.translationScopeHint')}
                        </div>
                     </div>`;
            break;
    }

    body.innerHTML = html;

    // 绑定事件
    body.querySelectorAll('input, select').forEach(el => {
        if (el.dataset.customBind === 'true') return;
        el.addEventListener('change', (e) => {
            const targetMod = e.target.dataset.module || mod.key;
            updateYamlFromUI(targetMod, e.target.dataset.path, e.target);
        });
    });

    // web_search 专用交互绑定（引擎切换 + 质量分滑块联动）
    if (mod.key === 'web_search') {
        const providerSel = document.getElementById('ws-provider-select');
        const customWrap = document.getElementById('ws-provider-custom-wrap');
        const customInput = document.getElementById('ws-provider-custom');

        if (providerSel) {
            providerSel.addEventListener('change', () => {
                if (providerSel.value === '__custom__') {
                    if (customWrap) customWrap.classList.remove('hidden');
                    if (customInput) customInput.focus();
                    const customVal = customInput ? customInput.value.trim() : '';
                    if (customVal) {
                        writeYamlFieldValue('web_search', 'provider', customVal);
                    }
                } else {
                    if (customWrap) customWrap.classList.add('hidden');
                    writeYamlFieldValue('web_search', 'provider', providerSel.value);
                }
            });
        }
        if (customInput) {
            customInput.addEventListener('change', () => {
                const v = customInput.value.trim();
                if (v) {
                    writeYamlFieldValue('web_search', 'provider', v);
                }
            });
        }

        const scoreRange = document.getElementById('ws-min-score-range');
        const scoreNum = document.getElementById('ws-min-score-number');
        const applyScoreChange = (rawVal, writeYaml) => {
            let num = parseFloat(rawVal);
            if (isNaN(num)) num = 0;
            num = Math.max(0, Math.min(1, Math.round(num * 100) / 100));
            if (scoreRange) scoreRange.value = num;
            if (scoreNum) scoreNum.value = num;
            updateWsMinScoreBadge(num);
            if (writeYaml) {
                writeYamlFieldValue('web_search', 'min_score', num);
            }
        };
        if (scoreRange) {
            scoreRange.addEventListener('input', () => applyScoreChange(scoreRange.value, false));
            scoreRange.addEventListener('change', () => applyScoreChange(scoreRange.value, true));
        }
        if (scoreNum) {
            scoreNum.addEventListener('change', () => applyScoreChange(scoreNum.value, true));
        }
    }
}

function updateWsMinScoreBadge(val) {
    const badge = document.getElementById('ws-min-score-badge');
    if (!badge) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
        badge.textContent = t('ctrl.wsMinScoreBadgeOff');
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium';
    } else if (num < 0.45) {
        badge.textContent = t('ctrl.wsMinScoreBadgeRelaxed');
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium';
    } else if (num <= 0.55) {
        badge.textContent = t('ctrl.wsMinScoreBadgeGood');
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium';
    } else {
        badge.textContent = t('ctrl.wsMinScoreBadgeStrict');
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium';
    }
}

window.toggleWsAdvanced = function() {
    const body = document.getElementById('ws-advanced-body');
    const icon = document.getElementById('ws-advanced-icon');
    if (!body) return;
    const isHidden = body.classList.toggle('hidden');
    if (icon) {
        icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    }
};

window.togglePasswordVisibility = function(btn) {
    const wrap = btn.closest('.password-input-wrap');
    if (!wrap) return;
    const input = wrap.querySelector('input');
    const icon = btn.querySelector('i');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.className = 'fa-regular fa-eye-slash';
    } else {
        input.type = 'password';
        if (icon) icon.className = 'fa-regular fa-eye';
    }
};

// ==========================================
// 4. 同步逻辑 (YAML -> UI)
// ==========================================
function syncYamlToUI() {
    try {
        const doc = jsyaml.load(currentYaml);
        if (!doc) return;

        MODULE_DEFS.filter(m => m.editable).forEach(mod => {
            const controls = document.querySelectorAll(`#controls-${mod.key} [data-path]`);
            controls.forEach(ctrl => {
                const sourceModKey = ctrl.dataset.module || mod.key;
                const modData = doc[sourceModKey];
                if (!modData) return;

                const path = ctrl.dataset.path.split('.');
                let val = modData;
                for (const part of path) {
                    val = val !== undefined && val !== null ? val[part] : undefined;
                }

                if (ctrl.type === 'checkbox') {
                    ctrl.checked = !!val;
                } else {
                    ctrl.value = val !== undefined && val !== null ? String(val) : "";
                }
            });
        });

        // 同步 web_search 自定义控件（provider 下拉与自定义输入、min_score 滑块）
        const wsData = doc.web_search || {};
        const providerSel = document.getElementById('ws-provider-select');
        const customWrap = document.getElementById('ws-provider-custom-wrap');
        const customInput = document.getElementById('ws-provider-custom');
        if (providerSel) {
            const providerVal = (wsData.provider || 'deepseek').trim();
            if (providerVal === 'deepseek' || providerVal === '') {
                providerSel.value = 'deepseek';
                if (customWrap) customWrap.classList.add('hidden');
                if (customInput) customInput.value = '';
            } else {
                providerSel.value = '__custom__';
                if (customWrap) customWrap.classList.remove('hidden');
                if (customInput) customInput.value = providerVal;
            }
        }
        const scoreRange = document.getElementById('ws-min-score-range');
        const scoreNum = document.getElementById('ws-min-score-number');
        if (scoreRange && scoreNum) {
            const rawScore = wsData.min_score !== undefined ? parseFloat(wsData.min_score) : 0.5;
            const safeScore = isNaN(rawScore) ? 0.5 : Math.max(0, Math.min(1, rawScore));
            scoreRange.value = safeScore;
            scoreNum.value = safeScore;
            updateWsMinScoreBadge(safeScore);
        }

        renderPlatformsList();
        renderRssFeedsList();
        renderDisplayRegionsList();
        renderStandaloneLists();
    } catch (e) {
        // 解析失败时不更新 UI，保持原有状态
    }
}

// ==========================================
// 5. 更新逻辑 (UI -> YAML) - 核心难点：缩进精准定位并保留注释
// ==========================================

/**
 * 在 YAML 值行中安全分离值部分和行尾注释（忽略引号内的 #）
 */
function splitYamlValueAndComment(rest) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < rest.length; i++) {
        const ch = rest[i];
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (ch === '"' && !inSingle && rest[i - 1] !== '\\') {
            inDouble = !inDouble;
        } else if (ch === '#' && !inSingle && !inDouble) {
            if (i === 0 || /\s/.test(rest[i - 1])) {
                // 回退包含注释前的空白，保持原有对齐间距
                let start = i;
                while (start > 0 && (rest[start - 1] === ' ' || rest[start - 1] === '\t')) {
                    start--;
                }
                return {
                    valPart: rest.slice(0, start).trim(),
                    comment: rest.slice(start)
                };
            }
        }
    }
    return { valPart: rest.trim(), comment: '' };
}

/**
 * 找指定缩进 YAML 块的结束行号
 */
function findYamlBlockEnd(lines, startLine, parentIndent, maxEnd) {
    for (let i = startLine + 1; i < maxEnd; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const indent = line.search(/\S/);
        if (indent <= parentIndent) return i;
    }
    return maxEnd;
}

/**
 * 在 YAML 父块内精确查找直接子键（只匹配直接子级缩进，防止误命中其他嵌套兄弟块同名键）
 */
function findYamlChildKey(lines, startLine, endLine, parentIndent, key) {
    let expectedIndent = -1;
    for (let i = startLine + 1; i < endLine; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const indent = line.search(/\S/);
        if (indent <= parentIndent) break;
        if (expectedIndent === -1) expectedIndent = indent;
        if (indent !== expectedIndent) continue;
        const keyMatch = line.match(/^\s*([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (keyMatch && keyMatch[1] === key) {
            return i;
        }
    }
    return -1;
}

/**
 * 找到块内最后一个有效内容行（用于在注释区前紧凑插入新字段）
 */
function findYamlBlockLastContentLine(lines, startLine, endLine, parentIndent) {
    let last = startLine;
    for (let i = startLine + 1; i < endLine; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const indent = line.search(/\S/);
        if (indent <= parentIndent) break;
        last = i;
    }
    return last;
}

/**
 * 格式化待写入 YAML 的值
 */
function formatYamlScalar(newVal, originalValPart = '') {
    if (typeof newVal === 'boolean') return newVal ? 'true' : 'false';
    if (typeof newVal === 'number') return String(newVal);
    if (typeof newVal === 'string') {
        const isOriginalQuoted = (originalValPart.startsWith('"') && originalValPart.endsWith('"')) ||
                                 (originalValPart.startsWith("'") && originalValPart.endsWith("'"));
        if (isOriginalQuoted || newVal === '' || /[:#"\s'{}[\],&*!|>%@`]/.test(newVal) ||
            /^(true|false|null|yes|no|on|off|\d+(\.\d+)?)$/i.test(newVal)) {
            return `"${newVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        }
        return newVal;
    }
    return String(newVal);
}

/**
 * 按模块和点分路径写入 YAML 字段（支持任意层级嵌套，自动保留注释，缺失路径自动补建）
 */
function writeYamlFieldValue(modKey, path, newVal) {
    const editor = document.getElementById('yaml-editor');
    if (!editor || !path) return;

    const lines = editor.value.split('\n');
    const pathParts = path.split('.');

    // 1. 定位顶层模块起止行
    const findModuleRange = () => {
        let start = -1;
        let end = lines.length;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const moduleMatch = line.match(/^([a-z_]+):/);
            if (moduleMatch) {
                if (moduleMatch[1] === modKey) {
                    start = i;
                } else if (start >= 0) {
                    end = i;
                    break;
                }
            }
        }
        return { start, end };
    };

    let { start: moduleStartLine, end: moduleEndLine } = findModuleRange();

    // 兼容旧版 config.yaml：若目标顶级模块不存在则自动补建
    if (moduleStartLine < 0) {
        let insertIdx = lines.length;
        if (modKey === 'web_search') {
            for (let i = 0; i < lines.length; i++) {
                if (/^report:/.test(lines[i])) {
                    // 回退跳过 report: 之前的区块分隔注释
                    let k = i - 1;
                    while (k >= 0 && (lines[k].trim() === '' || lines[k].trim().startsWith('#'))) {
                        k--;
                    }
                    insertIdx = k + 1;
                    break;
                }
            }
        }
        lines.splice(insertIdx, 0, '', `${modKey}:`);
        ({ start: moduleStartLine, end: moduleEndLine } = findModuleRange());
        if (moduleStartLine < 0) return;
    }

    // 2. 逐级按缩进下钻定位目标行
    let curStart = moduleStartLine;
    let curEnd = moduleEndLine;
    let curIndent = 0;
    let targetLine = -1;
    let missingFromIdx = -1;

    for (let idx = 0; idx < pathParts.length; idx++) {
        const key = pathParts[idx];
        const found = findYamlChildKey(lines, curStart, curEnd, curIndent, key);
        if (found >= 0) {
            if (idx === pathParts.length - 1) {
                targetLine = found;
            } else {
                const foundIndent = lines[found].search(/\S/);
                const foundEnd = findYamlBlockEnd(lines, found, foundIndent, curEnd);
                curStart = found;
                curEnd = foundEnd;
                curIndent = foundIndent;
            }
        } else {
            missingFromIdx = idx;
            break;
        }
    }

    if (targetLine >= 0) {
        // 原地更新，保留原有注释与引号风格
        const originalLine = lines[targetLine];
        const match = originalLine.match(/^(\s*[a-zA-Z0-9_-]+:\s*)(.*)$/);
        if (match) {
            const prefix = match[1];
            const rest = match[2];
            const { valPart, comment } = splitYamlValueAndComment(rest);
            const formattedVal = formatYamlScalar(newVal, valPart);
            lines[targetLine] = `${prefix}${formattedVal}${comment}`;
        }
    } else if (missingFromIdx >= 0) {
        // 如果父行写成 key: {}，先转为普通块头
        const parentMatch = lines[curStart].match(/^(\s*[a-zA-Z0-9_-]+:)\s*\{\}\s*(#.*)?$/);
        if (parentMatch) {
            lines[curStart] = parentMatch[1] + (parentMatch[2] ? ' ' + parentMatch[2] : '');
        }

        // 计算子级缩进（沿用当前块已有子缩进，否则 curIndent + 2）
        let childIndent = curIndent + 2;
        for (let i = curStart + 1; i < curEnd; i++) {
            const trimmed = lines[i].trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const ind = lines[i].search(/\S/);
                if (ind > curIndent) {
                    childIndent = ind;
                    break;
                }
            }
        }

        const insertLines = [];
        for (let idx = missingFromIdx; idx < pathParts.length; idx++) {
            const ind = ' '.repeat(childIndent + (idx - missingFromIdx) * 2);
            const key = pathParts[idx];
            if (idx === pathParts.length - 1) {
                const formattedVal = formatYamlScalar(newVal, typeof newVal === 'string' ? '""' : '');
                insertLines.push(`${ind}${key}: ${formattedVal}`);
            } else {
                insertLines.push(`${ind}${key}:`);
            }
        }

        const lastContent = findYamlBlockLastContentLine(lines, curStart, curEnd, curIndent);
        lines.splice(lastContent + 1, 0, ...insertLines);
    }

    editor.value = lines.join('\n');
    currentYaml = editor.value;
    updateBackdrop('yaml-editor', 'yaml-backdrop');
    debounceSaveConfig();
}

function updateYamlFromUI(modKey, path, el) {
    let newVal = el.type === 'checkbox' ? el.checked : el.value;

    // 如果是数字类型（含数值型 select 或 range）
    if (el.type === 'number' || el.type === 'range' || el.dataset?.type === 'number') {
        newVal = parseFloat(newVal);
        if (isNaN(newVal)) newVal = 0;
    }

    writeYamlFieldValue(modKey, path, newVal);
}

// ==========================================
// 6. UI 组件工厂
// ==========================================
function createToggleControl(mod, path, label, targetModule = null) {
    const modAttr = targetModule ? ` data-module="${targetModule}"` : '';
    const id = `toggle-${targetModule || mod}-${path.replace(/\./g, '-')}`;
    return `
        <div class="flex items-center justify-between gap-2">
            <label for="${id}" class="text-xs font-medium text-gray-700">${label}</label>
            <div class="relative inline-block w-10 mr-2 align-middle select-none flex-shrink-0">
                <input type="checkbox" id="${id}" data-path="${path}"${modAttr} class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-200 ease-in-out"/>
                <label for="${id}" class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
            </div>
        </div>
    `;
}

function createInputControl(mod, path, label, type = "text", placeholder = null, targetModule = null) {
    const modAttr = targetModule ? ` data-module="${targetModule}"` : '';
    const ph = placeholder !== null ? placeholder : t('tl.notSet');
    return `
        <div>
            <label class="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">${label}</label>
            <input type="${type}" data-path="${path}"${modAttr} class="bg-white border-gray-300 focus:border-blue-500" placeholder="${ph}">
        </div>
    `;
}

function createPasswordControl(mod, path, label, placeholder = null, targetModule = null) {
    const modAttr = targetModule ? ` data-module="${targetModule}"` : '';
    const ph = placeholder !== null ? placeholder : t('tl.notSet');
    return `
        <div>
            <label class="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">${label}</label>
            <div class="password-input-wrap">
                <input type="password" data-path="${path}"${modAttr} class="bg-white border-gray-300 focus:border-blue-500" placeholder="${ph}">
                <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="${t('ctrl.togglePassword')}">
                    <i class="fa-regular fa-eye"></i>
                </button>
            </div>
        </div>
    `;
}

function createNumberControl(mod, path, label, opts = {}) {
    const modAttr = opts.targetModule ? ` data-module="${opts.targetModule}"` : '';
    const minAttr = opts.min !== undefined ? ` min="${opts.min}"` : '';
    const maxAttr = opts.max !== undefined ? ` max="${opts.max}"` : '';
    const stepAttr = opts.step !== undefined ? ` step="${opts.step}"` : '';
    return `
        <div class="flex items-center justify-between gap-2">
            <label class="text-xs font-medium text-gray-700">${label}</label>
            <input type="number" data-path="${path}"${modAttr}${minAttr}${maxAttr}${stepAttr} class="w-20 text-right bg-white border-gray-300" style="width: 84px">
        </div>
    `;
}

function createSelectControl(mod, path, label, options, opts = {}) {
    const modAttr = opts.targetModule ? ` data-module="${opts.targetModule}"` : '';
    const typeAttr = opts.dataType ? ` data-type="${opts.dataType}"` : '';
    const optionsHtml = options.map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return `<option value="${opt.value}">${opt.label}</option>`;
        }
        return `<option value="${opt}">${opt}</option>`;
    }).join('');
    return `
        <div>
            <label class="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">${label}</label>
            <select data-path="${path}"${modAttr}${typeAttr} class="bg-white border-gray-300">
                ${optionsHtml}
            </select>
        </div>
    `;
}

// ==========================================
// 7. 工具函数
// ==========================================

window.copyResult = function() {
    const yamlEditor = document.getElementById('yaml-editor');
    const frequencyEditor = document.getElementById('frequency-editor');
    const searchEditor = document.getElementById('search-editor');
    const timelineEditor = document.getElementById('timeline-editor');
    const editor = currentTab === 'config'
        ? yamlEditor
        : currentTab === 'search'
        ? searchEditor
        : currentTab === 'timeline'
        ? timelineEditor
        : frequencyEditor;

    const text = editor.value;
    const btn = document.querySelector('button[onclick="copyResult()"]');
    const original = btn.innerHTML;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = '<i class="fa-solid fa-check mr-1.5"></i>' + t('nav.copied');
            setTimeout(() => btn.innerHTML = original, 2000);
        }).catch(() => {
            editor.select();
            document.execCommand('copy');
            btn.innerHTML = '<i class="fa-solid fa-check mr-1.5"></i>' + t('nav.copied');
            setTimeout(() => btn.innerHTML = original, 2000);
        });
    } else {
        editor.select();
        document.execCommand('copy');
        btn.innerHTML = '<i class="fa-solid fa-check mr-1.5"></i>' + t('nav.copied');
        setTimeout(() => btn.innerHTML = original, 2000);
    }
}

window.resetToDefault = function() {
    if (confirm(t('confirm.reset'))) {
        if (currentTab === 'config') {
            const yamlEditor = document.getElementById('yaml-editor');
            const initYaml = getDefaultYaml();
            yamlEditor.value = initYaml;
            currentYaml = initYaml;
            updateBackdrop('yaml-editor', 'yaml-backdrop');
            localStorage.removeItem(STORAGE_KEY_CONFIG);
            localStorage.removeItem(STORAGE_KEY_CONFIG_TIME);
            renderModules();
            syncYamlToUI();
            updateSaveTimeDisplay();
        } else if (currentTab === 'search') {
            const searchEditor = document.getElementById('search-editor');
            const initSearch = getDefaultSearchQueries();
            searchEditor.value = initSearch;
            currentSearch = initSearch;
            currentSearchData = null;
            updateBackdrop('search-editor', 'search-backdrop');
            localStorage.removeItem(STORAGE_KEY_SEARCH);
            localStorage.removeItem(STORAGE_KEY_SEARCH_TIME);
            syncSearchToUI();
            updateSaveTimeDisplay();
        } else if (currentTab === 'timeline') {
            const timelineEditor = document.getElementById('timeline-editor');
            const initialTimeline = t('init.timelinePlaceholder');
            timelineEditor.value = initialTimeline;
            currentTimeline = initialTimeline;
            updateBackdrop('timeline-editor', 'timeline-backdrop');
            localStorage.removeItem(STORAGE_KEY_TIMELINE);
            localStorage.removeItem(STORAGE_KEY_TIMELINE_TIME);
            syncTimelineToUI();
            updateSaveTimeDisplay();
        } else {
            const frequencyEditor = document.getElementById('frequency-editor');
            frequencyEditor.value = t('init.frequencyPlaceholder');
            currentFrequency = frequencyEditor.value;
            currentFrequencyData = null;
            updateBackdrop('frequency-editor', 'frequency-backdrop');
            localStorage.removeItem(STORAGE_KEY_FREQUENCY);
            localStorage.removeItem(STORAGE_KEY_FREQUENCY_TIME);
            syncFrequencyToUI();
            updateSaveTimeDisplay();
        }
        showToast(t('toast.resetDone'), 'success');
    }
}

// ==========================================
// 8. Tab 切换功能
// ==========================================
window.switchTab = function(tab) {
    currentTab = tab;

    const activeClass = "tab-button active px-4 py-2 text-xs font-bold text-gray-300 hover:bg-[#2d2d30] transition-colors border-b-2 border-blue-500";
    const inactiveClass = "tab-button px-4 py-2 text-xs font-bold text-gray-500 hover:bg-[#2d2d30] transition-colors border-b-2 border-transparent";

    // 更新 Tab 按钮状态
    const configBtn = document.getElementById('tab-config');
    const freqBtn = document.getElementById('tab-frequency');
    const searchBtn = document.getElementById('tab-search');
    const timelineBtn = document.getElementById('tab-timeline');

    if (configBtn) configBtn.className = tab === 'config' ? activeClass : inactiveClass;
    if (freqBtn) freqBtn.className = tab === 'frequency' ? activeClass : inactiveClass;
    if (searchBtn) searchBtn.className = tab === 'search' ? activeClass : inactiveClass;
    if (timelineBtn) timelineBtn.className = tab === 'timeline' ? activeClass : inactiveClass;

    // 更新编辑器显示
    document.getElementById('yaml-editor-wrap').classList.toggle('hidden', tab !== 'config');
    document.getElementById('frequency-editor-wrap').classList.toggle('hidden', tab !== 'frequency');
    document.getElementById('search-editor-wrap').classList.toggle('hidden', tab !== 'search');
    document.getElementById('timeline-editor-wrap').classList.toggle('hidden', tab !== 'timeline');

    // 更新右侧面板
    document.getElementById('config-panel').classList.toggle('hidden', tab !== 'config');
    document.getElementById('frequency-panel').classList.toggle('hidden', tab !== 'frequency');
    document.getElementById('search-panel').classList.toggle('hidden', tab !== 'search');
    document.getElementById('timeline-panel').classList.toggle('hidden', tab !== 'timeline');

    // 更新模块导航栏显示状态：只在 config 模式下显示
    const moduleNav = document.getElementById('module-nav');
    if (moduleNav) {
        moduleNav.classList.toggle('hidden', tab !== 'config');
    }

    // 更新保存时间显示
    const saveTimeConfig = document.getElementById('save-time-config');
    const saveTimeFrequency = document.getElementById('save-time-frequency');
    const saveTimeSearch = document.getElementById('save-time-search');
    const saveTimeTimeline = document.getElementById('save-time-timeline');
    if (saveTimeConfig) saveTimeConfig.classList.toggle('hidden', tab !== 'config');
    if (saveTimeFrequency) saveTimeFrequency.classList.toggle('hidden', tab !== 'frequency');
    if (saveTimeSearch) saveTimeSearch.classList.toggle('hidden', tab !== 'search');
    if (saveTimeTimeline) saveTimeTimeline.classList.toggle('hidden', tab !== 'timeline');

    // 更新右侧标题
    const versionBtn = document.getElementById('version-check-btn');
    if (tab === 'config') {
        document.getElementById('right-panel-title').textContent = t('panel.configModules');
        if (versionBtn) { versionBtn.style.display = ''; versionBtn.title = t('panel.versionCheck') + " config.yaml"; }
    } else if (tab === 'frequency') {
        document.getElementById('right-panel-title').textContent = t('panel.frequencyEdit');
        if (versionBtn) { versionBtn.style.display = ''; versionBtn.title = t('panel.versionCheck') + " frequency_words.txt"; }
    } else if (tab === 'search') {
        document.getElementById('right-panel-title').textContent = t('panel.searchEdit');
        if (versionBtn) versionBtn.style.display = 'none';
    } else {
        document.getElementById('right-panel-title').textContent = t('panel.timelineSchedule');
        if (versionBtn) versionBtn.style.display = 'none';
    }

    if (tab === 'frequency') {
        renderFrequencyPanel();
    }
    if (tab === 'search') {
        renderSearchPanel();
    }
    if (tab === 'timeline') {
        syncTimelineToUI();
    }
}

// ==========================================
// 9. Frequency 编辑器功能
// ==========================================
function parseFrequencyText(text) {
    const result = {
        globalFilter: [],
        wordGroups: [],
        originalText: text  // 保存原始文本
    };

    const lines = text.split('\n');
    let currentSection = null;
    let currentGroup = null;
    let lastLineWasAlias = false;  // 追踪上一行是否为别名行
    let relatedGroupsBuffer = [];  // 缓存连续的相关组
    let pendingComments = [];  // 缓存待分配的注释行

    // 辅助函数：保存缓存的相关组
    function flushRelatedGroups() {
        if (relatedGroupsBuffer.length > 0) {
            // 如果有多个连续的组，标记它们为相关组
            if (relatedGroupsBuffer.length > 1) {
                relatedGroupsBuffer.forEach((group, idx) => {
                    group.isRelatedGroup = true;
                    group.relatedGroupIndex = idx;
                    group.relatedGroupTotal = relatedGroupsBuffer.length;
                });
            }
            result.wordGroups.push(...relatedGroupsBuffer);
            relatedGroupsBuffer = [];
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 收集注释行（在 [WORD_GROUPS] 区域内）
        if (trimmed.startsWith('#') && currentSection === 'groups') {
            pendingComments.push(line);
            continue;
        }

        // 跳过注释（非 [WORD_GROUPS] 区域）
        if (trimmed.startsWith('#')) continue;

        // 空行：结束当前词组和相关组缓存
        if (!trimmed) {
            if (currentGroup) {
                // 保存当前词组到缓存
                relatedGroupsBuffer.push(currentGroup);
                currentGroup = null;
            }
            // 空行表示相关组结束，刷新缓存
            flushRelatedGroups();
            lastLineWasAlias = false;
            // 在 [WORD_GROUPS] 区域内，空行加入待分配注释（保留空行结构）
            if (currentSection === 'groups') {
                pendingComments.push('');
            }
            continue;
        }

        // 检测区域标记
        if (trimmed === '[GLOBAL_FILTER]') {
            currentSection = 'global';
            continue;
        }
        if (trimmed === '[WORD_GROUPS]') {
            currentSection = 'groups';
            continue;
        }

        // 处理内容
        if (currentSection === 'global') {
            result.globalFilter.push(trimmed);
        } else if (currentSection === 'groups') {
            // 检测组别名 [组名]
            const groupNameMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (groupNameMatch && !['GLOBAL_FILTER', 'WORD_GROUPS'].includes(groupNameMatch[1])) {
                // 保存当前词组到缓存
                if (currentGroup) {
                    relatedGroupsBuffer.push(currentGroup);
                }
                // 刷新缓存（组别名独立成组）
                flushRelatedGroups();
                // 创建组别名类型
                currentGroup = {
                    type: 'group-name',
                    name: groupNameMatch[1],
                    keywords: [],
                    startLine: i,
                    precedingComments: pendingComments.length > 0 ? [...pendingComments] : []
                };
                pendingComments = [];
                lastLineWasAlias = false;
            } else {
                // 检测 => 别名语法（允许右侧为空）
                const aliasMatch = trimmed.match(/^(.+?)\s*=>\s*(.*)$/);
                if (aliasMatch) {
                    const keyword = aliasMatch[1].trim();
                    const alias = aliasMatch[2].trim();

                    // 关键逻辑：如果上一行也是别名行（无空行分隔），则归入连续别名组
                    if (lastLineWasAlias && currentGroup && (currentGroup.type === 'alias' || currentGroup.type === 'alias-group')) {
                        // 如果当前是单个别名，升级为别名组
                        if (currentGroup.type === 'alias') {
                            currentGroup.type = 'alias-group';
                        }
                        // 添加到别名组
                        currentGroup.items.push({ keyword, alias });
                    } else {
                        // 新的单个别名（可能会升级为别名组）
                        if (currentGroup) {
                            // 保存当前词组到缓存（而不是直接添加到结果）
                            relatedGroupsBuffer.push(currentGroup);
                        }
                        currentGroup = {
                            type: 'alias',
                            items: [{ keyword, alias }],
                            startLine: i,
                            precedingComments: pendingComments.length > 0 ? [...pendingComments] : []
                        };
                        pendingComments = [];
                    }
                    lastLineWasAlias = true;
                } else {
                    // 普通关键词
                    if (!currentGroup || currentGroup.type === 'alias' || currentGroup.type === 'alias-group') {
                        // 如果当前是别名类型，需要先保存到缓存
                        if (currentGroup) {
                            relatedGroupsBuffer.push(currentGroup);
                        }
                        // 创建新的普通词组
                        currentGroup = {
                            type: 'plain',
                            keywords: [],
                            startLine: i,
                            precedingComments: pendingComments.length > 0 ? [...pendingComments] : []
                        };
                        pendingComments = [];
                    }
                    currentGroup.keywords.push(trimmed);
                    lastLineWasAlias = false;
                }
            }
        }
    }

    // 添加最后一个组
    if (currentGroup) {
        relatedGroupsBuffer.push(currentGroup);
    }
    flushRelatedGroups();

    return result;
}

function buildFrequencyText(data) {
    // 如果有原始文本，尝试保留注释
    if (data.originalText) {
        const lines = data.originalText.split('\n');
        let result = [];

        // 第一步：保留文件头部的注释
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '[GLOBAL_FILTER]') {
                break;
            }
            result.push(line);
            i++;
        }

        // 第二步：重建 [GLOBAL_FILTER] 区域
        result.push('[GLOBAL_FILTER]');

        // 保留 [GLOBAL_FILTER] 后面的注释（直到第一个非注释非空行）
        i++;
        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || trimmed === '') {
                result.push(line);
                i++;
            } else {
                break;
            }
        }

        // 添加全局过滤词
        data.globalFilter.forEach(filter => {
            result.push(filter);
        });

        // 跳过原始文件中的 [GLOBAL_FILTER] 内容（非注释行），保留空行和注释直到 [WORD_GROUPS]
        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed === '[WORD_GROUPS]') {
                break;
            }
            // 保留注释和空行
            if (trimmed.startsWith('#') || trimmed === '') {
                result.push(line);
            }
            i++;
        }

        // 第三步：重建 [WORD_GROUPS] 区域
        result.push('[WORD_GROUPS]');

        // 添加词组（注释已保存在每个词组的 precedingComments 中）
        data.wordGroups.forEach((group, index) => {
            // 先输出词组前的注释
            if (group.precedingComments && group.precedingComments.length > 0) {
                group.precedingComments.forEach(comment => {
                    result.push(comment);
                });
            }

            if (group.type === 'group-name') {
                // 组别名类型：[组名] + 关键词
                if (group.name) {
                    result.push(`[${group.name}]`);
                }
                group.keywords.forEach(kw => {
                    result.push(kw);
                });
            } else if (group.type === 'alias' || group.type === 'alias-group') {
                // 别名类型：keyword => alias
                group.items.forEach(item => {
                    result.push(`${item.keyword} => ${item.alias}`);
                });
            } else if (group.type === 'plain') {
                // 普通词组
                group.keywords.forEach(kw => {
                    result.push(kw);
                });
            }

            // 空行处理逻辑：
            // 1. 如果当前词组和下一个词组都是相关组，则不添加空行
            // 2. 否则，在词组之间添加空行
            const isLastGroup = index === data.wordGroups.length - 1;
            const nextGroup = !isLastGroup ? data.wordGroups[index + 1] : null;

            // 简化判断：只要当前和下一个都是相关组，就不添加空行
            const bothAreRelatedGroups = group.isRelatedGroup && nextGroup && nextGroup.isRelatedGroup;

            // 如果下一个词组有前置注释，不需要额外添加空行（注释中已包含空行）
            const nextHasComments = nextGroup && nextGroup.precedingComments && nextGroup.precedingComments.length > 0;

            if (bothAreRelatedGroups) {
                // 相关组内部不添加空行
                // 不添加任何内容
            } else if (!isLastGroup && !nextHasComments) {
                // 词组之间添加空行（如果下一个没有前置注释）
                result.push('');
            } else if (isLastGroup) {
                // 最后一个词组后也保留一个空行
                result.push('');
            }
        });

        return result.join('\n');
    }

    // 如果没有原始文本，使用默认模板
    let text = '# ═══════════════════════════════════════════════════════════════\n';
    text += '#                    TrendRadar 频率词配置文件\n';
    text += '# ═══════════════════════════════════════════════════════════════\n\n';

    text += '[GLOBAL_FILTER]\n';
    data.globalFilter.forEach(filter => {
        text += filter + '\n';
    });
    text += '\n\n';

    text += '[WORD_GROUPS]\n\n';
    data.wordGroups.forEach((group, index) => {
        // 先输出词组前的注释
        if (group.precedingComments && group.precedingComments.length > 0) {
            group.precedingComments.forEach(comment => {
                text += comment + '\n';
            });
        }

        if (group.type === 'group-name') {
            if (group.name) {
                text += `[${group.name}]\n`;
            }
            group.keywords.forEach(kw => {
                text += kw + '\n';
            });
        } else if (group.type === 'alias' || group.type === 'alias-group') {
            group.items.forEach(item => {
                text += `${item.keyword} => ${item.alias}\n`;
            });
        } else if (group.type === 'plain') {
            group.keywords.forEach(kw => {
                text += kw + '\n';
            });
        }

        // 空行处理逻辑：与上面保持一致
        const isLastGroup = index === data.wordGroups.length - 1;
        const nextGroup = !isLastGroup ? data.wordGroups[index + 1] : null;

        const bothAreRelatedGroups = group.isRelatedGroup && nextGroup && nextGroup.isRelatedGroup;

        // 如果下一个词组有前置注释，不需要额外添加空行
        const nextHasComments = nextGroup && nextGroup.precedingComments && nextGroup.precedingComments.length > 0;

        if (bothAreRelatedGroups) {
            // 相关组内部不添加空行
        } else if (!isLastGroup && !nextHasComments) {
            text += '\n';  // 词组之间用空行分隔
        } else if (isLastGroup) {
            text += '\n';  // 最后一个词组后也保留一个空行
        }
    });

    return text;
}

function syncFrequencyToUI() {
    const data = parseFrequencyText(currentFrequency);
    currentFrequencyData = data;
    renderFrequencyPanel(data);
}

function renderFrequencyPanel(data) {
    if (!data) {
        data = parseFrequencyText(currentFrequency);
    }

    const panel = document.getElementById('frequency-panel');

    // 辅助函数：根据关键词类型返回样式类
    function getKeywordClass(keyword) {
        if (keyword.startsWith('+')) return 'bg-green-500';
        if (keyword.startsWith('!')) return 'bg-red-500';
        if (keyword.startsWith('@')) return 'bg-purple-500';
        if (keyword.startsWith('/') || keyword.includes('=>')) return 'bg-indigo-500';
        return 'bg-blue-500';
    }

    // 辅助函数：为关键词添加标签
    function getKeywordLabel(keyword) {
        if (keyword.startsWith('+')) return t('freq.required');
        if (keyword.startsWith('!')) return t('freq.exclude');
        if (keyword.startsWith('@')) return t('freq.limit');
        if (keyword.startsWith('/')) return t('freq.regex');
        if (keyword.includes('=>')) return t('freq.alias');
        return '';
    }

    // 渲染词组卡片
    function renderGroupCard(group, idx) {
        const jumpIcon = `<i class="fa-solid fa-grip-vertical text-gray-400 text-xs mr-2"></i>`;

        // 序号标记
        const indexBadge = `<span class="text-xs bg-gray-700 text-white px-2.5 py-1 rounded-full font-bold mr-2">#${idx + 1}</span>`;

        // 相关组标记
        const relatedGroupBadge = group.isRelatedGroup
            ? `<span class="text-[10px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 rounded font-bold ml-2">
                <i class="fa-solid fa-link mr-1"></i>${t('freq.relatedGroup')} ${group.relatedGroupIndex + 1}/${group.relatedGroupTotal}
               </span>`
            : '';

        // 相关组边框样式
        const relatedGroupStyle = group.isRelatedGroup
            ? 'border-l-4 border-l-blue-500 shadow-lg'
            : '';

        if (group.type === 'group-name') {
            // 组别名类型
            return `
                <div class="word-group-card border-2 border-orange-200 bg-orange-50 group ${relatedGroupStyle} cursor-move" data-group-index="${idx}" onclick="scrollToWordGroupInEditor(${idx})">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center flex-1 gap-2">
                            ${jumpIcon}
                            ${indexBadge}
                            <span class="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded font-bold">${t('wgModal.groupAlias')}</span>
                            ${relatedGroupBadge}
                            <input type="text" value="${group.name || ''}" placeholder="${t('freq.groupNamePlaceholder')}"
                                   class="text-sm font-bold border-0 border-b-2 border-orange-300 focus:border-orange-500 outline-none px-2 py-1 flex-1 bg-transparent"
                                   onclick="event.stopPropagation()"
                                   onchange="updateGroupName(${idx}, this.value)">
                        </div>
                        <button onclick="event.stopPropagation(); removeWordGroup(${idx})" class="text-red-500 hover:text-red-700 text-xs ml-2">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="bg-white rounded p-3 border border-orange-200 editable-area" onclick="event.stopPropagation()">
                        <div class="text-xs text-gray-600 mb-2 font-bold">${t('freq.keywordList')}</div>
                        <div class="tag-input-container">
                            ${group.keywords.map(kw => {
                                const label = getKeywordLabel(kw);
                                const escapedKw = kw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                                return `
                                    <span class="tag-item ${getKeywordClass(kw)} relative break-all cursor-pointer" data-keyword="${escapedKw}" onclick="editKeyword(${idx}, this.dataset.keyword, this)">
                                        ${label ? `<span class="text-[9px] opacity-75 mr-1">[${label}]</span>` : ''}
                                        ${escapedKw}
                                        <button data-keyword="${escapedKw}" onclick="event.stopPropagation(); removeKeyword(${idx}, this.dataset.keyword)">×</button>
                                    </span>
                                `;
                            }).join('')}
                            <input type="text" class="tag-input" placeholder="${t('freq.keywordPlaceholder')}"
                                   onkeydown="handleKeywordInput(event, ${idx})">
                        </div>
                        <div class="flex items-center justify-between mt-2">
                            <button onclick="openDeepSeekAI('group', ${idx})" class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>${t('freq.aiWriteRegex')}
                            </button>
                            <div class="text-[10px] text-gray-400">${group.keywords.length}${t('freq.nKeywords')}</div>
                        </div>
                    </div>
                </div>
            `;
        } else if (group.type === 'alias') {
            // 单个别名类型
            const item = group.items[0];
            return `
                <div class="word-group-card border-2 border-teal-200 bg-teal-50 group ${relatedGroupStyle} cursor-move" data-group-index="${idx}" onclick="scrollToWordGroupInEditor(${idx})">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center flex-1 gap-2">
                            ${jumpIcon}
                            ${indexBadge}
                            <span class="text-[10px] bg-teal-500 text-white px-2 py-0.5 rounded font-bold">${t('wgModal.singleAlias')}</span>
                            ${relatedGroupBadge}
                        </div>
                        <button onclick="event.stopPropagation(); removeWordGroup(${idx})" class="text-red-500 hover:text-red-700 text-xs">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="bg-white rounded p-3 border border-teal-200 editable-area" onclick="event.stopPropagation()">
                        <div class="flex items-center gap-2">
                            <input type="text" value="${item.keyword || ''}" placeholder="${t('freq.regexPlaceholder')}"
                                   class="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-teal-500 outline-none text-sm font-mono"
                                   onblur="updateAliasItem(${idx}, 0, 'keyword', this.value)">
                            <span class="text-teal-600 font-bold">=></span>
                            <input type="text" value="${item.alias || ''}" placeholder="${t('freq.aliasPlaceholder')}"
                                   class="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-teal-500 outline-none text-sm"
                                   onblur="updateAliasItem(${idx}, 0, 'alias', this.value)">
                        </div>
                        <div class="flex items-center justify-between mt-2">
                            <button onclick="openDeepSeekAI('group', ${idx})" class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>${t('freq.aiWriteRegex')}
                            </button>
                            <div class="text-[10px] text-gray-500">
                                <i class="fa-solid fa-lightbulb mr-1"></i>${t('freq.aliasExample')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (group.type === 'alias-group') {
            // 连续别名组类型
            return `
                <div class="word-group-card border-2 border-purple-200 bg-purple-50 group ${relatedGroupStyle} cursor-move" data-group-index="${idx}" onclick="scrollToWordGroupInEditor(${idx})">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center flex-1 gap-2">
                            ${jumpIcon}
                            ${indexBadge}
                            <span class="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded font-bold">${t('wgModal.multiAlias')}</span>
                            ${relatedGroupBadge}
                        </div>
                        <button onclick="event.stopPropagation(); removeWordGroup(${idx})" class="text-red-500 hover:text-red-700 text-xs">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="bg-white rounded p-3 border border-purple-200 space-y-2 editable-area" onclick="event.stopPropagation()">
                        <div class="text-xs text-gray-600 mb-2 font-bold">
                            ${t('freq.aliasList')}
                        </div>
                        ${group.items.map((item, itemIdx) => `
                            <div class="flex items-center gap-2">
                                <input type="text" value="${item.keyword || ''}" placeholder="${t('freq.regexPlaceholder')}"
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-purple-500 outline-none text-sm font-mono"
                                       onblur="updateAliasItem(${idx}, ${itemIdx}, 'keyword', this.value)">
                                <span class="text-purple-600 font-bold">=></span>
                                <input type="text" value="${item.alias || ''}" placeholder="${t('freq.aliasPlaceholder')}"
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-purple-500 outline-none text-sm"
                                       onblur="updateAliasItem(${idx}, ${itemIdx}, 'alias', this.value)">
                                <button onclick="removeAliasItem(${idx}, ${itemIdx})" class="text-red-500 hover:text-red-700 text-xs">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        `).join('')}
                        <div class="flex items-center justify-between mt-2">
                            <button onclick="openDeepSeekAI('group', ${idx})" class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>${t('freq.aiWriteRegex')}
                            </button>
                            <div class="text-[10px] text-gray-500">
                                <i class="fa-solid fa-info-circle mr-1"></i>${t('freq.aliasHint')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (group.type === 'plain') {
            // 普通词组类型
            return `
                <div class="word-group-card border-2 border-gray-200 bg-gray-50 group ${relatedGroupStyle} cursor-move" data-group-index="${idx}" onclick="scrollToWordGroupInEditor(${idx})">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center flex-1 gap-2">
                            ${jumpIcon}
                            ${indexBadge}
                            <span class="text-[10px] bg-gray-500 text-white px-2 py-0.5 rounded font-bold">${t('wgModal.plain')}</span>
                            ${relatedGroupBadge}
                        </div>
                        <button onclick="event.stopPropagation(); removeWordGroup(${idx})" class="text-red-500 hover:text-red-700 text-xs">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="bg-white rounded p-3 border border-gray-200 editable-area" onclick="event.stopPropagation()">
                        <div class="tag-input-container">
                            ${group.keywords.map(kw => {
                                const label = getKeywordLabel(kw);
                                const escapedKw = kw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                                return `
                                    <span class="tag-item ${getKeywordClass(kw)} relative break-all cursor-pointer" data-keyword="${escapedKw}" onclick="editKeyword(${idx}, this.dataset.keyword, this)">
                                        ${label ? `<span class="text-[9px] opacity-75 mr-1">[${label}]</span>` : ''}
                                        ${escapedKw}
                                        <button data-keyword="${escapedKw}" onclick="event.stopPropagation(); removeKeyword(${idx}, this.dataset.keyword)">×</button>
                                    </span>
                                `;
                            }).join('')}
                            <input type="text" class="tag-input" placeholder="${t('freq.keywordPlaceholder')}"
                                   onkeydown="handleKeywordInput(event, ${idx})">
                        </div>
                        <div class="flex items-center justify-between mt-2">
                            <button onclick="openDeepSeekAI('group', ${idx})" class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>${t('freq.aiWriteRegex')}
                            </button>
                            <div class="text-[10px] text-gray-400">${group.keywords.length}${t('freq.nKeywords')}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        return '';
    }

    panel.innerHTML = `
        <!-- 规则说明区域 -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 mb-4">
            <div class="flex items-start gap-3">
                <i class="fa-solid fa-book text-blue-600 text-lg mt-0.5"></i>
                <div class="flex-1">
                    <h3 class="text-sm font-bold text-gray-800 mb-2">${t('freq.typesTitle')}</h3>
                    <div class="grid grid-cols-2 gap-3 text-xs">
                        <div class="bg-white rounded p-2 border-l-4 border-orange-500">
                            <div class="font-bold text-orange-700 mb-1">${t('freq.groupAlias')}</div>
                            <div class="text-gray-600 font-mono text-[10px] mb-1">[East Asia]<br>Japan<br>Korea</div>
                            <div class="text-gray-500 text-[10px]">${t('freq.groupAliasDesc')}</div>
                        </div>
                        <div class="bg-white rounded p-2 border-l-4 border-teal-500">
                            <div class="font-bold text-teal-700 mb-1">${t('freq.singleAlias')}</div>
                            <div class="text-gray-600 font-mono text-[10px] mb-1">/termA|termB/ => DisplayName</div>
                            <div class="text-gray-500 text-[10px]">${t('freq.singleAliasDesc')}</div>
                        </div>
                        <div class="bg-white rounded p-2 border-l-4 border-purple-500">
                            <div class="font-bold text-purple-700 mb-1">${t('freq.multiAlias')}</div>
                            <div class="text-gray-600 font-mono text-[10px] mb-1">/brandA|aliasA/ => BrandA<br>/brandB|aliasB/ => BrandB</div>
                            <div class="text-gray-500 text-[10px]">${t('freq.multiAliasDesc')}</div>
                        </div>
                        <div class="bg-white rounded p-2 border-l-4 border-gray-500">
                            <div class="font-bold text-gray-700 mb-1">${t('freq.plain')}</div>
                            <div class="text-gray-600 font-mono text-[10px] mb-1">keyword</div>
                            <div class="text-gray-500 text-[10px]">${t('freq.plainDesc')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Global Filter 区域 -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-gray-700">
                    <i class="fa-solid fa-filter mr-2"></i>${t('freq.globalFilter')}
                </h3>
                <button onclick="openDeepSeekAI('global')" class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>${t('freq.aiWriteRegex')}
                </button>
            </div>
            <div id="global-filter-tags" class="tag-input-container">
                ${data.globalFilter.map(f => `
                    <span class="tag-item ${getKeywordClass(f)}">
                        ${f}
                        <button onclick="removeGlobalFilter('${f.replace(/'/g, "\\'")}')">×</button>
                    </span>
                `).join('')}
                <input type="text" class="tag-input" placeholder="${t('freq.globalFilterPlaceholder')}" onkeydown="handleGlobalFilterInput(event)">
            </div>
            <div class="text-xs text-gray-500 mt-2">
                <i class="fa-solid fa-lightbulb mr-1"></i>${t('common.hint')}${t('freq.regexHint')}
            </div>
        </div>

        <!-- Word Groups 区域 -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-gray-700">
                    <i class="fa-solid fa-layer-group mr-2"></i>${t('freq.keywordGroups')} <span class="text-xs text-gray-400 font-normal">(${data.wordGroups.length}${t('freq.nGroups')})</span>
                </h3>
                <button onclick="addWordGroup('top')" class="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                    <i class="fa-solid fa-plus mr-1"></i>${t('freq.addGroup')}
                </button>
            </div>
            <div id="word-groups-container" class="space-y-3">
                ${data.wordGroups.map((group, idx) => {
                    const card = renderGroupCard(group, idx);
                    // 在每个词组后添加插入区域（最后一个除外）
                    if (idx < data.wordGroups.length - 1) {
                        return card + `
                            <div class="insert-zone group/insert" data-insert-index="${idx + 1}">
                                <button onclick="insertWordGroupAt(${idx + 1})" class="insert-button">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        `;
                    }
                    return card;
                }).join('')}
            </div>

            <!-- 底部添加按钮 -->
            <div class="mt-4 flex justify-center">
                <button onclick="addWordGroup('bottom')" class="text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all flex items-center gap-2">
                    <i class="fa-solid fa-plus-circle"></i>
                    <span>${t('freq.addGroupBottom')}</span>
                </button>
            </div>
        </div>
    `;

    // 初始化拖拽排序功能
    setTimeout(() => {
        const container = document.getElementById('word-groups-container');
        if (container && typeof Sortable !== 'undefined') {
            // 销毁之前的实例（如果存在）
            if (container.sortableInstance) {
                container.sortableInstance.destroy();
            }

            // 创建新的 Sortable 实例
            container.sortableInstance = new Sortable(container, {
                animation: 150,
                filter: '.editable-area, input, button, select, textarea',  // 排除编辑区域
                preventOnFilter: false,  // 允许在过滤区域正常交互
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onEnd: function(evt) {
                    // 获取所有词组卡片的当前顺序
                    const cards = Array.from(container.querySelectorAll('.word-group-card'));
                    const newOrder = cards.map(card => parseInt(card.getAttribute('data-group-index')));

                    // 检查顺序是否改变
                    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
                    const oldOrder = data.wordGroups.map((_, idx) => idx);

                    if (JSON.stringify(newOrder) !== JSON.stringify(oldOrder)) {
                        // 根据新顺序重新排列数据
                        const reorderedGroups = newOrder.map(idx => data.wordGroups[idx]);
                        data.wordGroups = reorderedGroups;

                        // 重新构建文本
                        currentFrequency = buildFrequencyText(data);
                        currentFrequencyData = parseFrequencyText(currentFrequency);
                        document.getElementById('frequency-editor').value = currentFrequency;
                        updateBackdrop('frequency-editor', 'frequency-backdrop');

                        // 重新渲染
                        renderFrequencyPanel(currentFrequencyData);
                    }
                }
            });
        }
    }, 0);
}

// Global Filter 操作
window.handleGlobalFilterInput = function(event) {
    if (event.key === 'Enter' && event.target.value.trim()) {
        const data = currentFrequencyData || parseFrequencyText(currentFrequency);
        data.globalFilter.push(event.target.value.trim());
        currentFrequency = buildFrequencyText(data);
        currentFrequencyData = data;
        document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
        renderFrequencyPanel(data);
    }
}

window.removeGlobalFilter = function(filter) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    data.globalFilter = data.globalFilter.filter(f => f !== filter);
    currentFrequency = buildFrequencyText(data);
    currentFrequencyData = data;
    document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
    renderFrequencyPanel(data);
}

// Word Groups 操作
let pendingWordGroupPosition = 'top';  // 记录添加位置：'top', 'bottom', 或数字索引

window.addWordGroup = function(position = 'top') {
    pendingWordGroupPosition = position;
    document.getElementById('wordgroup-type-modal').classList.remove('hidden');
}

// 在指定位置插入词组
window.insertWordGroupAt = function(index) {
    pendingWordGroupPosition = index;  // 记录插入位置（数字索引）
    document.getElementById('wordgroup-type-modal').classList.remove('hidden');
}

window.closeWordGroupTypeModal = function() {
    document.getElementById('wordgroup-type-modal').classList.add('hidden');
}

window.confirmAddWordGroup = function(type) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    let newGroup;

    if (type === 'group') {
        // 组别名类型
        newGroup = { type: 'group-name', name: '', keywords: [] };
    } else if (type === 'alias') {
        // 单个别名类型
        newGroup = { type: 'alias', items: [{ keyword: '', alias: '' }] };
    } else if (type === 'multi-alias') {
        // 连续别名类型（多个别名行）
        newGroup = { type: 'alias-group', items: [{ keyword: '', alias: '' }, { keyword: '', alias: '' }] };
    } else if (type === 'plain') {
        // 普通词组类型
        newGroup = { type: 'plain', keywords: [] };
    }

    // 根据位置插入
    if (pendingWordGroupPosition === 'bottom') {
        data.wordGroups.push(newGroup);
    } else if (pendingWordGroupPosition === 'top') {
        data.wordGroups.unshift(newGroup);
    } else if (typeof pendingWordGroupPosition === 'number') {
        // 在指定索引位置插入
        data.wordGroups.splice(pendingWordGroupPosition, 0, newGroup);
    }

    currentFrequency = buildFrequencyText(data);
    currentFrequencyData = data;
    document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
    renderFrequencyPanel(data);

    closeWordGroupTypeModal();

    // 滚动到新添加的词组
    setTimeout(() => {
        const container = document.getElementById('word-groups-container');
        if (pendingWordGroupPosition === 'bottom') {
            container.scrollTop = container.scrollHeight;
        } else if (pendingWordGroupPosition === 'top') {
            container.scrollTop = 0;
        } else if (typeof pendingWordGroupPosition === 'number') {
            // 滚动到插入的位置
            const cards = container.querySelectorAll('.word-group-card');
            if (cards[pendingWordGroupPosition]) {
                cards[pendingWordGroupPosition].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 100);
}

window.removeWordGroup = function(index) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    data.wordGroups.splice(index, 1);
    currentFrequency = buildFrequencyText(data);
    // 重新解析以更新相关组信息
    currentFrequencyData = parseFrequencyText(currentFrequency);
    document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
    renderFrequencyPanel(currentFrequencyData);
}

window.updateGroupName = function(index, name) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    const group = data.wordGroups[index];

    // 只有 group-name 类型才有 name 字段
    if (group.type === 'group-name') {
        group.name = name;
    }

    currentFrequency = buildFrequencyText(data);
    // 重新解析以更新相关组信息
    currentFrequencyData = parseFrequencyText(currentFrequency);
    document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
    renderFrequencyPanel(currentFrequencyData);
}

window.editKeyword = function(groupIndex, oldKeyword, spanElement) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    const group = data.wordGroups[groupIndex];

    // 只有 group-name 和 plain 类型才有 keywords 字段
    if (group.type !== 'group-name' && group.type !== 'plain') {
        return;
    }

    const originalKeyword = group.keywords.find(kw => kw === oldKeyword) || oldKeyword;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalKeyword;
    input.className = 'tag-input inline-block px-2 py-1 text-xs border border-blue-500 rounded';
    input.style.minWidth = '100px';

    const saveEdit = () => {
        const newKeyword = input.value.trim();
        if (newKeyword && newKeyword !== originalKeyword) {
            const kwIndex = group.keywords.indexOf(originalKeyword);
            if (kwIndex !== -1) {
                group.keywords[kwIndex] = newKeyword;
            }
            currentFrequency = buildFrequencyText(data);
            // 重新解析以更新相关组信息
            currentFrequencyData = parseFrequencyText(currentFrequency);
            document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
            renderFrequencyPanel(currentFrequencyData);
        } else {
            spanElement.style.display = '';
            input.remove();
        }
    };

    input.onblur = saveEdit;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            spanElement.style.display = '';
            input.remove();
        }
    };

    spanElement.style.display = 'none';
    spanElement.parentNode.insertBefore(input, spanElement);
    input.focus();
    input.select();
}

window.handleKeywordInput = function(event, groupIndex) {
    if (event.key === 'Enter' && event.target.value.trim()) {
        const data = currentFrequencyData || parseFrequencyText(currentFrequency);
        const group = data.wordGroups[groupIndex];

        // 只有 group-name 和 plain 类型才能添加关键词
        if (group.type === 'group-name' || group.type === 'plain') {
            group.keywords.push(event.target.value.trim());
            event.target.value = '';

            currentFrequency = buildFrequencyText(data);
            // 重新解析以更新相关组信息
            currentFrequencyData = parseFrequencyText(currentFrequency);
            document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
            renderFrequencyPanel(currentFrequencyData);
        }
    }
}

window.removeKeyword = function(groupIndex, keyword) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    const group = data.wordGroups[groupIndex];

    // 只有 group-name 和 plain 类型才能删除关键词
    if (group.type === 'group-name' || group.type === 'plain') {
        group.keywords = group.keywords.filter(k => k !== keyword);

        // 如果词组变空，删除整个词组
        if (group.keywords.length === 0) {
            data.wordGroups.splice(groupIndex, 1);
        }

        currentFrequency = buildFrequencyText(data);
        // 重新解析以更新相关组信息
        currentFrequencyData = parseFrequencyText(currentFrequency);
        document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
        renderFrequencyPanel(currentFrequencyData);
    }
}

// 更新别名项
window.updateAliasItem = function(groupIndex, itemIndex, field, value) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    const group = data.wordGroups[groupIndex];

    // 只有 alias 和 alias-group 类型才有 items 字段
    if (group.type === 'alias' || group.type === 'alias-group') {
        if (group.items[itemIndex]) {
            group.items[itemIndex][field] = value;

            currentFrequency = buildFrequencyText(data);
            currentFrequencyData = parseFrequencyText(currentFrequency);
            document.getElementById('frequency-editor').value = currentFrequency;
            updateBackdrop('frequency-editor', 'frequency-backdrop');
            renderFrequencyPanel(currentFrequencyData);
        }
    }
}

// 添加别名项
window.addAliasItem = function(groupIndex) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    const group = data.wordGroups[groupIndex];

    // 只有 alias-group 类型才能添加别名项
    if (group.type === 'alias-group') {
        group.items.push({ keyword: '', alias: '' });

        currentFrequency = buildFrequencyText(data);
        // 重新解析以更新相关组信息
        currentFrequencyData = parseFrequencyText(currentFrequency);
        document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
        renderFrequencyPanel(currentFrequencyData);
    } else if (group.type === 'alias') {
        // 如果是单个别名，升级为别名组
        group.type = 'alias-group';
        group.items.push({ keyword: '', alias: '' });

        currentFrequency = buildFrequencyText(data);
        // 重新解析以更新相关组信息
        currentFrequencyData = parseFrequencyText(currentFrequency);
        document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
        renderFrequencyPanel(currentFrequencyData);
    }
}

// 删除别名项
window.removeAliasItem = function(groupIndex, itemIndex) {
    const data = currentFrequencyData || parseFrequencyText(currentFrequency);
    const group = data.wordGroups[groupIndex];

    // 只有 alias-group 类型才能删除别名项
    if (group.type === 'alias-group') {
        group.items.splice(itemIndex, 1);

        // 如果没有别名项了，删除整个词组
        if (group.items.length === 0) {
            data.wordGroups.splice(groupIndex, 1);
        }
        // 如果只剩一个别名项，降级为单个别名
        else if (group.items.length === 1) {
            group.type = 'alias';
        }

        currentFrequency = buildFrequencyText(data);
        currentFrequencyData = parseFrequencyText(currentFrequency);
        document.getElementById('frequency-editor').value = currentFrequency;
    updateBackdrop('frequency-editor', 'frequency-backdrop');
        renderFrequencyPanel(currentFrequencyData);
    }
}

// DeepSeek AI 辅助
window.openDeepSeekAI = function(type, groupIndex) {
    const userInput = window.prompt(t('prompt.enterCoreKeyword'));
    if (!userInput) return;

    const promptText = `我正在配置一个新闻聚合系统，需要通过 Python 正则表达式 抓取关于【${userInput}】的新闻。

请帮我完成以下步骤，并最终只输出一个正则表达式字符串：

第一步：【精准关键词筛选】
请列出与【${userInput}】强绑定的核心词汇：
1. 核心品牌：包括中文全称、简称、股票代码、别名。
2. 核心人物：仅限最高决策层或极具代表性的创始人。
3. 独家产品：必须是具有极高辨识度的独家产品名。
4. 核心工作室/子品牌：强相关的下属机构。

第二步：【严格清洗与过滤】（请严格执行）
1. 包含关系去重（最短匹配原则）：
   - 中文：如果列表里已经有了核心短词（如“腾讯”），请删除所有包含该短词的长词（如“腾讯云”、“腾讯视频”统统不要，因为它们会被短词命中）。
   - 英文：如果有了 \\bKeyword\\b，就不要再出现 Keyword。
2. 彻底排除无关公司：
   - 绝对不要包含：该品牌的竞争对手、合作伙伴（如京东、美团、字节跳动等非隶属公司）。
3. 彻底排除通用黑话：
   - 绝对不要包含：行业通用词（如“互联网”、“大厂”、“新质生产力”、“人工智能”、“元宇宙”、“金融科技”等）。

第三步：【构建 Python 正则】
将清洗后的词汇合并，格式要求如下：
1. 英文处理：所有英文单词必须前后加 \\b（例如 \\bWord\\b），严禁出现没有边界符的英文单词。
2. 连接符：用 | 连接。

最终输出示例格式：
/词A|词B|\\bEnglishWord\\b/ => ${userInput}

输出要求：
- 只要这一行正则表达式，不要任何解释，不要代码块。`;

    const textArea = document.createElement("textarea");
    textArea.value = promptText;

    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    let copySuccess = false;
    try {
        copySuccess = document.execCommand('copy');
    } catch (err) {
        console.error('复制失败:', err);
    }

    document.body.removeChild(textArea);

    if (copySuccess) {
        if (confirm(t('ai.promptCopied') + '\n\n' + t('ai.keyword') + userInput + '\n\n' + t('ai.goDeepSeek'))) {
            window.open('https://chat.deepseek.com/', '_blank');
        }
    } else {
        prompt(t('ai.copyFailed'), promptText);
        window.open('https://chat.deepseek.com/', '_blank');
    }
}

// ==========================================
// 10. 平台管理功能
// ==========================================

// 解析当前配置中的平台列表
function parsePlatformsFromYaml() {
    try {
        const doc = jsyaml.load(currentYaml);
        if (doc && doc.platforms && doc.platforms.sources) {
            return doc.platforms.sources;
        }
    } catch (e) {}
    return [];
}

// 渲染平台列表
function renderPlatformsList() {
    const container = document.getElementById('platforms-list');
    if (!container) return;

    const platforms = parsePlatformsFromYaml();

    if (platforms.length === 0) {
        container.innerHTML = `<div class="text-xs text-gray-400 italic">${t('freq.noPlatforms')}</div>`;
        return;
    }

    container.innerHTML = platforms.map((p, idx) => `
        <div class="platform-item flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:border-blue-300 transition-colors" data-index="${idx}">
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-grip-vertical text-gray-300 cursor-move"></i>
                <span class="text-xs font-medium text-gray-700">${p.name}</span>
                <span class="text-[10px] text-gray-400">(${p.id})</span>
            </div>
            <button onclick="removePlatform(${idx})" class="text-red-400 hover:text-red-600 text-xs" title="${t('common.delete')}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');

    // 初始化拖拽排序
    if (typeof Sortable !== 'undefined') {
        new Sortable(container, {
            animation: 150,
            handle: '.fa-grip-vertical',
            onEnd: function(evt) {
                reorderPlatforms(evt.oldIndex, evt.newIndex);
            }
        });
    }
}

// 删除平台
window.removePlatform = function(index) {
    const platforms = parsePlatformsFromYaml();
    if (index < 0 || index >= platforms.length) return;

    const platformName = platforms[index].name;
    if (!confirm(t('confirm.deletePlatform', platformName))) return;

    platforms.splice(index, 1);
    updatePlatformsInYaml(platforms);
}

// 重新排序平台
function reorderPlatforms(oldIndex, newIndex) {
    const platforms = parsePlatformsFromYaml();
    const [removed] = platforms.splice(oldIndex, 1);
    platforms.splice(newIndex, 0, removed);
    updatePlatformsInYaml(platforms);
}

// 更新 YAML 中的平台配置（保留注释）
function updatePlatformsInYaml(platforms) {
    const editor = document.getElementById('yaml-editor');
    let yaml = editor.value;
    const lines = yaml.split('\n');

    // 找到 platforms.sources 的位置
    let sourcesStart = -1;
    let sourcesEnd = -1;
    let inPlatforms = false;
    let inSources = false;
    let baseIndent = 0;
    let lastDataLineIndex = -1; // 记录最后一个数据行的位置

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (line.match(/^platforms:/)) {
            inPlatforms = true;
            continue;
        }

        if (inPlatforms && !inSources && trimmed.startsWith('sources:')) {
            sourcesStart = i + 1;
            inSources = true;
            baseIndent = line.search(/\S/) + 2; // sources 下一级的缩进
            continue;
        }

        if (inSources) {
            const currentIndent = line.search(/\S/);

            // 如果是数据行（以 - 开头或是数据项的属性）
            if (trimmed.startsWith('-')) {
                lastDataLineIndex = i;
            } else if (trimmed && !trimmed.startsWith('#') && currentIndent >= baseIndent) {
                // 数据项的属性行（如 name:, id:）
                lastDataLineIndex = i;
            } else if (trimmed && !trimmed.startsWith('#') && currentIndent < baseIndent) {
                // 遇到缩进更小的非注释行，说明离开了 sources 区域
                sourcesEnd = lastDataLineIndex + 1;
                break;
            }
        }

        // 检查是否进入下一个顶级模块
        if (inPlatforms && line.match(/^[a-z_]+:/) && !line.match(/^platforms:/)) {
            if (lastDataLineIndex >= 0) {
                sourcesEnd = lastDataLineIndex + 1;
            } else {
                sourcesEnd = i;
            }
            break;
        }
    }

    // 如果没有找到结束位置，使用最后一个数据行的下一行
    if (sourcesEnd === -1) {
        sourcesEnd = lastDataLineIndex >= 0 ? lastDataLineIndex + 1 : lines.length;
    }

    // 提取区域内的注释（保留在开头的注释）
    const regionLines = lines.slice(sourcesStart, sourcesEnd);
    const leadingComments = [];
    for (const line of regionLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            leadingComments.push(line);
        } else if (trimmed.startsWith('-') || (trimmed && !trimmed.startsWith('#'))) {
            // 遇到第一个数据项，停止收集注释
            break;
        } else if (trimmed === '') {
            // 空行也保留
            leadingComments.push(line);
        }
    }

    const indent = '    '; // 4 空格缩进
    const newSourcesLines = platforms.map(p =>
        `${indent}- id: "${p.id}"\n${indent}  name: "${p.name}"`
    ).join('\n');

    const beforeSources = lines.slice(0, sourcesStart);
    const afterSources = lines.slice(sourcesEnd);

    // 组合：前面内容 + 开头注释 + 新数据 + 后面内容
    const newYaml = [
        ...beforeSources,
        ...(leadingComments.length > 0 ? leadingComments : []),
        newSourcesLines,
        ...afterSources
    ].join('\n');

    editor.value = newYaml;
    currentYaml = newYaml;
    updateBackdrop('yaml-editor', 'yaml-backdrop');
    debounceSaveConfig();
    renderPlatformsList();
    renderStandaloneLists(); // 同步更新独立展示区的平台选择列表
}

// ==========================================
// 12. Display Regions 排序与管理功能
// ==========================================

const DISPLAY_REGIONS_DEF = [
    { key: "hotlist", labelKey: "region.hotlist" },
    { key: "new_items", labelKey: "region.new_items" },
    { key: "rss", labelKey: "region.rss" },
    { key: "web_search", labelKey: "region.web_search" },
    { key: "standalone", labelKey: "region.standalone" },
    { key: "ai_analysis", labelKey: "region.ai_analysis" }
];

// 从 YAML 解析 display.regions，严格按照 region_order 定义顺序
function parseDisplayRegionsFromYaml() {
    try {
        const doc = jsyaml.load(currentYaml);
        if (doc && doc.display) {
            const regionOrder = doc.display.region_order || [];
            const regionStates = doc.display.regions || {};

            // 严格按 region_order 顺序构建列表
            if (regionOrder.length > 0) {
                const list = regionOrder.map(key => {
                    const normalizedKey = key === 'new_item' ? 'new_items' : key;
                    const def = DISPLAY_REGIONS_DEF.find(d => d.key === normalizedKey);
                    return {
                        key: normalizedKey,
                        label: def ? t(def.labelKey) : normalizedKey,
                        enabled: regionStates[normalizedKey] !== undefined ? regionStates[normalizedKey] : false
                    };
                });
                // 兼容旧配置：若 region_order 尚未包含 web_search，补入到 rss 之后方便拖拽启用
                if (!list.some(r => r.key === 'web_search')) {
                    const wsItem = {
                        key: 'web_search',
                        label: t('region.web_search'),
                        enabled: regionStates.web_search !== undefined ? regionStates.web_search : false
                    };
                    const rssIdx = list.findIndex(r => r.key === 'rss');
                    if (rssIdx >= 0) {
                        list.splice(rssIdx + 1, 0, wsItem);
                    } else {
                        list.push(wsItem);
                    }
                }
                return list;
            }

            // 后备方案：如果没有 region_order，使用 regions 对象的顺序
            const regions = [];
            for (const key in regionStates) {
                const normalizedKey = key === 'new_item' ? 'new_items' : key;
                const def = DISPLAY_REGIONS_DEF.find(d => d.key === normalizedKey);
                if (def) {
                    regions.push({
                        key: normalizedKey,
                        label: t(def.labelKey),
                        enabled: regionStates[key]
                    });
                }
            }
            if (!regions.some(r => r.key === 'web_search')) {
                regions.push({
                    key: 'web_search',
                    label: t('region.web_search'),
                    enabled: false
                });
            }
            return regions;
        }
    } catch (e) {}

    // 默认返回所有区域（禁用状态）
    return DISPLAY_REGIONS_DEF.map(def => ({
        key: def.key,
        label: t(def.labelKey),
        enabled: false
    }));
}

// 渲染 Display Regions 列表
function renderDisplayRegionsList() {
    const container = document.getElementById('display-regions-list');
    if (!container) return;

    const regions = parseDisplayRegionsFromYaml();

    container.innerHTML = regions.map((r, idx) => `
        <div class="display-region-item flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:border-blue-300 transition-colors" data-key="${r.key}">
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-grip-vertical text-gray-300 cursor-move"></i>
                <span class="text-xs font-medium ${r.enabled ? 'text-gray-700' : 'text-gray-400'}">${r.label}</span>
                <span class="text-[10px] text-gray-400">(${r.key})</span>
            </div>
            <div class="relative inline-block w-10 align-middle select-none">
                <input type="checkbox" id="toggle-region-${r.key}"
                       ${r.enabled ? 'checked' : ''}
                       onchange="toggleDisplayRegion('${r.key}')"
                       class="toggle-checkbox absolute block w-4 h-4 mt-0.5 ml-0.5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-200 ease-in-out"/>
                <label for="toggle-region-${r.key}" class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
            </div>
        </div>
    `).join('');

    // 初始化拖拽排序
    if (typeof Sortable !== 'undefined') {
        new Sortable(container, {
            animation: 150,
            handle: '.fa-grip-vertical',
            onEnd: function(evt) {
                reorderDisplayRegions();
            }
        });
    }
}

// 切换区域启用状态
window.toggleDisplayRegion = function(key) {
    const regions = parseDisplayRegionsFromYaml();
    const target = regions.find(r => r.key === key);
    if (target) {
        target.enabled = !target.enabled;
        updateDisplayRegionsInYaml(regions);
    }
}

// 重新排序区域
window.reorderDisplayRegions = function() {
    const container = document.getElementById('display-regions-list');
    const items = container.querySelectorAll('.display-region-item');
    const newOrderKeys = Array.from(items).map(item => item.dataset.key);

    const currentRegions = parseDisplayRegionsFromYaml();

    const newRegions = newOrderKeys.map(key => {
        return currentRegions.find(r => r.key === key);
    }).filter(r => r); // 过滤掉可能的 undefined

    updateDisplayRegionsInYaml(newRegions);
}

// 更新 YAML 中的 display.regions 和 display.region_order
function updateDisplayRegionsInYaml(regions) {
    const editor = document.getElementById('yaml-editor');
    let yaml = editor.value;
    const lines = yaml.split('\n');

    let regionOrderStart = -1;
    let regionOrderEnd = -1;
    let regionsStart = -1;
    let regionsEnd = -1;
    let inDisplay = false;
    let regionOrderIndent = 0;
    let regionsIndent = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (line.match(/^display:/)) {
            inDisplay = true;
            continue;
        }

        if (!inDisplay) continue;

        // 查找 region_order 数组
        if (trimmed.startsWith('region_order:')) {
            regionOrderStart = i + 1;
            regionOrderIndent = line.search(/\S/) + 2;
            // 找到 region_order 的结束位置
            for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j];
                const nextTrimmed = nextLine.trim();
                if (nextTrimmed && !nextTrimmed.startsWith('#') && !nextTrimmed.startsWith('-')) {
                    const nextIndent = nextLine.search(/\S/);
                    if (nextIndent < regionOrderIndent) {
                        regionOrderEnd = j;
                        break;
                    }
                }
            }
            if (regionOrderEnd === -1) regionOrderEnd = lines.length;
            continue;
        }

        // 查找 regions 对象
        if (trimmed.startsWith('regions:')) {
            regionsStart = i + 1;
            regionsIndent = line.search(/\S/) + 2;
            // 找到 regions 的结束位置（遇到同级或更高级的键）
            for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j];
                const nextTrimmed = nextLine.trim();
                if (nextTrimmed && !nextTrimmed.startsWith('#')) {
                    const nextIndent = nextLine.search(/\S/);
                    // 检查是否是同级或更高级的键（如 standalone:）
                    if (nextIndent <= line.search(/\S/)) {
                        regionsEnd = j;
                        break;
                    }
                }
            }
            if (regionsEnd === -1) regionsEnd = lines.length;
            break;
        }

        // 检查是否离开 display 模块
        if (line.match(/^[a-z_]+:/) && !line.match(/^display:/)) {
            break;
        }
    }

    // 更新 region_order 数组（保留注释）
    if (regionOrderStart > 0 && regionOrderEnd > regionOrderStart) {
        const indentStr = ' '.repeat(regionOrderIndent);

        // 提取原有行的注释映射
        const originalRegionOrderBlock = lines.slice(regionOrderStart, regionOrderEnd);
        const commentMap = {};

        originalRegionOrderBlock.forEach(line => {
            // 匹配 "- key  # 注释" 格式
            const match = line.match(/^\s*-\s*([a-z_]+)\s*(#.*)?$/);
            if (match) {
                const key = match[1];
                const comment = match[2] || '';
                if (key) commentMap[key] = comment;
            }
        });

        // 生成新的行，保留注释
        const newRegionOrderLines = regions.map(r => {
            const comment = commentMap[r.key] || '';
            return `${indentStr}- ${r.key}${comment ? '                       ' + comment : ''}`;
        });

        lines.splice(regionOrderStart, regionOrderEnd - regionOrderStart, ...newRegionOrderLines);

        // 调整 regionsStart 和 regionsEnd
        const lineDiff = newRegionOrderLines.length - (regionOrderEnd - regionOrderStart);
        if (regionsStart > regionOrderEnd) {
            regionsStart += lineDiff;
            regionsEnd += lineDiff;
        }
    }

    // 更新 regions 对象
    if (regionsStart > 0 && regionsEnd > regionsStart) {
        const originalRegionsBlock = lines.slice(regionsStart, regionsEnd);
        const commentMap = {};

        originalRegionsBlock.forEach(line => {
            const match = line.match(/^\s*([a-z_]+):\s*[^#]*(#.*)?$/);
            if (match) {
                const key = match[1];
                const comment = match[2] || '';
                if (key) commentMap[key] = comment;
            }
        });

        const indentStr = ' '.repeat(regionsIndent);
        const newRegionsLines = regions.map(r => {
            const comment = commentMap[r.key] || '';
            return `${indentStr}${r.key}: ${r.enabled}${comment ? ' ' + comment.trim() : ''}`;
        });

        lines.splice(regionsStart, regionsEnd - regionsStart, ...newRegionsLines);
    }

    editor.value = lines.join('\n');
    currentYaml = lines.join('\n');
    updateBackdrop('yaml-editor', 'yaml-backdrop');
    debounceSaveConfig();

    renderDisplayRegionsList();
}

// 解析当前配置中的 RSS 源列表
function parseRssFeedsFromYaml() {
    try {
        const doc = jsyaml.load(currentYaml);
        if (doc && doc.rss && doc.rss.feeds) {
            return doc.rss.feeds;
        }
    } catch (e) {}
    return [];
}

// 渲染 RSS 源列表
function renderRssFeedsList() {
    const container = document.getElementById('rss-feeds-list');
    if (!container) return;

    const feeds = parseRssFeedsFromYaml();

    if (feeds.length === 0) {
        container.innerHTML = `<div class="text-xs text-gray-400 italic">${t('freq.noRssFeeds')}</div>`;
        return;
    }

    container.innerHTML = feeds.map((f, idx) => `
        <div class="rss-feed-item bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:border-blue-300 transition-colors" data-index="${idx}">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <i class="fa-solid fa-rss text-orange-400"></i>
                    <span class="text-xs font-medium text-gray-700 truncate">${f.name}</span>
                    <span class="text-[10px] text-gray-400">(${f.id})</span>
                    ${f.enabled === false ? '<span class="text-[9px] bg-gray-200 text-gray-500 px-1 rounded">' + t('rssModal.disabled') + '</span>' : ''}
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="editRssFeed(${idx})" class="text-blue-400 hover:text-blue-600 text-xs px-1" title="${t('common.edit')}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="toggleRssFeed(${idx})" class="text-gray-400 hover:text-gray-600 text-xs px-1" title="${f.enabled === false ? t('common.enable') : t('common.disable')}">
                        <i class="fa-solid fa-${f.enabled === false ? 'eye' : 'eye-slash'}"></i>
                    </button>
                    <button onclick="removeRssFeed(${idx})" class="text-red-400 hover:text-red-600 text-xs px-1" title="${t('common.delete')}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="text-[10px] text-gray-400 mt-1 truncate" title="${f.url}">${f.url}</div>
        </div>
    `).join('');
}

// 删除 RSS 源
window.removeRssFeed = function(index) {
    const feeds = parseRssFeedsFromYaml();
    if (index < 0 || index >= feeds.length) return;

    const feedName = feeds[index].name;
    if (!confirm(t('confirm.deleteRss', feedName))) return;

    feeds.splice(index, 1);
    updateRssFeedsInYaml(feeds);
}

// 切换 RSS 源启用状态
window.toggleRssFeed = function(index) {
    const feeds = parseRssFeedsFromYaml();
    if (index < 0 || index >= feeds.length) return;

    feeds[index].enabled = feeds[index].enabled === false ? true : false;
    updateRssFeedsInYaml(feeds);
}

// 编辑 RSS 源
window.editRssFeed = function(index) {
    const feeds = parseRssFeedsFromYaml();
    if (index < 0 || index >= feeds.length) return;

    const feed = feeds[index];

    openRssModalWithData(feed, index);
}

// 更新 YAML 中的 RSS 配置（保留注释）
function updateRssFeedsInYaml(feeds) {
    const editor = document.getElementById('yaml-editor');
    let yaml = editor.value;
    const lines = yaml.split('\n');

    // 找到 rss.feeds 的位置
    let feedsStart = -1;
    let feedsEnd = -1;
    let inRss = false;
    let inFeeds = false;
    let lastDataLineIndex = -1; // 记录最后一个数据行的位置

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (line.match(/^rss:/)) {
            inRss = true;
            continue;
        }

        if (inRss && !inFeeds && trimmed.startsWith('feeds:')) {
            feedsStart = i + 1;
            inFeeds = true;
            continue;
        }

        if (inFeeds) {
            const indent = line.search(/\S/);

            // 如果是数据行（以 - 开头或是数据项的属性）
            if (trimmed.startsWith('-')) {
                lastDataLineIndex = i;
            } else if (trimmed && !trimmed.startsWith('#') && indent > 2) {
                // 数据项的属性行（如 name:, id:, url:）
                lastDataLineIndex = i;
            } else if (trimmed && !trimmed.startsWith('#') && indent <= 2 && indent >= 0) {
                // 遇到缩进更小的非注释行，说明离开了 feeds 区域
                feedsEnd = lastDataLineIndex + 1;
                break;
            }
        }

        // 检查是否进入下一个顶级模块
        if (inRss && line.match(/^[a-z_]+:/) && !line.match(/^rss:/)) {
            if (lastDataLineIndex >= 0) {
                feedsEnd = lastDataLineIndex + 1;
            } else {
                feedsEnd = i;
            }
            break;
        }
    }

    // 如果没有找到结束位置，使用最后一个数据行的下一行
    if (feedsEnd === -1) {
        feedsEnd = lastDataLineIndex >= 0 ? lastDataLineIndex + 1 : lines.length;
    }

    // 提取区域内的注释（保留在开头的注释）
    const regionLines = lines.slice(feedsStart, feedsEnd);
    const leadingComments = [];
    for (const line of regionLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            leadingComments.push(line);
        } else if (trimmed.startsWith('-') || (trimmed && !trimmed.startsWith('#'))) {
            // 遇到第一个数据项，停止收集注释
            break;
        } else if (trimmed === '') {
            // 空行也保留
            leadingComments.push(line);
        }
    }

    // 构建新的 feeds 内容
    const indent = '    '; // 4 空格缩进
    const newFeedsLines = feeds.map(f => {
        let feedYaml = `${indent}- id: "${f.id}"\n${indent}  name: "${f.name}"\n${indent}  url: "${f.url}"`;
        if (f.enabled === false) {
            feedYaml += `\n${indent}  enabled: false`;
        }
        if (f.max_age_days !== undefined && f.max_age_days !== '') {
            feedYaml += `\n${indent}  max_age_days: ${f.max_age_days}`;
        }
        return feedYaml;
    }).join('\n\n');

    const beforeFeeds = lines.slice(0, feedsStart);
    const afterFeeds = lines.slice(feedsEnd);

    // 组合：前面内容 + 开头注释 + 新数据 + 空行 + 后面内容
    const newYaml = [
        ...beforeFeeds,
        ...(leadingComments.length > 0 ? leadingComments : []),
        newFeedsLines,
        '',
        ...afterFeeds
    ].join('\n');

    editor.value = newYaml;
    currentYaml = newYaml;
    updateBackdrop('yaml-editor', 'yaml-backdrop');
    debounceSaveConfig();
    renderRssFeedsList();
    renderStandaloneLists(); // 同步更新独立展示区的 RSS 选择列表
}

// 打开 RSS 添加/编辑弹窗
window.openRssModal = function() {
    openRssModalWithData(null, -1);
}

function openRssModalWithData(feed, editIndex) {
    const modal = document.getElementById('rss-modal');

    document.getElementById('rss-id').value = feed ? feed.id : '';
    document.getElementById('rss-name').value = feed ? feed.name : '';
    document.getElementById('rss-url').value = feed ? feed.url : '';
    document.getElementById('rss-max-age').value = feed && feed.max_age_days !== undefined ? feed.max_age_days : '';

    modal.dataset.editIndex = editIndex;

    const title = modal.querySelector('h3');
    if (title) {
        title.innerHTML = editIndex >= 0 ?
            '<i class="fa-solid fa-rss mr-2 text-orange-500"></i>' + t('rssModal.editTitle') :
            '<i class="fa-solid fa-rss mr-2 text-orange-500"></i>' + t('rssModal.addTitle');
    }

    modal.classList.remove('hidden');
}

// 关闭 RSS 弹窗
window.closeRssModal = function() {
    const modal = document.getElementById('rss-modal');
    modal.classList.add('hidden');
    modal.dataset.editIndex = '-1';

    document.getElementById('rss-id').value = '';
    document.getElementById('rss-name').value = '';
    document.getElementById('rss-url').value = '';
    document.getElementById('rss-max-age').value = '';
}

// 确认添加/编辑 RSS
window.confirmAddRss = function() {
    const modal = document.getElementById('rss-modal');
    const editIndex = parseInt(modal.dataset.editIndex || '-1');

    const id = document.getElementById('rss-id').value.trim();
    const name = document.getElementById('rss-name').value.trim();
    const url = document.getElementById('rss-url').value.trim();
    const maxAge = document.getElementById('rss-max-age').value.trim();

    if (!id || !name || !url) {
        alert(t('alert.fillRequired'));
        return;
    }

    const feeds = parseRssFeedsFromYaml();

    const newFeed = { id, name, url };
    if (maxAge) {
        newFeed.max_age_days = parseInt(maxAge);
    }

    if (editIndex >= 0) {
        feeds[editIndex] = newFeed;
    } else {
        feeds.push(newFeed);
    }

    updateRssFeedsInYaml(feeds);
    closeRssModal();
}

// ==========================================
// 14. 独立展示区 (Standalone) 管理功能
// ==========================================

function parseStandaloneConfigFromYaml() {
    try {
        const doc = jsyaml.load(currentYaml);
        if (doc && doc.display && doc.display.standalone) {
            return {
                platforms: doc.display.standalone.platforms || [],
                rss_feeds: doc.display.standalone.rss_feeds || []
            };
        }
    } catch (e) {}
    return { platforms: [], rss_feeds: [] };
}

function renderStandaloneLists() {
    const platformsContainer = document.getElementById('standalone-platforms-list');
    const rssContainer = document.getElementById('standalone-rss-list');

    if (!platformsContainer || !rssContainer) return;

    const standaloneConfig = parseStandaloneConfigFromYaml();
    const availablePlatforms = parsePlatformsFromYaml();
    const availableRss = parseRssFeedsFromYaml();

    // Render Platforms
    if (availablePlatforms.length === 0) {
        platformsContainer.innerHTML = `<div class="col-span-2 text-xs text-gray-400 italic">${t('freq.noAvailPlatforms')}</div>`;
    } else {
        platformsContainer.innerHTML = availablePlatforms.map(p => {
            const isChecked = standaloneConfig.platforms.includes(p.id);
            return `
                <label class="flex items-center gap-2 p-1.5 rounded hover:bg-white transition-colors cursor-pointer">
                    <input type="checkbox" onchange="toggleStandaloneItem('platforms', '${p.id}')"
                           ${isChecked ? 'checked' : ''} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <div class="min-w-0">
                        <div class="text-xs font-medium text-gray-700 truncate">${p.name}</div>
                        <div class="text-[9px] text-gray-400 truncate">${p.id}</div>
                    </div>
                </label>
            `;
        }).join('');
    }

    // Render RSS
    if (availableRss.length === 0) {
        rssContainer.innerHTML = `<div class="text-xs text-gray-400 italic">${t('freq.noAvailRss')}</div>`;
    } else {
        rssContainer.innerHTML = availableRss.map(f => {
            const isChecked = standaloneConfig.rss_feeds.includes(f.id);
            return `
                <label class="flex items-center gap-2 p-1.5 rounded hover:bg-white transition-colors cursor-pointer">
                    <input type="checkbox" onchange="toggleStandaloneItem('rss_feeds', '${f.id}')"
                           ${isChecked ? 'checked' : ''} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-medium text-gray-700 truncate">${f.name}</span>
                            <span class="text-[9px] text-gray-400 ml-2">${f.id}</span>
                        </div>
                        <div class="text-[9px] text-gray-400 truncate">${f.url}</div>
                    </div>
                </label>
            `;
        }).join('');
    }
}

window.toggleStandaloneItem = function(type, id) {
    const config = parseStandaloneConfigFromYaml();
    const list = config[type];

    const index = list.indexOf(id);
    if (index === -1) {
        list.push(id);
    } else {
        list.splice(index, 1);
    }

    updateStandaloneConfigInYaml(type, list);
}

function updateStandaloneConfigInYaml(type, list) {
    const editor = document.getElementById('yaml-editor');
    let yaml = editor.value;
    const lines = yaml.split('\n');

    // 找到 display -> standalone -> [type]
    let inDisplay = false;
    let inStandalone = false;
    let targetLineIndex = -1;
    let indent = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^display:/)) {
            inDisplay = true;
            continue;
        }
        if (inDisplay && line.trim().startsWith('standalone:')) {
            inStandalone = true;
            continue;
        }
        if (inStandalone) {
            // 检查是否离开 standalone (遇到缩进更少或相同的非注释行)
            const currentIndent = line.search(/\S/);
            // standalone 下一级的缩进
            if (line.match(new RegExp(`^\\s*${type}:`))) {
                targetLineIndex = i;
                indent = line.substring(0, line.indexOf(type));
                break;
            }
            // 如果遇到下一个模块，停止
            if (line.match(/^[a-z_]+:/) && !line.match(/^display:/)) break;
        }
    }

    if (targetLineIndex !== -1) {
        // 构建新的数组字符串 ["item1", "item2"]
        const jsonStr = JSON.stringify(list);
        // 保留原有注释
        const originalLine = lines[targetLineIndex];
        const commentMatch = originalLine.match(/#.*$/);
        const comment = commentMatch ? commentMatch[0] : '';

        lines[targetLineIndex] = `${indent}${type}: ${jsonStr}${comment ? ' ' + comment : ''}`;

        const newYaml = lines.join('\n');
        editor.value = newYaml;
        currentYaml = newYaml;
        updateBackdrop('yaml-editor', 'yaml-backdrop');
        debounceSaveConfig();

        // 不需要重新渲染整个列表，因为是 checkbox 点击触发的
        // 但如果需要保持一致性，可以重新渲染
    }
}


// 从文本中提取版本号
function extractVersion(text) {
    // 匹配 Version: v5.3.0 或 Version: 5.3.0 格式
    const versionMatch = text.match(/Version:\s*v?(\d+\.\d+\.\d+)/i);
    if (versionMatch) {
        return versionMatch[1]; // 返回不带 v 的版本号
    }
    return null;
}

// 比较版本号 (返回 1: v1 > v2, -1: v1 < v2, 0: v1 == v2)
function compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;

    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    return 0;
}

// 版本检测主函数
window.checkVersion = async function() {
    const btn = document.getElementById('version-check-btn');
    const originalHTML = btn.innerHTML;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>' + t('version.checking') + '</span>';
    btn.disabled = true;

    try {
        const versionRes = await fetchWithFallback(REMOTE_VERSION_URL);
        if (!versionRes.ok) {
            throw new Error(t('version.fetchFailed', String(versionRes.status)));
        }

        const versionConfigText = await versionRes.text();
        const versionMap = {};
        versionConfigText.split('\n').forEach(line => {
            const parts = line.trim().split('=');
            if (parts.length >= 2) {
                versionMap[parts[0].trim()] = parts[1].trim();
            }
        });

        const currentTab = getCurrentTab();
        let currentVersion = null;
        let fileName = '';

        if (currentTab === 'config') {
            currentVersion = extractVersion(currentYaml);
            fileName = 'config.yaml';
        } else {
            currentVersion = extractVersion(currentFrequency);
            fileName = 'frequency_words.txt';
        }

        const latestVersion = versionMap[fileName];

        if (!latestVersion) {
             throw new Error(t('version.notFoundRemote', fileName));
        }

        showVersionComparisonModal(fileName, currentVersion, latestVersion);

    } catch (err) {
        console.error('版本检测失败:', err);
        showToast(t('toast.versionCheckFailed') + err.message, 'error');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// 获取当前 Tab
function getCurrentTab() {
    return currentTab; 
}

// 显示版本对比弹窗
function showVersionComparisonModal(fileName, currentVersion, latestVersion) {
    const existingModal = document.getElementById('version-comparison-modal');
    if (existingModal) existingModal.remove();

    const comparison = compareVersions(currentVersion, latestVersion);
    let statusIcon = '';
    let statusText = '';
    let statusColor = '';
    let actionButtons = '';

    if (!currentVersion) {
        statusIcon = '<i class="fa-solid fa-question-circle text-gray-500 text-3xl"></i>';
        statusText = t('version.noVersion');
        statusColor = 'text-gray-600';
        actionButtons = `
            <button onclick="closeVersionModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">${t('version.close')}</button>
            <button onclick="updateToLatest()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fa-solid fa-download mr-1"></i>${t('version.updateToLatest')}
            </button>
        `;
    } else if (comparison < 0) {
        statusIcon = '<i class="fa-solid fa-arrow-up text-orange-500 text-3xl"></i>';
        statusText = t('version.newVersion');
        statusColor = 'text-orange-600';
        actionButtons = `
            <button onclick="closeVersionModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">${t('version.updateLater')}</button>
            <button onclick="updateToLatest()" class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                <i class="fa-solid fa-download mr-1"></i>${t('version.updateNow')}
            </button>
        `;
    } else if (comparison > 0) {
        statusIcon = '<i class="fa-solid fa-flask text-purple-500 text-3xl"></i>';
        statusText = t('version.devVersion');
        statusColor = 'text-purple-600';
        actionButtons = `
            <button onclick="closeVersionModal()" class="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg">${t('version.close')}</button>
        `;
    } else {
        statusIcon = '<i class="fa-solid fa-check-circle text-green-500 text-3xl"></i>';
        statusText = t('version.upToDate');
        statusColor = 'text-green-600';
        actionButtons = `
            <button onclick="closeVersionModal()" class="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg">${t('version.close')}</button>
        `;
    }

    const modal = document.createElement('div');
    modal.id = 'version-comparison-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px;">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800">
                    <i class="fa-solid fa-code-compare mr-2 text-blue-500"></i>${t('version.title')}
                </h3>
                <button onclick="closeVersionModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fa-solid fa-times text-xl"></i>
                </button>
            </div>

            <div class="text-center py-6">
                ${statusIcon}
                <div class="text-xl font-bold ${statusColor} mt-3">${statusText}</div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
                <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">${t('version.configFile')}</span>
                    <span class="font-mono font-bold text-gray-800">${fileName}</span>
                </div>
                <div class="border-t border-gray-200"></div>
                <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">${t('version.currentVersion')}</span>
                    <span class="font-mono font-bold ${currentVersion ? 'text-blue-600' : 'text-gray-400'}">
                        ${currentVersion ? 'v' + currentVersion : t('version.unknown')}
                    </span>
                </div>
                <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">${t('version.latestVersion')}</span>
                    <span class="font-mono font-bold text-green-600">v${latestVersion}</span>
                </div>
            </div>

            ${comparison < 0 || !currentVersion ? `
                <div class="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                    <i class="fa-solid fa-lightbulb mr-1 text-yellow-600"></i>
                    <strong>${t('common.hint')}</strong>${t('version.updateHint', fileName)}
                </div>
            ` : ''}

            <div class="flex justify-end gap-2">
                ${actionButtons}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

window.closeVersionModal = function() {
    const modal = document.getElementById('version-comparison-modal');
    if (modal) modal.remove();
}

// ==========================================
// 13. 平台添加弹窗逻辑
// ==========================================

// 预定义可用平台列表 (仅包含官方默认支持的平台)
const PRESET_PLATFORMS = [
    { key: 'toutiao', nameKey: 'plat.toutiao' },
    { key: 'baidu', nameKey: 'plat.baidu' },
    { key: 'wallstreetcn-hot', nameKey: 'plat.wallstreetcn-hot' },
    { key: 'thepaper', nameKey: 'plat.thepaper' },
    { key: 'bilibili-hot-search', nameKey: 'plat.bilibili-hot-search' },
    { key: 'cls-hot', nameKey: 'plat.cls-hot' },
    { key: 'ifeng', nameKey: 'plat.ifeng' },
    { key: 'tieba', nameKey: 'plat.tieba' },
    { key: 'weibo', nameKey: 'plat.weibo' },
    { key: 'douyin', nameKey: 'plat.douyin' },
    { key: 'zhihu', nameKey: 'plat.zhihu' }
];

/**
 * 打开平台添加弹窗
 */
window.openPlatformModal = function() {
    const modal = document.getElementById('platform-modal');
    if (modal) {
        modal.classList.remove('hidden');
        if (typeof switchPlatformTab === 'function') {
            switchPlatformTab('select');
        }
        renderAvailablePlatforms();
    }
}

/**
 * 关闭平台添加弹窗
 */
window.closePlatformModal = function() {
    const modal = document.getElementById('platform-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * 切换平台添加标签页
 */
window.switchPlatformTab = function(tab) {
    currentPlatformTab = tab;

    // 更新 Tab 样式
    const tabSelect = document.getElementById('tab-platform-select');
    const tabCustom = document.getElementById('tab-platform-custom');

    if (tab === 'select') {
        if (tabSelect) {
            tabSelect.classList.add('text-blue-600', 'border-blue-600');
            tabSelect.classList.remove('text-gray-500', 'border-transparent');
        }
        if (tabCustom) {
            tabCustom.classList.remove('text-blue-600', 'border-blue-600');
            tabCustom.classList.add('text-gray-500', 'border-transparent');
        }

        const selectPanel = document.getElementById('platform-select-panel');
        const customPanel = document.getElementById('platform-custom-panel');
        if (selectPanel) selectPanel.classList.remove('hidden');
        if (customPanel) customPanel.classList.add('hidden');
    } else {
        if (tabCustom) {
            tabCustom.classList.add('text-blue-600', 'border-blue-600');
            tabCustom.classList.remove('text-gray-500', 'border-transparent');
        }
        if (tabSelect) {
            tabSelect.classList.remove('text-blue-600', 'border-blue-600');
            tabSelect.classList.add('text-gray-500', 'border-transparent');
        }

        const selectPanel = document.getElementById('platform-select-panel');
        const customPanel = document.getElementById('platform-custom-panel');
        if (selectPanel) selectPanel.classList.add('hidden');
        if (customPanel) customPanel.classList.remove('hidden');
    }
}

/**
 * 渲染可用平台列表（排除已添加的）
 */
function renderAvailablePlatforms() {
    const container = document.getElementById('available-platforms-list');
    const tip = document.getElementById('no-platforms-tip');
    if (!container) return;
    container.innerHTML = '';

    const currentPlatforms = parsePlatformsFromYaml();
    const existingKeys = currentPlatforms.map(p => p.id); 

    const available = PRESET_PLATFORMS.filter(p => !existingKeys.includes(p.key));

    if (available.length === 0) {
        if (tip) {
            tip.classList.remove('hidden');
            tip.innerHTML = `<i class="fa-solid fa-check-circle text-green-500 mr-2"></i>${t('platModal.allAdded')}`;
        }
    } else {
        if (tip) tip.classList.add('hidden');

        available.forEach(p => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-blue-50 cursor-pointer transition-colors group';
            div.onclick = () => confirmAddPlatform(p.key, t(p.nameKey));
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:text-blue-600">
                        <i class="fa-solid fa-cube"></i>
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">${t(p.nameKey)}</div>
                        <div class="text-xs text-gray-400 font-mono">${p.key}</div>
                    </div>
                </div>
                <button class="text-gray-300 group-hover:text-blue-600">
                    <i class="fa-solid fa-plus-circle text-lg"></i>
                </button>
            `;
            container.appendChild(div);
        });
    }
}

/**
 * 确认添加平台
 */
window.confirmAddPlatform = function(key, name) {
    let platformKey = key;
    let platformName = name;

    // 如果是手动输入模式 (且未传入 key)
    if (currentPlatformTab === 'custom' && !key) {
        const keyInput = document.getElementById('custom-platform-key');
        const nameInput = document.getElementById('custom-platform-name');

        if (keyInput) platformKey = keyInput.value.trim();
        if (nameInput) platformName = nameInput.value.trim();

        if (!platformKey) {
            alert(t('alert.enterPlatformKey'));
            return;
        }
        if (!platformName) {
            platformName = platformKey;
        }
    } else if (currentPlatformTab === 'select' && !key) {
        alert(t('alert.clickToAdd'));
        return;
    }

    // 检查是否已存在
    const currentPlatforms = parsePlatformsFromYaml();
    if (currentPlatforms.find(p => p.id === platformKey)) {
        alert(t('toast.platformExists', platformKey));
        return;
    }

    // 添加到 YAML (注意字段是 id 和 name)
    const newPlatform = {
        id: platformKey,
        name: platformName,
        enabled: true
    };

    // 重新构建 YAML
    currentPlatforms.push(newPlatform);
    updatePlatformsInYaml(currentPlatforms);

    closePlatformModal();

    const keyInput = document.getElementById('custom-platform-key');
    const nameInput = document.getElementById('custom-platform-name');
    if (keyInput) keyInput.value = '';
    if (nameInput) nameInput.value = '';

    renderPlatformsList();

    showToast(t('toast.platformAdded', platformName), 'success');
}

// 绑定到全局
window.updateToLatest = async function() {
    closeVersionModal();

    const currentTab = getCurrentTab();
    const type = currentTab === 'config'
        ? 'config'
        : currentTab === 'search'
        ? 'search'
        : currentTab === 'timeline'
        ? 'timeline'
        : 'frequency';
    const fileName = remoteConfigName(type);

    if (!confirm(t('confirm.updateFile', fileName))) {
        return;
    }

    showToast(t('toast.loadingLatest'), 'info');

    try {
        const res = await fetchWithFallback(remoteConfigUrl(type));

        if (!res.ok) {
            throw new Error(t('toast.loadFailed') + res.status);
        }

        const text = await res.text();

        if (currentTab === 'config') {
            try {
                jsyaml.load(text);
            } catch (yamlErr) {
                showToast(t('toast.yamlError') + yamlErr.message, 'error');
                return;
            }
            document.getElementById('yaml-editor').value = text;
            currentYaml = text;
            updateBackdrop('yaml-editor', 'yaml-backdrop');
            syncYamlToUI();
        } else if (currentTab === 'search') {
            document.getElementById('search-editor').value = text;
            currentSearch = text;
            currentSearchData = null;
            updateBackdrop('search-editor', 'search-backdrop');
            syncSearchToUI();
        } else {
            document.getElementById('frequency-editor').value = text;
            currentFrequency = text;
            currentFrequencyData = null;
            updateBackdrop('frequency-editor', 'frequency-backdrop');
            syncFrequencyToUI();
        }

        saveToLocalStorage();

        showToast(t('toast.updatedToLatest'), 'success');

    } catch (err) {
        console.error('更新失败:', err);
        showToast(t('toast.updateFailed') + err.message, 'error');
    }
}

// ==========================================
// RSS 辅助功能
// ==========================================

function toggleRssTips() {
    const panel = document.getElementById('rss-tips-panel');
    const icon = document.getElementById('rss-tips-icon');
    if (panel) {
        panel.classList.toggle('hidden');
        if (icon) {
            icon.style.transform = panel.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
}

function fillRssUrl(url) {
    const input = document.getElementById('rss-url');
    if (input) {
        input.value = url;
        // 视觉反馈
        input.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
        setTimeout(() => {
            input.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
        }, 500);
    }
}

// ==========================================
// 13. Timeline 编辑器功能
// ==========================================

const PRESET_META = {
    morning_evening: { icon: 'fa-sun', color: 'text-amber-500', bg: 'bg-amber-50', recommend: true },
    always_on:       { icon: 'fa-bolt', color: 'text-blue-500', bg: 'bg-blue-50' },
    office_hours:    { icon: 'fa-briefcase', color: 'text-green-500', bg: 'bg-green-50' },
    night_owl:       { icon: 'fa-moon', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    custom:          { icon: 'fa-sliders', color: 'text-purple-500', bg: 'bg-purple-50' }
};

function getDayNames() { return [t('day.1'), t('day.2'), t('day.3'), t('day.4'), t('day.5'), t('day.6'), t('day.7')]; }

/**
 * 从当前 config.yaml 中读取 schedule.preset
 */
function getActivePreset() {
    try {
        const doc = jsyaml.load(currentYaml);
        return doc?.schedule?.preset || 'morning_evening';
    } catch { return 'morning_evening'; }
}

/**
 * 解析 timeline YAML，返回结构化数据
 */
function parseTimelineData() {
    try {
        const doc = jsyaml.load(currentTimeline);
        if (!doc) return null;
        return doc;
    } catch { return null; }
}

/**
 * 获取指定预设/custom 的完整配置
 */
function getPresetConfig(data, presetName) {
    if (!data) return null;
    if (presetName === 'custom') return data.custom || null;
    return data.presets?.[presetName] || null;
}

/**
 * 主渲染函数：解析 timeline YAML → 渲染右侧面板
 */
function syncTimelineToUI() {
    const panel = document.getElementById('timeline-panel');
    if (!panel) return;

    const data = parseTimelineData();
    const activePreset = getActivePreset();

    if (!data) {
        panel.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <i class="fa-solid fa-calendar-xmark text-4xl mb-3"></i>
                <p class="text-sm">${t('tl.pasteTimeline')}</p>
                <p class="text-xs mt-1">${t('tl.orLoadConfig')}</p>
            </div>`;
        return;
    }

    let html = '';

    // ── Layer 1: 预设模式选择卡片 ──
    html += `<div class="mb-6">
        <div class="tl-section-title"><i class="fa-solid fa-swatchbook"></i>${t('tl.scheduleMode')}</div>
        <div class="grid grid-cols-2 gap-3" id="tl-preset-grid">`;

    // 收集所有预设名
    const presetNames = Object.keys(data.presets || {});
    // 确保 custom 在最后
    const allModes = [...presetNames.filter(n => n !== 'custom'), ...(data.custom ? ['custom'] : [])];

    allModes.forEach(name => {
        const meta = PRESET_META[name] || { icon: 'fa-puzzle-piece', color: 'text-gray-500', bg: 'bg-gray-50' };
        const presetCfg = getPresetConfig(data, name);
        const label = presetCfg?.name || meta.label || name;
        const desc = presetCfg?.description || meta.desc || '';
        const isActive = name === activePreset;
        const isProtected = ['morning_evening', 'always_on', 'office_hours', 'night_owl', 'custom'].includes(name);
        html += `
            <div class="tl-preset-card ${isActive ? 'selected' : ''}" data-preset="${name}">
                ${meta.recommend ? '<div class="tl-recommend-badge">' + t('tl.recommend') + '</div>' : ''}
                <div class="flex items-center gap-3 cursor-pointer" onclick="selectTimelinePreset('${name}')">
                    <div class="tl-card-icon ${meta.bg} ${meta.color}"><i class="fa-solid ${meta.icon}"></i></div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold text-gray-800 truncate tl-editable" ondblclick="event.stopPropagation();tlInlineEdit(this,'${name}','name','${escapeAttr(label)}')">${label}</div>
                        <div class="text-[10px] text-gray-500 truncate tl-editable" ondblclick="event.stopPropagation();tlInlineEdit(this,'${name}','description','${escapeAttr(desc)}')">${desc}</div>
                    </div>
                </div>
                <div class="tl-card-actions">
                    <button onclick="event.stopPropagation();duplicateTlPreset('${name}')" class="tl-card-action-btn" title="${t('common.copy')}"><i class="fa-regular fa-copy"></i></button>
                    ${!isProtected ? `<button onclick="event.stopPropagation();deleteTlPreset('${name}')" class="tl-card-action-btn text-red-400 hover:text-red-600" title="${t('common.delete')}"><i class="fa-regular fa-trash-can"></i></button>` : ''}
                </div>
                ${isActive ? '<div class="absolute bottom-1 right-2 text-[9px] text-blue-500 font-bold"><i class="fa-solid fa-check-circle mr-0.5"></i>' + t('tl.current') + '</div>' : ''}
            </div>`;
    });

    // 新建模式卡片
    html += `
        <div class="tl-preset-card tl-new-preset-card" onclick="openTlNewPresetModal()">
            <div class="flex items-center gap-3">
                <div class="tl-card-icon bg-gray-50 text-gray-400"><i class="fa-solid fa-plus"></i></div>
                <div>
                    <div class="text-sm font-bold text-gray-500">${t('tl.newMode')}</div>
                    <div class="text-[10px] text-gray-400">${t('tl.newModeDesc')}</div>
                </div>
            </div>
        </div>`;

    html += `</div></div>`;

    // 获取当前预设配置
    const config = getPresetConfig(data, activePreset);

    if (!config) {
        html += `<div class="text-center py-6 text-gray-400 text-sm">
            <i class="fa-solid fa-triangle-exclamation text-amber-400 mr-1"></i>
            ${t('tl.presetNotFound', activePreset)}
        </div>`;
        panel.innerHTML = html;
        return;
    }

    // ── Layer 2: 周视图时间线 ──
    html += renderWeekView(config, activePreset);

    // ── Layer 3: 时间段详情 ──
    html += renderPeriodDetails(config, activePreset);

    panel.innerHTML = html;

    // 初始化日计划 Tag 拖拽排序
    initDayPlanSortable(activePreset);
}

/**
 * 渲染周视图（7 天 × 24 小时水平条）
 */
function renderWeekView(config, presetName) {
    const periods = config.periods || {};
    const dayPlans = config.day_plans || {};
    const weekMap = config.week_map || {};

    // 时间刻度
    let html = `<div class="tl-week-view">
        <div class="tl-section-title mb-2"><i class="fa-solid fa-calendar-week"></i>${t('tl.weekView')}</div>
        <div class="tl-hour-markers">
            <div style="width:2.5rem;flex-shrink:0"></div>
            <div style="flex:1;display:flex;min-width:480px">`;

    for (let h = 0; h <= 24; h += 2) {
        html += `<div class="tl-hour-marker" style="width:${100/12}%;${h===24?'text-align:right;margin-left:-1em':''}">
            ${h < 10 ? '0' : ''}${h}
        </div>`;
    }
    html += `</div></div>`;

    // 获取当前星期几 (1=周一...7=周日)
    const today = new Date().getDay();
    const todayIso = today === 0 ? 7 : today;

    // 7 天的行
    for (let d = 1; d <= 7; d++) {
        const dayPlanName = weekMap[d] || weekMap[String(d)];
        const dayPlan = dayPlans[dayPlanName];
        const dayPeriodNames = dayPlan?.periods || [];
        const isToday = d === todayIso;

        html += `<div class="tl-week-row">
            <div class="tl-day-label ${isToday ? 'today' : ''}">${getDayNames()[d-1]}</div>
            <div class="tl-timeline-bar" data-day="${d}" onclick="onTlBarClick(event,'${presetName}',${d})">`;

        // 渲染各时间段色块
        dayPeriodNames.forEach(pName => {
            const p = periods[pName];
            if (!p) return;

            const merged = mergeWithDefault(p, config.default);
            const colorClass = getBlockColorClass(merged);
            const blocks = computeBlocks(p.start, p.end);

            blocks.forEach(b => {
                const left = (b.start / 24 * 100).toFixed(2);
                const width = ((b.end - b.start) / 24 * 100).toFixed(2);
                const label = p.name || pName;
                const searchState = merged.search === true ? 'true' : merged.search === false ? 'false' : '';
                html += `<div class="tl-period-block ${colorClass}" style="left:${left}%;width:${width}%"
                              onclick="scrollToPeriodCard('${pName}')"
                              onmouseenter="showTlTooltip(event, '${escapeAttr(label)}', '${p.start||''}', '${p.end||''}', ${!!merged.push}, ${!!merged.analyze}, '${merged.report_mode||''}', '${searchState}')"
                              onmouseleave="hideTlTooltip()">
                    <span class="tl-block-label">${label}</span>
                </div>`;
            });
        });

        // 当前时间指示线（仅今天）
        if (isToday) {
            const nowTime = new Date();
            const nowH = nowTime.getHours() + nowTime.getMinutes() / 60;
            const nowLeftPct = (nowH / 24 * 100).toFixed(2);
            html += `<div class="tl-now-line" style="left:${nowLeftPct}%" title="${String(nowTime.getHours()).padStart(2,'0')}:${String(nowTime.getMinutes()).padStart(2,'0')}"></div>`;
        }

        html += `</div></div>`;
    }

    // 图例
    html += `<div class="tl-legend">
        <div class="tl-legend-item"><div class="tl-legend-color tl-block-push"></div>${t('tl.legend.push')}</div>
        <div class="tl-legend-item"><div class="tl-legend-color tl-block-analyze"></div>${t('tl.legend.analyze')}</div>
        <div class="tl-legend-item"><div class="tl-legend-color tl-block-push-analyze"></div>${t('tl.legend.pushAnalyze')}</div>
        <div class="tl-legend-item"><div class="tl-legend-color tl-block-collect"></div>${t('tl.legend.collect')}</div>
        <div class="tl-legend-item"><div class="tl-legend-color" style="background:#f1f5f9;border:1px solid #e2e8f0"></div>${t('tl.legend.default')}</div>
    </div>`;

    html += `</div>`;
    return html;
}

/**
 * 合并 period 与 default（period 字段优先）
 */
function mergeWithDefault(period, defaultCfg) {
    if (!defaultCfg) return period || {};
    const merged = { ...defaultCfg, ...period };
    if (period.once || defaultCfg.once) {
        merged.once = { ...(defaultCfg.once || {}), ...(period.once || {}) };
    }
    return merged;
}

/**
 * 根据 push/analyze 状态确定色块 CSS 类
 */
function getBlockColorClass(merged) {
    const push = !!merged.push;
    const analyze = !!merged.analyze;
    if (push && analyze) return 'tl-block-push-analyze';
    if (push) return 'tl-block-push';
    if (analyze) return 'tl-block-analyze';
    if (merged.collect !== false) return 'tl-block-collect';
    return 'tl-block-silent';
}

/**
 * 计算时间段的渲染块（处理跨午夜情况）
 * 返回 [{start: 小时数, end: 小时数}, ...] 的数组
 */
function computeBlocks(startStr, endStr) {
    if (!startStr || !endStr) return [];
    const s = parseTime(startStr);
    const e = parseTime(endStr);
    if (s < e) return [{ start: s, end: e }];
    // 跨午夜
    return [{ start: s, end: 24 }, { start: 0, end: e }];
}

function parseTime(str) {
    const [h, m] = (str || '00:00').split(':').map(Number);
    return h + (m || 0) / 60;
}

function escapeAttr(s) {
    return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * Tooltip 显示/隐藏
 */
let tlTooltipEl = null;

function showTlTooltip(event, name, start, end, push, analyze, mode, searchState = '') {
    hideTlTooltip();
    const el = document.createElement('div');
    el.className = 'tl-tooltip';
    let features = [];
    if (push) features.push('<span style="color:#93c5fd">' + t('tl.legend.push') + '</span>');
    if (analyze) features.push('<span style="color:#c4b5fd">' + t('tl.legend.analyze') + '</span>');
    if (searchState === 'true') features.push('<span style="color:#6ee7b7">' + t('tl.legend.searchOn') + '</span>');
    if (searchState === 'false') features.push('<span style="color:#fca5a5">' + t('tl.legend.searchOff') + '</span>');
    if (!push && !analyze && searchState !== 'true') features.push('<span style="color:#94a3b8">' + t('tl.legend.collect') + '</span>');

    el.innerHTML = `<div style="font-weight:700;margin-bottom:2px">${name}</div>
        <div style="font-size:11px;color:#9ca3af">${start} - ${end}</div>
        <div style="margin-top:4px">${features.join(' / ')}</div>
        ${mode ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px">${t('tl.report')} ${mode}</div>` : ''}`;

    document.body.appendChild(el);
    tlTooltipEl = el;

    const rect = event.target.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2 - el.offsetWidth / 2) + 'px';
    el.style.top = (rect.top - el.offsetHeight - 8) + 'px';

    // 确保不超出屏幕
    const elRect = el.getBoundingClientRect();
    if (elRect.left < 4) el.style.left = '4px';
    if (elRect.right > window.innerWidth - 4) el.style.left = (window.innerWidth - el.offsetWidth - 4) + 'px';
    if (elRect.top < 4) {
        el.style.top = (rect.bottom + 8) + 'px';
        el.style.setProperty('--arrow', 'top');
    }
}

function hideTlTooltip() {
    if (tlTooltipEl) {
        tlTooltipEl.remove();
        tlTooltipEl = null;
    }
}

/**
 * 渲染时间段详情面板
 */
function renderPeriodDetails(config, presetName) {
    const isCustom = presetName === 'custom';
    const periods = config.periods || {};
    const dayPlans = config.day_plans || {};
    const weekMap = config.week_map || {};
    const defaults = config.default || {};

    let html = '';

    // ── Default 配置（默认展开）──
    html += `<div class="tl-collapsible mt-4">
        <div class="tl-collapsible-header" onclick="toggleTlCollapsible(this)">
            <span><i class="fa-solid fa-gear mr-2 text-gray-400"></i>${t('tl.defaultConfig')}</span>
            <i class="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
        </div>
        <div class="tl-collapsible-body">
            <div class="text-xs text-gray-500 mb-2">${t('tl.defaultDesc')}</div>
            ${renderBehaviorToggles(defaults, presetName, 'default', defaults)}
        </div>
    </div>`;

    // ── 时间段列表 ──
    const periodEntries = Object.entries(periods);
    html += `<div class="mt-6">
        <div class="tl-section-title flex items-center justify-between">
            <span><i class="fa-solid fa-puzzle-piece"></i>${t('tl.periods')}</span>
            <button onclick="openTlNewPeriodModal('${presetName}')" class="tl-add-btn"><i class="fa-solid fa-plus mr-1"></i>${t('tl.addNew')}</button>
        </div>`;

    if (periodEntries.length > 0) {
        html += `<div class="space-y-3">`;
        periodEntries.forEach(([key, p]) => {
            const merged = mergeWithDefault(p, defaults);
            const colorClass = getBlockColorClass(merged);
            html += `<div class="tl-period-card" id="tl-period-${key}">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded ${colorClass}"></div>
                        <span class="text-sm font-bold text-gray-800 tl-editable" ondblclick="tlInlineEditPeriod(this,'${presetName}','${key}','${escapeAttr(p.name || key)}')">${p.name || key}</span>
                        <span class="text-[10px] text-gray-400 font-mono">${key}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500 font-mono">${p.start || '?'} - ${p.end || '?'}</span>
                        <button onclick="duplicateTlPeriod('${presetName}','${key}')" class="tl-inline-btn" title="${t('common.copy')}"><i class="fa-regular fa-copy"></i></button>
                        <button onclick="deleteTlPeriod('${presetName}','${key}')" class="tl-inline-btn text-red-400 hover:text-red-600" title="${t('common.delete')}"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </div>
                ${renderBehaviorToggles(merged, presetName, key, p)}
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div class="text-xs text-gray-400 text-center py-4">
            <i class="fa-solid fa-info-circle mr-1"></i>${t('tl.noPeriods')}
        </div>`;
    }

    html += `</div>`;

    // ── 日计划 ──
    const dayPlanEntries = Object.entries(dayPlans);
    html += `<div class="mt-6">
        <div class="tl-section-title flex items-center justify-between">
            <span><i class="fa-solid fa-list-ol"></i>${t('tl.dayPlans')}</span>
            <button onclick="addTlDayPlan('${presetName}')" class="tl-add-btn"><i class="fa-solid fa-plus mr-1"></i>${t('tl.addNew')}</button>
        </div>`;

    if (dayPlanEntries.length > 0) {
        html += `<div class="space-y-2">`;
        dayPlanEntries.forEach(([name, plan]) => {
            const pList = plan.periods || [];
            // 构建可用 period 下拉（排除已添加的）
            const availablePeriods = periodEntries.filter(([k]) => !pList.includes(k));
            html += `<div class="bg-white border border-gray-200 rounded-lg px-3 py-2 tl-dayplan-card">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-bold text-gray-700">${name}</span>
                    <button onclick="deleteTlDayPlan('${presetName}','${name}')" class="tl-inline-btn text-red-400 hover:text-red-600" title="${t('common.delete')}"><i class="fa-regular fa-trash-can"></i></button>
                </div>
                <div class="flex flex-wrap gap-1 items-center tl-dayplan-sortable" data-plan-key="${name}">
                    ${pList.length > 0 ? pList.map(pn => {
                        const p = periods[pn];
                        const merged = p ? mergeWithDefault(p, defaults) : {};
                        const cc = getBlockColorClass(merged);
                        return `<span class="tl-period-tag ${cc}" data-period-key="${pn}">
                            ${p?.name || pn}
                            <button onclick="removePeriodFromDayPlanUI('${presetName}','${name}','${pn}')" class="tl-tag-remove" title="${t('common.delete')}">&times;</button>
                        </span>`;
                    }).join('') : '<span class="text-[10px] text-gray-400">' + t('tl.emptyDayPlan') + '</span>'}
                    ${availablePeriods.length > 0 ? `
                        <select class="tl-add-period-select" onchange="if(this.value){addPeriodToDayPlan('${presetName}','${name}',this.value);this.value=''}">
                            <option value="">${t('tl.addPeriod')}</option>
                            ${availablePeriods.map(([k, p]) => `<option value="${k}">${p.name || k}</option>`).join('')}
                        </select>
                    ` : ''}
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    html += `</div>`;

    // ── 周映射（下拉选择）──
    const dayPlanKeys = Object.keys(dayPlans);

    // 为不同日计划分配颜色
    const planColorMap = {};
    const planColors = ['bg-blue-50 border-blue-200', 'bg-green-50 border-green-200', 'bg-amber-50 border-amber-200', 'bg-purple-50 border-purple-200', 'bg-rose-50 border-rose-200', 'bg-cyan-50 border-cyan-200', 'bg-orange-50 border-orange-200'];
    dayPlanKeys.forEach((k, idx) => { planColorMap[k] = planColors[idx % planColors.length]; });

    html += `<div class="mt-6">
        <div class="tl-section-title"><i class="fa-solid fa-calendar-days"></i>${t('tl.weekMap')}</div>
        <div class="bg-white border border-gray-200 rounded-lg px-3 py-2 space-y-1">`;

    for (let d = 1; d <= 7; d++) {
        const plan = weekMap[d] || weekMap[String(d)] || '';
        const rowColor = planColorMap[plan] || '';
        const options = dayPlanKeys.map(k =>
            `<option value="${k}" ${k === plan ? 'selected' : ''}>${k}</option>`
        ).join('');
        html += `<div class="tl-dayplan-row ${rowColor} rounded px-2">
            <div class="tl-dayplan-label">${getDayNames()[d-1]}</div>
            <select class="tl-weekmap-select"
                    onchange="onTlWeekMap('${presetName}',${d},this.value)">
                ${options}
            </select>
        </div>`;
    }

    html += `</div>
        <div class="flex gap-2 mt-2">
            <button onclick="tlWeekMapQuick('${presetName}','all_same')" class="tl-quick-btn">${t('tl.allWeekSame')}</button>
            <button onclick="tlWeekMapQuick('${presetName}','weekday_same')" class="tl-quick-btn">${t('tl.weekdaySame')}</button>
            <button onclick="tlWeekMapQuick('${presetName}','weekday_weekend')" class="tl-quick-btn">${t('tl.weekdayWeekend')}</button>
        </div>
    </div>`;

    // custom 专属：时间段冲突策略
    if (isCustom) {
        const overlapPolicy = (config.overlap && config.overlap.policy) || 'error_on_overlap';
        html += `<div class="mt-6">
            <div class="tl-section-title"><i class="fa-solid fa-code-branch"></i>${t('tl.overlapPolicy')}</div>
            <div class="bg-white border border-gray-200 rounded-lg px-3 py-3">
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">policy:</span>
                    <select class="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                            onchange="onTlCustomOverlapPolicy(this.value)">
                        <option value="error_on_overlap" ${overlapPolicy === 'error_on_overlap' ? 'selected' : ''}>${t('tl.errorOnOverlap')}</option>
                        <option value="last_wins" ${overlapPolicy === 'last_wins' ? 'selected' : ''}>${t('tl.lastWins')}</option>
                    </select>
                </div>
                <div class="text-[10px] text-gray-400 mt-2">
                    <i class="fa-solid fa-info-circle mr-1"></i>
                    ${t('tl.overlapHint')}
                </div>
            </div>
        </div>`;
    }

    // 提示
    if (!isCustom) {
        html += `<div class="mt-4 text-xs text-gray-400 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <i class="fa-solid fa-lightbulb mr-1 text-amber-400"></i>
            ${t('tl.presetHint')}
        </div>`;
    } else {
        html += `<div class="mt-4 text-xs text-gray-400 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <i class="fa-solid fa-pen-ruler mr-1 text-purple-400"></i>
            ${t('tl.customHint')}
        </div>`;
    }

    return html;
}

/**
 * 渲染行为开关（可交互）
 * presetName: 当前预设名（用于定位 YAML 中的位置）
 * periodKey: 'default' 或时间段 key（如 'weekday_morning'）
 */
function renderBehaviorToggles(cfg, presetName, periodKey, rawCfg = null) {
    const toggleItems = [
        { k: 'collect', label: t('tl.collect'), icon: 'fa-download' },
        { k: 'analyze', label: t('tl.analyze'), icon: 'fa-brain' },
        { k: 'push', label: t('tl.push'), icon: 'fa-bell' },
    ];

    const uid = `tl-${presetName}-${periodKey}`;

    let html = '<div class="tl-toggle-row">';
    toggleItems.forEach(item => {
        const val = cfg[item.k];
        const on = val === true || val === 'true';
        const toggleId = `${uid}-${item.k}`;
        html += `<label class="tl-toggle-item ${on ? 'on' : 'off'}" for="${toggleId}" style="cursor:pointer">
            <div class="relative inline-block w-8 mr-1 align-middle select-none">
                <input type="checkbox" id="${toggleId}" ${on ? 'checked' : ''}
                    onchange="onTlToggle('${presetName}','${periodKey}','${item.k}',this.checked)"
                    class="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-200 ease-in-out" style="top:0"/>
                <label for="${toggleId}" class="toggle-label block overflow-hidden h-4 rounded-full bg-gray-300 cursor-pointer"></label>
            </div>
            <i class="fa-solid ${item.icon}" style="font-size:10px"></i>${item.label}
        </label>`;
    });
    html += '</div>';

    // 报告模式下拉
    const reportModes = ['current', 'daily', 'incremental'];
    const aiModes = ['follow_report', 'daily', 'current', 'incremental'];

    html += `<div class="flex flex-wrap gap-2 mt-2 items-center">`;

    // report_mode
    html += `<div class="flex items-center gap-1">
        <span class="text-[10px] text-gray-400">${t('tl.report')}</span>
        <select class="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white"
                onchange="onTlSelect('${presetName}','${periodKey}','report_mode',this.value)">
            ${reportModes.map(m => `<option value="${m}" ${cfg.report_mode === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
    </div>`;

    // ai_mode
    html += `<div class="flex items-center gap-1">
        <span class="text-[10px] text-gray-400">${t('tl.aiMode')}</span>
        <select class="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white"
                onchange="onTlSelect('${presetName}','${periodKey}','ai_mode',this.value)">
            ${aiModes.map(m => `<option value="${m}" ${(cfg.ai_mode || 'follow_report') === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
    </div>`;

    // once toggles
    const onceAnalyze = cfg.once?.analyze === true;
    const oncePush = cfg.once?.push === true;
    const onceSearch = cfg.once?.search === true;
    html += `<label class="flex items-center gap-1 text-[10px] ${onceAnalyze ? 'text-blue-600' : 'text-gray-400'}" style="cursor:pointer">
        <input type="checkbox" ${onceAnalyze ? 'checked' : ''}
               onchange="onTlToggle('${presetName}','${periodKey}','once.analyze',this.checked)"
               class="w-3 h-3 rounded">${t('tl.analyzeOnce')}
    </label>`;
    html += `<label class="flex items-center gap-1 text-[10px] ${oncePush ? 'text-blue-600' : 'text-gray-400'}" style="cursor:pointer">
        <input type="checkbox" ${oncePush ? 'checked' : ''}
               onchange="onTlToggle('${presetName}','${periodKey}','once.push',this.checked)"
               class="w-3 h-3 rounded">${t('tl.pushOnce')}
    </label>`;
    html += `<label class="flex items-center gap-1 text-[10px] ${onceSearch ? 'text-emerald-600' : 'text-gray-400'}" style="cursor:pointer">
        <input type="checkbox" ${onceSearch ? 'checked' : ''}
               onchange="onTlToggle('${presetName}','${periodKey}','once.search',this.checked)"
               class="w-3 h-3 rounded">${t('tl.searchOnce')}
    </label>`;

    html += `</div>`;

    // 时间段编辑（仅非 default）
    if (periodKey !== 'default' && (cfg.start || cfg.end)) {
        html += `<div class="flex items-center gap-2 mt-2">
            <span class="text-[10px] text-gray-400">${t('tl.time')}</span>
            <input type="time" value="${cfg.start || ''}" class="text-xs border border-gray-200 rounded px-1.5 py-0.5"
                   onchange="onTlSelect('${presetName}','${periodKey}','start',this.value)">
            <span class="text-gray-300">~</span>
            <input type="time" value="${cfg.end || ''}" class="text-xs border border-gray-200 rounded px-1.5 py-0.5"
                   onchange="onTlSelect('${presetName}','${periodKey}','end',this.value)">
        </div>`;
    }

    // 可选筛选与联网搜索覆盖（仅显示“当前层”字段，避免把继承值误当作显式配置）
    const baseCfg = rawCfg || {};
    const filterMethod = baseCfg.filter_method || '';
    const frequencyFile = baseCfg.frequency_file || '';
    const interestsFile = baseCfg.interests_file || '';
    const searchOverride = baseCfg.search === true ? 'true' : baseCfg.search === false ? 'false' : '';
    const searchFile = baseCfg.search_file || '';
    const methodHint = periodKey === 'default' ? t('tl.filterMethodHint.default') : t('tl.filterMethodHint.period');
    const searchDefaultLabel = periodKey === 'default' ? t('tl.searchFollowCollect') : t('tl.searchInherit');

    html += `<div class="mt-3 pt-3 border-t border-gray-100">
        <div class="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">${t('tl.filterOverride')}</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
                <label class="block text-[10px] text-gray-400 mb-1">filter_method</label>
                <select class="text-[10px] w-full border border-gray-200 rounded px-1.5 py-1 bg-white"
                        onchange="onTlOptionalSelect('${presetName}','${periodKey}','filter_method',this.value)">
                    <option value="" ${filterMethod === '' ? 'selected' : ''}>${t('tl.inherit')}</option>
                    <option value="keyword" ${filterMethod === 'keyword' ? 'selected' : ''}>keyword</option>
                    <option value="ai" ${filterMethod === 'ai' ? 'selected' : ''}>ai</option>
                </select>
            </div>
            <div>
                <label class="block text-[10px] text-gray-400 mb-1">frequency_file</label>
                <input type="text" value="${escapeAttr(frequencyFile)}" placeholder="e.g. tech.txt"
                       class="text-[10px] w-full border border-gray-200 rounded px-1.5 py-1 bg-white"
                       onchange="onTlOptionalInput('${presetName}','${periodKey}','frequency_file',this.value)">
            </div>
            <div>
                <label class="block text-[10px] text-gray-400 mb-1">interests_file</label>
                <input type="text" value="${escapeAttr(interestsFile)}" placeholder="e.g. geopolitics.txt"
                       class="text-[10px] w-full border border-gray-200 rounded px-1.5 py-1 bg-white"
                       onchange="onTlOptionalInput('${presetName}','${periodKey}','interests_file',this.value)">
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <div>
                <label class="block text-[10px] text-gray-400 mb-1"><i class="fa-solid fa-magnifying-glass mr-1 text-emerald-500"></i>${t('tl.searchSwitch')}</label>
                <select class="text-[10px] w-full border border-gray-200 rounded px-1.5 py-1 bg-white"
                        onchange="onTlOptionalBoolSelect('${presetName}','${periodKey}','search',this.value)">
                    <option value="" ${searchOverride === '' ? 'selected' : ''}>${searchDefaultLabel}</option>
                    <option value="true" ${searchOverride === 'true' ? 'selected' : ''}>${t('tl.searchOn')}</option>
                    <option value="false" ${searchOverride === 'false' ? 'selected' : ''}>${t('tl.searchOff')}</option>
                </select>
            </div>
            <div>
                <label class="block text-[10px] text-gray-400 mb-1">${t('tl.searchFile')}</label>
                <input type="text" value="${escapeAttr(searchFile)}" placeholder="${t('tl.searchFilePlaceholder')}"
                       class="text-[10px] w-full border border-gray-200 rounded px-1.5 py-1 bg-white"
                       onchange="onTlOptionalInput('${presetName}','${periodKey}','search_file',this.value)">
            </div>
        </div>
        <div class="text-[10px] text-gray-400 mt-2">
            <i class="fa-solid fa-lightbulb mr-1"></i>${methodHint}${t('tl.filterFileHint')}<br>
            <i class="fa-solid fa-magnifying-glass mr-1 text-emerald-500"></i>${t('tl.searchOverrideHint')}
        </div>
    </div>`;

    return html;
}

/**
 * 点击周视图色块 → 滚动到对应 period 卡片并高亮
 */
window.scrollToPeriodCard = function(periodKey) {
    const card = document.getElementById('tl-period-' + periodKey);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('tl-period-highlight');
    setTimeout(() => card.classList.remove('tl-period-highlight'), 1500);
}

/**
 * 折叠/展开切换
 */
window.toggleTlCollapsible = function(header) {
    const body = header.nextElementSibling;
    body.classList.toggle('collapsed');
    header.classList.toggle('is-collapsed');
}

/**
 * 右侧开关变更 → 更新左侧 timeline YAML
 */
window.onTlToggle = function(presetName, periodKey, field, value) {
    updateTimelineField(presetName, periodKey, field, value);
}

window.onTlSelect = function(presetName, periodKey, field, value) {
    updateTimelineField(presetName, periodKey, field, value);
}

window.onTlOptionalInput = function(presetName, periodKey, field, rawValue) {
    const value = (rawValue || '').trim();
    if (!value) {
        removeTimelineField(presetName, periodKey, field);
        return;
    }
    updateTimelineField(presetName, periodKey, field, value);
}

window.onTlOptionalSelect = function(presetName, periodKey, field, value) {
    if (!value) {
        removeTimelineField(presetName, periodKey, field);
        return;
    }
    updateTimelineField(presetName, periodKey, field, value);
}

window.onTlOptionalBoolSelect = function(presetName, periodKey, field, value) {
    if (!value) {
        removeTimelineField(presetName, periodKey, field);
        return;
    }
    updateTimelineField(presetName, periodKey, field, value === 'true');
}

window.onTlCustomOverlapPolicy = function(value) {
    updateTimelineSectionField('custom', 'overlap.policy', value);
}

/**
 * 周映射下拉变更 → 更新 timeline YAML 中的 week_map.N
 */
window.onTlWeekMap = function(presetName, dayNum, value) {
    const editor = document.getElementById('timeline-editor');
    let yaml = editor.value;
    const lines = yaml.split('\n');

    // 定位 preset section
    const isCustom = presetName === 'custom';
    let sectionStart = -1;
    let sectionIndent = 0;

    if (isCustom) {
        for (let i = 0; i < lines.length; i++) {
            if (/^custom:\s*/.test(lines[i])) { sectionStart = i; break; }
        }
    } else {
        let inPresets = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^presets:\s*/.test(line)) { inPresets = true; continue; }
            if (inPresets && /^\S/.test(line) && !line.startsWith('#')) break;
            if (inPresets) {
                const m = line.match(/^(\s+)(\S+):\s*/);
                if (m && m[2] === presetName) { sectionStart = i; sectionIndent = m[1].length; break; }
            }
        }
    }

    if (sectionStart < 0) return;

    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        if (line.search(/\S/) <= sectionIndent) { sectionEnd = i; break; }
    }

    // 找 week_map: 行
    const weekMapLine = findChildKey(lines, sectionStart, sectionEnd, sectionIndent, 'week_map');
    if (weekMapLine < 0) return;

    const wmIndent = lines[weekMapLine].search(/\S/);
    const wmEnd = findBlockEnd(lines, weekMapLine, wmIndent, sectionEnd);

    // 找 dayNum: 行
    const dayKey = String(dayNum);
    const dayLine = findChildKey(lines, weekMapLine, wmEnd, wmIndent, dayKey);

    if (dayLine >= 0) {
        replaceLineValue(lines, dayLine, value);
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();

    clearTimeout(window._tlRenderTimer);
    window._tlRenderTimer = setTimeout(() => syncTimelineToUI(), 300);
}

/**
 * 核心：修改 timeline YAML 中的指定字段，保留注释
 */
function updateTimelineField(presetName, periodKey, field, value) {
    const editor = document.getElementById('timeline-editor');
    let yaml = editor.value;
    const lines = yaml.split('\n');

    // 1. 定位预设/custom 的起始行
    const isCustom = presetName === 'custom';
    let sectionStart = -1;
    let sectionIndent = 0;

    if (isCustom) {
        // 找 custom: 顶层 key
        for (let i = 0; i < lines.length; i++) {
            if (/^custom:\s*/.test(lines[i])) {
                sectionStart = i;
                sectionIndent = 0;
                break;
            }
        }
    } else {
        // 找 presets: 下的 presetName:
        let inPresets = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^presets:\s*/.test(line)) {
                inPresets = true;
                continue;
            }
            if (inPresets && /^\S/.test(line) && !line.startsWith('#')) {
                break; // left presets block
            }
            if (inPresets) {
                const m = line.match(/^(\s+)(\S+):\s*/);
                if (m && m[2] === presetName) {
                    sectionStart = i;
                    sectionIndent = m[1].length;
                    break;
                }
            }
        }
    }

    if (sectionStart < 0) return;

    // 2. 找到 section 结束行
    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const indent = line.search(/\S/);
        if (indent <= sectionIndent) {
            sectionEnd = i;
            break;
        }
    }

    // 3. 在 section 内定位 periodKey 子区域
    let targetStart, targetEnd;
    const fieldParts = field.split('.');

    if (periodKey === 'default') {
        // 找 default: 行
        targetStart = findChildKey(lines, sectionStart, sectionEnd, sectionIndent, 'default');
    } else {
        // 找 periods: 下的 periodKey:
        const periodsLine = findChildKey(lines, sectionStart, sectionEnd, sectionIndent, 'periods');
        if (periodsLine < 0) return;
        const periodsIndent = lines[periodsLine].search(/\S/);
        const periodsEnd = findBlockEnd(lines, periodsLine, periodsIndent, sectionEnd);
        targetStart = findChildKey(lines, periodsLine, periodsEnd, periodsIndent, periodKey);
    }

    if (targetStart < 0) return;

    const targetIndent = lines[targetStart].search(/\S/);
    targetEnd = findBlockEnd(lines, targetStart, targetIndent, sectionEnd);

    // 4. 在 target 内查找 field（支持 once.analyze 嵌套）
    let lineIdx = -1;

    if (fieldParts.length === 1) {
        lineIdx = findChildKey(lines, targetStart, targetEnd, targetIndent, fieldParts[0]);
    } else {
        // nested: once.analyze → find once: then analyze:
        const parentLine = findChildKey(lines, targetStart, targetEnd, targetIndent, fieldParts[0]);
        if (parentLine >= 0) {
            const parentIndent = lines[parentLine].search(/\S/);
            const parentEnd = findBlockEnd(lines, parentLine, parentIndent, targetEnd);
            lineIdx = findChildKey(lines, parentLine, parentEnd, parentIndent, fieldParts[1]);
        }
    }

    if (lineIdx < 0) {
        // 字段不存在 → 需要插入
        insertTimelineField(lines, targetStart, targetEnd, targetIndent, field, value, fieldParts);
    } else {
        // 字段存在 → 原地替换值
        replaceLineValue(lines, lineIdx, value);
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();

    // 延迟重新渲染（避免输入中途刷新）
    clearTimeout(window._tlRenderTimer);
    window._tlRenderTimer = setTimeout(() => syncTimelineToUI(), 300);
}

function resolveTimelineSection(lines, presetName) {
    const isCustom = presetName === 'custom';
    let sectionStart = -1;
    let sectionIndent = 0;

    if (isCustom) {
        for (let i = 0; i < lines.length; i++) {
            if (/^custom:\s*/.test(lines[i])) {
                sectionStart = i;
                sectionIndent = 0;
                break;
            }
        }
    } else {
        let inPresets = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^presets:\s*/.test(line)) {
                inPresets = true;
                continue;
            }
            if (inPresets && /^\S/.test(line) && !line.startsWith('#')) {
                break;
            }
            if (inPresets) {
                const m = line.match(/^(\s+)(\S+):\s*/);
                if (m && m[2] === presetName) {
                    sectionStart = i;
                    sectionIndent = m[1].length;
                    break;
                }
            }
        }
    }

    if (sectionStart < 0) return null;

    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const indent = line.search(/\S/);
        if (indent <= sectionIndent) {
            sectionEnd = i;
            break;
        }
    }

    return { sectionStart, sectionEnd, sectionIndent };
}

function resolveTimelineTarget(lines, presetName, periodKey) {
    const section = resolveTimelineSection(lines, presetName);
    if (!section) return null;

    const { sectionStart, sectionEnd, sectionIndent } = section;
    let targetStart = -1;

    if (periodKey === 'default') {
        targetStart = findChildKey(lines, sectionStart, sectionEnd, sectionIndent, 'default');
    } else {
        const periodsLine = findChildKey(lines, sectionStart, sectionEnd, sectionIndent, 'periods');
        if (periodsLine < 0) return null;
        const periodsIndent = lines[periodsLine].search(/\S/);
        const periodsEnd = findBlockEnd(lines, periodsLine, periodsIndent, sectionEnd);
        targetStart = findChildKey(lines, periodsLine, periodsEnd, periodsIndent, periodKey);
    }

    if (targetStart < 0) return null;

    const targetIndent = lines[targetStart].search(/\S/);
    const targetEnd = findBlockEnd(lines, targetStart, targetIndent, sectionEnd);

    return { sectionStart, sectionEnd, sectionIndent, targetStart, targetEnd, targetIndent };
}

function applyTimelineEditorChanges(editor, lines) {
    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
    clearTimeout(window._tlRenderTimer);
    window._tlRenderTimer = setTimeout(() => syncTimelineToUI(), 300);
}

function removeTimelineField(presetName, periodKey, field) {
    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');
    const target = resolveTimelineTarget(lines, presetName, periodKey);
    if (!target) return;

    const { targetStart, targetEnd, targetIndent } = target;
    const fieldParts = field.split('.');

    if (fieldParts.length === 1) {
        const lineIdx = findChildKey(lines, targetStart, targetEnd, targetIndent, fieldParts[0]);
        if (lineIdx < 0) return;
        const lineIndent = lines[lineIdx].search(/\S/);
        const lineEnd = findBlockEnd(lines, lineIdx, lineIndent, targetEnd);
        lines.splice(lineIdx, lineEnd - lineIdx);
        applyTimelineEditorChanges(editor, lines);
        return;
    }

    const parentLine = findChildKey(lines, targetStart, targetEnd, targetIndent, fieldParts[0]);
    if (parentLine < 0) return;
    const parentIndent = lines[parentLine].search(/\S/);
    const parentEnd = findBlockEnd(lines, parentLine, parentIndent, targetEnd);
    const childLine = findChildKey(lines, parentLine, parentEnd, parentIndent, fieldParts[1]);
    if (childLine < 0) return;

    const childIndent = lines[childLine].search(/\S/);
    const childEnd = findBlockEnd(lines, childLine, childIndent, parentEnd);
    lines.splice(childLine, childEnd - childLine);

    const parentEndAfter = findBlockEnd(lines, parentLine, parentIndent, targetEnd);
    let hasChild = false;
    for (let i = parentLine + 1; i < parentEndAfter; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        if (line.search(/\S/) > parentIndent) {
            hasChild = true;
            break;
        }
    }
    if (!hasChild) {
        lines.splice(parentLine, 1);
    }

    applyTimelineEditorChanges(editor, lines);
}

function updateTimelineSectionField(presetName, field, value) {
    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');
    const section = resolveTimelineSection(lines, presetName);
    if (!section) return;

    const { sectionStart, sectionEnd, sectionIndent } = section;
    const fieldParts = field.split('.');
    let lineIdx = -1;

    if (fieldParts.length === 1) {
        lineIdx = findChildKey(lines, sectionStart, sectionEnd, sectionIndent, fieldParts[0]);
    } else {
        const parentLine = findChildKey(lines, sectionStart, sectionEnd, sectionIndent, fieldParts[0]);
        if (parentLine >= 0) {
            const parentIndent = lines[parentLine].search(/\S/);
            const parentEnd = findBlockEnd(lines, parentLine, parentIndent, sectionEnd);
            lineIdx = findChildKey(lines, parentLine, parentEnd, parentIndent, fieldParts[1]);
        }
    }

    if (lineIdx < 0) {
        insertTimelineField(lines, sectionStart, sectionEnd, sectionIndent, field, value, fieldParts);
    } else {
        replaceLineValue(lines, lineIdx, value);
    }

    applyTimelineEditorChanges(editor, lines);
}

/**
 * 查找子级 key 行
 */
function findChildKey(lines, start, end, parentIndent, key) {
    for (let i = start + 1; i < end; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const indent = line.search(/\S/);
        if (indent <= parentIndent) break;
        const m = line.match(/^\s*(\S+):\s*/);
        const rawKey = m ? m[1].replace(/^["']|["']$/g, '') : null;
        if (m && rawKey === key && indent === parentIndent + 2) {
            return i;
        }
    }
    return -1;
}

/**
 * 找一个 block 的结束行号（下一个同级或更低缩进的非空非注释行）
 */
function findBlockEnd(lines, start, indent, maxEnd) {
    for (let i = start + 1; i < maxEnd; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const curIndent = line.search(/\S/);
        if (curIndent <= indent) return i;
    }
    return maxEnd;
}

/**
 * 替换行中的值，保留注释
 */
function replaceLineValue(lines, idx, value) {
    const original = lines[idx];
    const match = original.match(/^(\s*\S+:\s*)(.*)$/);
    if (!match) return;

    const prefix = match[1];
    const rest = match[2];
    const commentMatch = rest.match(/(\s*#.*)$/);
    const comment = commentMatch ? commentMatch[1] : '';

    let formatted;
    if (typeof value === 'boolean') {
        formatted = value ? 'true' : 'false';
    } else if (typeof value === 'string') {
        // 检查原值是否带引号
        const valPart = rest.slice(0, rest.length - comment.length).trim();
        const isQuoted = (valPart.startsWith('"') && valPart.endsWith('"')) ||
                         (valPart.startsWith("'") && valPart.endsWith("'"));
        if (isQuoted || value.includes(':') || value.includes('#') || value.includes(' ')) {
            formatted = `"${value}"`;
        } else {
            formatted = value;
        }
    } else {
        formatted = String(value);
    }

    lines[idx] = `${prefix}${formatted}${comment}`;
}

/**
 * 字段不存在时，插入新行
 */
function insertTimelineField(lines, targetStart, targetEnd, targetIndent, field, value, fieldParts) {
    const indent = ' '.repeat(targetIndent + 2);

    let formatted;
    if (typeof value === 'boolean') formatted = value ? 'true' : 'false';
    else if (typeof value === 'string') formatted = value.includes(':') ? `"${value}"` : value;
    else formatted = String(value);

    if (fieldParts.length === 1) {
        // 直接在 target 的末尾插入
        lines.splice(targetEnd, 0, `${indent}${field}: ${formatted}`);
    } else {
        // once.analyze → find or create once: block, then insert child
        const parentLine = findChildKey(lines, targetStart, targetEnd, targetIndent, fieldParts[0]);
        if (parentLine >= 0) {
            const parentIndent = lines[parentLine].search(/\S/);
            const parentEnd = findBlockEnd(lines, parentLine, parentIndent, targetEnd);
            const childIndent = ' '.repeat(parentIndent + 2);
            lines.splice(parentEnd, 0, `${childIndent}${fieldParts[1]}: ${formatted}`);
        } else {
            // parent doesn't exist → create both
            lines.splice(targetEnd, 0,
                `${indent}${fieldParts[0]}:`,
                `${indent}  ${fieldParts[1]}: ${formatted}`
            );
        }
    }
}

/**
 * 点击预设卡片 → 更新 config.yaml 中的 schedule.preset + 滚动左侧编辑器
 */
window.selectTimelinePreset = function(name) {
    // 更新 config.yaml 中的 schedule.preset
    const configEditor = document.getElementById('yaml-editor');
    let yaml = configEditor.value;
    const lines = yaml.split('\n');

    let presetLineIdx = -1;
    let inSchedule = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^schedule:\s*$/.test(line.trimEnd()) || /^schedule:\s*#/.test(line)) {
            inSchedule = true;
            continue;
        }
        if (inSchedule && /^\S/.test(line) && !line.startsWith('#')) {
            inSchedule = false;
        }
        if (inSchedule && /^\s+preset:\s*/.test(line)) {
            presetLineIdx = i;
            break;
        }
    }

    if (presetLineIdx >= 0) {
        const original = lines[presetLineIdx];
        const match = original.match(/^(\s*preset:\s*)(.*)$/);
        if (match) {
            const prefix = match[1];
            const rest = match[2];
            const commentMatch = rest.match(/(\s*#.*)$/);
            const comment = commentMatch ? commentMatch[1] : '';
            lines[presetLineIdx] = `${prefix}"${name}"${comment}`;
        }
    }

    configEditor.value = lines.join('\n');
    currentYaml = configEditor.value;
    updateBackdrop('yaml-editor', 'yaml-backdrop');
    debounceSaveConfig();

    // 左侧 timeline 编辑器跳转到对应预设
    scrollTimelineEditorToPreset(name);

    // 重新渲染 timeline 面板
    syncTimelineToUI();
    const tlData = parseTimelineData();
    const tlCfg = getPresetConfig(tlData, name);
    const displayName = tlCfg?.name || name;
    showToast(t('toast.switchedToMode', displayName), 'success');
}

/**
 * 滚动左侧 timeline 编辑器到对应预设位置
 */
function scrollTimelineEditorToPreset(presetName) {
    const editor = document.getElementById('timeline-editor');
    const text = editor.value;
    const lines = text.split('\n');

    let targetLine = -1;

    if (presetName === 'custom') {
        // 找顶层 custom:
        for (let i = 0; i < lines.length; i++) {
            if (/^custom:\s*/.test(lines[i])) {
                targetLine = i;
                break;
            }
        }
    } else {
        // 找 presets: 下的 presetName:
        let inPresets = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^presets:\s*/.test(line)) {
                inPresets = true;
                continue;
            }
            if (inPresets && /^\S/.test(line) && !line.startsWith('#')) break;
            if (inPresets) {
                const m = line.match(/^\s+(\S+):\s*/);
                if (m && m[1] === presetName) {
                    targetLine = i;
                    break;
                }
            }
        }
    }

    if (targetLine < 0) return;

    const lineHeight = EDITOR_LINE_HEIGHT;
    const scrollPosition = targetLine * lineHeight;

    // 设置光标位置
    let charCount = 0;
    for (let i = 0; i < targetLine; i++) {
        charCount += lines[i].length + 1;
    }

    editor.focus();
    editor.setSelectionRange(charCount, charCount + lines[targetLine].length);
    editor.scrollTop = scrollPosition - 50;

    // 高亮闪烁（防止快速点击竞态）
    clearTimeout(window._tlEditorFlashTimer);
    editor.style.transition = 'background-color 0.3s';
    editor.style.backgroundColor = '#2d4a7c';
    window._tlEditorFlashTimer = setTimeout(() => { editor.style.backgroundColor = ''; }, 300);
}

// ==========================================
// 14. Timeline CRUD 功能（新建模式/时间段/日计划/删除等）
// ==========================================

// ── 弹窗：新建调度模式 ──

window.openTlNewPresetModal = function() {
    const modal = document.getElementById('tl-new-preset-modal');
    // 填充模板下拉
    const sel = document.getElementById('tl-new-preset-template');
    const data = parseTimelineData();
    sel.innerHTML = `<option value="">${t('tlModal.emptyTemplate')}</option>`;
    if (data?.presets) {
        Object.keys(data.presets).forEach(k => {
            const name = data.presets[k]?.name || k;
            sel.innerHTML += `<option value="${k}">${name} (${k})</option>`;
        });
    }
    if (data?.custom) {
        sel.innerHTML += `<option value="custom">${data.custom.name || t('tl.custom')} (custom)</option>`;
    }
    // 清空输入
    document.getElementById('tl-new-preset-key').value = '';
    document.getElementById('tl-new-preset-name').value = '';
    document.getElementById('tl-new-preset-desc').value = '';
    sel.value = '';
    modal.classList.remove('hidden');
}

window.closeTlNewPresetModal = function() {
    document.getElementById('tl-new-preset-modal').classList.add('hidden');
}

window.confirmTlNewPreset = function() {
    const key = document.getElementById('tl-new-preset-key').value.trim();
    const name = document.getElementById('tl-new-preset-name').value.trim();
    const desc = document.getElementById('tl-new-preset-desc').value.trim();
    const template = document.getElementById('tl-new-preset-template').value;

    // 验证
    if (!key) { showToast(t('toast.enterPresetKey'), 'error'); return; }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) { showToast(t('toast.invalidKey'), 'error'); return; }
    if (!name) { showToast(t('toast.enterName'), 'error'); return; }

    // 检查重复
    const data = parseTimelineData();
    if (data?.presets?.[key]) { showToast(t('toast.presetExists', key), 'error'); return; }
    if (key === 'custom') { showToast(t('toast.noCustomKey'), 'error'); return; }

    // 构建 YAML 文本块
    let block;
    if (template && data) {
        const src = getPresetConfig(data, template);
        if (src) {
            block = buildPresetYamlBlock(key, { ...src, name: name, description: desc || src.description || '' });
        } else {
            block = buildEmptyPresetBlock(key, name, desc);
        }
    } else {
        block = buildEmptyPresetBlock(key, name, desc);
    }

    // 插入到 timeline YAML 的 presets: 块末尾
    const editor = document.getElementById('timeline-editor');
    let yaml = editor.value;
    const lines = yaml.split('\n');

    // 找 presets: 块的结束位置
    let presetsStart = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^presets:\s*/.test(lines[i])) { presetsStart = i; break; }
    }

    if (presetsStart < 0) {
        // 没有 presets: 顶层 key，在文件开头插入
        lines.unshift('presets:', ...block.split('\n'));
    } else {
        // 找 presets 块结束（下一个顶层 key）
        let presetsEnd = lines.length;
        for (let i = presetsStart + 1; i < lines.length; i++) {
            if (/^\S/.test(lines[i]) && !lines[i].startsWith('#') && lines[i].trim() !== '') {
                presetsEnd = i;
                break;
            }
        }
        // 在 presetsEnd 前插入（即 presets 块最后）
        const blockLines = block.split('\n');
        lines.splice(presetsEnd, 0, ...blockLines);
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();

    // 切换 config.yaml 中 preset 为新模式
    selectTimelinePreset(key);

    closeTlNewPresetModal();
    showToast(t('toast.presetCreated', name), 'success');
}

/**
 * 构建空白预设 YAML 文本块
 */
function buildEmptyPresetBlock(key, name, desc) {
    return [
        `  ${key}:`,
        `    name: "${name}"`,
        `    description: "${desc || ''}"`,
        `    default:`,
        `      collect: true`,
        `      analyze: false`,
        `      ai_mode: follow_report`,
        `      push: false`,
        `      report_mode: current`,
        `      once:`,
        `        analyze: false`,
        `        push: false`,
        `    periods: {}`,
        `    day_plans:`,
        `      all_day:`,
        `        periods: []`,
        `    week_map:`,
        `      1: all_day`,
        `      2: all_day`,
        `      3: all_day`,
        `      4: all_day`,
        `      5: all_day`,
        `      6: all_day`,
        `      7: all_day`,
        ``
    ].join('\n');
}

/**
 * 基于已有配置构建预设 YAML 文本块
 */
function buildPresetYamlBlock(key, cfg) {
    const obj = { [key]: cfg };
    let dumped = jsyaml.dump(obj, { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false });
    // js-yaml 会把 week_map 的数字 key 序列化成带引号的字符串（"1".."7"），
    // 而后端 scheduler 用整数 isoweekday() 读取 week_map，字符串 key 会导致启动校验失败、无法运行。
    // 这里去掉纯数字 key 的引号，与手写模板（1: all_day）及后端期望的整数 key 保持一致。
    dumped = dumped.replace(/^(\s*)"(\d+)":/gm, '$1$2:');
    return dumped.split('\n').map(l => l ? '  ' + l : l).join('\n');
}

// ── 弹窗：新增时间段 ──

let _tlNewPeriodTarget = '';

window.openTlNewPeriodModal = function(presetName) {
    _tlNewPeriodTarget = presetName;
    document.getElementById('tl-new-period-key').value = '';
    document.getElementById('tl-new-period-name').value = '';
    document.getElementById('tl-new-period-start').value = '09:00';
    document.getElementById('tl-new-period-end').value = '11:00';
    document.getElementById('tl-new-period-modal').classList.remove('hidden');
}

window.closeTlNewPeriodModal = function() {
    document.getElementById('tl-new-period-modal').classList.add('hidden');
}

window.confirmTlNewPeriod = function() {
    const key = document.getElementById('tl-new-period-key').value.trim();
    const name = document.getElementById('tl-new-period-name').value.trim();
    const start = document.getElementById('tl-new-period-start').value;
    const end = document.getElementById('tl-new-period-end').value;

    if (!key) { showToast(t('toast.enterPeriodKey'), 'error'); return; }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) { showToast(t('toast.invalidKeyFormat'), 'error'); return; }
    if (!name) { showToast(t('toast.enterPeriodName'), 'error'); return; }
    if (!start || !end) { showToast(t('toast.setTime'), 'error'); return; }
    if (start === end) { showToast(t('toast.sameTime'), 'error'); return; }

    const data = parseTimelineData();
    const presetCfg = getPresetConfig(data, _tlNewPeriodTarget);
    if (presetCfg?.periods?.[key]) { showToast(t('toast.periodExists', key), 'error'); return; }

    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, _tlNewPeriodTarget);
    if (!sectionInfo) { showToast(t('toast.presetSectionNotFound'), 'error'); return; }

    const periodsLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'periods');
    if (periodsLine < 0) { showToast(t('toast.periodsNotFound'), 'error'); return; }

    const periodsIndent = lines[periodsLine].search(/\S/);
    const periodsContent = lines[periodsLine].trim();
    const childIndent = periodsIndent + 2;
    const periodIndent = childIndent + 2;
    const indent = ' '.repeat(childIndent);
    const subIndent = ' '.repeat(periodIndent);

    const newPeriodLines = [
        `${indent}${key}:`,
        `${subIndent}name: "${name}"`,
        `${subIndent}start: "${start}"`,
        `${subIndent}end: "${end}"`,
        `${subIndent}collect: true`,
        `${subIndent}analyze: false`,
        `${subIndent}push: true`,
        `${subIndent}report_mode: current`
    ];

    if (periodsContent === 'periods: {}' || periodsContent === 'periods:{}') {
        lines[periodsLine] = ' '.repeat(periodsIndent) + 'periods:';
        lines.splice(periodsLine + 1, 0, ...newPeriodLines);
    } else {
        const periodsEnd = findBlockEnd(lines, periodsLine, periodsIndent, sectionInfo.end);
        lines.splice(periodsEnd, 0, ...newPeriodLines);
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();

    closeTlNewPeriodModal();
    syncTimelineToUI();
    showToast(t('toast.periodAdded', name), 'success');
}

// ── 删除时间段 ──

window.deleteTlPeriod = function(presetName, periodKey) {
    const data = parseTimelineData();
    const config = getPresetConfig(data, presetName);
    if (!config) return;

    const refs = [];
    const dayPlans = config.day_plans || {};
    Object.entries(dayPlans).forEach(([planName, plan]) => {
        if ((plan.periods || []).includes(periodKey)) refs.push(planName);
    });

    const periodName = config.periods?.[periodKey]?.name || periodKey;
    let msg = t('confirm.deletePeriod', periodName);
    if (refs.length > 0) {
        msg += t('confirm.periodInUse') + refs.map(r => '  • ' + r).join('\n');
    }
    if (!confirm(msg)) return;

    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    const periodsLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'periods');
    if (periodsLine >= 0) {
        const periodsIndent = lines[periodsLine].search(/\S/);
        const periodsEnd = findBlockEnd(lines, periodsLine, periodsIndent, sectionInfo.end);
        const periodLine = findChildKey(lines, periodsLine, periodsEnd, periodsIndent, periodKey);
        if (periodLine >= 0) {
            const periodIndent = lines[periodLine].search(/\S/);
            const periodEnd = findBlockEnd(lines, periodLine, periodIndent, periodsEnd);
            lines.splice(periodLine, periodEnd - periodLine);
        }
    }

    if (refs.length > 0) {
        const updatedSection = findPresetSection(lines, presetName);
        if (updatedSection) removePeriodFromDayPlans(lines, updatedSection, periodKey);
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
    syncTimelineToUI();
    showToast(t('toast.periodDeleted', periodName), 'success');
}

// ── 复制时间段 ──

window.duplicateTlPeriod = function(presetName, periodKey) {
    const data = parseTimelineData();
    const config = getPresetConfig(data, presetName);
    if (!config?.periods?.[periodKey]) return;

    let newKey = periodKey + '_copy';
    let i = 2;
    while (config.periods[newKey]) { newKey = periodKey + '_copy' + i; i++; }

    const src = config.periods[periodKey];
    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    const periodsLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'periods');
    if (periodsLine < 0) return;

    const periodsIndent = lines[periodsLine].search(/\S/);
    const periodsEnd = findBlockEnd(lines, periodsLine, periodsIndent, sectionInfo.end);
    const srcLine = findChildKey(lines, periodsLine, periodsEnd, periodsIndent, periodKey);
    if (srcLine < 0) return;

    const srcIndent = lines[srcLine].search(/\S/);
    const srcEnd = findBlockEnd(lines, srcLine, srcIndent, periodsEnd);

    const copiedLines = [];
    for (let li = srcLine; li < srcEnd; li++) {
        let line = lines[li];
        if (li === srcLine) {
            line = line.replace(periodKey, newKey);
        }
        copiedLines.push(line);
    }
    for (let li = 0; li < copiedLines.length; li++) {
        const m = copiedLines[li].match(/^(\s*name:\s*).+$/);
        if (m) {
            const newName = (src.name || periodKey) + ' (' + t('tl.copy') + ')';
            copiedLines[li] = `${m[1]}"${newName}"`;
            break;
        }
    }

    lines.splice(srcEnd, 0, ...copiedLines);
    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
    syncTimelineToUI();
    showToast(t('toast.duplicatedAs', newKey), 'success');
}

// ── 删除预设模式 ──

const PROTECTED_PRESETS = ['morning_evening', 'always_on', 'office_hours', 'night_owl'];

window.deleteTlPreset = function(presetName) {
    if (PROTECTED_PRESETS.includes(presetName)) {
        showToast(t('toast.builtinNoDelete'), 'warning');
        return;
    }
    if (presetName === 'custom') {
        showToast(t('toast.customNoDelete'), 'warning');
        return;
    }

    const data = parseTimelineData();
    const cfg = data?.presets?.[presetName];
    const displayName = cfg?.name || presetName;

    if (!confirm(t('confirm.deletePreset', displayName))) return;

    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    lines.splice(sectionInfo.start, sectionInfo.end - sectionInfo.start);

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();

    if (getActivePreset() === presetName) {
        selectTimelinePreset('morning_evening');
    } else {
        syncTimelineToUI();
    }
    showToast(t('toast.presetDeleted', displayName), 'success');
}

// ── 复制预设模式 ──

window.duplicateTlPreset = function(presetName) {
    const data = parseTimelineData();
    const src = getPresetConfig(data, presetName);
    if (!src) return;

    openTlNewPresetModal();
    const origName = src.name || presetName;
    document.getElementById('tl-new-preset-key').value = presetName + '_copy';
    document.getElementById('tl-new-preset-name').value = origName + ' (' + t('tl.copy') + ')';
    document.getElementById('tl-new-preset-desc').value = src.description || '';
    document.getElementById('tl-new-preset-template').value = presetName;
}

// ── 新增日计划 ──

window.addTlDayPlan = function(presetName) {
    const planKey = prompt(t('prompt.enterDayPlanKey'));
    if (!planKey) return;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(planKey)) {
        showToast(t('toast.invalidKeyFormat'), 'error');
        return;
    }

    const data = parseTimelineData();
    const config = getPresetConfig(data, presetName);
    if (config?.day_plans?.[planKey]) {
        showToast(t('toast.dayPlanExists', planKey), 'error');
        return;
    }

    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    const dayPlansLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'day_plans');
    if (dayPlansLine < 0) return;

    const dpIndent = lines[dayPlansLine].search(/\S/);
    const dpEnd = findBlockEnd(lines, dayPlansLine, dpIndent, sectionInfo.end);

    const indent = ' '.repeat(dpIndent + 2);
    const subIndent = ' '.repeat(dpIndent + 4);

    lines.splice(dpEnd, 0,
        `${indent}${planKey}:`,
        `${subIndent}periods: []`
    );

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
    syncTimelineToUI();
    showToast(t('toast.dayPlanAdded', planKey), 'success');
}

// ── 删除日计划 ──

window.deleteTlDayPlan = function(presetName, planKey) {
    const data = parseTimelineData();
    const config = getPresetConfig(data, presetName);
    if (!config) return;

    const weekMap = config.week_map || {};
    const refs = [];
    for (let d = 1; d <= 7; d++) {
        const v = weekMap[d] || weekMap[String(d)];
        if (v === planKey) refs.push(getDayNames()[d - 1]);
    }

    if (refs.length > 0) {
        showToast(t('toast.cannotDeleteDayPlan', [planKey, refs.join(', ')]), 'error');
        return;
    }

    if (!confirm(t('confirm.deleteDayPlan', planKey))) return;

    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    const dayPlansLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'day_plans');
    if (dayPlansLine < 0) return;

    const dpIndent = lines[dayPlansLine].search(/\S/);
    const dpEnd = findBlockEnd(lines, dayPlansLine, dpIndent, sectionInfo.end);
    const planLine = findChildKey(lines, dayPlansLine, dpEnd, dpIndent, planKey);
    if (planLine < 0) return;

    const planIndent = lines[planLine].search(/\S/);
    const planEnd = findBlockEnd(lines, planLine, planIndent, dpEnd);

    lines.splice(planLine, planEnd - planLine);

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
    syncTimelineToUI();
    showToast(t('toast.dayPlanDeleted', planKey), 'success');
}

// ── 日计划中添加/移除时间段引用 ──

window.addPeriodToDayPlan = function(presetName, planKey, periodKey) {
    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    const dayPlansLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'day_plans');
    if (dayPlansLine < 0) return;

    const dpIndent = lines[dayPlansLine].search(/\S/);
    const dpEnd = findBlockEnd(lines, dayPlansLine, dpIndent, sectionInfo.end);
    const planLine = findChildKey(lines, dayPlansLine, dpEnd, dpIndent, planKey);
    if (planLine < 0) return;

    const planIndent = lines[planLine].search(/\S/);
    const planEnd = findBlockEnd(lines, planLine, planIndent, dpEnd);
    const periodsLine = findChildKey(lines, planLine, planEnd, planIndent, 'periods');
    if (periodsLine < 0) return;

    const periodsContent = lines[periodsLine].trim();

    if (periodsContent === 'periods: []' || periodsContent === 'periods:[]') {
        const pIndent = ' '.repeat(lines[periodsLine].search(/\S/));
        lines[periodsLine] = `${pIndent}periods:`;
        lines.splice(periodsLine + 1, 0, `${pIndent}  - ${periodKey}`);
    } else {
        const inlineMatch = lines[periodsLine].match(/^(\s*periods:\s*)\[([^\]]*)\]/);
        if (inlineMatch) {
            const existing = inlineMatch[2].split(',').map(s => s.trim()).filter(Boolean);
            // 保持引号风格一致
            const hasQuotes = existing.length > 0 && existing[0].startsWith('"');
            existing.push(hasQuotes ? `"${periodKey}"` : periodKey);
            lines[periodsLine] = `${inlineMatch[1]}[${existing.join(', ')}]`;
        } else {
            const pIndent = ' '.repeat(lines[periodsLine].search(/\S/) + 2);
            const listEnd = findBlockEnd(lines, periodsLine, lines[periodsLine].search(/\S/), planEnd);
            lines.splice(listEnd, 0, `${pIndent}- ${periodKey}`);
        }
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
    syncTimelineToUI();
}

window.removePeriodFromDayPlanUI = function(presetName, planKey, periodKey) {
    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    removePeriodFromDayPlanInLines(lines, sectionInfo, planKey, periodKey);

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
    syncTimelineToUI();
}

// ── 周映射快捷操作 ──

window.tlWeekMapQuick = function(presetName, mode) {
    const data = parseTimelineData();
    const config = getPresetConfig(data, presetName);
    if (!config) return;

    const dayPlanKeys = Object.keys(config.day_plans || {});
    if (dayPlanKeys.length === 0) { showToast(t('toast.noDayPlans'), 'error'); return; }

    let mapping = {};

    if (mode === 'all_same') {
        const plan = dayPlanKeys[0];
        for (let d = 1; d <= 7; d++) mapping[d] = plan;
    } else if (mode === 'weekday_same') {
        const plan = dayPlanKeys[0];
        for (let d = 1; d <= 5; d++) mapping[d] = plan;
        const wm = config.week_map || {};
        mapping[6] = wm[6] || wm['6'] || plan;
        mapping[7] = wm[7] || wm['7'] || plan;
    } else if (mode === 'weekday_weekend') {
        if (dayPlanKeys.length < 2) { showToast(t('toast.needTwoDayPlans'), 'warning'); return; }
        const wd = dayPlanKeys[0];
        const we = dayPlanKeys[1];
        for (let d = 1; d <= 5; d++) mapping[d] = wd;
        mapping[6] = we;
        mapping[7] = we;
    }

    for (let d = 1; d <= 7; d++) {
        if (mapping[d]) onTlWeekMap(presetName, d, mapping[d]);
    }
    showToast(t('toast.weekMapUpdated'), 'success');
}

// ── 辅助函数 ──

/**
 * 定位预设配置段的起始行和结束行
 */
function findPresetSection(lines, presetName) {
    const isCustom = presetName === 'custom';
    let start = -1;
    let indent = 0;

    if (isCustom) {
        for (let i = 0; i < lines.length; i++) {
            if (/^custom:\s*/.test(lines[i])) { start = i; indent = 0; break; }
        }
    } else {
        let inPresets = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^presets:\s*/.test(line)) { inPresets = true; continue; }
            if (inPresets && /^\S/.test(line) && !line.startsWith('#') && line.trim() !== '') break;
            if (inPresets) {
                const m = line.match(/^(\s+)(\S+):\s*/);
                if (m && m[2] === presetName) { start = i; indent = m[1].length; break; }
            }
        }
    }

    if (start < 0) return null;

    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const curIndent = line.search(/\S/);
        if (curIndent <= indent) { end = i; break; }
    }

    return { start, end, indent };
}

/**
 * 从 day_plans 中批量移除对某 period 的引用
 */
function removePeriodFromDayPlans(lines, sectionInfo, periodKey) {
    const dayPlansLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'day_plans');
    if (dayPlansLine < 0) return;

    const dpIndent = lines[dayPlansLine].search(/\S/);
    const sectionEnd = findBlockEnd(lines, sectionInfo.start, sectionInfo.indent, lines.length);
    const dpEnd = findBlockEnd(lines, dayPlansLine, dpIndent, sectionEnd);

    for (let i = dayPlansLine + 1; i < dpEnd; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const listMatch = line.match(/^(\s*)-\s*(\S+)\s*$/);
        if (listMatch && listMatch[2] === periodKey) {
            lines.splice(i, 1);
            i--;
            continue;
        }
        const inlineMatch = line.match(/^(\s*periods:\s*)\[([^\]]*)\]/);
        if (inlineMatch) {
            const items = inlineMatch[2].split(',').map(s => s.trim()).filter(s => {
                const bare = s.replace(/^["']|["']$/g, '');
                return bare && bare !== periodKey;
            });
            lines[i] = items.length > 0
                ? `${inlineMatch[1]}[${items.join(', ')}]`
                : `${inlineMatch[1]}[]`;
        }
    }
}

/**
 * 从指定 day_plan 中移除单个 period 引用
 */
function removePeriodFromDayPlanInLines(lines, sectionInfo, planKey, periodKey) {
    const dayPlansLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'day_plans');
    if (dayPlansLine < 0) return;

    const dpIndent = lines[dayPlansLine].search(/\S/);
    const dpEnd = findBlockEnd(lines, dayPlansLine, dpIndent, sectionInfo.end);
    const planLine = findChildKey(lines, dayPlansLine, dpEnd, dpIndent, planKey);
    if (planLine < 0) return;

    const planIndent = lines[planLine].search(/\S/);
    const planEnd = findBlockEnd(lines, planLine, planIndent, dpEnd);
    const periodsLine = findChildKey(lines, planLine, planEnd, planIndent, 'periods');
    if (periodsLine < 0) return;

    const inlineMatch = lines[periodsLine].match(/^(\s*periods:\s*)\[([^\]]*)\]/);
    if (inlineMatch) {
        const items = inlineMatch[2].split(',').map(s => s.trim()).filter(s => {
            const bare = s.replace(/^["']|["']$/g, '');
            return bare && bare !== periodKey;
        });
        lines[periodsLine] = items.length > 0
            ? `${inlineMatch[1]}[${items.join(', ')}]`
            : `${inlineMatch[1]}[]`;
        return;
    }

    const pEnd = findBlockEnd(lines, periodsLine, lines[periodsLine].search(/\S/), planEnd);
    for (let i = periodsLine + 1; i < pEnd; i++) {
        const m = lines[i].match(/^(\s*)-\s*(\S+)\s*$/);
        if (m && m[2] === periodKey) {
            lines.splice(i, 1);
            return;
        }
    }
}

// ==========================================
// 15. 后续优化功能
// ==========================================

// ── 1.3 / 3A.4 内联编辑（双击编辑文本）──

/**
 * 预设卡片名称/描述内联编辑
 */
window.tlInlineEdit = function(el, presetName, field, currentValue) {
    if (el.querySelector('input')) return;

    const original = currentValue;
    const isName = field === 'name';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = original;
    input.className = `tl-inline-input ${isName ? 'text-sm font-bold' : 'text-[10px]'}`;
    input.style.width = '100%';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
        const newVal = input.value.trim();
        if (newVal && newVal !== original) {
            updatePresetMeta(presetName, field, newVal);
        }
        syncTimelineToUI();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = original; }
    });
}

/**
 * 更新预设顶层的 name / description 字段
 */
function updatePresetMeta(presetName, field, value) {
    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    const lineIdx = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, field);
    if (lineIdx >= 0) {
        replaceLineValue(lines, lineIdx, value);
    } else {
        const indent = ' '.repeat(sectionInfo.indent + 2);
        lines.splice(sectionInfo.start + 1, 0, `${indent}${field}: "${value}"`);
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();
}

/**
 * 时间段名称内联编辑
 */
window.tlInlineEditPeriod = function(el, presetName, periodKey, currentValue) {
    if (el.querySelector('input')) return;

    const original = currentValue;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = original;
    input.className = 'tl-inline-input text-sm font-bold';
    input.style.width = Math.max(80, original.length * 14) + 'px';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
        const newVal = input.value.trim();
        if (newVal && newVal !== original) {
            updateTimelineField(presetName, periodKey, 'name', newVal);
        }
        syncTimelineToUI();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = original; }
    });
}

// ── 2.2 周视图空白区域点击 → 显示日计划名称 ──

window.onTlBarClick = function(event, presetName, dayNum) {
    if (event.target.closest('.tl-period-block')) return;

    const data = parseTimelineData();
    const config = getPresetConfig(data, presetName);
    if (!config) return;

    const weekMap = config.week_map || {};
    const planKey = weekMap[dayNum] || weekMap[String(dayNum)] || t('tl.notSet');

    hideTlTooltip();
    const el = document.createElement('div');
    el.className = 'tl-tooltip';
    el.innerHTML = `<div style="font-weight:700;margin-bottom:2px">${getDayNames()[dayNum - 1]}</div>
        <div style="font-size:11px;color:#9ca3af">${t('tl.dayPlanLabel')} <strong style="color:#374151">${planKey}</strong></div>
        <div style="font-size:10px;color:#9ca3af;margin-top:4px">${t('tl.usesDefault')}</div>`;

    document.body.appendChild(el);
    tlTooltipEl = el;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    el.style.left = (x - el.offsetWidth / 2) + 'px';
    el.style.top = (rect.top - el.offsetHeight - 8) + 'px';

    const elRect = el.getBoundingClientRect();
    if (elRect.left < 4) el.style.left = '4px';
    if (elRect.right > window.innerWidth - 4) el.style.left = (window.innerWidth - el.offsetWidth - 4) + 'px';
    if (elRect.top < 4) el.style.top = (rect.bottom + 8) + 'px';

    setTimeout(() => { if (tlTooltipEl === el) hideTlTooltip(); }, 2000);
}

// ── 3B.5 日计划 Tag 拖拽排序 ──

/**
 * 为日计划中的 period tag 容器初始化 SortableJS
 */
function initDayPlanSortable(presetName) {
    document.querySelectorAll('.tl-dayplan-sortable').forEach(container => {
        const planKey = container.dataset.planKey;
        if (!planKey) return;

        new Sortable(container, {
            animation: 150,
            ghostClass: 'tl-tag-ghost',
            dragClass: 'tl-tag-drag',
            draggable: '.tl-period-tag',
            filter: '.tl-add-period-select, .tl-tag-remove',
            preventOnFilter: false,
            onEnd: function() {
                const items = [];
                container.querySelectorAll('.tl-period-tag').forEach(tag => {
                    const key = tag.dataset.periodKey;
                    if (key) items.push(key);
                });
                reorderDayPlanPeriods(presetName, planKey, items);
            }
        });
    });
}

/**
 * 重新排列 day_plan 中 periods 的顺序
 */
function reorderDayPlanPeriods(presetName, planKey, orderedKeys) {
    const editor = document.getElementById('timeline-editor');
    const lines = editor.value.split('\n');

    const sectionInfo = findPresetSection(lines, presetName);
    if (!sectionInfo) return;

    const dayPlansLine = findChildKey(lines, sectionInfo.start, sectionInfo.end, sectionInfo.indent, 'day_plans');
    if (dayPlansLine < 0) return;

    const dpIndent = lines[dayPlansLine].search(/\S/);
    const dpEnd = findBlockEnd(lines, dayPlansLine, dpIndent, sectionInfo.end);
    const planLine = findChildKey(lines, dayPlansLine, dpEnd, dpIndent, planKey);
    if (planLine < 0) return;

    const planIndent = lines[planLine].search(/\S/);
    const planEnd = findBlockEnd(lines, planLine, planIndent, dpEnd);
    const periodsLine = findChildKey(lines, planLine, planEnd, planIndent, 'periods');
    if (periodsLine < 0) return;

    const inlineMatch = lines[periodsLine].match(/^(\s*periods:\s*)\[([^\]]*)\]/);
    if (inlineMatch) {
        lines[periodsLine] = `${inlineMatch[1]}[${orderedKeys.join(', ')}]`;
    } else {
        const pIndent = lines[periodsLine].search(/\S/);
        const pEnd = findBlockEnd(lines, periodsLine, pIndent, planEnd);
        lines.splice(periodsLine + 1, pEnd - periodsLine - 1);
        const itemIndent = ' '.repeat(pIndent + 2);
        const newItems = orderedKeys.map(k => `${itemIndent}- ${k}`);
        lines.splice(periodsLine + 1, 0, ...newItems);
    }

    editor.value = lines.join('\n');
    currentTimeline = editor.value;
    updateBackdrop('timeline-editor', 'timeline-backdrop');
    debounceSaveTimeline();

    clearTimeout(window._tlRenderTimer);
    window._tlRenderTimer = setTimeout(() => syncTimelineToUI(), 500);
}

// ==========================================
// 16. 联网搜索任务 (search_queries.txt) 双向编辑器
// ==========================================

function _escapeSearchHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _normalizeSearchDomain(rawSite) {
    let site = (rawSite || '').trim();
    if (!site) return '';
    if (site.includes('://')) {
        try {
            site = new URL(site).hostname || '';
        } catch {
            site = site.split('://')[1].split('/')[0];
        }
    } else {
        site = site.split('/')[0].split('?')[0].trim();
    }
    return site.toLowerCase().replace(/^\.+|\.+$/g, '');
}

/**
 * 解析 search_queries.txt（语义与后端 query_parser.py 100% 对齐，同时保留注释与行号）
 */
function parseSearchQueriesText(text) {
    const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const result = {
        globalFilter: [], // { type: 'word' | 'site', value: string, raw: string }
        topics: [],       // { name, queries[], excludeWords[], excludeSites[], maxItems, freshnessDays, provider, startLine, precedingComments[] }
        originalText: normalized
    };

    const providerRe = /^@provider:\s*(\S+)$/i;
    const maxItemsRe = /^@(\d+)$/;
    const freshnessRe = /^~(\d+)[dD]$/;
    const excludeSiteRe = /^-site:\s*(\S+)$/i;

    let currentSection = 'SEARCH_TOPICS';
    let currentTopic = null;
    let pendingComments = [];

    const flushTopic = () => {
        if (!currentTopic) return;
        const hasAny =
            currentTopic.name ||
            currentTopic.queries.length > 0 ||
            currentTopic.excludeWords.length > 0 ||
            currentTopic.excludeSites.length > 0 ||
            currentTopic.maxItems !== null ||
            currentTopic.freshnessDays !== null ||
            currentTopic.provider;
        if (hasAny) {
            result.topics.push(currentTopic);
        }
        currentTopic = null;
    };

    const appendUnique = (arr, val) => {
        if (val && !arr.includes(val)) arr.push(val);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 空行：结束当前任务块
        if (!trimmed) {
            flushTopic();
            if (currentSection === 'SEARCH_TOPICS') {
                pendingComments.push('');
            }
            continue;
        }

        // 整行注释
        if (trimmed.startsWith('#')) {
            if (currentSection === 'SEARCH_TOPICS' && !currentTopic) {
                pendingComments.push(line);
            }
            continue;
        }

        // 区段标记
        if (/^\[GLOBAL_FILTER\]$/i.test(trimmed)) {
            flushTopic();
            pendingComments = [];
            currentSection = 'GLOBAL_FILTER';
            continue;
        }
        if (/^\[SEARCH_TOPICS\]$/i.test(trimmed)) {
            flushTopic();
            pendingComments = [];
            currentSection = 'SEARCH_TOPICS';
            continue;
        }

        // 全局屏蔽区
        if (currentSection === 'GLOBAL_FILTER') {
            const siteMatch = trimmed.match(excludeSiteRe);
            if (siteMatch) {
                const domain = _normalizeSearchDomain(siteMatch[1]);
                if (domain && !result.globalFilter.some(f => f.type === 'site' && f.value === domain)) {
                    result.globalFilter.push({ type: 'site', value: domain, raw: `-site:${domain}` });
                }
            } else {
                const word = trimmed.startsWith('!') ? trimmed.slice(1).trim() : trimmed;
                if (word && !result.globalFilter.some(f => f.type === 'word' && f.value === word)) {
                    result.globalFilter.push({ type: 'word', value: word, raw: trimmed });
                }
            }
            continue;
        }

        // 搜索任务区
        const topicHeaderMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (topicHeaderMatch && !['GLOBAL_FILTER', 'SEARCH_TOPICS'].includes(topicHeaderMatch[1].trim().toUpperCase())) {
            // 若当前已有内容，开启新任务（容错：即使两段之间忘了空行）
            if (currentTopic) {
                flushTopic();
            }
            currentTopic = {
                name: topicHeaderMatch[1].trim(),
                queries: [],
                excludeWords: [],
                excludeSites: [],
                maxItems: null,
                freshnessDays: null,
                provider: '',
                startLine: i,
                precedingComments: pendingComments.length > 0 ? [...pendingComments] : []
            };
            pendingComments = [];
            continue;
        }

        if (!currentTopic) {
            currentTopic = {
                name: '',
                queries: [],
                excludeWords: [],
                excludeSites: [],
                maxItems: null,
                freshnessDays: null,
                provider: '',
                startLine: i,
                precedingComments: pendingComments.length > 0 ? [...pendingComments] : []
            };
            pendingComments = [];
        }

        const providerMatch = trimmed.match(providerRe);
        if (providerMatch) {
            currentTopic.provider = providerMatch[1].trim().toLowerCase();
            continue;
        }
        const maxMatch = trimmed.match(maxItemsRe);
        if (maxMatch) {
            const val = parseInt(maxMatch[1], 10);
            if (val > 0) currentTopic.maxItems = val;
            continue;
        }
        const freshMatch = trimmed.match(freshnessRe);
        if (freshMatch) {
            currentTopic.freshnessDays = parseInt(freshMatch[1], 10);
            continue;
        }
        if (trimmed.startsWith('!')) {
            const word = trimmed.slice(1).trim();
            appendUnique(currentTopic.excludeWords, word);
            continue;
        }
        const siteMatch = trimmed.match(excludeSiteRe);
        if (siteMatch) {
            const domain = _normalizeSearchDomain(siteMatch[1]);
            appendUnique(currentTopic.excludeSites, domain);
            continue;
        }

        appendUnique(currentTopic.queries, trimmed);
    }

    flushTopic();
    return result;
}

/**
 * 将结构化搜索任务重建为 search_queries.txt（保留原文件头与任务注释）
 */
function buildSearchQueriesText(data) {
    const out = [];
    const hasOriginal = data.originalText && data.originalText.trim().length > 0;
    const origLines = hasOriginal ? data.originalText.split('\n') : [];

    // 1. 保留文件头部注释（到第一个 [GLOBAL_FILTER] 或 [SEARCH_TOPICS] 之前）
    let idx = 0;
    let foundGlobalHeader = false;
    let foundTopicsHeader = false;

    if (hasOriginal) {
        while (idx < origLines.length) {
            const trimmed = origLines[idx].trim();
            if (/^\[GLOBAL_FILTER\]$/i.test(trimmed)) {
                foundGlobalHeader = true;
                break;
            }
            if (/^\[SEARCH_TOPICS\]$/i.test(trimmed)) {
                foundTopicsHeader = true;
                break;
            }
            if (!trimmed.startsWith('#') && trimmed !== '') {
                break;
            }
            out.push(origLines[idx]);
            idx++;
        }
    } else {
        out.push('# ═══════════════════════════════════════════════════════════════');
        out.push('#                TrendRadar 联网搜索任务配置文件');
        out.push('#                         Version: 1.0.0');
        out.push('# ═══════════════════════════════════════════════════════════════');
        out.push('');
    }

    // 2. 输出 [GLOBAL_FILTER] 区域
    out.push('[GLOBAL_FILTER]');
    if (foundGlobalHeader) {
        idx++;
        // 保留 [GLOBAL_FILTER] 后紧跟的注释
        while (idx < origLines.length) {
            const trimmed = origLines[idx].trim();
            if (trimmed.startsWith('#') || trimmed === '') {
                out.push(origLines[idx]);
                idx++;
            } else {
                break;
            }
        }
    }

    data.globalFilter.forEach(item => {
        if (item.type === 'site') {
            out.push(`-site:${item.value}`);
        } else {
            out.push(item.raw || item.value);
        }
    });

    // 保留 [GLOBAL_FILTER] 与 [SEARCH_TOPICS] 之间的注释与空行
    if (foundGlobalHeader) {
        let between = [];
        while (idx < origLines.length) {
            const trimmed = origLines[idx].trim();
            if (/^\[SEARCH_TOPICS\]$/i.test(trimmed)) {
                foundTopicsHeader = true;
                break;
            }
            if (trimmed.startsWith('#') || trimmed === '') {
                between.push(origLines[idx]);
            }
            idx++;
        }
        if (between.length > 0) {
            // 确保屏蔽词后至少有一个空行
            if (between[0].trim() !== '') out.push('');
            out.push(...between);
        } else {
            out.push('');
            out.push('');
        }
    } else {
        out.push('');
        out.push('');
    }

    // 3. 输出 [SEARCH_TOPICS] 区域
    out.push('[SEARCH_TOPICS]');

    data.topics.forEach((topic, tIdx) => {
        const comments = (topic.precedingComments || []).slice();
        // 清理首尾多余重复空行，但确保任务间至少有一个空行
        while (comments.length > 0 && comments[0] === '') comments.shift();
        while (comments.length > 0 && comments[comments.length - 1] === '') comments.pop();

        out.push('');
        comments.forEach(c => out.push(c));

        if (topic.name && topic.name.trim()) {
            out.push(`[${topic.name.trim()}]`);
        }
        (topic.queries || []).forEach(q => {
            const cleaned = (q || '').trim();
            if (cleaned) out.push(cleaned);
        });
        (topic.excludeWords || []).forEach(w => {
            const cleaned = (w || '').trim().replace(/^!+/, '');
            if (cleaned) out.push(`!${cleaned}`);
        });
        (topic.excludeSites || []).forEach(s => {
            const cleaned = _normalizeSearchDomain(s);
            if (cleaned) out.push(`-site:${cleaned}`);
        });
        if (topic.maxItems !== null && topic.maxItems !== undefined && topic.maxItems !== '' && Number(topic.maxItems) > 0) {
            out.push(`@${parseInt(topic.maxItems, 10)}`);
        }
        if (topic.freshnessDays !== null && topic.freshnessDays !== undefined && topic.freshnessDays !== '' && !isNaN(Number(topic.freshnessDays)) && Number(topic.freshnessDays) >= 0) {
            out.push(`~${parseInt(topic.freshnessDays, 10)}d`);
        }
        if (topic.provider && topic.provider.trim()) {
            out.push(`@provider:${topic.provider.trim().toLowerCase()}`);
        }
    });

    return out.join('\n');
}

function commitSearchData(data, rerender = true) {
    currentSearch = buildSearchQueriesText(data);
    currentSearchData = parseSearchQueriesText(currentSearch);
    // 若存在刚新增的空卡片（尚未填词），保留在内存中让用户继续填写
    if (data._preserveDrafts) {
        currentSearchData = data;
        currentSearchData.originalText = currentSearch;
    }
    const editor = document.getElementById('search-editor');
    if (editor) {
        editor.value = currentSearch;
        updateBackdrop('search-editor', 'search-backdrop');
    }
    debounceSaveSearch();
    if (rerender) {
        renderSearchPanel(currentSearchData);
    }
}

function syncSearchToUI() {
    const data = parseSearchQueriesText(currentSearch);
    currentSearchData = data;
    renderSearchPanel(data);
}

window.scrollToSearchTopicInEditor = function(topicIndex) {
    const editor = document.getElementById('search-editor');
    if (!editor) return;
    const data = parseSearchQueriesText(editor.value);
    const topic = data.topics[topicIndex];
    if (!topic || topic.startLine === undefined || topic.startLine < 0) return;

    const lines = editor.value.split('\n');
    const targetLine = topic.startLine;
    let charCount = 0;
    for (let i = 0; i < targetLine; i++) {
        charCount += lines[i].length + 1;
    }
    editor.focus();
    editor.setSelectionRange(charCount, charCount + (lines[targetLine] || '').length);
    editor.scrollTop = Math.max(0, targetLine * EDITOR_LINE_HEIGHT - 50);

    editor.style.transition = 'background-color 0.3s';
    const originalBg = editor.style.backgroundColor;
    editor.style.backgroundColor = '#2d4a7c';
    setTimeout(() => {
        editor.style.backgroundColor = originalBg;
    }, 300);
};

window.loadSearchTemplate = function(lang) {
    const target = getDefaultSearchQueries(lang);
    const isModified =
        currentSearch.trim() &&
        currentSearch !== getDefaultSearchQueries('zh') &&
        currentSearch !== getDefaultSearchQueries('en');
    if (isModified && !confirm(t('search.confirmLoadTemplate'))) {
        return;
    }
    const editor = document.getElementById('search-editor');
    if (editor) {
        editor.value = target;
    }
    currentSearch = target;
    currentSearchData = null;
    updateBackdrop('search-editor', 'search-backdrop');
    syncSearchToUI();
    debounceSaveSearch();
    showToast(t('search.templateLoaded'), 'success');
};

function renderSearchPanel(data) {
    if (!data) {
        data = currentSearchData || parseSearchQueriesText(currentSearch);
    }
    const panel = document.getElementById('search-panel');
    if (!panel) return;

    const renderTopicCard = (topic, idx) => {
        const queries = topic.queries && topic.queries.length > 0 ? topic.queries : [''];
        const displayTitle = topic.name || (queries[0] ? queries[0].slice(0, 28) : t('search.newTopicDefaultName'));
        const maxItemsVal = topic.maxItems !== null && topic.maxItems !== undefined ? topic.maxItems : '';
        const freshnessVal = topic.freshnessDays !== null && topic.freshnessDays !== undefined ? topic.freshnessDays : '';
        const providerVal = topic.provider || '';

        const excludeTags = [
            ...(topic.excludeWords || []).map(w => `
                <span class="tag-item bg-red-500 text-xs">
                    !${_escapeSearchHtml(w)}
                    <button type="button" onclick="removeSearchTopicExclude(${idx}, 'word', '${escapeAttr(w)}')">×</button>
                </span>
            `),
            ...(topic.excludeSites || []).map(s => `
                <span class="tag-item bg-amber-600 text-xs">
                    <i class="fa-solid fa-ban text-[10px]"></i> -site:${_escapeSearchHtml(s)}
                    <button type="button" onclick="removeSearchTopicExclude(${idx}, 'site', '${escapeAttr(s)}')">×</button>
                </span>
            `)
        ].join('');

        return `
            <div class="search-topic-card border-2 border-emerald-100 bg-white cursor-move" data-topic-index="${idx}" onclick="scrollToSearchTopicInEditor(${idx})">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <div class="flex items-center flex-1 gap-2 min-w-0">
                        <i class="fa-solid fa-grip-vertical text-gray-300 hover:text-gray-500 text-xs flex-shrink-0"></i>
                        <span class="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">#${idx + 1}</span>
                        <input type="text" value="${_escapeSearchHtml(topic.name || '')}"
                               placeholder="${t('search.topicNamePlaceholder')}"
                               class="text-sm font-bold border-0 border-b-2 border-emerald-200 focus:border-emerald-500 outline-none px-2 py-1 flex-1 bg-transparent min-w-0"
                               style="border-radius: 0; box-shadow: none;"
                               onclick="event.stopPropagation()"
                               onchange="updateSearchTopicName(${idx}, this.value)">
                    </div>
                    <button type="button" onclick="event.stopPropagation(); removeSearchTopic(${idx}, '${escapeAttr(displayTitle)}')"
                            class="text-red-400 hover:text-red-600 text-xs px-1.5 py-1 rounded hover:bg-red-50 flex-shrink-0" title="${t('common.delete')}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <div class="space-y-3 editable-area" onclick="event.stopPropagation()">
                    <!-- 搜索词行 -->
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-gray-700"><i class="fa-solid fa-magnifying-glass mr-1.5 text-emerald-500"></i>${t('search.queriesLabel')}</span>
                            <button type="button" onclick="insertSiteOperatorToTopic(${idx})"
                                    class="text-[11px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-0.5 rounded border border-teal-200 transition-colors">
                                ${t('search.insertSiteHelper')}
                            </button>
                        </div>
                        <div class="space-y-2">
                            ${queries.map((q, qIdx) => `
                                <div class="flex items-center gap-2">
                                    <input type="text" value="${_escapeSearchHtml(q)}"
                                           placeholder="${t('search.queryPlaceholder')}"
                                           class="flex-1 bg-white border-gray-300 text-xs"
                                           onchange="updateSearchQueryLine(${idx}, ${qIdx}, this.value)">
                                    ${queries.length > 1 ? `
                                        <button type="button" onclick="removeSearchQueryLine(${idx}, ${qIdx})"
                                                class="text-gray-400 hover:text-red-500 text-xs px-1.5 py-1" title="${t('common.delete')}">
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" onclick="addSearchQueryLine(${idx})"
                                class="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                            <i class="fa-solid fa-plus"></i>${t('search.addQueryLine')}
                        </button>
                    </div>

                    <!-- 独立参数覆盖 -->
                    <div>
                        <div class="text-[11px] font-bold text-gray-500 mb-1.5">${t('search.optionsLabel')}</div>
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="block text-[10px] text-gray-500 mb-1">${t('search.optMaxItems')}</label>
                                <input type="number" min="1" step="1" value="${maxItemsVal}"
                                       placeholder="${t('search.optMaxItemsPh')}"
                                       class="bg-white border-gray-300 text-xs"
                                       onchange="updateSearchTopicOption(${idx}, 'maxItems', this.value)">
                            </div>
                            <div>
                                <label class="block text-[10px] text-gray-500 mb-1">${t('search.optFreshness')}</label>
                                <input type="number" min="0" step="1" value="${freshnessVal}"
                                       placeholder="${t('search.optFreshnessPh')}"
                                       class="bg-white border-gray-300 text-xs"
                                       onchange="updateSearchTopicOption(${idx}, 'freshnessDays', this.value)">
                            </div>
                            <div>
                                <label class="block text-[10px] text-gray-500 mb-1">${t('search.optProvider')}</label>
                                <input type="text" value="${_escapeSearchHtml(providerVal)}"
                                       placeholder="${t('search.optProviderPh')}"
                                       class="bg-white border-gray-300 text-xs"
                                       onchange="updateSearchTopicOption(${idx}, 'provider', this.value)">
                            </div>
                        </div>
                    </div>

                    <!-- 主题内额外屏蔽 -->
                    <div>
                        <div class="text-[11px] font-bold text-gray-500 mb-1.5">${t('search.topicExcludesLabel')}</div>
                        <div class="tag-input-container" style="min-height: 36px; padding: 0.35rem 0.5rem;">
                            ${excludeTags}
                            <input type="text" class="tag-input text-xs" style="border: none; padding: 0.15rem;"
                                   placeholder="${t('search.topicExcludePlaceholder')}"
                                   onkeydown="handleSearchTopicExcludeInput(event, ${idx})">
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const globalTagsHtml = data.globalFilter.length > 0
        ? data.globalFilter.map((item, idx) => {
            const isSite = item.type === 'site';
            const badgeClass = isSite ? 'bg-amber-600' : 'bg-red-500';
            const icon = isSite ? '<i class="fa-solid fa-globe text-[10px]"></i> ' : '';
            const label = isSite ? `-site:${item.value}` : (item.raw || item.value);
            return `
                <span class="tag-item ${badgeClass} text-xs">
                    ${icon}${_escapeSearchHtml(label)}
                    <button type="button" onclick="removeSearchGlobalFilter(${idx})">×</button>
                </span>
            `;
        }).join('')
        : `<span class="text-xs text-gray-400 self-center px-1">${t('search.noGlobalFilter')}</span>`;

    panel.innerHTML = `
        <!-- 顶部使用引导 + 示例模板一键切换 -->
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2.5 flex-1">
                    <i class="fa-solid fa-magnifying-glass text-emerald-600 text-lg mt-0.5"></i>
                    <div class="flex-1">
                        <h3 class="text-sm font-bold text-gray-800">${t('search.guideTitle')}</h3>
                        <p class="text-xs text-gray-600 mt-1 leading-relaxed">${t('search.guideDesc')}</p>
                        <div class="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                            <span class="text-gray-500 font-bold">${t('search.syntaxSummary')}</span>
                            <span class="bg-white border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-mono">${t('search.tipTopic')}</span>
                            <span class="bg-white border border-teal-200 text-teal-700 px-1.5 py-0.5 rounded font-mono">${t('search.tipSite')}</span>
                            <span class="bg-white border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded font-mono">${t('search.tipExcludeSite')}</span>
                            <span class="bg-white border border-red-200 text-red-600 px-1.5 py-0.5 rounded font-mono">${t('search.tipExcludeWord')}</span>
                            <span class="bg-white border border-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-mono">${t('search.tipLimit')}</span>
                            <span class="bg-white border border-sky-200 text-sky-700 px-1.5 py-0.5 rounded font-mono">${t('search.tipDays')}</span>
                            <span class="bg-white border border-yellow-200 text-yellow-700 px-1.5 py-0.5 rounded font-mono">${t('search.tipProvider')}</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 flex-shrink-0">
                    <button type="button" onclick="loadSearchTemplate('zh')" class="text-[11px] bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap">
                        <i class="fa-solid fa-file-lines mr-1"></i>${t('search.loadZhTemplate')}
                    </button>
                    <button type="button" onclick="loadSearchTemplate('en')" class="text-[11px] bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap">
                        <i class="fa-solid fa-globe mr-1"></i>${t('search.loadEnTemplate')}
                    </button>
                </div>
            </div>
        </div>

        <!-- 全局屏蔽区 -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
            <div class="mb-2">
                <h3 class="text-sm font-bold text-gray-700">
                    <i class="fa-solid fa-shield-halved mr-2 text-red-500"></i>${t('search.globalFilterTitle')}
                </h3>
                <p class="text-xs text-gray-500 mt-0.5">${t('search.globalFilterDesc')}</p>
            </div>
            <div id="search-global-filter-tags" class="tag-input-container mb-3">
                ${globalTagsHtml}
                <input type="text" class="tag-input text-xs" style="border: none; padding: 0.15rem;"
                       placeholder="${t('search.globalWordPlaceholder')}"
                       onkeydown="handleSearchGlobalWordInput(event)">
            </div>
            <div class="flex items-center gap-2">
                <input type="text" id="search-global-site-input" class="flex-1 bg-gray-50 border-gray-300 text-xs"
                       placeholder="${t('search.globalSitePlaceholder')}"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();addSearchGlobalSite();}">
                <button type="button" onclick="addSearchGlobalSite()"
                        class="flex-shrink-0 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-md font-medium transition-colors">
                    <i class="fa-solid fa-ban mr-1"></i>${t('search.addExcludeSite')}
                </button>
            </div>
        </div>

        <!-- 搜索任务列表 -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-gray-700">
                    <i class="fa-solid fa-list-ul mr-2 text-emerald-600"></i>${t('search.topicsTitle')}
                    <span class="text-xs text-gray-400 font-normal ml-1">(${data.topics.length}${t('search.nTopics')})</span>
                </h3>
                <button type="button" onclick="addSearchTopic('top')"
                        class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-medium transition-colors">
                    <i class="fa-solid fa-plus mr-1"></i>${t('search.addTopic')}
                </button>
            </div>

            <div id="search-topics-container" class="space-y-4">
                ${data.topics.length > 0
                    ? data.topics.map((topic, idx) => renderTopicCard(topic, idx)).join('')
                    : `<div class="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">${t('search.noTopics')}</div>`
                }
            </div>

            <div class="mt-5 flex justify-center">
                <button type="button" onclick="addSearchTopic('bottom')"
                        class="text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2">
                    <i class="fa-solid fa-plus-circle"></i>
                    <span>${t('search.addTopicBottom')}</span>
                </button>
            </div>
        </div>
    `;

    // 初始化拖拽排序
    setTimeout(() => {
        const container = document.getElementById('search-topics-container');
        if (container && typeof Sortable !== 'undefined' && data.topics.length > 1) {
            if (container.sortableInstance) {
                container.sortableInstance.destroy();
            }
            container.sortableInstance = new Sortable(container, {
                animation: 150,
                filter: '.editable-area, input, button, select, textarea',
                preventOnFilter: false,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onEnd: function() {
                    const cards = Array.from(container.querySelectorAll('.search-topic-card'));
                    const newOrder = cards.map(c => parseInt(c.getAttribute('data-topic-index'), 10));
                    const cur = currentSearchData || parseSearchQueriesText(currentSearch);
                    const oldOrder = cur.topics.map((_, i) => i);
                    if (JSON.stringify(newOrder) !== JSON.stringify(oldOrder)) {
                        cur.topics = newOrder.map(i => cur.topics[i]).filter(Boolean);
                        commitSearchData(cur, true);
                    }
                }
            });
        }
    }, 0);
}

window.handleSearchGlobalWordInput = function(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const raw = (event.target.value || '').trim();
    if (!raw) return;

    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const siteMatch = raw.match(/^-site:\s*(\S+)$/i);
    if (siteMatch) {
        const domain = _normalizeSearchDomain(siteMatch[1]);
        if (domain && !data.globalFilter.some(f => f.type === 'site' && f.value === domain)) {
            data.globalFilter.push({ type: 'site', value: domain, raw: `-site:${domain}` });
        }
    } else {
        const word = raw.replace(/^!+/, '').trim();
        if (word && !data.globalFilter.some(f => f.type === 'word' && f.value === word)) {
            data.globalFilter.push({ type: 'word', value: word, raw: raw });
        }
    }
    event.target.value = '';
    commitSearchData(data, true);
};

window.addSearchGlobalSite = function() {
    const input = document.getElementById('search-global-site-input');
    if (!input) return;
    const raw = input.value.trim().replace(/^-?site:/i, '');
    const domain = _normalizeSearchDomain(raw);
    if (!domain) return;

    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    if (!data.globalFilter.some(f => f.type === 'site' && f.value === domain)) {
        data.globalFilter.push({ type: 'site', value: domain, raw: `-site:${domain}` });
    }
    input.value = '';
    commitSearchData(data, true);
};

window.removeSearchGlobalFilter = function(index) {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    data.globalFilter.splice(index, 1);
    commitSearchData(data, true);
};

window.addSearchTopic = function(position = 'bottom') {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const newTopic = {
        name: t('search.newTopicDefaultName'),
        queries: [t('search.newTopicDefaultQuery')],
        excludeWords: [],
        excludeSites: [],
        maxItems: 8,
        freshnessDays: 7,
        provider: '',
        precedingComments: []
    };
    if (position === 'top') {
        data.topics.unshift(newTopic);
    } else {
        data.topics.push(newTopic);
    }
    commitSearchData(data, true);
};

window.removeSearchTopic = function(topicIndex, title) {
    if (!confirm(t('search.confirmDeleteTopic', title || `#${topicIndex + 1}`))) return;
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    data.topics.splice(topicIndex, 1);
    commitSearchData(data, true);
};

window.updateSearchTopicName = function(topicIndex, value) {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    if (!data.topics[topicIndex]) return;
    data.topics[topicIndex].name = (value || '').trim();
    commitSearchData(data, true);
};

window.updateSearchQueryLine = function(topicIndex, queryIndex, value) {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const topic = data.topics[topicIndex];
    if (!topic) return;
    const cleaned = (value || '').trim();
    if (!topic.queries) topic.queries = [];
    topic.queries[queryIndex] = cleaned;
    // 清理多余空项，但至少保留一条以便编辑
    topic.queries = topic.queries.filter(Boolean);
    if (topic.queries.length === 0) topic.queries = [''];
    data._preserveDrafts = topic.queries.length === 1 && topic.queries[0] === '';
    commitSearchData(data, true);
};

window.addSearchQueryLine = function(topicIndex) {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const topic = data.topics[topicIndex];
    if (!topic) return;
    if (!topic.queries) topic.queries = [];
    topic.queries.push('');
    data._preserveDrafts = true;
    renderSearchPanel(data);
    // 聚焦到刚添加的输入框
    setTimeout(() => {
        const card = document.querySelector(`.search-topic-card[data-topic-index="${topicIndex}"]`);
        if (card) {
            const inputs = card.querySelectorAll('.bg-gray-50 input[type="text"]');
            if (inputs.length > 0) inputs[inputs.length - 1].focus();
        }
    }, 30);
};

window.removeSearchQueryLine = function(topicIndex, queryIndex) {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const topic = data.topics[topicIndex];
    if (!topic || !topic.queries) return;
    topic.queries.splice(queryIndex, 1);
    if (topic.queries.length === 0) topic.queries = [''];
    commitSearchData(data, true);
};

window.insertSiteOperatorToTopic = function(topicIndex) {
    const raw = window.prompt(t('search.promptSiteDomain'));
    if (!raw) return;
    const domain = _normalizeSearchDomain(raw.replace(/^site:/i, ''));
    if (!domain) return;

    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const topic = data.topics[topicIndex];
    if (!topic) return;
    if (!topic.queries || topic.queries.length === 0) {
        topic.queries = [`site:${domain}`];
    } else {
        const targetIdx = topic.queries.length - 1;
        const existing = (topic.queries[targetIdx] || '').trim();
        topic.queries[targetIdx] = existing ? `${existing} site:${domain}` : `site:${domain}`;
    }
    commitSearchData(data, true);
};

window.updateSearchTopicOption = function(topicIndex, field, value) {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const topic = data.topics[topicIndex];
    if (!topic) return;
    const raw = String(value || '').trim();
    if (field === 'maxItems') {
        const n = parseInt(raw, 10);
        topic.maxItems = !isNaN(n) && n > 0 ? n : null;
    } else if (field === 'freshnessDays') {
        const n = parseInt(raw, 10);
        topic.freshnessDays = raw !== '' && !isNaN(n) && n >= 0 ? n : null;
    } else if (field === 'provider') {
        topic.provider = raw.toLowerCase();
    }
    commitSearchData(data, true);
};

window.handleSearchTopicExcludeInput = function(event, topicIndex) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const raw = (event.target.value || '').trim();
    if (!raw) return;

    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const topic = data.topics[topicIndex];
    if (!topic) return;

    const siteMatch = raw.match(/^-site:\s*(\S+)$/i);
    if (siteMatch) {
        const domain = _normalizeSearchDomain(siteMatch[1]);
        if (domain && !topic.excludeSites.includes(domain)) {
            topic.excludeSites.push(domain);
        }
    } else {
        const word = raw.replace(/^!+/, '').trim();
        if (word && !topic.excludeWords.includes(word)) {
            topic.excludeWords.push(word);
        }
    }
    event.target.value = '';
    commitSearchData(data, true);
};

window.removeSearchTopicExclude = function(topicIndex, type, value) {
    const data = currentSearchData || parseSearchQueriesText(currentSearch);
    const topic = data.topics[topicIndex];
    if (!topic) return;
    if (type === 'site') {
        topic.excludeSites = (topic.excludeSites || []).filter(s => s !== value);
    } else {
        topic.excludeWords = (topic.excludeWords || []).filter(w => w !== value);
    }
    commitSearchData(data, true);
};

// ==========================================
// 17. 内置默认配置模板（与 config/ 目录保持同步）
// ==========================================
/* __DEFAULT_TEMPLATES_START__ */
const DEFAULT_YAML_ZH = `# ═══════════════════════════════════════════════════════════════
#                    TrendRadar 配置文件
#                      Version: 2.5.0
# ═══════════════════════════════════════════════════════════════


# 可视化配置编辑器地址: https://sansan0.github.io/TrendRadar/


# ===============================================================
# 1. 基础设置
# ===============================================================
app:
  # 时区配置（影响所有时间显示、调度系统判断、数据存储）
  # 常用时区：
  #   - Asia/Shanghai (北京时间 UTC+8)
  #   - America/New_York (美东时间 UTC-5/-4)
  #   - Europe/London (伦敦时间 UTC+0/+1)
  # 完整时区列表: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  timezone: "Asia/Shanghai"
  show_version_update: true           # 是否显示版本更新提示（true=显示, false=隐藏）


# ===============================================================
# 1.5 调度系统 —— 什么时间做什么事
#
# 通过 timeline.yaml 里定义的时间段来自动决定：
#   - 什么时候推送通知
#   - 什么时候做 AI 分析
#   - 用什么报告模式
#
# 快速上手：选一个预设模板，改 preset 的值就行
#
#   always_on       → 全天候，有新增即推送
#   morning_evening → 全天推送 + 晚间当日汇总（推荐）
#   office_hours    → 工作日三段式（到岗→午间→收工），周末增量自由推
#   night_owl       → 午后速览 + 深夜全天汇总
#   custom          → 完全自定义，详见 timeline.yaml
#
# 详细时间线图请查看 config/timeline.yaml
# ===============================================================
schedule:
  enabled: false                        # 是否启用调度系统（true=启用, false=关闭，默认关闭）
  preset: "morning_evening"             # 预设模板名称（见上方说明）


# ===============================================================
# 2. 数据源 - 热榜平台
#
# 数据来源于 newsnow 开源项目: https://github.com/ourongxing/newsnow
# 你可以自行部署 newsnow 并将 api_url 指向你自己的实例
#
# enabled: 是否启用热榜抓取（总开关）
# api_url: 热榜数据 API 地址（可选，留空使用默认地址）
# sources: 平台列表
#   - id: 平台唯一标识（勿修改）
#   - name: 显示名称（可自定义，修改后不影响运行）
#   - expected_domain: 域名安全校验（可选，建议配置）
#     填写主域名（如 baidu.com），自动匹配该域名及其所有子域名
#     校验返回数据中的链接是否为 HTTPS 且域名匹配，不匹配时丢弃该平台数据并记录警告
#     可有效防范链接劫持或数据篡改
#     只要 api_url 不是你自己部署的实例，都推荐配置 expected_domain
# ===============================================================
platforms:
  enabled: true                         # 是否启用热榜平台抓取（true=启用, false=关闭）
  api_url: ""                            # 热榜数据 API 地址（留空使用默认地址）
                                        # 如果你自行部署了 newsnow，填入你的地址，如: https://your-domain.com/api/s
  sources:
    - id: "toutiao"
      name: "今日头条"
      expected_domain: "toutiao.com"
    - id: "baidu"
      name: "百度热搜"
      expected_domain: "baidu.com"
    - id: "wallstreetcn-hot"
      name: "华尔街见闻"
      expected_domain: "wallstreetcn.com"
    - id: "thepaper"
      name: "澎湃新闻"
      expected_domain: "thepaper.cn"
    - id: "bilibili-hot-search"
      name: "bilibili 热搜"
      expected_domain: "bilibili.com"
    - id: "cls-hot"
      name: "财联社热门"
      expected_domain: "cls.cn"
    - id: "ifeng"
      name: "凤凰网"
      expected_domain: "ifeng.com"
    - id: "tieba"
      name: "贴吧"
      expected_domain: "baidu.com"
    - id: "weibo"
      name: "微博"
      expected_domain: "weibo.com"
    - id: "douyin"
      name: "抖音"
      expected_domain: "douyin.com"
    - id: "zhihu"
      name: "知乎"
      expected_domain: "zhihu.com"



# ===============================================================
# 3. 数据源 - RSS 订阅
#
# 与热榜数据分开存储，按时间流展示
# 每个源配置：id(唯一标识)、name(显示名称)、url(订阅地址)
# enabled: 可选，默认 true
# max_age_days: 可选，覆盖全局 freshness_filter.max_age_days
# ===============================================================
rss:
  enabled: true                       # 是否启用 RSS 抓取（true=启用, false=关闭）

  # 文章新鲜度过滤（过滤超龄旧文章，避免重复推送）
  # 仅在推送阶段过滤，所有文章仍会存入数据库
  freshness_filter:
    enabled: true                     # 是否启用新鲜度过滤（true=启用, false=关闭）

    max_age_days: 1                   # 最大文章年龄（天）
                                      # - 正整数：只推送 N 天内的文章
                                      # - 0：禁用过滤，推送所有文章

  # 单个 feed 可配置 max_age_days 覆盖全局设置：
  # - 不配置：使用全局 freshness_filter.max_age_days（默认 3 天）
  # - 正整数：覆盖全局设置，只推送此天数内的文章
  # - 0：禁用此频道的新鲜度过滤，推送所有文章
  feeds:
    - id: "hacker-news"
      name: "Hacker News"
      url: "https://hnrss.org/frontpage"

    - id: "ruanyifeng"
      name: "阮一峰的网络日志"
      url: "http://www.ruanyifeng.com/blog/atom.xml"
      enabled: false                  # 禁用
      # max_age_days: 3               # 示例：推送 3 天内的文章（更新较慢的博客）

    - id: "yahoo-finance"
      name: "雅虎财经"
      url: "https://finance.yahoo.com/news/rssindex"

    # 自定义源示例
    # - id: "custom-feed"
    #   name: "自定义源"
    #   url: "https://example.com/feed.xml"
    #   enabled: false
    #   max_age_days: 0               # 示例：禁用过滤，推送所有文章


# ===============================================================
# 3.5 数据源 - 联网搜索（按你写的搜索词主动搜全网）
#
# 与热榜、RSS 各自独立存储和展示：
#   - 在 config/search_queries.txt 里写你想搜的主题或问题
#   - 中间空一行就会开启下一个新的搜索任务
#   - 搜索结果会直接按你写的主题展示，不会再被 frequency_words.txt 二次过滤
#   - 默认内置 DeepSeek 搜索引擎，后续也可接入其他搜索服务
# ===============================================================
web_search:
  enabled: false                      # 是否开启联网搜索（true=开启, false=关闭，默认关闭）
  provider: "deepseek"                # 搜索引擎（默认 deepseek，后续可扩展其他引擎）
  queries_file: ""                    # 搜索任务文件（留空默认用 config/search_queries.txt）
                                      # 自定义文件可放到 config/custom/search/ 目录，直接填文件名即可

  query_mode: "direct"                # 怎么处理你写的搜索内容：
                                      # direct = 直接拿去搜（推荐，不额外消耗 AI 费用）
                                      # smart  = 写了很长的一段话时，自动让 AI 提炼成精准搜索词再搜（当天会缓存，不重复花钱）

  # --- 条数与质量把关（先多拉一些候选，再筛出最靠谱的几条展示） ---
  fetch_count: 20                     # 每次向搜索引擎要多少条候选结果（DeepSeek 支持 1~50，多要不加钱）
  max_items_per_topic: 8              # 每个搜索主题最终最多展示几条（0=不限制，也可以在 txt 里用 @数字 单独设置）
  freshness_days: 7                   # 只看最近几天发布的内容（如 7=最近 7 天，0=不限制时间）
  dedup_days: 7                       # 几天内搜过的内容不再重复标为"新增"（避免前几天的旧消息反复推送，0=只看当天）

  min_score: 0.5                      # 最低质量分（0.0~1.0，越高越严格，0=不过滤）
                                      # 0.5 刚好对应 DeepSeek 官方推荐的优质线（原始分 1.5/3.0）
                                      # 冷门话题搜不出结果时可调低到 0.35，想更严格可调到 0.6

  min_authority: -1                   # 网站权威度门槛（-1~4，越高越偏向官网/权威媒体，-1=不限制）
                                      # 关注政策、财经等严肃信息建议设 2 或 3
  allow_unknown_authority: true       # 遇到没有权威度评分的网站时是否保留（true=保留，避免误杀刚发布的新闻页）

  need_content: false                 # 是否顺带抓取整篇网页正文（默认 false；普通展示和 AI 分析用自带摘要就够了）
  notification_show_snippet: false    # 发到飞书/钉钉/微信等消息里时，是否附带一小段摘要（网页版报告始终显示摘要）

  # 搜索引擎账号设置（敏感密钥建议放到 .env 或 GitHub Secrets 的 WEB_SEARCH_API_KEY 里）
  providers:
    deepseek:
      api_key: ""                     # DeepSeek 密钥（留空时自动读取 WEB_SEARCH_API_KEY；
                                      # 如果下方 AI 模型用的也是 DeepSeek，会自动复用 AI_API_KEY，不用重复填写）
      api_base: "https://api.deepseek.com"
      localization: ""                # 可选：填一个 IP 地址，用来影响搜索结果的地区偏好


# ===============================================================
# 4. 报告模式
# ===============================================================
report:
  mode: "current"                     # 报告模式（开启 schedule 后作为默认值，会被 timeline 时段覆盖）
                                      # daily = 当日汇总，按时推送当天所有匹配新闻（会包含之前推过的）
                                      # current = 当前榜单，按时推送当前在榜的匹配新闻（持续在榜的每次都出现）
                                      # incremental = 增量监控，只推送新增内容，零重复（没有新增时不推送）

  display_mode: "keyword"             # 分组维度
                                      # keyword = 按关键词分组显示
                                      # platform = 按平台/来源分组显示

  sort_by_position_first: false       # 关键词模式排序（仅 display_mode=keyword 时生效）
                                      # true = 按 frequency_words.txt 的定义顺序
                                      # false = 按匹配到的热点条数排序（多的在前）

  rank_threshold: 5                   # 排名高亮阈值（影响展示强调，不改变抓取范围）

  max_news_per_keyword: 0             # 每个关键词/标签最大显示数量（0=不限制，仅影响展示裁剪）


# ===============================================================
# 4.5 筛选策略
# ===============================================================
filter:
  method: "keyword"                     # 筛选方式（二选一）
                                       # keyword = 关键词匹配，不调用 AI，不消耗 token，但规则固定
                                       #           词组定义在 config/frequency_words.txt
                                       # ai = AI 智能分类，更灵活但每次运行消耗 token
                                       #      兴趣描述在 config/ai_interests.txt，需配合下方 ai_filter

  priority_sort_enabled: true          # AI 模式标签排序（仅 method=ai 时生效）
                                       # true = 按兴趣描述中的定义顺序
                                       # false = 按匹配条数排序（多的在前）


# ===============================================================
# 4.6 AI 智能筛选配置（仅 filter.method=ai 时生效）
# ===============================================================
ai_filter:
  batch_size: 200                         # 每批发送给 AI 的标题数，超过此数量自动分批
  batch_interval: 2                       # 分批间隔（秒），避免触发 API 限流，0=不等待

  min_score: 0.7                          # 推送最低分数阈值（0.0~1.0），值越高越严格
                                          # 推荐 0.5~0.7 起步，0=不过滤

  # 兴趣描述文件（默认 config/ai_interests.txt，无需配置）
  # 自定义文件放入 config/custom/ai/ 目录，然后指定文件名：
  # interests_file: "finance.txt"    # → 加载 config/custom/ai/finance.txt

  reclassify_threshold: 0.6              # 全量重分类触发阈值（0~1）
                                          # 越低越倾向全量重分类（更准但更耗 token）
                                          # 越高越倾向增量更新（更省但可能不够新）

  # 以下提示词模板一般无需修改（不建议动）

  # 分类提示词模板
  prompt_file: "prompt.txt"

  # 标签提取提示词模板（首次运行时使用）
  extract_prompt_file: "extract_prompt.txt"

  # 标签更新提示词模板（兴趣变更时 AI 对比新旧标签）
  update_tags_prompt_file: "update_tags_prompt.txt"


# ===============================================================
# 5. 推送内容控制
#
# 统一管理推送消息中显示哪些区域及其排列顺序
# ===============================================================
display:
  # 区域显示顺序（从上到下 = 推送中从上到下）
  # 调整顺序：剪切粘贴整行即可
  # 要显示某个区域，需同时：1. 在此列表中  2. 下方 regions 对应开关为 true
  region_order:
    - new_items                           # 1️⃣ 新增热点区域
    - hotlist                             # 2️⃣ 热榜区域（关键词匹配 / AI 智能筛选）
    - rss                                 # 3️⃣ RSS 订阅区域
    - web_search                          # 4️⃣ 联网搜索区域（按提示词主动搜全网）
    - standalone                          # 5️⃣ 独立展示区
    - ai_analysis                         # 6️⃣ AI 分析区域

  # 推送区域开关（需配合上方 region_order 使用）
  regions:
    hotlist: true                     # 热榜区域：关键词匹配 / AI 智能筛选（true=显示, false=隐藏）
    new_items: false                  # 新增热点区域：含热榜新增 + RSS 新增 + 联网搜索新增（true=显示, false=隐藏）
                                      # 注：热点词汇统计中的新增标记🆕不受此配置影响

    rss: true                         # RSS 订阅区域（true=显示并分析, false=隐藏并跳过分析）
    web_search: true                  # 联网搜索区域（true=显示, false=隐藏）
    standalone: false                 # 独立展示区：完整热榜/RSS，不受关键词过滤（true=显示, false=隐藏）
    ai_analysis: true                 # AI 分析区域（true=显示, false=隐藏）

  # 独立展示区：将指定平台/RSS 完整展示，不受关键词过滤
  # 推送展示由 regions.standalone 控制，AI 分析由 ai_analysis.include_standalone 控制
  standalone:
    platforms: ["zhihu", "wallstreetcn-hot"]     # 热榜平台 ID 列表（如 ["zhihu", "weibo"]）
    rss_feeds: []                                # RSS 源 ID 列表（如 ["hacker-news"]）
    max_items: 20                                # 每个源最多展示条数（0=不限制）


# ===============================================================
# 6. 推送通知
#
# ⚠️ 安全警告：webhook 地址不要公开！
#    GitHub 部署请将 webhook 填入 GitHub Secrets，不要写在这里
#
# 📌 多账号：分号(;)分隔，如 "url1;url2;url3"
#    配对项（如 Telegram token 和 chat_id）数量必须一致
# ===============================================================
notification:
  enabled: true                       # 是否启用通知功能（true=启用, false=关闭）—— 总开关
                                      # 开启 schedule 后此项仍为总开关：false=永远不推送，true=由调度控制

  # 推送渠道配置
  channels:
    feishu:
      webhook_url: ""                 # 飞书机器人 webhook URL

    dingtalk:
      webhook_url: ""                 # 钉钉机器人 webhook URL

    wework:
      webhook_url: ""                 # 企业微信机器人 webhook URL
      msg_type: "markdown"            # 消息类型：markdown(群机器人) | text(个人微信应用)

    telegram:
      bot_token: ""                   # Telegram Bot Token
      chat_id: ""                     # Telegram Chat ID

    email:
      from: ""                        # 发件人邮箱地址
      password: ""                    # 发件人邮箱密码或授权码
      to: ""                          # 收件人邮箱，多个用逗号分隔
      smtp_server: ""                 # SMTP 服务器（可选，留空自动识别）
      smtp_port: ""                   # SMTP 端口（可选，留空自动识别）

    ntfy:
      server_url: "https://ntfy.sh"   # ntfy 服务器地址（可改为自托管）
      topic: ""                       # ntfy 主题名称
      token: ""                       # ntfy 访问令牌（可选，用于私有主题）

    bark:
      url: ""                         # Bark 推送 URL（格式：https://api.day.app/your_device_key）

    slack:
      webhook_url: ""                 # Slack Incoming Webhook URL

    generic_webhook:
      webhook_url: ""                 # 通用 Webhook URL（支持 Discord、Matrix、IFTTT 等）
      payload_template: ""            # JSON 模板，支持 {title} 和 {content} 占位符
                                      # 示例：{"content": "{content}"}
                                      # 留空则使用默认格式：{"title": "{title}", "content": "{content}"}


# ===============================================================
# 7. 存储配置
# ===============================================================
storage:
  # 存储后端选择
  # - auto: 自动选择（GitHub Actions 且配置了远程存储 → remote，否则 → local）
  # - local: 本地 SQLite + TXT/HTML 文件
  # - remote: 远程云存储（S3 兼容协议，支持 R2/OSS/COS 等）
  backend: "auto"

  # 数据格式选项
  formats:
    sqlite: true                      # 主存储（必须保持 true，请勿关闭）
    txt: false                        # 是否生成 TXT 快照（true=生成, false=不生成）
    html: true                        # 是否生成 HTML 报告（true=生成, false=不生成）
                                      # ⚠️ 邮件推送或者需要看网页版报告必须设为 true

  # 本地存储配置
  local:
    data_dir: "output"                # 数据目录
    retention_days: 0                 # 保留天数（0=永久保留）

  # 远程存储配置（S3 兼容协议）
  # 支持: Cloudflare R2, 阿里云 OSS, 腾讯云 COS, AWS S3, MinIO 等
  # 建议将敏感信息配置在 GitHub Secrets 或环境变量中
  remote:
    retention_days: 0                 # 保留天数（0=永久保留）

    # S3 兼容配置（或使用环境变量 S3_ENDPOINT_URL 等）
    endpoint_url: ""                  # 服务端点
                                      # Cloudflare R2: https://<account_id>.r2.cloudflarestorage.com
                                      # 阿里云 OSS: https://oss-cn-hangzhou.aliyuncs.com
                                      # 腾讯云 COS: https://cos.ap-guangzhou.myqcloud.com
    bucket_name: ""                   # 存储桶名称
    access_key_id: ""                 # 访问密钥 ID
    secret_access_key: ""             # 访问密钥
    region: ""                        # 区域（可选，部分服务商需要）

  # 数据拉取（从远程同步到本地，用于 MCP Server 等场景）
  pull:
    enabled: false                    # 是否启用启动时自动拉取（true=启用, false=关闭）
    days: 7                           # 拉取最近 N 天的数据


# ===============================================================
# 8. AI 模型配置（ai_analysis / ai_translation / ai_filter 共用）
# ===============================================================
ai:
  # LiteLLM 模型格式: 提供商/模型名
  # 示例:
  #   - deepseek/deepseek-v4-flash (DeepSeek，便宜够用，推荐)
  #   - deepseek/deepseek-v4-pro
  #   - openai/gpt-4o (OpenAI)
  #   - gemini/gemini-2.5-flash (Google Gemini)
  #   - anthropic/claude-sonnet-4-20250514 (Anthropic)
  #   - ollama/llama3 (本地 Ollama)
  # 完整列表: https://docs.litellm.ai/docs/providers
  # 如果你对于看英文文档比较头疼，那么可以点击页面右下角的 【Ask AI】 ,用中文询问怎么配置

  model: "deepseek/deepseek-v4-flash"

  api_key: ""                       # API Key（建议使用环境变量 AI_API_KEY）

  api_base: ""                      # 自定义 API 地址（可选，绝大多数情况留空即可）
                                    #
                                    # ❓ 什么时候需要填？
                                    #    当你使用的 AI 服务商不在上方支持列表中时。
                                    #    比如某些国内 API 中转站、私有部署的服务等。
                                    #    如果你用的是 DeepSeek、OpenAI、Gemini 等主流服务商，
                                    #    不用填这个，留空就行。
                                    #
                                    # 🔧 怎么填？两步走：
                                    #    第一步 - api_base 填写服务商给你的接口地址
                                    #      例如: https://your-provider.com/v1
                                    #
                                    #    第二步 - model 前面加上 "openai/" 前缀
                                    #      例如: openai/deepseek-ai/DeepSeek-V3
                                    #
                                    # 💡 为什么要加 openai/ 前缀？
                                    #    大部分 AI 服务商都兼容同一套通用接口格式，
                                    #    加上 openai/ 就是告诉系统"用这套通用格式去连接"，
                                    #    这样几乎任何服务商都能接入。


  timeout: 120                      # 请求超时（秒）

  temperature: 1.0                  # 采样温度 (0.0-2.0)
                                    # 注意：部分模型(如 gpt-5)可能要求必须为 1.0，否则会报错

  max_tokens: 5000                  # 最大生成 token 数
                                    # 注意：如果 API 不支持此参数(报 HTTP 400)，请设为 0 以禁用发送
  # 高级选项
  num_retries: 1                    # 失败重试次数
  fallback_models: []               # 备用模型列表（可选）
                                    # 示例: ["openai/gpt-4o-mini", "openai/deepseek-ai/DeepSeek-V3"]

  # 额外参数（一般无需修改，删掉 # 号即可启用）
  # 会原样透传给 LiteLLM，可用于补充请求参数或自定义请求头
  # extra_params:
  #   top_p: 1.0
  #   presence_penalty: 0.0
  #   stop: ["END"]


# ===============================================================
# 9. AI 分析功能（模型配置见上方 ai 段）
# ===============================================================
ai_analysis:
  enabled: true                     # 是否启用 AI 分析（true=启用, false=关闭）—— 总开关
                                    # 开启 schedule 后此项仍为总开关：false=永远不分析，true=由调度控制

  language: "Chinese"               # 分析报告语言（如 "English", "Korean", "法语"）
  prompt_file: "ai_analysis_prompt.txt"   # 提示词文件（相对于 config 目录）

  mode: "follow_report"             # AI 分析模式（可独立于 report.mode）
                                    # follow_report = 跟随 report.mode（默认）
                                    # daily / current / incremental = 强制使用指定模式

  max_news_for_analysis: 150        # 参与分析的新闻数量上限（控制 token 成本的关键项）
                                    # 热榜优先占用配额，RSS 用剩余配额，独立展示区不受此限制

  include_rss: false                # 是否包含 RSS 内容进行分析（true=包含, false=不包含）
  include_web_search: true          # 是否把联网搜索结果（含摘要）一起给 AI 分析（true=包含, false=不包含）
  search_summary_max_chars: 300     # 每条联网搜索结果最多发给 AI 多少字的摘要（控制 AI 费用）
  include_standalone: true          # 是否纳入独立展示区数据（true=纳入, false=不纳入）

  include_rank_timeline: true       # 排名时间线详细程度
                                    # true = 完整轨迹（如 1(09:30)→2(10:00)），AI 分析更准但多耗 0.5~1 倍 token
                                    # false = 简化格式（排名范围+出现次数），更省 token




# ===============================================================
# 10. AI 翻译功能（模型配置见上方 ai 段）
#
# 对推送标题进行翻译，不包含 AI 分析的内容
# ===============================================================
ai_translation:
  enabled: true                     # 是否启用翻译功能（true=启用, false=关闭）
  language: "中文"                   # 翻译目标语言（如 "English", "Korean", "法语"）
  prompt_file: "ai_translation_prompt.txt"   # 提示词文件（相对于 config 目录）

  batch_size: 100                   # 每批发送给 AI 的标题数，超过此数量自动分批
  batch_interval: 2                 # 分批间隔（秒），避免触发 API 限流，0=不等待

  # 翻译范围（display.regions 关闭的区域即使开启也不会翻译）
  scope:
    hotlist: false                  # 翻译热榜标题（true=翻译, false=不翻译）
    rss: true                       # 翻译 RSS 标题（true=翻译, false=不翻译）
    web_search: false               # 翻译联网搜索标题与摘要（true=翻译, false=不翻译，搜外文资料时可开启）
    standalone: true                # 翻译独立展示区标题（true=翻译, false=不翻译）


# ===============================================================
# 11. 高级设置（一般无需修改）
# ===============================================================
advanced:
  debug: false                        # 调试模式（true=开启详细日志, false=正常模式）

  # 版本检查
  version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version"
  mcp_version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_mcp"
  configs_version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_configs"

  # 热榜爬虫技术参数
  crawler:
    request_interval: 2000            # 请求间隔（毫秒）
    use_proxy: false                  # 是否启用代理（true=启用, false=不使用）
    default_proxy: "http://127.0.0.1:10801"

  # RSS 设置
  rss:
    request_interval: 1000            # 请求间隔（毫秒）
    timeout: 15                       # 请求超时（秒）
    use_proxy: false                  # 是否使用代理（true=启用, false=不使用）
    proxy_url: ""                     # RSS 专属代理（留空则使用 crawler.default_proxy）

  # 联网搜索技术参数
  web_search:
    request_interval: 1000            # 两次搜索之间的间隔（毫秒），防止触发频率限制
    timeout: 20                       # 单次搜索超时时间（秒）
    max_retries: 2                    # 遇到限流或超时时最多重试几次
    use_proxy: false                  # 是否走代理（true=使用, false=直连）
    proxy_url: ""                     # 联网搜索专属代理（留空则使用 crawler.default_proxy）

  # 排序权重（用于重新排序不同平台的热搜）
  # 合起来等于 1
  weight:
    rank: 0.6                         # 排名权重
    frequency: 0.3                    # 频次权重
    hotness: 0.1                      # 热度权重

  # 多账号限制
  max_accounts_per_channel: 3         # 每个渠道最大账号数量

  # 以下为内部参数（一般无需修改）
  # 消息分批大小（字节）- 内部配置，请勿修改
  batch_size:
    default: 4000
    dingtalk: 20000
    feishu: 30000
    bark: 4000
    slack: 4000
  batch_send_interval: 3              # 批次发送间隔（秒）
  feishu_message_separator: "━━━━━━━━━━━━━━━━"`;

const DEFAULT_YAML_EN = `# ═══════════════════════════════════════════════════════════════
#                   TrendRadar Configuration
#                      Version: 2.5.0
# ═══════════════════════════════════════════════════════════════


# Visual config editor: https://sansan0.github.io/TrendRadar/


# ===============================================================
# 1. Basic Settings
# ===============================================================
app:
  # Timezone (affects all time displays, schedule evaluation, and data storage)
  # Common timezones:
  #   - Asia/Shanghai (Beijing time, UTC+8)
  #   - America/New_York (US Eastern, UTC-5/-4)
  #   - Europe/London (London time, UTC+0/+1)
  # Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  timezone: "Asia/Shanghai"
  show_version_update: true           # Show version-update prompt (true=show, false=hide)


# ===============================================================
# 1.5 Schedule System — what to do, and when
#
# Controlled by the time periods defined in timeline.yaml:
#   - When to push notifications
#   - When to run AI analysis
#   - Which report mode to use
#
# Quick start: pick a preset template and just change the preset value
#
#   always_on       → always on, push as soon as there's anything new
#   morning_evening → push all day + an evening daily summary (recommended)
#   office_hours    → three-block workday (onboarding → noon → wrap-up), free incremental on weekends
#   night_owl       → afternoon brief + late-night full-day summary
#   custom          → fully custom, see timeline.yaml
#
# For the detailed timeline diagram see config/timeline.yaml
# ===============================================================
schedule:
  enabled: false                        # Enable the schedule system (true=on, false=off, default off)
  preset: "morning_evening"             # Preset template name (see above)


# ===============================================================
# 2. Data Source - Hot-list platforms
#
# Data sourced from the open-source newsnow project: https://github.com/ourongxing/newsnow
# You may self-host newsnow and point api_url to your own instance.
#
# enabled: whether to crawl hot lists (master switch)
# api_url: hot-list data API URL (optional; leave empty to use the default)
# sources: platform list
#   - id: unique platform ID (do not change)
#   - name: display name (customizable; changing it does not affect operation)
#   - expected_domain: domain security check (optional, recommended)
#     Enter the main domain (e.g. baidu.com); it auto-matches the domain and all its subdomains.
#     It verifies that links in the returned data are HTTPS and match the domain; on mismatch the
#     platform's data is dropped and a warning is logged.
#     Effectively guards against link hijacking or data tampering.
#     As long as api_url is not your own instance, configuring expected_domain is recommended.
# ===============================================================
platforms:
  enabled: true                         # Enable hot-list crawling (true=on, false=off)
  api_url: ""                           # Hot-list data API URL (leave empty to use the default)
                                        # If you self-host newsnow, enter your address, e.g. https://your-domain.com/api/s
  sources:
    - id: "toutiao"
      name: "Toutiao"
      expected_domain: "toutiao.com"
    - id: "baidu"
      name: "Baidu Hot"
      expected_domain: "baidu.com"
    - id: "wallstreetcn-hot"
      name: "WallStreetCN"
      expected_domain: "wallstreetcn.com"
    - id: "thepaper"
      name: "The Paper"
      expected_domain: "thepaper.cn"
    - id: "bilibili-hot-search"
      name: "Bilibili Hot"
      expected_domain: "bilibili.com"
    - id: "cls-hot"
      name: "CLS Hot"
      expected_domain: "cls.cn"
    - id: "ifeng"
      name: "iFeng"
      expected_domain: "ifeng.com"
    - id: "tieba"
      name: "Tieba"
      expected_domain: "baidu.com"
    - id: "weibo"
      name: "Weibo"
      expected_domain: "weibo.com"
    - id: "douyin"
      name: "Douyin"
      expected_domain: "douyin.com"
    - id: "zhihu"
      name: "Zhihu"
      expected_domain: "zhihu.com"



# ===============================================================
# 3. Data Source - RSS feeds
#
# Stored separately from hot-list data and shown as a time stream.
# Each feed: id (unique), name (display), url (subscription URL)
# enabled: optional, defaults to true
# max_age_days: optional, overrides global freshness_filter.max_age_days
# ===============================================================
rss:
  enabled: true                       # Enable RSS crawling (true=on, false=off)

  # Article freshness filter (filters out stale articles to avoid duplicate pushes)
  # Filtering happens only at push time; all articles are still stored in the database.
  freshness_filter:
    enabled: true                     # Enable freshness filter (true=on, false=off)

    max_age_days: 1                   # Max article age (days)
                                      # - Positive integer: push only articles within N days
                                      # - 0: disable filtering, push all articles

  # A single feed may set max_age_days to override the global setting:
  # - Not set: use global freshness_filter.max_age_days (default 3 days)
  # - Positive integer: override the global setting, push only articles within this many days
  # - 0: disable freshness filtering for this feed, push all articles
  feeds:
    - id: "hacker-news"
      name: "Hacker News"
      url: "https://hnrss.org/frontpage"

    - id: "ruanyifeng"
      name: "Ruan Yi Feng's Blog"
      url: "http://www.ruanyifeng.com/blog/atom.xml"
      enabled: false                  # Disabled
      # max_age_days: 3               # Example: push articles within 3 days (slower-updating blogs)

    - id: "yahoo-finance"
      name: "Yahoo Finance"
      url: "https://finance.yahoo.com/news/rssindex"

    # Custom feed example
    # - id: "custom-feed"
    #   name: "Custom Feed"
    #   url: "https://example.com/feed.xml"
    #   enabled: false
    #   max_age_days: 0               # Example: disable filtering, push all articles


# ===============================================================
# 3.5 Data Source - Web Search (search the web by your own topics)
#
# Stored and displayed separately from hot lists and RSS:
#   - Write topics or questions in config/search_queries.txt
#   - Leave a blank line to start a new search task
#   - Results are grouped by your search topics (not filtered again by frequency_words.txt)
#   - Built-in DeepSeek Search by default; extensible to other providers
# ===============================================================
web_search:
  enabled: false                      # Enable web search (true=on, false=off, default off)
  provider: "deepseek"                # Search engine (default deepseek; extensible)
  queries_file: ""                    # Search queries file (empty → config/search_queries.txt)
                                      # Custom files can go in config/custom/search/

  query_mode: "direct"                # How to run your queries:
                                      # direct = send each line directly as a search query (no extra LLM cost)
                                      # smart  = auto-distill long natural-language prompts via AI (cached daily)

  # --- Count & quality funnel (fetch broadly, then keep the best items) ---
  fetch_count: 20                     # Candidate results requested per query (DeepSeek supports 1~50 at the same price)
  max_items_per_topic: 8              # Max items displayed per topic (0=unlimited; overridable via @N in txt)
  freshness_days: 7                   # Only keep items published within N days (0=no limit)
  dedup_days: 7                       # Skip marking items already seen in the past N days as "new" (0=today only)

  min_score: 0.5                      # Min quality score (0.0~1.0, higher is stricter, 0=no filter)
                                      # 0.5 matches DeepSeek's recommended high-quality bar (1.5 / 3.0)
  min_authority: -1                   # Min source authority (-1~4, higher favors official sites, -1=no limit)
  allow_unknown_authority: true       # Keep pages whose authority score is unknown (-1)

  need_content: false                 # Also fetch full page Markdown content (default false; snippets/summaries suffice)
  notification_show_snippet: false    # Include a short snippet in IM/webhook pushes (HTML report always shows snippets)

  # Search provider credentials (prefer WEB_SEARCH_API_KEY env var / GitHub Secret)
  providers:
    deepseek:
      api_key: ""                     # Empty → reads WEB_SEARCH_API_KEY, or reuses AI_API_KEY if ai.model is DeepSeek
      api_base: "https://api.deepseek.com"
      localization: ""                # Optional IP address to localize search results


# ===============================================================
# 4. Report Mode
# ===============================================================
report:
  mode: "current"                     # Report mode (the default once schedule is on; overridden by timeline periods)
                                      # daily = daily summary, push all matched news of the day on schedule (may include previously pushed items)
                                      # current = current ranking, push currently-ranked matched news on schedule (persistent items reappear each time)
                                      # incremental = incremental monitoring, push only new content, zero duplication (no push if nothing new)

  display_mode: "keyword"             # Grouping dimension
                                      # keyword = group by keyword
                                      # platform = group by platform/source

  sort_by_position_first: false       # Keyword-mode ordering (only effective when display_mode=keyword)
                                      # true = by the definition order in frequency_words.txt
                                      # false = by matched hit count (more hits first)

  rank_threshold: 5                   # Rank highlight threshold (affects display emphasis, not crawl scope)

  max_news_per_keyword: 0             # Max items shown per keyword/tag (0=unlimited; only trims display)


# ===============================================================
# 4.5 Filter Strategy
# ===============================================================
filter:
  method: "keyword"                     # Filter method (choose one)
                                       # keyword = keyword matching, no AI, no token cost, but fixed rules
                                       #           word groups are defined in config/frequency_words.txt
                                       # ai = AI smart classification, more flexible but costs tokens each run
                                       #      interests are in config/ai_interests.txt, requires ai_filter below

  priority_sort_enabled: true          # AI-mode tag ordering (only effective when method=ai)
                                       # true = by the definition order in the interest description
                                       # false = by matched hit count (more hits first)


# ===============================================================
# 4.6 AI Smart Filter (only effective when filter.method=ai)
# ===============================================================
ai_filter:
  batch_size: 200                         # Titles sent to the AI per batch; auto-batched beyond this
  batch_interval: 2                       # Batch interval (seconds) to avoid API rate limits; 0=no wait

  min_score: 0.7                          # Min push-score threshold (0.0~1.0); higher is stricter
                                          # Recommend starting at 0.5~0.7; 0=no filtering

  # Interest description file (defaults to config/ai_interests.txt; no need to configure)
  # Put custom files in config/custom/ai/ and specify the name:
  # interests_file: "finance.txt"    # → loads config/custom/ai/finance.txt

  reclassify_threshold: 0.6              # Full reclassification trigger threshold (0~1)
                                          # Lower → favors full reclassification (more accurate, more tokens)
                                          # Higher → favors incremental updates (cheaper, may be less fresh)

  # The prompt templates below generally need no changes (not recommended to touch)

  # Classification prompt template
  prompt_file: "prompt.txt"

  # Tag extraction prompt template (used on first run)
  extract_prompt_file: "extract_prompt.txt"

  # Tag update prompt template (AI compares old vs new tags when interests change)
  update_tags_prompt_file: "update_tags_prompt.txt"


# ===============================================================
# 5. Push Content Control
#
# Centrally manage which regions appear in the push message and in what order
# ===============================================================
display:
  # Region display order (top to bottom = top to bottom in the push)
  # To reorder: just cut and paste whole lines
  # A region shows only when: 1. it is in this list AND 2. its toggle below is true
  region_order:
    - new_items                           # 1️⃣ New-items region
    - hotlist                             # 2️⃣ Hot-list region (keyword match / AI smart filter)
    - rss                                 # 3️⃣ RSS region
    - web_search                          # 4️⃣ Web search region
    - standalone                          # 5️⃣ Standalone region
    - ai_analysis                         # 6️⃣ AI analysis region

  # Push region toggles (used together with region_order above)
  regions:
    hotlist: true                     # Hot-list region: keyword match / AI smart filter (true=show, false=hide)
    new_items: false                  # New-items region: hot-list new + RSS new + web search new (true=show, false=hide)
                                      # Note: the 🆕 new-marker in the hotspot-word stats is not affected by this

    rss: true                         # RSS region (true=show and analyze, false=hide and skip analysis)
    web_search: true                  # Web search region (true=show, false=hide)
    standalone: false                 # Standalone region: full hot-list/RSS, not subject to keyword filtering (true=show, false=hide)
    ai_analysis: true                 # AI analysis region (true=show, false=hide)

  # Standalone region: show specified platforms/RSS in full, not subject to keyword filtering
  # Push display is controlled by regions.standalone; AI analysis by ai_analysis.include_standalone
  standalone:
    platforms: ["zhihu", "wallstreetcn-hot"]     # Hot-list platform IDs (e.g. ["zhihu", "weibo"])
    rss_feeds: []                                # RSS feed IDs (e.g. ["hacker-news"])
    max_items: 20                                # Max items per source (0=unlimited)


# ===============================================================
# 6. Push Notifications
#
# ⚠️ Security warning: do not expose webhook URLs!
#    On GitHub deployments, store webhooks as GitHub Secrets, not here.
#
# 📌 Multiple accounts: separate with semicolons (;), e.g. "url1;url2;url3"
#    Paired items (e.g. Telegram token and chat_id) must have matching counts
# ===============================================================
notification:
  enabled: true                       # Enable notifications (true=on, false=off) — master switch
                                      # Still the master switch once schedule is on: false=never push, true=controlled by schedule

  # Push channel configuration
  channels:
    feishu:
      webhook_url: ""                 # Feishu bot webhook URL

    dingtalk:
      webhook_url: ""                 # DingTalk bot webhook URL

    wework:
      webhook_url: ""                 # WeCom (Enterprise WeChat) bot webhook URL
      msg_type: "markdown"            # Message type: markdown (group bot) | text (personal WeCom app)

    telegram:
      bot_token: ""                   # Telegram Bot Token
      chat_id: ""                     # Telegram Chat ID

    email:
      from: ""                        # Sender email address
      password: ""                    # Sender email password or authorization code
      to: ""                          # Recipient email(s); separate multiple addresses with commas
      smtp_server: ""                 # SMTP server (optional; auto-detected if empty)
      smtp_port: ""                   # SMTP port (optional; auto-detected if empty)

    ntfy:
      server_url: "https://ntfy.sh"   # ntfy server address (can be self-hosted)
      topic: ""                       # ntfy topic name
      token: ""                       # ntfy access token (optional, for private topics)

    bark:
      url: ""                         # Bark push URL (format: https://api.day.app/your_device_key)

    slack:
      webhook_url: ""                 # Slack Incoming Webhook URL

    generic_webhook:
      webhook_url: ""                 # Generic Webhook URL (supports Discord, Matrix, IFTTT, etc.)
      payload_template: ""            # JSON template, supports {title} and {content} placeholders
                                      # Example: {"content": "{content}"}
                                      # Leave empty to use the default: {"title": "{title}", "content": "{content}"}


# ===============================================================
# 7. Storage
# ===============================================================
storage:
  # Storage backend selection
  # - auto: auto-select (uses remote when running in GitHub Actions with remote storage, otherwise local)
  # - local: local SQLite + TXT/HTML files
  # - remote: remote cloud storage (S3-compatible, supports R2/OSS/COS, etc.)
  backend: "auto"

  # Data format options
  formats:
    sqlite: true                      # Primary storage (must stay true; do not disable)
    txt: false                        # Generate TXT snapshots (true=generate, false=skip)
    html: true                        # Generate HTML reports (true=generate, false=skip)
                                      # ⚠️ Must be true for email pushes or to view the web report

  # Local storage configuration
  local:
    data_dir: "output"                # Data directory
    retention_days: 0                 # Retention days (0=keep forever)

  # Remote storage configuration (S3-compatible)
  # Supports: Cloudflare R2, Alibaba Cloud OSS, Tencent Cloud COS, AWS S3, MinIO, etc.
  # Recommended to put sensitive info in GitHub Secrets or environment variables
  remote:
    retention_days: 0                 # Retention days (0=keep forever)

    # S3-compatible config (or use env vars S3_ENDPOINT_URL, etc.)
    endpoint_url: ""                  # Service endpoint
                                      # Cloudflare R2: https://<account_id>.r2.cloudflarestorage.com
                                      # Alibaba Cloud OSS: https://oss-cn-hangzhou.aliyuncs.com
                                      # Tencent Cloud COS: https://cos.ap-guangzhou.myqcloud.com
    bucket_name: ""                   # Bucket name
    access_key_id: ""                 # Access key ID
    secret_access_key: ""             # Secret access key
    region: ""                        # Region (optional; required by some providers)

  # Data pull (sync from remote to local, for MCP Server, etc.)
  pull:
    enabled: false                    # Enable auto-pull on startup (true=on, false=off)
    days: 7                           # Pull the last N days of data


# ===============================================================
# 8. AI Model Configuration (shared by ai_analysis / ai_translation / ai_filter)
# ===============================================================
ai:
  # LiteLLM model format: provider/model-name
  # Examples:
  #   - deepseek/deepseek-v4-flash (DeepSeek; cheap and sufficient, recommended)
  #   - deepseek/deepseek-v4-pro
  #   - openai/gpt-4o (OpenAI)
  #   - gemini/gemini-2.5-flash (Google Gemini)
  #   - anthropic/claude-sonnet-4-20250514 (Anthropic)
  #   - ollama/llama3 (local Ollama)
  # Full list: https://docs.litellm.ai/docs/providers

  model: "deepseek/deepseek-v4-flash"

  api_key: ""                       # API Key (prefer using the AI_API_KEY environment variable)

  api_base: ""                      # Custom API URL (optional; leave empty in most cases)
                                    #
                                    # ❓ When do you need this?
                                    #    When your AI provider is not in the supported list above.
                                    #    For example, some API proxies, privately deployed services, etc.
                                    #    If you use DeepSeek, OpenAI, Gemini, etc., leave it empty.
                                    #
                                    # 🔧 How to fill it? Two steps:
                                    #    Step 1 — set api_base to the endpoint given by your provider
                                    #      e.g. https://your-provider.com/v1
                                    #
                                    #    Step 2 — prefix the model with "openai/"
                                    #      e.g. openai/deepseek-ai/DeepSeek-V3
                                    #
                                    # 💡 Why the openai/ prefix?
                                    #    Most AI providers share a common API format.
                                    #    Adding openai/ tells the system "connect using this common format",
                                    #    so almost any provider can be hooked up.


  timeout: 120                      # Request timeout (seconds)

  temperature: 1.0                  # Sampling temperature (0.0-2.0)
                                    # Note: some models (e.g. gpt-5) may require exactly 1.0, or they error

  max_tokens: 5000                  # Max generated tokens
                                    # Note: if the API rejects this param (HTTP 400), set to 0 to stop sending it
  # Advanced options
  num_retries: 1                    # Retry count on failure
  fallback_models: []               # Fallback model list (optional)
                                    # Example: ["openai/gpt-4o-mini", "openai/deepseek-ai/DeepSeek-V3"]

  # Extra params (usually no need to change; uncomment to enable)
  # Passed through to LiteLLM as-is; useful for extra request params or headers
  # extra_params:
  #   top_p: 1.0
  #   presence_penalty: 0.0
  #   stop: ["END"]


# ===============================================================
# 9. AI Analysis (model config is in the ai section above)
# ===============================================================
ai_analysis:
  enabled: true                     # Enable AI analysis (true=on, false=off) — master switch
                                    # Still the master switch once schedule is on: false=never analyze, true=controlled by schedule

  language: "English"               # Analysis report language (e.g. "English", "Chinese", "Korean")
  prompt_file: "ai_analysis_prompt.txt"   # Prompt file (relative to the config directory)

  mode: "follow_report"             # AI analysis mode (can differ from report.mode)
                                    # follow_report = follow report.mode (default)
                                    # daily / current / incremental = force the specified mode

  max_news_for_analysis: 150        # Max number of news items for analysis (key to controlling token cost)
                                    # Hot lists take the quota first; RSS uses the remainder; standalone is not limited

  include_rss: false                # Include RSS content in analysis (true=include, false=exclude)
  include_web_search: true          # Include web search results & summaries in analysis (true=include, false=exclude)
  search_summary_max_chars: 300     # Max summary characters per web search result sent to AI
  include_standalone: true          # Include standalone-region data (true=include, false=exclude)

  include_rank_timeline: true       # Rank-timeline detail level
                                    # true = full trajectory (e.g. 1(09:30)→2(10:00)); more accurate but costs 0.5~1x more tokens
                                    # false = simplified format (rank range + occurrence count); cheaper




# ===============================================================
# 10. AI Translation (model config is in the ai section above)
#
# Translates push titles; does not cover AI analysis content
# ===============================================================
ai_translation:
  enabled: true                     # Enable translation (true=on, false=off)
  language: "English"               # Target language (e.g. "English", "Chinese", "Korean")
  prompt_file: "ai_translation_prompt.txt"   # Prompt file (relative to the config directory)

  batch_size: 100                   # Titles sent to the AI per batch; auto-batched beyond this
  batch_interval: 2                 # Batch interval (seconds) to avoid API rate limits; 0=no wait

  # Translation scope (regions turned off in display.regions are never translated even if enabled here)
  scope:
    hotlist: false                  # Translate hot-list titles (true=translate, false=skip)
    rss: true                       # Translate RSS titles (true=translate, false=skip)
    web_search: false               # Translate web search titles & snippets (true=translate, false=skip)
    standalone: true                # Translate standalone-region titles (true=translate, false=skip)


# ===============================================================
# 11. Advanced Settings (usually no need to change)
# ===============================================================
advanced:
  debug: false                        # Debug mode (true=verbose logs, false=normal)

  # Version checks
  version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version"
  mcp_version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_mcp"
  configs_version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_configs"

  # Hot-list crawler technical params
  crawler:
    request_interval: 2000            # Request interval (ms)
    use_proxy: false                  # Enable proxy (true=on, false=off)
    default_proxy: "http://127.0.0.1:10801"

  # RSS settings
  rss:
    request_interval: 1000            # Request interval (ms)
    timeout: 15                       # Request timeout (seconds)
    use_proxy: false                  # Use proxy (true=on, false=off)
    proxy_url: ""                     # RSS-specific proxy (empty → use crawler.default_proxy)

  # Web search technical settings
  web_search:
    request_interval: 1000            # Interval between search requests (ms)
    timeout: 20                       # Request timeout (seconds)
    max_retries: 2                    # Max retries on rate limit or timeout
    use_proxy: false                  # Use proxy (true=on, false=off)
    proxy_url: ""                     # Web-search-specific proxy (empty → use crawler.default_proxy)

  # Sorting weights (used to re-rank hotlist items across platforms)
  # Must sum to 1
  weight:
    rank: 0.6                         # Rank weight
    frequency: 0.3                    # Frequency weight
    hotness: 0.1                      # Hotness weight

  # Multi-account limit
  max_accounts_per_channel: 3         # Max accounts per channel

  # Internal params below (usually no need to change)
  # Message batch size (bytes) — internal config, do not modify
  batch_size:
    default: 4000
    dingtalk: 20000
    feishu: 30000
    bark: 4000
    slack: 4000
  batch_send_interval: 3              # Batch send interval (seconds)
  feishu_message_separator: "━━━━━━━━━━━━━━━━"`;

const DEFAULT_SEARCH_QUERIES_ZH = `# ═══════════════════════════════════════════════════════════════
#                TrendRadar 联网搜索任务配置文件
#                         Version: 1.0.0
# ═══════════════════════════════════════════════════════════════
#
# 可视化配置编辑器地址: https://sansan0.github.io/TrendRadar/
#
# 凡是左侧带 # 号的都是说明文字，不会生效。
#
# 这个文件用来写你想让程序自动去网上搜的主题或问题。
# 怎么写最简单？
#   - 直接写你想搜的内容就行
#   - 中间空一行，就会开启下一个全新的搜索任务
#   - 同一个段落里（中间不空行）写多行，会归到同一个主题下合并去重
#
# ┌─────────────────────────────────────────────────────────────┐
# │                      小技巧（按需选用）                        │
# └─────────────────────────────────────────────────────────────┘
#
#   [主题名称]       放在段落第一行，给这组搜索起个好记的名字
#   !不要的词        排除标题或摘要里包含这个词的结果
#   -site:域名       屏蔽不想看的网站（比如 -site:baijiahao.baidu.com）
#   site:域名        只看某个网站的内容（比如 site:gov.cn 只看政府官网）
#   @数字            限制这个主题最多展示几条（比如 @5）
#   ~数字d           限制只看最近几天的内容（比如 ~3d 只看3天内，~0d 不限时间）
#   @provider:名称   给这个主题单独换一个搜索引擎（默认用 config.yaml 里的设置）
#
# 💡 提示：
#   - 如果你习惯写很长的一段自然语言（比如"帮我关注……的最新政策"），
#     可以把 config.yaml 中的 web_search.query_mode 改为 "smart"，
#     系统会自动把长话提炼成适合搜索引擎的精准短词，而且当天只提炼一次，不重复花钱。
#
# ═══════════════════════════════════════════════════════════════


# ───────────────────────────────────────────────────────────────
#                        全局屏蔽区（可选）
# ───────────────────────────────────────────────────────────────
# 写在这里的词或网站，所有搜索任务都会自动过滤掉。

[GLOBAL_FILTER]
# 屏蔽常见标题党和低质量内容农场示例（不需要可删掉或加 # 注释）
震惊
-site:baijiahao.baidu.com


# ───────────────────────────────────────────────────────────────
#                        搜索任务区
# ───────────────────────────────────────────────────────────────
# 空一行 = 开启一个新的搜索任务。下面给出 3 个常见写法示例，按需修改即可：

[SEARCH_TOPICS]

# 示例 1：简单直白写法 —— 写上名字和想搜的内容
[人工智能产业政策]
人工智能 算力基础设施 国家发改委 工信部 最新政策
人工智能 行业应用 补贴 试点政策
@8
~7d

# 示例 2：只看政府官网（加上 site:gov.cn）
[低空经济最新政策]
低空经济 最新政策 试点 site:gov.cn
@5
~14d

# 示例 3：只写一行也能直接搜（不写 [主题名] 时，直接用这一行当标题）
DeepSeek 最新模型 发布 更新`;

const DEFAULT_SEARCH_QUERIES_EN = `# ═══════════════════════════════════════════════════════════════
#             TrendRadar Web Search Queries Config
#                         Version: 1.0.0
# ═══════════════════════════════════════════════════════════════
#
# Visual config editor: https://sansan0.github.io/TrendRadar/
#
# Lines starting with # are comments and will be ignored.
#
# Write the topics or questions you want TrendRadar to search online:
#   - Leave a blank line to start a new search task
#   - Multiple lines without a blank line are grouped under the same topic
#
# Quick syntax (all optional):
#   [Topic Name]     First line of a block: custom display name for this topic
#   !word            Exclude results whose title or snippet contains this word
#   -site:domain     Exclude results from a domain (e.g. -site:example.com)
#   site:domain      Only search within a specific domain (e.g. site:gov.cn)
#   @number          Max items to display for this topic (e.g. @5)
#   ~Nd              Freshness window in days (e.g. ~7d for last 7 days, ~0d for no limit)
#   @provider:name   Override the search engine for this topic
#
# Tip:
#   If you prefer writing long natural-language prompts, set
#   web_search.query_mode: "smart" in config.yaml so AI automatically
#   distills your prompt into concise search queries (cached daily).
#
# ═══════════════════════════════════════════════════════════════

[GLOBAL_FILTER]
clickbait

[SEARCH_TOPICS]

[AI Policy & Regulation]
AI infrastructure regulation policy latest update
AI compute subsidy pilot policy
@8
~7d

[Open Source AI Releases]
DeepSeek OR Qwen new open source model release
@5
~7d`;
/* __DEFAULT_TEMPLATES_END__ */

// ==========================================
// 支持侧栏 折叠/展开
// ==========================================
function toggleSupportSidebar() {
    const wrap = document.querySelector('.support-sidebar-wrap');
    const btn = document.getElementById('sidebar-toggle-btn');
    const isCollapsed = wrap.classList.toggle('collapsed');
    btn.classList.toggle('is-collapsed', isCollapsed);
    btn.title = isCollapsed ? t('sidebar.expand') : t('sidebar.collapse');
}
