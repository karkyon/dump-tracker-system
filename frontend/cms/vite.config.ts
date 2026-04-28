import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// mkcert証明書が存在するか確認
const certDir = path.resolve(__dirname, '../../backend/.cert')
const keyFile = path.join(certDir, 'localhost-key.pem')
const certFile = path.join(certDir, 'localhost-cert.pem')
const hasHttps = fs.existsSync(keyFile) && fs.existsSync(certFile)

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
        target: 'https://10.1.119.244:8443',
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
