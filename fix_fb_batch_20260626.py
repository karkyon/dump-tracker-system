#!/usr/bin/env python3
"""
fix_fb_batch_20260626.py
========================
フィードバック対応 一括修正 (2026-06-26)

① FvBuKFy0: 積込・積降場所マスタ 50件以上表示されない
   → frontend/cms/src/utils/api.ts
     locationAPI.getLocations() に limit:500 を追加

② FB 6/7 (LUKAeaX8, 3YRGMstF): D4 ステータスバー改修
   → frontend/mobile/src/pages/OperationRecord.tsx
     走行距離行を非表示（display:none）
     地図高さを 35vh → 50vh に拡大

③ FB 5 (J1o6dgv8): D4 経過時間を「積込開始から」へ変更、休憩中は停止
   → frontend/mobile/src/pages/OperationRecord.tsx
     firstLoadingStartRef + breakTotalSecondsRef を追加
     経過時間 useEffect を修正

④ — (画像2): CMS 運搬サマリに客先別品目・回数テーブルを追加
   → frontend/cms/src/components/OperationDetailDialog.tsx
     品目別台数の直下に「客先別集計テーブル」を挿入
"""

import subprocess
import sys
import os

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
    print(f'OK  [{label}]')
    return True


# ===========================================================================
# ① 場所マスタ 50件上限バグ修正
#    locationAPI.getLocations() に limit:500 を追加
# ===========================================================================
ok1 = patch(
    'frontend/cms/src/utils/api.ts',
    '''  async getLocations(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/locations', { params });
  },''',
    '''  async getLocations(params?: any): Promise<ApiResponse<any>> {
    // ✅ FB-FvBuKFy0: 50件上限バグ修正 - limit:500で全件取得
    const merged = { limit: 500, ...params };
    return apiClient.get('/locations', { params: merged });
  },''',
    'FB① locationAPI limit:500'
)

# ===========================================================================
# ② D4 ステータスバー: 走行距離行を非表示 + 地図高さ拡大
# ===========================================================================

# 走行距離行を非表示
ok2a = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>走行距離</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            {(totalDistance || 0).toFixed(1)} km
          </span>
        </div>
      </div>

      {/* フェーズバナー */}''',
    '''        {/* ✅ FB-LUKAeaX8/3YRGMstF: 走行距離は非表示（ドライバー要望） */}
      </div>

      {/* フェーズバナー */}''',
    'FB② 走行距離行 非表示'
)

# 地図高さ 35vh → 50vh
ok2b = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    "      {showMap && (\n        <div style={{ height: '35vh', position: 'relative', flexShrink: 0 }}>",
    "      {showMap && (\n        <div style={{ height: '50vh', position: 'relative', flexShrink: 0 }}>",
    'FB② 地図高さ 35vh→50vh'
)

# ===========================================================================
# ③ D4 経過時間: 積込開始から計測 / 休憩中停止
#
# 変更内容:
#   a) firstLoadingStartRef, breakStartRef, breakTotalSecondsRef を useState 近辺に追加
#   b) LOADING_IN_PROGRESS 遷移時に firstLoadingStartRef を記録
#   c) BREAK 遷移時に breakStartRef を記録
#   d) BREAK 終了（previousPhase復元）時に breakTotalSecondsRef に加算
#   e) 経過時間 useEffect を「firstLoadingStartRef から、休憩累計を除く」計算に変更
# ===========================================================================

# a) useRef 追加: elapsedTime の useState 直後に挿入
ok3a = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });''',
    '''  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  // ✅ FB-J1o6dgv8: 経過時間を「積込開始から」「休憩中は停止」に変更
  const firstLoadingStartRef = React.useRef<Date | null>(null);
  const breakStartRef        = React.useRef<Date | null>(null);
  const breakTotalSecondsRef = React.useRef<number>(0);''',
    'FB③a useRef 追加'
)

