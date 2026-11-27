import type { Modifier } from '@dnd-kit/core'

export interface ScrollFocusOptions {
  /** Optional CSS selector inside the target element to focus without breaking smooth scroll */
  focusSelector?: string
  /** Select text inside the focused input/textarea */
  selectText?: boolean
  /** Vertical placement within the scroll container */
  align?: 'upper' | 'center' | 'nearest'
}

/**
 * Lock vertical list drag-and-drop movement strictly to the Y axis so rows
 * never wobble horizontally while reordering.
 */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
})

function alignInContainer(el: HTMLElement, align: 'upper' | 'center' | 'nearest') {
  const scrollParent = el.closest<HTMLElement>('#studio-main-scroll, #studio-pro-visual-scroll')
  if (scrollParent && typeof scrollParent.scrollTo === 'function') {
    const parentRect = scrollParent.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const relativeTop = elRect.top - parentRect.top + scrollParent.scrollTop
    let targetTop: number
    if (align === 'center') {
      targetTop = relativeTop - Math.max(24, (parentRect.height - Math.min(elRect.height, parentRect.height * 0.6)) / 2)
    } else if (align === 'nearest') {
      const visibleTop = scrollParent.scrollTop
      const visibleBottom = visibleTop + parentRect.height
      if (relativeTop >= visibleTop + 16 && relativeTop + elRect.height <= visibleBottom - 16) {
        return
      }
      targetTop = relativeTop - Math.min(84, parentRect.height * 0.16)
    } else {
      // 'upper' keeps both the card header and expanded editing fields visible in one viewport
      targetTop = relativeTop - Math.min(88, parentRect.height * 0.16)
    }
    scrollParent.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    return
  }

  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({
      behavior: 'smooth',
      block: align === 'nearest' ? 'nearest' : 'center',
    })
  }
}

/**
 * Smoothly scrolls to a newly created or targeted element, triggers the
 * `.tr-focus-flash` ring animation, and optionally focuses an inner input.
 */
export function scrollAndFocusElement(elementId: string, options: ScrollFocusOptions = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const { focusSelector, selectText = false, align = 'upper' } = options
  let attempts = 0

  const locate = () => {
    const el = document.getElementById(elementId)
    if (el) {
      alignInContainer(el, align)
      el.classList.remove('tr-focus-flash')
      void el.offsetWidth
      el.classList.add('tr-focus-flash')

      if (focusSelector) {
        const input = el.querySelector<HTMLElement>(focusSelector)
        if (input && typeof input.focus === 'function') {
          try {
            input.focus({ preventScroll: true })
          } catch {
            input.focus()
          }
          if (
            selectText &&
            (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
            typeof input.select === 'function'
          ) {
            input.select()
          }
        }
      }

      // Re-align once Radix Collapsible open transition settles so tall expanded cards are never clipped
      window.setTimeout(() => {
        if (document.body.contains(el)) {
          alignInContainer(el, align)
        }
      }, 220)
      return
    }

    if (attempts < 14) {
      attempts += 1
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(locate)
      } else {
        window.setTimeout(locate, 16)
      }
    }
  }

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(locate)
  } else {
    locate()
  }
}
