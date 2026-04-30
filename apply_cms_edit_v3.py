#!/usr/bin/env python3
"""
CmsActivityEditModal 差分修正 v3 — サーバー実行用
実行: cd ~/dump-tracker && python3 apply_cms_edit_v3.py
"""
import sys, os
TARGET = os.path.expanduser('~/dump-tracker/frontend/cms/src/components/OperationDetailDialog.tsx')
if not os.path.exists(TARGET):
    print(f"ERROR: {TARGET} が見つかりません"); sys.exit(1)
with open(TARGET,'r',encoding='utf-8') as f: code=f.read()
ERRORS=[]; APPLIED=[]

def rep(old,new,name):
    global code
    if old in code: code=code.replace(old,new,1); APPLIED.append(name)
    elif any(x in code for x in [name.split(':')[0]]): APPLIED.append(f"{name}: 既適用スキップ")
    else: ERRORS.append(f"NOT FOUND: {name}")

# FixA
rep("""interface CmsEditEvent {
  id: string;
  eventType: string;
  timestamp: string | null;
  notes?: string | null;
  quantityTons?: number;
  locationName?: string;
  locationId?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  itemId?: string | null;
  itemName?: string | null;
}""","""interface CmsEditEvent {
  id: string;
  eventType: string;
  timestamp: string | null;
  notes?: string | null;
  quantityTons?: number;
  locationName?: string;
  locationId?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  itemId?: string | null;
  itemName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
}""",'FixA: CmsEditEvent拡張')

# FixB
rep("""interface CmsActivityEditModalProps {
  event: CmsEditEvent | null;
  operationId: string;
  items: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}""","""interface CmsActivityEditModalProps {
  event: CmsEditEvent | null;
  operationId: string;
  items: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}""",'FixB: Props拡張')

# FixC
rep("""const CmsActivityEditModal: React.FC<CmsActivityEditModalProps> = ({
  event, operationId: _operationId, items, onClose, onSaved, onDeleted
}) => {
  const [startHHMM, setStartHHMM] = React.useState('');
  const [endHHMM,   setEndHHMM]   = React.useState('');
  const [locationName, setLocationName] = React.useState('');
  const [notes,     setNotes]     = React.useState('');
  const [quantity,  setQuantity]  = React.useState('');
  const [fuelAmt,   setFuelAmt]   = React.useState('');
  const [fuelCost,  setFuelCost]  = React.useState('');
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [pinLat, setPinLat] = React.useState<number | undefined>(undefined);
  const [pinLng, setPinLng] = React.useState<number | undefined>(undefined);
  const [saving, setSaving]   = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!event) return;
    setStartHHMM(toHM(event.timestamp));
    setEndHHMM('');
    setLocationName(event.locationName ?? '');
    setNotes(event.notes ?? '');
    setQuantity(event.quantityTons && event.quantityTons > 0 ? String(event.quantityTons) : '');
    setFuelAmt(''); setFuelCost('');
    setSelectedItemIds(event.itemId ? [event.itemId] : []);
    setPinLat(event.locationLat != null ? event.locationLat : undefined);
    setPinLng(event.locationLng != null ? event.locationLng : undefined);
    setConfirmDel(false);
    setSaveError(null);
  }, [event]);""","""// ヘルパー: イベント種別判定
const isInspEvt  = (t: string) => ['PRE_INSPECTION','POST_INSPECTION'].includes(t);
const isTripEvt  = (t: string) => ['TRIP_START','TRIP_END'].includes(t);
const isPostInsp = (t: string) => t === 'POST_INSPECTION';
const isDeletable = (t: string) => !isInspEvt(t) && !isTripEvt(t);
const isBreakStart = (t: string) => t === 'BREAK_START';
const isBreakEnd   = (t: string) => t === 'BREAK_END';

const CmsActivityEditModal: React.FC<CmsActivityEditModalProps> = ({
  event, operationId, items, customers, onClose, onSaved, onDeleted
}) => {
  const [startHHMM, setStartHHMM] = React.useState('');
  const [endHHMM,   setEndHHMM]   = React.useState('');
  const [locationName, setLocationName] = React.useState('');
  const [notes,     setNotes]     = React.useState('');
  const [quantity,  setQuantity]  = React.useState('');
  const [fuelAmt,   setFuelAmt]   = React.useState('');
  const [fuelCost,  setFuelCost]  = React.useState('');
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [pinLat, setPinLat] = React.useState<number | undefined>(undefined);
  const [pinLng, setPinLng] = React.useState<number | undefined>(undefined);
  const [currentCustomerId,   setCurrentCustomerId]   = React.useState('');
  const [currentCustomerName, setCurrentCustomerName] = React.useState('');
  const [showCustomerPicker,  setShowCustomerPicker]  = React.useState(false);
  const [odometer,    setOdometer]    = React.useState('');
  const [fuelLevel,   setFuelLevel]   = React.useState('');
  const [inspMemo,    setInspMemo]    = React.useState('');
  const [saving, setSaving]   = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!event) return;
    setStartHHMM(toHM(event.timestamp));
    setEndHHMM('');
    setLocationName(event.locationName ?? '');
    setNotes(event.notes ?? '');
    setQuantity(event.quantityTons && event.quantityTons > 0 ? String(event.quantityTons) : '');
    setFuelAmt(''); setFuelCost('');
    setSelectedItemIds(event.itemId ? [event.itemId] : []);
    setPinLat(event.locationLat != null ? event.locationLat : undefined);
    setPinLng(event.locationLng != null ? event.locationLng : undefined);
    setCurrentCustomerId(event.customerId ?? '');
    setCurrentCustomerName(event.customerName ?? '');
    setShowCustomerPicker(false);
    setOdometer(''); setFuelLevel(''); setInspMemo('');
    setConfirmDel(false);
    setSaveError(null);
  }, [event]);""",'FixC: state/effect拡張')