# b) LOADING_IN_PROGRESS 遷移ハンドラ(handleLoadingStart)内で firstLoadingStartRef を記録
#    setPhase('LOADING_IN_PROGRESS') の直後に挿入
ok3b = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''      setOperation(prev => ({ ...prev, phase: 'LOADING_IN_PROGRESS' }));
      operationStore.setPhase('LOADING_IN_PROGRESS');
      toast.success('積込を開始しました（積込完了ボタンで完了してください）');''',
    '''      setOperation(prev => ({ ...prev, phase: 'LOADING_IN_PROGRESS' }));
      operationStore.setPhase('LOADING_IN_PROGRESS');
      // ✅ FB-J1o6dgv8: 最初の積込開始時刻を記録（経過時間のゼロ点）
      if (!firstLoadingStartRef.current) {
        firstLoadingStartRef.current = new Date();
        breakTotalSecondsRef.current = 0;
      }
      toast.success('積込を開始しました（積込完了ボタンで完了してください）');''',
    'FB③b firstLoadingStartRef 記録'
)

# c) 休憩開始ハンドラ(handleBreakStart)内で breakStartRef を記録
#    operationStore.savePreviousPhase の直後に挿入
ok3c = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''      operationStore.savePreviousPhase(operation.phase);
      setOperation(prev => ({ ...prev, phase: 'BREAK', breakCount: prev.breakCount + 1 }));
      operationStore.setPhase('BREAK');
      operationStore.incrementBreakCount();''',
    '''      operationStore.savePreviousPhase(operation.phase);
      // ✅ FB-J1o6dgv8: 休憩開始時刻を記録
      breakStartRef.current = new Date();
      setOperation(prev => ({ ...prev, phase: 'BREAK', breakCount: prev.breakCount + 1 }));
      operationStore.setPhase('BREAK');
      operationStore.incrementBreakCount();''',
    'FB③c breakStartRef 記録'
)

