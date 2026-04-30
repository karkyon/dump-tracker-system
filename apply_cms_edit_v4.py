#!/usr/bin/env python3
"""
CMS OperationDetailDialog 差分修正 v4 — サーバー実行用
実行: cd ~/dump-tracker && python3 apply_cms_edit_v4.py
修正:
  1. 積込/積降グループ: 到着・完了それぞれに独立した編集ボタン
  2. 給油: notesから給油量・金額をパースして初期値表示
  3. 積降(到着): 到着+完了時刻(任意)の2列入力
"""
import sys, os, re

TARGET = os.path.expanduser('~/dump-tracker/frontend/cms/src/components/OperationDetailDialog.tsx')
if not os.path.exists(TARGET):
    print(f"ERROR: {TARGET} が見つかりません"); sys.exit(1)
with open(TARGET,'r',encoding='utf-8') as f: code=f.read()
ERRORS=[]; APPLIED=[]

def rep(old,new,name):
    global code
    if old in code: code=code.replace(old,new,1); APPLIED.append(name)
    else: ERRORS.append(f"NOT FOUND: {name}")

# Fix1: 給油notesパース
rep(
    "    setFuelAmt(''); setFuelCost('');",
    r"""    // 給油: notesから給油量・金額をパースして初期値にセット
    if (['FUELING','REFUELING'].includes(event.eventType ?? '')) {
      const n = event.notes ?? '';
      const amtM  = n.match(/(\d+(?:\.\d+)?)\s*L/);
      const costM = n.match(/[¥￥](\d+)/);
      setFuelAmt(amtM  ? amtM[1]  : event.quantityTons ? String(event.quantityTons) : '');
      setFuelCost(costM ? costM[1] : '');
    } else {
      setFuelAmt(''); setFuelCost('');
    }""",
    'Fix1: 給油notes初期値パース'
)

# Fix2: 積降(到着) 2列化
rep(
    """            if (isArrived) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">到着時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );""",
    """            if (isArrived) return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">到着時刻<span className="text-red-500 ml-1">*</span></label>
                  <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">完了時刻 <span className="font-normal text-gray-400">（任意）</span></label>
                  <input type="time" value={endHHMM} onChange={e => setEndHHMM(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            );""",
    'Fix2: 積降(到着) 到着+完了時刻2列'
)

# Fix3a: グループヘッダー編集ボタン削除
rep(
    """                                  {/* ✅ 編集ボタン（グループ完了イベント優先、なければ到着イベント） */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ev = group.completedEvent ?? group.arrivedEvent;
                                      setEditEvent({
                                        id: ev.id,
                                        eventType: ev.eventType,
                                        timestamp: ev.timestamp,
                                        notes: ev.notes,
                                        quantityTons: ev.quantityTons,
                                        locationName: ev.location?.name ?? '',
                                        locationId: ev.location?.id ?? '',
                                        locationLat: ev.location?.latitude ?? null,
                                        locationLng: ev.location?.longitude ?? null,
                                        itemId: ev.items?.id ?? null,
                                        itemName: ev.items?.name ?? null,
                                        customerId: (ev as any).customerId ?? null,
                                        customerName: (ev as any).customerName ?? null,
                                      });
                                    }}
                                    className={`ml-auto flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors hover:opacity-80`}
                                    style={{ borderColor: headerTextCls.includes('indigo') ? '#6366f1' : '#7c3aed', color: headerTextCls.includes('indigo') ? '#4f46e5' : '#6d28d9', background: 'rgba(255,255,255,0.7)' }}
                                    title="このイベントを編集"
                                  >
                                    <Pencil className="w-3 h-3" /> 編集
                                  </button>""",
    "                                  {/* ヘッダー編集ボタンは廃止 → 各サブ行に個別ボタンを配置 */}",
    'Fix3a: グループヘッダー編集ボタン削除'
)

