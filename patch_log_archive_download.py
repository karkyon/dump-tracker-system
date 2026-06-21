#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ログアーカイブ ダウンロード機能 追加パッチ
- backend: GET /api/v1/logs/archives/:name/download エンドポイント追加
- frontend/cms: 開発者ツール > ログビューアタブ にダウンロードボタン追加

実行方法（omega-dev上、リポジトリルートで実行）:
  cd ~/projects/dump-tracker
  python3 patch_log_archive_download.py

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

# --- パッチ1: backend — ダウンロード用エンドポイント追加 ---
PATCHES.append((
    BACKEND_FILE,
    """router.delete('/archives/:name', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {""",
    """/** GET /api/v1/logs/archives/:name/download - アーカイブファイルダウンロード */
router.get('/archives/:name/download', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const name = req.params['name'];
  if (!name || name.includes('..') || name.includes('/')) {
    return res.status(400).json({ success: false, message: '無効なファイル名' });
  }
  const archiveDir = path.join(process.cwd(), 'logs', 'archives');
  const filePath = path.join(archiveDir, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'ファイルが見つかりません' });
  }
  return res.download(filePath, name);
}));

router.delete('/archives/:name', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {"""
))

# --- パッチ2: frontend — handleDownloadArchive 関数追加 ---
PATCHES.append((
    FRONTEND_FILE,
    """  const fetchArchives = async () => {
    try {
      const res = await apiClient.get('/logs/archives') as any;
      setArchives(res.data?.data?.archives || []);
    } catch {}
  };""",
    """  const fetchArchives = async () => {
    try {
      const res = await apiClient.get('/logs/archives') as any;
      setArchives(res.data?.data?.archives || []);
    } catch {}
  };

  const handleDownloadArchive = async (name: string) => {
    try {
      const res = await apiClient.get(`/logs/archives/${encodeURIComponent(name)}/download`, { responseType: 'blob' }) as any;
      const blob = new Blob([res.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`❌ ダウンロード失敗: ${e.message}`);
    }
  };"""
))

# --- パッチ3: frontend — アーカイブ一覧行にダウンロードボタン追加 ---
PATCHES.append((
    FRONTEND_FILE,
    """            {archives.length===0
              ? <span style={{color:textMuted,fontSize:11}}>アーカイブなし（「退避 & クリア」で保存されます）</span>
              : archives.map(a=>(
                <div key={a.name} style={{display:'flex',gap:8,fontSize:11,color:text,padding:'2px 0',borderBottom:`1px solid ${border}`}}>
                  <span style={{flex:1,fontFamily:'monospace'}}>{a.name}</span>
                  <span style={{color:textMuted}}>{a.sizeMB}MB</span>
                  <span style={{color:textMuted}}>{new Date(a.createdAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</span>
                </div>
              ))
            }""",
    """            {archives.length===0
              ? <span style={{color:textMuted,fontSize:11}}>アーカイブなし（「退避 & クリア」で保存されます）</span>
              : archives.map(a=>(
                <div key={a.name} style={{display:'flex',gap:8,fontSize:11,color:text,padding:'2px 0',borderBottom:`1px solid ${border}`,alignItems:'center'}}>
                  <span style={{flex:1,fontFamily:'monospace'}}>{a.name}</span>
                  <span style={{color:textMuted}}>{a.sizeMB}MB</span>
                  <span style={{color:textMuted}}>{new Date(a.createdAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</span>
                  <button onClick={()=>handleDownloadArchive(a.name)} title="ダウンロード"
                    style={{display:'flex',alignItems:'center',gap:2,padding:'1px 6px',border:`1px solid ${border}`,background:bg2,color:iconColor,borderRadius:4,cursor:'pointer',fontSize:10}}>
                    <Download size={10}/>
                  </button>
                </div>
              ))
            }"""
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

    commit_msg = "feat(logs): 退避済みログアーカイブのダウンロード機能を追加（GET /logs/archives/:name/download）"

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
