#!/usr/bin/env python3
"""
Mobile 開発環境 .env に VITE_GOOGLE_MAP_ID 追加
+ vite-env.d.ts に型定義追加
"""
import subprocess, sys

BASE = '/home/karkyon/projects/dump-tracker'

# ------------------------------------------------------------------
# 1. frontend/mobile/.env に VITE_GOOGLE_MAP_ID 追加
# ------------------------------------------------------------------
env_path = f'{BASE}/frontend/mobile/.env'
try:
    with open(env_path, 'r', encoding='utf-8') as f:
        env_src = f.read()
except FileNotFoundError:
    env_src = ''

if 'VITE_GOOGLE_MAP_ID' in env_src:
    print('  ℹ️  VITE_GOOGLE_MAP_ID は既に .env に存在します')
else:
    # staging と同じ Map ID を開発環境にも追加
    env_src = env_src.rstrip('\n') + '\n\n# Google Maps Map ID (AdvancedMarkerElement + ベクターマップ用)\nVITE_GOOGLE_MAP_ID=793b2cb3013694b0700a2152\n'
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_src)
    print('  ✅ frontend/mobile/.env に VITE_GOOGLE_MAP_ID=793b2cb3013694b0700a2152 追加')

# ------------------------------------------------------------------
# 2. vite-env.d.ts に VITE_GOOGLE_MAP_ID の型定義を追加
# ------------------------------------------------------------------
dts_path = f'{BASE}/frontend/mobile/src/vite-env.d.ts'
with open(dts_path, 'r', encoding='utf-8') as f:
    dts_src = f.read()

if 'VITE_GOOGLE_MAP_ID' in dts_src:
    print('  ℹ️  VITE_GOOGLE_MAP_ID は既に vite-env.d.ts に存在します')
else:
    old_dts = '  readonly VITE_GOOGLE_MAPS_API_KEY: string'
    new_dts = '  readonly VITE_GOOGLE_MAPS_API_KEY: string\n  readonly VITE_GOOGLE_MAP_ID: string'
    if old_dts in dts_src:
        dts_src = dts_src.replace(old_dts, new_dts)
        with open(dts_path, 'w', encoding='utf-8') as f:
            f.write(dts_src)
        print('  ✅ vite-env.d.ts に VITE_GOOGLE_MAP_ID 型定義追加')
    else:
        print('  ❌ vite-env.d.ts パターン未発見')

# ------------------------------------------------------------------
# 3. TSコンパイル確認
# ------------------------------------------------------------------
print('\n[TypeScript コンパイルチェック - Mobile]')
result = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    cwd=f'{BASE}/frontend/mobile',
    capture_output=True, text=True
)
if result.returncode == 0:
    print('✅ TypeScript: エラー 0件')
else:
    err_lines = [l for l in (result.stdout + result.stderr).splitlines() if 'error' in l.lower()]
    print('❌ TSエラー:')
    for l in err_lines[:20]:
        print(' ', l)
    sys.exit(1)

# ------------------------------------------------------------------
# 4. Git commit & push（.envは.gitignoreで除外されるのでvite-env.d.tsのみ）
# ------------------------------------------------------------------
print('\n[Git commit & push...]')
subprocess.run(['git', 'add', 'frontend/mobile/src/vite-env.d.ts'], cwd=BASE)
subprocess.run(['git', 'commit', '-m',
    'fix: mobile vite-env.d.ts に VITE_GOOGLE_MAP_ID 型定義追加'],
    cwd=BASE)
r = subprocess.run(['git', 'push', 'origin', 'main'], cwd=BASE, capture_output=True, text=True)
print(r.stdout or r.stderr)
print('✅ push完了！')
print("""
【原因と対処】
  CMSでエラーなし → staging-deploy.yml の CMS .env.production に VITE_GOOGLE_MAP_ID 未設定
                   → mapId なし → AdvancedMarkerElement 使わない → エラーなし

  Mobileでエラーあり → staging .env.production には VITE_GOOGLE_MAP_ID=793b2cb3013694b0700a2152 設定済み
                     → しかし開発環境 .env には未設定
                     → mapId なしで AdvancedMarkerElement 呼び出し → Googleがエラーポップアップ表示

【対処】
  開発環境 frontend/mobile/.env に VITE_GOOGLE_MAP_ID=793b2cb3013694b0700a2152 を追加
  → stagingと同じ Map ID を使用
  → AdvancedMarkerElement が正常動作、ヘッドアップも有効になる
  → .env は .gitignore 対象なので omega-dev 手動設定のみ（push不要）
""")
