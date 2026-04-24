#!/usr/bin/env python3
"""
セッション5 最終修正スクリプト
真の根本原因:
  handleLocationSelected の UNLOADING ブロックは「状態更新のみ（API呼び出しなし）」
  → recordUnloadingArrival が呼ばれないため operation_details に UNLOADING レコードが作成されない
  → completeUnloadingAtLocation で更新すべきレコードが存在しない
  → location_id が NULL のまま

修正内容:
  handleLocationSelected の UNLOADING ブロックに recordUnloadingArrival 呼び出しを追加
  + setUnloadingLocation に locationId を渡す
"""
import subprocess, sys

BASE = '/home/karkyon/dump-tracker'
MOBILE_PAGES = f'{BASE}/frontend/mobile/src/pages/OperationRecord.tsx'

with open(MOBILE_PAGES, 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# 修正: handleLocationSelected の UNLOADING ブロック
# OLD: 状態更新のみ（API呼び出しなし）
# NEW: recordUnloadingArrival を呼び出してから状態更新
# ============================================================

OLD = """      } else {
        // 🔧 修正: 積降場所選択後は画面遷移せず地図表示のまま
        console.log('📦 積降場所選択 - 地図画面のまま');
        
        // 状態更新のみ（API呼び出しなし）
        setOperation(prev => ({
          ...prev,
          phase: 'AT_UNLOADING',
          unloadingLocation: selectedLocation.location.name
        }));

        // operationStoreにも保存
        operationStore.setUnloadingLocation(selectedLocation.location.name);
        operationStore.setPhase('AT_UNLOADING');
        
        // 地図を保持したまま、地点情報を保存
        (window as any).selectedUnloadingLocation = {
          id: selectedLocation.location.id,
          name: selectedLocation.location.name,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy
        };

        toast.success(`積降場所「${selectedLocation.location.name}」を選択しました`);
        console.log('📍 次: 積降開始ボタンをクリックしてください');
      }"""

NEW = """      } else {
        // 積降場所選択後は画面遷移せず地図表示のまま
        console.log('📦 積降場所選択 - 地図画面のまま');

        // ✅ 修正: recordUnloadingArrival を呼び出して operation_details に UNLOADING レコードを作成
        console.log('🚛 積降場所到着記録API呼び出し開始');
        await apiService.recordUnloadingArrival(currentOperationId, {
          locationId: selectedLocation.location.id,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy,
          arrivalTime: new Date()
        });
        console.log('✅ 積降場所到着記録完了');

        // 状態更新
        setOperation(prev => ({
          ...prev,
          phase: 'AT_UNLOADING',
          unloadingLocation: selectedLocation.location.name
        }));

        // operationStoreにも保存（locationId を渡す）
        operationStore.setUnloadingLocation(selectedLocation.location.name, selectedLocation.location.id);
        operationStore.setPhase('AT_UNLOADING');

        // 地図を保持したまま、地点情報を保存
        (window as any).selectedUnloadingLocation = {
          id: selectedLocation.location.id,
          name: selectedLocation.location.name,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy
        };

        toast.success(`積降場所「${selectedLocation.location.name}」を選択しました`);
        console.log('📍 次: 積降開始ボタンをクリックしてください');
      }"""

if NEW.strip()[:80] in content:
    print('[SKIP] handleLocationSelected UNLOADING修正 は適用済みです')
elif OLD in content:
    content = content.replace(OLD, NEW, 1)
    print('[OK] handleLocationSelected UNLOADING: recordUnloadingArrival 追加 + locationId 渡す')
else:
    print('[ERROR] OLD文字列が見つかりません')
    print('先頭50文字:', repr(OLD[:50]))
    sys.exit(1)

with open(MOBILE_PAGES, 'w', encoding='utf-8') as f:
    f.write(content)

# フロントエンド コンパイルチェック
print('フロントエンド コンパイルチェック...')
r = subprocess.run(['npx', 'tsc', '--noEmit'], cwd=f'{BASE}/frontend/mobile', capture_output=True, text=True)
if r.returncode != 0:
    print(f'[ERROR] コンパイルエラー:\n{r.stdout}{r.stderr}')
    sys.exit(1)
print('[OK] フロントエンド コンパイル エラー0')

# Git Push
print('\n✅ 修正完了。GitHub Pushを実行します...')
cmds = [
    ['git', 'add', 'frontend/mobile/src/pages/OperationRecord.tsx'],
    ['git', 'commit', '-m',
     'fix: 既存地点選択フローでUNLOADING location_idがNULLになる問題を修正\n'
     '- handleLocationSelected: UNLOADINGブロックにrecordUnloadingArrival追加\n'
     '- これによりoperation_detailsにlocationId付きUNLOADINGレコードが作成される\n'
     '- setUnloadingLocationにlocationIdも渡すよう修正'],
    ['git', 'push', 'origin', 'main'],
]
for cmd in cmds:
    print('$', ' '.join(cmd))
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
    if r.stdout: print(r.stdout)
    if r.stderr: print(r.stderr)
    if r.returncode != 0 and 'nothing to commit' not in (r.stdout + r.stderr):
        print(f'[ERROR] コマンド失敗')
        sys.exit(1)

print('\n🚀 Push完了！')
print('dt-restart → 既存地点を選択して積降完了 → DB確認')
print("psql 'postgresql://dump_tracker_user:DumpTracker2025!@localhost:5432/dump_tracker_dev' \\")
print("  -c \"SELECT activity_type, location_id FROM operation_details ORDER BY created_at DESC LIMIT 5;\"")
