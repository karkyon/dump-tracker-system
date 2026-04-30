#!/usr/bin/env python3
"""
CMS OperationDetailDialog.tsx 差分修正スクリプト
サーバー上で python3 apply_cms_timeline_edit_fix.py を実行してください

修正内容:
1. 品目 → カテゴリ別グリッドチップUI（再生材/バージン材/廃棄物）
2. 時刻入力 → イベント種別に応じた正確なラベル・単一時刻入力
3. 積込/積降 → GPS ピン調整マップ追加
4. 積降完了の「到着時刻」→「完了時刻」に修正

実行コマンド:
  cd ~/dump-tracker
  python3 apply_cms_timeline_edit_fix.py
  cd backend && npx tsc --noEmit
  cd ../frontend/cms && npx tsc --noEmit
  cd ~/dump-tracker && git add -A && git commit -m "fix: CMSタイムライン編集モーダル改善" && git push origin main
"""

import sys
import os

TARGET = os.path.expanduser('~/dump-tracker/frontend/cms/src/components/OperationDetailDialog.tsx')

if not os.path.exists(TARGET):
    print(f"ERROR: ファイルが見つかりません: {TARGET}")
    sys.exit(1)

with open(TARGET, 'r', encoding='utf-8') as f:
    code = f.read()

ERRORS = []
APPLIED = []

# ============================================================
# Fix1: 時刻ラベル修正（到着/完了/開始/終了/記録時刻）
# ============================================================
OLD_TIME = """          {/* 時刻 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: isBreakEvt(event.eventType) ? '開始時刻' : '到着時刻', value: startHHMM, set: setStartHHMM, req: true },
              { label: isBreakEvt(event.eventType) ? '終了時刻' : '完了時刻', value: endHHMM,   set: setEndHHMM,   req: false },
            ].map(({ label: lbl, value, set, req }) => (
              <div key={lbl}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  {lbl}{req && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type="time" value={value} onChange={e => set(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            ))}
          </div>"""

NEW_TIME = """          {/* 時刻: イベント種別に応じた正確なラベルと単一時刻入力 */}
          {(() => {
            const isCompletedEvt = event.eventType === 'LOADING_COMPLETED' || event.eventType === 'UNLOADING_COMPLETED';
            const isArrivedEvt   = event.eventType === 'LOADING_ARRIVED'   || event.eventType === 'UNLOADING_ARRIVED';
            const startLabel =
              isBreakEvt(event.eventType) ? '開始時刻' :
              isArrivedEvt                ? '到着時刻' :
              isCompletedEvt              ? '完了時刻' :
              isLoadEvt(event.eventType) || isUnlEvt(event.eventType) ? '到着時刻' :
              '記録時刻';
            const endLabel =
              isBreakEvt(event.eventType) ? '終了時刻' : '完了時刻';
            // 完了イベントは開始のみ（その時刻が完了時刻）
            const showEnd = !isCompletedEvt;
            return (
              <div className={`grid gap-3 ${showEnd ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {startLabel}<span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                {showEnd && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{endLabel}</label>
                    <input
                      type="time" value={endHHMM} onChange={e => setEndHHMM(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                )}
              </div>
            );
          })()}"""

if OLD_TIME in code:
    code = code.replace(OLD_TIME, NEW_TIME, 1)
    APPLIED.append("Fix1: 時刻ラベル・レイアウト修正")
elif 'isCompletedEvt' in code:
    APPLIED.append("Fix1: 既に適用済みスキップ")
else:
    ERRORS.append("Fix1: 時刻入力ブロックが見つかりません")

# ============================================================
# Fix2: 品目 → カテゴリ別グリッドチップUI
# ============================================================
OLD_ITEMS = """            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                品目 <span className="font-normal text-gray-400">（複数選択可）</span>
              </label>
              {items.length === 0 ? (
                <p className="text-xs text-red-500">品目が読み込まれていません</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map(item => {
                    const sel = selectedItemIds.includes(item.id);
                    return (
                      <button key={item.id} type="button" onClick={() => toggleItem(item.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          sel ? 'text-white border-transparent' : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                        style={sel ? { background: accent, borderColor: accent } : {}}
                      >
                        {sel && '✓ '}{item.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedItemIds.length > 0 && (
                <p className="text-xs mt-1" style={{ color: accent }}>
                  選択中: {selectedItemIds.map(id => items.find(i => i.id === id)?.name || id).join('、')}
                </p>
              )}
            </div>"""

NEW_ITEMS = """            {/* 品目: カテゴリ別グリッドチップUI（mobile LoadingInput と同等） */}
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
            </div>"""

if OLD_ITEMS in code:
    code = code.replace(OLD_ITEMS, NEW_ITEMS, 1)
    APPLIED.append("Fix2: 品目カテゴリUI変更")
elif 'RECYCLED_MATERIAL' in code:
    APPLIED.append("Fix2: 既に適用済みスキップ")
else:
    ERRORS.append("Fix2: 品目ブロックが見つかりません")

