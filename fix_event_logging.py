import subprocess

# ==============================================================================
# 1. mobileRoutes.ts: POST /mobile/events/log エンドポイント追加
# ==============================================================================
f1 = '/home/karkyon/projects/dump-tracker/backend/src/routes/mobileRoutes.ts'
with open(f1, 'r', encoding='utf-8') as fh: s = fh.read()

event_log_route = '''
// ================================
// 🚛 運行イベントログAPI（構造化）
// POST /api/v1/mobile/events/log
// 積込/荷降/給油/休憩の各イベントを構造化してバックエンドに記録
// ================================
router.post(
  '/events/log',
  authenticateToken(),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      eventType,    // LOADING_ARRIVED | LOADING_COMPLETED | UNLOADING_ARRIVED | UNLOADING_COMPLETED | BREAK_START | BREAK_END | FUELING | OPERATION_START | OPERATION_END
      operationId,
      operationNumber,
      driverId,
      driverName,
      vehicleId,
      vehiclePlateNumber,
      locationId,
      locationName,
      locationAddress,
      itemId,
      itemName,
      customItemName,
      quantity,
      unit,
      fuelAmount,
      fuelCostYen,
      gps,          // { lat, lng, accuracy }
      timestamp,
      phase,
      notes,
      result,       // success | error
      errorMessage,
    } = req.body as Record<string, any>;

    const user = (req as any).user;
    const logMsg = `[OPERATION_EVENT] ${eventType || 'UNKNOWN'}`;

    logger.info(logMsg, {
      eventType,
      operationId,
      operationNumber,
      driverId: driverId || user?.userId,
      driverName: driverName || user?.name,
      vehicleId,
      vehiclePlateNumber,
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
    });

    res.json({ success: true, message: 'イベントログを記録しました' });
  })
);
'''

# /debug/log の直前に追加
insert_before = '// 🐛 フロントエンドデバッグログAPI'
if insert_before in s and '/events/log' not in s:
    s = s.replace(insert_before, event_log_route + insert_before)
    with open(f1, 'w', encoding='utf-8') as fh: fh.write(s)
    print('OK [mobileRoutes.ts] /events/log エンドポイント追加')
else:
    print('SKIP [mobileRoutes.ts] 既存or不一致')

# ==============================================================================
# 2. api.ts: logOperationEvent メソッド追加
# ==============================================================================
f2 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/services/api.ts'
with open(f2, 'r', encoding='utf-8') as fh: s = fh.read()

log_method = '''
  // =============================================================================
  // 運行イベントログAPI（構造化）
  // =============================================================================

  /**
   * 運行イベントをバックエンドに構造化ログとして送信
   * POST /api/v1/mobile/events/log
   * 積込/荷降/給油/休憩 の各イベント発生時に呼び出す
   */
  async logOperationEvent(data: {
    eventType: 'LOADING_ARRIVED' | 'LOADING_COMPLETED' | 'UNLOADING_ARRIVED' | 'UNLOADING_COMPLETED' |
               'BREAK_START' | 'BREAK_END' | 'FUELING' | 'OPERATION_START' | 'OPERATION_END';
    operationId?: string;
    operationNumber?: string;
    driverId?: string;
    driverName?: string;
    vehicleId?: string;
    vehiclePlateNumber?: string;
    locationId?: string;
    locationName?: string;
    locationAddress?: string;
    itemId?: string;
    itemName?: string;
    customItemName?: string;
    quantity?: number;
    unit?: string;
    fuelAmount?: number;
    fuelCostYen?: number;
    gps?: { lat: number; lng: number; accuracy?: number };
    timestamp?: string;
    phase?: string;
    notes?: string;
    result?: 'success' | 'error';
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.axiosInstance.post('/mobile/events/log', {
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
      });
    } catch {
      // ログ送信失敗は無視（運行操作を妨げない）
    }
  }
'''

