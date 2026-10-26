// frontend/mobile/vite.config.ts
// Vite ビルド設定 - ✅ HTTPS対応修正版

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

// 開発用プロキシ先。IPアドレスのハードコードを避け、環境変数 or localhost にフォールバック
const devBackendTarget = process.env.VITE_DEV_PROXY_TARGET || 'https://localhost:8443';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 🔧 selfDestroying: スマホの古いSWキャッシュを完全削除させる
      // これにより毎回サーバーから最新JSを取得するようになる
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png'],
      manifest: {
        name: 'スマートダンプ',
        short_name: 'スマートダンプ',
        description: 'スマートダンプ - ダンプトラック運行記録・GPS追跡・運行管理',
        theme_color: '#0CC1E0',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5分
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/maps\.googleapis\.com/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-maps-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 24 * 60 * 60, // 24時間
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3002,
    host: '0.0.0.0', // すべてのIPからアクセス可能
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '.cert/localhost-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '.cert/localhost-cert.pem')),
    },
    proxy: {
      '/api': {
        target: devBackendTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'react-hot-toast'],
          'state-vendor': ['zustand', 'axios'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});