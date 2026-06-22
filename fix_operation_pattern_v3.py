#!/usr/bin/env python3
"""
コンパイルエラー最終修正 v3
問題1: VehicleManagement.tsx - useState初期値に loadingPattern/unloadingPattern がない
問題2: OperationRecord.tsx - operationStore.loadingPattern が number|undefined になる
       → OperationState インターフェースの型定義問題
"""
import os, sys, subprocess

BASE = '/home/karkyon/projects/dump-tracker'

def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def patch(path, old, new, label):
    content = read(path)
    if old not in content:
        print(f'  ⚠️  SKIP [{label}] アンカーが見つかりません')
        return False
    write(path, content.replace(old, new, 1))
    print(f'  ✅ [{label}]')
    return True

# ============================================================
# Fix 1: VehicleManagement.tsx
# useState<VehicleFormData>({ ... }) の初期値に loadingPattern/unloadingPattern を追加
# 現状: interfaceが追加されたが、useState初期値に含まれていない
# ============================================================
CMS_VM = f'{BASE}/frontend/cms/src/pages/VehicleManagement.tsx'

patch(
    CMS_VM,
    '''  const [formData, setFormData] = useState<VehicleFormData>({
    plateNumber: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    capacity: 0,
    fuelType: 'DIESEL' as 'DIESEL' | 'GASOLINE' | 'HYBRID' | 'ELECTRIC',
    currentMileage: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE',
    notes: '',
    inspectionExpiry: '',  // REQ-007: 車検期限
    region: '' as TransportRegion | '',  // 🆕 P4-03: 管轄区域（地方運輸局）
  });''',
    '''  const [formData, setFormData] = useState<VehicleFormData>({
    plateNumber: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    capacity: 0,
    fuelType: 'DIESEL' as 'DIESEL' | 'GASOLINE' | 'HYBRID' | 'ELECTRIC',
    currentMileage: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE',
    notes: '',
    inspectionExpiry: '',  // REQ-007: 車検期限
    region: '' as TransportRegion | '',  // 🆕 P4-03: 管轄区域（地方運輸局）
    loadingPattern: 2,    // 🆕 デフォルト P2
    unloadingPattern: 2,  // 🆕 デフォルト U2
  });''',
    'VehicleManagement: useState初期値に loadingPattern/unloadingPattern 追加'
)

# ============================================================
# Fix 2: OperationRecord.tsx
# operationStore.loadingPattern/unloadingPattern が number|undefined になる
# → useOperationStore() の selector で明示的に number に変換
# エラー箇所: line 1039-1040
# case 'UNLOADING_IN_PROGRESS' 内の selectedUnloadingLocation 設定部分
# ============================================================
OP_REC = f'{BASE}/frontend/mobile/src/pages/OperationRecord.tsx'

# operationStore 取得部分で loadingPattern/unloadingPattern を number として取り出す
# OperationRecord.tsx の operationStore 使用箇所でキャストを追加

# getPhaseButtons 内の _lp/_up を Number() でラップ
patch(
    OP_REC,
    '''        const _lp: number = (operationStore.loadingPattern as number | undefined) ?? 2;''',
    '''        const _lp: number = Number(operationStore.loadingPattern ?? 2);''',
    'OperationRecord: AT_LOADING _lp を Number() でキャスト'
)

patch(
    OP_REC,
    '''        const _up: number = (operationStore.unloadingPattern as number | undefined) ?? 2;''',
    '''        const _up: number = Number(operationStore.unloadingPattern ?? 2);''',
    'OperationRecord: AT_UNLOADING _up を Number() でキャスト'
)

# line 1039-1040 のエラーは UNLOADING_IN_PROGRESS case 内の別の箇所
# エラーメッセージ: Type 'number | undefined' is not assignable to type 'number'.
# これは getPhaseButtons 関数の return 文の中の case 文内
# 上記の修正で Number() を使えば undefined は 2 になり number になる

# LoadingInput.tsx の loadingPattern 参照も同様に修正
LOADING_INPUT = f'{BASE}/frontend/mobile/src/pages/LoadingInput.tsx'

patch(
    LOADING_INPUT,
    '''      const _lp: number = (operationStore as any).loadingPattern ?? 2;''',
    '''      const _lp: number = Number((operationStore as any).loadingPattern ?? 2);''',
    'LoadingInput: _lp を Number() でキャスト'
)

patch(
    LOADING_INPUT,
    '''      const _lpNow: number = (operationStore as any).loadingPattern ?? 2;''',
    '''      const _lpNow: number = Number((operationStore as any).loadingPattern ?? 2);''',
    'LoadingInput: _lpNow を Number() でキャスト'
)

