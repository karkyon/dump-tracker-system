#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
運行デバッグ生データ 週次一括出力 + バックエンドエクスポートファイル ダウンロード機能 実装パッチ

追加内容:
1. scripts/export-operation-debug-week.sh
   - 過去N日分（既定7日）の運行について GET /debug/operations/:id/full と
     同じ生データを取得し、1つのJSONファイルに集約して backend/exports/ に出力
2. backend: GET /api/v1/debug/exports（一覧）, GET /api/v1/debug/exports/:name/download（DL）
3. frontend/cms: utils/api.ts に debugAPI.getExportFiles() を追加
4. frontend/cms: 「運行・点検デバッグ」タブにエクスポートファイル一覧 + ダウンロードボタンを追加

実行方法（omega-dev上、リポジトリルートで実行）:
  cd ~/projects/dump-tracker
  python3 patch_operation_debug_export.py

成功条件: backend / frontend/cms / frontend/mobile の3プロジェクトすべてが
tsc --noEmit でコンパイルエラー0件の場合のみ、自動で git push する。
失敗時はファイル変更は残すが push は行わない。
本スクリプトは実行後（成功・失敗いずれも）自己削除する。
"""

import subprocess
import sys
import os
import stat

REPO_ROOT = os.getcwd()

DEBUG_ROUTES_FILE = os.path.join(REPO_ROOT, "backend", "src", "routes", "debugRoutes.ts")
API_UTILS_FILE = os.path.join(REPO_ROOT, "frontend", "cms", "src", "utils", "api.ts")
OPERATION_DEBUG_FILE = os.path.join(REPO_ROOT, "frontend", "cms", "src", "pages", "OperationDebug.tsx")
EXPORT_SCRIPT_FILE = os.path.join(REPO_ROOT, "scripts", "export-operation-debug-week.sh")

EXPORT_SCRIPT_CONTENT = """#!/usr/bin/env bash
# =====================================================================
# scripts/export-operation-debug-week.sh
# 過去N日分（既定7日）の運行について、開発者ツール「運行・点検デバッグ」の
# 生データ（GET /debug/operations/:id/full）と同じ内容を一括取得し、
# 1つのJSONファイルに集約して backend/exports/ に出力する。
#
# 出力先のファイルは Developer Tools > 運行・点検デバッグ タブの
# 「エクスポートファイル一覧」からブラウザでダウンロードできる。
#
# 使い方:
#   cd ~/projects/dump-tracker
#   API_USERNAME=admin API_PASSWORD=xxxx ./scripts/export-operation-debug-week.sh
#
# 環境変数:
#   BASE_URL      API ベースURL（既定: https://localhost:8443/api/v1）
#   DAYS          対象日数（既定: 7）
#   API_TOKEN     既にアクセストークンを持っている場合はこれを指定（ログイン不要）
#   API_USERNAME  API_TOKEN未指定時のログインユーザー名
#   API_PASSWORD  API_TOKEN未指定時のログインパスワード
#   EXPORT_DIR    出力先ディレクトリ（既定: backend/exports、リポジトリルートからの相対パス）
#   OUT_FILE      出力ファイルパス（既定: $EXPORT_DIR/operation_debug_<timestamp>.json）
# =====================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost:8443/api/v1}"
DAYS="${DAYS:-7}"
EXPORT_DIR="${EXPORT_DIR:-backend/exports}"
OUT_FILE="${OUT_FILE:-${EXPORT_DIR}/operation_debug_$(date +%Y%m%d_%H%M%S).json}"

command -v jq >/dev/null 2>&1 || { echo "❌ jq が必要です（apt install jq 等でインストールしてください）" >&2; exit 1; }

mkdir -p "$EXPORT_DIR"

# --- 認証 ---
if [ -z "${API_TOKEN:-}" ]; then
  if [ -z "${API_USERNAME:-}" ] || [ -z "${API_PASSWORD:-}" ]; then
    echo "❌ 環境変数 API_TOKEN か、API_USERNAME と API_PASSWORD のいずれかを設定してください" >&2
    echo "   例: API_USERNAME=admin API_PASSWORD=xxxx ./scripts/export-operation-debug-week.sh" >&2
    exit 1
  fi
  echo "🔑 ログイン中..."
  LOGIN_RES=$(curl -sk -X POST "$BASE_URL/auth/login" \\
    -H "Content-Type: application/json" \\
    -d "{\\"username\\":\\"$API_USERNAME\\",\\"password\\":\\"$API_PASSWORD\\"}")
  API_TOKEN=$(echo "$LOGIN_RES" | jq -r '.data.accessToken // empty')
  if [ -z "$API_TOKEN" ]; then
    echo "❌ ログイン失敗: $LOGIN_RES" >&2
    exit 1
  fi
  echo "✅ ログイン成功"
