#!/usr/bin/env python3
"""
CMS OperationDetailDialog 差分修正 v5 — サーバー実行用
実行: cd ~/dump-tracker && python3 apply_cms_edit_v5.py
"""
import sys, os
TARGET = os.path.expanduser('~/dump-tracker/frontend/cms/src/components/OperationDetailDialog.tsx')
if not os.path.exists(TARGET):
    print(f"ERROR: {TARGET} が見つかりません"); sys.exit(1)
with open(TARGET,'r',encoding='utf-8') as f: code=f.read()
ERRORS=[]; APPLIED=[]

def rep(old,new,name):
    global code
    if old in code: code=code.replace(old,new,1); APPLIED.append(f'✅ {name}')
    else: ERRORS.append(f'❌ NOT FOUND: {name}')

rep(
    "  customerId?: string | null;\n  customerName?: string | null;\n}\n\ninterface CmsActivityEditModalProps {",
    "  customerId?: string | null;\n  customerName?: string | null;\n  preinspMemo?: string | null;\n}\n\ninterface CmsActivityEditModalProps {",
    'Fix1: preinspMemo型追加')

rep(
    "  const [odometer,    setOdometer]    = React.useState('');",
    "  const [preinspMemo, setPreinspMemo] = React.useState('');\n  const [odometer,    setOdometer]    = React.useState('');",
    'Fix2: preinspMemo state追加')

rep(
    "    setOdometer(''); setFuelLevel(''); setInspMemo('');",
    "    setOdometer(''); setFuelLevel(''); setInspMemo(''); setPreinspMemo(event.preinspMemo ?? '');",
    'Fix3: preinspMemo初期化')

rep(
    "      if (isPostInsp(event.eventType)) {",
    """      if (event.eventType === 'PRE_INSPECTION' && preinspMemo) {
        body.notes = `点検メモ: ${preinspMemo}`;
      }
      if (isPostInsp(event.eventType)) {""",
    'Fix4: handleSave 運行前点検メモ')

OLD_LOADING = """          {/* 積込専用 */}
          {isLoadEvt(event.eventType) && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積込場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: 翠香園町ダート"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">客先</label>
              <button type="button" onClick={() => setShowCustomerPicker(true)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-blue-400 transition-colors">
                <span className={currentCustomerName ? 'text-gray-800' : 'text-gray-400'}>
                  🏢 {currentCustomerName || '（タップして変更）'}
                </span>
                <span className="text-xs text-blue-600 ml-2">変更 ▾</span>
              </button>
            </div>
            {/* 品目: カテゴリ別グリッドチップUI（mobile LoadingInput と同等） */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                品目 <span className="font-normal text-gray-400">（複数選択可）</span>
              </label>
              {items.length === 0 ? (
                <p className="text-xs text-red-500">品目が読み込まれていません</p>
              ) : (() => {
                const TYPE_LABEL: Record<string, string> = {
                  RECYCLED_MATERIAL: '再生材',
                  VIRGIN_MATERIAL: 'バージン材',
                  WASTE: '廃棄物',
                };
                const ORDER: ('RECYCLED_MATERIAL'|'VIRGIN_MATERIAL'|'WASTE'|undefined)[] =
                  ['RECYCLED_MATERIAL','VIRGIN_MATERIAL','WASTE',undefined];
                const grouped = ORDER.map(k => ({
                  key: k,
                  label: k ? (TYPE_LABEL[k] ?? k) : 'その他',
                  items: (items as any[])
                    .filter((it: any) => it.itemType === k || (k === undefined && !it.itemType))
                    .sort((a: any, b: any) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
                })).filter(g => g.items.length > 0);
                return (
                  <div className="space-y-3">
                    {grouped.map(group => (
                      <div key={group.label}>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 mb-2 border-b border-gray-100">
                          {group.label}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {group.items.map((item: any) => {
                            const sel = selectedItemIds.includes(item.id);
                            return (
                              <button key={item.id} type="button" onClick={() => toggleItem(item.id)}
                                className="py-2.5 px-2 text-sm font-medium rounded-lg border-2 text-center transition-all leading-tight"
                                style={{
                                  background: sel ? 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' : '#fff',
                                  color: sel ? '#fff' : '#374151',
                                  borderColor: sel ? '#667eea' : '#d1d5db',
                                  fontWeight: sel ? 'bold' : 'normal',
                                }}
                              >
                                {sel ? `✓ ${item.name}` : item.name}
                              </button>
                            );
                          })}
                        </div>
                        {group.key === 'WASTE' && (
                          <div className="mt-2 p-3 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-800">
                            📋 産業廃棄物マニフェストを登録する場合は、
                            <a href="https://webpage.e-reverse.com" target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 underline font-bold">こちら</a>
                            からログインしてください。
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {selectedItemIds.length > 0 && (
                <p className="text-xs mt-2" style={{ color: accent }}>
                  選択中: {selectedItemIds.map(id => (items as any[]).find((i: any) => i.id === id)?.name || id).join('、')}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">重量（トン）</label>
              <input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="例: 12.5" step="0.1" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            {/* GPS ピン調整マップ（積込） */}
            <CmsGpsPinMap
              lat={pinLat} lng={pinLng}
              onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }}
            />
          </>)}"""

