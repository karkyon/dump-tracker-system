#!/usr/bin/env python3
"""
コンパイルエラー修正パッチ
1. operationStore.ts: 初期状態 + setVehicleInfo実装 に loadingPattern/unloadingPattern 追加
2. VehicleManagement.tsx: formData 型定義に loadingPattern/unloadingPattern 追加
3. OperationRecord.tsx: _upArrival 未使用変数削除 + ?? 2 の型エラー修正
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
# Fix 1: operationStore.ts 初期状態に loadingPattern/unloadingPattern 追加
# ============================================================
STORE = f'{BASE}/frontend/mobile/src/stores/operationStore.ts'

# 初期状態の customerId/customerName の直後に追加
patch(
    STORE,
    '''      customerId: null,           // 🆕
      customerName: null,         // 🆕
      totalDistanceKm: null,      // ✅ Fix-S11-8''',
    '''      customerId: null,           // 🆕
      customerName: null,         // 🆕
      loadingPattern: 2,          // 🆕 デフォルト: P2（品目選択後完了のみ）
      unloadingPattern: 2,        // 🆕 デフォルト: U2（到着後完了のみ）
      totalDistanceKm: null,      // ✅ Fix-S11-8''',
    'operationStore: 初期状態に loadingPattern/unloadingPattern 追加'
)

# setVehicleInfo 実装に loadingPattern/unloadingPattern 保存追加
patch(
    STORE,
    '''          vehicleCapacity: info.capacity ?? null,  // REQ-004
          status: 'IDLE'
        });''',
    '''          vehicleCapacity: info.capacity ?? null,  // REQ-004
          loadingPattern: info.loadingPattern ?? 2,    // 🆕
          unloadingPattern: info.unloadingPattern ?? 2, // 🆕
          status: 'IDLE'
        });''',
    'operationStore: setVehicleInfo 実装に loadingPattern/unloadingPattern 保存追加'
)

# ============================================================
# Fix 2: VehicleManagement.tsx の formData 型定義に loadingPattern/unloadingPattern 追加
# ============================================================
CMS_VM = f'{BASE}/frontend/cms/src/pages/VehicleManagement.tsx'

# useState の型定義箇所を特定して修正
# formData の型は useState の初期値から推論されるため、
# 初期値オブジェクトに loadingPattern/unloadingPattern が含まれるよう
# resetForm だけでなく useState 初期値も修正が必要

content = read(CMS_VM)

# useState の初期値を探して型推論が正しく働くよう修正
# VehicleManagement では formData を useState で管理している
# 型注釈を明示的に追加する方法で対応

# handleEdit 内の setFormData 呼び出し（as any 付き）を修正
# → 既に as any がついている場合は問題ない
# 問題は resetForm（useState初期値）の型推論

# useState 初期値に loadingPattern/unloadingPattern が入れば型が広がる
# resetForm はパッチ済みなので useState を探す

old_usestate = '''  const [formData, setFormData] = useState({
    plateNumber: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    capacity: 0,
    fuelType: 'DIESEL' as const,
    currentMileage: 0,
    status: 'ACTIVE' as const,
    notes: '',
    inspectionExpiry: '',
    region: '' as TransportRegion | '',
  });'''

new_usestate = '''  const [formData, setFormData] = useState<{
    plateNumber: string;
    model: string;
    manufacturer: string;
    year: number;
    capacity: number;
    fuelType: 'GASOLINE' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';
    currentMileage: number;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    notes: string;
    inspectionExpiry: string;
    region: TransportRegion | '';
    loadingPattern: number;
    unloadingPattern: number;
  }>({
    plateNumber: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    capacity: 0,
    fuelType: 'DIESEL',
    currentMileage: 0,
    status: 'ACTIVE',
    notes: '',
    inspectionExpiry: '',
    region: '',
    loadingPattern: 2,
    unloadingPattern: 2,
  });'''

if old_usestate in content:
    content = content.replace(old_usestate, new_usestate, 1)
    write(CMS_VM, content)
    print('  ✅ [VehicleManagement: useState 型定義に loadingPattern/unloadingPattern 追加]')
else:
    # useState の別パターンを探す
    print('  ⚠️  useState標準パターン未発見 - 代替パターン試行')
    # as any で既にキャストされているセレクト onChange を修正
    # onChange で as any キャストを使用しているためsetFormData側には型エラーが出ない場合もある
    # resetForm の state 定義に型追加する別アプローチ

    # formData に型アノテーション追加
    old2 = '''  const [formData, setFormData] = useState({'''
    if old2 in content:
        # useState の最初の { から対応する } までを見つけて型注釈を追加
        # より安全な方法: formData の型を interface で別定義
        idx = content.find(old2)
        # インターフェース定義を useState の前に挿入
        interface_def = '''interface VehicleFormData {
  plateNumber: string;
  model: string;
  manufacturer: string;
  year: number;
  capacity: number;
  fuelType: 'GASOLINE' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';
  currentMileage: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  notes: string;
  inspectionExpiry: string;
  region: TransportRegion | '';
  loadingPattern: number;
  unloadingPattern: number;
}

'''
        new2 = old2.replace(
            '''  const [formData, setFormData] = useState({''',
            '''  const [formData, setFormData] = useState<VehicleFormData>({'''
        )
        content = content[:idx] + interface_def + content[idx:].replace(old2, new2, 1)
        write(CMS_VM, content)
        print('  ✅ [VehicleManagement: VehicleFormData interface + useState<VehicleFormData> 追加]')

# resetForm の loadingPattern/unloadingPattern 追加（パッチ済みを確認）
content2 = read(CMS_VM)
if 'loadingPattern: 2,' not in content2:
    patch(
        CMS_VM,
        '''      region: '',  // 🆕 P4-03
    });
    setCapacityInput('');''',
        '''      region: '',  // 🆕 P4-03
      loadingPattern: 2,    // 🆕
      unloadingPattern: 2,  // 🆕
    });
    setCapacityInput('');''',
        'VehicleManagement: resetForm に loadingPattern/unloadingPattern 追加（代替）'
    )

# ============================================================
# Fix 3: OperationRecord.tsx
#   (a) _upArrival 未使用変数を削除
#   (b) operationStore.loadingPattern ?? 2 の undefined 型エラー修正
# ============================================================
OP_REC = f'{BASE}/frontend/mobile/src/pages/OperationRecord.tsx'

# (a) 未使用変数 _upArrival 削除
patch(
    OP_REC,
    '''  const handleUnloadingArrival = async () => {
    // 🆕 U パターン別分岐:
    //   U1: startUnloading API (S記録) → AT_UNLOADING（荷降開始ボタン待ち）
    //   U2: startUnloading API (S記録) → AT_UNLOADING（荷降完了ボタン待ち）
    //   U3: startUnloading API (S=E同時記録) → 即 TO_LOADING
    const _upArrival = operationStore.unloadingPattern ?? 2;''',
    '''  const handleUnloadingArrival = async () => {''',
    'OperationRecord: handleUnloadingArrival から未使用 _upArrival 削除'
)

# (b) AT_LOADING ケース内の operationStore.loadingPattern ?? 2 型エラー修正
# OperationState インターフェースに loadingPattern: number が追加されているはずだが
# getState() からの取得で undefined になる可能性がある
# const _lp = ... ?? 2 で number 型になるよう明示的にキャスト

patch(
    OP_REC,
    '''      case 'AT_LOADING': {
        // P1: 積込開始ボタン（startLoadingAtLocation API → LOADING_IN_PROGRESS）
        // P2: 積込完了ボタン（completeLoading API → TO_UNLOADING）
        const _lp = operationStore.loadingPattern ?? 2;''',
    '''      case 'AT_LOADING': {
        // P1: 積込開始ボタン（startLoadingAtLocation API → LOADING_IN_PROGRESS）
        // P2: 積込完了ボタン（completeLoading API → TO_UNLOADING）
        const _lp: number = (operationStore.loadingPattern as number | undefined) ?? 2;''',
    'OperationRecord: AT_LOADING _lp 型を明示'
)

patch(
    OP_REC,
    '''      case 'AT_UNLOADING': {
        // U1: 荷降開始ボタン（startUnloadingAtLocation API → UNLOADING_IN_PROGRESS）
        // U2: 荷降完了ボタン（completeUnloading API → TO_LOADING）
        const _up = operationStore.unloadingPattern ?? 2;''',
    '''      case 'AT_UNLOADING': {
        // U1: 荷降開始ボタン（startUnloadingAtLocation API → UNLOADING_IN_PROGRESS）
        // U2: 荷降完了ボタン（completeUnloading API → TO_LOADING）
        const _up: number = (operationStore.unloadingPattern as number | undefined) ?? 2;''',
    'OperationRecord: AT_UNLOADING _up 型を明示'
)

# ============================================================
# コンパイル確認 → Push
# ============================================================
print('\n全修正完了。コンパイル確認を実行します...')

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
    print(r.stdout[-2000:] if r.stdout else '')
    print(r.stderr[-500:] if r.stderr else '', file=sys.stderr)
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