fi

AUTH_HEADER="Authorization: Bearer $API_TOKEN"

# --- 対象期間（過去N日〜本日） ---
if date -v-1d >/dev/null 2>&1; then
  START_DATE=$(date -v-"${DAYS}"d +%Y-%m-%d)   # macOS / BSD date
else
  START_DATE=$(date -d "-${DAYS} days" +%Y-%m-%d)  # GNU date (Linux)
fi
END_DATE=$(date +%Y-%m-%d)
echo "📅 対象期間: ${START_DATE} 〜 ${END_DATE}"

# --- 対象運行IDをページネーションで全件取得 ---
ALL_IDS_FILE=$(mktemp)
trap 'rm -f "$ALL_IDS_FILE"' EXIT

PAGE=1
TOTAL_PAGES=1
while [ "$PAGE" -le "$TOTAL_PAGES" ]; do
  RES=$(curl -sk -H "$AUTH_HEADER" \\
    "${BASE_URL}/operations?startDate=${START_DATE}&endDate=${END_DATE}&page=${PAGE}&limit=100")
  echo "$RES" | jq -r '.data.data[]?.id // empty' >> "$ALL_IDS_FILE"
  TP=$(echo "$RES" | jq -r '.data.pagination.totalPages // 1')
  TOTAL_PAGES="${TP:-1}"
  echo "  📄 ページ ${PAGE}/${TOTAL_PAGES} 取得"
  PAGE=$((PAGE + 1))
done

COUNT=$(wc -l < "$ALL_IDS_FILE" | tr -d ' ')
echo "🔍 対象運行: ${COUNT}件"

if [ "$COUNT" -eq 0 ]; then
  echo "[]" > "$OUT_FILE"
  echo "⚠️ 該当する運行がありませんでした: ${OUT_FILE}"
  exit 0
fi

echo "📦 生データ取得中..."

{
  echo "["
  FIRST=true
  while IFS= read -r OPID; do
    [ -z "$OPID" ] && continue
    DETAIL=$(curl -sk -H "$AUTH_HEADER" "${BASE_URL}/debug/operations/${OPID}/full")
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      echo ","
    fi
    echo "$DETAIL" | jq '.data // .'
    echo "  ✅ ${OPID}" >&2
  done < "$ALL_IDS_FILE"
  echo "]"
} > "$OUT_FILE"

echo "🎉 完了: ${OUT_FILE}（${COUNT}件）"
echo "   Developer Tools > 運行・点検デバッグ > エクスポートファイル一覧 からダウンロードできます"
"""

PATCHES = []

# --- パッチ1: backend — エクスポートファイル一覧・ダウンロードAPI追加 ---
PATCHES.append((
    DEBUG_ROUTES_FILE,
    """export default router;""",
    """// ============================================================
// ✅ エクスポートファイル一覧・ダウンロード API (ADMIN専用)
// ============================================================
// backend/exports/ 配下に生成された一括エクスポートファイル
// （例: scripts/export-operation-debug-week.sh の出力）を一覧・DLする。

router.get(
  '/exports',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const exportDir = nodePath.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      return sendSuccess(res as any, { files: [], total: 0 });
    }
    const files = fs.readdirSync(exportDir)
      .filter((f: string) => !f.startsWith('.'))
      .map((f: string) => {
        const fp = nodePath.join(exportDir, f);
        const stat = fs.statSync(fp);
        return { name: f, sizeMB: (stat.size / 1024 / 1024).toFixed(2), createdAt: stat.mtime.toISOString() };
      })
      .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
    return sendSuccess(res as any, { files, total: files.length });
  })
);

router.get(
  '/exports/:name/download',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { name } = req.params;
    if (!name || name.includes('..') || name.includes('/')) {
      return sendError(res as any, '無効なファイル名', 400);
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const exportDir = nodePath.join(process.cwd(), 'exports');
    const filePath = nodePath.join(exportDir, name);
    if (!fs.existsSync(filePath)) {
      return sendError(res as any, 'ファイルが見つかりません', 404);
    }
    return (res as any).download(filePath, name);
  })
);

