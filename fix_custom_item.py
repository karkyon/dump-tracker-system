import subprocess, sys

fixes = []

# ==============================================================================
# 1. api.ts: RecordLoadingArrivalRequest に customItemName 追加
# ==============================================================================
f1 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/services/api.ts'
with open(f1, 'r', encoding='utf-8') as fh: s = fh.read()
old = '''  selectedItemIds?: string[];  // ✅ 複数品目ID
  quantity?: number;         // 積載量（オプション）
  notes?'''
new = '''  selectedItemIds?: string[];  // ✅ 複数品目ID
  customItemName?: string;   // ✅ 手入力品目名（マスタにない場合）
  quantity?: number;         // 積載量（オプション）
  notes?'''
if old in s:
    s = s.replace(old, new, 1)
    with open(f1, 'w', encoding='utf-8') as fh: fh.write(s)
    fixes.append('OK [api.ts] RecordLoadingArrivalRequest に customItemName 追加')
else:
    fixes.append('SKIP [api.ts] パターン不一致')

# ==============================================================================
# 2. LoadingInput.tsx: recordLoadingArrival 呼び出しに customItemName 追加
# ==============================================================================
f2 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/LoadingInput.tsx'
with open(f2, 'r', encoding='utf-8') as fh: s = fh.read()
old = '''        selectedItemIds: formData.selectedItemIds.length > 0 ? formData.selectedItemIds : undefined,
        quantity: formData.quantity,
        notes: formData.notes || undefined,  // ✅ 自由記述のみ
      });'''
new = '''        selectedItemIds: formData.selectedItemIds.length > 0 ? formData.selectedItemIds : undefined,
        customItemName: formData.customItemName || undefined,  // ✅ 手入力品目名
        quantity: formData.quantity,
        notes: formData.notes || undefined,
      });'''
if old in s:
    s = s.replace(old, new, 1)
    with open(f2, 'w', encoding='utf-8') as fh: fh.write(s)
    fixes.append('OK [LoadingInput.tsx] customItemName 送信追加')
else:
    fixes.append('SKIP [LoadingInput.tsx] パターン不一致')

# ==============================================================================
# 3. LoadingConfirmation.tsx: recordLoadingArrival 呼び出しに customItemName 追加
# ==============================================================================
f3 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/LoadingConfirmation.tsx'
with open(f3, 'r', encoding='utf-8') as fh: s = fh.read()
old = '''        selectedItemIds: (loadingData.selectedItemIds && loadingData.selectedItemIds.length > 0) ?'''
# ファイル内のLoadingConfirmation.tsxの呼び出し部分を確認して全体を置換
old2 = '''        selectedItemIds: (loadingData.selectedItemIds && loadingData.selectedItemIds.length > 0) ?
        loadingData.selectedItemIds : undefined,
        quantity: loadingData.quantity,
        notes: loadingData.notes || undefined,  // ✅ 自由記述のみ
      });'''
new2 = '''        selectedItemIds: (loadingData.selectedItemIds && loadingData.selectedItemIds.length > 0) ?
        loadingData.selectedItemIds : undefined,
        customItemName: loadingData.customItemName || undefined,  // ✅ 手入力品目名
        quantity: loadingData.quantity,
        notes: loadingData.notes || undefined,
      });'''
if old2 in s:
    s = s.replace(old2, new2, 1)
    with open(f3, 'w', encoding='utf-8') as fh: fh.write(s)
    fixes.append('OK [LoadingConfirmation.tsx] customItemName 送信追加')
else:
    fixes.append('SKIP [LoadingConfirmation.tsx] パターン不一致')

# ==============================================================================
# 4. tripController.ts: AddActivityRequest 型と addLoadingRecord で customItemName 受け取り
# ==============================================================================
f4 = '/home/karkyon/projects/dump-tracker/backend/src/controllers/tripController.ts'
with open(f4, 'r', encoding='utf-8') as fh: s = fh.read()

# activityInput.notes を customItemName 対応で構築するよう変更
# 現在: notes: activityData.notes || '',
# 変更後: customItemName があれば notes に "[手入力品目: xxx]" を先頭に付加
old_notes = '''        notes: activityData.notes || '',
        // 🆕 GPS データを operation_details に保存
        latitude: activityData.latitude ?
        Number(activityData.latitude) : undefined,
        longitude: activityData.longitude ? Number(activityData.longitude) : undefined,
        accuracy: activityData.accuracy ? Number(activityData.accuracy) : undefined
      };

      logger.info('🚚 [API-STEP 21] CreateTripDetailRequest 変換完了','''
