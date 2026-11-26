import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isSingleFile = process.env.EDITOR_SINGLE_FILE === 'true'

export default defineConfig({
  base: './',
  cacheDir: '.vite',
  plugins: [
    react(),
    tailwindcss(),
    ...(isSingleFile
      ? [
          viteSingleFile({
            removeViteModuleLoader: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5178,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: isSingleFile ? 'dist-single' : 'dist',
    emptyOutDir: true,
    cssCodeSplit: !isSingleFile,
    assetsInlineLimit: isSingleFile ? 100_000_000 : 4096,
    target: 'es2020',
    reportCompressedSize: true,
    ...(isSingleFile
      ? {}
      : {
          rollupOptions: {
            output: {
              manualChunks(id) {
                if (!id.includes('node_modules')) return undefined
                if (
                  id.includes('@codemirror') ||
                  id.includes('@lezer') ||
                  id.includes('/codemirror/')
                ) {
                  return 'vendor-codemirror'
                }
                if (
                  id.includes('/react/') ||
                  id.includes('/react-dom/') ||
                  id.includes('/scheduler/') ||
                  id.includes('@radix-ui')
                ) {
                  return 'vendor-ui'
                }
                if (id.includes('@dnd-kit') || id.includes('/yaml/') || id.includes('/fflate/')) {
                  return 'vendor-tools'
                }
                return undefined
              },
            },
          },
        }),
  },
})
