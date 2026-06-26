#!/usr/bin/env python3
"""
fix_fb_batch_20260626_v2.py
============================
FB③c/③d の SKIP を修正した再投入版
(FB①②④ は前回適用済み、③a/③b/③e も適用済みのためスキップ)

③c: handleBreakStart 内で breakStartRef を記録
③d: handleBreakEnd 内で breakTotalSecondsRef に加算
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
    print(f'OK   [{label}]')
    return True

# ===========================================================================
# ③c: handleBreakStart で breakStartRef を記録
#     実際のコード: savePreviousPhase の後、setPhase('BREAK') の前
# ===========================================================================
ok3c = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''      // operationStoreに現在phaseを保存してからBREAKに切り替え（永続化）
      operationStore.savePreviousPhase(operation.phase);
      operationStore.setPhase('BREAK');
      operationStore.incrementBreakCount();  // 🔧 永続化に反映 (2026-02-01)
      setOperation(prev => ({ 
        ...prev, 
        phase: 'BREAK',
        breakCount: prev.breakCount + 1
      }));''',
    '''      // operationStoreに現在phaseを保存してからBREAKに切り替え（永続化）
      operationStore.savePreviousPhase(operation.phase);
      // ✅ FB-J1o6dgv8: 休憩開始時刻を記録（経過時間停止用）
      breakStartRef.current = new Date();
      operationStore.setPhase('BREAK');
      operationStore.incrementBreakCount();  // 🔧 永続化に反映 (2026-02-01)
      setOperation(prev => ({ 
        ...prev, 
        phase: 'BREAK',
        breakCount: prev.breakCount + 1
      }));''',
    'FB③c breakStartRef 記録'
)

# ===========================================================================
# ③d: handleBreakEnd で breakTotalSecondsRef に加算
#     実際のコード: restoredPhase を取得して operationStore.setPhase() を呼ぶ直前
# ===========================================================================
ok3d = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''      // 🔧 修正: operationStore.previousPhase から休憩前のフェーズを復元
      // (operationStore.phaseはBREAKのため使用不可)
      const restoredPhase = operationStore.previousPhase || 'TO_UNLOADING';
      console.log('⏱️ 休憩終了: フェーズ復元', restoredPhase);
      
      // operationStoreのphaseも更新（永続化）
      operationStore.setPhase(restoredPhase);''',
    '''      // 🔧 修正: operationStore.previousPhase から休憩前のフェーズを復元
      // (operationStore.phaseはBREAKのため使用不可)
      const restoredPhase = operationStore.previousPhase || 'TO_UNLOADING';
      console.log('⏱️ 休憩終了: フェーズ復元', restoredPhase);

      // ✅ FB-J1o6dgv8: 休憩経過秒を累計に加算（経過時間の再開用）
      if (breakStartRef.current) {
        const breakSec = Math.floor((Date.now() - breakStartRef.current.getTime()) / 1000);
        breakTotalSecondsRef.current += breakSec;
        breakStartRef.current = null;
      }

      // operationStoreのphaseも更新（永続化）
      operationStore.setPhase(restoredPhase);''',
    'FB③d breakTotalSecondsRef 加算'
)

all_ok = ok3c and ok3d
if not all_ok:
    print('\n❌ パッチ失敗。push 中止。')
    sys.exit(1)

# ---------------------------------------------------------------------------
# コンパイル確認
# ---------------------------------------------------------------------------
def compile_check(name, subdir):
    cwd = os.path.join(BASE, subdir)
    r = subprocess.run(
        ['./node_modules/.bin/tsc', '--noEmit'],
        capture_output=True, text=True, cwd=cwd
    )
    if r.returncode == 0:
        print(f'✅ {name} compile OK')
        return True
    print(f'❌ {name} compile ERROR')
    print(r.stdout[:4000])
    print(r.stderr[:2000])
    return False

print('\n--- コンパイル確認 ---')
ok_be  = compile_check('backend',         'backend')
ok_cms = compile_check('frontend/cms',    'frontend/cms')
ok_mob = compile_check('frontend/mobile', 'frontend/mobile')

if ok_be and ok_cms and ok_mob:
    print('\n--- git push ---')
    subprocess.run(['git', 'add', '-A'], cwd=BASE)
    msg = (
        'fix: フィードバック対応 (2026-06-26)\n'
        '\n'
        '- FB FvBuKFy0: 積込・積降場所マスタ 50件上限バグ修正 (limit:500)\n'
        '- FB LUKAeaX8/3YRGMstF: D4 走行距離非表示・地図エリア拡大 (35vh→50vh)\n'
        '- FB J1o6dgv8: D4 経過時間を積込開始から計測・休憩中は停止\n'
        '- FB 画像2: CMS 運搬サマリに客先別・経路・品目・回数テーブルを追加'
    )
    r = subprocess.run(['git', 'commit', '-m', msg], capture_output=True, text=True, cwd=BASE)
    print(r.stdout)
    if r.returncode != 0 and 'nothing to commit' not in r.stdout:
        print(r.stderr)
        sys.exit(1)
    r2 = subprocess.run(['git', 'push'], capture_output=True, text=True, cwd=BASE)
    print(r2.stdout)
    if r2.returncode != 0:
        print(r2.stderr)
        sys.exit(1)
    print('\n✅ 全修正完了・push済み')
else:
    print('\n❌ コンパイルエラーあり。push を中止しました。')
    sys.exit(1)
