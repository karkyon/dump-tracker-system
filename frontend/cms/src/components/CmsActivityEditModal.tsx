// frontend/cms/src/components/CmsActivityEditModal.tsx
// OperationDetailDialog.tsx から分割: 既存タイムラインイベントの編集モーダル

import { AlertCircle, Trash2, X, Save } from 'lucide-react';
import React from 'react';
import { apiClient } from '../utils/api';
import CmsGpsPinMap from './CmsGpsPinMap';
import { CmsEditEvent, EVENT_TYPE_LABEL, isLoadEvt, isLoadGroupEvt, isUnlGroupEvt, isBreakGroupEvt, stripBreakAutoNotes, isFuelEvt, isBreakEvt, toHM, mergeHM, isInspEvt, isTripEvt, isPostInsp, isDeletable, isBreakStart, isBreakEnd } from './operationDetailShared';

interface CmsActivityEditModalProps {
  event: CmsEditEvent | null;
  operationId: string;
  items: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}

const CmsActivityEditModal: React.FC<CmsActivityEditModalProps> = ({
  event, items, customers, onClose, onSaved, onDeleted
}) => {
  const [startHHMM, setStartHHMM] = React.useState('');
  // ✅ 積込・荷降統合編集: 完了時刻
  const [endHHMM, setEndHHMM] = React.useState('');
  const [locationName, setLocationName] = React.useState('');
  const [notes,     setNotes]     = React.useState('');
  const [quantity,  setQuantity]  = React.useState('');
  const [fuelAmt,   setFuelAmt]   = React.useState('');
  const [fuelCost,  setFuelCost]  = React.useState('');
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [pinLat, setPinLat] = React.useState<number | undefined>(undefined);
  const [pinLng, setPinLng] = React.useState<number | undefined>(undefined);
  // ✅ 修正③: mobile ActivityEditSheetと同じ「登録リストから選択」場所ピッカー
  const [selectedLocationId, setSelectedLocationId] = React.useState('');
  const [showLocPicker, setShowLocPicker] = React.useState(false);
  const [locPickerQuery, setLocPickerQuery] = React.useState('');
  const [locPickerResults, setLocPickerResults] = React.useState<{ id: string; name: string; address: string }[]>([]);
  const [locPickerSearching, setLocPickerSearching] = React.useState(false);
  // ✅ 修正③【根本原因】: ピッカーを開いた時点で登録済み場所を全件取得しキャッシュする
  // （mobile ActivityEditSheetと同じ方式）。以前は検索文字列入力を待つ実装になっており、
  // 何も入力しないとリストが常に空のままだった。
  const [locPickerAllResults, setLocPickerAllResults] = React.useState<{ id: string; name: string; address: string }[]>([]);
  const [currentCustomerId,   setCurrentCustomerId]   = React.useState('');
  const [currentCustomerName, setCurrentCustomerName] = React.useState('');
  const [showCustomerPicker,  setShowCustomerPicker]  = React.useState(false);
  const [preinspMemo, setPreinspMemo] = React.useState('');
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
    setEndHHMM(toHM(event.completionTimestamp ?? null));
    setLocationName(event.locationName ?? '');
    setNotes(isBreakEvt(event.eventType) ? stripBreakAutoNotes(event.notes ?? '') : (event.notes ?? ''));
    setQuantity(event.quantityTons && event.quantityTons > 0 ? String(event.quantityTons) : '');
    if (event.eventType === 'POST_INSPECTION') {
      // ✅ 正しいフィールドから初期値を取得
      // overall_notes → 点検メモ
      const overallNotes = (event as any).overallNotes ?? '';
      setInspMemo(overallNotes);
      // operations.total_distance_km → 走行距離
      setOdometer((event as any).totalDistanceKm ? String((event as any).totalDistanceKm) : '');
      // operations.fuel_consumed_liters → 燃料
      setFuelLevel((event as any).fuelConsumedLiters ? String((event as any).fuelConsumedLiters) : '');
    } else if (event.eventType === 'TRIP_END') {
      // ✅ 修正④: 運行終了イベントでも走行距離を編集できるように初期値を設定
      setOdometer((event as any).totalDistanceKm ? String((event as any).totalDistanceKm) : '');
      setFuelLevel(''); setInspMemo('');
    } else { setOdometer(''); setFuelLevel(''); setInspMemo(''); }
    // ✅ 給油: 専用カラムから初期値取得（notes regex解析廃止）
    if (['FUELING','REFUELING'].includes(event.eventType ?? '')) {
      setFuelAmt(event.quantityTons && event.quantityTons > 0 ? String(event.quantityTons) : '');
      setFuelCost(event.fuelCostYen ? String(event.fuelCostYen) : '');
    } else {
      setFuelAmt(''); setFuelCost('');
    }
    // ✅ 複数品目: detailItems があれば優先、なければ itemId にフォールバック
    if (event.detailItems && event.detailItems.length > 0) {
      setSelectedItemIds(event.detailItems.map(di => di.itemId));
    } else {
      setSelectedItemIds(event.itemId ? [event.itemId] : []);
    }
    setPinLat(event.locationLat != null ? event.locationLat : undefined);
    setPinLng(event.locationLng != null ? event.locationLng : undefined);
    // ✅ 修正③: 既存の場所IDを引き継ぐ（未選択のまま保存してもlocationIdが消えないように）
    setSelectedLocationId(event.locationId ?? '');
    setShowLocPicker(false); setLocPickerQuery(''); setLocPickerResults([]); setLocPickerAllResults([]);
    setCurrentCustomerId(event.customerId ?? '');
    setCurrentCustomerName(event.customerName ?? '');
    setShowCustomerPicker(false);
    // ✅ 修正①【根本原因】: 以前はここで setOdometer('')/setFuelLevel('')/setInspMemo('') を
    // 無条件に再実行しており、直前の POST_INSPECTION 分岐で正しく設定した点検メモ・走行距離・
    // 燃料レベルの初期値を毎回空文字で上書きしてしまっていた（＝入力済み内容が呼び出せないバグの直接原因）。
    // 該当行を削除し、preinspMemo の設定のみ残す。
    setPreinspMemo(event.preinspMemo ?? '');
    setConfirmDel(false);
    setSaveError(null);
  }, [event]);

  if (!event) return null;

  const toggleItem = (id: string) =>
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ✅ 修正: 以前はここで運行全体(operations.customerId)を即座に書き換えており、
  // 1つの積込の客先を変更しただけで運行中の他の積込・荷降まで巻き込んで変わってしまうバグの原因だった。
  const handleChangeCustomer = (cid: string, cname: string) => {
    setCurrentCustomerId(cid); setCurrentCustomerName(cname);
    setShowCustomerPicker(false);
  };

  // ✅ 修正③【根本原因】: ピッカーを開いた時点で登録済み場所を全件取得する
  // （mobileの「登録リストから選択」と同じ仕様：検索文字列の入力を待たずに一覧表示する）
  React.useEffect(() => {
    if (!showLocPicker) return;
    setLocPickerSearching(true);
    (async () => {
      try {
        const typeFilter = isLoadGroupEvt(event?.eventType ?? '') ? ['PICKUP', 'BOTH'] : ['DELIVERY', 'BOTH'];
        const res = await apiClient.get('/locations', { params: { limit: 100, locationType: typeFilter } });
        const d: any = res;
        const arr = d?.data?.data ?? d?.data ?? [];
        setLocPickerAllResults(Array.isArray(arr) ? arr : []);
      } catch { setLocPickerAllResults([]); }
      finally { setLocPickerSearching(false); }
    })();
  }, [showLocPicker, event]);

  // ✅ 修正③: 検索テキストによるクライアント側の絞り込み（未入力なら全件表示）
  React.useEffect(() => {
    const q = locPickerQuery.trim().toLowerCase();
    setLocPickerResults(q ? locPickerAllResults.filter(l => l.name.toLowerCase().includes(q)) : locPickerAllResults);
  }, [locPickerQuery, locPickerAllResults]);

  const handleSave = async () => {
    setSaveError(null);
    if (!startHHMM) { setSaveError('記録時刻を入力してください'); return; }
    setSaving(true);
    try {
      // ✅ 積込・荷降統合編集: mobileのActivityEditSheetと同じ、実レコード1件への直接更新
      // （従来の到着/完了に分割編集する統合エンドポイントは使わない）
      if (isLoadGroupEvt(event.eventType) || isUnlGroupEvt(event.eventType)) {
        const body: Record<string, any> = {
          actualStartTime: mergeHM(event.timestamp, startHHMM),
        };
        if (endHHMM) {
          body.actualEndTime = mergeHM(event.completionTimestamp ?? event.timestamp, endHHMM);
        }
        if (selectedLocationId) {
          // ✅ 修正③: 登録リストから選択した場合はlocationIdを直接送る（曖昧一致に依存しない）
          body.locationId = selectedLocationId;
        } else if (locationName) {
          body.locationName = locationName;
        }
        if (pinLat !== undefined && pinLng !== undefined) {
          body.latitude = pinLat;
          body.longitude = pinLng;
        }
        if (notes) body.notes = notes;
        if (isLoadGroupEvt(event.eventType)) {
          if (selectedItemIds.length > 0) {
            body.itemId = selectedItemIds[0];
            body.selectedItemIds = selectedItemIds;
          }
          if (quantity) body.quantityTons = parseFloat(quantity);
          if (currentCustomerId) body.customerId = currentCustomerId;
        }
        const res = await apiClient.put(`/operation-details/${event.realDetailId}`, body);
        if ((res as any).success || (res as any).data || (res as any).id) {
          onSaved();
          onClose();
        } else {
          setSaveError('保存に失敗しました');
        }
        setSaving(false);
        return;
      }
      // ✅ 休憩統合編集: mobileのActivityEditSheetと同じく、開始・終了2レコードを個別に更新する
      if (isBreakGroupEvt(event.eventType)) {
        const startBody: Record<string, any> = {
          actualStartTime: mergeHM(event.timestamp, startHHMM),
        };
        if (notes) startBody.notes = notes;
        const startRes = await apiClient.put(`/operation-details/timeline-event/${event.id}`, startBody);
        if (!((startRes as any).success || (startRes as any).data || (startRes as any).id || (startRes as any).eventId)) {
          setSaveError('休憩開始の保存に失敗しました');
          setSaving(false);
          return;
        }
        if (event.pairedEndId && endHHMM) {
          const endIso = mergeHM(event.completionTimestamp ?? event.timestamp, endHHMM);
          const endBody: Record<string, any> = { actualStartTime: endIso, actualEndTime: endIso };
          const endRes = await apiClient.put(`/operation-details/timeline-event/${event.pairedEndId}`, endBody);
          if (!((endRes as any).success || (endRes as any).data || (endRes as any).id || (endRes as any).eventId)) {
            setSaveError('休憩終了の保存に失敗しました');
            setSaving(false);
            return;
          }
        }
        onSaved();
        onClose();
        setSaving(false);
        return;
      }
      // ✅ 統合エンドポイントで全イベント種別を処理
      const body: Record<string, any> = {
        actualStartTime: mergeHM(event.timestamp, startHHMM),
      };
      // 場所名（点検・運行開始終了以外）
      if (locationName && !isInspEvt(event.eventType) && !isTripEvt(event.eventType)) {
        body.locationName = locationName;
      }
      // GPS座標
      if (pinLat !== undefined && pinLng !== undefined) {
        body.latitude  = pinLat;
        body.longitude = pinLng;
      }
      // 備考（点検・運行開始終了以外）
      if (!isInspEvt(event.eventType) && !isTripEvt(event.eventType)) {
        if (notes) body.notes = notes;
      }
      // 積込完了 / 積降完了: 完了時刻・品目・重量
      if (event.eventType === 'LOADING_COMPLETED' || event.eventType === 'UNLOADING_COMPLETED') {
        body.actualEndTime = mergeHM(event.timestamp, startHHMM);
        delete body.actualStartTime;
        if (selectedItemIds.length > 0) {
          body.itemId = selectedItemIds[0];             // 後方互換（単一品目時）
          body.selectedItemIds = selectedItemIds;       // ✅ 複数品目はDBの専用テーブルへ
          // ✅ notes への品目名埋め込みは廃止
        }
        if (quantity) body.quantityTons = parseFloat(quantity);
      }
      // ✅ 給油: 専用カラムに保存（notes 埋め込み廃止）
      if (isFuelEvt(event.eventType)) {
        if (fuelAmt) body.quantityTons = parseFloat(fuelAmt);
        if (fuelCost) body.fuelCostYen = parseFloat(fuelCost);  // ✅ 専用カラム
        // notes は自由記述のみ
      }
      // ✅ 修正④: 運行終了は走行距離をoperations.totalDistanceKmに保存
      if (event.eventType === 'TRIP_END') {
        if (odometer) body.totalDistanceKm = odometer;
      }
      // 運行前点検: overall_notes に保存
      if (event.eventType === 'PRE_INSPECTION') {
        if (preinspMemo) body.overallNotes = preinspMemo;
        delete body.notes;
      }
      // 運行後点検: 正しいカラムに保存
      if (isPostInsp(event.eventType)) {
        // overall_notes → inspection_records.overall_notes
        if (inspMemo) body.overallNotes = inspMemo;
        // 走行距離 → operations.total_distance_km
        if (odometer) body.totalDistanceKm = odometer;
        // 燃料消費量 → operations.fuel_consumed_liters
        if (fuelLevel) body.fuelConsumedLiters = fuelLevel;
        delete body.notes; // notesには保存しない
      }
      // ✅ 修正: 運行全体(operations.customerId)への一括更新は廃止。
      // この積込（またはペアの荷降）だけに customerId を保存する（バックエンド側でペア反映も行う）。
      if (isLoadEvt(event.eventType) && currentCustomerId) {
        body.customerId = currentCustomerId;
      }
      // ✅ 統合エンドポイント使用（event.id = 合成IDそのまま）
      const res = await apiClient.put(`/operation-details/timeline-event/${event.id}`, body);
      if ((res as any).success || (res as any).data || (res as any).id || (res as any).eventId) {
        onSaved();
        onClose();
      } else {
        setSaveError('保存に失敗しました');
      }
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || e?.message || '保存に失敗しました');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await apiClient.delete(`/operation-details/${event.realDetailId}`);
      // ✅ 休憩は開始・終了2レコード1組のため、ペアの終了レコードも同時に削除する
      if (isBreakGroupEvt(event.eventType) && event.pairedEndId) {
        await apiClient.delete(`/operation-details/${event.pairedEndId}`);
      }
      onDeleted(event.id);
      if (event.pairedEndId) onDeleted(event.pairedEndId);
      onClose();
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || '削除に失敗しました');
      setConfirmDel(false);
    } finally { setDeleting(false); }
  };

  const accentColors: Record<string, string> = {
    LOADING: '#1565C0', LOADING_ARRIVED: '#1565C0', LOADING_COMPLETED: '#1565C0',
    UNLOADING: '#2E7D32', UNLOADING_ARRIVED: '#2E7D32', UNLOADING_COMPLETED: '#2E7D32',
    FUELING: '#E65100', REFUELING: '#E65100',
    BREAK: '#6A1B9A', BREAK_START: '#6A1B9A', BREAK_END: '#6A1B9A',
  };
  const accent = accentColors[event.eventType] || '#1d4ed8';
  const label  = EVENT_TYPE_LABEL[event.eventType] || event.eventType;

  return (
    <div
      className="fixed inset-0 z-[9900] flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}>
          <span className="font-semibold text-base">{label} — 編集</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}
            </div>
          )}

          {/* 時刻: イベント種別ごとに完全制御 */}
          {(() => {
            const et = event.eventType;
            const isCompleted = et === 'LOADING_COMPLETED' || et === 'UNLOADING_COMPLETED';
            const isArrived   = et === 'LOADING_ARRIVED'   || et === 'UNLOADING_ARRIVED';
            // ✅ 積込・荷降統合編集: 到着時刻・完了時刻を1画面で両方編集（mobileと同じ仕様）
            if (isLoadGroupEvt(et) || isUnlGroupEvt(et)) return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">到着時刻<span className="text-red-500 ml-1">*</span></label>
                  <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">完了時刻<span className="text-gray-400 font-normal ml-1">（任意）</span></label>
                  <input type="time" value={endHHMM} onChange={e => setEndHHMM(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            );
            // ✅ 休憩統合編集: 開始・終了を1画面で両方編集（mobileと同じ仕様）
            if (isBreakGroupEvt(et)) return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">休憩開始時刻<span className="text-red-500 ml-1">*</span></label>
                  <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">休憩終了時刻<span className="text-gray-400 font-normal ml-1">（任意）</span></label>
                  <input type="time" value={endHHMM} onChange={e => setEndHHMM(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            );
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
          })()}

          {/* ✅ 修正④: 運行終了イベントで走行距離を編集可能にする */}
          {event.eventType === 'TRIP_END' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">走行距離（km）<span className="font-normal text-gray-400">（任意）</span></label>
              <input type="number" inputMode="decimal" value={odometer} onChange={e => setOdometer(e.target.value)}
                placeholder="例: 3855"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          )}

          {/* ── 積込(到着): 場所名・客先・GPS地図のみ ── */}
          {(event.eventType === 'LOADING_ARRIVED' || isLoadGroupEvt(event.eventType)) && (<>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-500">積込場所名</label>
                <button type="button" onClick={() => setShowLocPicker(true)}
                  className="text-xs px-2 py-0.5 rounded border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors">
                  登録リストから選択
                </button>
              </div>
              <input type="text" value={locationName} onChange={e => { setLocationName(e.target.value); setSelectedLocationId(''); }}
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
          {(event.eventType === 'LOADING_COMPLETED' || isLoadGroupEvt(event.eventType)) && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                品目 <span className="font-normal text-gray-400">（複数選択可）</span>
              </label>
              {items.length === 0 ? (
                <div className="text-xs text-amber-600 py-2">
                  ⏳ 品目を読み込み中...
                  {event.itemId && (
                    <p className="mt-1 text-gray-600">
                      現在選択中: <span className="font-semibold text-blue-600">{event.itemName ?? '（品目名取得中）'}</span>
                    </p>
                  )}
                </div>
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
          </>)}

          {/* ── 積降(到着): 場所名・GPS地図 ── */}
          {(event.eventType === 'UNLOADING_ARRIVED' || isUnlGroupEvt(event.eventType)) && (<>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-500">積降場所名</label>
                <button type="button" onClick={() => setShowLocPicker(true)}
                  className="text-xs px-2 py-0.5 rounded border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors">
                  登録リストから選択
                </button>
              </div>
              <input type="text" value={locationName} onChange={e => { setLocationName(e.target.value); setSelectedLocationId(''); }}
                placeholder="例: ABC建材センター"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <CmsGpsPinMap lat={pinLat} lng={pinLng}
              onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }} />
          </>)}

          {/* ── 積降(完了): 完了時刻のみ（追加項目なし） ── */}

          {/* 給油専用 */}
          {isFuelEvt(event.eventType) && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">スタンド名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: ENEOS セルフ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">給油量（L）</label>
                <input type="number" value={fuelAmt} onChange={e => setFuelAmt(e.target.value)} placeholder="例: 35"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">金額（円）</label>
                <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="例: 6300"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          </>)}

          {/* ✅ 休憩には場所名は不要のため表示しない（mobileと同じ仕様） */}

          {/* 運行前点検専用: 点検メモ */}
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

          {/* 備考: 給油・休憩のみ */}
          {isFuelEvt(event.eventType) || isBreakEvt(event.eventType) ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">備考 <span className="font-normal text-gray-400">（任意）</span></label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="メモを入力..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          ) : null}

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
          )}

          {/* ✅ 修正③: 場所ピッカー（mobileの「登録リストから選択」と同じ仕様） */}
          {showLocPicker && (
            <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black bg-opacity-50"
              onClick={e => { if (e.target === e.currentTarget) setShowLocPicker(false); }}>
              <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[70vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="font-semibold text-sm">場所を選択</span>
                  <button onClick={() => setShowLocPicker(false)} className="text-gray-500 text-sm">✕ 閉じる</button>
                </div>
                <div className="px-4 py-3 border-b">
                  <input type="text" value={locPickerQuery} onChange={e => setLocPickerQuery(e.target.value)}
                    placeholder="場所名で検索" autoFocus
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="overflow-y-auto flex-1 p-3 space-y-2">
                  {locPickerSearching ? (
                    <p className="text-center text-gray-400 text-sm py-4">検索中...</p>
                  ) : locPickerResults.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">該当する場所が見つかりません</p>
                  ) : locPickerResults.map(l => (
                    <button key={l.id} type="button"
                      onClick={() => {
                        setSelectedLocationId(l.id);
                        setLocationName(l.name);
                        setShowLocPicker(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg border transition-colors flex flex-col gap-0.5"
                      style={{ background: l.id === selectedLocationId ? '#eff6ff' : '#f9fafb', borderColor: l.id === selectedLocationId ? '#3b82f6' : '#e5e7eb' }}>
                      <span className="text-sm text-gray-800 font-medium">📍 {l.name}</span>
                      {l.address && <span className="text-xs text-gray-400">{l.address}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-[2] py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            style={{ background: saving ? '#9ca3af' : accent }}>
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
};


// =====================================================================
// 🆕 CmsActivityAddModal
// 運行履歴タイムラインに、記録漏れイベントを後から追加するモーダル
// （CmsActivityEditModal は既存イベントの編集専用のため、追加用に新設）
// =====================================================================


export default CmsActivityEditModal;
