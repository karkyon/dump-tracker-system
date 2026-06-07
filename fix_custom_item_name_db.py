#!/usr/bin/env python3
"""
fix_custom_item_name_db.py
===========================
【修正内容】
1. backend/src/services/tripService.ts
   - addActivity の detailData.notes: activityData.notes || '' → resolvedNotes
     → 手入力品目名が DB の notes に保存されるようになる

2. backend/src/services/tripService.ts
   - completeLoading の notes: data.notes || loadingDetail.notes || undefined
     → 手入力品目名変換ロジック追加（addActivityと同様の処理）

3. frontend/mobile/src/services/api.ts
   - CompleteLoadingRequest に customItemName?, selectedItemIds? を追加

【実行方法】
  cd ~/projects/dump-tracker && python3 fix_custom_item_name_db.py
"""

import subprocess, os, sys

BASE = os.path.expanduser('~/projects/dump-tracker')

def patch(path, old, new, label):
    full = os.path.join(BASE, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'SKIP [{label}]: パターン不一致')
        return False
    count = content.count(old)
    if count > 1:
        print(f'WARN [{label}]: パターンが{count}箇所ある（先頭のみ置換）')
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'OK [{label}]')
    return True

# =============================================================================
# 1. tripService.ts: addActivity の detailData.notes を resolvedNotes に修正
# =============================================================================
ok1 = patch(
    'backend/src/services/tripService.ts',
    '        notes: activityData.notes || \'\',\n        // 🆕 GPS位置情報マッピング',
    '        notes: resolvedNotes,  // ✅ 修正: activityData.notes || \'\' → resolvedNotes（手入力品目名を含む）\n        // 🆕 GPS位置情報マッピング',
    'tripService.addActivity: detailData.notes → resolvedNotes'
)

# =============================================================================
# 2. tripService.ts: completeLoading の notes に customItemName 処理を追加
# =============================================================================
ok2 = patch(
    'backend/src/services/tripService.ts',
    '''      // operation_detail更新（actualEndTime, itemId, quantityTons を設定）
      const updatedDetail = await this.operationDetailService.update(
        loadingDetail.id,
        {
          actualEndTime: data.endTime || new Date(),
          itemId: data.itemId || undefined,
          quantityTons: data.quantity !== undefined
            ? data.quantity
            : Number(loadingDetail.quantityTons),
          notes: data.notes || loadingDetail.notes || undefined,
          // 🆕 GPS座標を operation_details に保存
          latitude: data.latitude ? Number(data.latitude) : undefined,
          longitude: data.longitude ? Number(data.longitude) : undefined,
          gpsAccuracyMeters: data.accuracy ? Number(data.accuracy) : undefined,
          gpsRecordedAt: data.latitude ? new Date() : undefined
        }
      );''',
    '''      // ✅ 手入力品目名が含まれる場合は notes に反映（addActivityと同様のロジック）
      const completeCustomItemName = (data as any).customItemName as string | undefined;
      const completeBaseNotes = data.notes || (loadingDetail.notes as string | null | undefined) || '';
      const completeResolvedNotes = completeCustomItemName && !completeBaseNotes.includes('[手入力品目:')
        ? `[手入力品目: ${completeCustomItemName}]${completeBaseNotes ? ' ' + completeBaseNotes : ''}`
        : completeBaseNotes || undefined;

      // operation_detail更新（actualEndTime, itemId, quantityTons を設定）
      const updatedDetail = await this.operationDetailService.update(
        loadingDetail.id,
        {
          actualEndTime: data.endTime || new Date(),
          itemId: data.itemId || undefined,
          quantityTons: data.quantity !== undefined
            ? data.quantity
            : Number(loadingDetail.quantityTons),
          notes: completeResolvedNotes,  // ✅ 修正: 手入力品目名を含む
          // 🆕 GPS座標を operation_details に保存
          latitude: data.latitude ? Number(data.latitude) : undefined,
          longitude: data.longitude ? Number(data.longitude) : undefined,
          gpsAccuracyMeters: data.accuracy ? Number(data.accuracy) : undefined,
          gpsRecordedAt: data.latitude ? new Date() : undefined
        }
      );''',
    'tripService.completeLoading: notes → completeResolvedNotes（手入力品目名対応）'
)

# =============================================================================
# 3. api.ts (mobile): CompleteLoadingRequest に customItemName 追加
# =============================================================================
ok3 = patch(
    'frontend/mobile/src/services/api.ts',
    '''/**
 * 🆕 積込完了リクエスト
 */
export interface CompleteLoadingRequest {
  itemId?: string;           // 品目ID（オプション: 積込完了時未確定でも可）
  quantity?: number;         // 積載量（オプション）
  endTime?: Date | string;   // 終了時刻（省略時は現在時刻）
  latitude?: number;         // GPS緯度（オプション）
  longitude?: number;        // GPS経度（オプション）
  accuracy?: number;         // GPS測位精度（メートル）
  notes?: string;            // メモ（オプション）
}''',
    '''/**
 * 🆕 積込完了リクエスト
 */
export interface CompleteLoadingRequest {
  itemId?: string;           // 品目ID（オプション: 積込完了時未確定でも可）
  quantity?: number;         // 積載量（オプション）
  endTime?: Date | string;   // 終了時刻（省略時は現在時刻）
  latitude?: number;         // GPS緯度（オプション）
  longitude?: number;        // GPS経度（オプション）
  accuracy?: number;         // GPS測位精度（メートル）
  notes?: string;            // メモ（オプション）
  customItemName?: string;   // ✅ 手入力品目名（notesに変換してDB保存）
  selectedItemIds?: string[]; // ✅ 複数品目ID
}''',
    'api.ts: CompleteLoadingRequest に customItemName/selectedItemIds 追加'
)

if not all([ok1, ok2, ok3]):
    print('❌ パッチ未適用あり。終了します。')
    sys.exit(1)

# =============================================================================
# TSC 3プロジェクト全確認
# =============================================================================
print('\n=== TSC チェック ===')
all_ok = True
for proj in ['backend', 'frontend/mobile', 'frontend/cms']:
    cmd = ['./node_modules/.bin/tsc', '--noEmit']
    r = subprocess.run(cmd, cwd=os.path.join(BASE, proj), capture_output=True, text=True)
    label = proj.split('/')[-1]
    if r.returncode == 0:
        print(f'✅ {label}: RC=0')
    else:
        print(f'❌ {label}: RC={r.returncode}')
        print(r.stdout[:2000])
        print(r.stderr[:500])
        all_ok = False

if not all_ok:
    print('❌ TSCエラーがあるためpushしません')
    sys.exit(1)

# =============================================================================
# git push
# =============================================================================
os.chdir(BASE)
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m',
    'fix: customItemName のDB notes保存バグ修正\n\n'
    '- tripService.addActivity: detailData.notes = activityData.notes→resolvedNotesに修正\n'
    '- tripService.completeLoading: notes に手入力品目名変換ロジック追加\n'
    '- mobile api.ts: CompleteLoadingRequest に customItemName/selectedItemIds 追加'
], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print('✅ Push完了')