# FixD
rep("""  const handleSave = async () => {
    setSaveError(null);
    if (!startHHMM) { setSaveError('開始時刻を入力してください'); return; }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        actualStartTime: mergeHM(event.timestamp, startHHMM),
        notes,
        locationName: locationName || undefined,
      };
      if (endHHMM) body.actualEndTime = mergeHM(event.timestamp, endHHMM);
      if (pinLat !== undefined && pinLng !== undefined) {
        body.latitude  = pinLat;
        body.longitude = pinLng;
      }
      if (isLoadEvt(event.eventType)) {
        if (selectedItemIds.length > 0) body.itemId = selectedItemIds[0];
        if (quantity) body.quantityTons = parseFloat(quantity);
        if (selectedItemIds.length > 1) {
          const names = selectedItemIds.map(id => items.find(i => i.id === id)?.name || id).join('、');
          body.notes = `品目: ${names}` + (notes ? ` / ${notes}` : '');
        }
      }
      if (isFuelEvt(event.eventType)) {
        if (fuelAmt) body.quantityTons = parseFloat(fuelAmt);
        if (fuelAmt || fuelCost) body.notes = `給油 ${fuelAmt}L ¥${fuelCost} ${notes}`.trim();
      }
      const res = await apiClient.put(`/operation-details/${event.id}`, body);
      if ((res as any).success || (res as any).data) {
        onSaved();
        onClose();
      } else {
        setSaveError('保存に失敗しました');
      }
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || e?.message || '保存に失敗しました');
    } finally { setSaving(false); }
  };""","""  const handleChangeCustomer = async (cid: string, cname: string) => {
    try {
      await apiClient.patch(`/mobile/operations/${operationId}/customer`, { customerId: cid });
      setCurrentCustomerId(cid); setCurrentCustomerName(cname);
    } catch { setSaveError('客先変更に失敗しました'); }
    setShowCustomerPicker(false);
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!startHHMM) { setSaveError('記録時刻を入力してください'); return; }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        actualStartTime: mergeHM(event.timestamp, startHHMM),
        locationName: locationName || undefined,
      };
      if (!isInspEvt(event.eventType) && !isTripEvt(event.eventType)) {
        body.notes = notes;
      }
      if (endHHMM) body.actualEndTime = mergeHM(event.timestamp, endHHMM);
      if (pinLat !== undefined && pinLng !== undefined) {
        body.latitude  = pinLat;
        body.longitude = pinLng;
      }
      if (isLoadEvt(event.eventType)) {
        if (selectedItemIds.length > 0) body.itemId = selectedItemIds[0];
        if (quantity) body.quantityTons = parseFloat(quantity);
        if (selectedItemIds.length > 1) {
          const names = selectedItemIds.map(id => items.find(i => i.id === id)?.name || id).join('、');
          body.notes = `品目: ${names}` + (notes ? ` / ${notes}` : '');
        }
      }
      if (isFuelEvt(event.eventType)) {
        if (fuelAmt) body.quantityTons = parseFloat(fuelAmt);
        if (fuelAmt || fuelCost) body.notes = `給油 ${fuelAmt}L ¥${fuelCost} ${notes}`.trim();
      }
      if (isPostInsp(event.eventType)) {
        const memoLines: string[] = [];
        if (odometer)  memoLines.push(`走行距離: ${odometer}km`);
        if (fuelLevel) memoLines.push(`燃料レベル: ${fuelLevel}L`);
        if (inspMemo)  memoLines.push(`点検メモ: ${inspMemo}`);
        if (memoLines.length > 0) body.notes = memoLines.join(' / ');
      }
      const res = await apiClient.put(`/operation-details/${event.id}`, body);
      if ((res as any).success || (res as any).data) {
        onSaved();
        onClose();
      } else {
        setSaveError('保存に失敗しました');
      }
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || e?.message || '保存に失敗しました');
    } finally { setSaving(false); }
  };""",'FixD: handleSave拡張')