export default router;"""
))

# --- パッチ2: frontend — debugAPI にエクスポート一覧取得を追加 ---
PATCHES.append((
    API_UTILS_FILE,
    """  /**
   * 運行履歴完全デバッグ情報取得
   */
  async getOperationDebugInfo(operationId: string): Promise<ApiResponse<any>> {
    console.log('[Debug API] Get operation debug info', { operationId });
    return apiClient.get(`/debug/operations/${operationId}/full`);
  }
};""",
    """  /**
   * 運行履歴完全デバッグ情報取得
   */
  async getOperationDebugInfo(operationId: string): Promise<ApiResponse<any>> {
    console.log('[Debug API] Get operation debug info', { operationId });
    return apiClient.get(`/debug/operations/${operationId}/full`);
  },

  /**
   * エクスポートファイル一覧取得（backend/exports/ 配下の一括出力ファイル）
   */
  async getExportFiles(): Promise<ApiResponse<any>> {
    return apiClient.get('/debug/exports');
  }
};"""
))

# --- パッチ3: frontend — OperationDebug.tsx import に Download 追加 ---
PATCHES.append((
    OPERATION_DEBUG_FILE,
    """import { 
  Search, FileText, CheckCircle, XCircle, AlertCircle, 
  ChevronDown, ChevronUp, MapPin, Clock, Fuel, Coffee,
  Truck, Navigation, Package, Play, Square, ClipboardCheck
} from 'lucide-react';""",
    """import { 
  Search, FileText, CheckCircle, XCircle, AlertCircle, 
  ChevronDown, ChevronUp, MapPin, Clock, Fuel, Coffee,
  Truck, Navigation, Package, Play, Square, ClipboardCheck, Download
} from 'lucide-react';"""
))

# --- パッチ4: frontend — state追加 + fetch/downloadハンドラ追加 ---
PATCHES.append((
    OPERATION_DEBUG_FILE,
    """  const [showRecentOperations, setShowRecentOperations] = useState(true);
  const [showInspectionItems, setShowInspectionItems] = useState(true);
  const [showOperationTimeline, setShowOperationTimeline] = useState(true);
  const [showRawData, setShowRawData] = useState(false);

  // =====================================
  // API呼び出し
  // =====================================""",
    """  const [showRecentOperations, setShowRecentOperations] = useState(true);
  const [showInspectionItems, setShowInspectionItems] = useState(true);
  const [showOperationTimeline, setShowOperationTimeline] = useState(true);
  const [showRawData, setShowRawData] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const [exportFiles, setExportFiles] = useState<{ name: string; sizeMB: string; createdAt: string }[]>([]);

  // =====================================
  // API呼び出し
  // =====================================

  const fetchExportFiles = async () => {
    try {
      const response = await debugAPI.getExportFiles();
      const files = (response.data as any)?.data?.files || (response.data as any)?.files || [];
      setExportFiles(files);
    } catch (error) {
      console.error('❌ エクスポートファイル一覧取得エラー:', error);
    }
  };

  const handleDownloadExport = async (name: string) => {
    try {
      const res = await apiClient.get(`/debug/exports/${encodeURIComponent(name)}/download`, { responseType: 'blob' }) as any;
      const blob = new Blob([res.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(`ダウンロード失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  };"""
))

# --- パッチ5: frontend — エクスポートファイル一覧UIを追加 ---
PATCHES.append((
    OPERATION_DEBUG_FILE,
    """      {/* 結果がない場合のメッセージ */}
      {!isLoading && inspectionItems.length === 0 && !operationDetails && operationId && (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          検索結果がありません。運行IDを確認してください。
        </div>
      )}
    </div>
  );
};

export default OperationDebug;""",
    """      {/* 結果がない場合のメッセージ */}
      {!isLoading && inspectionItems.length === 0 && !operationDetails && operationId && (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          検索結果がありません。運行IDを確認してください。
        </div>
      )}

      {/* エクスポートファイル一覧（backend/exports/ 配下の一括出力ファイル） */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <button
          onClick={() => { setShowExports(v => !v); if (!showExports) fetchExportFiles(); }}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {showExports ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>エクスポートファイル一覧（backend/exports/）</span>
        </button>
        {showExports && (
          <div className="mt-3 space-y-1">
            {exportFiles.length === 0 ? (
              <p className="text-xs text-gray-400">エクスポートファイルがありません</p>
            ) : (
              exportFiles.map(f => (
                <div key={f.name} className="flex items-center gap-3 text-xs text-gray-600 py-1 border-b border-gray-100">
                  <span className="flex-1 font-mono truncate">{f.name}</span>
                  <span className="text-gray-400">{f.sizeMB}MB</span>
                  <span className="text-gray-400">{new Date(f.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
                  <button
                    onClick={() => handleDownloadExport(f.name)}
                    title="ダウンロード"
                    className="flex items-center gap-1 px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationDebug;"""
))


