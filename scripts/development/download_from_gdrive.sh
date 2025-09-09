#!/bin/bash
# Google Drive からファイルダウンロードスクリプト

cd "$(dirname "$0")/../.."
cd backend

echo "📥 Google Drive からファイルをダウンロード中..."

# rclone確認
if ! command -v rclone >/dev/null 2>&1; then
    echo "❌ rclone がインストールされていません"
    exit 1
fi

# Google Drive のソースディレクトリ
GDRIVE_SOURCE="gdrive:Work/backend"

# src ディレクトリ全体をダウンロード
echo "📁 src ディレクトリをダウンロード中..."
rclone sync "$GDRIVE_SOURCE/src" "./src" --progress --retries 3

# ルートファイル
echo "📄 ルートファイルをダウンロード中..."
rclone copy "$GDRIVE_SOURCE/README.md" "./" 2>/dev/null || echo "README.md not found"

echo "✅ ダウンロード完了"