patch(
    LOADING_INPUT,
    '''      const _lpPhase: number = (operationStore as any).loadingPattern ?? 2;''',
    '''      const _lpPhase: number = Number((operationStore as any).loadingPattern ?? 2);''',
    'LoadingInput: _lpPhase を Number() でキャスト'
)

# ============================================================
# Fix 3: OperationRecord.tsx
# handleUnloadingStart / handleLoadingStart の
# currentPosition?.coords.latitude/longitude が number|undefined
# startUnloadingAtLocation/startLoadingAtLocation の latitude/longitude は
# number|undefined を受け付けるが、型定義が strict な場合エラーになる
# → 明示的に undefined をフォールバック
# エラー行1039-1040: handleUnloadingStart の startUnloadingAtLocation 呼び出し
# ============================================================
patch(
    OP_REC,
    '''      await retryWithBackoff(
        () => apiService.startUnloadingAtLocation(currentOperationId, {
          locationId: unloadingLocationId,
          startTime: new Date(),
          latitude: currentPosition?.coords.latitude,
          longitude: currentPosition?.coords.longitude,
          accuracy: currentPosition?.coords.accuracy,
          notes: '荷降開始',
        }),
        3, 1000, '荷降開始'
      );''',
    '''      await retryWithBackoff(
        () => apiService.startUnloadingAtLocation(currentOperationId, {
          locationId: unloadingLocationId,
          startTime: new Date(),
          latitude: currentPosition?.coords.latitude ?? undefined,
          longitude: currentPosition?.coords.longitude ?? undefined,
          accuracy: currentPosition?.coords.accuracy ?? undefined,
          notes: '荷降開始',
        }),
        3, 1000, '荷降開始'
      );''',
    'OperationRecord: handleUnloadingStart の GPS coords 型修正'
)

patch(
    OP_REC,
    '''      await retryWithBackoff(
        () => apiService.startLoadingAtLocation(currentOperationId, {
          locationId: loadingLocationId,
          startTime: new Date(),
          latitude: currentPosition?.coords.latitude,
          longitude: currentPosition?.coords.longitude,
          accuracy: currentPosition?.coords.accuracy,
          notes: '積込開始',
        }),
        3, 1000, '積込開始'
      );''',
    '''      await retryWithBackoff(
        () => apiService.startLoadingAtLocation(currentOperationId, {
          locationId: loadingLocationId,
          startTime: new Date(),
          latitude: currentPosition?.coords.latitude ?? undefined,
          longitude: currentPosition?.coords.longitude ?? undefined,
          accuracy: currentPosition?.coords.accuracy ?? undefined,
          notes: '積込開始',
        }),
        3, 1000, '積込開始'
      );''',
    'OperationRecord: handleLoadingStart の GPS coords 型修正'
)

# ============================================================
# コンパイル確認
# ============================================================
print('\n修正完了。コンパイル確認を実行します...')

errors = 0
for proj in ['backend', 'frontend/cms', 'frontend/mobile']:
    print(f'\n==== TSC: {proj} ====')
    r = subprocess.run(
        './node_modules/.bin/tsc --noEmit',
        shell=True, cwd=f'{BASE}/{proj}',
        capture_output=True, text=True
    )
    if r.stdout: print(r.stdout[-3000:])
    if r.stderr: print(r.stderr[-1000:])
    if r.returncode != 0:
        errors += 1
        print(f'  ❌ コンパイルエラー: {proj}')
    else:
        print(f'  ✅ コンパイルOK: {proj}')

if errors > 0:
    print(f'\n❌ {errors}件のコンパイルエラー → Push中止')
    sys.exit(1)

print('\n==== Git commit & push ====')
def run(cmd):
    r = subprocess.run(cmd, shell=True, cwd=BASE, capture_output=True, text=True)
    if r.stdout: print(r.stdout[-2000:])
    if r.stderr: print(r.stderr[-500:], file=sys.stderr)
    return r.returncode

run('git add -A')
run('''git commit -m "feat: 車両別オペレーションパターン設定機能追加 (P1/P2/P3 + U1/U2/U3)

- vehiclesテーブルにloading_pattern/unloading_pattern追加
- モバイル: 車両選択時にパターンをStoreに保存
- OperationRecord: パターン別ボタン表示分岐
- LoadingInput: P3で即TO_UNLOADING(S=E同時記録)
- UNLOADING_IN_PROGRESSフェーズ追加(U1専用)
- CMS: 車両管理フォームにパターン選択追加"''')
rc = run('git push origin main')
if rc == 0:
    print('\n✅✅✅ Push完了！CI/CDが起動します。')
else:
    print('\n❌ Push失敗')

os.remove(__file__)
print('🗑️  スクリプト自己削除完了')
