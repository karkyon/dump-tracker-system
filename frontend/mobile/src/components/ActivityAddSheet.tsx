// frontend/mobile/src/components/ActivityAddSheet.tsx
// 🆕 運行履歴詳細画面: 記録漏れイベントを後から追加する全画面シート
// ActivityEditSheet.tsx のスタイル規約に合わせて実装

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

// =====================================================================
// 🆕 MobileLocationPinMap
// 新規地点登録用の簡易地図ピッカー（タップ/ドラッグで位置指定 + 逆ジオコーディング）
// =====================================================================
interface MobileLocationPinMapProps {
  accentColor: string;
  lat?: number;
  lng?: number;
  onPositionChange: (lat: number, lng: number, address?: string) => void;
}

const MobileLocationPinMap: React.FC<MobileLocationPinMapProps> = ({ accentColor, lat, lng, onPositionChange }) => {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const markerRef = React.useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(true);

  const defaultLat = lat ?? 34.6937;
  const defaultLng = lng ?? 135.5023;

  const reverseGeocode = (position: { lat: number; lng: number }) => {
    try {
      const g = (window as any).google;
      if (!g?.maps) { onPositionChange(position.lat, position.lng, undefined); return; }
      const geocoder = new g.maps.Geocoder();
      geocoder.geocode({ location: position }, (results: any, status: string) => {
        if (status === 'OK' && results && results[0]) {
          onPositionChange(position.lat, position.lng, results[0].formatted_address);
        } else {
          onPositionChange(position.lat, position.lng, undefined);
        }
      });
    } catch {
      onPositionChange(position.lat, position.lng, undefined);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) { setAvailable(false); return; }

    const map = new g.maps.Map(mapRef.current, {
      center: { lat: defaultLat, lng: defaultLng },
      zoom: 16,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });
    const marker = new g.maps.Marker({
      position: { lat: defaultLat, lng: defaultLng },
      map,
      draggable: true,
    });
    markerRef.current = marker;

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (!pos) return;
      reverseGeocode({ lat: pos.lat(), lng: pos.lng() });
    });

    map.addListener('click', (e: any) => {
      if (!e.latLng) return;
      marker.setPosition(e.latLng);
      reverseGeocode({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });

    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!available) {
    return (
      <div style={{ fontSize: 11, color: '#9ca3af', padding: '10px', textAlign: 'center', border: '0.5px dashed #d1d5db', borderRadius: 7 }}>
        地図を利用できません。住所欄に直接入力してください
      </div>
    );
  }

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: 180, borderRadius: 7, overflow: 'hidden', background: '#e5e7eb' }} />
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
        {ready ? '📍 地図をタップ、またはピンをドラッグして位置を指定' : '地図を読み込み中...'}
      </div>
    </div>
  );
};

interface ActivityAddSheetProps {
  operationId: string;
  vehicleId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const ADD_EVENT_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'LOADING', label: '積込', color: '#1565C0' },
  { value: 'UNLOADING', label: '荷降', color: '#2E7D32' },
  { value: 'FUELING', label: '給油', color: '#E65100' },
  { value: 'BREAK_START', label: '休憩開始', color: '#6A1B9A' },
  { value: 'BREAK_END', label: '休憩終了', color: '#6A1B9A' },
];

const DEFAULT_EVENT_CFG: { value: string; label: string; color: string } = ADD_EVENT_TYPES[0] ?? { value: 'LOADING', label: '積込', color: '#1565C0' };