NEW_LOADING = """          {/* ── 積込(到着): 場所名・客先・GPS地図のみ ── */}
          {event.eventType === 'LOADING_ARRIVED' && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積込場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: 翠香園町ダート"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">客先</label>
              <button type="button" onClick={() => setShowCustomerPicker(true)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-blue-400 transition-colors">
                <span className={currentCustomerName ? 'text-gray-800' : 'text-gray-400'}>
                  🏢 {currentCustomerName || '（タップして変更）'}
                </span>
                <span className="text-xs text-blue-600 ml-2">変更 ▾</span>
              </button>
            </div>
            <CmsGpsPinMap lat={pinLat} lng={pinLng}
              onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }} />
          </>)}

          {/* ── 積込(完了): 品目（カテゴリグリッド）・重量のみ ── */}
          {event.eventType === 'LOADING_COMPLETED' && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                品目 <span className="font-normal text-gray-400">（複数選択可）</span>
              </label>
              {items.length === 0 ? (
                <p className="text-xs text-red-500">品目が読み込まれていません</p>
              ) : (() => {
                const TYPE_LABEL: Record<string, string> = {
                  RECYCLED_MATERIAL: '再生材', VIRGIN_MATERIAL: 'バージン材', WASTE: '廃棄物',
                };
                const ORDER: ('RECYCLED_MATERIAL'|'VIRGIN_MATERIAL'|'WASTE'|undefined)[] =
                  ['RECYCLED_MATERIAL','VIRGIN_MATERIAL','WASTE',undefined];
                const grouped = ORDER.map(k => ({
                  key: k,
                  label: k ? (TYPE_LABEL[k] ?? k) : 'その他',
                  items: (items as any[])
                    .filter((it: any) => it.itemType === k || (k === undefined && !it.itemType))
                    .sort((a: any, b: any) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
                })).filter(g => g.items.length > 0);
                return (
                  <div className="space-y-3">
                    {grouped.map(group => (
                      <div key={group.label}>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 mb-2 border-b border-gray-100">
                          {group.label}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {group.items.map((item: any) => {
                            const sel = selectedItemIds.includes(item.id);
                            return (
                              <button key={item.id} type="button" onClick={() => toggleItem(item.id)}
                                className="py-2.5 px-2 text-sm font-medium rounded-lg border-2 text-center transition-all leading-tight"
                                style={{
                                  background: sel ? 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' : '#fff',
                                  color: sel ? '#fff' : '#374151',
                                  borderColor: sel ? '#667eea' : '#d1d5db',
                                  fontWeight: sel ? 'bold' : 'normal',
                                }}
                              >{sel ? `✓ ${item.name}` : item.name}</button>
                            );
                          })}
                        </div>
                        {group.key === 'WASTE' && (
                          <div className="mt-2 p-3 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-800">
                            📋 産業廃棄物マニフェストを登録する場合は、
                            <a href="https://webpage.e-reverse.com" target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 underline font-bold">こちら</a>からログインしてください。
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {selectedItemIds.length > 0 && (
                <p className="text-xs mt-2" style={{ color: accent }}>
                  選択中: {selectedItemIds.map(id => (items as any[]).find((i: any) => i.id === id)?.name || id).join('、')}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">重量（トン）</label>
              <input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="例: 12.5" step="0.1" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </>)}"""

