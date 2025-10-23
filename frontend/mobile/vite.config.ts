// frontend/mobile/vite.config.ts
// Vite ビルド設定 - ✅ HTTPS対応修正版

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'favicon.ico'],
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
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
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
        target: 'https://10.1.119.244:8443',
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