import assert from 'node:assert/strict'
import { act, Component, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EditorProvider, useEditor, type EditorContextValue } from '@/store/editor-store'
import { PushScheduleSection } from '@/components/sections/PushScheduleSection'
import { ProFileFields, ProFileLocation, ProViewToolbar } from '@/components/layout/ProFilePanel'
import { SourceDrawer, SourcePanel } from '@/components/layout/SourceDrawer'
import { SideNav } from '@/components/layout/SideNav'
import { AiSection } from '@/components/sections/AiSection'
import { FilterSection } from '@/components/sections/FilterSection'
import { ReportSection } from '@/components/sections/ReportSection'
import { SourcesSection } from '@/components/sections/SourcesSection'
import { EditorView } from '@codemirror/view'
import { TooltipProvider } from '@/components/ui/primitives'
import { getDefaultFiles } from '@/lib/defaults'
import { AI_PROVIDER_PRESETS, getPersonalSupportUrl } from '@/lib/presets'
import { ChangesDialog } from '@/components/modals/ChangesDialog'
import { ImportSyncDialog } from '@/components/modals/ImportSyncDialog'
import { ReportPreviewPanel } from '@/components/modals/ReportPreviewPanel'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { GuidedTrialFiles } from '@/components/guided/GuidedTrialFiles'
import { OnboardingSection } from '@/components/sections/OnboardingSection'

let editor: EditorContextValue
let root: Root | undefined
let host: HTMLDivElement
let renderError: unknown

function Capture() {
  editor = useEditor()
  return null
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { renderError = error }
  render() { return this.state.failed ? <p>Render failed</p> : this.props.children }
}

async function mount(children?: ReactNode) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  renderError = undefined
  await act(async () => {
    root!.render(<ErrorBoundary><TooltipProvider><EditorProvider><Capture />{children}</EditorProvider></TooltipProvider></ErrorBoundary>)
  })
}

async function unmount() {
  if (root) await act(async () => root!.unmount())
  root = undefined
  host?.remove()
  document.body.replaceChildren()
  editor = undefined as unknown as EditorContextValue
}

