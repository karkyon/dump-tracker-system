#!/bin/bash

# 改良版プロジェクト状況確認スクリプト
# node_modulesを除外して重要なファイルのみ表示

echo "=== ダンプトラッカープロジェクト状況確認 ==="
echo "実行時刻: $(date)"
echo "現在のディレクトリ: $(pwd)"
echo ""

# プロジェクト構造確認（node_modules除外）
echo "=== プロジェクト構造 ==="
find . -type d -name "node_modules" -prune -o -type d -print | grep -v node_modules | sort
echo ""

# 重要なファイル確認
echo "=== 重要ファイル確認 ==="
important_files=(
    "package.json"
    "README.md" 
    ".gitignore"
    ".env"
    ".env.example"
    "docker-compose.yml"
    "Dockerfile"
    "tsconfig.json"
    "vite.config.ts"
    "tailwind.config.js"
)

for file in "${important_files[@]}"; do
    found_files=$(find . -name "$file" -not -path "*/node_modules/*" 2>/dev/null)
    if [ -n "$found_files" ]; then
        echo "✓ $file:"
        echo "$found_files" | sed 's/^/  /'
    else
        echo "✗ $file: 見つかりません"
    fi
done
echo ""

# package.jsonの内容確認
echo "=== Package.json情報 ==="
package_files=$(find . -name "package.json" -not -path "*/node_modules/*" 2>/dev/null)
for pkg in $package_files; do
    echo "📦 $pkg:"
    if [ -f "$pkg" ]; then
        echo "  名前: $(cat "$pkg" | grep -o '"name"[^,]*' | cut -d'"' -f4)"
        echo "  バージョン: $(cat "$pkg" | grep -o '"version"[^,]*' | cut -d'"' -f4)"
        echo "  説明: $(cat "$pkg" | grep -o '"description"[^,]*' | cut -d'"' -f4)"
    fi
    echo ""
done

# ソースファイル構造
echo "=== ソースファイル構造 ==="
echo "JavaScript/TypeScript ファイル:"
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" | head -20
echo ""

echo "設定ファイル:"
find . -type f \( -name "*.config.*" -o -name ".*rc*" -o -name "*.json" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" | head -15
echo ""

# Gitステータス
echo "=== Git状況 ==="
if [ -d ".git" ]; then
    echo "Gitリポジトリ: 初期化済み"
    echo "現在のブランチ: $(git branch --show-current 2>/dev/null || echo '不明')"
    echo "最新コミット: $(git log --oneline -1 2>/dev/null || echo 'コミットなし')"
    echo ""
    echo "ステータス:"
    git status --short 2>/dev/null || echo "Git status取得できませんでした"
    echo ""
    echo "リモートリポジトリ:"
    git remote -v 2>/dev/null || echo "リモートリポジトリ未設定"
else
    echo "Gitリポジトリ: 未初期化"
fi
echo ""

# ディスク使用量（node_modules含む/除外）
echo "=== ディスク使用量 ==="
total_size=$(du -sh . 2>/dev/null | cut -f1)
echo "総サイズ: $total_size"

if [ -d "node_modules" ] || [ -d "frontend/node_modules" ] || [ -d "backend/node_modules" ]; then
    size_without_nm=$(du -sh --exclude=node_modules . 2>/dev/null | cut -f1)
    echo "node_modules除外: $size_without_nm"
fi
echo ""

# 開発環境状況
echo "=== 開発環境確認 ==="
echo "Node.js: $(node --version 2>/dev/null || echo '未インストール')"
echo "npm: $(npm --version 2>/dev/null || echo '未インストール')"
echo "Git: $(git --version 2>/dev/null || echo '未インストール')"

# Docker確認
if command -v docker &> /dev/null; then
    echo "Docker: $(docker --version 2>/dev/null)"
    if [ -f "docker-compose.yml" ]; then
        echo "Docker Compose設定: 存在"
    fi
else
    echo "Docker: 未インストール"
fi
echo ""

# 次のステップ提案
echo "=== 次のステップ提案 ==="
if [ ! -d ".git" ]; then
    echo "🔧 Git初期化が必要です"
fi

if [ ! -f ".gitignore" ]; then
    echo "🔧 .gitignoreファイル作成が必要です"
fi

if [ ! -f "README.md" ]; then
    echo "🔧 README.mdファイル作成が必要です"  
fi

if ! git remote -v &>/dev/null || [ -z "$(git remote -v)" ]; then
    echo "🔧 GitHubリモートリポジトリ設定が必要です"
fi

echo ""
echo "=== GitHubアップロード準備完了度 ==="
checklist=(
    ".gitignore作成:$([ -f .gitignore ] && echo '✓' || echo '✗')"
    "README.md作成:$([ -f README.md ] && echo '✓' || echo '✗')"
    "Git初期化:$([ -d .git ] && echo '✓' || echo '✗')"
    "重要ファイル確認:✓"
)

for item in "${checklist[@]}"; do
    echo "  $item"
done

echo ""
echo "📋 推奨アクション:"
echo "1. 不要ファイルを.gitignoreに追加"
echo "2. READMEファイルでプロジェクト概要を記録" 
echo "3. 初回コミット作成"
echo "4. GitHubリポジトリ作成・プッシュ"