# FixE
rep("""          {/* 時刻: イベント種別に応じた正確なラベルと単一時刻入力 */}
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
          })()}""","""          {/* 時刻: イベント種別ごとに完全制御 */}
          {(() => {
            const et = event.eventType;
            const isCompleted = et === 'LOADING_COMPLETED' || et === 'UNLOADING_COMPLETED';
            const isArrived   = et === 'LOADING_ARRIVED'   || et === 'UNLOADING_ARRIVED';
            if (isBreakStart(et)) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">開始時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isBreakEnd(et)) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">終了時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isInspEvt(et) || isTripEvt(et)) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">記録時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isCompleted) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">完了時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isArrived) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">到着時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            const startLabel = isFuelEvt(et) ? '給油時刻' : '記録時刻';
            return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{startLabel}<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
          })()}""",'FixE: 時刻ブロック完全対応')

# FixF
rep("""          {/* 積込専用 */}
          {isLoadEvt(event.eventType) && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積込場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: 翠香園町ダート"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            {/* 品目: カテゴリ別グリッドチップUI（mobile LoadingInput と同等） */}""","""          {/* 積込専用 */}
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
            {/* 品目: カテゴリ別グリッドチップUI（mobile LoadingInput と同等） */}""",'FixF: 積込客先変更追加')

# FixG/H/I
rep("""          {/* 備考（共通） */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">備考 <span className="font-normal text-gray-400">（任意）</span></label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="メモを入力..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* 削除 */}
          <div className="border-t border-red-100 pt-4">
            {!confirmDel ? (
              <button type="button" onClick={() => setConfirmDel(true)}
                className="w-full py-2 border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors">
                <Trash2 className="w-4 h-4" />このイベントを削除する
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700 text-center">⚠️ 本当に削除しますか？</p>
                <p className="text-xs text-gray-500 text-center">この操作は元に戻せません</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirmDel(false)}
                    className="py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors">
                    キャンセル
                  </button>
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    className="py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                    style={{ background: '#ef4444' }}>
                    {deleting ? '削除中...' : '削除する'}
                  </button>
                </div>
              </div>
            )}
          </div>""","""          {/* 運行後点検専用 */}
          {isPostInsp(event.eventType) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-700">📋 運行後点検 追加情報</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">走行距離 (km)</label>
                  <input type="number" inputMode="decimal" value={odometer} onChange={e => setOdometer(e.target.value)}
                    placeholder="例: 3855"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">燃料レベル (L) <span className="font-normal text-gray-400">任意</span></label>
                  <input type="number" inputMode="decimal" value={fuelLevel} onChange={e => setFuelLevel(e.target.value)}
                    placeholder="例: 45"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">📝 点検メモ・特記事項</label>
                <textarea value={inspMemo} onChange={e => setInspMemo(e.target.value)}
                  placeholder="気になった点・軽微な問題など..." rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
          )}

          {/* 備考（点検・運行開始終了以外） */}
          {!isInspEvt(event.eventType) && !isTripEvt(event.eventType) && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">備考 <span className="font-normal text-gray-400">（任意）</span></label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="メモを入力..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          )}

          {/* 削除: 点検・運行開始終了は不可 */}
          {isDeletable(event.eventType) && (
            <div className="border-t border-red-100 pt-4">
              {!confirmDel ? (
                <button type="button" onClick={() => setConfirmDel(true)}
                  className="w-full py-2 border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors">
                  <Trash2 className="w-4 h-4" />このイベントを削除する
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700 text-center">⚠️ 本当に削除しますか？</p>
                  <p className="text-xs text-gray-500 text-center">この操作は元に戻せません</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmDel(false)}
                      className="py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors">
                      キャンセル
                    </button>
                    <button type="button" onClick={handleDelete} disabled={deleting}
                      className="py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ background: '#ef4444' }}>
                      {deleting ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 客先ピッカー */}
          {showCustomerPicker && (
            <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black bg-opacity-50"
              onClick={e => { if (e.target === e.currentTarget) setShowCustomerPicker(false); }}>
              <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[60vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="font-semibold text-sm">客先を選択</span>
                  <button onClick={() => setShowCustomerPicker(false)} className="text-gray-500 text-sm">✕ 閉じる</button>
                </div>
                <div className="overflow-y-auto flex-1 p-3 space-y-2">
                  {customers.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">客先を読み込み中...</p>
                  ) : customers.map(c => (
                    <button key={c.id} type="button" onClick={() => handleChangeCustomer(c.id, c.name)}
                      className="w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center gap-3"
                      style={{ background: c.id === currentCustomerId ? '#eff6ff' : '#f9fafb', borderColor: c.id === currentCustomerId ? '#3b82f6' : '#e5e7eb' }}>
                      <span>🏢</span>
                      <span className="flex-1 text-sm text-gray-800">{c.name}</span>
                      {c.id === currentCustomerId && <span className="text-blue-600 text-xs font-medium">✓ 現在</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}""",'FixG/H/I: 備考・削除・後点検・客先ピッカー')

