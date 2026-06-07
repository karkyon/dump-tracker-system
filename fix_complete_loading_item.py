#!/usr/bin/env python3
"""
fix_complete_loading_item.py
=============================
【根本原因】
1. tripService.completeLoading の itemId: data.itemId || undefined
   → data.itemId が未送信(undefined)の場合、loadingDetail.itemId が null で上書きされる
   → 修正: data.itemId が来た時だけ更新、なければ loadingDetail.itemId を維持

2. OperationRecord.tsx handleLoadingComplete が completeLoadingAtLocation に
   itemId も customItemName も渡していない → APIに品目情報がゼロで届く

【実行方法】
  cd ~/projects/dump-tracker && python3 fix_complete_loading_item.py
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
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'OK [{label}]')
    return True

# =============================================================================
# 1. tripService.ts: completeLoading の itemId 上書きバグ修正
#    data.itemId が未送信の場合は loadingDetail.itemId を維持する
# =============================================================================
ok1 = patch(
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
          notes: completeResolvedNotes,  // ✅ 修正: 手入力品目名を含む''',
    '''      // ✅ 修正: itemId が送られた場合のみ更新（未送信の場合は既存の itemId を維持）
      const resolvedItemId = data.itemId ? data.itemId : (loadingDetail.itemId ?? undefined);

      // operation_detail更新（actualEndTime, itemId, quantityTons を設定）
      const updatedDetail = await this.operationDetailService.update(
        loadingDetail.id,
        {
          actualEndTime: data.endTime || new Date(),
          itemId: resolvedItemId,  // ✅ 修正: 既存 itemId を維持
          quantityTons: data.quantity !== undefined
            ? data.quantity
            : Number(loadingDetail.quantityTons),
          notes: completeResolvedNotes,  // ✅ 修正: 手入力品目名を含む''',
    'tripService.completeLoading: itemId未送信時に既存itemIdを維持'
)

# =============================================================================
# 2. OperationRecord.tsx: handleLoadingComplete で operationStore から
#    itemId/customItemName を取得して completeLoadingAtLocation に渡す
# =============================================================================
ok2 = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''    try {
      setIsSubmitting(true);
      await retryWithBackoff(
        () => apiService.completeLoadingAtLocation(currentOperationId, {
          endTime: new Date(),
          notes: '積込完了',
        }),
        3, 1000, '積込完了'
      );''',
    '''    try {
      setIsSubmitting(true);
      // ✅ 修正: operationStore に保存された品目情報を completeLoading に渡す
      const loadingItemId = (operationStore as any).loadingItemId as string | undefined;
      const loadingCustomItemName = (operationStore as any).loadingCustomItemName as string | undefined;
      console.log('[D4-積込完了] 品目情報:', { loadingItemId, loadingCustomItemName });
      await retryWithBackoff(
        () => apiService.completeLoadingAtLocation(currentOperationId, {
          endTime: new Date(),
          notes: '積込完了',
          ...(loadingItemId ? { itemId: loadingItemId } : {}),
          ...(loadingCustomItemName ? { customItemName: loadingCustomItemName } : {}),
        }),
        3, 1000, '積込完了'
      );''',
    'OperationRecord: handleLoadingComplete に itemId/customItemName 追加'
)

# =============================================================================
# 3. LoadingInput.tsx: recordLoadingArrival 成功後に operationStore へ
#    品目情報（itemId / customItemName）を保存する
# =============================================================================
ok3 = patch(
    'frontend/mobile/src/pages/LoadingInput.tsx',
    '''      console.log('✅ 積込場所到着記録完了');
      console.log('📦 API応答:', response);''',
    '''      console.log('✅ 積込場所到着記録完了');
      console.log('📦 API応答:', response);
      // ✅ 修正: 品目情報を operationStore に保存（積込完了ボタン押下時に使用）
      if (formData.itemId || formData.customItemName) {
        (operationStore as any).loadingItemId = formData.itemId || undefined;
        (operationStore as any).loadingCustomItemName = formData.customItemName || undefined;
        console.log('[D5] 品目情報をoperationStoreに保存:', { itemId: formData.itemId, customItemName: formData.customItemName });
      }''',
    'LoadingInput: recordLoadingArrival後に品目情報をoperationStoreに保存'
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
    'fix: 積込完了時のitemId上書きバグ根本修正\n\n'
    '- tripService.completeLoading: data.itemId未送信時に既存itemIdをnullで上書きしていたバグを修正\n'
    '- OperationRecord.handleLoadingComplete: completeLoadingAtLocationにitemId/customItemNameを渡すよう修正\n'
    '- LoadingInput: recordLoadingArrival成功後にoperationStoreへ品目情報を保存'
], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print('✅ Push完了')