const ActivityAddSheet: React.FC<ActivityAddSheetProps> = ({ operationId, vehicleId, onClose, onSaved }) => {
  const [eventType, setEventType] = useState('LOADING');

  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<{ id: string; name: string; address?: string }[]>([]);
  const [locSearching, setLocSearching] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [showNewLocationForm, setShowNewLocationForm] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');

  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [startHHMM, setStartHHMM] = useState('');
  const [endHHMM, setEndHHMM] = useState('');
  const [quantity, setQuantity] = useState('');
  const [fuelAmt, setFuelAmt] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [notes, setNotes] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [saving, setSaving] = useState(false);

  const isLoadOrUnload = eventType === 'LOADING' || eventType === 'UNLOADING';
  const isFuelType = eventType === 'FUELING';
  const isBreakType = eventType === 'BREAK_START' || eventType === 'BREAK_END';
  const cfg = ADD_EVENT_TYPES.find(t => t.value === eventType) ?? DEFAULT_EVENT_CFG;

  useEffect(() => {
    (async () => {
      try {
        const res = await (apiService as any).getItems();
        const arr = res?.data?.items ?? (Array.isArray(res?.data) ? res.data : []);
        setItems(Array.isArray(arr) ? arr : []);
      } catch { /* ignore */ }
    })();
  }, []);

  // 🆕 車両の積載量(capacityTons)を数量の初期値にする
  useEffect(() => {
    if (!vehicleId) return;
    (async () => {
      try {
        const res = await (apiService as any).getVehicleById(vehicleId);
        const v: any = res?.data?.data ?? res?.data ?? res;
        const cap = v?.capacityTons ?? v?.capacity;
        if (cap) setQuantity(prev => prev || String(cap));
      } catch { /* 取得失敗は無視 */ }
    })();
  }, [vehicleId]);

  useEffect(() => {
    if (!locQuery || locQuery.trim().length < 1) { setLocResults([]); return; }
    const t = setTimeout(async () => {
      setLocSearching(true);
      try {
        // 🆕 種別に応じて場所をフィルタ（積込→PICKUP/BOTH、荷降→DELIVERY/BOTH）
        const typeFilter = eventType === 'LOADING' ? ['PICKUP', 'BOTH'] : ['DELIVERY', 'BOTH'];
        const res = await apiService.getLocations({ search: locQuery, limit: 10, locationType: typeFilter } as any);
        const arr: any = res?.data ?? [];
        setLocResults(Array.isArray(arr) ? arr : []);
      } catch { setLocResults([]); }
      finally { setLocSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [locQuery, eventType]);

  const toggleItem = (id: string) =>
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreateLocation = async () => {
    if (!newLocName.trim() || !newLocLat || !newLocLng) {
      toast.error('地点名・地図上の位置は必須です');
      return;
    }
    setSaving(true);
    try {
      const res = await apiService.createQuickLocation({
        name: newLocName.trim(),
        latitude: parseFloat(newLocLat),
        longitude: parseFloat(newLocLng),
        locationType: eventType === 'LOADING' ? 'PICKUP' : 'DELIVERY',
        address: newLocAddress || undefined,
      } as any);
      const created: any = res?.data ?? res;
      if (created?.id) {
        setSelectedLocationId(created.id);
        setSelectedLocationName(created.name || newLocName.trim());
        setShowNewLocationForm(false);
        setLocQuery('');
        setLocResults([]);
      } else {
        toast.error('地点登録に失敗しました');
      }
    } catch {
      toast.error('地点登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const mergeHM = (hhmm: string): string => {
    const now = new Date();
    if (!hhmm) return now.toISOString();
    const parts = hhmm.split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    const jstOff = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOff);
    const y = jstNow.getUTCFullYear();
    const mo = jstNow.getUTCMonth();
    const day = jstNow.getUTCDate();
    const utcMs = Date.UTC(y, mo, day, h, m, 0, 0) - jstOff;
    return new Date(utcMs).toISOString();
  };

  const handleSave = async () => {
    if (!startHHMM) { toast.error('時刻を入力してください'); return; }
    if (isLoadOrUnload && !selectedLocationId) { toast.error('場所を選択してください'); return; }
    setSaving(true);
    try {
      let finalNotes = notes || '';
      if (customItemName.trim()) {
        finalNotes = `品目: ${customItemName.trim()}` + (finalNotes ? ` / ${finalNotes}` : '');
      }
      const payload: Record<string, any> = {
        operationId,
        activityType: eventType,
        actualStartTime: mergeHM(startHHMM),
        quantityTons: 0,
        notes: finalNotes || undefined,
      };
      if (isLoadOrUnload) {
        payload.locationId = selectedLocationId;
        if (endHHMM) payload.actualEndTime = mergeHM(endHHMM);
        if (selectedItemIds.length > 0) {
          payload.itemId = selectedItemIds[0];
          payload.selectedItemIds = selectedItemIds;
        }
        if (quantity) payload.quantityTons = parseFloat(quantity);
      }
      if (isFuelType) {
        if (fuelAmt) payload.quantityTons = parseFloat(fuelAmt);
        if (fuelCost) payload.fuelCostYen = parseFloat(fuelCost);
      }
      const res = await (apiService as any).createOperationDetail(payload);
      if (res?.success || res?.data?.id) {
        toast.success('イベントを追加しました');
        onSaved();
      } else {
        toast.error(res?.message || '保存に失敗しました');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#f3f4f6', border: '0.5px solid #d1d5db',
    borderRadius: 7, padding: '7px 8px', fontSize: 13, color: '#111827',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 3100, display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <div style={{ background: `linear-gradient(135deg, ${cfg.color}dd 0%, ${cfg.color} 100%)`, color: '#fff', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, opacity: .85, cursor: 'pointer', whiteSpace: 'nowrap', color: '#fff' }} onClick={onClose}>← 閉じる</span>
        <span style={{ fontSize: 14, fontWeight: 500, flex: 1, textAlign: 'center', color: '#fff' }}>イベントを追加</span>
      </div>

      {/* 種別選択 */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ADD_EVENT_TYPES.map(t => (
            <div key={t.value} onClick={() => setEventType(t.value)}
              style={{
                padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                background: eventType === t.value ? `${t.color}22` : '#f3f4f6',
                border: `0.5px solid ${eventType === t.value ? t.color : '#d1d5db'}`,
                color: eventType === t.value ? t.color : '#374151',
                fontWeight: eventType === t.value ? 600 : 400,
              }}>
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* フォーム */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>

        {isLoadOrUnload && (
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>場所</div>
            {selectedLocationId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${cfg.color}11`, border: `0.5px solid ${cfg.color}`, borderRadius: 7, padding: '8px 10px' }}>
                <span style={{ fontSize: 13, color: cfg.color }}>{selectedLocationName}</span>
                <span style={{ fontSize: 11, color: cfg.color, textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={() => { setSelectedLocationId(''); setSelectedLocationName(''); }}>変更</span>
              </div>
            ) : (
              <>
                <input type="text" value={locQuery} onChange={e => setLocQuery(e.target.value)}
                  placeholder="現場名・客先名で検索" style={inputStyle} />
                {locSearching && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>検索中...</div>}
                {locResults.length > 0 && (
                  <div style={{ marginTop: 6, border: '0.5px solid #e5e7eb', borderRadius: 7, overflow: 'hidden' }}>
                    {locResults.map(l => (
                      <div key={l.id} onClick={() => { setSelectedLocationId(l.id); setSelectedLocationName(l.name); }}
                        style={{ padding: '8px 10px', borderBottom: '0.5px solid #f3f4f6', cursor: 'pointer' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{l.name}</div>
                        {l.address && <div style={{ fontSize: 11, color: '#9ca3af' }}>{l.address}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {!showNewLocationForm ? (
                  <div onClick={() => setShowNewLocationForm(true)}
                    style={{ marginTop: 6, textAlign: 'center', fontSize: 12, color: cfg.color, border: `0.5px solid ${cfg.color}`, borderRadius: 7, padding: '8px', cursor: 'pointer' }}>
                    + 新規地点を登録
                  </div>
                ) : (
                  <div style={{ marginTop: 6, border: '0.5px solid #e5e7eb', borderRadius: 7, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input type="text" value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="地点名" style={inputStyle} />
                    <MobileLocationPinMap
                      accentColor={cfg.color}
                      lat={newLocLat ? parseFloat(newLocLat) : undefined}
                      lng={newLocLng ? parseFloat(newLocLng) : undefined}
                      onPositionChange={(plat, plng, address) => {
                        setNewLocLat(String(plat));
                        setNewLocLng(String(plng));
                        if (address) setNewLocAddress(address);
                      }}
                    />
                    <input type="text" value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)}
                      placeholder="住所（地図タップで自動入力）" style={inputStyle} />
                    <div onClick={saving ? undefined : handleCreateLocation}
                      style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#fff', background: cfg.color, borderRadius: 7, padding: '8px', cursor: 'pointer', opacity: (!newLocLat || !newLocLng) ? 0.5 : 1 }}>
                      この内容で登録する
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isLoadOrUnload ? '1fr 1fr' : '1fr', gap: 7 }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>{isBreakType ? '時刻' : '到着時刻'}</div>
            <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)} style={inputStyle} />
          </div>
          {isLoadOrUnload && (
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>完了時刻（任意）</div>
              <input type="time" value={endHHMM} onChange={e => setEndHHMM(e.target.value)} style={inputStyle} />
            </div>
          )}
        </div>

        {isLoadOrUnload && (
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>品目</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {items.map(it => (
                <div key={it.id} onClick={() => toggleItem(it.id)}
                  style={{
                    padding: '6px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                    background: selectedItemIds.includes(it.id) ? `${cfg.color}22` : '#f3f4f6',
                    border: `0.5px solid ${selectedItemIds.includes(it.id) ? cfg.color : '#d1d5db'}`,
                    color: selectedItemIds.includes(it.id) ? cfg.color : '#374151',
                  }}>
                  {it.name}
                </div>
              ))}
              <div onClick={() => setShowCustomItem(v => !v)}
                style={{
                  padding: '6px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  background: showCustomItem ? `${cfg.color}22` : '#f3f4f6',
                  border: `0.5px solid ${showCustomItem ? cfg.color : '#d1d5db'}`,
                  color: showCustomItem ? cfg.color : '#374151',
                }}>
                + その他
              </div>
            </div>
            {showCustomItem && (
              <input type="text" value={customItemName} onChange={e => setCustomItemName(e.target.value)}
                placeholder="品目名を入力" style={{ width: '100%', background: '#f3f4f6', border: '0.5px solid #d1d5db', borderRadius: 7, padding: '7px 8px', fontSize: 13, color: '#111827', boxSizing: 'border-box', marginBottom: 6 }} />
            )}
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>数量（t）</div>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} />
          </div>
        )}

        {isFuelType && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>給油量（L）</div>
              <input type="number" value={fuelAmt} onChange={e => setFuelAmt(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>金額（円）</div>
              <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} style={inputStyle} />
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>備考 <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>任意</span></div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* フッター */}
      <div style={{ padding: '10px 12px', borderTop: '0.5px solid #e5e7eb', display: 'flex', gap: 8, flexShrink: 0 }}>
        <div onClick={onClose}
          style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#f3f4f6', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
          キャンセル
        </div>
        <div onClick={saving ? undefined : handleSave}
          style={{ flex: 2, textAlign: 'center', padding: '10px', background: saving ? '#9ca3af' : cfg.color, borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'default' : 'pointer' }}>
          {saving ? '追加中...' : '追加する'}
        </div>
      </div>
    </div>
  );
};

export default ActivityAddSheet;
