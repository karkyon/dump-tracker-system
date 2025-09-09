#!/bin/bash
# Google Drive 双方向同期スクリプト

cd "$(dirname "$0")/../.."
cd backend

echo "🔄 Google Drive と双方向同期中..."

GDRIVE_SOURCE="gdrive:Work/backend"

# 選択肢を表示
echo "同期方向を選択してください:"
echo "1) Google Drive → ローカル (ダウンロード)"
echo "2) ローカル → Google Drive (アップロード)"
echo "3) 双方向同期"
read -p "選択 (1-3): " choice

case $choice in
    1)
        echo "📥 Google Drive からダウンロード中..."
        rclone sync "$GDRIVE_SOURCE/src" "./src" --progress --retries 3
        ;;
    2)
        echo "📤 Google Drive にアップロード中..."
        rclone sync "./src" "$GDRIVE_SOURCE/src" --progress --retries 3
        ;;
    3)
        echo "🔄 双方向同期中..."
        rclone bisync "./src" "$GDRIVE_SOURCE/src" --resync --retries 3
        ;;
    *)
        echo "❌ 無効な選択です"
        exit 1
        ;;
esac

echo "✅ 同期完了"
