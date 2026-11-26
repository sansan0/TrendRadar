import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Component tests run in a DOM emulator, without launching or automating a browser.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
for (const key of ['window', 'Window', 'document', 'DocumentFragment', 'navigator', 'localStorage', 'HTMLElement', 'Element',
  'Node', 'NodeFilter', 'MutationObserver', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLFormElement',
  'HTMLSelectElement', 'HTMLOptionElement', 'HTMLButtonElement',
  'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'getComputedStyle']) {
  if (dom.window[key] !== undefined) {
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
  }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
dom.window.HTMLElement.prototype.scrollTo = function ({ top = 0, left = 0 }) {
  this.scrollTop = top
  this.scrollLeft = left
}
// jsdom has no layout; these tests assert state, focus and DOM content, not geometry.
const rect = { x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }
dom.window.Range.prototype.getBoundingClientRect = () => rect
dom.window.Range.prototype.getClientRects = () => []
globalThis.CSS = { escape: (value) => String(value).replace(/[^\w-]/g, (char) => `\\${char}`) }

const server = await createServer({
  root, configFile: false, server: { middlewareMode: true, watch: null },
  resolve: { alias: { '@': path.join(root, 'src') } },
  esbuild: { jsx: 'automatic' },
})
try {
  const { runComponentTests } = await server.ssrLoadModule('/src/__tests__/editor-integration.test.tsx')
  const result = await runComponentTests()
  assert.equal(result.failed, 0, `${result.failed} component regression(s) failed`)
} finally {
  await server.close()
  dom.window.close()
}
