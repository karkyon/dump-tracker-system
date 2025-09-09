FROM node:18-alpine

WORKDIR /app

# パッケージファイルコピー
COPY package*.json ./

# 依存関係インストール
RUN npm ci --only=production

# アプリケーションコピー
COPY . .

# TypeScriptビルド
RUN npm run build

# ポート公開
EXPOSE 8000

# 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

# アプリケーション起動
CMD ["npm", "start"]
