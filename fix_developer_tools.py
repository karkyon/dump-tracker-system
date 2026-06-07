#!/usr/bin/env python3
"""
Developer Tools 統合リファクタリング
実行方法: python3 ~/projects/dump-tracker/fix_developer_tools.py
"""
import os, shutil, sys

BASE = os.path.expanduser("~/projects/dump-tracker")
WORK = os.path.dirname(os.path.abspath(__file__))

def write_from_work(src_name, dest_rel):
    src = os.path.join(WORK, src_name)
    dest = os.path.join(BASE, dest_rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copyfile(src, dest)
    print(f"OK write: {dest}")

def patch(rel_path, old, new):
    path = os.path.join(BASE, rel_path)
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    if old not in c:
        print(f"WARN not found: {rel_path}")
        print(f"  target (first 80): {repr(old[:80])}")
        return False
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c.replace(old, new, 1))
    print(f"OK patch: {rel_path}")
    return True

# =========================================================
# ファイルコピー（既にwork/に生成済み）
# =========================================================
write_from_work("logRoutes.ts",     "backend/src/routes/logRoutes.ts")
write_from_work("DeveloperTools.tsx", "frontend/cms/src/pages/DeveloperTools.tsx")

# =========================================================
# constants.ts — GPS Inspector / ログビューア / 運行デバッグ → 開発者ツール統合
# =========================================================
patch("frontend/cms/src/utils/constants.ts",
    """  {
    id: 'gps-inspector',
    name: 'GPS Inspector',
    path: '/gps-inspector',
    icon: 'Satellite',
    adminOnly: true
  },
  {
    id: 'log-viewer',
    name: 'ログビューア',
    path: '/log-viewer',
    icon: 'Bug',
    adminOnly: true
  },
  // デバッグメニュー（管理者専用）
  {
    id: 'debug',
    name: '運行・点検デバッグ',
    path: '/debug/operations',
    icon: 'Bug',
    adminOnly: true  // 管理者のみ表示
  },""",
    """  // 開発者ツール統合ページ（ADMIN専用）
  {
    id: 'developer',
    name: '開発者ツール',
    path: '/developer',
    icon: 'Bug',
    adminOnly: true,
  },"""
)

# =========================================================
# App.tsx — import 追加 + /developer ルート追加
# =========================================================
patch("frontend/cms/src/App.tsx",
    "import LogViewer from './pages/LogViewer';",
    "import LogViewer from './pages/LogViewer';\nimport DeveloperTools from './pages/DeveloperTools';"
)

patch("frontend/cms/src/App.tsx",
    """              {/* ログビューア（管理者専用） */}
              <Route path="log-viewer" element={<LogViewer />} />

              {/* GPS Inspector（管理者専用） */}
              <Route path="gps-inspector" element={<GpsInspector />} />

              {/* 🛠️ UAT準備 データクリーンアップ（ADMIN専用） */}
              <Route path="dev/data-cleanup" element={<DevDataCleanup />} />""",
    """              {/* ログビューア（後方互換 URL） */}
              <Route path="log-viewer" element={<LogViewer />} />
              {/* GPS Inspector（後方互換 URL） */}
              <Route path="gps-inspector" element={<GpsInspector />} />
              {/* データクリーンアップ（後方互換 URL） */}
              <Route path="dev/data-cleanup" element={<DevDataCleanup />} />
              {/* 🛠️ 開発者ツール統合ページ（ADMIN専用） */}
              <Route path="developer" element={<DeveloperTools />} />"""
)

# =========================================================
# SystemSettings.tsx — 連携設定タブを削除（開発者ツールに移動）
# =========================================================
patch("frontend/cms/src/pages/SystemSettings.tsx",
    """  const tabs = [
    { id: 'general',   label: '一般設定',   icon: Settings      },
    { id: 'operation', label: '運行設定',   icon: Settings      },  // 🆕 離脱検知距離等
    { id: 'business',  label: '事業者情報', icon: Building2     },
    { id: 'logs',      label: 'ログ管理',   icon: AlertTriangle },
    { id: 'integration', label: '連携設定',   icon: Link2 },
  ];""",
    """  const tabs = [
    { id: 'general',   label: '一般設定',   icon: Settings      },
    { id: 'operation', label: '運行設定',   icon: Settings      },
    { id: 'business',  label: '事業者情報', icon: Building2     },
    { id: 'logs',      label: 'ログ管理',   icon: AlertTriangle },
    // 連携設定（APIキー等）は開発者ツール (/developer) へ移動
  ];"""
)

print("\n=== 全ファイル処理完了 ===")
print("\n次のステップ（omega-dev で実行）:")
print("  cd ~/projects/dump-tracker")
print("  cd backend  && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("  cd ../frontend/cms && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("  cd ../mobile       && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("  # 全てRC=0を確認後:")
print('  git add -A && git commit -m "feat: 開発者ツール統合ページ追加・ログ退避機能・ナビ整理" && git push origin main')
