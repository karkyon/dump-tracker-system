import subprocess, sys, os
BASE = os.path.expanduser('~/projects/dump-tracker')
F = f'{BASE}/frontend/mobile/src/pages/MapTest.tsx'

with open(F, 'r', encoding='utf-8') as fp: c = fp.read()

# 1) WebGL確認をuseEffect内の先頭に追加
old_ue = "  useEffect(() => {\n    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';\n    if (!apiKey) { setStatus('❌ APIキー未設定'); return; }"
new_ue = """  useEffect(() => {
    // WebGL確認
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      addLog(`WebGL: ${gl ? '✅ 利用可能' : '❌ 利用不可'}`);
    } catch(e) { addLog('WebGL: ❌ エラー'); }

    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) { setStatus('❌ APIキー未設定'); return; }"""

if old_ue in c:
    c = c.replace(old_ue, new_ue, 1)
    print('OK: WebGL確認追加')
else:
    print('ERROR: useEffect先頭パターン不一致'); sys.exit(1)

# 2) ステータスパネルの末尾にリンクボタン追加（マップdivの直前）
old_div = "      {/* マップ */}\n      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />"
new_div = """      {/* リンク */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.80)', padding: '8px 14px',
        display: 'flex', gap: '8px', flexWrap: 'wrap',
      }}>
        <a href="https://developers.google.com/maps/documentation/javascript/examples/webgl/webgl-tilt-rotation"
           target="_blank" rel="noreferrer"
           style={{ color: '#60a5fa', fontSize: '11px', textDecoration: 'underline' }}>
          📖 Google公式 Vector/Tilt/Rotation サンプル
        </a>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>|</span>
        <a href="https://maps.googleapis.com/maps/api/js?key=AIzaSyCpQGN2eC7q0jE-wZdVO_NauO5_NgmVerk&callback=Function.prototype&v=weekly"
           target="_blank" rel="noreferrer"
           style={{ color: '#34d399', fontSize: '11px', textDecoration: 'underline' }}>
          🔗 Maps API直接ロード確認
        </a>
      </div>
      {/* マップ */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />"""

if old_div in c:
    c = c.replace(old_div, new_div, 1)
    print('OK: リンクボタン追加')
else:
    print('ERROR: マップdivパターン不一致'); sys.exit(1)

with open(F, 'w', encoding='utf-8') as fp: fp.write(c)
print('OK: MapTest.tsx保存')

for proj, path in [('mobile','frontend/mobile'),('cms','frontend/cms'),('backend','backend')]:
    r = subprocess.run(['./node_modules/.bin/tsc','--noEmit'], cwd=f'{BASE}/{path}', capture_output=True, text=True)
    print(f'TSC {proj} RC: {r.returncode}')
    if r.returncode != 0:
        print(r.stdout[-1500:]); print(r.stderr[-500:])
        print('❌ TSCエラー - push中止'); sys.exit(1)

print('TSC全RC=0 - git commit & push')
subprocess.run(['git','add','-A'], cwd=BASE)
r = subprocess.run(['git','commit','-m',
    'test: MapTest WebGL確認ログ追加 + Google公式Vectorサンプルリンク追加'],
    cwd=BASE, capture_output=True, text=True)
print(r.stdout.strip())
r = subprocess.run(['git','push','origin','main'], cwd=BASE, capture_output=True, text=True)
print(f'Push STDERR: {r.stderr.strip()}')
print(f'Push RC: {r.returncode}')
