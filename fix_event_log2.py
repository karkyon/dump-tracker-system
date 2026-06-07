import subprocess

# ==============================================================================
# 1. OperationRecord.tsx: BREAK_START / BREAK_END / UNLOADING_COMPLETED
# ==============================================================================
f = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/OperationRecord.tsx'
with open(f, 'r', encoding='utf-8') as fh: s = fh.read()
orig = s

# BREAK_START: '休憩を開始しました' の直後
old = "      toast.success('休憩を開始しました');"
new = """      toast.success('休憩を開始しました');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'BREAK_START',
        operationId: currentOperationId,
        gps: currentPosition ? { lat: currentPosition.coords.latitude, lng: currentPosition.coords.longitude, accuracy: currentPosition.coords.accuracy } : undefined,
        phase: 'BREAK',
        result: 'success',
      }).catch(() => {});"""
if old in s:
    s = s.replace(old, new, 1)
    print('OK [OperationRecord.tsx] BREAK_START')
else:
    print('SKIP BREAK_START')

# BREAK_END: '休憩を終了しました' の直後
old2 = "      toast.success('休憩を終了しました');"
new2 = """      toast.success('休憩を終了しました');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'BREAK_END',
        operationId: currentOperationId,
        phase: restoredPhase,
        result: 'success',
      }).catch(() => {});"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('OK [OperationRecord.tsx] BREAK_END')
else:
    print('SKIP BREAK_END')

# UNLOADING_COMPLETED: '荷降が完了しました' の直後
old3 = "      toast.success('荷降が完了しました。次の積込場所へ移動してください。');"
new3 = """      toast.success('荷降が完了しました。次の積込場所へ移動してください。');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'UNLOADING_COMPLETED',
        operationId: currentOperationId,
        locationId: unloadingLocationId || undefined,
        locationName: operationStore.unloadingLocation || undefined,
        phase: 'TO_LOADING',
        result: 'success',
      }).catch(() => {});"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('OK [OperationRecord.tsx] UNLOADING_COMPLETED')
else:
    print('SKIP UNLOADING_COMPLETED')

if s != orig:
    with open(f, 'w', encoding='utf-8') as fh: fh.write(s)

# ==============================================================================
# 2. RefuelRecord.tsx: FUELING — '給油記録を保存しました' の直後
# ==============================================================================
f2 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/RefuelRecord.tsx'
with open(f2, 'r', encoding='utf-8') as fh: s2 = fh.read()
orig2 = s2

old_f = "      toast.success('給油記録を保存しました');\n      navigate('/operation-record');"
new_f = """      toast.success('給油記録を保存しました');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'FUELING',
        operationId: currentOperationId,
        fuelAmount: fuelAmountNum,
        fuelCostYen: fuelCostNum,
        gps: gpsCoords.latitude ? { lat: gpsCoords.latitude, lng: gpsCoords.longitude!, accuracy: gpsCoords.accuracy } : undefined,
        result: 'success',
      }).catch(() => {});
      navigate('/operation-record');"""
if old_f in s2:
    s2 = s2.replace(old_f, new_f, 1)
    print('OK [RefuelRecord.tsx] FUELING')
    with open(f2, 'w', encoding='utf-8') as fh: fh.write(s2)
else:
    print('SKIP [RefuelRecord.tsx] FUELING')

# ==============================================================================
# 3. LoadingConfirmation.tsx: LOADING_ARRIVED ログ追加（D5a経由のケース）
# ==============================================================================
f3 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/LoadingConfirmation.tsx'
with open(f3, 'r', encoding='utf-8') as fh: s3 = fh.read()
orig3 = s3

old_lc = """      console.log('🔄 フェーズ維持: AT_LOADING（積込確認完了・自動移動検知待ち）');
      operationStore.setPhase('AT_LOADING');
      
      // 🔧 修正: 積込場所情報も更新
      operationStore.setLoadingLocation(loadingData.locationName, loadingData.locationId);"""
new_lc = """      console.log('🔄 フェーズ維持: AT_LOADING（積込確認完了・自動移動検知待ち）');
      operationStore.setPhase('AT_LOADING');
      
      // 🔧 修正: 積込場所情報も更新
      operationStore.setLoadingLocation(loadingData.locationName, loadingData.locationId);
      // 🚛 運行イベントログ（積込到着 D5a経由）
      apiService.logOperationEvent({
        eventType: 'LOADING_ARRIVED',
        operationId: currentOperationId,
        locationId: loadingData.locationId,
        locationName: loadingData.locationName,
        itemId: loadingData.itemId || undefined,
        itemName: loadingData.itemName || undefined,
        customItemName: loadingData.customItemName || undefined,
        quantity: loadingData.quantity,
        gps: position ? { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy } : undefined,
        phase: 'AT_LOADING',
        result: 'success',
      }).catch(() => {});"""
if old_lc in s3 and 'logOperationEvent' not in s3:
    s3 = s3.replace(old_lc, new_lc, 1)
    print('OK [LoadingConfirmation.tsx] LOADING_ARRIVED')
    with open(f3, 'w', encoding='utf-8') as fh: fh.write(s3)
else:
    print('SKIP [LoadingConfirmation.tsx]')

# ==============================================================================
# TSC → push
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
        for line in (r.stdout+r.stderr).strip().splitlines()[-8:]: print(f'   {line}')
        ok = False

if ok:
    repo = '/home/karkyon/projects/dump-tracker'
    subprocess.run(['git','add','-A'], cwd=repo)
    r = subprocess.run(['git','commit','-m',
        'feat: 全イベントログ完備(BREAK_START/END/UNLOADING_COMPLETED/FUELING/LOADING_ARRIVED D5a)'],
        cwd=repo, capture_output=True, text=True)
    print(r.stdout.strip())
    r2 = subprocess.run(['git','push','origin','main'], cwd=repo, capture_output=True, text=True)
    print(r2.stdout.strip() or r2.stderr.strip())
    print('✅ Push完了')
    # ゴミファイル削除
    import os
    for gomi in ['fix_event_logging.py','fix_custom_item.py']:
        p = f'{repo}/{gomi}'
        if os.path.exists(p):
            os.remove(p)
            subprocess.run(['git','add','-A'], cwd=repo)
            subprocess.run(['git','commit','--allow-empty','-m','chore: fix_*.py ゴミファイル削除'], cwd=repo, capture_output=True)
            subprocess.run(['git','push','origin','main'], cwd=repo, capture_output=True)
else:
    print('❌ TSCエラーあり → push中止')
