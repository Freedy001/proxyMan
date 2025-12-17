import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {visualizer} from 'rollup-plugin-visualizer'

import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    visualizer({
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/requests': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: './dist',
    sourcemap: false, // 生产环境关闭 sourcemap 减少包体积
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 移除 console.log
        drop_debugger: true, // 移除 debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug'] // 移除特定函数调用
      }
    },
    rollupOptions: {
      output: {
        // 手动分包优化
        manualChunks: {
          // Monaco Editor 单独打包
          'monaco': ['monaco-editor'],
          // Vue 及状态管理库
          'vue-vendor': ['vue', 'pinia'],
          // Markdown 渲染相关
          'markdown': ['marked', 'highlight.js'],
        },
        // 优化 chunk 文件命名
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // chunk 大小警告限制
    chunkSizeWarningLimit: 1000, // 提高到 1MB
  },
  define: {
    global: 'globalThis'
  },
  worker: {
    format: 'es'
  }
})