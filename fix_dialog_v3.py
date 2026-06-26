#!/usr/bin/env python3
"""
fix_dialog_v3.py
================
OperationDetailDialog.tsx のコンパイルエラーを修正する。

前回パッチ(fix_fb_batch_20260626.py)で挿入した客先別集計テーブルの
JSX構造が壊れているため、完全に正しい構造に置き換える。

アプローチ:
  壊れた箇所全体(品目別台数IIFEの閉じから、
  サマリカードの return 閉じまで)を
  添付ドキュメントの正確なコードをベースに再構築する。
"""
import subprocess, sys, os

BASE = os.path.expanduser('~/projects/dump-tracker')
TARGET = os.path.join(BASE, 'frontend/cms/src/components/OperationDetailDialog.tsx')

with open(TARGET, 'r', encoding='utf-8') as f:
    src = f.read()

# =========================================================================
# 壊れた箇所の特定:
# パッチが生成した誤ったコードを見つけて正しいコードで置き換える
#
# 壊れた部分のパターン:
#   品目別台数 {()}  の閉じ部分から始まり
#   客先別集計テーブル を挟んで
#   余分な </div>); })()} が続く箇所
# =========================================================================

# 壊れた構造全体を OLD として、正しい構造を NEW として置換
OLD = '''                            {/* 品目別台数集計（LOADING_COMPLETEDイベントから集計） */}
                            {(() => {
                              const itemCountMap: Record<string, number> = {};
                              completedLoadings.forEach(e => {
                                if (e.items?.name) {
                                  itemCountMap[e.items.name] = (itemCountMap[e.items.name] || 0) + 1;
                                }
                              });
                              const entries = Object.entries(itemCountMap);
                              if (entries.length === 0) return null;
                              return (
                                <div className="mt-2">
                                  <span className="text-xs text-gray-500 block mb-1">品目別台数:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {entries.map(([itemName, count]) => (
                                      <span key={itemName} className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded font-bold">
                                        {itemName}: {count}台
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

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
                      })()}'''

NEW = '''                            {/* 品目別台数集計（LOADING_COMPLETEDイベントから集計） */}
                            {(() => {
                              const itemCountMap: Record<string, number> = {};
                              completedLoadings.forEach(e => {
                                if (e.items?.name) {
                                  itemCountMap[e.items.name] = (itemCountMap[e.items.name] || 0) + 1;
                                }
                              });
                              const entries = Object.entries(itemCountMap);
                              if (entries.length === 0) return null;
                              return (
                                <div className="mt-2">
                                  <span className="text-xs text-gray-500 block mb-1">品目別台数:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {entries.map(([itemName, count]) => (
                                      <span key={itemName} className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded font-bold">
                                        {itemName}: {count}台
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            {/* ✅ FB-画像2: 客先別・品目別・経路・回数 集計テーブル */}
                            {(() => {
                              type RouteKey = string;
                              const routeMap = new Map<RouteKey, { customer: string; item: string; route: string; count: number }>();
                              const unloadingEvents = _evs.filter(e => e.eventType === 'UNLOADING_ARRIVED');
                              completedLoadings.forEach(le => {
                                const customer = (le as any).customerName ?? '—';
                                const item     = le.items?.name ?? '—';
                                const loadLoc  = le.location?.name ?? '—';
                                const leIdx    = _evs.indexOf(le);
                                const nextUnl  = unloadingEvents.find(ue => _evs.indexOf(ue) > leIdx);
                                const unlLoc   = nextUnl?.location?.name ?? '—';
                                const route    = `${loadLoc}〜${unlLoc}`;
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
                      })()}'''

if OLD not in src:
    print('❌ アンカー不一致 - OLD パターンが見つかりません')
    print('現在のファイルから該当箇所を確認します...')
    # 品目別台数の直後を探す
    idx = src.find('品目別台数集計（LOADING_COMPLETEDイベントから集計）')
    if idx >= 0:
        print(f'「品目別台数集計」が見つかった位置: {idx}')
        print('その後200文字:')
        # 台数集計IIFEの閉じ部分を探す
        close_idx = src.find('})()}', idx)
        if close_idx >= 0:
            print(repr(src[close_idx-20:close_idx+200]))
    sys.exit(1)

src = src.replace(OLD, NEW, 1)
print('OK  [客先別集計テーブル JSX構造修正]')

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(src)
print(f'✅ Written: {TARGET}')

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
        '- FB 画像2: CMS 運搬サマリに客先別・経路・品目・回数テーブルを追加\n'
        '- fix: OperationDetailDialog.tsx JSX構造修正'
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
