import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const editorRoot = path.resolve(__dirname, '..')
const viteBin = path.join(editorRoot, 'node_modules', 'vite', 'bin', 'vite.js')

execFileSync(process.execPath, [viteBin, 'build', '--configLoader', 'native'], {
  cwd: editorRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    EDITOR_SINGLE_FILE: 'true',
  },
})
