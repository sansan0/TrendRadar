/* TrendRadar 管理台前端（无构建、无外部依赖） */
(function () {
  "use strict";

  const state = {
    csrf: "",
    values: null,
    hints: {},
    schema: null,
    errors: {},
    overview: null,
    view: "overview",
    settings: null,
    files: [],
    file: null,
    status: null,
    pollTimer: null,
    logTimer: null,
    busy: false,
  };

  const NAV = [
    { id: "overview", label: "概览", icon: "◉", title: "概览", desc: "运行状态、配置摘要与最近产出。" },
    { group: "配置" },
    { id: "basic", label: "基础与报告", icon: "◎", title: "基础与报告", desc: "时区、时间线模板、报告模式与展示方式。" },
    { id: "sources", label: "数据源", icon: "▤", title: "数据源", desc: "热榜平台与 RSS 订阅源的增删与开关。" },
    { id: "display", label: "筛选与展示", icon: "◇", title: "筛选与展示", desc: "关键词 / AI 筛选方式与推送区域顺序。" },
    { id: "keywords", label: "关键词", icon: "⌗", title: "关键词配置", desc: "词组、必须词、过滤词、最大条数、正则与显示别名。" },
    { id: "ai", label: "AI 能力", icon: "✦", title: "AI 能力", desc: "模型凭据、AI 分析、翻译与智能筛选。" },
    { id: "notification", label: "推送通知", icon: "✉", title: "推送通知", desc: "各通知渠道的地址、令牌与消息格式。" },
    { id: "storage", label: "存储", icon: "▣", title: "存储", desc: "本地数据与 S3 兼容远程存储。" },
    { id: "advanced", label: "高级设置", icon: "⚙", title: "高级设置", desc: "爬虫、权重与消息分批等参数。" },
    { group: "运维" },
    { id: "run", label: "运行与日志", icon: "▶", title: "运行与日志", desc: "立即运行、测试通知、体检与实时日志。" },
    { id: "reports", label: "报告", icon: "▦", title: "历史报告", desc: "运行生成的 HTML 报告。" },
    { id: "files", label: "文件编辑", icon: "✎", title: "配置文件编辑", desc: "关键词规则、时间线、提示词与原始 YAML。" },
    { group: "系统" },
    { id: "settings", label: "系统设置", icon: "⚒", title: "系统设置", desc: "定时计划、访问控制与管理员密码。" },
  ];

  const $ = (sel) => document.querySelector(sel);

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }

  function toast(message, kind) {
    const el = $("#toast");
    el.textContent = message;
    el.className = "toast " + (kind || "");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add("hidden"), 3600);
  }

  async function api(path, options) {
    const opts = Object.assign({ method: "GET", headers: { Accept: "application/json" } }, options || {});
    if (opts.body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    if (state.csrf && opts.method !== "GET") {
      opts.headers["X-CSRF-Token"] = state.csrf;
    }
    const response = await fetch(path, opts);
    let data = {};
    try { data = await response.json(); } catch (err) { data = {}; }
    if (response.status === 401) {
      showLogin();
      throw new Error(data.error || "请先登录");
    }
    if (!response.ok) {
      const error = new Error(data.error || ("请求失败（" + response.status + "）"));
      error.data = data;
      throw error;
    }
    return data;
  }

  /* ---------------- 登录 ---------------- */

  function showLogin() {
    state.csrf = "";
    $("#app").classList.add("hidden");
    $("#login-screen").classList.remove("hidden");
    $("#login-password").focus();
  }

  function showApp() {
    $("#login-screen").classList.add("hidden");
    $("#app").classList.remove("hidden");
  }

  async function login(event) {
    event.preventDefault();
    const userInput = $("#login-username");
    const passInput = $("#login-password");
    const button = $("#login-btn");
    const errorEl = $("#login-error");
    const username = userInput.value.trim();
    if (!username) {
      errorEl.textContent = "请输入用户名";
      errorEl.classList.remove("hidden");
      userInput.focus();
      return;
    }
    if (!passInput.value) {
      errorEl.textContent = "请输入密码";
      errorEl.classList.remove("hidden");
      passInput.focus();
      return;
    }
    errorEl.classList.add("hidden");
    button.disabled = true;
    button.textContent = "登录中...";
    try {
      const result = await api("/api/login", { method: "POST", body: { username: username, password: passInput.value } });
      state.csrf = result.csrf;
      passInput.value = "";
      await loadAll();
      showApp();
      renderNav();
      go("overview");
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    } finally {
      button.disabled = false;
      button.textContent = "登录";
    }
  }

  async function logout() {
    try { await api("/api/logout", { method: "POST" }); } catch (err) { /* ignore */ }
    showLogin();
  }

  /* ---------------- 数据加载 ---------------- */

  function applyConfig(data) {
    state.values = data.values || {};
    state.hints = data.hints || {};
    state.schema = data.schema || state.schema;
    state.notes = data.notes || [];
    state.configMeta = data.meta || {};
  }

  async function loadAll() {
    const [config, overview, settings, https] = await Promise.all([
      api("/api/config"),
      api("/api/overview"),
      api("/api/settings"),
      api("/api/https"),
    ]);
    applyConfig(config.data);
    state.overview = overview.data;
    state.settings = settings.data;
    state.https = https.data;
    state.status = overview.data.status;
  }

  async function reloadConfig() {
    const [config, overview, settings, https] = await Promise.all([
      api("/api/config"),
      api("/api/overview"),
      api("/api/settings"),
      api("/api/https"),
    ]);
    applyConfig(config.data);
    state.overview = overview.data;
    state.settings = settings.data;
    state.https = https.data;
    state.status = overview.data.status;
  }

  /* ---------------- 导航 ---------------- */

  function renderNav() {
    const nav = $("#nav");
    nav.innerHTML = "";
    NAV.forEach((item) => {
      if (item.group) {
        const label = document.createElement("div");
        label.className = "nav-group-label";
        label.textContent = item.group;
        nav.appendChild(label);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = item.id;
      button.innerHTML = '<span class="ico">' + esc(item.icon) + "</span><span>" + esc(item.label) + "</span>";
      button.addEventListener("click", () => go(item.id));
      nav.appendChild(button);
    });
  }

  function navItem(id) {
    return NAV.find((item) => item.id === id);
  }

  function go(view) {
    state.view = view;
    state.errors = {};
    document.querySelectorAll("#nav button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    const item = navItem(view);
    $("#page-title").textContent = item ? item.title : view;
    $("#page-desc").textContent = item ? item.desc : "";
    const content = $("#content");
    content.innerHTML = '<div class="loading"><span class="spinner"></span>加载中...</div>';
    $("#page-actions").innerHTML = "";
    $("#page-actions").onclick = onClick;

    if (view === "overview") renderOverview();
    else if (view === "run") renderRun();
    else if (view === "reports") renderReports();
    else if (view === "files") renderFiles();
    else if (view === "settings") renderSettings();
    else if (view === "keywords") renderKeywords();
    else renderGroup(view);

    if (view === "run" || view === "overview") startPolling();
    else stopPolling();
  }

  /* ---------------- 通用组件 ---------------- */

  function pageAction(label, action, extra, primary) {
    return '<button class="btn ' + (primary ? "btn-primary" : "") + '" data-action="' + action + '" ' + (extra || "") + ">" + esc(label) + "</button>";
  }

  function statusBadge(status) {
    if (!status) return '<span class="badge muted">未知</span>';
    if (status.running) return '<span class="badge info">运行中 · ' + esc(status.kind || "") + "</span>";
    const last = status.last_run;
    if (last && last.ok === false) return '<span class="badge err">上次失败</span>';
    return '<span class="badge ok">空闲</span>';
  }

  function noteHtml(note) {
    const cls = note.level === "error" ? "error" : note.level === "warn" ? "warn" : "info";
    const icon = note.level === "error" ? "✕" : note.level === "warn" ? "!" : "i";
    return '<div class="note ' + cls + '"><span>' + icon + "</span><span>" + esc(note.text) + "</span></div>";
  }

  /* ---------------- 概览 ---------------- */

  function renderOverview() {
    const data = state.overview;
    if (!data) { $("#content").innerHTML = '<div class="loading">暂无数据</div>'; return; }
    const summary = data.summary || {};
    const status = data.status || {};
    const last = status.last_run;
    $("#page-actions").innerHTML = pageAction("刷新", "refresh-overview") + pageAction("立即运行", "run-kind", 'data-kind="run"', true);

    const stats = [
      { k: "运行状态", html: '<span class="status-badge-slot">' + statusBadge(status) + "</span>" },
      { k: "上次运行", v: last ? (last.started_at || "-") : "从未运行", sub: last && last.finished_at ? "结束于 " + last.finished_at : "" },
      { k: "下次计划", v: (status.settings && status.settings.next_run) || "未启用", sub: (status.settings && status.settings.cron_desc) || "" },
      { k: "版本", v: "v" + ((data.project && data.project.version) || "-"), sub: (data.project && data.project.now) || "" },
    ];
    let html = '<div class="grid cols-4">';
    stats.forEach((stat) => {
      html += '<div class="stat"><div class="k">' + esc(stat.k) + '</div><div class="v">' + (stat.html || esc(stat.v)) + "</div>" + (stat.sub ? '<div class="small muted">' + esc(stat.sub) + "</div>" : "") + "</div>";
    });
    html += "</div>";

    html += '<div class="grid cols-2" style="margin-top:16px">';
    html += '<div class="card"><div class="card-head"><h2>配置摘要</h2><span class="badge info">' + esc(summary.timezone || "-") + '</span></div><div class="sub">当前生效的关键配置</div><dl class="kv">';
    html += "<dt>热榜平台</dt><dd>" + (summary.platform_enabled ? "已启用" : "已关闭") + " · " + (summary.platform_count || 0) + " 个</dd>";
    html += "<dt>RSS 订阅</dt><dd>" + (summary.rss_enabled ? "已启用" : "已关闭") + " · " + (summary.rss_count || 0) + " 个</dd>";
    html += "<dt>报告模式</dt><dd>" + esc(summary.report_mode || "-") + " / " + esc(summary.filter_method || "-") + "</dd>";
    html += "<dt>时间线</dt><dd>" + (summary.schedule_enabled ? "已启用 · " + esc(summary.schedule_preset || "") : "未启用") + "</dd>";
    html += "<dt>AI</dt><dd>分析 " + (summary.ai_analysis ? "开" : "关") + " · 翻译 " + (summary.ai_translation ? "开" : "关") + "</dd>";
    html += "<dt>通知渠道</dt><dd>" + ((summary.channels || []).length ? esc(summary.channels.join("、")) : "未配置") + "</dd>";
    html += "</dl></div>";

    html += '<div class="card"><div class="card-head"><h2>运行信息</h2></div><div class="sub">手动执行或由内置计划触发</div><dl class="kv">';
    html += "<dt>本次任务</dt><dd>" + (status.running ? esc(status.kind || "") + " · 已运行 " + esc(status.elapsed || 0) + " 秒" : "无") + "</dd>";
    html += "<dt>上次结果</dt><dd>" + (last ? (last.ok ? '<span class="badge ok">成功</span>' : '<span class="badge err">失败 · 退出码 ' + esc(last.exit_code) + "</span>") + " · " + esc(last.label || "") : "无") + "</dd>";
    html += "<dt>计划模式</dt><dd>" + esc((status.settings && status.settings.run_mode) || "-") + " · " + esc((status.settings && status.settings.cron) || "-") + "</dd>";
    html += "<dt>访问地址</dt><dd>" + esc((data.security && data.security.scheme) || "http") + "://" + esc(location.host) + "</dd>";
    html += "</dl>";
    const notes = data.notes || [];
    if (notes.length) {
      html += '<div style="margin-top:12px">';
      notes.forEach((note) => { html += noteHtml(note); });
      html += "</div>";
    }
    html += "</div></div>";

    html += '<div class="card"><div class="card-head"><h2>最近报告</h2><button class="btn btn-small" data-action="go" data-view="reports">查看全部</button></div><div class="sub">报告生成于 output/html</div>';
    if ((data.reports || []).length) {
      html += '<div class="table-wrap"><table><thead><tr><th>时间</th><th>文件</th><th>大小</th><th></th></tr></thead><tbody>';
      data.reports.forEach((report) => {
        html += "<tr><td>" + esc(report.updated_at) + "</td><td>" + esc(report.path) + "</td><td>" + esc(formatSize(report.size)) + '</td><td><a class="btn btn-small" target="_blank" rel="noopener" href="' + reportUrl(report.path) + '">打开</a></td></tr>';
      });
      html += "</tbody></table></div>";
    } else {
      html += '<div class="empty">还没有生成报告。运行一次后，若开启 HTML 报告即可在这里查看。</div>';
    }
    html += "</div>";

    $("#content").innerHTML = html;
    bindContent();
  }

  function formatSize(size) {
    if (!size) return "0 B";
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / 1024 / 1024).toFixed(1) + " MB";
  }

  function reportUrl(path) {
    return "/reports/" + String(path).split("/").map(encodeURIComponent).join("/");
  }

  /* ---------------- 配置分组 ---------------- */

  function groupById(id) {
    return (state.schema && state.schema.groups || []).find((group) => group.id === id);
  }

  function renderGroup(id) {
    const group = groupById(id);
    if (!group) { $("#content").innerHTML = '<div class="loading">未找到配置分组</div>'; return; }
    let html = '<div class="card"><div class="card-head"><h2>' + esc(group.title) + "</h2><span class=\"badge muted\">config.yaml</span></div><div class=\"sub\">" + esc(group.desc || "") + "</div>";
    if (id === "notification") {
      html += noteHtml({ level: "info", text: "填写至少一个渠道并保存后，点右上角「发送测试通知」，可在「运行与日志」查看每个渠道的发送结果。" });
    }
    if (group.guide) {
      html += guideHtml(group.guide);
      html += '</div><div class="card"><div class="card-head"><h2>渠道配置</h2><span class="badge muted">config.yaml</span></div><div class="sub">敏感字段只显示是否已设置；留空表示保持原值，需要清空时点「清除」。</div>';
    }
    group.fields.forEach((field) => { html += fieldHtml(field); });
    html += "</div>";
    html += '<div class="save-bar"><span class="small muted">保存后下一次运行生效；调度与运行参数在「系统设置」中即时生效。</span><span class="quick-actions">' + pageAction("重置", "reload-view") + pageAction("保存配置", "save-config", "", true) + "</span></div>";
    $("#content").innerHTML = html;
    const actions = id === "notification"
      ? pageAction("发送测试通知", "run-kind", 'data-kind="test-notification"') + pageAction("保存配置", "save-config", "", true)
      : pageAction("保存配置", "save-config", "", true);
    $("#page-actions").innerHTML = actions;
    bindContent();
  }

  function guideHtml(guide) {
    let html = '<div class="guide"><div class="guide-title">配置指南</div>';
    guide.forEach((item, index) => {
      html += '<details class="guide-item"' + (index === 0 ? " open" : "") + "><summary>" + esc(item.title) + "</summary>";
      if (item.steps && item.steps.length) {
        html += "<ol>";
        item.steps.forEach((step) => { html += "<li>" + esc(step) + "</li>"; });
        html += "</ol>";
      }
      if (item.example) {
        html += '<div class="guide-example"><span>示例</span><code>' + esc(item.example) + "</code></div>";
      }
      if (item.note) {
        html += noteHtml({ level: "warn", text: item.note });
      }
      html += "</details>";
    });
    html += "</div>";
    return html;
  }

  function fieldHtml(field) {
    const path = field.path;
    const error = state.errors[path];
    let control = "";
    if (field.type === "bool") {
      control = '<label class="switch"><input type="checkbox" data-path="' + esc(path) + '" data-type="bool"' + (state.values[path] ? " checked" : "") + '><span></span></label>';
    } else if (field.type === "number") {
      control = '<input type="number" data-path="' + esc(path) + '" data-type="number" value="' + esc(state.values[path] == null ? "" : state.values[path]) + '"' +
        (field.min != null ? ' min="' + field.min + '"' : "") + (field.max != null ? ' max="' + field.max + '"' : "") +
        (field.step != null ? ' step="' + field.step + '"' : "") + ">";
    } else if (field.type === "select") {
      control = '<select data-path="' + esc(path) + '" data-type="select">';
      (field.options || []).forEach((option) => {
        control += '<option value="' + esc(option.value) + '"' + (String(state.values[path]) === String(option.value) ? " selected" : "") + ">" + esc(option.label) + "</option>";
      });
      control += "</select>";
    } else if (field.type === "password") {
      const hint = state.hints[path] || "";
      const cleared = state.values[path] === "__CLEAR__";
      control = '<div class="field-inline"><input type="password" autocomplete="new-password" data-path="' + esc(path) + '" data-type="password" value="" placeholder="' + esc(cleared ? "保存后将清除" : hint || "未设置") + '">' +
        '<button class="btn btn-small" data-action="secret-clear" data-path="' + esc(path) + '">清除</button></div>';
      if (hint) control += '<div class="small muted" style="margin-top:4px">' + esc(hint) + "；留空保持不变</div>";
    } else if (field.type === "textarea") {
      control = '<textarea data-path="' + esc(path) + '" data-type="text" rows="4" placeholder="' + esc(field.placeholder || "") + '">' + esc(state.values[path] || "") + "</textarea>";
    } else if (field.type === "yaml") {
      let text = "";
      try { text = JSON.stringify(state.values[path] || {}, null, 2); } catch (err) { text = ""; }
      if (state.values[path] === "") text = "";
      control = '<textarea class="code" data-path="' + esc(path) + '" data-type="yaml" rows="6">' + esc(text) + "</textarea>";
    } else if (field.type === "stringlist") {
      const list = Array.isArray(state.values[path]) ? state.values[path] : [];
      control = '<input type="text" data-path="' + esc(path) + '" data-type="stringlist" value="' + esc(list.join(", ")) + '" placeholder="多个值用英文逗号分隔">';
    } else if (field.type === "idlist") {
      const options = idOptions(field);
      if (!options.length) {
        control = '<div class="empty">先在「数据源」中添加平台或 RSS 源</div>';
      } else {
        control = '<div class="chips" style="display:block">';
        options.forEach((option) => {
          const checked = (state.values[path] || []).map(String).indexOf(String(option.value)) >= 0;
          control += '<label style="display:inline-flex;align-items:center;gap:5px;margin:0 14px 8px 0;font-size:12.5px"><input type="checkbox" data-path="' + esc(path) + '" data-type="idlist" data-value="' + esc(option.value) + '"' + (checked ? " checked" : "") + "> " + esc(option.label) + "</label>";
        });
        control += "</div>";
      }
    } else if (field.type === "order") {
      control = orderEditor(field);
    } else if (field.type === "objectlist") {
      control = objectEditor(field);
      return fieldRow(field, control, error, true);
    } else {
      control = '<input type="text" data-path="' + esc(path) + '" data-type="text" value="' + esc(state.values[path] == null ? "" : state.values[path]) + '" placeholder="' + esc(field.placeholder || "") + '">';
    }
    return fieldRow(field, control, error, false);
  }

  function fieldRow(field, control, error, wide) {
    return '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">' + esc(field.label) + (field.required ? ' <span class="muted">*</span>' : "") + "</div>" +
      (field.help ? '<div class="field-help">' + esc(field.help) + "</div>" : "") + "</div>" +
      '<div class="field-input"' + (wide ? ' style="max-width:100%;flex:1"' : "") + ">" + control + (error ? '<div class="field-error">' + esc(error) + "</div>" : "") + "</div></div></div>";
  }

  function idOptions(field) {
    const source = field.source === "rss" ? "rss.feeds" : "platforms.sources";
    const items = state.values[source] || [];
    const options = items.filter((item) => item && item.id).map((item) => ({ value: item.id, label: (item.name || item.id) + "（" + item.id + "）" }));
    (state.values[field.path] || []).forEach((value) => {
      if (!options.some((option) => String(option.value) === String(value))) {
        options.push({ value: value, label: value + "（已不在数据源列表）" });
      }
    });
    return options;
  }

  function orderEditor(field) {
    const options = field.options || [];
    let order = Array.isArray(state.values[field.path]) ? state.values[field.path].slice() : [];
    options.forEach((option) => { if (!order.includes(option.value)) order.push(option.value); });
    order = order.filter((value) => options.some((option) => option.value === value));
    state.values[field.path] = order;
    let html = "";
    order.forEach((value, index) => {
      const option = options.find((item) => item.value === value);
      html += '<div class="order-row"><span class="idx">' + (index + 1) + '</span><span class="grow">' + esc(option ? option.label : value) + "</span>" +
        '<span class="object-actions"><button class="btn btn-small" data-action="order-up" data-path="' + esc(field.path) + '" data-index="' + index + '"' + (index === 0 ? " disabled" : "") + ">↑</button>" +
        '<button class="btn btn-small" data-action="order-down" data-path="' + esc(field.path) + '" data-index="' + index + '"' + (index === order.length - 1 ? " disabled" : "") + ">↓</button></span></div>";
    });
    return html;
  }

  function objectEditor(field) {
    const items = Array.isArray(state.values[field.path]) ? state.values[field.path] : [];
    let html = "";
    if (!items.length) {
      html += '<div class="empty">还没有条目，点击下方按钮添加。</div>';
    }
    items.forEach((item, index) => {
      const title = item.name || item.id || "未命名";
      html += '<div class="object-item"><div class="object-head"><span class="object-title">' + esc(title) + '</span><span class="object-actions">' +
        '<button class="btn btn-small" data-action="list-up" data-path="' + esc(field.path) + '" data-index="' + index + '"' + (index === 0 ? " disabled" : "") + ">↑</button>" +
        '<button class="btn btn-small" data-action="list-down" data-path="' + esc(field.path) + '" data-index="' + index + '"' + (index === items.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<button class="btn btn-small btn-danger" data-action="list-remove" data-path="' + esc(field.path) + '" data-index="' + index + '">删除</button></span></div><div class="object-grid">';
      (field.item_fields || []).forEach((sub) => {
        const value = item[sub.path];
        const key = sub.path;
        if (sub.type === "bool") {
          html += '<div><label>' + esc(sub.label) + '</label><label class="switch"><input type="checkbox" data-list="' + esc(field.path) + '" data-index="' + index + '" data-key="' + esc(key) + '" data-type="bool"' + (value ? " checked" : "") + '><span></span></label></div>';
        } else if (sub.type === "number") {
          html += '<div><label>' + esc(sub.label) + '</label><input type="number" data-list="' + esc(field.path) + '" data-index="' + index + '" data-key="' + esc(key) + '" data-type="number" value="' + esc(value == null ? "" : value) + '"' + (sub.min != null ? ' min="' + sub.min + '"' : "") + (sub.max != null ? ' max="' + sub.max + '"' : "") + "></div>";
        } else {
          html += '<div class="' + (key === "url" || key === "expected_domain" ? "full" : "") + '"><label>' + esc(sub.label) + (sub.required ? " *" : "") + '</label><input type="text" data-list="' + esc(field.path) + '" data-index="' + index + '" data-key="' + esc(key) + '" data-type="text" value="' + esc(value == null ? "" : value) + '" placeholder="' + esc(sub.placeholder || "") + '"></div>';
        }
      });
      html += "</div></div>";
    });
    html += '<button class="btn btn-small" data-action="list-add" data-path="' + esc(field.path) + '">+ 添加条目</button>';
    if (state.errors[field.path]) {
      html += '<div class="field-error" style="margin-top:8px">' + esc(state.errors[field.path]) + "</div>";
    }
    return html;
  }

  /* ---------------- 表单事件 ---------------- */

  function bindContent() {
    const content = $("#content");
    content.oninput = onInput;
    content.onchange = onInput;
    content.onclick = onClick;
  }

  function onInput(event) {
    const el = event.target;
    if (!el) return;
    if (el.dataset.kwField) {
      if (!state.keywords) return;
      if (el.dataset.kwField === "global") {
        state.keywords.global_filters = el.value.split("\n");
      } else {
        const index = Number(el.dataset.kwGroup);
        const group = (state.keywords.groups || [])[index];
        if (!group) return;
        if (el.dataset.kwField === "max_count") group.max_count = el.value === "" ? 0 : Number(el.value);
        else if (el.dataset.kwField === "items") group.items = el.value.split("\n");
        else group[el.dataset.kwField] = el.value;
      }
      return;
    }
    if (el.dataset.list) {
      const list = state.values[el.dataset.list];
      if (!Array.isArray(list)) return;
      const index = Number(el.dataset.index);
      if (!list[index]) return;
      if (el.dataset.type === "bool") list[index][el.dataset.key] = el.checked;
      else if (el.dataset.type === "number") list[index][el.dataset.key] = el.value === "" ? "" : Number(el.value);
      else list[index][el.dataset.key] = el.value;
      return;
    }
    const path = el.dataset.path;
    if (!path) return;
    const type = el.dataset.type;
    if (type === "bool") {
      state.values[path] = el.checked;
    } else if (type === "idlist") {
      const list = Array.isArray(state.values[path]) ? state.values[path].slice() : [];
      const value = el.dataset.value;
      const index = list.map(String).indexOf(String(value));
      if (el.checked && index < 0) list.push(value);
      if (!el.checked && index >= 0) list.splice(index, 1);
      state.values[path] = list;
    } else if (type === "number") {
      state.values[path] = el.value === "" ? "" : Number(el.value);
    } else {
      state.values[path] = el.value;
    }
  }

  function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "save-keywords") { saveKeywords(button); return; }
    if (action === "kw-add-group") {
      if (!state.keywords) return;
      state.keywords.groups.push({ alias: "", max_count: 0, items: [] });
      drawKeywords();
      return;
    }
    if (action === "kw-remove-group") {
      if (!state.keywords) return;
      state.keywords.groups.splice(Number(button.dataset.index), 1);
      drawKeywords();
      return;
    }
    if (action === "kw-up" || action === "kw-down") {
      if (!state.keywords) return;
      const list = state.keywords.groups;
      const index = Number(button.dataset.index);
      const target = action === "kw-up" ? index - 1 : index + 1;
      if (target < 0 || target >= list.length) return;
      const temp = list[index];
      list[index] = list[target];
      list[target] = temp;
      drawKeywords();
      return;
    }
    if (action === "save-config") { saveConfig(button); return; }
    if (action === "reload-view") { go(state.view); return; }
    if (action === "refresh-overview") { reloadConfig().then(() => go("overview")).catch((err) => toast(err.message, "err")); return; }
    if (action === "run-kind") { startRun(button.dataset.kind || "run"); return; }
    if (action === "stop-run") { stopRun(); return; }
    if (action === "refresh-logs") { refreshRun(); return; }
    if (action === "go") { go(button.dataset.view); return; }
    if (action === "secret-clear") {
      const path = button.dataset.path;
      state.values[path] = "__CLEAR__";
      const input = button.parentElement.querySelector("input");
      if (input) { input.value = ""; input.placeholder = "保存后将清除"; }
      return;
    }
    if (action === "list-add") {
      const path = button.dataset.path;
      const field = findField(path);
      if (!field) return;
      const list = Array.isArray(state.values[path]) ? state.values[path] : [];
      const item = {};
      (field.item_fields || []).forEach((sub) => {
        if (sub.type === "bool") item[sub.path] = sub.default !== undefined ? sub.default : true;
        else if (sub.type === "number") item[sub.path] = "";
        else item[sub.path] = "";
      });
      list.push(item);
      state.values[path] = list;
      renderGroup(state.view);
      return;
    }
    if (action === "list-remove") {
      const path = button.dataset.path;
      const list = state.values[path] || [];
      list.splice(Number(button.dataset.index), 1);
      state.values[path] = list;
      renderGroup(state.view);
      return;
    }
    if (action === "list-up" || action === "list-down" || action === "order-up" || action === "order-down") {
      const path = button.dataset.path;
      const list = state.values[path] || [];
      const index = Number(button.dataset.index);
      const target = action.endsWith("up") ? index - 1 : index + 1;
      if (target < 0 || target >= list.length) return;
      const temp = list[index];
      list[index] = list[target];
      list[target] = temp;
      state.values[path] = list;
      renderGroup(state.view);
      return;
    }
    if (action === "save-file") { saveFile(button); return; }
    if (action === "preview-keywords") { previewKeywords(); return; }
    if (action === "save-settings") { saveSettings(button); return; }
    if (action === "save-https") { saveHttps(button); return; }
    if (action === "check-https") { checkHttps(button); return; }
    if (action === "change-password") { changePassword(button); return; }
    if (action === "view-log") { viewLog(button.dataset.name); return; }
    if (action === "open-file") { openFile(button.dataset.name); return; }
    if (action === "refresh-reports") { renderReports(); return; }
  }

  function findField(path) {
    for (const group of (state.schema && state.schema.groups) || []) {
      const field = group.fields.find((item) => item.path === path);
      if (field) return field;
    }
    return null;
  }

  async function saveConfig(button) {
    if (state.busy) return;
    state.busy = true;
    if (button) { button.disabled = true; button.textContent = "保存中..."; }
    try {
      await api("/api/config", { method: "PUT", body: { values: state.values } });
      state.errors = {};
      await reloadConfig();
      toast("配置已保存", "ok");
      renderGroup(state.view);
    } catch (err) {
      state.errors = (err.data && err.data.errors) || {};
      toast(err.message, "err");
      renderGroup(state.view);
      const first = document.querySelector(".field-error");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      state.busy = false;
      if (button) { button.disabled = false; button.textContent = "保存配置"; }
    }
  }

  /* ---------------- 关键词 ---------------- */

  async function renderKeywords() {
    $("#page-actions").innerHTML = pageAction("保存关键词", "save-keywords", "", true);
    try {
      const result = await api("/api/keywords");
      state.keywords = result.data;
      state.errors = {};
      drawKeywords();
    } catch (err) {
      $("#content").innerHTML = '<div class="card"><div class="empty">' + esc(err.message) + "</div></div>";
    }
  }

  function drawKeywords() {
    const data = state.keywords;
    if (!data) return;
    const errors = state.errors || {};
    const stats = data.stats || { groups: 0, items: 0, filters: 0 };
    let html = '<div class="card"><div class="card-head"><h2>关键词规则</h2><span class="badge info">' + stats.groups + " 组 · " + stats.items + " 词 · " + stats.filters + " 全局过滤</span></div>";
    html += '<div class="sub">保存到 config/frequency_words.txt，保存前自动备份，下一次采集生效。</div>';
    if (errors.groups) html += '<div class="field-error">' + esc(errors.groups) + "</div>";
    html += '<div class="note info"><span>i</span><span>普通词任意命中；+ 必须词需同组全部命中；! 过滤词对所有标题生效；/正则/ 按正则匹配；=> 设置报告中的显示别名。</span></div>';
    html += '<div class="field"><div class="field-label">全局过滤词</div><div class="field-help">每行一个，命中的标题直接丢弃（优先级最高），支持 /正则/ 与 => 别名。</div>';
    html += '<textarea class="code" style="min-height:110px" data-kw-field="global">' + esc((data.global_filters || []).join("\n")) + "</textarea>";
    if (errors.global_filters) html += '<div class="field-error">' + esc(errors.global_filters) + "</div>";
    html += "</div></div>";

    (data.groups || []).forEach((group, index) => {
      html += '<div class="card kw-group"><div class="card-head"><h2>词组 ' + (index + 1) + (group.alias ? " · " + esc(group.alias) : "") + '</h2><span class="object-actions">';
      html += '<button class="btn btn-small" data-action="kw-up" data-index="' + index + '"' + (index === 0 ? " disabled" : "") + ">↑</button>";
      html += '<button class="btn btn-small" data-action="kw-down" data-index="' + index + '"' + (index === data.groups.length - 1 ? " disabled" : "") + ">↓</button>";
      html += '<button class="btn btn-small btn-danger" data-action="kw-remove-group" data-index="' + index + '">删除</button></span></div>';
      html += '<div class="object-grid">';
      html += '<div><label>组别名（报告中的分组标题）</label><input type="text" data-kw-group="' + index + '" data-kw-field="alias" value="' + esc(group.alias || "") + '" placeholder="例如 科技 / 中国"></div>';
      html += '<div><label>最大条数（0 表示不限）</label><input type="number" min="0" max="999" data-kw-group="' + index + '" data-kw-field="max_count" value="' + esc(group.max_count || 0) + '"></div>';
      html += '<div class="full"><label>词条（每行一个，支持 + ! /正则/ => 别名）</label><textarea class="code" style="min-height:140px" data-kw-group="' + index + '" data-kw-field="items" placeholder="国产&#10;中国&#10;+制造">' + esc((group.items || []).join("\n")) + "</textarea></div>";
      const groupError = errors["groups." + index + ".items"] || errors["groups." + index + ".alias"] || errors["groups." + index + ".max_count"];
      if (groupError) html += '<div class="field-error" style="grid-column:1/-1">' + esc(groupError) + "</div>";
      html += "</div></div>";
    });

    html += '<div class="card"><div class="quick-actions">' + pageAction("+ 添加词组", "kw-add-group") + "</div></div>";
    const warningText = data.warnings && data.warnings.length ? data.warnings.join("；") : "每组之间会自动用空行分隔。";
    html += '<div class="save-bar"><span class="small muted">' + esc(warningText) + '</span><span class="quick-actions">' + pageAction("重新加载", "reload-view") + pageAction("保存关键词", "save-keywords", "", true) + "</span></div>";
    $("#content").innerHTML = html;
    bindContent();
    $("#page-actions").innerHTML = pageAction("保存关键词", "save-keywords", "", true);
  }

  async function saveKeywords(button) {
    const data = state.keywords;
    if (!data) return;
    const payload = {
      groups: (data.groups || []).map((group) => ({
        alias: group.alias || "",
        max_count: Number(group.max_count) || 0,
        items: (group.items || []).map((item) => String(item)).filter((item) => item.trim()),
      })),
      global_filters: (data.global_filters || []).map((item) => String(item)).filter((item) => item.trim()),
    };
    if (button) { button.disabled = true; button.textContent = "保存中..."; }
    try {
      const result = await api("/api/keywords", { method: "PUT", body: payload });
      state.errors = {};
      state.keywords = (await api("/api/keywords")).data;
      toast("关键词已保存" + (result.stats ? "（" + result.stats.groups + " 组 / " + result.stats.items + " 词）" : ""), "ok");
      drawKeywords();
    } catch (err) {
      state.errors = (err.data && err.data.errors) || {};
      toast(err.message, "err");
      drawKeywords();
    } finally {
      if (button) { button.disabled = false; button.textContent = "保存关键词"; }
    }
  }

  /* ---------------- 运行 ---------------- */

  function renderRun() {
    const status = state.status || {};
    $("#page-actions").innerHTML = pageAction("立即运行", "run-kind", 'data-kind="run"', true) + pageAction("刷新", "refresh-logs");
    const last = status.last_run;
    let html = '<div class="card"><div class="card-head"><h2>运行控制</h2>' + statusBadge(status) + '</div><div class="sub">执行 <code>python -m trendradar</code>，输出写入 data/logs。</div>';
    html += '<div class="quick-actions">' + pageAction("采集 / 分析 / 推送", "run-kind", 'data-kind="run"', true) + pageAction("测试通知", "run-kind", 'data-kind="test-notification"') + pageAction("配置体检", "run-kind", 'data-kind="doctor"') + pageAction("停止当前任务", "stop-run") + "</div>";
    html += '<dl class="kv" style="margin-top:16px">';
    html += "<dt>当前状态</dt><dd>" + (status.running ? "运行中（" + esc(status.kind || "") + "，已 " + esc(status.elapsed || 0) + " 秒）" : "空闲") + "</dd>";
    html += "<dt>上次运行</dt><dd>" + (last ? esc(last.started_at || "-") + " → " + esc(last.finished_at || "进行中") + (last.ok === true ? ' <span class="badge ok">成功</span>' : last.ok === false ? ' <span class="badge err">失败（退出码 ' + esc(last.exit_code) + '）</span>' : "") : "从未运行") + "</dd>";
    html += "<dt>计划</dt><dd>" + esc((status.settings && status.settings.run_mode) || "-") + " · " + esc((status.settings && status.settings.cron) || "-") + " · 下次 " + esc((status.settings && status.settings.next_run) || "未安排") + "</dd>";
    html += "</dl></div>";

    html += '<div class="card"><div class="log-meta"><h2 style="margin:0">实时日志</h2><span class="small muted" id="log-name"></span></div><pre class="log-view" id="run-log">点击「刷新」加载日志</pre></div>';

    html += '<div class="card"><div class="card-head"><h2>历史日志</h2></div><div class="sub">最近 60 次运行</div>';
    const logs = (state.overview && state.overview.logs) || [];
    if (logs.length) {
      html += '<div class="table-wrap"><table><thead><tr><th>文件</th><th>大小</th><th>更新时间</th><th></th></tr></thead><tbody>';
      logs.forEach((log) => {
        html += "<tr><td class=\"mono\">" + esc(log.name) + "</td><td>" + esc(formatSize(log.size)) + "</td><td>" + esc(log.updated_at) + '</td><td><button class="btn btn-small" data-action="view-log" data-name="' + esc(log.name) + '">查看</button></td></tr>';
      });
      html += "</tbody></table></div>";
    } else {
      html += '<div class="empty">暂无运行日志。</div>';
    }
    html += "</div>";
    $("#content").innerHTML = html;
    bindContent();
    refreshRun();
  }

  async function startRun(kind) {
    try {
      await api("/api/run", { method: "POST", body: { kind: kind } });
      toast("任务已启动", "ok");
      if (state.view !== "run") go("run"); else refreshRun();
      startPolling();
    } catch (err) {
      toast(err.message, "err");
    }
  }

  async function stopRun() {
    try {
      await api("/api/run/stop", { method: "POST", body: {} });
      toast("已请求停止", "ok");
      setTimeout(refreshRun, 800);
    } catch (err) {
      toast(err.message, "err");
    }
  }

  async function refreshRun() {
    try {
      const result = await api("/api/run/status");
      state.status = result.data;
      if (state.view === "run") {
        const log = await api("/api/run/log?lines=400");
        const pre = $("#run-log");
        if (pre) {
          pre.textContent = log.data.content || "暂无日志输出";
          pre.scrollTop = pre.scrollHeight;
        }
        const nameEl = $("#log-name");
        if (nameEl) nameEl.textContent = log.data.path || "";
      }
      updateStatusBadge();
    } catch (err) {
      if (state.view === "run") toast(err.message, "err");
    }
  }

  async function viewLog(name) {
    try {
      const result = await api("/api/log?lines=800&name=" + encodeURIComponent(name));
      const pre = $("#run-log");
      if (pre) {
        pre.textContent = result.data.content || "（空日志）";
        pre.scrollTop = pre.scrollHeight;
      }
      const nameEl = $("#log-name");
      if (nameEl) nameEl.textContent = name;
      const logCard = pre && pre.closest(".card");
      if (logCard) logCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      toast(err.message, "err");
    }
  }

  function updateStatusBadge() {
    if (state.view === "overview") {
      const el = document.querySelector(".stat .status-badge-slot");
      if (el) el.innerHTML = statusBadge(state.status);
    }
  }

  function startPolling() {
    if (state.pollTimer) return;
    state.pollTimer = setInterval(() => {
      if (state.view !== "run" && state.view !== "overview") return;
      refreshRun();
    }, 3000);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  /* ---------------- 报告 ---------------- */

  async function renderReports() {
    $("#page-actions").innerHTML = pageAction("刷新", "refresh-reports");
    try {
      const result = await api("/api/reports");
      const reports = result.data || [];
      let html = '<div class="card"><div class="card-head"><h2>历史报告</h2><span class="badge info">' + reports.length + ' 份</span></div><div class="sub">来自 output/html，点击打开原始报告页面。</div>';
      if (!reports.length) {
        html += '<div class="empty">还没有报告。运行一次并确保「生成 HTML 报告」开启。</div>';
      } else {
        html += '<div class="table-wrap"><table><thead><tr><th>日期</th><th>文件</th><th>大小</th><th>更新时间</th><th></th></tr></thead><tbody>';
        reports.forEach((report) => {
          html += "<tr><td>" + esc(report.date || "-") + '</td><td class="mono">' + esc(report.path) + "</td><td>" + esc(formatSize(report.size)) + "</td><td>" + esc(report.updated_at) + '</td><td><a class="btn btn-small" href="' + reportUrl(report.path) + '" target="_blank" rel="noopener">打开</a></td></tr>';
        });
        html += "</tbody></table></div>";
      }
      html += "</div>";
      $("#content").innerHTML = html;
      bindContent();
    } catch (err) {
      $("#content").innerHTML = '<div class="card"><div class="empty">' + esc(err.message) + "</div></div>";
    }
  }

  /* ---------------- 文件编辑 ---------------- */

  async function renderFiles() {
    const content = $("#content");
    content.innerHTML = '<div class="loading"><span class="spinner"></span>加载文件列表...</div>';
    try {
      const result = await api("/api/files");
      state.files = result.data || [];
      let html = '<div class="file-layout"><div class="file-list" id="file-list">';
      state.files.forEach((file) => {
        html += '<button data-action="open-file" data-name="' + esc(file.name) + '"' + (state.file && state.file.name === file.name ? ' class="active"' : "") + ">" + esc(file.label) + '<span class="meta">' + esc(file.path) + " · " + esc(file.updated_at || "未修改") + "</span></button>";
      });
      html += '</div><div class="card" id="editor-card">';
      if (state.file) {
        html += editorHtml(state.file);
      } else {
        html += '<div class="empty">从左侧选择一个文件开始编辑。</div>';
      }
      html += "</div></div>";
      content.innerHTML = html;
      bindContent();
    } catch (err) {
      content.innerHTML = '<div class="card"><div class="empty">' + esc(err.message) + "</div></div>";
    }
  }

  function editorHtml(file) {
    const isKeyword = file.kind === "keyword";
    return '<div class="editor-head"><div><h2 style="margin:0">' + esc(file.label) + '</h2><div class="small muted mono">' + esc(file.path) + " · " + esc(file.updated_at || "") + '</div></div><div class="quick-actions">' +
      (isKeyword ? pageAction("解析预览", "preview-keywords") : "") + pageAction("保存文件", "save-file", "", true) + "</div></div>" +
      '<textarea class="code" id="file-editor" spellcheck="false">' + esc(file.content) + "</textarea>" +
      '<div id="keyword-preview" class="preview-box hidden"></div>';
  }

  async function openFile(name) {
    try {
      const result = await api("/api/file?name=" + encodeURIComponent(name));
      state.file = result.data;
      renderFiles();
    } catch (err) {
      toast(err.message, "err");
    }
  }

  async function saveFile(button) {
    if (!state.file) return;
    const editor = $("#file-editor");
    if (!editor) return;
    button.disabled = true;
    button.textContent = "保存中...";
    try {
      await api("/api/file", { method: "PUT", body: { name: state.file.name, content: editor.value } });
      state.file.content = editor.value;
      toast("文件已保存", "ok");
      await reloadConfig();
      renderFiles();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      button.disabled = false;
      button.textContent = "保存文件";
    }
  }

  async function previewKeywords() {
    const editor = $("#file-editor");
    if (!editor) return;
    try {
      const result = await api("/api/keywords/preview", { method: "POST", body: { content: editor.value } });
      const data = result.data;
      const box = $("#keyword-preview");
      let html = "<h3>解析结果</h3>";
      if (data.errors && data.errors.length) {
        data.errors.forEach((error) => { html += noteHtml({ level: "warn", text: error }); });
      }
      html += '<div class="small muted">共 ' + (data.groups || []).length + " 个词组，" + (data.global_filters || []).length + " 个全局过滤词。</div>";
      (data.groups || []).forEach((group) => {
        html += '<div style="margin-top:10px"><strong>' + esc(group.title) + '</strong> <span class="badge muted">' + group.count + " 词</span><div class=\"chips\" style=\"margin-top:5px\">";
        group.words.forEach((word) => { html += '<span class="chip">' + esc(word) + "</span>"; });
        html += "</div></div>";
      });
      if ((data.global_filters || []).length) {
        html += '<div style="margin-top:10px"><strong>全局过滤</strong><div class="chips" style="margin-top:5px">';
        data.global_filters.forEach((word) => { html += '<span class="chip">' + esc(word) + "</span>"; });
        html += "</div></div>";
      }
      box.innerHTML = html;
      box.classList.remove("hidden");
    } catch (err) {
      toast(err.message, "err");
    }
  }

  /* ---------------- 系统设置 ---------------- */

  function renderSettings() {
    const settings = state.settings || {};
    const security = (state.overview && state.overview.security) || {};
    const https = state.https || {};
    const allow = (settings.allow_ips || []).join(", ");
    $("#page-actions").innerHTML = pageAction("保存设置", "save-settings", "", true);

    let html = '<div class="card"><div class="card-head"><h2>定时计划</h2><span class="badge ' + (settings.cron_valid === false ? "err" : "ok") + '">' + esc(settings.cron_desc || "") + "</span></div><div class=\"sub\">内置调度器每 20 秒检查一次，保存后立即生效，无需重启。</div>";
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">cron 表达式</div><div class="field-help">5 段格式：分 时 日 月 周。例如 <code>*/30 * * * *</code> 每 30 分钟，<code>0 9 * * *</code> 每天 9 点。</div></div><div class="field-input"><input type="text" id="set-cron" value="' + esc(settings.cron || "") + '" placeholder="*/30 * * * *">' + (settings.cron_error ? '<div class="field-error">' + esc(settings.cron_error) + "</div>" : "") + "</div></div></div>";
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">运行模式</div><div class="field-help">关闭计划后仍可从概览或运行页手动执行。</div></div><div class="field-input"><select id="set-run-mode"><option value="cron"' + (settings.run_mode === "cron" ? " selected" : "") + '>按 cron 自动运行</option><option value="off"' + (settings.run_mode !== "cron" ? " selected" : "") + ">仅手动运行</option></select></div></div></div>";
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">启动时立即运行一次</div><div class="field-help">服务启动后触发一次采集；频繁重启时可能重复执行。</div></div><div class="field-input"><label class="switch"><input type="checkbox" id="set-immediate"' + (settings.immediate_run ? " checked" : "") + "><span></span></label></div></div></div>";
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">下次执行</div><div class="field-help">按当前表达式推算。</div></div><div class="field-input mono">' + esc(settings.next_run || "未安排") + "</div></div></div>";
    html += "</div>";

    html += '<div class="card"><div class="card-head"><h2>访问控制</h2><span class="badge ' + (security.tls ? "ok" : "warn") + '">' + (security.tls ? "HTTPS" : "HTTP") + "</span></div><div class=\"sub\">限制哪些 IP 可以打开管理台；留空表示不限制。支持单个 IP 或 CIDR 网段。</div>";
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">IP 白名单</div><div class="field-help">例如 <code>203.0.113.5</code> 或 <code>203.0.113.0/24</code>，多个用逗号分隔。当前访问 IP：<code>' + esc((state.overview && state.overview.security && state.overview.security.current_ip) || "") + "</code></div></div><div class=\"field-input\"><input type=\"text\" id=\"set-allow-ips\" value=\"" + esc(allow) + '" placeholder="留空不限制"></div></div></div>';
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">当前监听</div><div class="field-help">修改监听地址或端口需要调整服务启动参数并重启。</div></div><div class="field-input mono">' + esc(security.host || "") + ":" + esc(security.port || "") + "</div></div></div>";
    if (!security.tls) {
      html += noteHtml({ level: "warn", text: "当前使用 HTTP 明文访问。若长期在公网使用，建议绑定域名并配置 TLS 证书，或在云安全组中限制来源 IP。" });
    }
    html += "</div>";

    const cert = https.cert;
    const current = https.current || {};
    const certBadge = https.valid
      ? '<span class="badge ok">证书可用</span>'
      : '<span class="badge warn">未启用 / 待配置</span>';
    html += '<div class="card"><div class="card-head"><h2>域名与 HTTPS</h2>' + certBadge + '</div><div class="sub">配置访问域名与证书后点「保存并应用」，服务会在约 5 秒内重启，HTTP 自动跳转到 HTTPS。</div>';
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">访问域名</div><div class="field-help">例如 td.example.com；该域名的 A 记录需要指向本服务器。</div></div><div class="field-input"><input type="text" id="set-domain" value="' + esc(https.domain || "") + '" placeholder="td.example.com"></div></div></div>';
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">启用 HTTPS</div><div class="field-help">开启后管理台使用 HTTPS，HTTP 80 自动 301 跳转到该域名。</div></div><div class="field-input"><label class="switch"><input type="checkbox" id="set-https-enabled"' + (https.https_enabled ? " checked" : "") + "><span></span></label></div></div></div>";
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">证书文件</div><div class="field-help">PEM 格式，通常为 fullchain.pem；支持项目内相对路径。</div></div><div class="field-input"><input type="text" id="set-https-cert" value="' + esc(https.https_cert || "data/tls/fullchain.pem") + '"></div></div></div>';
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">私钥文件</div><div class="field-help">PEM 格式，通常为 privkey.pem；留空会导致启用失败。</div></div><div class="field-input"><input type="text" id="set-https-key" value="' + esc(https.https_key || "data/tls/privkey.pem") + '"></div></div></div>';
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">证书状态</div><div class="field-help">' + (https.errors && https.errors.length ? esc(https.errors.join("；")) : "证书与私钥校验通过") + '</div></div><div class="field-input" style="max-width:520px"><dl class="kv" style="grid-template-columns:80px 1fr">';
    html += "<dt>当前访问</dt><dd>" + esc((current.scheme || "http") + "://" + (current.host || location.host)) + "</dd>";
    html += "<dt>域名匹配</dt><dd>" + (https.domain_match ? '<span class="badge ok">匹配</span>' : '<span class="badge warn">未匹配</span>') + "</dd>";
    html += "<dt>有效期</dt><dd>" + esc(cert && cert.not_after ? cert.not_after + (cert.days_left != null ? "（剩余 " + cert.days_left + " 天）" : "") : "未检测到证书") + "</dd>";
    html += '<dt>覆盖域名</dt><dd class="mono">' + esc(cert && cert.sans && cert.sans.length ? cert.sans.join(", ") : "-") + "</dd>";
    html += "</dl></div></div></div>";
    html += '<div class="save-bar"><span class="small muted">应用后会重启服务并断开当前页面，约 5 秒后用 https 域名重新登录。</span><span class="quick-actions">' + pageAction("检测证书", "check-https") + pageAction("保存并应用", "save-https", "", true) + "</span></div>";
    html += "</div>";

    html += '<div class="card"><div class="card-head"><h2>管理员密码</h2></div><div class="sub">修改后当前会话仍然有效，下次登录使用新密码。</div>';
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">原密码</div></div><div class="field-input"><input type="password" id="old-password" autocomplete="current-password"></div></div></div>';
    html += '<div class="field"><div class="field-row"><div class="field-label-wrap"><div class="field-label">新密码</div><div class="field-help">至少 10 位，建议包含大小写字母、数字和符号。</div></div><div class="field-input"><input type="password" id="new-password" autocomplete="new-password"></div></div></div>';
    html += '<div class="save-bar"><span></span><button class="btn btn-primary" data-action="change-password">更新密码</button></div>';
    html += "</div>";

    $("#content").innerHTML = html;
    bindContent();
  }

  async function saveSettings(button) {
    const cron = $("#set-cron").value.trim();
    const runMode = $("#set-run-mode").value;
    const immediate = $("#set-immediate").checked;
    const allowRaw = $("#set-allow-ips").value.trim();
    const allow = allowRaw ? allowRaw.split(/[,，]/).map((item) => item.trim()).filter(Boolean) : [];
    button.disabled = true;
    button.textContent = "保存中...";
    try {
      await api("/api/settings", { method: "PUT", body: { cron: cron, run_mode: runMode, immediate_run: immediate, allow_ips: allow } });
      await reloadConfig();
      state.settings = (state.overview && state.overview.settings) || state.settings;
      const result = await api("/api/settings");
      state.settings = result.data;
      toast("设置已保存", "ok");
      renderSettings();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      button.disabled = false;
      button.textContent = "保存设置";
    }
  }

  async function saveHttps(button) {
    const domain = $("#set-domain").value.trim();
    const enabled = $("#set-https-enabled").checked;
    const cert = $("#set-https-cert").value.trim();
    const key = $("#set-https-key").value.trim();
    button.disabled = true;
    button.textContent = "应用中...";
    try {
      const result = await api("/api/https", {
        method: "PUT",
        body: {
          domain: domain,
          https_enabled: enabled,
          https_cert: cert,
          https_key: key,
          apply: true,
        },
      });
      toast(result.restart_scheduled ? "配置已保存，服务将在几秒后重启" : "配置已保存", "ok");
      if (result.restart_scheduled) {
        setTimeout(() => window.location.reload(), 7000);
      }
    } catch (err) {
      const data = err.data || {};
      let detail = data.error || err.message;
      if (Array.isArray(data.errors) && data.errors.length) {
        detail = data.errors.join("；");
      } else if (data.errors && typeof data.errors === "object") {
        detail = Object.values(data.errors).join("；");
      }
      toast(detail, "err");
    } finally {
      button.disabled = false;
      button.textContent = "保存并应用";
    }
  }

  async function checkHttps(button) {
    button.disabled = true;
    try {
      const result = await api("/api/https");
      state.https = result.data;
      toast(result.data.valid ? "证书校验通过" : "证书尚未就绪", result.data.valid ? "ok" : "err");
      renderSettings();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      button.disabled = false;
    }
  }

  async function changePassword(button) {
    const oldPassword = $("#old-password").value;
    const newPassword = $("#new-password").value;
    button.disabled = true;
    try {
      await api("/api/password", { method: "POST", body: { old_password: oldPassword, new_password: newPassword } });
      $("#old-password").value = "";
      $("#new-password").value = "";
      toast("密码已更新", "ok");
    } catch (err) {
      toast(err.message, "err");
    } finally {
      button.disabled = false;
    }
  }

  /* ---------------- 启动 ---------------- */

  async function boot() {
    try {
      const session = await api("/api/session");
      state.csrf = session.csrf;
      $("#app-version").textContent = "v" + (session.version || "");
      await loadAll();
      showApp();
      renderNav();
      go("overview");
    } catch (err) {
      showLogin();
    }
  }

  $("#login-form").addEventListener("submit", login);
  $("#logout-btn").addEventListener("click", logout);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#app").classList.contains("hidden")) {
      // 关闭可能展开的提示
      $("#toast").classList.add("hidden");
    }
  });

  boot();
})();