function inputText(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const cases: Array<[string, () => Promise<void>]> = [
  ['incomplete source rows keep the report page available and produce a validation issue', async () => {
    const files = getDefaultFiles('zh')
    files['config.yaml'] = 'platforms: { sources: [null] }\nrss: { feeds: [null] }\ndisplay: { standalone: {platforms: [zhihu], rss_feeds: [blog]} }\n'
    localStorage.setItem('tr_studio_v2_files', JSON.stringify(files))
    await mount(<ReportSection />)
    assert.equal(renderError, undefined)
    assert.ok(editor.issues.some((issue) => issue.id === 'invalid-platforms-list'))
  }],
  ['docked source remains reachable when the viewport cannot show a split', async () => {
    await mount(<SourceDrawer />)
    await act(async () => editor.setSourceViewMode('split'))
    assert.ok(host.querySelector('.cm-editor'))
    assert.ok(host.querySelector('div.fixed'))
    // Before edits, Undo and Changes buttons stay progressively hidden
    assert.equal(host.querySelector('button[title="查看改动了什么"]'), null)
    assert.equal(host.querySelector('button[title="撤销"]'), null)
    // Editing reveals Changes and Undo buttons progressively
    await act(async () => editor.setConfigValue(['rss', 'enabled'], false))
    assert.ok(host.querySelector('button[title="查看改动了什么"]'))
    assert.ok(host.querySelector('button[title="撤销"]'))
    assert.ok(host.querySelector('[role="separator"]'))
    const fullBtn = host.querySelector<HTMLButtonElement>('button[aria-label="全屏查看"]')!
    assert.ok(fullBtn)
    await act(async () => fullBtn.click())
    assert.ok(host.querySelector('button[aria-label="退出全屏"]'))
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })))
    assert.ok(host.querySelector('button[aria-label="全屏查看"]'))
  }],
  ['guided progress survives switching modes and reloading', async () => {
    await mount()
    await act(async () => { editor.setActiveSection('sources'); editor.setSourcesSubTab('search') })
    await act(async () => editor.setWorkspaceMode('pro'))
    await act(async () => editor.selectProSection('ai'))
    await act(async () => editor.setWorkspaceMode('guided'))
    assert.equal(editor.activeSection, 'sources')
    assert.equal(editor.sourcesSubTab, 'search')
    await act(async () => window.dispatchEvent(new Event('pagehide')))
    await unmount()
    await mount()
    assert.equal(editor.activeSection, 'sources')
    assert.equal(editor.sourcesSubTab, 'search')
  }],
  ['source selection and form edits share the field without stealing form focus', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    localStorage.setItem('tr_studio_v2_files', JSON.stringify({ ...getDefaultFiles('zh'), 'config.yaml': 'app:\n  timezone: Asia/Shanghai\n' }))
    await mount(<><SourcePanel embedded /><main><ProFileFields /></main></>)
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!
    await act(async () => {
      view.focus()
      view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 3 } })
    })
    assert.equal(host.querySelector('[data-current-field="true"]')?.getAttribute('data-field-path'), '["app","timezone"]')
    const input = host.querySelector<HTMLInputElement>('input[aria-label="app.timezone"]')!
    await act(async () => { input.focus(); inputText(input, 'Asia/Singapore') })
    assert.ok(view.state.doc.toString().includes('Asia/Singapore'))
    assert.equal(document.activeElement, input)
    assert.equal(view.state.doc.lineAt(view.state.selection.main.head).number, 2)
  }],
  ['restoring one change leaves other settings intact and supports undo', async () => {
    await mount(<ChangesDialog request={{ file: 'config.yaml' }} onClose={() => {}} />)
    await act(async () => editor.patchConfigValues([
      { path: ['platforms', 'enabled'], value: false }, { path: ['rss', 'enabled'], value: false },
    ]))
    const row = [...document.querySelectorAll('li')].find((entry) => entry.querySelector('code')?.textContent === 'platforms.enabled')!
    assert.ok(row?.textContent?.includes('跳过所有热榜'))
    await act(async () => row.querySelector<HTMLButtonElement>('button')!.click())
    const confirm = [...document.querySelectorAll('button')].find((button) => button.textContent === '确认恢复')!
    await act(async () => confirm.click())
    assert.equal((editor.configData.platforms as { enabled: boolean }).enabled, true)
    assert.equal((editor.configData.rss as { enabled: boolean }).enabled, false)
    await act(async () => editor.undo())
    assert.equal((editor.configData.platforms as { enabled: boolean }).enabled, false)
  }],
  ['a trial exposes earlier step files and disables copying invalid YAML', async () => {
    await mount(<GuidedTrialFiles section="onboarding" defaultFile="frequency_words.txt" choices={['frequency_words.txt']} inline />)
    await act(async () => editor.setConfigValue(['rss', 'enabled'], false))
    await act(async () => editor.setFileContent('frequency_words.txt', '测试词\n'))
    assert.ok(host.querySelector('[data-select-values*="config.yaml"]'))
    assert.ok(host.textContent?.includes('2 个文件'))
    await act(async () => editor.setFileContent('config.yaml', 'app: [invalid'))
    const findCopyBtn = () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('复制文件'))
    assert.equal(findCopyBtn()?.disabled, true)
    const repair = [...host.querySelectorAll('button')].find((button) => button.textContent === '修正源码')!
    await act(async () => repair.click())
    assert.equal(editor.sourceViewMode, 'drawer')
    assert.equal(editor.activeSourceFile, 'config.yaml')
    await act(async () => editor.setFileContent('timeline.yaml', 'custom: { day_plans: { day: { periods: null } } }'))
    assert.equal(findCopyBtn()?.disabled, true)
  }],
  ['failed local persistence is reported without losing the in-memory draft', async () => {
    await mount()
    await act(async () => editor.setConfigValue(['rss', 'enabled'], false))
    const prototype = Object.getPrototypeOf(localStorage)
    const original = prototype.setItem
    prototype.setItem = () => { throw new Error('Storage full') }
    try {
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })))
      assert.equal(editor.persistenceError, true)
      assert.equal((editor.configData.rss as { enabled: boolean }).enabled, false)
      assert.ok(!editor.toasts.some((toast) => toast.message.includes('已保存')))
    } finally { prototype.setItem = original }
    await act(async () => window.dispatchEvent(new Event('pagehide')))
    assert.equal(editor.persistenceError, false)
  }],
  ['corrupt metadata and a scalar configuration remain recoverable', async () => {
    localStorage.setItem('tr_studio_v2_meta', 'null')
    localStorage.setItem('tr_studio_v2_files', JSON.stringify({ 'config.yaml': 'not a mapping' }))
    await mount()
    assert.equal(renderError, undefined)
    assert.ok(editor.configError)
    await act(async () => editor.resetFile('config.yaml'))
    assert.equal(editor.configError, null)
  }],
  ['changing theme preserves the source selection, focus and linked field', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    const files = { ...getDefaultFiles('zh'), 'config.yaml': 'app:\n  timezone: Asia/Shanghai\nrss:\n  enabled: true\n' }
    localStorage.setItem('tr_studio_v2_files', JSON.stringify(files))
    await mount(<SourcePanel embedded />)
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!
    await act(async () => {
      view.focus()
      view.dispatch({ selection: { anchor: view.state.doc.line(4).from + 3 } })
    })
    const anchor = view.state.selection.main.head
    assert.deepEqual(editor.proPath, ['rss', 'enabled'])
    await act(async () => editor.toggleTheme())
    const next = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!
    assert.equal(next.state.selection.main.head, anchor)
    assert.equal(next.hasFocus, true)
    assert.deepEqual(editor.proPath, ['rss', 'enabled'])
  }],
  ['undo in the source editor keeps the form on the caret field', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    const files = { ...getDefaultFiles('zh'), 'config.yaml': 'app:\n  timezone: Asia/Shanghai\nrss:\n  enabled: true\n' }
    localStorage.setItem('tr_studio_v2_files', JSON.stringify(files))
    await mount(<SourcePanel embedded />)
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!
    await act(async () => {
      view.focus()
      view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 3 } })
      view.dispatch({ changes: { from: 0, insert: '# note\n\n' } })
    })
    assert.deepEqual(editor.proPath, ['app', 'timezone'])
    const undoButton = host.querySelector<HTMLButtonElement>('button[title="撤销"]')!
    await act(async () => { undoButton.focus(); undoButton.click() })
    assert.equal(view.state.doc.lineAt(view.state.selection.main.head).number, 2)
    assert.equal(editor.proPosition.line, 2)
    assert.deepEqual(editor.proPath, ['app', 'timezone'])
  }],
  ['incomplete timeline plans keep the settings page available', async () => {
    const files = getDefaultFiles('zh')
    files['config.yaml'] = 'schedule: { enabled: true, preset: custom }\n'
    files['timeline.yaml'] = 'custom:\n  periods: { draft: null }\n  day_plans:\n    monday:\n      periods:\n  week_map: { 1: monday }\n'
    localStorage.setItem('tr_studio_v2_files', JSON.stringify(files))
    await mount(<PushScheduleSection />)
    assert.equal(renderError, undefined)
    assert.ok(host.textContent?.includes('时间线'))
  }],
  ['imported baselines survive a page reload along with the draft', async () => {
    await mount()
    const imported = 'app:\n  timezone: Europe/London\n'
    await act(async () => editor.loadFiles({ 'config.yaml': imported }, true))
    await act(async () => editor.setConfigValue(['app', 'timezone'], 'Asia/Singapore'))
    await act(async () => window.dispatchEvent(new Event('pagehide')))
    await unmount()
    await mount()
    assert.equal(editor.baselineFiles['config.yaml'], imported)
    assert.ok(editor.files['config.yaml'].includes('Asia/Singapore'))
  }],
  ['YAML fields can collapse after source navigation', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    await mount(<main><ProFileFields /></main>)
    await act(async () => editor.openSourceTarget({ file: 'config.yaml', path: ['web_search'] }))
    const row = host.querySelector<HTMLElement>(`[data-field-path='["web_search"]']`)
    assert.ok(row)
    const toggle = row.querySelector<HTMLButtonElement>('button[aria-expanded]')!
    await act(async () => toggle.click())
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(host.querySelector(`[data-field-path='["web_search","enabled"]']`), null)
  }],
  ['pro mode defaults to focused fields on file switch and opens matching visual area when switching to visual view', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    const files = {
      ...getDefaultFiles('zh'),
      'config.yaml': 'notification:\n  channels:\n    telegram:\n      bot_token: ""\nai_filter:\n  batch_size: 200\n',
    }
    localStorage.setItem('tr_studio_v2_files', JSON.stringify(files))
    await mount(<SourcePanel embedded />)
    assert.equal(editor.proView, 'file')

    // Switching files on the left stays in focused fields ('file') without disorienting visual jumps
    await act(async () => editor.selectProFile('search_queries.txt'))
    assert.equal(editor.activeSourceFile, 'search_queries.txt')
    assert.equal(editor.proView, 'file')

    // Clicking Visual ('features') maps current file/block to its visual section & tab
    await act(async () => editor.setProView('features'))
    assert.equal(editor.proView, 'features')
    assert.equal(editor.activeSection, 'sources')
    assert.equal(editor.sourcesSubTab, 'search')

    // Selecting config.yaml returns cleanly to focused fields; clicking Visual syncs cursor inside visual view
    await act(async () => editor.selectProFile('config.yaml'))
    assert.equal(editor.proView, 'file')
    await act(async () => editor.setProView('features'))
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!
    await act(async () => {
      view.focus()
      view.dispatch({ selection: { anchor: view.state.doc.line(4).from + 6 } })
    })
    assert.equal(editor.proView, 'features')
    assert.equal(editor.activeSection, 'push')
    assert.equal(editor.visualFocusTarget?.channel, 'telegram')

    await act(async () => {
      view.dispatch({ selection: { anchor: view.state.doc.line(6).from + 4 } })
    })
    assert.equal(editor.proView, 'features')
    assert.equal(editor.activeSection, 'filter')
    assert.equal(editor.visualFocusTarget?.filterMode, 'ai')
  }],
  ['onboarding renders guided pipeline and resume banner in guided mode, while standalone region stays collapsed by default', async () => {
    const edited = { ...getDefaultFiles('zh'), 'frequency_words.txt': 'DeepSeek\n' }
    localStorage.setItem('tr_studio_v2_files', JSON.stringify(edited))
    localStorage.setItem('tr_editor_guided_progress', JSON.stringify({ section: 'filter', tab: 'hotlist' }))
    await mount(<><OnboardingSection /><ReportSection /></>)
    assert.equal(renderError, undefined)
    assert.ok(host.textContent?.includes('已恢复你上次保存的本地草稿'))
    assert.ok(host.textContent?.includes('配置独立源'))
  }],
  ['AI presets keep 3 core 1x3 options, support links target #personal-support in zh/en, and line jump shows full localized label', async () => {
    assert.deepEqual(AI_PROVIDER_PRESETS.map((p) => p.id), ['deepseek', 'ollama', 'relay'])
    assert.equal(getPersonalSupportUrl('zh'), 'https://trendradar.sandev.cc/zh/credits/#personal-support')
    assert.equal(getPersonalSupportUrl('en'), 'https://trendradar.sandev.cc/en/credits/#personal-support')

    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    await mount(<><SideNav /><ProFileLocation /><AiSection /></>)
    assert.equal(renderError, undefined)
    assert.equal(host.querySelectorAll('select').length, 0)
    assert.equal(host.querySelectorAll('.cm-editor').length, 0)
    assert.ok(host.textContent?.includes('跳转至第'))
    const supportLink = [...host.querySelectorAll('a')].find((a) => a.textContent?.includes('支持项目'))!
    assert.equal(supportLink.getAttribute('href'), 'https://trendradar.sandev.cc/zh/credits/#personal-support')
    await act(async () => editor.setLang('en'))
    assert.ok(host.textContent?.includes('Jump to Line'))
    assert.equal(supportLink.getAttribute('href'), 'https://trendradar.sandev.cc/en/credits/#personal-support')
  }],
  ['top bar keeps Pro Config menu unchanged while Guided moves Config hover menu to SideNav above Support', async () => {
    await mount(<><TopNavBar mobileNavOpen={false} onToggleMobileNav={() => {}} /><SideNav /><ImportSyncDialog /></>)
    assert.equal(renderError, undefined)

    // Standalone top-right GitHub icon removed; in Guided mode TopNavBar omits Config (moved to SideNav)
    assert.equal(host.querySelector('a[aria-label="TrendRadar GitHub"]'), null)
    const getRightHeaderButtons = () => [...host.querySelectorAll('header button')].map((b) => (b.textContent ?? '').trim())
    const guidedButtons = getRightHeaderButtons()
    assert.equal(guidedButtons.includes('配置'), false, 'Guided TopNavBar should move Config menu to SideNav')
    assert.equal(guidedButtons.includes('导出'), false, 'Export should live inside Config dropdown rather than beside Copy')
    const previewIdx = guidedButtons.findIndex((txt) => txt === '预览')
    const changesIdx = guidedButtons.findIndex((txt) => txt.includes('改动与恢复'))
    const copyIdx = guidedButtons.findIndex((txt) => txt === '复制')
    const langIdx = guidedButtons.findIndex((txt) => txt === '简')
    assert.ok(
      previewIdx >= 0 &&
        changesIdx === previewIdx + 1 &&
        copyIdx === changesIdx + 1 &&
        langIdx > copyIdx,
    )

    // Hovering SideNav 配置 in Guided mode opens the 4-item config menu right above 支持项目
    const sideNavConfigTrigger = host.querySelector<HTMLButtonElement>('aside button[data-config-menu-trigger="sidenav"]')!
    assert.ok(sideNavConfigTrigger)
    await act(async () => {
      sideNavConfigTrigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    const guidedConfigMenuText = document.body.textContent ?? ''
    assert.ok(guidedConfigMenuText.includes('加载官网最新配置'))
    assert.ok(guidedConfigMenuText.includes('导入本地文件'))
    assert.ok(guidedConfigMenuText.includes('导出全部配置'))
    assert.ok(guidedConfigMenuText.includes('保存与切换方案'))
    assert.ok(!guidedConfigMenuText.includes('版本库'))

    // Regression: in Guided mode, clicking "加载官网最新配置" opens the Remote Sync tab (not Local Upload)
    await act(async () => editor.openImportDialog('remote'))
    assert.ok(document.body.textContent?.includes('检查更新'))
    assert.ok(document.body.textContent?.includes('拉取已选'))
    await act(async () => editor.setImportOpen(false))

    // Switching to Pro mode keeps TopNavBar Config -> Preview -> Changes & restore -> Copy unchanged
    await act(async () => editor.setWorkspaceMode('pro'))
    const proButtons = getRightHeaderButtons()
    const proConfigIdx = proButtons.findIndex((txt) => txt === '配置')
    const proPreviewIdx = proButtons.findIndex((txt) => txt === '预览')
    const proChangesIdx = proButtons.findIndex((txt) => txt.includes('改动与恢复'))
    const proCopyIdx = proButtons.findIndex((txt) => txt === '复制')
    assert.ok(
      proConfigIdx >= 0 &&
        proPreviewIdx === proConfigIdx + 1 &&
        proChangesIdx === proPreviewIdx + 1 &&
        proCopyIdx === proChangesIdx + 1,
    )

    // Hovering TopNavBar 配置 in Pro mode opens the 4-item management menu
    const configTrigger = host.querySelector<HTMLButtonElement>('header button[data-config-menu-trigger="topbar"]')!
    assert.ok(configTrigger)
    await act(async () => {
      configTrigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    const configMenuText = document.body.textContent ?? ''
    assert.ok(configMenuText.includes('加载官网最新配置'))
    assert.ok(configMenuText.includes('导入本地文件'))
    assert.ok(configMenuText.includes('导出全部配置'))
    assert.ok(configMenuText.includes('保存与切换方案'))
    assert.ok(!configMenuText.includes('版本库'))

    // Hovering 导航 opens the links menu without clicking
    const navTrigger = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('导航'))!
    assert.equal(navTrigger.getAttribute('aria-expanded'), 'false')
    await act(async () => {
      navTrigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    assert.equal(navTrigger.getAttribute('aria-expanded'), 'true')

    const bodyText = document.body.textContent ?? ''
    assert.ok(!bodyText.includes('外部站点'))
    assert.ok(bodyText.includes('关注作者近况'))
    assert.ok(bodyText.includes('欢迎关注'))
    // GitHub 主页 is placed right below TrendRadar 官网, before sansan 的主页
    assert.ok(bodyText.indexOf('TrendRadar 官网') < bodyText.indexOf('GitHub 主页'))
    assert.ok(bodyText.indexOf('GitHub 主页') < bodyText.indexOf('sansan 的主页'))
    const notesLink = [...document.body.querySelectorAll('a')].find((a) => a.getAttribute('href')?.includes('sandev.cc/zh/notes/'))
    assert.ok(notesLink)

    // Hovering / toggling GitHub 主页 reveals TrendRadar repo + mao-map repo & live browse links (without Releases)
    const githubToggle = document.body.querySelector<HTMLButtonElement>('button[aria-label="展开当前 GitHub 仓库入口"]')!
    assert.ok(githubToggle)
    await act(async () => githubToggle.click())
    const subText = document.body.textContent ?? ''
    assert.ok(subText.includes('TrendRadar 仓库'))
    assert.ok(subText.includes('欢迎 Star'))
    assert.ok(subText.includes('问题与反馈'))
    assert.ok(subText.includes('毛主席足迹地图'))
    assert.ok(subText.includes('在线浏览地图'))
    assert.equal(subText.includes('版本发布'), false)
    const repoLink = [...document.body.querySelectorAll('a')].find((a) => a.getAttribute('href') === 'https://github.com/sansan0/TrendRadar')
    const maoRepoLink = [...document.body.querySelectorAll('a')].find((a) => a.getAttribute('href') === 'https://github.com/sansan0/mao-map')
    const maoSiteLink = [...document.body.querySelectorAll('a')].find((a) => a.getAttribute('href') === 'https://sansan0.github.io/mao-map/')
    assert.ok(repoLink && maoRepoLink && maoSiteLink)

    await act(async () => {
      editor.setConfigOrigin({ kind: 'remote', provider: 'jsdelivr', host: 'fastly.jsdelivr.net', updatedAt: Date.now() - 5 * 60 * 1000 })
      editor.openImportDialog('remote')
    })
    const modalText = document.body.textContent ?? ''
    assert.ok(modalText.includes('jsDelivr 镜像 (fastly.jsdelivr.net)'))
    assert.ok(modalText.includes('5 分钟前'))
    assert.ok(modalText.includes('镜像可能有延迟'))
    assert.ok(!modalText.includes('3 路 jsDelivr'))
    assert.ok(document.body.querySelector('[aria-label="拉取来源说明"]'))
  }],
  ['changes dialog numbers items #N..#1 newest first with timestamps, inline popover confirm, and per-file undo synced to top badge', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    await mount(
      <>
        <TopNavBar mobileNavOpen={false} onToggleMobileNav={() => {}} />
        <ProViewToolbar />
        <SourcePanel embedded />
        <ChangesDialog request={{ file: 'config.yaml' }} onClose={() => {}} />
      </>,
    )
    // ProViewToolbar defaults auto-follow ON and SourcePanel removes redundant Outline button
    assert.equal(editor.proAutoFollow, true)
    assert.ok(host.querySelector('[aria-label="自动跟随左侧滚动"]'))
    assert.equal([...host.querySelectorAll('button')].some((b) => b.textContent?.includes('目录')), false)

    await act(async () => editor.setConfigValue(['platforms', 'enabled'], false))
    await act(async () => editor.patchConfigValues([
      { path: ['ai', 'model'], value: 'openai/deepseek-chat' },
      { path: ['ai', 'api_base'], value: 'https://your-relay.example.com/v1' },
    ]))
    await act(async () => editor.setFileContent('frequency_words.txt', 'DeepSeek\n'))

    // Total changes across all files = 3 in config.yaml + 1 in frequency_words.txt = 4
    assert.equal(editor.totalChangesCount, 4)
    assert.equal(editor.getFileUndoCount('config.yaml'), 2)
    assert.equal(editor.getFileUndoCount('frequency_words.txt'), 1)

    const dialogText = document.body.textContent ?? ''
    assert.ok(dialogText.includes('分 2 次修改（序号越大越新）'))
    assert.ok(dialogText.includes('刚刚'))
    assert.ok(dialogText.includes('同次操作'))

    // Descending sequence numbers #3, #2, #1 from top to bottom
    const seqs = [...document.body.querySelectorAll('[data-change-seq]')].map((el) => el.getAttribute('data-change-seq'))
    assert.deepEqual(seqs, ['#3', '#2', '#1'])

    const codes = [...document.body.querySelectorAll('li code')].map((el) => el.textContent)
    assert.deepEqual(codes, ['ai.model', 'ai.api_base', 'platforms.enabled'])

    // Per-file undo on config.yaml only reverts config.yaml's latest batch, leaving frequency_words.txt intact
    const undoBtn = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.includes('撤回最近一次'))!
    assert.ok(undoBtn.textContent?.includes('2'))
    await act(async () => undoBtn.click())
    assert.equal(editor.getFileUndoCount('config.yaml'), 1)
    assert.equal(editor.files['frequency_words.txt'], 'DeepSeek\n')
    assert.equal(editor.totalChangesCount, 2)
    const remainingSeqs = [...document.body.querySelectorAll('[data-change-seq]')].map((el) => el.getAttribute('data-change-seq'))
    assert.deepEqual(remainingSeqs, ['#1'])

    // Restoring a single file clears ONLY that file's undo/redo history (not recording the reset as an undoable edit)
    await act(async () => editor.resetFile('config.yaml'))
    assert.equal(editor.canUndoFile('config.yaml'), false, 'resetFile should clear undo stack for that file')
    assert.equal(editor.canRedoFile('config.yaml'), false, 'resetFile should clear redo stack for that file')
    assert.equal(editor.getFileUndoCount('config.yaml'), 0)
    assert.equal(editor.getFileUndoCount('frequency_words.txt'), 1, 'resetFile must keep other files undo stack intact')
    assert.equal(
      [...document.body.querySelectorAll('button')].some((b) => b.textContent?.includes('撤回最近一次')),
      false,
      'ChangesDialog should not show Undo latest after restoring file to default',
    )
    // SourcePanel was on frequency_words.txt (still has 1 undo), switching back to config.yaml shows no Undo button
    assert.equal(Boolean(host.querySelector('button[title="撤销"]')), true, 'Other edited file keeps its SourcePanel Undo button')
    await act(async () => editor.selectProFile('config.yaml'))
    assert.equal(Boolean(host.querySelector('button[title="撤销"]')), false, 'SourcePanel Undo button should clear for restored file')

    // Restoring all defaults clears undo/redo history across EVERY file
    await act(async () => editor.setConfigValue(['platforms', 'enabled'], false))
    assert.equal(editor.getFileUndoCount('config.yaml'), 1)
    assert.equal(Boolean(host.querySelector('button[title="撤销"]')), true)
    await act(async () => editor.resetAll())
    assert.equal(editor.canUndo, false, 'resetAll should clear all undo histories')
    assert.equal(editor.canRedo, false, 'resetAll should clear all redo histories')
    assert.equal(editor.undoCount, 0)
    assert.equal(editor.getFileUndoCount('config.yaml'), 0)
    assert.equal(editor.getFileUndoCount('frequency_words.txt'), 0)
    assert.equal(editor.totalChangesCount, 0)
    assert.equal(Boolean(host.querySelector('button[title="撤销"]')), false, 'SourcePanel Undo button clears after resetAll')
  }],
  ['switching zh -> en -> zh after editing config.yaml keeps timeline presets, periods, platforms and RSS feeds localized', async () => {
    await mount(<><PushScheduleSection /><SourcesSection /><ReportSection /></>)
    // Edit config.yaml first (previously broke setLang so timeline.yaml got stuck in English!)
    await act(async () => editor.patchConfigValues([
      { path: ['schedule', 'enabled'], value: true },
      { path: ['schedule', 'preset'], value: 'office_hours' },
    ]))
    await act(async () => editor.setLang('en'))
    assert.ok(host.textContent?.includes('Always-on Monitoring'))
    assert.ok(host.textContent?.includes('Office Hours'))
    assert.ok(host.textContent?.includes('Morning Briefing'))
    assert.ok(host.textContent?.includes('Toutiao'))

    // Switch back to zh: timeline.yaml heals back to zh and zero fake diffs appear
    await act(async () => editor.setLang('zh'))
    assert.ok(host.textContent?.includes('全天监控'))
    assert.ok(host.textContent?.includes('早晚汇总'))
    assert.ok(host.textContent?.includes('办公时间'))
    assert.ok(host.textContent?.includes('夜猫子模式'))
    assert.ok(host.textContent?.includes('到岗速览'))
    assert.ok(host.textContent?.includes('今日头条'))
    assert.equal(host.textContent?.includes('Always-on Monitoring'), false)
    assert.deepEqual(editor.changedFromDefaults, ['config.yaml'])

    // Even if timeline.yaml was manually edited in English, UI still localizes built-in preset & period names in zh
    await act(async () => {
      const enTimeline = getDefaultFiles('en')['timeline.yaml'].replace('start: "09:00"', 'start: "08:30"')
      editor.setFileContent('timeline.yaml', enTimeline)
    })
    assert.ok(host.textContent?.includes('办公时间'))
    assert.ok(host.textContent?.includes('到岗速览'))
    assert.equal(host.textContent?.includes('Always-on Monitoring'), false)
  }],
  ['section header stays single-row with tooltip, and filter switcher progressively reveals active or previewed mode cleanly', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    await mount(<FilterSection />)
    assert.equal(renderError, undefined)

    // SectionShell places subtitle inside the ? tooltip button instead of a multi-row paragraph
    assert.ok(host.querySelector('header button[aria-label="功能说明"]'))
    assert.equal(host.querySelector('header p'), null)

    // Default keyword mode shows [GLOBAL_FILTER] directly below the 1-row tablist
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    assert.equal(tabs.length, 2)
    assert.equal(tabs[0].getAttribute('aria-selected'), 'true')
    assert.ok(host.textContent?.includes('[GLOBAL_FILTER]'))
    assert.equal(host.textContent?.includes('关注兴趣描述编辑器'), false)

    // Clicking AI Smart Filter switches filter.method and progressively unfolds ai_interests.txt
    await act(async () => tabs[1].click())
    assert.equal((editor.configData.filter as { method: string }).method, 'ai')
    assert.ok(host.textContent?.includes('关注兴趣描述编辑器'))
    assert.equal(host.textContent?.includes('[GLOBAL_FILTER]'), false)

    // Previewing frequency_words.txt while method === 'ai' highlights the previewed tab with a single compact bar
    await act(async () => editor.openSourceTarget({ file: 'frequency_words.txt', line: 1 }))
    await act(async () => editor.setProView('features'))
    assert.ok(host.textContent?.includes('设为生效方式'))
    assert.ok(host.textContent?.includes('[GLOBAL_FILTER]'))
  }],
  ['right-pane edits flash the exact changed YAML line in left CodeMirror, and web search uses 1/3..3/3 stepper instead of A/B/C', async () => {
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    await mount(<><SourcePanel embedded /><SourcesSection /></>)
    await act(async () => editor.selectProSection('sources', 'search'))
    assert.equal(renderError, undefined)

    // Web Search shows 1/3, 2/3, 3/3 stepper without cryptic A./B./C. headings
    assert.ok(host.textContent?.includes('1/3'))
    assert.ok(host.textContent?.includes('2/3'))
    assert.ok(host.textContent?.includes('3/3'))
    assert.equal(host.textContent?.includes('A. 搜索模式与引擎凭证'), false)

    // Clicking Smart Refine (smart) switches query_mode and flashes the exact query_mode line in CodeMirror
    const smartTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent?.includes('智能提炼'))!
    assert.ok(smartTab)
    await act(async () => smartTab.click())
    const flashedLines = [...host.querySelectorAll<HTMLElement>('.cm-line[data-changed-line="true"]')]
    assert.equal(flashedLines.length, 1)
    assert.ok(flashedLines[0].textContent?.includes('query_mode'))
    assert.ok(flashedLines[0].textContent?.includes('"smart"'))
    assert.ok(host.textContent?.includes('已同步'))
    assert.equal(/第\s*\d+\s*行/.test(host.querySelector('.pro-source-toolbar')?.textContent ?? ''), false)
  }],
  ['bilingual /en/ entry and deep-link query params hydrate state, preserve GitHub Pages subpath, and support popstate back/forward', async () => {
    // Simulate stale zh/pro localStorage overridden by an explicit English deep link on GitHub Pages subpath
    localStorage.setItem('tr_studio_v2_meta', JSON.stringify({ lang: 'zh', deployMode: 'docker' }))
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    window.history.replaceState(null, '', '/TrendRadar/en/?section=push')

    await mount(<PushScheduleSection />)
    assert.equal(renderError, undefined)
    assert.equal(editor.lang, 'en')
    assert.equal(editor.workspaceMode, 'guided')
    assert.equal(editor.activeSection, 'push')
    assert.equal(document.documentElement.lang, 'en')
    assert.equal(window.location.pathname, '/TrendRadar/en/')
    assert.equal(window.location.search, '?section=push')

    // Switching language updates pathname from /TrendRadar/en/ -> /TrendRadar/ while preserving ?section=push
    await act(async () => editor.setLang('zh'))
    assert.equal(editor.lang, 'zh')
    assert.equal(window.location.pathname, '/TrendRadar/')
    assert.equal(window.location.search, '?section=push')

    // Switching to Pro mode + selecting timeline.yaml updates URL query cleanly
    await act(async () => editor.setWorkspaceMode('pro'))
    await act(async () => editor.selectProFile('timeline.yaml'))
    assert.equal(window.location.pathname, '/TrendRadar/')
    assert.equal(window.location.search, '?mode=pro&file=timeline.yaml')

    // Simulate browser Back/Forward via popstate to /TrendRadar/en/?section=sources&tab=search
    window.history.replaceState(null, '', '/TrendRadar/en/?section=sources&tab=search')
    await act(async () => {
      window.dispatchEvent(new window.Event('popstate'))
    })
    assert.equal(editor.lang, 'en')
    assert.equal(editor.workspaceMode, 'guided')
    assert.equal(editor.activeSection, 'sources')
    assert.equal(editor.sourcesSubTab, 'search')
  }],
  ['pro toolbar omits search input, sidebar stacks support under local import, FilterSection focuses newly added groups, and desktop HTML preview updates live', async () => {
    await mount(
      <>
        <TopNavBar mobileNavOpen={false} onToggleMobileNav={() => {}} />
        <SideNav />
        <ProViewToolbar />
        <FilterSection />
        <ReportPreviewPanel />
      </>,
    )
    assert.equal(renderError, undefined)

    // ProViewToolbar keeps Auto-follow without duplicating the Guided sidebar search box
    const proToolbar = host.querySelector('.pro-form-toolbar')!
    assert.ok(proToolbar)
    assert.equal(proToolbar.querySelector('button[aria-label="搜索配置项"]'), null)
    assert.ok(proToolbar.querySelector('[aria-label="自动跟随左侧滚动"]'))

    // SideNav removes "已自动保存在浏览器" and places "支持项目" as a matching button below the Config hover menu
    const sideNav = host.querySelector('aside')!
    assert.equal(sideNav.textContent?.includes('已自动保存在浏览器'), false)
    assert.equal(sideNav.textContent?.includes('自动保存在本机浏览器'), false)
    const configMenuBtn = sideNav.querySelector<HTMLButtonElement>('button[data-config-menu-trigger="sidenav"]')!
    const supportBtn = [...sideNav.querySelectorAll<HTMLAnchorElement>('a')].find((a) =>
      a.textContent?.includes('支持项目'),
    )!
    assert.ok(configMenuBtn && supportBtn)
    assert.ok(Boolean(configMenuBtn.compareDocumentPosition(supportBtn) & Node.DOCUMENT_POSITION_FOLLOWING))

    // Clicking 新建词组 opens the 4-type creator modal; picking 单个别名 creates a regex+alias group and focuses its input
    const beforeGroups = host.querySelectorAll('[data-group-id]').length
    const newGroupBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('新建词组'),
    )!
    assert.ok(newGroupBtn)
    await act(async () => newGroupBtn.click())
    const aliasTypeOption = document.body.querySelector<HTMLButtonElement>('button[data-group-type-option="alias"]')!
    assert.ok(aliasTypeOption, 'WordGroupTypeModal should present the 4 structural group types')
    assert.ok(document.body.querySelector('button[data-group-type-option="group"]'))
    assert.ok(document.body.querySelector('button[data-group-type-option="multi-alias"]'))
    assert.ok(document.body.querySelector('button[data-group-type-option="plain"]'))
    await act(async () => aliasTypeOption.click())
    const afterGroups = [...host.querySelectorAll<HTMLElement>('[data-group-id]')]
    assert.ok(afterGroups.length > beforeGroups)
    const lastGroup = afterGroups[afterGroups.length - 1]
    assert.ok(lastGroup.querySelector('input[data-autofocus-keyword="true"]'))

    // Inline insert divider between groups inserts a brand-new group at exact index 1 (#2)
    const beforeSecondId = host.querySelectorAll<HTMLElement>('[data-group-id]')[1]?.getAttribute('data-group-id')
    const insertAtOneBtn = host.querySelector<HTMLButtonElement>('button[data-insert-group-at="1"]')!
    assert.ok(insertAtOneBtn, 'Inline insert button between groups #1 and #2 should exist')
    await act(async () => insertAtOneBtn.click())
    assert.ok(document.body.textContent?.includes('将插入到第 #2 位'))
    const plainTypeBtn = document.body.querySelector<HTMLButtonElement>('button[data-group-type-option="plain"]')!
    await act(async () => plainTypeBtn.click())
    const afterInsertIds = [...host.querySelectorAll<HTMLElement>('[data-group-id]')].map((el) =>
      el.getAttribute('data-group-id'),
    )
    assert.notEqual(afterInsertIds[1], beforeSecondId)
    assert.equal(afterInsertIds[2], beforeSecondId)

    // Clicking AI 写正则 opens the closed-loop AI Regex Assistant and auto-parses pasted output into a new group
    const aiRegexBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('AI 写正则'),
    )!
    assert.ok(aiRegexBtn)
    await act(async () => aiRegexBtn.click())
    assert.ok(document.body.textContent?.includes('AI 写正则助手'))
    const pasteArea = document.body.querySelector<HTMLTextAreaElement>('textarea')!
    assert.ok(pasteArea)
    await act(async () => inputText(pasteArea, '/量子计算|\\bQuantum\\b/ => 量子科技'))
    assert.ok(document.body.textContent?.includes('已成功识别 1 条有效规则'))
    const applyAiBtn = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('一键创建词组'),
    )!
    assert.ok(applyAiBtn && !applyAiBtn.disabled)
    await act(async () => applyAiBtn.click())
    assert.ok(editor.files['frequency_words.txt'].includes('/量子计算|\\bQuantum\\b/ => 量子科技'))

    // Clicking top-bar 预览 opens modal desktop HTML preview with live iframe srcDoc (without outer dark/download buttons)
    const previewBtn = host.querySelector<HTMLButtonElement>('button[aria-label="实时预览报告效果"]')!
    assert.ok(previewBtn)
    await act(async () => previewBtn.click())
    assert.equal(editor.previewMode, 'modal')
    const previewDialog = host.querySelector('[role="dialog"][aria-label="桌面端 HTML 报告实时预览"]')!
    assert.ok(previewDialog)
    assert.ok(previewDialog.querySelector('[aria-label="报告版面宽度"]'), 'Modal preview keeps Wide/Narrow toggle')
    assert.equal(previewDialog.querySelector('button[aria-label="切换预览报告主题"]'), null)
    assert.equal(
      [...previewDialog.querySelectorAll('button')].some((b) => b.textContent?.trim() === '下载'),
      false,
    )
    const iframe = host.querySelector<HTMLIFrameElement>('iframe[data-preview-iframe="true"]')!
    assert.ok(iframe)
    const initialHtml = iframe.getAttribute('srcdoc') ?? ''
    assert.ok(initialHtml.includes('TrendRadar'))
    assert.ok(initialHtml.includes('wide-mode'))

    // Editing config updates the live preview HTML immediately
    await act(async () => {
      editor.patchConfigValues([
        { path: ['report', 'mode'], value: 'daily' },
        { path: ['web_search', 'enabled'], value: true },
        { path: ['display', 'regions', 'web_search'], value: true },
      ])
    })
    const updatedHtml = host.querySelector<HTMLIFrameElement>('iframe[data-preview-iframe="true"]')!.getAttribute('srcdoc') ?? ''
    assert.ok(updatedHtml.includes('全天汇总'))
    assert.ok(updatedHtml.includes('header-sources-bar'))

    // Clicking 边改边看 docks the live preview panel on the right, switches HTML to narrow mode,
    // keeps only 实时同步 on the left, hides Wide/Narrow toggle, and keeps Expand/New Tab/Close on right
    const dockBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('边改边看'),
    )!
    assert.ok(dockBtn)
    await act(async () => dockBtn.click())
    assert.equal(editor.previewMode, 'docked')
    const dockedAside = host.querySelector<HTMLElement>('aside[aria-label="实时 HTML 报告侧边预览"]')!
    assert.ok(dockedAside)
    assert.equal(dockedAside.querySelector('[aria-label="报告版面宽度"]'), null, 'Docked preview hides Wide/Narrow toggle')
    assert.equal(dockedAside.textContent?.includes('桌面端 HTML 报告预览'), false, 'Docked header omits long title and keeps only 实时同步')
    assert.ok(dockedAside.textContent?.includes('实时同步'), 'Docked header shows Live sync pill')
    assert.ok(dockedAside.textContent?.includes('模拟示例数据'))
    const dockedHtml = dockedAside.querySelector<HTMLIFrameElement>('iframe[data-preview-iframe="true"]')!.getAttribute('srcdoc') ?? ''
    assert.ok(dockedHtml.includes('data-preview-wide="0"'), 'Docked preview automatically renders narrow HTML layout')
    const resizeHandle = dockedAside.querySelector<HTMLElement>('[role="separator"][aria-label="拖动调整实时预览宽度"]')!
    assert.ok(resizeHandle)
    assert.equal(resizeHandle.getAttribute('data-preview-resize-rail'), 'true', 'Docked preview uses dedicated split resize rail')
    assert.equal(resizeHandle.className.includes('-left-'), false, 'Resize rail should not negatively overlap left pane scrollbar')
    assert.equal(resizeHandle.className.includes('hidden'), false, 'Resize handle should stay visible and draggable')
    assert.ok(dockedAside.className.includes('xl:h-full'), 'Docked preview should fill full workspace viewport height on desktop')

    // Switching back to 大图 restores desktop wide HTML layout
    const expandBtn = [...dockedAside.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('大图'),
    )!
    assert.ok(expandBtn)
    await act(async () => expandBtn.click())
    assert.equal(editor.previewMode, 'modal')
    const restoredModalHtml = host.querySelector<HTMLIFrameElement>('iframe[data-preview-iframe="true"]')!.getAttribute('srcdoc') ?? ''
    assert.ok(restoredModalHtml.includes('data-preview-wide="1"'), 'Modal preview restores desktop wide layout')

    // GuidedTrialFiles renders multi-file modified list as one file per row without truncation
    await unmount()
    await mount(<GuidedTrialFiles section="filter" inline />)
    await act(async () => {
      editor.setConfigValue(['report', 'mode'], 'daily')
      editor.setFileContent('frequency_words.txt', `${editor.files['frequency_words.txt']}\nAI测试\n`)
    })
    const singleColList = host.querySelector<HTMLElement>('[data-modified-files-list="single-column"]')!
    assert.ok(singleColList, 'Modified files list should render in single-column stack')
    assert.equal(singleColList.className.includes('grid-cols-2'), false)
    assert.ok(singleColList.textContent?.includes('config/config.yaml'))
    assert.ok(singleColList.textContent?.includes('config/frequency_words.txt'))

    // PushScheduleSection keeps Timeline Orchestrator expanded by default and never collapses on preset switch
    await unmount()
    await mount(<PushScheduleSection />)
    await act(async () => {
      editor.setConfigValue(['schedule', 'enabled'], true)
    })
    const orchestrator = host.querySelector<HTMLElement>('#pro-anchor-timeline-orchestrator')!
    assert.ok(orchestrator, 'Timeline orchestrator should render when schedule is enabled')
    assert.equal(orchestrator.getAttribute('data-state'), 'open', 'Timeline orchestrator should be open by default')
    const alwaysOnCard = [...host.querySelectorAll<HTMLElement>('[role="button"]')].find((el) =>
      el.textContent?.includes('always_on'),
    )
    const officeCard = [...host.querySelectorAll<HTMLElement>('[role="button"]')].find((el) =>
      el.textContent?.includes('office_hours'),
    )
    assert.ok(alwaysOnCard && officeCard, 'Schedule preset cards should be clickable')
    await act(async () => alwaysOnCard.click())
    assert.equal(
      host.querySelector<HTMLElement>('#pro-anchor-timeline-orchestrator')?.getAttribute('data-state'),
      'open',
      'Switching to always_on must keep Timeline Orchestrator expanded',
    )
    await act(async () => officeCard.click())
    assert.equal(
      host.querySelector<HTMLElement>('#pro-anchor-timeline-orchestrator')?.getAttribute('data-state'),
      'open',
      'Switching to office_hours must keep Timeline Orchestrator expanded',
    )

    // Collapsed SideNav renders icon-only rail without full labels
    await unmount()
    await mount(<SideNav collapsed />)
    const collapsedAside = host.querySelector('aside[data-collapsed="true"]')!
    assert.ok(collapsedAside)
    assert.equal(collapsedAside.textContent?.includes('导入本地配置'), false)
    assert.ok(collapsedAside.querySelector('a[aria-label="支持项目"]'))

    // Full App shell locks desktop workspace body height so left pane & right docked preview match viewport height
    // and BackToTopButton stays anchored to the visible editor viewport rather than document bottom
    await unmount()
    const { default: App } = await import('@/App')
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    await act(async () => {
      root!.render(<App />)
    })
    const wsBody = host.querySelector<HTMLElement>('[data-workspace-body="true"]')!
    assert.ok(wsBody, 'App should render viewport-locked workspace body')
    assert.ok(wsBody.className.includes('lg:h-[calc(100dvh-3.5rem)]'))
    assert.ok(wsBody.className.includes('lg:overflow-hidden'))
    const guidedPane = host.querySelector<HTMLElement>('[data-guided-scroll-pane="true"]')!
    assert.ok(guidedPane, 'Guided scroll pane should wrap <main> and BackToTopButton')
    assert.ok(guidedPane.className.includes('lg:h-full'))
    const guidedMain = guidedPane.querySelector<HTMLElement>('#studio-main-scroll')!
    assert.ok(guidedMain.className.includes('min-h-0'))
    assert.ok(guidedMain.className.includes('overflow-y-auto'))

    // ExportCenterDialog separates Docker .env and GitHub Secrets into independent tabs and explains reload semantics
    await unmount()
    const { ExportCenterDialog } = await import('@/components/modals/ExportCenterDialog')
    await mount(<ExportCenterDialog />)
    await act(async () => {
      editor.setConfigValue(['notification', 'channels', 'feishu', 'webhook_url'], 'https://open.feishu.cn/open-apis/bot/v2/hook/test-123')
      editor.setExportOpen(true)
    })
    const exportText = document.body.textContent ?? ''
    assert.ok(exportText.includes('Docker .env'), 'Export dialog should have dedicated Docker .env tab')
    assert.ok(exportText.includes('GitHub Secrets (1)'), 'Export dialog should have dedicated GitHub Secrets tab')
    assert.equal(exportText.includes('.env / GitHub Secrets'), false, 'Old combined tab should be split')
    assert.ok(exportText.includes('无需重启'), 'Export dialog should concisely state config/ needs no restart')
    assert.ok(exportText.includes('重建容器'), 'Export dialog should concisely state docker/.env requires recreate')
    assert.ok(
      document.body.querySelector('button[aria-label="查看详细生效说明"]'),
      'Detailed reload rules should be tucked into ? tooltip trigger',
    )
  }],
  ['workflow stage numbering and distinct stage colors align across SideNav, SectionShell, GuidedPipeline and GuidedStarter without truncated headings', async () => {
    const { StorageSystemSection } = await import('@/components/sections/StorageSystemSection')
    await mount(<><SideNav /><OnboardingSection /></>)
    assert.equal(renderError, undefined)

    // SideNav groups 01..06 under the 4 distinct stages
    assert.deepEqual(
      [...host.querySelectorAll<HTMLElement>('[data-sidenav-stage-group]')].map((el) => el.getAttribute('data-sidenav-stage-group')),
      ['collect', 'analyze', 'deliver', 'system'],
    )

    // Full 3-stage pipeline uses distinct stages + aligned step ranges (01 / 02–03 / 04–05), with full untruncated stage titles
    const fullCards = [...host.querySelectorAll<HTMLElement>('[data-pipeline-full="true"] .guided-stage-card')]
    assert.deepEqual(fullCards.map((c) => c.getAttribute('data-stage')), ['collect', 'analyze', 'deliver'])
    assert.ok(fullCards[0].textContent?.includes('数据采集') && fullCards[0].textContent?.includes('步骤 01'))
    assert.ok(fullCards[1].textContent?.includes('筛选与 AI') && fullCards[1].textContent?.includes('步骤 02–03'))
    assert.ok(fullCards[2].textContent?.includes('报告与推送') && fullCards[2].textContent?.includes('步骤 04–05'))
    assert.equal(fullCards.some((c) => Boolean(c.querySelector('.guided-stage-head .truncate'))), false)

    // Quick-trial tabs omit conflicting 1./2./3./4. prefixes
    const starterTabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tablist"][aria-label="快速体验环节"] [role="tab"]')]
    assert.deepEqual(starterTabs.map((b) => b.textContent?.trim()), ['挑来源', '加关注词', '选推送模式', '填机器人 Webhook'])

    // TopNavBar bottom progress bar updates percentage on step jumps and shows floating % badge
    await unmount()
    await mount(<><TopNavBar mobileNavOpen={false} onToggleMobileNav={() => {}} /><AiSection /></>)
    const aiStepBadge = host.querySelector<HTMLElement>('header span[data-stage="analyze"]')
    assert.ok(aiStepBadge && aiStepBadge.textContent?.trim() === 'STEP 03')
    assert.equal(
      host.querySelector('div[data-pipeline-compact="true"]')?.parentElement?.querySelector('header')?.textContent?.includes('config.yaml'),
      false,
      'Guided header should not duplicate file button shown in step files bar',
    )
    await act(async () => editor.setActiveSection('ai'))
    const topProgress = host.querySelector<HTMLElement>('[data-topnav-progress="true"]')!
    assert.ok(topProgress)
    assert.equal(topProgress.getAttribute('aria-valuenow'), '50')
    assert.equal(topProgress.getAttribute('data-stage'), 'analyze')
    const pctBadge = host.querySelector<HTMLElement>('[data-topnav-progress-badge="true"]')!
    assert.ok(pctBadge && pctBadge.textContent?.includes('50%'))

    const aiCompact = host.querySelector<HTMLElement>('[data-pipeline-compact="true"]')!
    assert.equal(aiCompact.getAttribute('data-current-stage'), 'analyze')
    assert.equal(aiCompact.textContent?.includes('筛选与 AI'), false, 'Compact files bar should not repeat SideNav stage label')
    assert.deepEqual(
      [...aiCompact.querySelectorAll<HTMLElement>('[data-section-file]')].map((el) => el.getAttribute('data-section-file')),
      ['config.yaml', 'ai_analysis_prompt.txt', 'ai_translation_prompt.txt'],
    )
    await act(async () => editor.setConfigValue(['ai_analysis', 'enabled'], false))
    assert.ok(
      aiCompact.querySelector('[data-section-file="config.yaml"]')?.textContent?.includes('已改'),
      'Modified file chip should display explicit 已改 badge instead of a bare dot',
    )

    // Clicking the 4 shared AI consumer badges jumps to their exact sections/anchors (in-page and cross-section)
    const analysisConsumer = host.querySelector<HTMLButtonElement>('button[data-ai-consumer="analysis"]')!
    const translationConsumer = host.querySelector<HTMLButtonElement>('button[data-ai-consumer="translation"]')!
    const filterConsumer = host.querySelector<HTMLButtonElement>('button[data-ai-consumer="filter"]')!
    const searchConsumer = host.querySelector<HTMLButtonElement>('button[data-ai-consumer="search_smart"]')!
    assert.ok(analysisConsumer && translationConsumer && filterConsumer && searchConsumer)
    await act(async () => translationConsumer.click())
    assert.equal(editor.activeSection, 'ai')
    assert.equal(editor.visualFocusTarget?.anchor, 'pro-anchor-ai-translation')
    await act(async () => filterConsumer.click())
    assert.equal(editor.activeSection, 'filter')
    assert.equal(editor.visualFocusTarget?.anchor, 'pro-anchor-ai-interests')
    assert.equal(editor.visualFocusTarget?.filterMode, 'ai')
    await act(async () => searchConsumer.click())
    assert.equal(editor.activeSection, 'sources')
    assert.equal(editor.sourcesSubTab, 'search')
    assert.equal(editor.visualFocusTarget?.anchor, 'pro-anchor-search')

    // SourcesSection tabs clearly distinguish enabled ("已开") vs disabled ("未开启") sources
    await unmount()
    await mount(<SourcesSection />)
    assert.ok(host.querySelector('[data-source-tab="hotlist"][data-enabled="true"]')?.textContent?.includes('已开'))
    assert.ok(host.querySelector('[data-source-tab="rss"][data-enabled="true"]')?.textContent?.includes('已开'))
    assert.ok(host.querySelector('[data-source-tab="search"][data-enabled="false"]')?.textContent?.includes('未开启'))

    // STEP 06 (StorageSystemSection) maps to stage "system" (100%, 6/6) with only config.yaml
    await unmount()
    await mount(<><TopNavBar mobileNavOpen={false} onToggleMobileNav={() => {}} /><StorageSystemSection /></>)
    await act(async () => editor.setActiveSection('storage'))
    assert.equal(host.querySelector<HTMLElement>('[data-topnav-progress="true"]')?.getAttribute('aria-valuenow'), '100')
    assert.ok(host.querySelector<HTMLElement>('[data-topnav-progress-badge="true"]')?.textContent?.includes('100%'))
    const storageCompact = host.querySelector<HTMLElement>('[data-pipeline-compact="true"]')!
    assert.equal(storageCompact.getAttribute('data-current-stage'), 'system')
    assert.deepEqual(
      [...storageCompact.querySelectorAll<HTMLElement>('[data-section-file]')].map((el) => el.getAttribute('data-section-file')),
      ['config.yaml'],
    )

    // ChatGPT-style left-edge GuidedSectionOutline discovers page anchors, expands on hover, and jumps to target block on click
    await unmount()
    const { GuidedSectionOutline } = await import('@/components/guided/GuidedSectionOutline')
    await mount(
      <div className="relative">
        <main id="test-guided-outline-scroll">
          <AiSection />
        </main>
        <GuidedSectionOutline containerId="test-guided-outline-scroll" />
      </div>,
    )
    await act(async () => editor.setActiveSection('ai'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    const outlineNav = host.querySelector<HTMLElement>('[data-guided-outline="true"]')!
    assert.ok(outlineNav, 'GuidedSectionOutline should render left-edge tick rail')
    const ticks = [...outlineNav.querySelectorAll<HTMLButtonElement>('[data-outline-tick]')]
    assert.ok(ticks.length >= 3, 'AiSection should expose multiple jumpable anchors in outline')
    // Resting state: all ticks have uniform 12px width and popover stays hidden
    assert.ok(ticks.every((btn) => btn.querySelector<HTMLElement>('span')?.style.width === '12px'))
    assert.equal(outlineNav.querySelector('[data-outline-popover="true"]'), null, 'Popover stays hidden until hover')
    // Hovering a middle tick swells it most, swells adjacent neighbors gently (less than hovered), and shows ONLY that single preview card
    const targetIdx = ticks.findIndex((btn) => btn.getAttribute('data-outline-tick') === 'pro-anchor-ai-analysis')
    assert.ok(targetIdx > 0 && targetIdx < ticks.length - 1)
    await act(async () => {
      ticks[targetIdx].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    const hoveredW = parseFloat(ticks[targetIdx].querySelector<HTMLElement>('span')!.style.width)
    const prevNeighborW = parseFloat(ticks[targetIdx - 1].querySelector<HTMLElement>('span')!.style.width)
    const nextNeighborW = parseFloat(ticks[targetIdx + 1].querySelector<HTMLElement>('span')!.style.width)
    assert.ok(hoveredW > prevNeighborW && prevNeighborW > 12, 'Previous neighbor should swell gently below hovered tick')
    assert.ok(hoveredW > nextNeighborW && nextNeighborW > 12, 'Next neighbor should swell gently below hovered tick')
    const popover = outlineNav.querySelector<HTMLButtonElement>('[data-outline-popover="true"]')!
    assert.ok(popover && popover.getAttribute('data-outline-item') === 'pro-anchor-ai-analysis')
    assert.ok(popover.textContent?.includes('AI 深度分析'))
    assert.equal(popover.textContent?.includes('AI 多语言翻译'), false, 'Preview card should show ONLY the hovered item')
    await act(async () => popover.click())
    assert.equal(editor.visualFocusTarget?.anchor, 'pro-anchor-ai-analysis')

    // ProYamlFields hides + on fixed-schema map entries (e.g. platforms.sources[0]) and uses hover-reveal delete buttons
    await unmount()
    localStorage.setItem('tr_editor_workspace_mode', 'pro')
    await mount(<main><ProFileFields /></main>)
    await act(async () => editor.openSourceTarget({ file: 'config.yaml', path: ['platforms', 'sources'] }))
    const sourcesRow = host.querySelector<HTMLElement>(`[data-field-path='["platforms","sources"]']`)!
    const firstSourceRow = host.querySelector<HTMLElement>(`[data-field-path='["platforms","sources",0]']`)!
    assert.ok(sourcesRow.querySelector('button[aria-label*="添加条目"]'), 'List collection should keep + add button')
    assert.equal(firstSourceRow.querySelector('button[aria-label*="添加条目"]'), null, 'Fixed-schema list entry map should omit + button')
    const firstDeleteBtn = firstSourceRow.querySelector<HTMLButtonElement>('button[aria-label*="删除"]')!
    assert.ok(firstDeleteBtn && firstDeleteBtn.className.includes('tr-hover-delete'), 'Delete button should stay hidden until hover')
  }],
  ['TopNavBar hover language switcher renders 8 languages in 2 columns and updates all exonyms + URL live', async () => {
    await mount(<TopNavBar mobileNavOpen={false} onToggleMobileNav={() => {}} />)
    assert.equal(renderError, undefined)

    const trigger = host.querySelector<HTMLButtonElement>('[data-lang-switcher-trigger="true"]')!
    assert.ok(trigger, 'Language switcher trigger should render')
    assert.ok(trigger.textContent?.includes('简'))

    // Open menu (works via hover on desktop or click fallback)
    await act(async () => trigger.click())
    const panel = document.querySelector<HTMLElement>('[data-lang-switcher-panel="true"]')!
    assert.ok(panel, 'Language switcher popover should open')

    const options = [...panel.querySelectorAll<HTMLButtonElement>('[data-lang-option]')]
    assert.equal(options.length, 8)
    assert.deepEqual(
      options.map((el) => el.getAttribute('data-lang-option')),
      ['en', 'zh', 'de', 'zh-TW', 'tr', 'ko', 'ru', 'ja'],
    )
    // Under Simplified Chinese, Japanese exonym shows "日语" and English shows "英语"
    assert.equal(panel.querySelector('[data-lang-exonym="ja"]')?.textContent, '日语')
    assert.equal(panel.querySelector('[data-lang-exonym="en"]')?.textContent, '英语')

    // Click Japanese -> switches UI language, URL ?lang=ja, html lang="ja", live exonyms, and loads .en templates for all 7 files
    const jaBtn = panel.querySelector<HTMLButtonElement>('[data-lang-option="ja"]')!
    await act(async () => jaBtn.click())
    assert.equal(editor.lang, 'ja')
    assert.equal(document.documentElement.lang, 'ja')
    assert.equal(window.location.search, '?lang=ja')
    assert.ok(trigger.textContent?.includes('JA'))
    assert.ok(editor.files['ai_interests.txt'].includes('TrendRadar AI Interests Profile'))
    assert.ok(editor.files['ai_analysis_prompt.txt'].includes('TrendRadar AI Analysis Prompt Config'))
    assert.ok(editor.files['ai_translation_prompt.txt'].includes('TrendRadar AI Translation Prompt Config'))

    // Re-open if closed by synthetic click and check all bottom exonyms are now in Japanese
    if (!document.querySelector('[data-lang-switcher-panel="true"]')) {
      await act(async () => trigger.click())
    }
    const jaPanel = document.querySelector<HTMLElement>('[data-lang-switcher-panel="true"]')!
    assert.equal(jaPanel.querySelector('[data-lang-exonym="zh"]')?.textContent, '簡体字中国語')
    assert.equal(jaPanel.querySelector('[data-lang-exonym="de"]')?.textContent, 'ドイツ語')
    assert.equal(jaPanel.querySelector('[data-lang-exonym="ko"]')?.textContent, '韓国語')

    // Switch to Traditional Chinese -> ?lang=zh-TW, zh-TW exonyms, and loads default (zh) templates for all 7 files
    const twBtn = jaPanel.querySelector<HTMLButtonElement>('[data-lang-option="zh-TW"]')!
    await act(async () => twBtn.click())
    assert.equal(editor.lang, 'zh-TW')
    assert.equal(document.documentElement.lang, 'zh-TW')
    assert.equal(window.location.search, '?lang=zh-TW')
    assert.ok(trigger.textContent?.includes('繁'))
    assert.ok(editor.files['ai_interests.txt'].includes('TrendRadar AI 兴趣描述文件'))
    assert.ok(editor.files['ai_analysis_prompt.txt'].includes('TrendRadar AI 分析提示词配置'))
    assert.ok(editor.files['ai_translation_prompt.txt'].includes('TrendRadar AI 翻译提示词配置'))
  }],
]

export async function runComponentTests() {
  let failed = 0
  for (const [name, run] of cases) {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
    try {
      await run()
      console.log(`PASS: ${name}`)
    } catch (error) {
      failed++
      console.error(`FAIL: ${name}`, error)
    } finally {
      await unmount()
    }
  }
  console.log(`${cases.length - failed}/${cases.length} component regressions passed`)
  return { failed }
}