# d) 休憩終了ハンドラ(handleBreakEnd)内で breakTotalSecondsRef に加算
#    operationStore.setPhase(prevPhase) の直後に挿入
ok3d = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''      const prevPhase = operationStore.previousPhase || 'TO_LOADING';
      setOperation(prev => ({ ...prev, phase: prevPhase }));
      operationStore.setPhase(prevPhase);''',
    '''      const prevPhase = operationStore.previousPhase || 'TO_LOADING';
      // ✅ FB-J1o6dgv8: 休憩経過秒を累計に加算
      if (breakStartRef.current) {
        const breakSec = Math.floor((Date.now() - breakStartRef.current.getTime()) / 1000);
        breakTotalSecondsRef.current += breakSec;
        breakStartRef.current = null;
      }
      setOperation(prev => ({ ...prev, phase: prevPhase }));
      operationStore.setPhase(prevPhase);''',
    'FB③d breakTotalSecondsRef 加算'
)

# e) 経過時間 useEffect を修正
#    現行: operation.startTime からの経過秒
#    変更: firstLoadingStartRef が設定済みなら「積込開始から - 休憩累計」で計算
#          BREAK フェーズ中は休憩開始からの秒数を現在の breakTotalSecondsRef に加えた上でポーズ表示
ok3e = patch(
    'frontend/mobile/src/pages/OperationRecord.tsx',
    '''  // ✅ 経過時間計算（既存）
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (operation.startTime) {
        const elapsed = Math.floor((Date.now() - operation.startTime.getTime()) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        setElapsedTime({ hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [operation.startTime]);''',
    '''  // ✅ FB-J1o6dgv8: 経過時間 = 積込開始から / 休憩中は停止
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      const baseRef = firstLoadingStartRef.current;
      if (!baseRef) {
        // 積込未開始は 00:00:00 固定
        setElapsedTime({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      // BREAK 中: 現在の休憩経過もポーズ計算から除外
      const currentBreakSec = (operation.phase === 'BREAK' && breakStartRef.current)
        ? Math.floor((Date.now() - breakStartRef.current.getTime()) / 1000)
        : 0;
      const totalExcludeSec = breakTotalSecondsRef.current + currentBreakSec;
      const elapsed = Math.max(0, Math.floor((Date.now() - baseRef.getTime()) / 1000) - totalExcludeSec);
      const hours   = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setElapsedTime({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [operation.startTime, operation.phase]);''',
    'FB③e 経過時間 useEffect 変更'
)

# ===========================================================================
# ④ CMS 運搬サマリ: 客先別集計テーブルを追加
#    品目別台数の直後（</div> ）に挿入
# ===========================================================================
SUMMARY_OLD = '''                            {/* 品目別台数集計（LOADING_COMPLETEDイベントから集計） */}
                            {(() => {
                              const itemCountMap: Record<string, number> = {};
                              completedLoadings.forEach(e => {
                                if (e.items?.name) {
                                  itemCountMap[e.items.name] = (itemCountMap[e.items.name] || 0) + 1;
                                }'''

SUMMARY_NEW = '''                            {/* 品目別台数集計（LOADING_COMPLETEDイベントから集計） */}
                            {(() => {
                              const itemCountMap: Record<string, number> = {};
                              completedLoadings.forEach(e => {
                                if (e.items?.name) {
                                  itemCountMap[e.items.name] = (itemCountMap[e.items.name] || 0) + 1;
                                }'''

# まず品目別台数ブロックの閉じ部分を探して、その後ろに客先別集計テーブルを追加
# ターゲット: 品目別台数ブロック終了後の </div>); })())} の直後
SUMMARY_INSERT_OLD = '''                          </div>
                        );
                      })()}
                      {/* ─────────────────────────────────────────────
                          タイムラインイベント一覧
                      ───────────────────────────────────────────── */}'''

SUMMARY_INSERT_NEW = '''                          </div>

                          {/* ✅ FB-画像2: 客先別・品目別・経路・回数 集計テーブル */}
                          {(() => {
                            // LOADING_COMPLETED から客先×品目×経路(積込→荷降)×回数を集計
                            type RouteKey = string; // `客先|品目|積込→荷降`
                            const routeMap = new Map<RouteKey, { customer: string; item: string; route: string; count: number }>();
                            const unloadingEvents = _evs.filter(e => e.eventType === 'UNLOADING_ARRIVED');

                            completedLoadings.forEach(le => {
                              const customer = (le as any).customerName ?? '—';
                              const item     = le.items?.name ?? '—';
                              const loadLoc  = le.location?.name ?? '—';
                              // 対応する荷降場所: 同一インデックス順で最も近いUNLOADING_ARRIVED
                              const leIdx  = _evs.indexOf(le);
                              const nextUnl = unloadingEvents.find(ue => _evs.indexOf(ue) > leIdx);
                              const unlLoc  = nextUnl?.location?.name ?? '—';
                              const route   = `${loadLoc}〜${unlLoc}`;
                              const key: RouteKey = `${customer}|${item}|${route}`;
                              const prev = routeMap.get(key);
                              if (prev) { prev.count++; }
                              else { routeMap.set(key, { customer, item, route, count: 1 }); }
                            });
                            const rows = Array.from(routeMap.values());
                            if (rows.length === 0) return null;
                            return (
                              <div className="mt-3">
                                <span className="text-xs text-gray-500 block mb-1 font-semibold">客先別集計:</span>
                                <div className="overflow-x-auto rounded border border-gray-200">
                                  <table className="min-w-full text-xs">
                                    <thead>
                                      <tr className="bg-gray-50">
                                        <th className="px-2 py-1 text-left text-gray-500 font-medium border-b border-gray-200">客先</th>
                                        <th className="px-2 py-1 text-left text-gray-500 font-medium border-b border-gray-200">経路</th>
                                        <th className="px-2 py-1 text-left text-gray-500 font-medium border-b border-gray-200">品目</th>
                                        <th className="px-2 py-1 text-center text-gray-500 font-medium border-b border-gray-200">回数</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((r, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="px-2 py-1 text-gray-800 font-medium whitespace-nowrap">{r.customer}</td>
                                          <td className="px-2 py-1 text-gray-600 whitespace-nowrap">{r.route}</td>
                                          <td className="px-2 py-1 text-indigo-700 whitespace-nowrap">{r.item}</td>
                                          <td className="px-2 py-1 text-center font-bold text-blue-700">{r.count}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        );
                      })()}
                      {/* ─────────────────────────────────────────────
                          タイムラインイベント一覧
                      ───────────────────────────────────────────── */}'''

ok4 = patch(
    'frontend/cms/src/components/OperationDetailDialog.tsx',
    SUMMARY_INSERT_OLD,
    SUMMARY_INSERT_NEW,
    'FB④ 客先別集計テーブル追加'
)

all_ok = all([ok1, ok2a, ok2b, ok3a, ok3b, ok3c, ok3d, ok3e, ok4])

if not all_ok:
    print('\n❌ 一部パッチ失敗。コード差異を確認して再試行してください。')
    sys.exit(1)

# ===========================================================================
# コンパイル確認
# ===========================================================================
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
ok_be  = compile_check('backend',       'backend')
ok_cms = compile_check('frontend/cms',  'frontend/cms')
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
