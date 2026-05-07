import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        translator: resolve(__dirname, 'index.html'),
        appstore:   resolve(__dirname, 'appstore.html'),
      },
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 3000,
    // Allow dev server to be accessed from Even Hub iOS simulator
    host: true,
  },
})
