import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// mkcert証明書が存在するか確認
const certDir = path.resolve(__dirname, '../../backend/.cert')
const keyFile = path.join(certDir, 'localhost-key.pem')
const certFile = path.join(certDir, 'localhost-cert.pem')
const hasHttps = fs.existsSync(keyFile) && fs.existsSync(certFile)

// 開発用プロキシ先。IPアドレスのハードコードを避け、環境変数 or localhost にフォールバック
const devBackendTarget = process.env.VITE_DEV_PROXY_TARGET || 'https://localhost:8443'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0',
    https: hasHttps ? {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile),
    } : undefined,
    proxy: {
      '/api/v1': {
        target: devBackendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: devBackendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
