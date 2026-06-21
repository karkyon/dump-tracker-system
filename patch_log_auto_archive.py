#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ログ自動退避（定期チェック）実装パッチ
- backend: setInterval によるログファイルサイズ定期監視 + 自動アーカイブ実行
- frontend/cms: 「未実装」警告文を実装済み内容に更新

実行方法（omega-dev上、リポジトリルートで実行）:
  cd ~/projects/dump-tracker
  python3 patch_log_auto_archive.py

成功条件: backend / frontend/cms / frontend/mobile の3プロジェクトすべてが
tsc --noEmit でコンパイルエラー0件の場合のみ、自動で git push する。
失敗時はファイル変更は残すが push は行わない。
本スクリプトは実行後（成功・失敗いずれも）自己削除する。
"""

import subprocess
import sys
import os

REPO_ROOT = os.getcwd()

BACKEND_FILE = os.path.join(REPO_ROOT, "backend", "src", "routes", "logRoutes.ts")
FRONTEND_FILE = os.path.join(REPO_ROOT, "frontend", "cms", "src", "pages", "DeveloperTools.tsx")

# (対象ファイル, old, new)
PATCHES = []

# --- パッチ1: backend — 自動退避の定期チェック処理を追加 ---
PATCHES.append((
    BACKEND_FILE,
    """const router = Router();""",
    """const router = Router();

// =====================================
// 🗄️ 自動退避（ログファイルサイズ監視）
// =====================================
// log-config.json の autoArchiveEnabled が有効かつ combined.log のサイズが
// autoArchiveThresholdMB を超えていたら、定期チェックで自動的にアーカイブする。
// （POST /archive と同等の処理。手動アーカイブとは独立して動作）
const AUTO_ARCHIVE_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10分ごとにチェック

function performAutoArchive(): { archiveFile: string; sizeMB: string } | null {
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  const archiveDir = path.join(process.cwd(), 'logs', 'archives');
  if (!fs.existsSync(logPath)) return null;
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivePath = path.join(archiveDir, `combined-${stamp}.log`);
  const stat = fs.statSync(logPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
  fs.copyFileSync(logPath, archivePath);
  fs.writeFileSync(logPath, '');
  const configPath = path.join(process.cwd(), 'logs', 'log-config.json');
  let maxArchives = 10;
  if (fs.existsSync(configPath)) {
    try { maxArchives = JSON.parse(fs.readFileSync(configPath, 'utf-8')).maxArchives ?? 10; } catch {}
  }
  const archives = fs.readdirSync(archiveDir)
    .filter(f => f.startsWith('combined-') && f.endsWith('.log')).sort();
  if (archives.length > maxArchives) {
    archives.slice(0, archives.length - maxArchives).forEach(f => {
      try { fs.unlinkSync(path.join(archiveDir, f)); } catch {}
    });
  }
  return { archiveFile: path.basename(archivePath), sizeMB };
}

function checkAutoArchive(): void {
  try {
    const configPath = path.join(process.cwd(), 'logs', 'log-config.json');
    const defaults = { maxFileSizeMB: 50, maxArchives: 10, autoArchiveEnabled: false, autoArchiveThresholdMB: 100, retentionDays: 30 };
    let config: any = defaults;
    if (fs.existsSync(configPath)) {
      try { config = { ...defaults, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) }; } catch {}
    }
    if (!config.autoArchiveEnabled) return;

    const logPath = path.join(process.cwd(), 'logs', 'combined.log');
    if (!fs.existsSync(logPath)) return;
    const stat = fs.statSync(logPath);
    const sizeMB = stat.size / 1024 / 1024;
    if (sizeMB <= config.autoArchiveThresholdMB) return;

    const result = performAutoArchive();
    if (result) {
      console.log(`[AutoArchive] 自動退避を実行しました: ${result.archiveFile} (${result.sizeMB}MB)`);
    }
  } catch (e: any) {
    console.error('[AutoArchive] 自動退避チェック中にエラー:', e.message);
  }
}

setInterval(checkAutoArchive, AUTO_ARCHIVE_CHECK_INTERVAL_MS);
checkAutoArchive();"""
))

# --- パッチ2: frontend — 「未実装」警告文を実装済み内容に更新 ---
PATCHES.append((
    FRONTEND_FILE,
    """        <div className="text-xs text-gray-600 mb-4 space-y-1">
          <p>アーカイブ世代数・自動退避閾値を設定します。</p>
          <p className="text-red-600">
            ⚠️ 現在 <code className="bg-gray-100 px-1 rounded text-gray-700">combined.log</code> は
            <strong> 自動ローテーションなし</strong>の単一ファイル蓄積です。
            本番前に自動退避を有効にするか <code className="bg-gray-100 px-1 rounded text-gray-700">winston-daily-rotate-file</code> を実装してください。
          </p>
        </div>""",
    """        <div className="text-xs text-gray-600 mb-4 space-y-1">
          <p>アーカイブ世代数・自動退避閾値を設定します。</p>
          <p className="text-green-700">
            ✅ 自動退避を有効にすると、サーバーが10分おきに <code className="bg-gray-100 px-1 rounded text-gray-700">combined.log</code> のサイズを確認し、
            「自動退避閾値」を超えた時点で自動的にアーカイブ（コピー保存→クリア）します。
          </p>
        </div>"""
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

    commit_msg = "feat(logs): combined.logの自動退避（定期サイズ監視）を実装"

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