# ============================================================
# Fix3: 積込専用ブロック末尾にGPSマップ追加
# ============================================================
OLD_LOAD_END = """            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">重量（トン）</label>
              <input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="例: 12.5" step="0.1" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </>)}

          {/* 積降専用 */}"""

NEW_LOAD_END = """            <div>
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
          </>)}

          {/* 積降専用 */}"""

if OLD_LOAD_END in code:
    code = code.replace(OLD_LOAD_END, NEW_LOAD_END, 1)
    APPLIED.append("Fix3a: 積込GPSマップ追加")
elif 'Fix3a' in ''.join(APPLIED) or 'CmsGpsPinMap' in code:
    APPLIED.append("Fix3a: 既に適用済みスキップ")
else:
    ERRORS.append("Fix3a: 積込ブロック末尾が見つかりません")

# ============================================================
# Fix3b: 積降専用ブロックにGPSマップ追加
# ============================================================
OLD_UNL = """          {/* 積降専用 */}
          {isUnlEvt(event.eventType) && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積降場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: ABC建材センター"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          )}"""

NEW_UNL = """          {/* 積降専用 */}
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

if OLD_UNL in code:
    code = code.replace(OLD_UNL, NEW_UNL, 1)
    APPLIED.append("Fix3b: 積降GPSマップ追加")
elif 'Fix3b' in ''.join(APPLIED):
    APPLIED.append("Fix3b: 既に適用済みスキップ")
else:
    ERRORS.append("Fix3b: 積降ブロックが見つかりません")

# ============================================================
# Fix4: pinLat/pinLng state を CmsActivityEditModal に追加
# ============================================================
OLD_STATE = """  const [saving, setSaving]   = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);"""

NEW_STATE = """  const [pinLat, setPinLat] = React.useState<number | undefined>(undefined);
  const [pinLng, setPinLng] = React.useState<number | undefined>(undefined);
  const [saving, setSaving]   = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);"""

if OLD_STATE in code:
    code = code.replace(OLD_STATE, NEW_STATE, 1)
    APPLIED.append("Fix4a: pinLat/pinLng state追加")
elif 'pinLat' in code:
    APPLIED.append("Fix4a: 既に適用済みスキップ")
else:
    ERRORS.append("Fix4a: modal state ブロックが見つかりません")

OLD_EFFECT = """    setFuelAmt(''); setFuelCost('');
    setSelectedItemIds(event.itemId ? [event.itemId] : []);
    setConfirmDel(false);
    setSaveError(null);"""

NEW_EFFECT = """    setFuelAmt(''); setFuelCost('');
    setSelectedItemIds(event.itemId ? [event.itemId] : []);
    setPinLat(event.locationLat != null ? event.locationLat : undefined);
    setPinLng(event.locationLng != null ? event.locationLng : undefined);
    setConfirmDel(false);
    setSaveError(null);"""

if OLD_EFFECT in code:
    code = code.replace(OLD_EFFECT, NEW_EFFECT, 1)
    APPLIED.append("Fix4b: pinLat/pinLng初期化")
elif 'setPinLat' in code:
    APPLIED.append("Fix4b: 既に適用済みスキップ")
else:
    ERRORS.append("Fix4b: effect block not found")

OLD_SAVE = """      const body: Record<string, any> = {
        actualStartTime: mergeHM(event.timestamp, startHHMM),
        notes,
        locationName: locationName || undefined,
      };
      if (endHHMM) body.actualEndTime = mergeHM(event.timestamp, endHHMM);"""

NEW_SAVE = """      const body: Record<string, any> = {
        actualStartTime: mergeHM(event.timestamp, startHHMM),
        notes,
        locationName: locationName || undefined,
      };
      if (endHHMM) body.actualEndTime = mergeHM(event.timestamp, endHHMM);
      if (pinLat !== undefined && pinLng !== undefined) {
        body.latitude  = pinLat;
        body.longitude = pinLng;
      }"""

if OLD_SAVE in code:
    code = code.replace(OLD_SAVE, NEW_SAVE, 1)
    APPLIED.append("Fix4c: handleSave GPS座標送信")
elif 'body.latitude' in code:
    APPLIED.append("Fix4c: 既に適用済みスキップ")
else:
    ERRORS.append("Fix4c: handleSave block not found")

# ============================================================
# Fix5: CmsGpsPinMap コンポーネントを追加
# ============================================================
GPS_MAP_COMPONENT = """
// =====================================================================
// ✅ CmsGpsPinMap - CMSタイムライン編集用 GPS ピン調整マップ
// =====================================================================
const CMS_MAPS_SCRIPT_ID = 'gmap-script-cms-edit';

interface CmsGpsPinMapProps {
  lat?: number;
  lng?: number;
  onPinMoved: (lat: number, lng: number) => void;
}

