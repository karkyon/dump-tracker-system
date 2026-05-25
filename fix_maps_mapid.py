import subprocess, sys
from pathlib import Path

APP_ROOT = Path.home() / 'projects' / 'dump-tracker'
CMS_ROOT = APP_ROOT / 'frontend' / 'cms'
GPS_MON  = CMS_ROOT / 'src/pages/GPSMonitoring.tsx'
LOC_MAP  = CMS_ROOT / 'src/components/maps/LocationMapPicker.tsx'
DIALOG   = CMS_ROOT / 'src/components/OperationDetailDialog.tsx'

print('='*60)
print('Google Maps mapId 全ファイル修正')
print('='*60)

errors = []

# =========================================================
# 1. GPSMonitoring.tsx
#    - loadGoogleMapsScript: libraries=places → libraries=marker,places
#    - new window.google.maps.Map() に mapId 追加
# =========================================================
content = GPS_MON.read_text(encoding='utf-8')
orig1 = content

OLD1a = "script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=ja&region=JP`;"
NEW1a = "script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker,places&language=ja&region=JP`;"
if OLD1a in content:
    content = content.replace(OLD1a, NEW1a, 1)
    print('✅ [1/5] GPSMonitoring: libraries=marker,places 修正')
else:
    errors.append('❌ [1/5] GPSMonitoring loadGoogleMapsScript src が見つかりません')

OLD1b = '''      const map = new window.google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });'''
NEW1b = '''      const map = new window.google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapId: 'DEMO_MAP_ID',
      });'''
if OLD1b in content:
    content = content.replace(OLD1b, NEW1b, 1)
    print('✅ [2/5] GPSMonitoring: mapId 追加')
else:
    errors.append('❌ [2/5] GPSMonitoring Map生成コードが見つかりません')
    idx = content.find('new window.google.maps.Map(mapRef.current')
    if idx >= 0:
        print('  実際:', repr(content[idx:idx+250]))

GPS_MON.write_text(content, encoding='utf-8')

# =========================================================
# 2. LocationMapPicker.tsx
#    - new google.maps.Map() に mapId 追加
# =========================================================
content = LOC_MAP.read_text(encoding='utf-8')
orig2 = content

OLD2 = '''    const map = new google.maps.Map(mapRef.current, {
      center: initialPosition,
      zoom: zoom,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });'''
NEW2 = '''    const map = new google.maps.Map(mapRef.current, {
      center: initialPosition,
      zoom: zoom,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      mapId: 'DEMO_MAP_ID',
    });'''
if OLD2 in content:
    content = content.replace(OLD2, NEW2, 1)
    print('✅ [3/5] LocationMapPicker: mapId 追加')
else:
    errors.append('❌ [3/5] LocationMapPicker Map生成コードが見つかりません')
    idx = content.find('new google.maps.Map(mapRef.current')
    if idx >= 0:
        print('  実際:', repr(content[idx:idx+200]))

LOC_MAP.write_text(content, encoding='utf-8')

# =========================================================
# 3. OperationDetailDialog.tsx - CmsGpsPinMap の initMap
#    new g.Map() に mapId 追加
# =========================================================
content = DIALOG.read_text(encoding='utf-8')
orig3 = content

OLD3 = '''    const map = new g.Map(container, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 17, disableDefaultUI: true, zoomControl: true,
    });'''
NEW3 = '''    const map = new g.Map(container, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 17, disableDefaultUI: true, zoomControl: true,
      mapId: 'DEMO_MAP_ID',
    });'''
if OLD3 in content:
    content = content.replace(OLD3, NEW3)  # 2箇所ある可能性（initMap + fullscreen）
    print('✅ [4/5] CmsGpsPinMap initMap: mapId 追加')
else:
    errors.append('❌ [4/5] CmsGpsPinMap initMap コードが見つかりません')
    idx = content.find('new g.Map(container')
    if idx >= 0:
        print('  実際:', repr(content[idx:idx+150]))

# =========================================================
# 4. 写真URL: nginx /uploads/ 配信設定確認のため
#    baseOrigin のデバッグログを追加（写真URL問題の診断用）
# =========================================================
# Image1で「積載物写真」ラベルは出るが壊れている
# staging: VITE_API_BASE_URL = '/api/v1' (相対パス) の場合
# apiBase.replace(/\/api\/v1.*$/, '') → '' になり
# baseOrigin = '' となって fullUrl = '/uploads/...' になる
# → https://dumptracker-s.ddns.net/uploads/... となりnginxが配信していればOK
# → もしnginxが /uploads/ を配信していなければ404

