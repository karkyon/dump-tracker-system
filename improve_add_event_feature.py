#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
イベント追加機能 改善パッチ（第3弾）
- 場所検索を種別(積込/荷降)でフィルタ
- CMS: 新規地点登録を LocationMapPicker（クリック/ダブルクリック/ドラッグ + 逆ジオコーディング）に変更
- モバイル: 新規地点登録を MobileLocationPinMap（タップ/ドラッグ + 逆ジオコーディング）に変更
- 品目の手入力（その他）を追加
- 数量(トン数)の初期値を車両のcapacityTonsから自動設定

実行場所: ~/projects/dump-tracker/ (リポジトリルート)
  $ cd ~/projects/dump-tracker
  $ python3 improve_add_event_feature.py
"""

import os
import subprocess
import sys

ROOT = os.getcwd()

def fail(msg):
    print(f"❌ {msg}")
    sys.exit(1)

def read(path):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        fail(f"ファイルが見つかりません: {path}")
    with open(full, "r", encoding="utf-8") as f:
        return f.read()

def write(path, content):
    full = os.path.join(ROOT, path)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)

def patch(path, old, new, desc):
    content = read(path)
    count = content.count(old)
    if count == 0:
        fail(f"アンカー文字列が見つかりません [{desc}] in {path}\n"
             f"--- 期待した文字列 ---\n{old}\n----------------------")
    if count > 1:
        fail(f"アンカー文字列が複数箇所に一致しました（{count}箇所）[{desc}] in {path}")
    content = content.replace(old, new, 1)
    write(path, content)
    print(f"✅ {desc}")


CMS_FILE = "frontend/cms/src/components/OperationDetailDialog.tsx"
MOBILE_SHEET = "frontend/mobile/src/components/ActivityAddSheet.tsx"
MOBILE_HISTORY = "frontend/mobile/src/pages/OperationHistoryDetail.tsx"

print("==================================================")
print(" イベント追加機能 改善パッチ適用開始")
print("==================================================")

# =====================================================================
# CMS: OperationDetailDialog.tsx
# =====================================================================

# 1. LocationMapPicker をimport
patch(
    CMS_FILE,
    "import { apiClient } from '../utils/api';",
    "import { apiClient } from '../utils/api';\nimport LocationMapPicker from './maps/LocationMapPicker';",
    "CMS: LocationMapPicker import追加"
)

# 2. CmsActivityAddModalProps に vehicleId / mapsLoaded を追加
patch(
    CMS_FILE,
    """interface CmsActivityAddModalProps {
  operationId: string;
  items: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}""",
    """interface CmsActivityAddModalProps {
  operationId: string;
  items: { id: string; name: string }[];
  vehicleId?: string;
  mapsLoaded?: boolean;
  onClose: () => void;
  onSaved: () => void;
}""",
    "CMS: CmsActivityAddModalProps に vehicleId/mapsLoaded 追加"
)

# 3. コンポーネント引数に vehicleId / mapsLoaded を追加
patch(
    CMS_FILE,
    "const CmsActivityAddModal: React.FC<CmsActivityAddModalProps> = ({ operationId, items, onClose, onSaved }) => {",
    "const CmsActivityAddModal: React.FC<CmsActivityAddModalProps> = ({ operationId, items, vehicleId, mapsLoaded, onClose, onSaved }) => {",
    "CMS: コンポーネント引数に vehicleId/mapsLoaded 追加"
)

# 4. 手入力品目用stateを追加
patch(
    CMS_FILE,
    """  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);""",
    """  const [notes, setNotes] = React.useState('');
  const [customItemName, setCustomItemName] = React.useState('');
  const [showCustomItem, setShowCustomItem] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);""",
    "CMS: customItemName/showCustomItem state追加"
)

# 5. 地点検索に locationType フィルタを追加
patch(
    CMS_FILE,
    """  React.useEffect(() => {
    if (!locQuery || locQuery.trim().length < 1) { setLocResults([]); return; }
    const t = setTimeout(async () => {
      setLocSearching(true);
      try {
        const res = await apiClient.get('/locations', { params: { search: locQuery, limit: 10 } });
        const d: any = res;
        const arr = d?.data?.data ?? d?.data ?? [];
        setLocResults(Array.isArray(arr) ? arr : []);
      } catch { setLocResults([]); }
      finally { setLocSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [locQuery]);""",
    """  React.useEffect(() => {
    if (!locQuery || locQuery.trim().length < 1) { setLocResults([]); return; }
    const t = setTimeout(async () => {
      setLocSearching(true);
      try {
        // 🆕 種別に応じて場所をフィルタ（積込→PICKUP/BOTH、荷降→DELIVERY/BOTH）
        const typeFilter = eventType === 'LOADING' ? ['PICKUP', 'BOTH'] : ['DELIVERY', 'BOTH'];
        const res = await apiClient.get('/locations', { params: { search: locQuery, limit: 10, locationType: typeFilter } });
        const d: any = res;
        const arr = d?.data?.data ?? d?.data ?? [];
        setLocResults(Array.isArray(arr) ? arr : []);
      } catch { setLocResults([]); }
      finally { setLocSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [locQuery, eventType]);""",
    "CMS: 地点検索に種別フィルタ追加"
)

# 6. 車両のcapacityTonsを取得して数量デフォルトにする useEffect を追加
patch(
    CMS_FILE,
    """  const toggleItem = (id: string) =>
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);""",
    """  // 🆕 車両の積載量(capacityTons)を数量の初期値にする
  React.useEffect(() => {
    if (!vehicleId) return;
    (async () => {
      try {
        const res = await apiClient.get(`/vehicles/${vehicleId}`);
        const d: any = res;
        const v = d?.data?.data ?? d?.data ?? d;
        const cap = v?.capacityTons ?? v?.capacity;
        if (cap) setQuantity(prev => prev || String(cap));
      } catch { /* 取得失敗は無視（手入力で対応） */ }
    })();
  }, [vehicleId]);

  const toggleItem = (id: string) =>
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);""",
    "CMS: 車両capacityTonsから数量デフォルト取得"
)

# 7. 品目チップに「+ その他（手入力）」を追加
patch(
    CMS_FILE,
    """              <div className="flex gap-2 flex-wrap mb-2">
                {items.map(it => (
                  <button key={it.id} type="button" onClick={() => toggleItem(it.id)}
                    className="px-3 py-1.5 rounded-lg text-sm border"
                    style={{
                      background: selectedItemIds.includes(it.id) ? '#eff6ff' : '#fff',
                      borderColor: selectedItemIds.includes(it.id) ? '#3b82f6' : '#e5e7eb',
                      color: selectedItemIds.includes(it.id) ? '#1d4ed8' : '#374151',
                    }}>
                    {it.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">数量</p>""",
    """              <div className="flex gap-2 flex-wrap mb-2">
                {items.map(it => (
                  <button key={it.id} type="button" onClick={() => toggleItem(it.id)}
                    className="px-3 py-1.5 rounded-lg text-sm border"
                    style={{
                      background: selectedItemIds.includes(it.id) ? '#eff6ff' : '#fff',
                      borderColor: selectedItemIds.includes(it.id) ? '#3b82f6' : '#e5e7eb',
                      color: selectedItemIds.includes(it.id) ? '#1d4ed8' : '#374151',
                    }}>
                    {it.name}
                  </button>
                ))}
                <button type="button" onClick={() => setShowCustomItem(v => !v)}
                  className="px-3 py-1.5 rounded-lg text-sm border"
                  style={{
                    background: showCustomItem ? '#eff6ff' : '#fff',
                    borderColor: showCustomItem ? '#3b82f6' : '#e5e7eb',
                    color: showCustomItem ? '#1d4ed8' : '#374151',
                  }}>
                  + その他（手入力）
                </button>
              </div>
              {showCustomItem && (
                <input type="text" value={customItemName} onChange={e => setCustomItemName(e.target.value)}
                  placeholder="品目名を入力" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
              )}
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">数量</p>""",
    "CMS: 品目「+ その他（手入力）」追加"
)

# 8. handleSave: customItemNameをnotesにマージ
patch(
    CMS_FILE,
    """  const handleSave = async () => {
    setSaveError(null);
    if (!startHHMM) { setSaveError('時刻を入力してください'); return; }
    if (isLoadOrUnload && !selectedLocationId) { setSaveError('場所を選択してください'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        operationId,
        activityType: eventType,
        actualStartTime: mergeHM(startHHMM),
        quantityTons: 0,
        notes: notes || undefined,
      };""",
    """  const handleSave = async () => {
    setSaveError(null);
    if (!startHHMM) { setSaveError('時刻を入力してください'); return; }
    if (isLoadOrUnload && !selectedLocationId) { setSaveError('場所を選択してください'); return; }
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
      };""",
    "CMS: handleSaveでcustomItemNameをnotesにマージ"
)

# 9. 新規地点登録フォーム: 緯度経度の手入力を LocationMapPicker に置き換え
patch(
    CMS_FILE,
    """                  {!showNewLocationForm ? (
                    <button type="button" onClick={() => setShowNewLocationForm(true)}
                      className="w-full text-sm text-blue-600 border border-blue-300 rounded-lg py-2 hover:bg-blue-50">
                      + 新規地点を登録
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <input type="text" value={newLocName} onChange={e => setNewLocName(e.target.value)}
                        placeholder="地点名" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                      <input type="text" value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)}
                        placeholder="住所（任意）" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={newLocLat} onChange={e => setNewLocLat(e.target.value)}
                          placeholder="緯度" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                        <input type="text" value={newLocLng} onChange={e => setNewLocLng(e.target.value)}
                          placeholder="経度" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                      </div>
                      <p className="text-xs text-gray-400">Googleマップでピンを長押しすると緯度経度をコピーできます</p>
                      <button type="button" onClick={handleCreateLocation} disabled={saving}
                        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                        この内容で登録する
                      </button>
                    </div>
                  )}""",
    """                  {!showNewLocationForm ? (
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
                  )}""",
    "CMS: 新規地点登録を地図ピッカーに変更（クリック/ダブルクリック/ドラッグ+逆ジオコーディング）"
)

# 10. レンダー呼び出しに vehicleId / mapsLoaded を渡す
patch(
    CMS_FILE,
    """    {/* 🆕 イベント追加モーダル */}
    {addEventOpen && (
      <CmsActivityAddModal
        operationId={operationId}
        items={editItems}
        onClose={() => setAddEventOpen(false)}
        onSaved={() => {
          setAddEventOpen(false);
          fetchIntegratedTimeline(operationId);
        }}
      />
    )}""",
    """    {/* 🆕 イベント追加モーダル */}
    {addEventOpen && (
      <CmsActivityAddModal
        operationId={operationId}
        items={editItems}
        vehicleId={operation?.vehicleId}
        mapsLoaded={mapsLoaded}
        onClose={() => setAddEventOpen(false)}
        onSaved={() => {
          setAddEventOpen(false);
          fetchIntegratedTimeline(operationId);
        }}
      />
    )}""",
    "CMS: CmsActivityAddModalにvehicleId/mapsLoadedを渡す"
)

# =====================================================================
# モバイル: ActivityAddSheet.tsx
# =====================================================================

# 1. MobileLocationPinMap コンポーネントを新設（imports直後）
MOBILE_PIN_MAP = """
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

"""

patch(
    MOBILE_SHEET,
    """import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

interface ActivityAddSheetProps {""",
    """import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
""" + MOBILE_PIN_MAP + """interface ActivityAddSheetProps {""",
    "mobile: MobileLocationPinMap コンポーネント追加"
)

# 2. props に vehicleId を追加
patch(
    MOBILE_SHEET,
    """interface ActivityAddSheetProps {
  operationId: string;
  onClose: () => void;
  onSaved: () => void;
}""",
    """interface ActivityAddSheetProps {
  operationId: string;
  vehicleId?: string;
  onClose: () => void;
  onSaved: () => void;
}""",
    "mobile: ActivityAddSheetProps に vehicleId 追加"
)

# 3. コンポーネント引数に vehicleId 追加
patch(
    MOBILE_SHEET,
    "const ActivityAddSheet: React.FC<ActivityAddSheetProps> = ({ operationId, onClose, onSaved }) => {",
    "const ActivityAddSheet: React.FC<ActivityAddSheetProps> = ({ operationId, vehicleId, onClose, onSaved }) => {",
    "mobile: コンポーネント引数に vehicleId 追加"
)

# 4. newLocAddress state を追加
patch(
    MOBILE_SHEET,
    """  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');""",
    """  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');""",
    "mobile: newLocAddress state追加"
)

# 5. customItemName state を追加
patch(
    MOBILE_SHEET,
    """  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);""",
    """  const [notes, setNotes] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [saving, setSaving] = useState(false);""",
    "mobile: customItemName/showCustomItem state追加"
)

# 6. 地点検索に locationType フィルタを追加
patch(
    MOBILE_SHEET,
    """  useEffect(() => {
    if (!locQuery || locQuery.trim().length < 1) { setLocResults([]); return; }
    const t = setTimeout(async () => {
      setLocSearching(true);
      try {
        const res = await apiService.getLocations({ search: locQuery, limit: 10 });
        const arr: any = res?.data ?? [];
        setLocResults(Array.isArray(arr) ? arr : []);
      } catch { setLocResults([]); }
      finally { setLocSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [locQuery]);""",
    """  useEffect(() => {
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
  }, [locQuery, eventType]);""",
    "mobile: 地点検索に種別フィルタ追加"
)

# 7. 車両capacityTonsから数量デフォルトを取得
patch(
    MOBILE_SHEET,
    """  useEffect(() => {
    (async () => {
      try {
        const res = await (apiService as any).getItems();
        const arr = res?.data?.items ?? (Array.isArray(res?.data) ? res.data : []);
        setItems(Array.isArray(arr) ? arr : []);
      } catch { /* ignore */ }
    })();
  }, []);""",
    """  useEffect(() => {
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
  }, [vehicleId]);""",
    "mobile: 車両capacityTonsから数量デフォルト取得"
)

# 8. 品目チップに「+ その他」を追加
patch(
    MOBILE_SHEET,
    """            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
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
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>数量（t）</div>""",
    """            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
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
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>数量（t）</div>""",
    "mobile: 品目「+ その他」追加"
)

# 9. handleSave: customItemNameをnotesにマージ
patch(
    MOBILE_SHEET,
    """  const handleSave = async () => {
    if (!startHHMM) { toast.error('時刻を入力してください'); return; }
    if (isLoadOrUnload && !selectedLocationId) { toast.error('場所を選択してください'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        operationId,
        activityType: eventType,
        actualStartTime: mergeHM(startHHMM),
        quantityTons: 0,
        notes: notes || undefined,
      };""",
    """  const handleSave = async () => {
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
      };""",
    "mobile: handleSaveでcustomItemNameをnotesにマージ"
)

# 10. 新規地点登録: 緯度経度の手入力を MobileLocationPinMap に置き換え
patch(
    MOBILE_SHEET,
    """                {!showNewLocationForm ? (
                  <div onClick={() => setShowNewLocationForm(true)}
                    style={{ marginTop: 6, textAlign: 'center', fontSize: 12, color: cfg.color, border: `0.5px solid ${cfg.color}`, borderRadius: 7, padding: '8px', cursor: 'pointer' }}>
                    + 新規地点を登録
                  </div>
                ) : (
                  <div style={{ marginTop: 6, border: '0.5px solid #e5e7eb', borderRadius: 7, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input type="text" value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="地点名" style={inputStyle} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="text" value={newLocLat} onChange={e => setNewLocLat(e.target.value)} placeholder="緯度" style={inputStyle} />
                      <input type="text" value={newLocLng} onChange={e => setNewLocLng(e.target.value)} placeholder="経度" style={inputStyle} />
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>地図appでピンを長押しすると緯度経度をコピーできます</div>
                    <div onClick={handleCreateLocation}
                      style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#fff', background: cfg.color, borderRadius: 7, padding: '8px', cursor: 'pointer' }}>
                      この内容で登録する
                    </div>
                  </div>
                )}""",
    """                {!showNewLocationForm ? (
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
                )}""",
    "mobile: 新規地点登録を地図ピッカーに変更（タップ/ドラッグ+逆ジオコーディング）"
)

# 11. handleCreateLocation: address を含めて送信
patch(
    MOBILE_SHEET,
    """  const handleCreateLocation = async () => {
    if (!newLocName.trim() || !newLocLat || !newLocLng) {
      toast.error('地点名・緯度・経度は必須です');
      return;
    }
    setSaving(true);
    try {
      const res = await apiService.createQuickLocation({
        name: newLocName.trim(),
        latitude: parseFloat(newLocLat),
        longitude: parseFloat(newLocLng),
        locationType: eventType === 'LOADING' ? 'PICKUP' : 'DELIVERY',
      });
      const created: any = res?.data ?? res;""",
    """  const handleCreateLocation = async () => {
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
      const created: any = res?.data ?? res;""",
    "mobile: handleCreateLocationで住所も送信"
)

# =====================================================================
# モバイル: OperationHistoryDetail.tsx
#   ActivityAddSheet に vehicleId を渡す
# =====================================================================

patch(
    MOBILE_HISTORY,
    """      {addEventOpen && (
        <ActivityAddSheet
          operationId={id || ''}
          onClose={() => setAddEventOpen(false)}
          onSaved={() => {
            setAddEventOpen(false);
            fetchDetail();
          }}
        />
      )}""",
    """      {addEventOpen && (
        <ActivityAddSheet
          operationId={id || ''}
          vehicleId={detail.vehicle?.id}
          onClose={() => setAddEventOpen(false)}
          onSaved={() => {
            setAddEventOpen(false);
            fetchDetail();
          }}
        />
      )}""",
    "mobile OperationHistoryDetail: ActivityAddSheetにvehicleIdを渡す"
)

print("")
print("==================================================")
print(" パッチ適用完了。3プロジェクトをコンパイル確認します")
print("==================================================")

def run_tsc(subdir, label):
    cwd = os.path.join(ROOT, subdir)
    if not os.path.isdir(cwd):
        fail(f"ディレクトリが見つかりません: {subdir}")
    tsc_bin = os.path.join(cwd, "node_modules", ".bin", "tsc")
    if not os.path.exists(tsc_bin):
        fail(f"tsc が見つかりません: {tsc_bin}")
    print(f"--- {label} (tsc --noEmit) ---")
    result = subprocess.run([tsc_bin, "--noEmit"], cwd=cwd, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr)
    return result.returncode

rc_backend = run_tsc("backend", "backend")
rc_cms = run_tsc("frontend/cms", "frontend/cms")
rc_mobile = run_tsc("frontend/mobile", "frontend/mobile")

print("")
print(f"backend       RC={rc_backend}")
print(f"frontend/cms  RC={rc_cms}")
print(f"frontend/mobile RC={rc_mobile}")

if rc_backend == 0 and rc_cms == 0 and rc_mobile == 0:
    print("")
    print("✅ 3プロジェクトすべてコンパイルエラー0件。git push を実行します。")
    subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True)
    commit_msg = "feat: イベント追加機能を改善（種別フィルタ・地図ピッカー・手入力品目・数量デフォルト）"
    commit_result = subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT)
    if commit_result.returncode != 0:
        print("⚠️ git commit に失敗しました（差分なし、または他の要因）。push はスキップします。")
    else:
        push_result = subprocess.run(["git", "push"], cwd=ROOT)
        if push_result.returncode == 0:
            print("✅ git push 完了")
        else:
            fail("git push に失敗しました。手動で確認してください（コミットは作成済みです）")
else:
    print("")
    print("❌ コンパイルエラーが残っているため push しません。")
    print("   エラー内容をそのまま共有してもらえれば、すぐに直します。")

try:
    os.remove(__file__)
    print("")
    print("🗑️  パッチスクリプト自身を削除しました")
except Exception as e:
    print(f"⚠️ スクリプトの自己削除に失敗: {e}")
