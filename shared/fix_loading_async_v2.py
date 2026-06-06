#!/usr/bin/env python3
"""
修正内容:
1. script.src に &loading=async 追加（callback方式は維持したまま追加のみ）
2. setMapHeading に getHeading() 実測値ログ追加（HEADING_CHECK）
3. [MAP_RENDERING_CHANGED] にheading/tilt/zoom/mapId情報追加
"""
import subprocess, sys, os

BASE = os.path.expanduser('~/projects/dump-tracker')
MAP_FILE = f'{BASE}/frontend/mobile/src/components/GoogleMapWrapper.tsx'

with open(MAP_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

errors = []

# =============================================
# 修正1: script.src に &loading=async 追加
# callback=initGoogleMap は維持（動作を変えない）
# =============================================
old_src = "    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap&libraries=marker&v=weekly&map_ids=${mapIdParam}`;"
new_src = "    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initGoogleMap&libraries=marker&v=weekly&map_ids=${mapIdParam}`;"

if old_src in content:
    content = content.replace(old_src, new_src, 1)
    print('OK: script.src に loading=async 追加')
else:
    errors.append('script.src パターン不一致')
    idx = content.find('script.src = `https://maps.googleapis.com')
    print(f'ERROR: script.src パターン不一致')
    if idx >= 0:
        print(repr(content[idx:idx+200]))

# =============================================
# 修正2: setMapHeading の sendDebugLog に actualHeading 追加
# =============================================
old_heading_log = """      globalMapInstance.setHeading(heading);
      const now = Date.now();
      if (now - _lastDebugSentAt > 5000) {
        _lastDebugSentAt = now;
        sendDebugLog('setMapHeading: OK', {
          heading: Math.round(heading),
          renderingType: String(renderingType),
          isVector: VECTOR ? renderingType === VECTOR : 'NO_VECTOR_API',
        });
      }"""
new_heading_log = """      globalMapInstance.setHeading(heading);
      const actualHeading = globalMapInstance.getHeading?.();
      const now = Date.now();
      if (now - _lastDebugSentAt > 5000) {
        _lastDebugSentAt = now;
        sendDebugLog('setMapHeading: OK', {
          requested: Math.round(heading),
          actual: actualHeading,
          match: Math.abs((actualHeading ?? 0) - heading) < 1,
          renderingType: String(renderingType),
          isVector: VECTOR ? renderingType === VECTOR : 'NO_VECTOR_API',
        });
      }"""

if old_heading_log in content:
    content = content.replace(old_heading_log, new_heading_log, 1)
    print('OK: setMapHeading に actualHeading(getHeading) ログ追加')
else:
    errors.append('setMapHeading ログパターン不一致')
    print('ERROR: setMapHeading ログパターン不一致')

# =============================================
# 修正3: [MAP_RENDERING_CHANGED] にheading/tilt/zoom/mapId追加
# =============================================
old_rendering = """        map.addListener('renderingtype_changed', () => {
          const renderingType = map.getRenderingType();
          const isVector = (renderingType === window.google.maps.RenderingType?.VECTOR || String(renderingType) === 'VECTOR');
          console.log(`マップレンダリング変更: ${isVector ?"""
new_rendering = """        map.addListener('renderingtype_changed', () => {
          const renderingType = map.getRenderingType();
          const isVector = (renderingType === window.google.maps.RenderingType?.VECTOR || String(renderingType) === 'VECTOR');
          console.log(`マップレンダリング変更: ${isVector ?"""

# この修正は既存の sendDebugLog 呼び出し部分を拡張
old_rendering_log = "          sendDebugLog('[MAP_RENDERING_CHANGED]', { renderingType: String(renderingType), isVector });"
new_rendering_log = """          sendDebugLog('[MAP_RENDERING_CHANGED]', {
            renderingType: String(renderingType),
            isVector,
            heading: map.getHeading?.(),
            tilt: map.getTilt?.(),
            zoom: map.getZoom?.(),
            mapId: (import.meta as any).env?.VITE_GOOGLE_MAP_ID || 'none',
          });"""

if old_rendering_log in content:
    content = content.replace(old_rendering_log, new_rendering_log, 1)
    print('OK: [MAP_RENDERING_CHANGED] にheading/tilt/zoom/mapId追加')
else:
    errors.append('[MAP_RENDERING_CHANGED] パターン不一致')
    print('ERROR: [MAP_RENDERING_CHANGED] パターン不一致')

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
for f in ['fix_loading_async_v2.py']:
    p = f'{BASE}/{f}'
    if os.path.exists(p):
        os.remove(p)
        print(f'DELETE: {p}')

r = subprocess.run(['git','add','-A'], cwd=BASE, capture_output=True, text=True)
r = subprocess.run(
    ['git','commit','-m',
     'fix: loading=async追加; setMapHeadingにgetHeading実測値ログ; MAP_RENDERING_CHANGEDに詳細情報追加'],
    cwd=BASE, capture_output=True, text=True
)
print(f'Commit: {r.stdout.strip()}')
r = subprocess.run(['git','push','origin','main'], cwd=BASE, capture_output=True, text=True)
print(f'Push STDERR: {r.stderr.strip()}')
print(f'Push RC: {r.returncode}')
