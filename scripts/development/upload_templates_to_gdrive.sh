#!/bin/bash
# Google Drive テンプレートアップロードスクリプト

cd "$(dirname "$0")/../.."
cd backend

echo "📤 テンプレートファイルをGoogle Driveにアップロード中..."

# rclone確認
if ! command -v rclone >/dev/null 2>&1; then
    echo "❌ rclone がインストールされていません"
    exit 1
fi

# gdrive設定確認
if ! rclone listremotes | grep -q "gdrive:"; then
    echo "❌ gdrive リモートが設定されていません"
    exit 1
fi

# Google Drive のターゲットディレクトリ
GDRIVE_TARGET="gdrive:Work/backend"

echo "🗂️ Google Drive ディレクトリ構造を作成中..."

# ディレクトリ構造作成
rclone mkdir "$GDRIVE_TARGET/src/config"
rclone mkdir "$GDRIVE_TARGET/src/routes"
rclone mkdir "$GDRIVE_TARGET/src/controllers"
rclone mkdir "$GDRIVE_TARGET/src/models"
rclone mkdir "$GDRIVE_TARGET/src/services"
rclone mkdir "$GDRIVE_TARGET/src/middleware"
rclone mkdir "$GDRIVE_TARGET/src/utils"
rclone mkdir "$GDRIVE_TARGET/src/database"
rclone mkdir "$GDRIVE_TARGET/src/validators"
rclone mkdir "$GDRIVE_TARGET/src/types"

echo "📤 ファイルをアップロード中..."

# 全ファイルをGoogle Driveにアップロード
find src -name "*.ts" -type f | while read file; do
    echo "  アップロード: $file"
    rclone copy "$file" "$GDRIVE_TARGET/$(dirname "$file")/" --retries 3
done

# ルートファイル
if [ -f "README.md" ]; then
    rclone copy "README.md" "$GDRIVE_TARGET/"
fi

echo "✅ Google Drive アップロード完了"
echo ""
echo "📋 Google Drive でファイルを編集してください:"
echo "  URL: https://drive.google.com/drive/folders/Work/backend"
echo ""
echo "編集後、以下のコマンドでダウンロード:"
echo "  ./1_backend_environment_setup.sh"