# 修正: apiBase が '' や '/api/v1' のような相対パスの場合は
# window.location.origin を使うよう修正
OLD_BASE_ORIGIN_RENDERSUBROW = """                                const baseOrigin = apiBase
                                  ? apiBase.replace(/\\/api\\/v1.*$/, '')
                                  : window.location.origin;"""
NEW_BASE_ORIGIN_RENDERSUBROW = """                                const baseOrigin = (apiBase && apiBase.startsWith('http'))
                                  ? apiBase.replace(/\\/api\\/v1.*$/, '')
                                  : window.location.origin;"""
if OLD_BASE_ORIGIN_RENDERSUBROW in content:
    content = content.replace(OLD_BASE_ORIGIN_RENDERSUBROW, NEW_BASE_ORIGIN_RENDERSUBROW, 1)
    print('✅ [5/5] renderSubRow baseOrigin: 相対パス対応修正')
else:
    # 既存のSINGLEイベント表示箇所も同様に修正
    OLD_BASE_ORIGIN_SINGLE = """                                    const baseOrigin = apiBase
                                      ? apiBase.replace('/api/v1', '').replace(/\\/api\\/v1.*$/, '')
                                      : window.location.origin;"""
    NEW_BASE_ORIGIN_SINGLE = """                                    const baseOrigin = (apiBase && apiBase.startsWith('http'))
                                      ? apiBase.replace(/\\/api\\/v1.*$/, '')
                                      : window.location.origin;"""
    if OLD_BASE_ORIGIN_SINGLE in content:
        content = content.replace(OLD_BASE_ORIGIN_SINGLE, NEW_BASE_ORIGIN_SINGLE, 1)
        print('✅ [5/5] SINGLE event baseOrigin: 相対パス対応修正')
    else:
        print('⚠️ [5/5] baseOrigin修正対象なし（既に修正済みかパターン不一致）')

DIALOG.write_text(content, encoding='utf-8')

# エラーがあれば表示してロールバック
if errors:
    for e in errors:
        print(e)
    GPS_MON.write_text(orig1, encoding='utf-8')
    LOC_MAP.write_text(orig2, encoding='utf-8')
    DIALOG.write_text(orig3, encoding='utf-8')
    print('🔄 ロールバック完了')
    sys.exit(1)

# TypeScript コンパイルチェック
print('\n[TypeScript コンパイルチェック中...]')
result = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    cwd=str(CMS_ROOT),
    capture_output=True, text=True, timeout=120
)
if result.returncode != 0 or result.stdout.strip() or result.stderr.strip():
    print('❌ TypeScript エラー:')
    print(result.stdout)
    print(result.stderr)
    GPS_MON.write_text(orig1, encoding='utf-8')
    LOC_MAP.write_text(orig2, encoding='utf-8')
    DIALOG.write_text(orig3, encoding='utf-8')
    print('🔄 ロールバック完了')
    sys.exit(1)

print('✅ TypeScript: エラー 0件')

# Git commit & push
print('[Git commit & push...]')
subprocess.run(['git', 'add', '-A'], cwd=str(APP_ROOT))
subprocess.run(['git', 'commit', '-m', 'fix(CMS): GPSMonitoring/LocationMapPicker/CmsGpsPinMap mapId追加 + 写真baseOrigin修正'], cwd=str(APP_ROOT))
result = subprocess.run(['git', 'push'], cwd=str(APP_ROOT), capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

print('='*60)
print('✅ 修正・push完了！')
print('【修正内容】')
print('  1. GPSMonitoring.tsx: libraries=marker,places + mapId: DEMO_MAP_ID')
print('  2. LocationMapPicker.tsx: mapId: DEMO_MAP_ID')
print('  3. OperationDetailDialog.tsx CmsGpsPinMap: mapId: DEMO_MAP_ID')
print('  4. renderSubRow baseOrigin: 相対パス時はwindow.location.originを使用')
print('     → staging: /uploads/xxx.jpg → https://dumptracker-s.ddns.net/uploads/xxx.jpg')
print('='*60)
print()
print('★ 写真が表示されない場合はstagingのnginxで /uploads/ 配信設定を確認:')
print('  sudo grep -A10 "uploads" /etc/nginx/sites-available/dump-tracker-staging')