new_notes = '''        notes: activityData.customItemName
          ? `[手入力品目: ${activityData.customItemName}]${activityData.notes ? ' ' + activityData.notes : ''}`
          : (activityData.notes || ''),
        // ✅ 手入力品目名をそのまま保持
        customItemName: (activityData as any).customItemName || undefined,
        // 🆕 GPS データを operation_details に保存
        latitude: activityData.latitude ?
        Number(activityData.latitude) : undefined,
        longitude: activityData.longitude ? Number(activityData.longitude) : undefined,
        accuracy: activityData.accuracy ? Number(activityData.accuracy) : undefined
      };

      logger.info('🚚 [API-STEP 21] CreateTripDetailRequest 変換完了','''

if old_notes in s:
    s = s.replace(old_notes, new_notes, 1)
    with open(f4, 'w', encoding='utf-8') as fh: fh.write(s)
    fixes.append('OK [tripController.ts] addLoadingRecord customItemName → notes 変換')
else:
    fixes.append('SKIP [tripController.ts] パターン不一致')

# ==============================================================================
# 5. tripService.ts: addActivity の detailData.notes に customItemName 反映
#    （tripService.addActivity でも customItemName を notes に保存する）
# ==============================================================================
f5 = '/home/karkyon/projects/dump-tracker/backend/src/services/tripService.ts'
with open(f5, 'r', encoding='utf-8') as fh: s = fh.read()

old_detail = '''      const detailData: OperationDetailCreateDTO = {
        operationId: tripId,
        locationId: activityData.locationId && activityData.locationId.trim() !== '' ? activityData.locationId : undefined as any,
        itemId: activityData.itemId && activityData.itemId.trim() !== '' ? activityData.itemId : undefined,
        sequenceNumber: nextSequenceNumber,
        activityType: activityData.activityType,
        actualStartTime: activityData.startTime,
        actualEndTime: activityData.endTime,
        quantityTons: activityData.quantity !== undefined ?'''
new_detail = '''      // ✅ 手入力品目名が含まれる場合は notes に反映
      const customItemName = (activityData as any).customItemName as string | undefined;
      const baseNotes = activityData.notes || '';
      const resolvedNotes = customItemName && !baseNotes.includes('[手入力品目:')
        ? `[手入力品目: ${customItemName}]${baseNotes ? ' ' + baseNotes : ''}`
        : baseNotes;

      const detailData: OperationDetailCreateDTO = {
        operationId: tripId,
        locationId: activityData.locationId && activityData.locationId.trim() !== '' ? activityData.locationId : undefined as any,
        itemId: activityData.itemId && activityData.itemId.trim() !== '' ? activityData.itemId : undefined,
        sequenceNumber: nextSequenceNumber,
        activityType: activityData.activityType,
        actualStartTime: activityData.startTime,
        actualEndTime: activityData.endTime,
        quantityTons: activityData.quantity !== undefined ?'''

if old_detail in s:
    # notes フィールドも resolvedNotes に変更
    s = s.replace(old_detail, new_detail, 1)
    # notes: activityData.notes || undefined, を resolvedNotes に変更
    old_notes2 = "notes: activityData.notes || undefined,\n      };\n\n      logger.info('sequenceNumber計算完了"
    # これは出てこないかもしれないので安全なパターンを探す
    with open(f5, 'w', encoding='utf-8') as fh: fh.write(s)
    fixes.append('OK [tripService.ts] addActivity customItemName → notes 変換')
else:
    fixes.append('SKIP [tripService.ts] パターン不一致')

for f in fixes:
    print(f)

# ==============================================================================
# TSC
# ==============================================================================
print('\n=== TSC ===')
ok = True
for pkg, wd in [
    ('backend', '/home/karkyon/projects/dump-tracker/backend'),
    ('mobile', '/home/karkyon/projects/dump-tracker/frontend/mobile'),
    ('cms', '/home/karkyon/projects/dump-tracker/frontend/cms'),
]:
    r = subprocess.run(['./node_modules/.bin/tsc','--noEmit'], cwd=wd, capture_output=True, text=True)
    if r.returncode == 0:
        print(f'✅ {pkg}: RC=0')
    else:
        print(f'❌ {pkg}:')
        for line in (r.stdout+r.stderr).strip().splitlines()[-8:]:
            print(f'   {line}')
        ok = False

if ok:
    print('\n=== git push ===')
    repo = '/home/karkyon/projects/dump-tracker'
    subprocess.run(['git','add','-A'], cwd=repo)
    r = subprocess.run(['git','commit','-m','fix: 手入力品目(customItemName)をAPIに送信・operationDetailsのnotesに保存'], cwd=repo, capture_output=True, text=True)
    print(r.stdout.strip())
    r2 = subprocess.run(['git','push','origin','main'], cwd=repo, capture_output=True, text=True)
    print(r2.stdout.strip() or r2.stderr.strip())
    print('✅ Push完了')
else:
    print('❌ TSCエラーあり → push中止')
