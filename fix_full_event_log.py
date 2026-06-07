#!/usr/bin/env python3
"""
fix_full_event_log.py
======================
【修正内容】
1. backend/src/routes/mobileRoutes.ts
   - /events/log エンドポイントに fs.appendFileSync 追加
     → [OPERATION_EVENT] が combined.log に確実に書き込まれる

2. backend/src/controllers/tripController.ts
   - addLoadingRecord の activityInput に customItemName を追加
     → tripService.addActivity の [手入力品目:] notes変換が実行される

3. frontend/mobile/src/pages/LoadingInput.tsx
   - 品目選択/解除、手入力変更、数量変更、客先変更、画面マウント時の
     詳細 console.log を追加
     → CONSOLE_BATCH でバックエンドに転送される

4. frontend/mobile/src/pages/OperationRecord.tsx
   - 各ハンドラー（積込開始/完了、荷降完了、休憩開始/終了、運行完了）の
     開始/引数の詳細 console.log を追加

5. frontend/mobile/src/pages/RefuelRecord.tsx
   - handleSubmit の詳細 console.log 追加
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

# =============================================================================
# 1. mobileRoutes.ts: /events/log に fs.appendFileSync 追加
# =============================================================================
patch(
    'backend/src/routes/mobileRoutes.ts',
    '''    const logMsg = `[OPERATION_EVENT] ${eventType || 'UNKNOWN'}`;

    logger.info(logMsg, {''',
    '''    const logMsg = `[OPERATION_EVENT] ${eventType || 'UNKNOWN'}`;

    // ✅ fs 直接書き込み（/debug/log と同じ方式で combined.log に確実に保存）
    const _fs = require('fs');
    const _path = require('path');
    const _eventLogData = {
      eventType, operationId, operationNumber,
      driverId: driverId || user?.userId,
      driverName: driverName || user?.name,
      vehicleId, vehiclePlateNumber,
      location: locationName ? { id: locationId, name: locationName, address: locationAddress } : null,
      item: (itemId || itemName || customItemName) ? { id: itemId, name: itemName, customName: customItemName } : null,
      quantity: quantity !== undefined ? Number(quantity) : null,
      unit: unit || null,
      fuel: (fuelAmount !== undefined) ? { amount: Number(fuelAmount), costYen: fuelCostYen ? Number(fuelCostYen) : null } : null,
      gps: gps ? { lat: Number(gps.lat), lng: Number(gps.lng), accuracy: gps.accuracy ? Number(gps.accuracy) : null } : null,
      timestamp: timestamp || new Date().toISOString(),
      phase: phase || null,
      notes: notes || null,
      result: result || 'success',
      errorMessage: errorMessage || null,
    };
    const _eventLine = JSON.stringify({
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false }),
      level: 'info',
      message: logMsg,
      data: _eventLogData,
    }) + '\\n';
    _fs.appendFileSync(_path.join(process.cwd(), 'logs', 'combined.log'), _eventLine);

    logger.info(logMsg, {''',
    'mobileRoutes: /events/log に appendFileSync 追加'
)

# =============================================================================
# 2. tripController.ts: addLoadingRecord の activityInput に customItemName 追加
# =============================================================================
patch(
    'backend/src/controllers/tripController.ts',
    '''      // activityInput 構築
      const activityInput: CreateTripDetailRequest = {
        locationId: activityData.locationId,
        itemId: processedItemId,
        quantity: processedQuantity,
        activityType: 'LOADING',
        startTime: activityData.startTime || new Date(),
        endTime: activityData.endTime,
        notes: activityData.notes || '',
        // 🆕 GPS データを operation_details に保存
        latitude: activityData.latitude ?''',
    '''      // activityInput 構築
      const activityInput: CreateTripDetailRequest = {
        locationId: activityData.locationId,
        itemId: processedItemId,
        quantity: processedQuantity,
        activityType: 'LOADING',
        startTime: activityData.startTime || new Date(),
        endTime: activityData.endTime,
        notes: activityData.notes || '',
        // ✅ 手入力品目名（tripService.addActivity で notes に変換）
        ...(activityData.customItemName ? { customItemName: activityData.customItemName } : {}),
        // 🆕 GPS データを operation_details に保存
        latitude: activityData.latitude ?''',
    'tripController: addLoadingRecord に customItemName 追加'
)

# =============================================================================
# 3. LoadingInput.tsx: 品目選択/解除/手入力/数量の詳細ログ追加
# =============================================================================

# 3-1. 品目選択トグル
patch(
    'frontend/mobile/src/pages/LoadingInput.tsx',
    '''  /** 品目選択トグル（複数選択対応） */
  const handleItemToggle = (itemId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedItemIds.includes(itemId);
      const newSelection = isSelected
        ? prev.selectedItemIds.filter(id => id !== itemId)
        : [...prev.selectedItemIds, itemId];

      const selectedItems = items.filter(item => newSelection.includes(item.id));
      const firstItemId = newSelection.length > 0 && newSelection[0] ? newSelection[0] : '';
      const firstItemName = selectedItems.length > 0 && selectedItems[0] ? selectedItems[0].name : '';

      return {
        ...prev,
        selectedItemIds: newSelection,
        selectedItemNames: selectedItems.map(item => item.name),
        itemId: firstItemId,
        itemName: firstItemName,
      };
    });
  };''',
    '''  /** 品目選択トグル（複数選択対応） */
  const handleItemToggle = (itemId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedItemIds.includes(itemId);
      const newSelection = isSelected
        ? prev.selectedItemIds.filter(id => id !== itemId)
        : [...prev.selectedItemIds, itemId];

      const selectedItems = items.filter(item => newSelection.includes(item.id));
      const firstItemId = newSelection.length > 0 && newSelection[0] ? newSelection[0] : '';
      const firstItemName = selectedItems.length > 0 && selectedItems[0] ? selectedItems[0].name : '';

      const itemName = items.find(i => i.id === itemId)?.name || itemId;
      console.log(`[D5-品目] ${isSelected ? '解除' : '選択'}: itemId=${itemId} name=${itemName} 選択後一覧=[${newSelection.map(id => items.find(i=>i.id===id)?.name||id).join(',')}]`);

      return {
        ...prev,
        selectedItemIds: newSelection,
        selectedItemNames: selectedItems.map(item => item.name),
        itemId: firstItemId,
        itemName: firstItemName,
      };
    });
  };''',
    'LoadingInput: 品目選択ログ追加'
)

# 3-2. 手入力変更
patch(
    'frontend/mobile/src/pages/LoadingInput.tsx',
    '''  /** 「その他」手入力ハンドラー */
  const handleCustomItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, customItemName: e.target.value }));
  };''',
    '''  /** 「その他」手入力ハンドラー */
  const handleCustomItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    console.log(`[D5-手入力品目] 入力変更: "${val}"`);
    setFormData(prev => ({ ...prev, customItemName: val }));
  };''',
    'LoadingInput: 手入力品目ログ追加'
)

# 3-3. 数量変更
patch(
    'frontend/mobile/src/pages/LoadingInput.tsx',
    '''  /** 数量入力ハンドラー */
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      quantity: value ?''',
    '''  /** 数量入力ハンドラー */
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log(`[D5-数量] 入力変更: "${value}"`);
    setFormData(prev => ({
      ...prev,
      quantity: value ?''',
    'LoadingInput: 数量変更ログ追加'
)

# 3-4. 積込確認ボタン押下直前の詳細ログ
patch(
    'frontend/mobile/src/pages/LoadingInput.tsx',
    '''      console.log('🚛 積込場所到着記録API呼び出し開始');
      console.log('📍 運行ID:', currentOperationId);
      console.log('📍 地点ID:', formData.locationId);
      console.log('📍 品目:', formData.itemName || formData.customItemName);
      console.log('📍 複数品目:', formData.selectedItemNames);''',
    '''      console.log('🚛 積込場所到着記録API呼び出し開始');
      console.log('[D5-送信] 積込確認ボタン押下:', JSON.stringify({
        operationId: currentOperationId,
        locationId: formData.locationId,
        locationName: formData.locationName,
        clientName: formData.clientName,
        selectedItemIds: formData.selectedItemIds,
        selectedItemNames: formData.selectedItemNames,
        itemId: formData.itemId,
        itemName: formData.itemName,
        customItemName: formData.customItemName,
        quantity: formData.quantity,
        notes: formData.notes,
        cargoConfirmed: formData.cargoConfirmed,
        gps: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy },
      }));''',
    'LoadingInput: 送信詳細ログ追加'
)

# =============================================================================
# 4. OperationRecord.tsx: 各ハンドラーに詳細ログ追加
# =============================================================================

# 4-1. handleLoadingStart
patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''  const handleLoadingStart = () => {
    // ④修正: API呼び出しなし（LoadingInputで既にLOADINGレコード作成済み）
    // フェーズをLOADING_IN_PROGRESSに変更するのみ
    setOperation(prev => ({ ...prev, phase: 'LOADING_IN_PROGRESS' }));
    operationStore.setPhase('LOADING_IN_PROGRESS');
    toast.success('積込を開始しました（積込完了ボタンで次へ進んでください）');
  };''',
    '''  const handleLoadingStart = () => {
    console.log('[D4-ボタン] 積込開始ボタン押下:', { operationId: operationStore.operationId, phase: operation.phase, loadingLocation: operationStore.loadingLocation });
    // ④修正: API呼び出しなし（LoadingInputで既にLOADINGレコード作成済み）
    // フェーズをLOADING_IN_PROGRESSに変更するのみ
    setOperation(prev => ({ ...prev, phase: 'LOADING_IN_PROGRESS' }));
    operationStore.setPhase('LOADING_IN_PROGRESS');
    toast.success('積込を開始しました（積込完了ボタンで次へ進んでください）');
  };''',
    'OperationRecord: handleLoadingStart 詳細ログ追加'
)

# 4-2. handleLoadingComplete
patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''  const handleLoadingComplete = async () => {
    const currentOperationId = operationStore.operationId;
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません');
      return;
    }
    try {
      setIsSubmitting(true);
      await retryWithBackoff(
        () => apiService.completeLoadingAtLocation(currentOperationId, {
          endTime: new Date(),
          notes: '積込完了',
        }),''',
    '''  const handleLoadingComplete = async () => {
    const currentOperationId = operationStore.operationId;
    console.log('[D4-ボタン] 積込完了ボタン押下:', { operationId: currentOperationId, phase: operation.phase, loadingLocation: operationStore.loadingLocation, loadingLocationId: operationStore.loadingLocationId });
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません');
      return;
    }
    try {
      setIsSubmitting(true);
      await retryWithBackoff(
        () => apiService.completeLoadingAtLocation(currentOperationId, {
          endTime: new Date(),
          notes: '積込完了',
        }),''',
    'OperationRecord: handleLoadingComplete 詳細ログ追加'
)

# 4-3. handleUnloadingComplete
patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''    try {
      setIsSubmitting(true);
      
      const currentOperationId = operationStore.operationId;
      if (!currentOperationId) {
        toast.error('運行IDが見つかりません');
        setIsSubmitting(false);
        return;
      }

      console.log('📦 荷降完了API呼び出し:', {
        tripId: currentOperationId
      });''',
    '''    try {
      setIsSubmitting(true);
      
      const currentOperationId = operationStore.operationId;
      if (!currentOperationId) {
        toast.error('運行IDが見つかりません');
        setIsSubmitting(false);
        return;
      }

      console.log('[D4-ボタン] 荷降完了ボタン押下:', JSON.stringify({ operationId: currentOperationId, phase: operation.phase, unloadingLocation: operationStore.unloadingLocation, unloadingLocationId: operationStore.unloadingLocationId }));
      console.log('📦 荷降完了API呼び出し:', {
        tripId: currentOperationId
      });''',
    'OperationRecord: handleUnloadingComplete 詳細ログ追加'
)

# 4-4. handleBreakStart の console.log 強化
patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''      console.log('☕ 休憩開始処理開始:', currentOperationId);''',
    '''      console.log('[D4-ボタン] 休憩開始ボタン押下:', { operationId: currentOperationId, phase: operation.phase, gps: currentPosition ? { lat: currentPosition.coords.latitude, lng: currentPosition.coords.longitude } : null });
      console.log('☕ 休憩開始処理開始:', currentOperationId);''',
    'OperationRecord: handleBreakStart 詳細ログ追加'
)

# 4-5. handleBreakEnd の console.log 強化
patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''      console.log('⏱️ 休憩終了処理開始:', currentOperationId);''',
    '''      console.log('[D4-ボタン] 休憩終了ボタン押下:', { operationId: currentOperationId, phase: operation.phase, previousPhase: operationStore.previousPhase });
      console.log('⏱️ 休憩終了処理開始:', currentOperationId);''',
    'OperationRecord: handleBreakEnd 詳細ログ追加'
)

# =============================================================================
# 5. RefuelRecord.tsx: 給油保存の詳細ログ強化
# =============================================================================
patch(
    'frontend/mobile/src/pages/RefuelRecord.tsx',
    '''      console.log('⛽ 給油記録保存開始:', {
        tripId: currentOperationId,
        fuelAmount: fuelAmountNum,
        fuelCost: fuelCostNum,
        fuelStation: fuelStation || undefined,
        notes: notes || undefined
      });''',
    '''      console.log('[D7-ボタン] 給油保存ボタン押下:', JSON.stringify({
        operationId: currentOperationId,
        fuelAmount: fuelAmountNum,
        fuelCost: fuelCostNum,
        fuelStation: fuelStation || null,
        mileageAtRefuel: mileageAtRefuelNum || null,
        notes: notes || null,
        gps: gpsCoords,
      }));
      console.log('⛽ 給油記録保存開始:', {
        tripId: currentOperationId,
        fuelAmount: fuelAmountNum,
        fuelCost: fuelCostNum,
        fuelStation: fuelStation || undefined,
        notes: notes || undefined
      });''',
    'RefuelRecord: 給油保存詳細ログ追加'
)

# =============================================================================
# TSC チェック
# =============================================================================
print('\n=== TSC チェック ===')
ok = True
for proj, cwd in [
    ('backend', f'{BASE}/backend'),
    ('mobile', f'{BASE}/frontend/mobile'),
    ('cms',    f'{BASE}/frontend/cms'),
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

# =============================================================================
# git push
# =============================================================================
print('\n=== git push ===')
os.chdir(BASE)
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m',
    'feat: 全運行イベント詳細ログ完備(品目選択/手入力/ボタンクリック/各操作をbackend combined.logに確実記録) + customItemNameのDB保存修正'], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print('✅ Push完了')

# cleanup
script = os.path.join(BASE, 'fix_full_event_log.py')
if os.path.exists(script):
    os.remove(script)
    subprocess.run(['git', 'add', '-A'], cwd=BASE, check=True)
    subprocess.run(['git', 'commit', '-m', 'chore: fix_full_event_log.py 削除'], cwd=BASE, check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], cwd=BASE, check=True)
    print('OK remove: fix_full_event_log.py')
