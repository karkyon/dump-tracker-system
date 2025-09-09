# ビルドステージ
FROM node:18-alpine as builder

WORKDIR /app

# 依存関係インストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコピー
COPY . .

# ビルド
RUN npm run build

# 本番環境
FROM nginx:alpine

# ビルドされたファイルをnginxにコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx設定
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
