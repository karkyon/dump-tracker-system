#!/bin/bash
# fix-typescript-errors.sh
# TypeScriptエラーを一括修正するスクリプト

set -e  # エラーが発生したら終了

echo "=================================================="
echo "🔧 TypeScriptエラー一括修正スクリプト"
echo "=================================================="
echo ""

# カレントディレクトリの確認
if [ ! -d "frontend/cms" ]; then
  echo "❌ エラー: frontend/cms ディレクトリが見つかりません"
  echo "   プロジェクトのルートディレクトリで実行してください"
  exit 1
fi

cd frontend/cms

echo "📍 作業ディレクトリ: $(pwd)"
echo ""

# ステップ1: パッケージインストール
echo "=================================================="
echo "📦 ステップ1: 欠けているパッケージをインストール"
echo "=================================================="
echo ""

if ! npm list clsx > /dev/null 2>&1 || ! npm list tailwind-merge > /dev/null 2>&1; then
  echo "📦 clsx と tailwind-merge をインストール中..."
  npm install clsx tailwind-merge
  echo "✅ パッケージインストール完了"
else
  echo "✅ 必要なパッケージは既にインストールされています"
fi
echo ""

# ステップ2: バックアップ作成
echo "=================================================="
echo "💾 ステップ2: バックアップを作成"
echo "=================================================="
echo ""

BACKUP_DIR="src_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 バックアップディレクトリ: $BACKUP_DIR"

if [ -f "src/types/index.ts" ]; then
  cp src/types/index.ts "$BACKUP_DIR/types_index.ts"
  echo "✅ types/index.ts をバックアップ"
fi

if [ -f "src/utils/index.ts" ]; then
  cp src/utils/index.ts "$BACKUP_DIR/utils_index.ts"
  echo "✅ utils/index.ts をバックアップ"
fi

echo "✅ バックアップ完了: $BACKUP_DIR"
echo ""

# ステップ3: 型定義ファイルの更新
echo "=================================================="
echo "📝 ステップ3: 型定義ファイルを更新"
echo "=================================================="
echo ""

if [ -f "../../types_index_FIXED.ts" ]; then
  cp ../../types_index_FIXED.ts src/types/index.ts
  echo "✅ types/index.ts を更新"
else
  echo "⚠️  警告: types_index_FIXED.ts が見つかりません"
  echo "   手動で src/types/index.ts を更新してください"
fi
echo ""

# ステップ4: utils/index.ts の作成
echo "=================================================="
echo "🛠️ ステップ4: utils/index.ts を作成"
echo "=================================================="
echo ""

cat > src/utils/index.ts << 'EOF'
// frontend/cms/src/utils/index.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSSのクラス名を結合してマージ
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

echo "✅ utils/index.ts を作成"
echo ""

# ステップ5: TypeScriptチェック
echo "=================================================="
echo "✅ ステップ5: TypeScriptをチェック"
echo "=================================================="
echo ""

echo "🔍 TypeScriptのエラーをチェック中..."
echo ""

if npx tsc --noEmit 2>&1 | tee typescript-errors.log; then
  echo ""
  echo "🎉 TypeScriptエラーなし！"
  ERRORS=0
else
  ERRORS=$(grep -c "error TS" typescript-errors.log || echo "0")
  echo ""
  echo "⚠️  まだ $ERRORS 個のエラーが残っています"
  echo ""
  echo "📝 詳細は typescript-errors.log を確認してください"
fi

echo ""
echo "=================================================="
echo "🎉 自動修正完了！"
echo "=================================================="
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "📋 次のステップ:"
  echo "1. typescript-errors.log でエラー内容を確認"
  echo "2. TYPESCRIPT_FIX_GUIDE.md の手動修正手順を参照"
  echo "3. 各ファイルを個別に修正"
  echo ""
  echo "主な残りのエラー:"
  echo "- APIレスポンス形式の不一致"
  echo "- コンポーネントのプロパティ型"
  echo "- 未使用変数の削除"
else
  echo "✅ すべてのエラーが解決されました！"
  echo ""
  echo "次のステップ:"
  echo "1. npm run dev でサーバーを起動"
  echo "2. ブラウザで動作確認"
fi

echo ""
echo "💾 バックアップ場所: $BACKUP_DIR"
echo "📄 ログファイル: typescript-errors.log"
echo ""