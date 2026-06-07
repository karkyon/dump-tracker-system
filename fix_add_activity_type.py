#!/usr/bin/env python3
"""
fix_add_activity_type.py
前回スクリプトで mobileRoutes / フロントエンド修正は適用済み。
今回は TSCエラーの根本: AddActivityRequest に customItemName?: string を追加する。
"""
import subprocess, sys, os

BASE = os.path.expanduser('~/projects/dump-tracker')

def patch(path, old, new, label):
    full = os.path.join(BASE, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'SKIP [{label}]: パターン不一致')
        return False
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'OK [{label}]')
    return True

# backend/src/types/trip.ts の AddActivityRequest に customItemName を追加
patch(
    'backend/src/types/trip.ts',
    '''export interface AddActivityRequest extends OperationDetailCreateDTO {
  locationId: string;
  itemId?: string;
  quantity?: number;
  activityType: ActivityType;
  startTime?: Date;  // 🆕 オプションに変更（自動設定可能）
  endTime?: Date;
  notes?: string;
  // 既存のgpsLocationオブジェクト（下位互換性維持）
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  // 🆕 D5/D6機能: GPS座標の直接指定も可能に（実装計画書対応）
  latitude?: number;   // GPS緯度（-90 ~ 90）
  longitude?: number;  // GPS経度（-180 ~ 180）
  accuracy?: number;   // オプション: GPS測位精度（メートル）
  arrivalTime?: Date;  // 🆕 オプション: 到着時刻（省略時は現在時刻）
}''',
    '''export interface AddActivityRequest extends OperationDetailCreateDTO {
  locationId: string;
  itemId?: string;
  quantity?: number;
  activityType: ActivityType;
  startTime?: Date;  // 🆕 オプションに変更（自動設定可能）
  endTime?: Date;
  notes?: string;
  customItemName?: string;  // ✅ 手入力品目名（tripService.addActivityでnotesに変換）
  // 既存のgpsLocationオブジェクト（下位互換性維持）
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  // 🆕 D5/D6機能: GPS座標の直接指定も可能に（実装計画書対応）
  latitude?: number;   // GPS緯度（-90 ~ 90）
  longitude?: number;  // GPS経度（-180 ~ 180）
  accuracy?: number;   // オプション: GPS測位精度（メートル）
  arrivalTime?: Date;  // 🆕 オプション: 到着時刻（省略時は現在時刻）
}''',
    'trip.ts: AddActivityRequest に customItemName 追加'
)

# TSC チェック
print('\n=== TSC チェック ===')
ok = True
for proj, cwd in [
    ('backend', f'{BASE}/backend'),
    ('mobile',  f'{BASE}/frontend/mobile'),
    ('cms',     f'{BASE}/frontend/cms'),
]:
    r = subprocess.run(
        ['./node_modules/.bin/tsc', '--noEmit'],
        cwd=cwd, capture_output=True, text=True
    )
    if r.returncode == 0:
        print(f'✅ {proj}: RC=0')
    else:
        print(f'❌ {proj}: RC={r.returncode}')
        print(r.stdout[-2000:] if r.stdout else '')
        print(r.stderr[-2000:] if r.stderr else '')
        ok = False

if not ok:
    print('❌ TSCエラーがあるためpushしません')
    sys.exit(1)

# git push
print('\n=== git push ===')
os.chdir(BASE)
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m',
    'feat: 全運行イベント詳細ログ完備 + customItemName DB保存修正(AddActivityRequest型追加)'], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print('✅ Push完了')

# cleanup
script = os.path.join(BASE, 'fix_add_activity_type.py')
if os.path.exists(script):
    os.remove(script)
    subprocess.run(['git', 'add', '-A'], cwd=BASE, check=True)
    subprocess.run(['git', 'commit', '-m', 'chore: fix_add_activity_type.py 削除'], cwd=BASE, check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], cwd=BASE, check=True)
    print('OK remove: fix_add_activity_type.py')
