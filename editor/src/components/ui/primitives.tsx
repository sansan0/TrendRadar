import * as React from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import * as RadixSelect from '@radix-ui/react-select'
import * as RadixSlider from '@radix-ui/react-slider'
import * as RadixTabs from '@radix-ui/react-tabs'
import * as RadixDialog from '@radix-ui/react-dialog'
import * as RadixPopover from '@radix-ui/react-popover'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import * as RadixCollapsible from '@radix-ui/react-collapsible'
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------------- Studio Button ---------------- */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'xs' | 'sm' | 'md' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const BUTTON_VARIANT_CLS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] shadow-[var(--shadow-xs)] border border-transparent',
  secondary:
    'bg-[var(--bg-muted)] text-[var(--text-primary)] hover:bg-[var(--border-default)] border border-transparent',
  outline:
    'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--border-strong)] shadow-[var(--shadow-xs)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] border border-transparent',
  danger:
    'bg-red-600/10 text-red-600 dark:text-red-400 hover:bg-red-600/18 border border-red-500/25',
}

const BUTTON_SIZE_CLS: Record<ButtonSize, string> = {
  xs: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
  sm: 'h-9 px-3.5 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  icon: 'h-9 w-9 p-0 rounded-lg justify-center',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'outline', size = 'sm', type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'tr-focus-ring inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors cursor-pointer select-none disabled:opacity-45 disabled:pointer-events-none',
        BUTTON_VARIANT_CLS[variant],
        BUTTON_SIZE_CLS[size],
        className,
      )}
      {...rest}
    />
  ),
)
Button.displayName = 'StudioButton'

/* ---------------- Studio Badge ---------------- */
type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'outline'

const BADGE_CLS: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--bg-muted)] text-[var(--text-secondary)] border-transparent',
  brand: 'bg-[var(--brand-soft)] text-[var(--brand-primary)] border-[var(--brand-border)]',
  success: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25',
  warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
  danger: 'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/30',
  outline: 'bg-transparent text-[var(--text-muted)] border-[var(--border-default)]',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-tight whitespace-nowrap',
        BADGE_CLS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------- Studio Surface Card ---------------- */
export function Card({
  id,
  children,
  className,
}: {
  id?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-xs)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ---------------- Form Inputs ---------------- */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'tr-focus-ring outline-none h-10 w-full min-w-0 max-w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--brand-primary)] disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'StudioInput'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'tr-focus-ring outline-none w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--brand-primary)] disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'StudioTextarea'

/* ---------------- Switch (Radix) ---------------- */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'tr-focus-ring relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
        checked
          ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]'
          : 'bg-[var(--bg-muted)] border-[var(--border-strong)]',
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[20px]' : 'translate-x-[2px]',
        )}
      />
    </RadixSwitch.Root>
  )
}

/* ---------------- Slider (Radix) ---------------- */
export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  disabled,
  className,
}: {
  value: number
  onValueChange: (val: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  className?: string
}) {
  return (
    <RadixSlider.Root
      value={[value]}
      onValueChange={([v]) => {
        if (typeof v === 'number') onValueChange(v)
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        'relative flex w-full touch-none select-none items-center py-2',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      <RadixSlider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--bg-muted)]">
        <RadixSlider.Range className="absolute h-full bg-[var(--brand-primary)]" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="tr-focus-ring block h-4 w-4 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--bg-surface)] shadow-sm transition-transform hover:scale-110 cursor-pointer" />
    </RadixSlider.Root>
  )
}

/* ---------------- Select (Radix) ---------------- */
export interface SelectOption {
  value: string
  label: string
  hint?: string
}

type SelectSize = 'xs' | 'sm' | 'md'

