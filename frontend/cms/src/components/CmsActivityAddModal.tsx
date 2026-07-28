// frontend/cms/src/components/CmsActivityAddModal.tsx
// OperationDetailDialog.tsx から分割: タイムラインイベント追加モーダル

import React from 'react';
import { apiClient } from '../utils/api';
import LocationMapPicker from './maps/LocationMapPicker';

interface CmsActivityAddModalProps {
  operationId: string;
  items: { id: string; name: string; itemType?: string; displayOrder?: number }[];
  customers?: { id: string; name: string }[];
  vehicleId?: string;
  mapsLoaded?: boolean;
  // ✅ mobileと同じ「＋」マーカーによる挿入位置指定・デフォルト値
  insertAfterSequenceNumber?: number;
  defaultStartTime?: string | null;
  defaultCustomerId?: string;
  defaultCustomerName?: string;
  onClose: () => void;
  onSaved: () => void;
}

// ✅ 休憩は開始・終了をまとめて1回の操作で追加する（mobileと同じ仕様）
const ADD_EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'LOADING', label: '積込' },
  { value: 'UNLOADING', label: '荷降' },
  { value: 'FUELING', label: '給油' },
  { value: 'BREAK', label: '休憩' },
];

const CmsActivityAddModal: React.FC<CmsActivityAddModalProps> = ({
  operationId, items, customers, vehicleId, mapsLoaded,
  insertAfterSequenceNumber, defaultStartTime, defaultCustomerId, defaultCustomerName,
  onClose, onSaved
}) => {
  const [eventType, setEventType] = React.useState('LOADING');
  const [locQuery, setLocQuery] = React.useState('');
  const [locResults, setLocResults] = React.useState<{ id: string; name: string; address: string }[]>([]);
  const [locSearching, setLocSearching] = React.useState(false);
  const [selectedLocationId, setSelectedLocationId] = React.useState('');
  const [selectedLocationName, setSelectedLocationName] = React.useState('');
  const [showNewLocationForm, setShowNewLocationForm] = React.useState(false);
  // ✅ 修正①: 編集モーダルと同じ「登録リストから選択」ボタン押下時のみ一覧を表示する
  const [showLocPickerModal, setShowLocPickerModal] = React.useState(false);
  const [newLocName, setNewLocName] = React.useState('');
  const [newLocAddress, setNewLocAddress] = React.useState('');
  const [newLocLat, setNewLocLat] = React.useState('');
  const [newLocLng, setNewLocLng] = React.useState('');
  const [startHHMM, setStartHHMM] = React.useState('');
  const [endHHMM, setEndHHMM] = React.useState('');
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [quantity, setQuantity] = React.useState('');
  const [fuelAmt, setFuelAmt] = React.useState('');
  const [fuelCost, setFuelCost] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [customItemName, setCustomItemName] = React.useState('');
  const [showCustomItem, setShowCustomItem] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const isLoadOrUnload = eventType === 'LOADING' || eventType === 'UNLOADING';

  // ✅ mobileと同じ: 開始・終了時刻は直前イベントの終了時刻をデフォルトに、
  // 荷降は直近の積込イベントと同じ客先をデフォルトにする
  React.useEffect(() => {
    const toHMLocal = (iso: string | null | undefined): string => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
      } catch { return ''; }
    };
    const hm = toHMLocal(defaultStartTime ?? null);
    if (hm) { setStartHHMM(hm); setEndHHMM(hm); }
    if (eventType === 'UNLOADING' && defaultCustomerId) {
      setCurrentCustomerId(defaultCustomerId);
      setCurrentCustomerName(defaultCustomerName || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isFuelType = eventType === 'FUELING';
  const isBreakType = eventType === 'BREAK';
  const [currentCustomerId, setCurrentCustomerId] = React.useState('');
  const [currentCustomerName, setCurrentCustomerName] = React.useState('');
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(false);

  // ✅ 修正②③【根本原因】: 種別（積込/荷降）を選んだ時点で登録済み場所を
  // 全件取得する（「登録リストから選択」と同じ体験）。以前は検索文字列を
  // 1文字以上入力しないと候補が一切出ない実装になっていた。
  const [locAllResults, setLocAllResults] = React.useState<{ id: string; name: string; address: string }[]>([]);
  React.useEffect(() => {
    if (!isLoadOrUnload) { setLocAllResults([]); return; }
    setLocSearching(true);
    (async () => {
      try {
        const typeFilter = eventType === 'LOADING' ? ['PICKUP', 'BOTH'] : ['DELIVERY', 'BOTH'];
        const res = await apiClient.get('/locations', { params: { limit: 100, locationType: typeFilter } });
        const d: any = res;
        const arr = d?.data?.data ?? d?.data ?? [];
        setLocAllResults(Array.isArray(arr) ? arr : []);
      } catch { setLocAllResults([]); }
      finally { setLocSearching(false); }
    })();
  }, [eventType, isLoadOrUnload]);

  // ✅ 検索テキストによるクライアント側の絞り込み（未入力なら全件表示）
  React.useEffect(() => {
    const q = locQuery.trim().toLowerCase();
    setLocResults(q ? locAllResults.filter(l => l.name.toLowerCase().includes(q)) : locAllResults);
  }, [locQuery, locAllResults]);

  // 🆕 車両の積載量(capacityTons)を数量の初期値にする
  // ✅ 診断ログ追加: vehicleIdが渡っているか／APIレスポンスに capacityTons が
  // 含まれているかを次回切り分けできるようにする（推測での書き換えはしない）
  React.useEffect(() => {
    console.log('[イベント追加] 車両積載量デフォルト値取得', { vehicleId });
    if (!vehicleId) {
      console.warn('[イベント追加] vehicleIdが渡されていないため積載量のデフォルト値取得をスキップします');
      return;
    }
    (async () => {
      try {
        const res = await apiClient.get(`/vehicles/${vehicleId}`);
        const d: any = res;
        console.log('[イベント追加] /vehicles/:id レスポンス', d);
        const v = d?.data?.data ?? d?.data ?? d;
        const cap = v?.capacityTons ?? v?.capacity;
        console.log('[イベント追加] 抽出した積載量(capacityTons)', cap);
        if (cap) {
          setQuantity(prev => prev || String(cap));
        } else {
          console.warn('[イベント追加] この車両にはcapacityTons（積載量）が設定されていません。車両管理画面で設定してください。', v);
        }
      } catch (e) {
        console.error('[イベント追加] 車両情報の取得に失敗しました', e);
      }
    })();
  }, [vehicleId]);

  const toggleItem = (id: string) =>
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreateLocation = async () => {
    if (!newLocName.trim() || !newLocLat || !newLocLng) {
      setSaveError('地点名・緯度・経度は必須です'); return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiClient.post('/locations', {
        name: newLocName.trim(),
        address: newLocAddress.trim() || '住所未設定',
        latitude: parseFloat(newLocLat),
        longitude: parseFloat(newLocLng),
        locationType: eventType === 'LOADING' ? 'PICKUP' : 'DELIVERY',
      });
      const d: any = res;
      const created = d?.data?.data ?? d?.data ?? d;
      if (created?.id) {
        setSelectedLocationId(created.id);
        setSelectedLocationName(created.name || newLocName.trim());
        setShowNewLocationForm(false);
        setLocQuery('');
        setLocResults([]);
      } else {
        setSaveError('地点登録に失敗しました');
      }
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || '地点登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const mergeHM = (hhmm: string): string => {
    // ✅ 修正①: 以前は常に new Date()（＝今日の日付）を基準にしており、
    // 過去の運行に「+」マーカーでイベントを追加すると、選んだ時刻に関わらず
    // 「今日」の日時として保存されてしまい、必ず一覧の一番下（未来側）に
    // ソートされる原因になっていた。挿入位置の直前イベントの実時刻
    // （defaultStartTime＝その運行が実際に行われた日付）を基準にする。
    const base = defaultStartTime ? new Date(defaultStartTime) : new Date();
    if (!hhmm) return base.toISOString();
    const parts = hhmm.split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    const jstOff = 9 * 60 * 60 * 1000;
    const jstBase = new Date(base.getTime() + jstOff);
    const y = jstBase.getUTCFullYear();
    const mo = jstBase.getUTCMonth();
    const day = jstBase.getUTCDate();
    const utcMs = Date.UTC(y, mo, day, h, m, 0, 0) - jstOff;
    return new Date(utcMs).toISOString();
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!startHHMM) { setSaveError('時刻を入力してください'); return; }
    if (isLoadOrUnload && !selectedLocationId) { setSaveError('場所を選択してください'); return; }
    setSaving(true);
    try {
      let finalNotes = notes || '';
      if (customItemName.trim()) {
        finalNotes = `品目: ${customItemName.trim()}` + (finalNotes ? ` / ${finalNotes}` : '');
      }

      // ✅ 休憩は開始(BREAK_START)・終了(BREAK_END)を連続シーケンスで2レコード作成（mobileと同じ仕様）
      if (isBreakType) {
        const startPayload: Record<string, any> = {
          operationId,
          activityType: 'BREAK_START',
          actualStartTime: mergeHM(startHHMM),
          quantityTons: 0,
          notes: finalNotes || undefined,
        };
        if (insertAfterSequenceNumber !== undefined) startPayload.insertAfterSequenceNumber = insertAfterSequenceNumber;
        const startRes: any = await apiClient.post('/operation-details', startPayload);
        const createdStart = startRes?.data?.data ?? startRes?.data ?? startRes;
        if (!(startRes?.success || createdStart?.id)) {
          setSaveError('休憩開始の追加に失敗しました');
          setSaving(false);
          return;
        }
        if (endHHMM && createdStart?.sequenceNumber !== undefined) {
          const endPayload: Record<string, any> = {
            operationId,
            activityType: 'BREAK_END',
            actualStartTime: mergeHM(endHHMM),
            actualEndTime: mergeHM(endHHMM),
            quantityTons: 0,
            insertAfterSequenceNumber: createdStart.sequenceNumber,
          };
          const endRes: any = await apiClient.post('/operation-details', endPayload);
          const endD = endRes?.data?.data ?? endRes?.data ?? endRes;
          if (!(endRes?.success || endD?.id)) {
            setSaveError('休憩終了の追加に失敗しました（休憩開始は追加済みです）');
            setSaving(false);
            return;
          }
        }
        onSaved();
        setSaving(false);
        return;
      }

      const payload: Record<string, any> = {
        operationId,
        activityType: eventType,
        actualStartTime: mergeHM(startHHMM),
        quantityTons: 0,
        notes: finalNotes || undefined,
      };
      if (insertAfterSequenceNumber !== undefined) payload.insertAfterSequenceNumber = insertAfterSequenceNumber;
      if (isLoadOrUnload) {
        payload.locationId = selectedLocationId;
        if (endHHMM) payload.actualEndTime = mergeHM(endHHMM);
        if (selectedItemIds.length > 0) {
          payload.itemId = selectedItemIds[0];
          payload.selectedItemIds = selectedItemIds;
        }
        if (quantity) payload.quantityTons = parseFloat(quantity);
        // ✅ 客先: 積込・荷降どちらも保存する（積込〜荷降は1セットで同じ客先という仕様）
        if (currentCustomerId) payload.customerId = currentCustomerId;
      }
      if (isFuelType) {
        if (fuelAmt) payload.quantityTons = parseFloat(fuelAmt);
        if (fuelCost) payload.fuelCostYen = parseFloat(fuelCost);
      }
      const res = await apiClient.post('/operation-details', payload);
      const d: any = res;
      if (d?.success || d?.data?.id || d?.id) {
        onSaved();
      } else {
        setSaveError('保存に失敗しました');
      }
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || e?.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1d4ed8cc 100%)' }}>
          <span className="font-semibold text-base">イベント追加</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{saveError}</div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">種別</p>
            <div className="flex gap-2 flex-wrap">
              {ADD_EVENT_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setEventType(t.value)}
                  className="px-3 py-1.5 rounded-lg text-sm border"
                  style={{
                    background: eventType === t.value ? '#eff6ff' : '#fff',
                    borderColor: eventType === t.value ? '#3b82f6' : '#e5e7eb',
                    color: eventType === t.value ? '#1d4ed8' : '#374151',
                    fontWeight: eventType === t.value ? 600 : 400,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {isLoadOrUnload && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500">場所</p>
                {/* ✅ 修正①: 編集モーダルと同じ「登録リストから選択」ボタン方式に統一 */}
                {!selectedLocationId && (
                  <button type="button" onClick={() => { setLocQuery(''); setShowLocPickerModal(true); }}
                    className="text-xs px-2 py-0.5 rounded border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors">
                    登録リストから選択
                  </button>
                )}
              </div>
              {selectedLocationId ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-blue-800">{selectedLocationName}</span>
                  <button type="button" onClick={() => { setSelectedLocationId(''); setSelectedLocationName(''); }}
                    className="text-xs text-blue-600 underline">変更</button>
                </div>
              ) : (
                <>
                  {!showNewLocationForm ? (
                    <button type="button" onClick={() => setShowNewLocationForm(true)}
                      className="w-full text-sm text-blue-600 border border-blue-300 rounded-lg py-2 hover:bg-blue-50">
                      + 新規地点を登録
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <input type="text" value={newLocName} onChange={e => setNewLocName(e.target.value)}
                        placeholder="地点名" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                      {mapsLoaded ? (
                        <LocationMapPicker
                          initialPosition={{
                            lat: newLocLat ? parseFloat(newLocLat) : 34.6937,
                            lng: newLocLng ? parseFloat(newLocLng) : 135.5023,
                          }}
                          onPositionChange={(pos, address) => {
                            setNewLocLat(String(pos.lat));
                            setNewLocLng(String(pos.lng));
                            if (address) setNewLocAddress(address);
                          }}
                          height={260}
                        />
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">地図を読み込み中...</p>
                      )}
                      <input type="text" value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)}
                        placeholder="住所（地図クリックで自動入力されます）" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                      <button type="button" onClick={handleCreateLocation} disabled={saving || !newLocLat || !newLocLng}
                        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                        この内容で登録する
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ✅ 修正①: 場所ピッカー（編集モーダルの「登録リストから選択」と同じオーバーレイ方式） */}
              {showLocPickerModal && (
                <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black bg-opacity-50"
                  onClick={e => { if (e.target === e.currentTarget) setShowLocPickerModal(false); }}>
                  <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[70vh] flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <span className="font-semibold text-sm">場所を選択</span>
                      <button onClick={() => setShowLocPickerModal(false)} className="text-gray-500 text-sm">✕ 閉じる</button>
                    </div>
                    <div className="px-4 py-3 border-b">
                      <input type="text" value={locQuery} onChange={e => setLocQuery(e.target.value)}
                        placeholder="場所名で検索" autoFocus
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div className="overflow-y-auto flex-1 p-3 space-y-2">
                      {locSearching ? (
                        <p className="text-center text-gray-400 text-sm py-4">検索中...</p>
                      ) : locResults.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-4">該当する場所が見つかりません</p>
                      ) : locResults.map(l => (
                        <button key={l.id} type="button"
                          onClick={() => { setSelectedLocationId(l.id); setSelectedLocationName(l.name); setShowLocPickerModal(false); }}
                          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col gap-0.5">
                          <span className="text-sm text-gray-800 font-medium">📍 {l.name}</span>
                          {l.address && <span className="text-xs text-gray-400">{l.address}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {eventType === 'LOADING' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">客先</p>
              <button type="button" onClick={() => setShowCustomerPicker(true)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-blue-400 transition-colors">
                <span className={currentCustomerName ? 'text-gray-800' : 'text-gray-400'}>
                  🏢 {currentCustomerName || '（タップして選択）'}
                </span>
                <span className="text-xs text-blue-600 ml-2">選択 ▾</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">{isBreakType ? '開始時刻' : '到着時刻'}<span className="text-red-500 ml-1">*</span></p>
              <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {(isLoadOrUnload || isBreakType) && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{isBreakType ? '終了時刻（任意）' : '完了時刻（任意）'}</p>
                <input type="time" value={endHHMM} onChange={e => setEndHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}
          </div>

          {eventType === 'LOADING' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">
                品目 <span className="font-normal text-gray-400">（複数選択可）</span>
              </p>
              {(() => {
                const TYPE_LABEL: Record<string, string> = {
                  RECYCLED_MATERIAL: '再生材', VIRGIN_MATERIAL: 'バージン材', WASTE: '廃棄物',
                };
                const ORDER: (string | undefined)[] = ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE', undefined];
                const grouped = ORDER.map(k => ({
                  key: k,
                  label: k ? (TYPE_LABEL[k] ?? k) : 'その他',
                  items: items
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
                          {group.items.map((it: any) => {
                            const sel = selectedItemIds.includes(it.id);
                            return (
                              <button key={it.id} type="button" onClick={() => toggleItem(it.id)}
                                className="py-2.5 px-2 text-sm font-medium rounded-lg border-2 text-center transition-all leading-tight"
                                style={{
                                  background: sel ? 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' : '#fff',
                                  color: sel ? '#fff' : '#374151',
                                  borderColor: sel ? '#667eea' : '#d1d5db',
                                  fontWeight: sel ? 'bold' : 'normal',
                                }}
                              >{sel ? `✓ ${it.name}` : it.name}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <button type="button" onClick={() => setShowCustomItem(v => !v)}
                className="mt-2 px-3 py-1.5 rounded-lg text-sm border"
                style={{
                  background: showCustomItem ? '#eff6ff' : '#fff',
                  borderColor: showCustomItem ? '#3b82f6' : '#e5e7eb',
                  color: showCustomItem ? '#1d4ed8' : '#374151',
                }}>
                + その他（手入力）
              </button>
              {showCustomItem && (
                <input type="text" value={customItemName} onChange={e => setCustomItemName(e.target.value)}
                  placeholder="品目名を入力" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 mb-2" />
              )}
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">数量</p>
                <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                <span className="text-xs text-gray-500">t</span>
              </div>
            </div>
          )}

          {isFuelType && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">給油量（L）</p>
                <input type="number" value={fuelAmt} onChange={e => setFuelAmt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">金額（円）</p>
                <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">備考</p>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="備考を入力（任意）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

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
                  {!customers || customers.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">客先を読み込み中...</p>
                  ) : customers.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setCurrentCustomerId(c.id); setCurrentCustomerName(c.name); setShowCustomerPicker(false); }}
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
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-[2] py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: saving ? '#9ca3af' : '#1d4ed8' }}>
            {saving ? '追加中...' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  );
};


export default CmsActivityAddModal;