const CmsGpsPinMap: React.FC<CmsGpsPinMapProps> = ({ lat, lng, onPinMoved }) => {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInst    = useRef<any>(null);
  const markerInst = useRef<any>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const fullRef = useRef<HTMLDivElement>(null);
  const fullMap = useRef<any>(null);

  const centerLat = lat ?? 34.6937;
  const centerLng = lng ?? 135.5023;

  const initMap = React.useCallback((container: HTMLDivElement, existingMarker?: any) => {
    if (!(window as any).google?.maps) return null;
    const g = (window as any).google.maps;
    const map = new g.Map(container, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 17, disableDefaultUI: true, zoomControl: true,
    });
    const pos = existingMarker ? existingMarker.getPosition() : { lat: centerLat, lng: centerLng };
    const marker = new g.Marker({
      position: pos, map, draggable: true,
      icon: { path: g.SymbolPath.CIRCLE, scale: 10,
        fillColor: '#1d4ed8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
    });
    const move = () => { const p = marker.getPosition(); if (p) onPinMoved(p.lat(), p.lng()); };
    marker.addListener('dragend', move);
    map.addListener('click', (e: any) => { marker.setPosition(e.latLng); onPinMoved(e.latLng.lat(), e.latLng.lng()); });
    return { map, marker };
  }, [centerLat, centerLng, onPinMoved]);

  React.useEffect(() => {
    const tryInit = () => {
      if ((window as any).google?.maps) {
        if (mapRef.current && !mapInst.current) {
          const r = initMap(mapRef.current);
          if (r) { mapInst.current = r.map; markerInst.current = r.marker; setLoaded(true); }
        }
        return;
      }
      if (!document.getElementById(CMS_MAPS_SCRIPT_ID)) {
        const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
        const s = document.createElement('script');
        s.id = CMS_MAPS_SCRIPT_ID;
        s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__cmsMapsReady`;
        s.async = true;
        (window as any).__cmsMapsReady = () => {
          if (mapRef.current && !mapInst.current) {
            const r = initMap(mapRef.current);
            if (r) { mapInst.current = r.map; markerInst.current = r.marker; setLoaded(true); }
          }
        };
        document.head.appendChild(s);
      }
    };
    tryInit();
  }, [initMap]);

  React.useEffect(() => {
    if (fullscreen && fullRef.current && !fullMap.current && (window as any).google?.maps) {
      setTimeout(() => {
        if (!fullRef.current) return;
        const r = initMap(fullRef.current, markerInst.current);
        if (r) { fullMap.current = r.map; }
      }, 100);
    }
    if (!fullscreen && fullMap.current) fullMap.current = null;
  }, [fullscreen, initMap]);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500">
            場所ピン調整 <span className="text-gray-400 font-normal">— ドラッグで微調整</span>
          </span>
          <button type="button" onClick={() => setFullscreen(true)}
            className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50">
            拡大 ⛶
          </button>
        </div>
        <div ref={mapRef} className="w-full rounded-lg border border-gray-200 overflow-hidden"
          style={{ height: 120, background: '#e5e7eb' }} />
        {!loaded && <p className="text-xs text-gray-400 text-center mt-1">地図を読み込み中...</p>}
        {loaded  && <p className="text-xs text-gray-400 text-center mt-1">📍 ピンをドラッグ または タップで位置を設定</p>}
      </div>
      {fullscreen && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-2 bg-blue-700 text-white flex-shrink-0">
            <span className="font-medium">📍 場所ピン調整</span>
            <button onClick={() => setFullscreen(false)} className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm">✕ 閉じる</button>
          </div>
          <div ref={fullRef} className="flex-1" />
          <div className="bg-gray-900 text-gray-400 text-xs text-center py-2">ピンをドラッグまたは地図をタップして位置を調整</div>
        </div>
      )}
    </>
  );
};

"""

MODAL_MARKER = "\n// =====================================================================\n// ✅ CmsActivityEditModal\n"

if 'CMS_MAPS_SCRIPT_ID' in code:
    APPLIED.append("Fix5: CmsGpsPinMap 既に適用済みスキップ")
elif MODAL_MARKER in code:
    code = code.replace(MODAL_MARKER, GPS_MAP_COMPONENT + MODAL_MARKER, 1)
    APPLIED.append("Fix5: CmsGpsPinMap コンポーネント追加")
else:
    ERRORS.append("Fix5: CmsActivityEditModal マーカーが見つかりません")

# ============================================================
# 結果出力
# ============================================================
print("=" * 60)
print("適用結果:")
for a in APPLIED:
    print(f"  ✅ {a}")

if ERRORS:
    print("\nエラー:")
    for e in ERRORS:
        print(f"  ❌ {e}")
    sys.exit(1)

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(code)

print(f"\n✅ 修正ファイル書き込み完了: {TARGET}")
print(f"   ファイルサイズ: {len(code):,} chars")
print()
print("次のステップ:")
print("  cd ~/dump-tracker/frontend/cms && npx tsc --noEmit")
print("  cd ~/dump-tracker && git add -A && git commit -m 'fix: CMSタイムライン編集モーダル改善' && git push origin main")
