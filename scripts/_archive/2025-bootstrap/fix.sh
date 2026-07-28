#!/bin/bash

# frontend/mobile ディレクトリ構成の修正スクリプト

echo "📱 モバイルアプリディレクトリ構成の修正を開始します..."

# 作業ディレクトリに移動
cd frontend/mobile

# 不要なHTMLファイルを削除
echo "🗑️ 不要なHTMLファイルを削除中..."
rm -f login.html operation.html

# 適切なReact構成を作成
echo "📁 適切なReactディレクトリ構成を作成中..."

# srcディレクトリ構成
mkdir -p src/{components,pages,hooks,services,store,types,utils,styles}

# components配下の詳細構成
mkdir -p src/components/{common,layout,mobile}

# pages配下の詳細構成
mkdir -p src/pages/{auth,operation,monitoring}

# services配下の詳細構成
mkdir -p src/services/{api,gps,location}

# モバイル特有のディレクトリ
mkdir -p src/{assets,contexts,constants}

# 公開ディレクトリ構成
mkdir -p public/{icons,images}

echo "✅ ディレクトリ構成の修正が完了しました"

# 構成を表示
echo "📋 新しいディレクトリ構成:"
tree -I 'node_modules' -a || find . -type d | sort