# GPS位置情報APIセクションの直前に追加
insert_target = '  // =============================================================================\n  // GPS位置情報API'
if 'logOperationEvent' not in s and insert_target in s:
    s = s.replace(insert_target, log_method + '\n  // =============================================================================\n  // GPS位置情報API')
    with open(f2, 'w', encoding='utf-8') as fh: fh.write(s)
    print('OK [api.ts] logOperationEvent メソッド追加')
else:
    print('SKIP [api.ts] 既存or不一致')

# ==============================================================================
# 3. OperationRecord.tsx: 各イベントハンドラにlogOperationEvent呼び出し追加
#    - handleBreakStart (休憩開始)
#    - handleBreakEnd   (休憩終了)
#    - handleLoadingComplete (積込完了)
#    - handleUnloadingComplete (荷降完了)
# ==============================================================================
f3 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/OperationRecord.tsx'
with open(f3, 'r', encoding='utf-8') as fh: s = fh.read()
orig3 = s

# 休憩開始成功後ログ
old_break_start = "      toast.success('休憩を開始しました。', {\n        duration: 3000,\n        icon: '☕'\n      });"
new_break_start = """      toast.success('休憩を開始しました。', {
        duration: 3000,
        icon: '☕'
      });
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'BREAK_START',
        operationId: currentOperationId,
        gps: bgState.lastPosition ? { lat: bgState.lastPosition.coords.latitude, lng: bgState.lastPosition.coords.longitude, accuracy: bgState.lastPosition.coords.accuracy } : undefined,
        phase: operationStore.phase,
        result: 'success',
      }).catch(() => {});"""
if old_break_start in s:
    s = s.replace(old_break_start, new_break_start, 1)
    print('OK [OperationRecord.tsx] BREAK_START ログ追加')
else:
    print('SKIP [OperationRecord.tsx] BREAK_START パターン不一致')

# 休憩終了成功後ログ
old_break_end = "      toast.success('休憩を終了しました。', {\n        duration: 3000,\n        icon: '▶️'\n      });"
new_break_end = """      toast.success('休憩を終了しました。', {
        duration: 3000,
        icon: '▶️'
      });
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'BREAK_END',
        operationId: currentOperationId,
        phase: operationStore.phase,
        result: 'success',
      }).catch(() => {});"""
if old_break_end in s:
    s = s.replace(old_break_end, new_break_end, 1)
    print('OK [OperationRecord.tsx] BREAK_END ログ追加')
else:
    print('SKIP [OperationRecord.tsx] BREAK_END パターン不一致')

# 荷降完了成功後ログ
old_unloading = "      toast.success('荷降を完了しました。次の積込場所へ移動してください。', {\n        duration: 4000\n      });"
new_unloading = """      toast.success('荷降を完了しました。次の積込場所へ移動してください。', {
        duration: 4000
      });
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'UNLOADING_COMPLETED',
        operationId: currentOperationId,
        locationId: operationStore.unloadingLocationId || undefined,
        locationName: operationStore.unloadingLocation || undefined,
        phase: operationStore.phase,
        result: 'success',
      }).catch(() => {});"""
if old_unloading in s:
    s = s.replace(old_unloading, new_unloading, 1)
    print('OK [OperationRecord.tsx] UNLOADING_COMPLETED ログ追加')
else:
    print('SKIP [OperationRecord.tsx] UNLOADING_COMPLETED パターン不一致')

# 積込完了成功後ログ
old_loading_complete = "      toast.success('積込が完了しました。荷降場所へ移動してください。');"
new_loading_complete = """      toast.success('積込が完了しました。荷降場所へ移動してください。');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'LOADING_COMPLETED',
        operationId: currentOperationId,
        locationId: operationStore.loadingLocationId || undefined,
        locationName: operationStore.loadingLocation || undefined,
        phase: operationStore.phase,
        result: 'success',
      }).catch(() => {});"""
if old_loading_complete in s:
    s = s.replace(old_loading_complete, new_loading_complete, 1)
    print('OK [OperationRecord.tsx] LOADING_COMPLETED ログ追加')
else:
    print('SKIP [OperationRecord.tsx] LOADING_COMPLETED パターン不一致')

if s != orig3:
    with open(f3, 'w', encoding='utf-8') as fh: fh.write(s)