# Fix3b: renderSubRow に editBtn prop追加
rep(
    """                        const renderSubRow = (
                          subEvent: OperationDebugTimelineEvent,
                          labelText: string,
                          dotColor: string,
                          isFirst: boolean,
                          isArrived: boolean = false
                        ) => (
                          <div className={`px-4 py-3 flex items-start gap-3 ${isFirst ? '' : 'border-t border-gray-100'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-800">▶ {labelText}</span>
                                {subEvent.timestamp && (
                                  <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                                    記録時刻: {fmtTs(subEvent.timestamp)}
                                  </span>
                                )}
                              </div>""",
    """                        const renderSubRow = (
                          subEvent: OperationDebugTimelineEvent,
                          labelText: string,
                          dotColor: string,
                          isFirst: boolean,
                          isArrived: boolean = false,
                          editBtn?: React.ReactNode
                        ) => (
                          <div className={`px-4 py-3 flex items-start gap-3 ${isFirst ? '' : 'border-t border-gray-100'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-800">▶ {labelText}</span>
                                {subEvent.timestamp && (
                                  <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                                    記録時刻: {fmtTs(subEvent.timestamp)}
                                  </span>
                                )}
                                {editBtn && <span className="ml-auto">{editBtn}</span>}
                              </div>""",
    'Fix3b: renderSubRow editBtn prop追加'
)

# Fix3c: サブ行呼び出しに個別編集ボタン追加
rep(
    """                                <div className="bg-white">
                                  {/* 到着 - isArrived=true: 場所・GPS・時刻のみ、コンテンツ非表示 */}
                                  {renderSubRow(group.arrivedEvent, '到着', arrivedDot, true, true)}
                                  {/* 完了 - items・重量・手書き備考を表示。自動生成の '積込完了'/'積降完了' は非表示 */}
                                  {group.completedEvent && renderSubRow(
                                    group.completedEvent,
                                    isLoading ? '積込完了' : '積降完了',
                                    completedDot,
                                    false,
                                    false
                                  )}
                                </div>""",
    """                                <div className="bg-white">
                                  {renderSubRow(group.arrivedEvent, '到着', arrivedDot, true, true,
                                    <button type="button"
                                      onClick={() => setEditEvent({
                                        id: group.arrivedEvent.id,
                                        eventType: group.arrivedEvent.eventType,
                                        timestamp: group.arrivedEvent.timestamp,
                                        notes: group.arrivedEvent.notes,
                                        quantityTons: group.arrivedEvent.quantityTons,
                                        locationName: group.arrivedEvent.location?.name ?? '',
                                        locationId: group.arrivedEvent.location?.id ?? '',
                                        locationLat: group.arrivedEvent.location?.latitude ?? null,
                                        locationLng: group.arrivedEvent.location?.longitude ?? null,
                                        itemId: group.arrivedEvent.items?.id ?? null,
                                        itemName: group.arrivedEvent.items?.name ?? null,
                                        customerId: (group.arrivedEvent as any).customerId ?? null,
                                        customerName: (group.arrivedEvent as any).customerName ?? null,
                                      })}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                    ><Pencil className="w-3 h-3" /> 編集</button>
                                  )}
                                  {group.completedEvent && renderSubRow(
                                    group.completedEvent,
                                    isLoading ? '積込完了' : '積降完了',
                                    completedDot,
                                    false,
                                    false,
                                    <button type="button"
                                      onClick={() => setEditEvent({
                                        id: group.completedEvent!.id,
                                        eventType: group.completedEvent!.eventType,
                                        timestamp: group.completedEvent!.timestamp,
                                        notes: group.completedEvent!.notes,
                                        quantityTons: group.completedEvent!.quantityTons,
                                        locationName: group.completedEvent!.location?.name ?? '',
                                        locationId: group.completedEvent!.location?.id ?? '',
                                        locationLat: group.completedEvent!.location?.latitude ?? null,
                                        locationLng: group.completedEvent!.location?.longitude ?? null,
                                        itemId: group.completedEvent!.items?.id ?? null,
                                        itemName: group.completedEvent!.items?.name ?? null,
                                        customerId: (group.completedEvent as any).customerId ?? null,
                                        customerName: (group.completedEvent as any).customerName ?? null,
                                      })}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                    ><Pencil className="w-3 h-3" /> 編集</button>
                                  )}
                                </div>""",
    'Fix3c: サブ行個別編集ボタン追加'
)

print("="*60)
for a in APPLIED: print(f"  ✅ {a}")
if ERRORS:
    print("\n❌ エラー:")
    for e in ERRORS: print(f"  ❌ {e}")
    sys.exit(1)

with open(TARGET,'w',encoding='utf-8') as f: f.write(code)
print(f"\n✅ 書き込み完了: {TARGET} ({len(code):,} chars)")
print("\n次のステップ:")
print("  cd ~/dump-tracker/frontend/cms && npx tsc --noEmit")
print("  cd ~/dump-tracker && git add -A && git commit -m 'fix: CMSタイムライン編集モーダルv4' && git push origin main")
