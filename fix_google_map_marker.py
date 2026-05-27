#!/usr/bin/env python3
"""
Google Maps「このページではGoogleマップが正しく読み込まれませんでした」エラー修正
root cause: AdvancedMarkerElement は mapId 必須だが VITE_GOOGLE_MAP_ID 未設定

修正方針:
  mapId が設定されていれば AdvancedMarkerElement を使用（現状維持）
  mapId が未設定の場合は 旧 google.maps.Marker にフォールバック
  → エラーポップアップを完全に排除

対象ファイル:
  1. frontend/mobile/src/components/GoogleMapWrapper.tsx
  2. frontend/mobile/src/components/ActivityEditSheet.tsx
"""

import re

BASE = '/home/karkyon/projects/dump-tracker'

# ===========================================================================
# 1. GoogleMapWrapper.tsx - AdvancedMarkerElement → mapId有無でフォールバック
# ===========================================================================
path1 = f'{BASE}/frontend/mobile/src/components/GoogleMapWrapper.tsx'
with open(path1, 'r', encoding='utf-8') as f:
    src1 = f.read()
orig1 = src1

# mapId未設定時は VECTOR+AdvancedMarkerElement を使わず Marker にフォールバック
old_marker_block = """        const markerSVG = createCustomMarkerSVG(0, 0, 0);
        // BUG-011: AdvancedMarkerElement に移行済み。markerIcon は不要なので削除(TS6133解消)
        const markerDiv = document.createElement('div');
        markerDiv.innerHTML = markerSVG;
        markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          map: map,
          position: centerPosition,
          title: '現在位置',
          content: markerDiv,
        });"""
new_marker_block = """        const markerSVG = createCustomMarkerSVG(0, 0, 0);
        const markerDiv = document.createElement('div');
        markerDiv.innerHTML = markerSVG;
        markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';

        // mapId未設定時は AdvancedMarkerElement が使えないため旧Markerにフォールバック
        let marker: any;
        const hasMapId = !!import.meta.env.VITE_GOOGLE_MAP_ID;
        if (hasMapId && window.google.maps.marker?.AdvancedMarkerElement) {
          marker = new window.google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: centerPosition,
            title: '現在位置',
            content: markerDiv,
          });
        } else {
          // フォールバック: 旧 Marker（mapId不要、エラーポップアップなし）
          marker = new window.google.maps.Marker({
            map: map,
            position: centerPosition,
            title: '現在位置',
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSVG)}`,
              scaledSize: new window.google.maps.Size(60, 80),
              anchor: new window.google.maps.Point(30, 28),
            },
          });
        }"""
if old_marker_block in src1:
    src1 = src1.replace(old_marker_block, new_marker_block)
    print('  ✅ GoogleMapWrapper: AdvancedMarkerElement フォールバック追加')
else:
    print('  ❌ GoogleMapWrapper: AdvancedMarkerElement パターン未発見')

# updateMarkerIcon: AdvancedMarkerElement/Marker 両対応
old_update_icon = """  // BUG-011: AdvancedMarkerElement は content プロパティで SVG を更新
  const markerSVG = createCustomMarkerSVG(distance, speed, heading);
  if (globalMarkerInstance.content instanceof HTMLElement) {
    globalMarkerInstance.content.innerHTML = markerSVG;
  } else {
    const markerDiv = document.createElement('div');
    markerDiv.innerHTML = markerSVG;
    markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';
    globalMarkerInstance.content = markerDiv;
  }"""
new_update_icon = """  const markerSVG = createCustomMarkerSVG(distance, speed, heading);
  // AdvancedMarkerElement(mapId有り) と 旧Marker(mapId無し) の両対応
  if (globalMarkerInstance.content instanceof HTMLElement) {
    // AdvancedMarkerElement
    globalMarkerInstance.content.innerHTML = markerSVG;
  } else if (typeof globalMarkerInstance.setIcon === 'function') {
    // 旧 Marker フォールバック
    globalMarkerInstance.setIcon({
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSVG)}`,
      scaledSize: new window.google.maps.Size(60, 80),
      anchor: new window.google.maps.Point(30, 28),
    });
  } else {
    const markerDiv = document.createElement('div');
    markerDiv.innerHTML = markerSVG;
    markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';
    globalMarkerInstance.content = markerDiv;
  }"""
if old_update_icon in src1:
    src1 = src1.replace(old_update_icon, new_update_icon)
    print('  ✅ GoogleMapWrapper: updateMarkerIcon 両対応')
else:
    print('  ❌ GoogleMapWrapper: updateMarkerIcon パターン未発見')

# updateMarkerPosition: AdvancedMarkerElement/Marker 両対応
old_update_pos = """  // BUG-011: AdvancedMarkerElement は position プロパティで更新
  globalMarkerInstance.position = { lat, lng };"""
new_update_pos = """  // AdvancedMarkerElement と旧Marker の両対応
  if (typeof globalMarkerInstance.setPosition === 'function') {
    globalMarkerInstance.setPosition({ lat, lng });
  } else {
    globalMarkerInstance.position = { lat, lng };
  }"""
if old_update_pos in src1:
    src1 = src1.replace(old_update_pos, new_update_pos)
    print('  ✅ GoogleMapWrapper: updateMarkerPosition 両対応')
else:
    print('  ❌ GoogleMapWrapper: updateMarkerPosition パターン未発見')