const SELECT_SIZE_CLS: Record<SelectSize, string> = {
  xs: 'h-7 rounded-lg px-2.5 text-xs gap-1.5',
  sm: 'h-9 rounded-lg px-3 text-[13px] gap-2',
  md: 'h-10 rounded-xl px-3.5 text-sm gap-2',
}

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  size = 'md',
  ariaLabel,
  title,
  className,
}: {
  value: string
  onValueChange: (val: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: SelectSize
  ariaLabel?: string
  title?: string
  className?: string
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        title={title}
        data-select-values={options.map((o) => o.value).join(',')}
        className={cn(
          'tr-focus-ring inline-flex w-full min-w-0 max-w-full items-center justify-between border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] hover:border-[var(--border-strong)] data-[state=open]:border-[var(--brand-primary)] transition-colors cursor-pointer disabled:opacity-50 [&>span:first-child]:truncate',
          SELECT_SIZE_CLS[size],
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className={cn('text-[var(--text-muted)] shrink-0', size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-[1450] flex max-h-80 min-w-[max(var(--radix-select-trigger-width),10rem)] max-w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-popover)]"
        >
          <RadixSelect.ScrollUpButton
            data-select-scroll-cue="up"
            className="flex h-6 shrink-0 cursor-default items-center justify-center border-b border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="tr-select-viewport max-h-72 overflow-y-auto p-0.5 pr-1">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  'relative flex items-center justify-between gap-2.5 rounded-lg px-2.5 text-[var(--text-primary)] outline-none cursor-pointer select-none transition-colors data-[highlighted]:bg-[var(--brand-soft)] data-[highlighted]:text-[var(--brand-primary)] data-[state=checked]:font-medium',
                  size === 'xs' ? 'py-1.5 text-xs' : 'py-2 text-[13px]',
                )}
              >
                <div className="min-w-0">
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  {opt.hint && (
                    <div className="text-[11px] font-normal text-[var(--text-muted)] truncate">{opt.hint}</div>
                  )}
                </div>
                <RadixSelect.ItemIndicator>
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton
            data-select-scroll-cue="down"
            className="flex h-6 shrink-0 cursor-default items-center justify-center border-t border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

/* ---------------- Tabs (Radix) ---------------- */
export const Tabs = RadixTabs.Root

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <RadixTabs.List
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1',
        className,
      )}
    >
      {children}
    </RadixTabs.List>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
  ...rest
}: React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger> & {
  value: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <RadixTabs.Trigger
      value={value}
      {...rest}
      className={cn(
        'tr-focus-ring inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-medium text-[var(--text-secondary)] transition-all cursor-pointer data-[state=active]:bg-[var(--bg-surface)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-[var(--shadow-xs)] hover:text-[var(--text-primary)]',
        className,
      )}
    >
      {children}
    </RadixTabs.Trigger>
  )
}

export const TabsContent = RadixTabs.Content

/* ---------------- Tooltip (Radix) ---------------- */
export const TooltipProvider = RadixTooltip.Provider

export function InfoTooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[1500] max-w-[320px] rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-2.5 text-xs leading-relaxed text-slate-100 shadow-lg"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

/* ---------------- Modal Dialog (Radix) ---------------- */
export function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidthClass = 'max-w-2xl',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidthClass?: string
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[1300] bg-slate-950/50 backdrop-blur-[3px]" />
        <RadixDialog.Content
          onOpenAutoFocus={(e) => {
            const container = e.currentTarget as HTMLElement
            const preferred = container.querySelector<HTMLElement>(
              '[autofocus], input:not([type="hidden"]):not([disabled]), [role="tab"][data-state="active"]',
            )
            if (preferred) {
              e.preventDefault()
              preferred.focus()
            }
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-[1310] flex max-h-[88vh] w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-popover)] outline-none',
            maxWidthClass,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-[17px] font-semibold text-[var(--text-primary)]">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                className="tr-focus-ring rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="@container/section min-w-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/60 px-5 py-3">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/* ---------------- Popover & Collapsible Re-exports ---------------- */
export const Popover = RadixPopover.Root
export const PopoverTrigger = RadixPopover.Trigger

export function PopoverPanel({
  children,
  side,
  align = 'end',
  sideOffset = 8,
  className,
  onMouseEnter,
  onMouseLeave,
  onPointerEnter,
  onPointerLeave,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...rest
}: {
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  className?: string
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>
  onPointerEnter?: React.PointerEventHandler<HTMLDivElement>
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
  'data-lang-switcher-panel'?: string
}) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        {...rest}
        className={cn(
          'z-[1350] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow-popover)] outline-none',
          className,
        )}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  )
}

export const Collapsible = RadixCollapsible.Root
export const CollapsibleTrigger = RadixCollapsible.Trigger
export const CollapsibleContent = RadixCollapsible.Content

/* ---------------- Inline Alert Callout ---------------- */
type CalloutTone = 'info' | 'warning' | 'danger' | 'success'

const CALLOUT_CLS: Record<CalloutTone, string> = {
  info: 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--text-primary)]',
  warning: 'border-amber-500/30 bg-amber-500/8 text-amber-900 dark:text-amber-100',
  danger: 'border-red-500/30 bg-red-500/8 text-red-900 dark:text-red-100',
  success: 'border-teal-500/30 bg-teal-500/8 text-teal-900 dark:text-teal-100',
}

export function Callout({
  tone = 'info',
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: CalloutTone
  icon?: React.ReactNode
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3.5 text-[13px] leading-relaxed',
        CALLOUT_CLS[tone],
        className,
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
