import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}']
      },
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ダンプ運行記録アプリ',
        short_name: 'ダンプ運行記録',
        description: 'ダンプトラック運行記録・GPS追跡・運行管理システム',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 3002,
    host: true,
    proxy: {
      '/api': {
        target: 'https://10.1.119.244:8443',  // HTTPSに変更
        changeOrigin: true,
        secure: false,  // 自己署名証明書を許可
        rewrite: (path) => path.replace(/^\/api/, '/api/v1')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})