def fail(msg: str):
    print(f"❌ {msg}")
    self_delete()
    sys.exit(1)


def apply_patches():
    cache = {}
    for path_, old, new in PATCHES:
        if path_ not in cache:
            if not os.path.isfile(path_):
                fail(f"対象ファイルが見つかりません: {path_}")
            with open(path_, "r", encoding="utf-8") as f:
                cache[path_] = f.read()

        content = cache[path_]
        count = content.count(old)
        if count == 0:
            fail(f"アンカー文字列が見つかりません（{path_}）。ファイルが想定と異なります。修正を中断しました。")
        if count > 1:
            fail(f"アンカー文字列が複数箇所にマッチしました（{count}件, {path_}）。一意になるよう確認してください。")
        cache[path_] = content.replace(old, new)

    for path_, content in cache.items():
        with open(path_, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"✅ パッチを適用しました: {path_}")

    # 新規ファイル: 一括出力スクリプト
    os.makedirs(os.path.dirname(EXPORT_SCRIPT_FILE), exist_ok=True)
    with open(EXPORT_SCRIPT_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(EXPORT_SCRIPT_CONTENT)
    st = os.stat(EXPORT_SCRIPT_FILE)
    os.chmod(EXPORT_SCRIPT_FILE, st.st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    print(f"✅ 新規ファイルを作成しました: {EXPORT_SCRIPT_FILE}")


def run_tsc(subdir: str) -> int:
    path_ = os.path.join(REPO_ROOT, subdir)
    tsc_bin = os.path.join(path_, "node_modules", ".bin", "tsc")
    if not os.path.isfile(tsc_bin):
        fail(f"tsc が見つかりません: {tsc_bin}")
    print(f"🔎 コンパイルチェック中: {subdir} ...")
    result = subprocess.run(
        [tsc_bin, "--noEmit"],
        cwd=path_,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"--- {subdir} コンパイルエラー ---")
        print(result.stdout)
        print(result.stderr)
    return result.returncode


def self_delete():
    try:
        os.remove(__file__)
        print(f"🧹 パッチスクリプトを自己削除しました: {__file__}")
    except Exception as e:
        print(f"⚠️ 自己削除に失敗しました（手動削除してください）: {e}")


def main():
    apply_patches()

    targets = ["backend", "frontend/cms", "frontend/mobile"]
    rc_total = 0
    for t in targets:
        rc = run_tsc(t)
        print(f"  → {t}: RC={rc}")
        rc_total += rc

    if rc_total != 0:
        print("❌ コンパイルエラーが残っているため push を中止しました。")
        print("   ファイルへの修正は適用済みです。エラー内容を確認し再修正してください。")
        self_delete()
        sys.exit(1)

    print("✅ 全プロジェクト（backend / frontend/cms / frontend/mobile）でコンパイルエラー0件を確認しました。")

    commit_msg = "feat(debug): 運行デバッグ生データの週次一括出力スクリプト + バックエンドエクスポートファイルのDL機能を追加"

    subprocess.run(["git", "add", "-A"], cwd=REPO_ROOT, check=True)
    commit = subprocess.run(["git", "commit", "-m", commit_msg], cwd=REPO_ROOT, capture_output=True, text=True)
    print(commit.stdout)
    print(commit.stderr)

    push = subprocess.run(["git", "push"], cwd=REPO_ROOT, capture_output=True, text=True)
    print(push.stdout)
    print(push.stderr)

    if push.returncode != 0:
        print("❌ git push に失敗しました。手動で確認してください（コミット自体は作成済みです）。")
        self_delete()
        sys.exit(1)

    print("🚀 GitHubへのpushが完了しました。")
    self_delete()


if __name__ == "__main__":
    main()