if src1 != orig1:
    with open(path1, 'w', encoding='utf-8') as f:
        f.write(src1)
    print('  ✅ GoogleMapWrapper.tsx 書き込み完了')
else:
    print('  ⚠️  GoogleMapWrapper.tsx 変更なし')

# ===========================================================================
# 2. ActivityEditSheet.tsx - GpsPinMap の AdvancedMarkerElement フォールバック
# ===========================================================================
path2 = f'{BASE}/frontend/mobile/src/components/ActivityEditSheet.tsx'
with open(path2, 'r', encoding='utf-8') as f:
    src2 = f.read()
orig2 = src2

old_activity_marker = """      const pos = existingMarker ? existingMarker.getPosition() : { lat: defaultLat, lng: defaultLng };
      // BUG-011: AdvancedMarkerElement (非推奨Marker廃止対応)
      const pinEl = document.createElement('div');
      pinEl.style.cssText = `width:20px;height:20px;border-radius:50%;background:${accentColor};border:3px solid #fff;cursor:move;box-shadow:0 2px 6px rgba(0,0,0,.4);`;
      const marker = new (google.maps as any).marker.AdvancedMarkerElement({
        position: pos,
        map,
        title: 'ドラッグで位置調整',
        content: pinEl,
        gmpDraggable: true,
      });
      marker.addListener('dragend', (e: any) => {
        const p = e.latLng ?? marker.position;
        if (p) onPinMoved(typeof p.lat === 'function' ? p.lat() : p.lat, typeof p.lng === 'function' ? p.lng() : p.lng);
      });
      map.addListener('click', (e: any) => {
        marker.position = e.latLng;
        onPinMoved(e.latLng.lat(), e.latLng.lng());
      });"""
new_activity_marker = """      const pos = existingMarker ? existingMarker.getPosition() : { lat: defaultLat, lng: defaultLng };
      const pinEl = document.createElement('div');
      pinEl.style.cssText = `width:20px;height:20px;border-radius:50%;background:${accentColor};border:3px solid #fff;cursor:move;box-shadow:0 2px 6px rgba(0,0,0,.4);`;

      // mapId未設定時は AdvancedMarkerElement が使えないため旧Markerにフォールバック
      const hasMapId = !!(import.meta as any).env?.VITE_GOOGLE_MAP_ID;
      let marker: any;
      if (hasMapId && (google.maps as any).marker?.AdvancedMarkerElement) {
        marker = new (google.maps as any).marker.AdvancedMarkerElement({
          position: pos, map, title: 'ドラッグで位置調整',
          content: pinEl, gmpDraggable: true,
        });
        marker.addListener('dragend', (e: any) => {
          const p = e.latLng ?? marker.position;
          if (p) onPinMoved(typeof p.lat === 'function' ? p.lat() : p.lat, typeof p.lng === 'function' ? p.lng() : p.lng);
        });
        map.addListener('click', (e: any) => {
          marker.position = e.latLng;
          onPinMoved(e.latLng.lat(), e.latLng.lng());
        });
      } else {
        // フォールバック: 旧 Marker
        marker = new google.maps.Marker({ position: pos, map, title: 'ドラッグで位置調整', draggable: true });
        marker.addListener('dragend', (e: any) => {
          const p = e.latLng;
          if (p) onPinMoved(p.lat(), p.lng());
        });
        map.addListener('click', (e: any) => {
          marker.setPosition(e.latLng);
          onPinMoved(e.latLng.lat(), e.latLng.lng());
        });
      }"""
if old_activity_marker in src2:
    src2 = src2.replace(old_activity_marker, new_activity_marker)
    print('  ✅ ActivityEditSheet: GpsPinMap AdvancedMarkerElement フォールバック追加')
else:
    print('  ❌ ActivityEditSheet: GpsPinMap パターン未発見')

if src2 != orig2:
    with open(path2, 'w', encoding='utf-8') as f:
        f.write(src2)
    print('  ✅ ActivityEditSheet.tsx 書き込み完了')
else:
    print('  ⚠️  ActivityEditSheet.tsx 変更なし')

# ===========================================================================
# TSコンパイル & Git push
# ===========================================================================
import subprocess, sys

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

print('\n[Git commit & push...]')
subprocess.run(['git', 'add', '-A'], cwd=BASE)
subprocess.run(['git', 'commit', '-m',
    'fix: Google Maps エラーポップアップ解消 - AdvancedMarkerElement→Marker フォールバック(mapId未設定時)'],
    cwd=BASE)
r = subprocess.run(['git', 'push', 'origin', 'main'], cwd=BASE, capture_output=True, text=True)
print(r.stdout)
print('✅ push完了！')
print("""
【修正内容】
  根本原因: AdvancedMarkerElement は mapId 必須だが VITE_GOOGLE_MAP_ID 未設定
  → 「このページではGoogleマップが正しく読み込まれませんでした」ポップアップ発生

  GoogleMapWrapper.tsx:
    VITE_GOOGLE_MAP_ID 設定あり → AdvancedMarkerElement (現状維持)
    VITE_GOOGLE_MAP_ID 未設定   → 旧 google.maps.Marker にフォールバック
    updateMarkerIcon / updateMarkerPosition も両対応

  ActivityEditSheet.tsx (GpsPinMap):
    同様に VITE_GOOGLE_MAP_ID 有無でフォールバック

  ※ VITE_GOOGLE_MAP_ID を .env に設定すれば AdvancedMarkerElement + ヘッドアップが有効になる
""")
