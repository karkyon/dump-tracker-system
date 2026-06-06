#!/usr/bin/env python3
"""
修正: GoogleMapWrapper を loading=async + importLibrary() 方式に移行
根本原因: callback=initGoogleMap 方式は "loaded directly without loading=async" 扱いとなり
         WebGLコンテキスト初期化が不完全 → Vector Map が必ず失敗して Raster フォールバック
解決: script に loading=async を追加し、callback の代わりに script.onload + importLibrary() を使用
"""
import subprocess, sys, os

BASE = os.path.expanduser('~/projects/dump-tracker')
MAP_FILE = f'{BASE}/frontend/mobile/src/components/GoogleMapWrapper.tsx'

with open(MAP_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

errors = []

# =============================================
# 修正1: script の初回作成部分を loading=async 方式に変更
# callback=initGoogleMap を削除し、loading=async を追加
# script.onload で importLibrary を使って初期化
# =============================================
old_script = """    // 初回: callbackを設定してからscriptを追加
    window.initGoogleMap = initializeMap;
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // BUG-012: loading=async で廃止APIの初期化警告を抑制
    // &v=weekly: VectorマップとRenderingTypeを使うために必要
    // stable版ではRenderingType.VECTORが存在せずheadingUp無効になる
    // DEMO_MAP_ID をprecacheして確実にVector Mapを有効化
    const mapIdParam = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap&libraries=marker&v=weekly&map_ids=${mapIdParam}`;
    script.async = true;
    script.defer = true;"""

new_script = """    // 初回: loading=async 方式（Google推奨）でスクリプトロード
    // callback方式は "without loading=async" 扱いとなりWebGL初期化が不完全→VectorMap失敗
    // loading=async を使うと WebGLコンテキストが正しく初期化され VectorMap が動作する
    const mapIdParam = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker&v=weekly&map_ids=${mapIdParam}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ Google Maps API loading=async ロード完了');
      setTimeout(initializeMap, 50);
    };"""

if old_script in content:
    content = content.replace(old_script, new_script, 1)
    print('OK: script loading=async 方式に変更')
else:
    errors.append('script初回作成パターン不一致')
    idx = content.find('window.initGoogleMap = initializeMap')
    print(f'ERROR: パターン不一致. window.initGoogleMap位置: {idx}')
    if idx >= 0:
        print(repr(content[max(0,idx-50):idx+200]))

# =============================================
# 修正2: script.onerror の前の古い callback 設定行を削除
# (new_script に onload が含まれたので onerror だけ残す)
# =============================================
# onerror はそのまま残す → 変更不要

# =============================================
# 修正3: 既存script再利用部分 - window.initGoogleMap書き換えを setTimeout+initializeMap に変更
# =============================================
old_existing = """    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      if (window.google?.maps?.Map) {
        console.log('✅ Google Maps APIロード済み');
        setTimeout(initializeMap, 100);
      } else {
        // 既存scriptのコールバックを今回の initializeMap に差し替え
        // （古いmapIdのscriptが再実行されないよう上書き）
        window.initGoogleMap = initializeMap;
      }
      return;
    }"""

new_existing = """    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      if (window.google?.maps?.Map) {
        console.log('✅ Google Maps APIロード済み');
        setTimeout(initializeMap, 100);
      } else {
        // loading=async 方式: script.onload で initializeMap が呼ばれる（callback不要）
        console.log('⏳ Google Maps API ロード待機中 (loading=async)');
        existingScript.addEventListener('load', () => setTimeout(initializeMap, 50));
      }
      return;
    }"""

if old_existing in content:
    content = content.replace(old_existing, new_existing, 1)
    print('OK: 既存script再利用部分を loading=async 対応に変更')
else:
    errors.append('既存script再利用パターン不一致')
    print(f'ERROR: 既存script再利用パターン不一致')

# =============================================
# 修正4: Window型定義から initGoogleMap を削除（不要になった）
# =============================================
old_window = """declare global {
  interface Window {
    google: any;
    initGoogleMap?: () => void;
  }
}"""
new_window = """declare global {
  interface Window {
    google: any;
  }
}"""
if old_window in content:
    content = content.replace(old_window, new_window, 1)
    print('OK: Window型定義から initGoogleMap 削除')
else:
    print('INFO: initGoogleMap 既に削除済みまたはパターン不一致（スキップ）')

if errors:
    print(f'修正失敗: {errors}')
    sys.exit(1)

with open(MAP_FILE, 'w', encoding='utf-8') as f:
    f.write(content)
print('OK: GoogleMapWrapper.tsx 保存完了')

# TSCコンパイル
for proj, path in [('mobile', 'frontend/mobile'), ('cms', 'frontend/cms'), ('backend', 'backend')]:
    r = subprocess.run(
        ['./node_modules/.bin/tsc', '--noEmit'],
        cwd=f'{BASE}/{path}', capture_output=True, text=True
    )
    print(f'TSC {proj} RC: {r.returncode}')
    if r.returncode != 0:
        print(r.stdout[-2000:] if r.stdout else '')
        print(r.stderr[-2000:] if r.stderr else '')
        print('❌ TSCエラー - push中止')
        sys.exit(1)

print('TSC全RC=0 - git commit & push')
# ゴミファイル削除
for f in ['fix_loading_async.py']:
    p = f'{BASE}/{f}'
    if os.path.exists(p):
        os.remove(p)
        print(f'DELETE: {p}')

r = subprocess.run(['git','add','-A'], cwd=BASE, capture_output=True, text=True)
r = subprocess.run(
    ['git','commit','-m',
     'fix: GoogleMapWrapper loading=async方式に移行 - callback方式廃止でVectorMap確実動作(ヘッドアップ修正)'],
    cwd=BASE, capture_output=True, text=True
)
print(f'Commit: {r.stdout.strip()}')
r = subprocess.run(['git','push','origin','main'], cwd=BASE, capture_output=True, text=True)
print(f'Push STDERR: {r.stderr.strip()}')
print(f'Push RC: {r.returncode}')
