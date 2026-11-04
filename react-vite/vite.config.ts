import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      // Release notes live in the repository's docs/ and are bundled into the app.
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        fileURLToPath(new URL('../docs/release-notes', import.meta.url)),
      ],
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})