rep(OLD_LOADING, NEW_LOADING, 'Fix5: 積込フォーム分岐')

OLD_UNLOADING = """          {/* 積降専用 */}
          {isUnlEvt(event.eventType) && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積降場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: ABC建材センター"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            {/* GPS ピン調整マップ（積降） */}
            <CmsGpsPinMap
              lat={pinLat} lng={pinLng}
              onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }}
            />
          </>)}"""

NEW_UNLOADING = """          {/* ── 積降(到着): 場所名・GPS地図 ── */}
          {event.eventType === 'UNLOADING_ARRIVED' && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積降場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: ABC建材センター"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <CmsGpsPinMap lat={pinLat} lng={pinLng}
              onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }} />
          </>)}

          {/* ── 積降(完了): 完了時刻のみ（追加項目なし） ── */}"""

rep(OLD_UNLOADING, NEW_UNLOADING, 'Fix6: 積降フォーム分岐')

rep(
    """          {/* 運行後点検専用 */}
          {isPostInsp(event.eventType) && (""",
    """          {/* 運行前点検専用: 点検メモ */}
          {event.eventType === 'PRE_INSPECTION' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                📝 点検メモ <span className="font-normal text-gray-400">（気になった点・軽微な問題があれば記載）</span>
              </label>
              <textarea value={preinspMemo} onChange={e => setPreinspMemo(e.target.value)}
                placeholder="気になった点・軽微な問題など..." rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>
          )}

          {/* 運行後点検専用 */}
          {isPostInsp(event.eventType) && (""",
    'Fix7: 運行前点検メモ')

rep(
    """          {/* 備考（点検・運行開始終了以外） */}
          {!isInspEvt(event.eventType) && !isTripEvt(event.eventType) && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">備考 <span className="font-normal text-gray-400">（任意）</span></label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="メモを入力..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          )}""",
    """          {/* 備考: 給油・休憩のみ */}
          {isFuelEvt(event.eventType) || isBreakEvt(event.eventType) ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">備考 <span className="font-normal text-gray-400">（任意）</span></label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="メモを入力..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          ) : null}""",
    'Fix8: 備考を給油・休憩のみに限定')

rep(
    "            const arr = d?.data?.data?.data ?? d?.data?.data ?? d?.data ?? [];\n            setEditCustomers",
    "            const arr = d?.data?.customers ?? d?.data?.data?.data ?? d?.data?.data ?? d?.data ?? [];\n            setEditCustomers",
    'Fix9: customersAPIパース修正')

rep(
    "                                        customerId: (event as any).customerId ?? null,\n                                        customerName: (event as any).customerName ?? null,\n                                      })}",
    "                                        customerId: (event as any).customerId ?? null,\n                                        customerName: (event as any).customerName ?? null,\n                                        preinspMemo: event.eventType === 'PRE_INSPECTION' ? (event.notes ?? '') : null,\n                                      })}",
    'Fix10: 単独イベントpreinspMemo')

# isUnlEvt未使用修正
code = code.replace(
    "const isUnlEvt   = (t: string) => ['UNLOADING','UNLOADING_ARRIVED','UNLOADING_COMPLETED'].includes(t);",
    "// isUnlEvt: 個別分岐済み\n// const isUnlEvt = (t: string) => ['UNLOADING','UNLOADING_ARRIVED','UNLOADING_COMPLETED'].includes(t);"
, 1)
APPLIED.append('✅ Fix11: isUnlEvt未使用変数除去')

print("="*60)
for a in APPLIED: print(f"  {a}")
if ERRORS:
    print()
    for e in ERRORS: print(f"  {e}")
    sys.exit(1)
with open(TARGET,'w',encoding='utf-8') as f: f.write(code)
print(f"\n✅ 書き込み完了: {TARGET} ({len(code):,} chars)")
print("\n次のステップ:")
print("  cd ~/dump-tracker/frontend/cms && npx tsc --noEmit")
print("  cd ~/dump-tracker && git add -A && git commit -m 'fix: CMSタイムライン編集v5' && git push origin main")
