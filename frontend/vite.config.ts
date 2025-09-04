import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../web/dist',
    sourcemap: true
  },
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['monaco-editor']
  },
  worker: {
    format: 'es'
  }
})