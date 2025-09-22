#!/bin/bash
# HTTPS設定スクリプト for DumpTracker

echo "🔐 DumpTracker HTTPSサーバー設定を開始..."

# バックエンドディレクトリに移動
cd backend

# SSLディレクトリ作成
mkdir -p ssl

# 自己署名証明書の生成（開発環境用）
echo "📄 自己署名SSL証明書を生成中..."
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
  -subj "/C=JP/ST=Osaka/L=Toyonaka/O=DumpTracker/OU=Development/CN=10.1.119.244"

# 証明書ファイルの権限設定
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem

echo "✅ SSL証明書が生成されました"
echo "   - 秘密鍵: backend/ssl/key.pem"
echo "   - 証明書: backend/ssl/cert.pem"

# .envファイルの更新
echo "📝 環境変数を設定中..."
cat > .env << EOF
# DumpTracker Backend Environment Variables
NODE_ENV=development
PORT=8443
HTTPS_ENABLED=true

# データベース設定
DATABASE_URL=postgresql://localhost:5432/dump_tracker

# JWT設定
JWT_SECRET=dumptracker_super_secret_key_2025_development
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# CORS設定
CORS_ORIGIN=https://10.1.119.244:3000

# ファイルアップロード
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# メール設定（開発環境用）
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@dumptracker.com

# ログレベル
LOG_LEVEL=info
EOF

echo "✅ バックエンド環境変数が設定されました"

# フロントエンド環境変数の更新
cd ../frontend
echo "📝 フロントエンド環境変数を設定中..."
cat > .env.local << EOF
# DumpTracker Frontend Environment Variables
VITE_API_BASE_URL=https://10.1.119.244:8443
VITE_APP_NAME=DumpTracker CMS
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=development
EOF

echo "✅ フロントエンド環境変数が設定されました"

# ファイアウォール設定（Ubuntu/CentOS用）
echo "🔥 ファイアウォール設定..."
if command -v ufw &> /dev/null; then
    # Ubuntu
    sudo ufw allow 8443/tcp
    echo "✅ UFWでポート8443を許可しました"
elif command -v firewall-cmd &> /dev/null; then
    # CentOS/RHEL
    sudo firewall-cmd --permanent --add-port=8443/tcp
    sudo firewall-cmd --reload
    echo "✅ firewalldでポート8443を許可しました"
else
    echo "⚠️  ファイアウォール設定を手動で行ってください（ポート8443/tcp）"
fi

echo ""
echo "🎉 HTTPS設定完了！"
echo ""
echo "📋 設定内容:"
echo "   - HTTPSポート: 8443"
echo "   - HTTPポート: 8000 (フォールバック)"
echo "   - SSL証明書: 自己署名（開発用）"
echo "   - フロントエンドURL: https://10.1.119.244:8443"
echo ""
echo "🚀 サーバー起動方法:"
echo "   cd backend && npm start"
echo ""
echo "⚠️  注意事項:"
echo "   - 自己署名証明書のため、ブラウザで「安全でない」警告が表示されます"
echo "   - 本番環境では正規のSSL証明書を使用してください"
echo "   - 初回アクセス時に証明書を信頼する設定が必要です"