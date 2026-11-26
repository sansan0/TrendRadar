import { FileSliders, HelpCircle, ListTree, LocateFixed, PanelsTopLeft } from 'lucide-react'
import { InfoTooltip, SelectField, Switch } from '@/components/ui/primitives'
import { ProYamlFields } from '@/components/sections/ProYamlFields'
import { ProTextFields } from '@/components/sections/ProTextFields'
import { useT } from '@/i18n'
import { chapterLabel, isYamlFile } from '@/lib/pro-navigation'
import { cn } from '@/lib/utils'
import { formatFieldPath } from '@/lib/yaml-fields'
import { useEditor } from '@/store/editor-store'

export function ProViewToolbar() {
  const { proView, setProView, proAutoFollow, setProAutoFollow } = useEditor()
  const t = useT()
  return (
    <div className="pro-form-toolbar @container/pro-toolbar flex h-10 min-w-0 items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="inline-flex shrink-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5" role="group" aria-label={t('表单视图', 'Form view')}>
          {([
            {
              mode: 'file' as const,
              Icon: FileSliders,
              zh: '局部参数',
              en: 'Focused Fields',
              tipZh: '跟随左侧文件与光标位置，只展示当前这一小块的参数直接填写',
              tipEn: 'Shows only the parameters of the current section at your cursor for direct input',
            },
            {
              mode: 'features' as const,
              Icon: PanelsTopLeft,
              zh: '可视化',
              en: 'Visual',
              tipZh: '切换到当前区域对应的图形化向导界面来调整配置',
              tipEn: 'Switch to the visual guided interface for the current area',
            },
          ]).map(({ mode, Icon, zh, en, tipZh, tipEn }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={proView === mode}
              title={t(tipZh, tipEn)}
              onClick={() => setProView(mode)}
              className={cn(
                'tr-focus-ring inline-flex h-6.5 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors',
                proView === mode
                  ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon size={13} className="hidden shrink-0 @xs/pro-toolbar:block" />
              <span>{t(zh, en)}</span>
            </button>
          ))}
        </div>

        <InfoTooltip
          side="bottom"
          content={
            <div className="space-y-1.5">
              <div>
                1. {t('局部参数：跟随左侧文件和光标所在位置，只展示当前局部区块的参数直接填写。', 'Focused Fields: Follows the left file and cursor, showing only the current local block for direct input.')}
              </div>
              <div>
                2. {t('可视化：将当前所在区块切换为图形化向导界面，适合添加规则、点选开关或试跑测试。', 'Visual: Opens the guided visual UI for the current section.')}
              </div>
            </div>
          }
        >
          <button
            type="button"
            className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
            aria-label={t('视图说明', 'View modes help')}
          >
            <HelpCircle size={14} />
          </button>
        </InfoTooltip>
      </div>

      <label
        className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none"
        title={t(
          '开启后，左侧滚动或点击代码时，右侧面板自动定位到对应区域',
          'When on, scrolling or clicking code on the left automatically syncs the right panel',
        )}
      >
        <span className="hidden @xs/pro-toolbar:inline">{t('自动跟随', 'Auto-follow')}</span>
        <Switch
          checked={proAutoFollow}
          onCheckedChange={setProAutoFollow}
          ariaLabel={t('自动跟随左侧滚动', 'Auto-follow left scroll')}
        />
      </label>
    </div>
  )
}

export function ProFileLocation() {
  const { activeSourceFile: file, lang, chapters, proPath, proPosition, openSourceTarget } = useEditor()
  const t = useT()
  const current = String(proPath[0] ?? '')
  const yaml = isYamlFile(file)
  const path = formatFieldPath(proPath)
  const showChapters = yaml && chapters.length > 0
  const leaf = formatFieldPath(proPath.slice(-1))
  const chapterOptions = isYamlFile(file)
    ? chapters.map((key) => {
        const label = chapterLabel(file, key, lang)
        return {
          value: key,
          label,
          hint: label !== key ? key : undefined,
        }
      })
    : []

  return (
    <div
      className={cn(
        'pro-form-navigation grid h-9 min-w-0 items-center gap-2.5 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/70 px-3 text-xs',
        showChapters ? 'grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      {showChapters && isYamlFile(file) && (
        <div className="flex min-w-0 items-center gap-1.5">
          <ListTree size={14} className="shrink-0 text-[var(--brand-primary)]" />
          <SelectField
            size="xs"
            value={current}
            ariaLabel={t('配置章节', 'Configuration section')}
            title={chapterLabel(file, current, lang)}
            onValueChange={(val) => openSourceTarget({ file, path: [val] })}
            options={chapterOptions}
            className="w-auto min-w-[108px] max-w-[176px] bg-[var(--bg-surface)] font-semibold shadow-[var(--shadow-xs)]"
          />
        </div>
      )}
      <code className="flex min-w-0 items-center overflow-hidden font-mono text-xs text-[var(--text-muted)]" title={yaml ? path : file}>
        {yaml && path !== leaf && <span className="min-w-0 truncate">{path.slice(0, path.length - leaf.length)}</span>}
        <span className="max-w-full shrink-0 truncate font-semibold text-[var(--text-secondary)]">{yaml ? leaf : file}</span>
      </code>
      <button
        type="button"
        title={t('点击在左右双栏同步定位到第 {v0} 行', 'Reveal Line {v0} in both panes', { v0: proPosition.line })}
        onClick={() => openSourceTarget(yaml ? { file, path: proPath } : { file, ...proPosition })}
        className="tr-focus-ring inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--brand-border)] bg-[var(--brand-soft)]/60 px-2.5 text-xs font-medium text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-soft)]"
      >
        <LocateFixed size={13} className="shrink-0" />
        <span>{t('跳转至第 {v0} 行', 'Jump to Line {v0}', { v0: proPosition.line })}</span>
      </button>
    </div>
  )
}

export function ProFileFields() {
  const { activeSourceFile: file, files, activeYamlDoc, proPath, proPosition, revealSeq, proAlignTop,
    focusSourceFromForm, openSourceTarget, patchYamlFile, setFileContent } = useEditor()
  if (isYamlFile(file)) {
    return <ProYamlFields key={file} file={file} doc={activeYamlDoc} path={proPath} revealSeq={revealSeq}
      alignToTop={proAlignTop}
      onNavigate={(path) => focusSourceFromForm({ file, path })}
      onReveal={(path) => openSourceTarget({ file, path })}
      onChange={(path, value) => patchYamlFile(file, [{ path, value }])}
      onRemove={(path) => patchYamlFile(file, [{ path, remove: true }])} />
  }
  return <ProTextFields key={file} file={file} value={files[file]} {...proPosition} revealSeq={revealSeq}
    onNavigate={(line, column) => focusSourceFromForm({ file, line, column })}
    onChange={(value, line, column) => setFileContent(file, value, 'form', { line, column })} />
}