# FixJ
rep("""  // ✅ イベント編集モーダル
  const [editEvent, setEditEvent] = useState<CmsEditEvent | null>(null);
  const [editItems, setEditItems] = useState<{ id: string; name: string }[]>([]);""","""  // ✅ イベント編集モーダル
  const [editEvent, setEditEvent] = useState<CmsEditEvent | null>(null);
  const [editItems, setEditItems] = useState<{ id: string; name: string }[]>([]);
  const [editCustomers, setEditCustomers] = useState<{ id: string; name: string }[]>([]);""",'FixJ: editCustomers state')

# FixK
rep("""        (async () => {
          try {
            const res = await apiClient.get('/items', { params: { page: 1, limit: 200 } });
            const d: any = res;
            const arr = d?.data?.data?.data ?? d?.data?.data ?? d?.data ?? [];
            setEditItems(Array.isArray(arr) ? arr : []);
          } catch { /* items 取得失敗は致命的ではない */ }
        })(),""","""        (async () => {
          try {
            const res = await apiClient.get('/items', { params: { page: 1, limit: 200 } });
            const d: any = res;
            const arr = d?.data?.data?.data ?? d?.data?.data ?? d?.data ?? [];
            setEditItems(Array.isArray(arr) ? arr : []);
          } catch { /* items 取得失敗は致命的ではない */ }
        })(),
        (async () => {
          try {
            const res = await apiClient.get('/customers', { params: { page: 1, limit: 200 } });
            const d: any = res;
            const arr = d?.data?.data?.data ?? d?.data?.data ?? d?.data ?? [];
            setEditCustomers(Array.isArray(arr) ? arr : []);
          } catch { /* customers 取得失敗は致命的ではない */ }
        })(),""",'FixK: customers取得')

# FixL
rep("""      <CmsActivityEditModal
        event={editEvent}
        operationId={operationId}
        items={editItems}
        onClose={() => setEditEvent(null)}""","""      <CmsActivityEditModal
        event={editEvent}
        operationId={operationId}
        items={editItems}
        customers={editCustomers}
        onClose={() => setEditEvent(null)}""",'FixL: customers props渡し')

# FixM
old_group = """                                      setEditEvent({
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
                                      });"""
new_group = """                                      setEditEvent({
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
                                      });"""
if old_group in code:
    code = code.replace(old_group, new_group); APPLIED.append('FixM: group setEditEvent customer追加')
else: ERRORS.append('FixM: group setEditEvent not found')

old_single = """                                      onClick={() => setEditEvent({
                                        id: event.id,
                                        eventType: event.eventType,
                                        timestamp: event.timestamp,
                                        notes: event.notes,
                                        quantityTons: event.quantityTons,
                                        locationName: event.location?.name ?? '',
                                        locationId: event.location?.id ?? '',
                                        locationLat: event.location?.latitude ?? null,
                                        locationLng: event.location?.longitude ?? null,
                                        itemId: event.items?.id ?? null,
                                        itemName: event.items?.name ?? null,
                                      })}"""
new_single = """                                      onClick={() => setEditEvent({
                                        id: event.id,
                                        eventType: event.eventType,
                                        timestamp: event.timestamp,
                                        notes: event.notes,
                                        quantityTons: event.quantityTons,
                                        locationName: event.location?.name ?? '',
                                        locationId: event.location?.id ?? '',
                                        locationLat: event.location?.latitude ?? null,
                                        locationLng: event.location?.longitude ?? null,
                                        itemId: event.items?.id ?? null,
                                        itemName: event.items?.name ?? null,
                                        customerId: (event as any).customerId ?? null,
                                        customerName: (event as any).customerName ?? null,
                                      })}"""
if old_single in code:
    code = code.replace(old_single, new_single); APPLIED.append('FixN: single setEditEvent customer追加')
else: ERRORS.append('FixN: single setEditEvent not found')

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
print("  cd ~/dump-tracker && git add -A && git commit -m 'fix: CMSタイムライン編集モーダル完全対応v3' && git push origin main")
