import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    // Transform the app and its pages while the server starts, so the first page load does not wait for them.
    warmup: {
      clientFiles: ['./src/main.tsx', './src/pages/*.tsx', './src/components/**/*.tsx'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change less often than the app: separate files stay cached by the browser between releases.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@radix-ui')) return 'ui'
          if (id.includes('date-fns') || id.includes('react-day-picker')) return 'dates'
          if (id.includes('i18next')) return 'i18n'
          if (id.includes('lucide-react')) return 'icons'
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run|@tanstack)[\\/]/.test(id)) return 'react'
          // Anything else (charts and their helpers…) stays with the pages that use it.
          return undefined
        },
      },
    },
  },
})
