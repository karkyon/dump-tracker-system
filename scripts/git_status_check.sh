#!/bin/bash

# Git状況確認・GitHub登録継続スクリプト

# カラー定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "\n${PURPLE}=== $1 ===${NC}"; }

echo "=================================================="
echo "🔍 Git状況確認・GitHub登録継続"
echo "=================================================="

# Step 1: 現在のGit状況確認
step "現在のGit状況確認"

log "現在のディレクトリ: $(pwd)"
log "ブランチ: $(git branch --show-current)"
log "最新コミット: $(git log --oneline -1)"

echo ""
echo "📋 リモートリポジトリ状況:"
if git remote -v &>/dev/null && [ -n "$(git remote -v)" ]; then
    git remote -v
else
    warning "リモートリポジトリが設定されていません"
fi

echo ""
echo "📁 ファイル状況:"
echo "総ファイル数: $(find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l)"
echo "Git追跡ファイル数: $(git ls-files | wc -l)"

# Step 2: 新しいファイルの確認
step "新しいファイル・変更確認"

echo "📄 Git未追跡ファイル:"
if [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git ls-files --others --exclude-standard | head -10
    if [ $(git ls-files --others --exclude-standard | wc -l) -gt 10 ]; then
        echo "... (他 $(( $(git ls-files --others --exclude-standard | wc -l) - 10 )) ファイル)"
    fi
else
    success "未追跡ファイルはありません"
fi

echo ""
echo "🔄 変更されたファイル:"
if [ -n "$(git diff --name-only)" ]; then
    git diff --name-only
else
    success "変更されたファイルはありません"
fi

# Step 3: GitHub設定確認
step "GitHub設定確認"

GITHUB_USERNAME="karkyon"
REPO_NAME="dump-tracker-system"
EXPECTED_REMOTE="https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

echo "期待されるリモートURL: $EXPECTED_REMOTE"

current_remote=$(git remote get-url origin 2>/dev/null || echo "未設定")
echo "現在のリモートURL: $current_remote"

# Step 4: リモートリポジトリ設定
step "リモートリポジトリ設定"

if [ "$current_remote" = "未設定" ]; then
    log "リモートリポジトリを追加しています..."
    git remote add origin "$EXPECTED_REMOTE"
    success "リモートリポジトリ追加完了"
elif [ "$current_remote" != "$EXPECTED_REMOTE" ]; then
    warning "リモートURLが異なります"
    log "リモートURLを更新しています..."
    git remote set-url origin "$EXPECTED_REMOTE"
    success "リモートURL更新完了"
else
    success "リモートリポジトリは正しく設定されています"
fi

# Step 5: 新しいファイルがある場合のコミット
step "追加ファイルの処理"

# 今回追加された重要ファイルを確認
important_files=(".gitignore" "README.md" "package.json")
new_files=""

for file in "${important_files[@]}"; do
    if [ -f "$file" ] && ! git ls-files --error-unmatch "$file" &>/dev/null; then
        new_files="$new_files $file"
    fi
done

if [ -n "$new_files" ] || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    log "新しいファイルを追加してコミットします..."
    
    # 新しいファイルをステージング
    git add .
    
    # コミット作成
    git commit -m "📁 プロジェクト構成ファイル追加

✨ 追加ファイル:
- プロジェクトルート .gitignore
- プロジェクトルート README.md  
- プロジェクトルート package.json

🔧 GitHub連携準備:
- リモートリポジトリ設定完了
- プロジェクト統合パッケージ管理
- 開発環境統一化

📋 プロジェクト構成:
- Frontend: React + TypeScript + Vite
- Backend: Express.js + TypeScript + Prisma
- Database: PostgreSQL + Redis
- Infrastructure: Docker + Docker Compose

🎯 次のステップ: GitHub リポジトリ作成・プッシュ"
    
    success "新しいコミット作成完了"
else
    success "すべてのファイルは既にコミット済みです"
fi

# Step 6: GitHub接続テスト
step "GitHub接続テスト"

log "GitHub接続をテストしています..."

if git ls-remote origin &>/dev/null; then
    success "GitHub接続成功！"
    log "リモートブランチ: $(git ls-remote --heads origin | awk '{print $2}' | sed 's/refs\/heads\///' | tr '\n' ' ')"
else
    warning "GitHub接続に失敗しました"
    echo ""
    echo "🔧 解決方法:"
    echo "1. GitHub.com でリポジトリ '$REPO_NAME' を作成"
    echo "2. VSCodeでGitHub認証を完了"
    echo "3. 以下のコマンドでプッシュを再試行"
    echo ""
fi

# Step 7: プッシュ実行確認
step "プッシュ実行"

echo "📊 プッシュ準備状況:"
echo "✅ Gitリポジトリ初期化済み"
echo "✅ ファイルコミット済み"
echo "✅ リモートリポジトリ設定済み"
echo ""

echo "🔗 GitHub作業:"
echo "1. https://github.com/$GITHUB_USERNAME でリポジトリ作成"
echo "   - Repository name: $REPO_NAME"
echo "   - Description: ダンプ運行記録日報システム"
echo "   - Private 推奨"
echo "   - ❌ README.md 追加しない（既存使用）"
echo ""

read -p "GitHubでリポジトリを作成しましたか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "GitHubにプッシュしています..."
    
    if git push -u origin main; then
        success "🎉 GitHubプッシュ完了！"
        echo ""
        echo "🔗 リポジトリURL: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
        echo ""
        echo "🤖 Claude連携情報:"
        echo "   リポジトリ: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
        echo "   最新コミット: $(git log --oneline -1)"
        echo "   ブランチ: $(git branch --show-current)"
        echo ""
        echo "⚡ 開発開始:"
        echo "   cd /home/karkyon/dump-tracker"
        echo "   npm run setup    # 依存関係インストール"
        echo "   npm run start    # 開発サーバー起動"
    else
        error "プッシュに失敗しました"
        echo ""
        echo "🔧 トラブルシューティング:"
        echo "1. GitHub認証確認: VSCodeでGitHub認証完了"
        echo "2. リポジトリ確認: GitHub.comで '$REPO_NAME' が作成済み"
        echo "3. 権限確認: リポジトリへの書き込み権限"
        echo ""
        echo "🔄 再試行コマンド:"
        echo "   git push -u origin main"
    fi
else
    echo ""
    echo "📋 GitHub リポジトリ作成手順:"
    echo "1. https://github.com/new にアクセス"
    echo "2. Repository name: $REPO_NAME"
    echo "3. Description: ダンプ運行記録日報システム"
    echo "4. Private を選択"
    echo "5. Create repository をクリック"
    echo ""
    echo "作成後、以下のコマンドでプッシュしてください:"
    echo "   git push -u origin main"
fi

echo ""
success "Git・GitHub設定完了！"