# ==============================================================================
# 4. LoadingInput.tsx: 積込到着成功後にイベントログ送信
# ==============================================================================
f4 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/LoadingInput.tsx'
with open(f4, 'r', encoding='utf-8') as fh: s = fh.read()

old_loading_arrived = "      // REQ-019修正: 積込確認後はAT_LOADINGに留める（自動移動検知でTO_UNLOADINGへ移行）\n      console.log('🔄 フェーズ維持: AT_LOADING（積込確認完了・自動移動検知待ち）');\n      operationStore.setPhase('AT_LOADING');\n      operationStore.setLoadingLocation(formData.locationName, formData.locationId);"
new_loading_arrived = """      // REQ-019修正: 積込確認後はAT_LOADINGに留める（自動移動検知でTO_UNLOADINGへ移行）
      console.log('🔄 フェーズ維持: AT_LOADING（積込確認完了・自動移動検知待ち）');
      operationStore.setPhase('AT_LOADING');
      operationStore.setLoadingLocation(formData.locationName, formData.locationId);
      // 🚛 運行イベントログ（積込到着）
      apiService.logOperationEvent({
        eventType: 'LOADING_ARRIVED',
        operationId: currentOperationId,
        locationId: formData.locationId,
        locationName: formData.locationName,
        itemId: formData.itemId || undefined,
        itemName: formData.itemName || undefined,
        customItemName: formData.customItemName || undefined,
        quantity: formData.quantity,
        gps: position ? { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy } : undefined,
        phase: 'AT_LOADING',
        result: 'success',
      }).catch(() => {});"""

if old_loading_arrived in s:
    s = s.replace(old_loading_arrived, new_loading_arrived, 1)
    with open(f4, 'w', encoding='utf-8') as fh: fh.write(s)
    print('OK [LoadingInput.tsx] LOADING_ARRIVED ログ追加')
else:
    print('SKIP [LoadingInput.tsx] パターン不一致')

# ==============================================================================
# 5. RefuelRecord.tsx: 給油記録成功後にイベントログ送信
# ==============================================================================
f5 = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/RefuelRecord.tsx'
with open(f5, 'r', encoding='utf-8') as fh: s = fh.read()

# 給油成功のトーストを探す
old_fuel = "toast.success('給油を記録しました'"
if old_fuel in s and 'logOperationEvent' not in s:
    # 給油成功トーストの直後にログ追加
    idx = s.find(old_fuel)
    end_idx = s.find(');', idx) + 2
    insert_pos = s.find('\n', end_idx) + 1
    log_code = """      // 🚛 運行イベントログ（給油）
      apiService.logOperationEvent({
        eventType: 'FUELING',
        operationId: operationStore.operationId || undefined,
        fuelAmount: fuelAmount ? Number(fuelAmount) : undefined,
        fuelCostYen: fuelCost ? Number(fuelCost) : undefined,
        result: 'success',
      }).catch(() => {});\n"""
    s = s[:insert_pos] + log_code + s[insert_pos:]
    with open(f5, 'w', encoding='utf-8') as fh: fh.write(s)
    print('OK [RefuelRecord.tsx] FUELING ログ追加')
else:
    print('SKIP [RefuelRecord.tsx] パターン不一致 or 既存')

# ==============================================================================
# TSC → git push
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
        for line in (r.stdout+r.stderr).strip().splitlines()[-10:]:
            print(f'   {line}')
        ok = False

if ok:
    repo = '/home/karkyon/projects/dump-tracker'
    subprocess.run(['git','add','-A'], cwd=repo)
    r = subprocess.run(['git','commit','-m',
        'feat: 運行イベント構造化ログAPI追加(積込/荷降/給油/休憩をbackendに記録)'],
        cwd=repo, capture_output=True, text=True)
    print(r.stdout.strip())
    r2 = subprocess.run(['git','push','origin','main'], cwd=repo, capture_output=True, text=True)
    print(r2.stdout.strip() or r2.stderr.strip())
    print('✅ Push完了')
else:
    print('❌ TSCエラーあり → push中止')
