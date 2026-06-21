#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_map_feature_v3_frontend.py
=====================================
運行記録マップ機能 実績集計バグ修正 + 機能強化（フロントエンド部分）

backend側の fix_map_feature_v3_backend.py 実行・コンパイル成功後に実行すること。

② OperationsMapView.tsx 全面改修:
   - loadingCount / unloadingCount 対応
   - ピン色: 積込のみ=青、荷降のみ=赤、両方=紫
   - InfoWindow・ランキングで「積込:X回 / 荷降:Y回」を分離表示
   - 初期表示・フィルタ後にランキング1位を地図中央に自動配置

③ LocationManagement.tsx:
   - /locations/usage-stats を追加取得
   - テーブルに「直近30日/90日/1年」の積込・荷降回数列を追加

完了後:
  - backend / frontend/cms / frontend/mobile の3パッケージで tsc --noEmit を実行
  - 全て RC=0 の場合のみ git add/commit/push を実行
  - 本スクリプト自身を自動削除
=====================================
"""
import subprocess
import sys
import os

ROOT = os.path.expanduser("~/projects/dump-tracker")


def patch(filepath, old, new, label):
    full = os.path.join(ROOT, filepath)
    if not os.path.exists(full):
        print(f"❌ [{label}] ファイルが存在しません: {full}")
        sys.exit(1)
    with open(full, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count == 0:
        print(f"❌ [{label}] 置換対象が見つかりません: {filepath}")
        sys.exit(1)
    if count > 1:
        print(f"❌ [{label}] 置換対象が複数({count}件)見つかりました。一意になるよう調整してください: {filepath}")
        sys.exit(1)
    content = content.replace(old, new)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ [{label}] パッチ適用完了: {filepath}")


def overwrite_file(filepath, content, label):
    full = os.path.join(ROOT, filepath)
    if not os.path.exists(full):
        print(f"❌ [{label}] ファイルが存在しません: {full}")
        sys.exit(1)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ [{label}] ファイル上書き完了: {filepath}")


def run(cmd, cwd=None, label=""):
    print(f"\n▶ 実行: {cmd} (cwd={cwd or ROOT})")
    result = subprocess.run(
        cmd, shell=True, cwd=cwd or ROOT,
        capture_output=True, text=True
    )
    print(result.stdout[-4500:] if result.stdout else "")
    if result.returncode != 0:
        print(f"❌ [{label}] 失敗 (RC={result.returncode})")
        print(result.stderr[-4500:] if result.stderr else "")
    else:
        print(f"✅ [{label}] 成功 (RC=0)")
    return result.returncode


# =====================================================================
# ② OperationsMapView.tsx 全面改修（上書き）
# =====================================================================

OPERATIONS_MAP_VIEW_TSX = r"""// frontend/cms/src/components/OperationsMapView.tsx
// 運行記録「実績表示」タブ本体
// 積込・荷降場所をGoogle Maps上にピン表示し、ピンクリックで実績回数（積込/荷降を分けて）表示する。
// 「詳細」ボタン押下で一覧表示タブへ場所名で絞り込みジャンプする（onJumpToList経由）。
// ✅ 修正: 同一場所が積込・荷降の両方で使われるケースに対応（loadingCount/unloadingCountを個別集計）
// ✅ 修正: 初期表示・フィルタ後にランキング1位の場所を地図中央に自動配置
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../utils/api';

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const loadGoogleMapsScript = (callback: () => void): void => {
  if (window.google && window.google.maps) { callback(); return; }
  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    if (window.google && window.google.maps) callback();
    else existingScript.addEventListener('load', callback);
    return;
  }
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    console.warn('[OperationsMapView] Google Maps APIキーが未設定');
    return;
  }
  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker,places&language=ja&region=JP`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  script.onerror = () => console.error('[OperationsMapView] Google Maps API読み込み失敗');
  document.head.appendChild(script);
};

interface LocationMapSummary {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationType: string;
  customerName: string | null;
  loadingCount: number;
  unloadingCount: number;
  operationCount: number;
  lastUsedAt: string | null;
}

interface OperationsMapViewProps {
  /** 「詳細」ボタン押下時: 一覧表示タブへ切替＋場所名で絞り込み */
  onJumpToList: (locationName: string) => void;
}

const PERIOD_OPTIONS = [
  { value: 'ALL', label: '全期間' },
  { value: '30', label: '直近30日' },
  { value: '90', label: '直近90日' },
  { value: 'FY', label: '今年度' }
];

const formatLastUsed = (iso: string | null): string => {
  if (!iso) return '利用実績なし';
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (diffDays <= 0) return `${dateStr}（本日）`;
  return `${dateStr}（${diffDays}日前）`;
};

const buildDateRange = (period: string): { dateFrom?: string; dateTo?: string } => {
  if (period === 'ALL') return {};
  const now = new Date();
  if (period === 'FY') {
    // 4月始まりの年度
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const from = new Date(fyStartYear, 3, 1);
    return { dateFrom: from.toISOString().slice(0, 10) };
  }
  const days = parseInt(period, 10);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom: from.toISOString().slice(0, 10) };
};

/** 場所の活動種別に応じたピン色: 積込のみ=青 / 荷降のみ=赤 / 両方=紫 */
const getPinColor = (loc: LocationMapSummary): string => {
  const hasLoading = loc.loadingCount > 0;
  const hasUnloading = loc.unloadingCount > 0;
  if (hasLoading && hasUnloading) return '#7c3aed'; // 紫: 両方の実績あり
  if (hasUnloading) return '#dc2626'; // 赤: 荷降のみ
  if (hasLoading) return '#2563eb'; // 青: 積込のみ
  // 実績がまだ無い場所はマスタのlocationTypeで仮の色分け
  return loc.locationType === 'DELIVERY' ? '#dc2626' : '#2563eb';
};

const OperationsMapView: React.FC<OperationsMapViewProps> = ({ onJumpToList }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [locations, setLocations] = useState<LocationMapSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PICKUP' | 'DELIVERY'>('ALL');
  const [period, setPeriod] = useState('ALL');

  // ---- Google Maps スクリプト読み込み ----
  useEffect(() => {
    loadGoogleMapsScript(() => setMapsLoaded(true));
  }, []);

  // ---- データ取得 ----
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { dateFrom, dateTo } = buildDateRange(period);
      const params: Record<string, string> = {};
      if (searchText.trim()) params.search = searchText.trim();
      if (typeFilter !== 'ALL') params.locationType = typeFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await apiClient.get('/locations/map-summary', { params });
      if (response.success && response.data) {
        const data: any = response.data;
        const list: LocationMapSummary[] = Array.isArray(data) ? data : (data.data || []);
        setLocations(list);
      } else {
        setLocations([]);
      }
    } catch (err) {
      console.error('[OperationsMapView] サマリー取得エラー:', err);
      setError('場所データの取得に失敗しました');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, period]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ---- 地図初期化 ----
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 34.6937, lng: 135.5023 }, // デフォルト: 大阪近辺
      zoom: 10,
      mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
  }, [mapsLoaded]);

  // ---- InfoWindow表示ヘルパー（ピンクリック・ランキングクリック共通） ----
  const openInfoWindow = useCallback((loc: LocationMapSummary, marker: any) => {
    if (!infoWindowRef.current || !mapInstanceRef.current) return;

    const typeLabel = loc.loadingCount > 0 && loc.unloadingCount > 0
      ? '積込・荷降場所'
      : loc.unloadingCount > 0 ? '荷降場所' : '積込場所';
    const color = getPinColor(loc);
    const typeBg = color === '#dc2626' ? '#fee2e2' : color === '#7c3aed' ? '#ede9fe' : '#dbeafe';
    const typeColor = color === '#dc2626' ? '#b91c1c' : color === '#7c3aed' ? '#5b21b6' : '#1d4ed8';

    const content = document.createElement('div');
    content.style.minWidth = '240px';
    content.style.fontFamily = "'Noto Sans JP', sans-serif";
    content.innerHTML = `
      <div style="font-size:14px;font-weight:800;color:#1e293b;margin-bottom:4px;">${loc.name}</div>
      <span style="display:inline-block;background:${typeBg};color:${typeColor};font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:99px;margin-bottom:8px;">${typeLabel}</span>
      ${loc.customerName ? `<div style="font-size:11.5px;color:#64748b;margin-bottom:6px;">客先: ${loc.customerName}</div>` : ''}
      <div style="display:flex;gap:14px;margin-bottom:6px;">
        <div>
          <div style="font-size:20px;font-weight:900;color:#1d4ed8;">${loc.loadingCount}<span style="font-size:11px;color:#94a3b8;font-weight:600;">回</span></div>
          <div style="font-size:10.5px;color:#64748b;">積込</div>
        </div>
        <div>
          <div style="font-size:20px;font-weight:900;color:#b91c1c;">${loc.unloadingCount}<span style="font-size:11px;color:#94a3b8;font-weight:600;">回</span></div>
          <div style="font-size:10.5px;color:#64748b;">荷降</div>
        </div>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;line-height:1.6;">
        📍 ${loc.address}<br/>
        🕐 最終利用: ${formatLastUsed(loc.lastUsedAt)}
      </div>
      <button id="jump-btn-${loc.id}" style="width:100%;background:#1e293b;color:white;border:none;border-radius:6px;padding:7px 0;font-size:12.5px;font-weight:700;cursor:pointer;">
        📋 詳細（運行記録に絞り込み）
      </button>
    `;

    infoWindowRef.current.setContent(content);
    infoWindowRef.current.open(mapInstanceRef.current, marker);

    window.google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
      const btn = document.getElementById(`jump-btn-${loc.id}`);
      if (btn) {
        btn.addEventListener('click', () => onJumpToList(loc.name));
      }
    });
  }, [onJumpToList]);

  // ---- ピン描画 ----
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;

    // 既存マーカーを削除
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];

    const withCoords = locations.filter(l => l.latitude != null && l.longitude != null);
    if (withCoords.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    withCoords.forEach(loc => {
      const color = getPinColor(loc);
      const pinSvg = {
        path: 'M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z',
        fillColor: color,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 1.2,
        scale: 1,
        anchor: new window.google.maps.Point(13, 34)
      };

      const marker = new window.google.maps.Marker({
        position: { lat: loc.latitude as number, lng: loc.longitude as number },
        map: mapInstanceRef.current,
        title: loc.name,
        icon: pinSvg
      });

      marker.addListener('click', () => openInfoWindow(loc, marker));

      markersRef.current.push(marker);
      bounds.extend(marker.getPosition());
    });

    if (withCoords.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 60);
    } else if (withCoords.length === 1) {
      mapInstanceRef.current.setCenter(bounds.getCenter());
      mapInstanceRef.current.setZoom(14);
    }
  }, [locations, mapsLoaded, openInfoWindow]);

  // ---- 実績ランキング（上位10件、合計回数の多い順） ----
  const ranking = [...locations]
    .filter(l => l.operationCount > 0)
    .sort((a, b) => b.operationCount - a.operationCount)
    .slice(0, 10);

  // ✅ 初期表示・フィルタ後: ランキング1位の場所を地図中央に自動配置
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;
    if (ranking.length === 0) return;
    const top = ranking[0];
    if (top.latitude == null || top.longitude == null) return;

    mapInstanceRef.current.panTo({ lat: top.latitude, lng: top.longitude });
    mapInstanceRef.current.setZoom(14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, mapsLoaded]);

  const handlePanTo = (loc: LocationMapSummary) => {
    if (!mapInstanceRef.current || loc.latitude == null || loc.longitude == null) return;
    mapInstanceRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
    mapInstanceRef.current.setZoom(15);
    const marker = markersRef.current.find(
      m => m.getPosition().lat() === loc.latitude && m.getPosition().lng() === loc.longitude
    );
    if (marker) {
      openInfoWindow(loc, marker);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-b-lg rounded-tr-lg p-4">
      {/* 検索・フィルターエリア */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">🔍 場所・客先名で検索</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="場所名・客先名を入力..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">場所種別</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'PICKUP' | 'DELIVERY')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="ALL">すべて（積込・荷降）</option>
              <option value="PICKUP">積込のみ</option>
              <option value="DELIVERY">荷降のみ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">実績集計期間</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchSummary}
            className="bg-gray-900 text-white rounded-md px-4 py-2 text-sm font-semibold"
          >
            検索
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* 地図エリア */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-bold text-gray-800">
              📍 場所ピン表示（{locations.length}件{loading ? ' / 読込中...' : ''}）
            </div>
            <div className="flex items-center gap-3 text-[10.5px] text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#2563eb' }} />積込のみ</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#dc2626' }} />荷降のみ</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#7c3aed' }} />両方</span>
            </div>
          </div>
          <div ref={mapRef} style={{ width: '100%', height: '560px', borderRadius: '10px', background: '#e2e8f0' }} />
        </div>

        {/* 実績ランキングパネル */}
        <div>
          <div className="text-sm font-bold text-gray-800 mb-2">📊 実績回数ランキング</div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            {ranking.length === 0 ? (
              <div className="text-xs text-gray-400 p-4 text-center">実績データがありません</div>
            ) : (
              ranking.map((loc, idx) => (
                <div
                  key={loc.id}
                  onClick={() => handlePanTo(loc)}
                  className={`flex justify-between items-center px-3 py-2.5 cursor-pointer hover:bg-blue-50 ${idx !== ranking.length - 1 ? 'border-b border-gray-200' : ''} ${idx === 0 ? 'bg-amber-50' : ''}`}
                >
                  <div>
                    <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      {idx === 0 && <span title="現在の地図中央">📍</span>}
                      {loc.name}
                    </div>
                    <div className="flex gap-2 mt-0.5">
                      {loc.loadingCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          積込 {loc.loadingCount}
                        </span>
                      )}
                      {loc.unloadingCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          荷降 {loc.unloadingCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-base font-extrabold text-green-700">
                    {loc.operationCount}<span className="text-[10px] text-gray-400 font-semibold">回</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
            💡 ランキング1位（📍）の場所を地図中央に表示しています。ランキングは現在の検索・フィルター条件と連動します
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsMapView;
"""


# =====================================================================
# ③ LocationManagement.tsx に実績統計列を追加
# =====================================================================

LM_IMPORT_OLD = """import LocationFormModal from '../components/location/LocationFormModal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';"""

LM_IMPORT_NEW = """import LocationFormModal from '../components/location/LocationFormModal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';
import { apiClient } from '../utils/api';"""

LM_STATE_OLD = """  // ✅ ソート状態
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');"""

LM_STATE_NEW = """  // ✅ ソート状態
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ✅ 実績統計（直近30日/90日/1年の積込・荷降回数）: locationId をキーにしたマップ
  interface UsageStat { loading: number; unloading: number; }
  interface LocationUsageStats { last30Days: UsageStat; last90Days: UsageStat; last365Days: UsageStat; }
  const [usageStatsMap, setUsageStatsMap] = useState<Record<string, LocationUsageStats>>({});
  const [usageStatsLoading, setUsageStatsLoading] = useState(false);

  const fetchUsageStats = React.useCallback(async () => {
    setUsageStatsLoading(true);
    try {
      const response = await apiClient.get('/locations/usage-stats');
      if (response.success && response.data) {
        const data: any = response.data;
        const list: Array<{ locationId: string } & LocationUsageStats> = Array.isArray(data) ? data : (data.data || []);
        const map: Record<string, LocationUsageStats> = {};
        list.forEach(item => {
          map[item.locationId] = {
            last30Days: item.last30Days,
            last90Days: item.last90Days,
            last365Days: item.last365Days
          };
        });
        setUsageStatsMap(map);
      }
    } catch (err) {
      console.error('[LocationManagement] 実績統計取得エラー:', err);
    } finally {
      setUsageStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsageStats();
  }, [fetchUsageStats]);"""

LM_COLUMNS_OLD = """    {
      key: 'locationType',
      header: '場所種別',
      width: '96px',
      render: (value: string) => {
        const config: Record<string, { label: string; className: string }> = {
          PICKUP:      { label: '積込',      className: 'bg-blue-100 text-blue-800' },
          DEPOT:       { label: '積込',      className: 'bg-blue-100 text-blue-800' },
          DELIVERY:    { label: '積降',      className: 'bg-green-100 text-green-800' },
          DESTINATION: { label: '積降',      className: 'bg-green-100 text-green-800' },
          BOTH:        { label: '積込・積降', className: 'bg-purple-100 text-purple-800' },
        };
        const c = config[value] ??"""

LM_COLUMNS_NEW = """    {
      key: 'usageStats',
      header: '積込/荷降実績',
      width: '230px',
      render: (_value: string, row: any) => {
        const stats = usageStatsMap[row.id];
        if (usageStatsLoading && !stats) {
          return <span className="text-xs text-gray-400">読込中...</span>;
        }
        if (!stats) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        const Cell = ({ label, s }: { label: string; s: UsageStat }) => (
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-gray-500 w-9">{label}</span>
            <span className="font-bold text-blue-700">積{s.loading}</span>
            <span className="font-bold text-red-700">荷{s.unloading}</span>
          </div>
        );
        return (
          <div className="space-y-0.5">
            <Cell label="30日" s={stats.last30Days} />
            <Cell label="90日" s={stats.last90Days} />
            <Cell label="1年" s={stats.last365Days} />
          </div>
        );
      },
    },
    {
      key: 'locationType',
      header: '場所種別',
      width: '96px',
      render: (value: string) => {
        const config: Record<string, { label: string; className: string }> = {
          PICKUP:      { label: '積込',      className: 'bg-blue-100 text-blue-800' },
          DEPOT:       { label: '積込',      className: 'bg-blue-100 text-blue-800' },
          DELIVERY:    { label: '積降',      className: 'bg-green-100 text-green-800' },
          DESTINATION: { label: '積降',      className: 'bg-green-100 text-green-800' },
          BOTH:        { label: '積込・積降', className: 'bg-purple-100 text-purple-800' },
        };
        const c = config[value] ??"""


def main():
    print("=" * 70)
    print("運行記録マップ機能 実績集計修正 + 実績表示強化スクリプト（フロント） 開始")
    print("=" * 70)

    # ② OperationsMapView.tsx 全面上書き
    overwrite_file(
        "frontend/cms/src/components/OperationsMapView.tsx",
        OPERATIONS_MAP_VIEW_TSX,
        "OperationsMapView.tsx 全面改修（loadingCount/unloadingCount対応）"
    )

    # ③ LocationManagement.tsx 実績統計列追加
    patch(
        "frontend/cms/src/pages/LocationManagement.tsx",
        LM_IMPORT_OLD,
        LM_IMPORT_NEW,
        "LocationManagement.tsx: apiClient import追加"
    )
    patch(
        "frontend/cms/src/pages/LocationManagement.tsx",
        LM_STATE_OLD,
        LM_STATE_NEW,
        "LocationManagement.tsx: 実績統計state・fetch追加"
    )
    patch(
        "frontend/cms/src/pages/LocationManagement.tsx",
        LM_COLUMNS_OLD,
        LM_COLUMNS_NEW,
        "LocationManagement.tsx: 積込/荷降実績列追加"
    )

    print("\n" + "=" * 70)
    print("パッチ適用完了。TypeScriptコンパイルチェックを実行します。")
    print("=" * 70)

    rc_backend = run(
        "./node_modules/.bin/tsc --noEmit",
        cwd=os.path.join(ROOT, "backend"),
        label="backend tsc"
    )
    rc_cms = run(
        "npx tsc --noEmit",
        cwd=os.path.join(ROOT, "frontend/cms"),
        label="frontend/cms tsc"
    )
    rc_mobile = run(
        "npx tsc --noEmit",
        cwd=os.path.join(ROOT, "frontend/mobile"),
        label="frontend/mobile tsc"
    )

    print("\n" + "=" * 70)
    print(f"コンパイル結果: backend={rc_backend} / cms={rc_cms} / mobile={rc_mobile}")
    print("=" * 70)

    if rc_backend == 0 and rc_cms == 0 and rc_mobile == 0:
        print("\n✅ 全パッケージ コンパイルエラー0件。GitHubへPushします。")
        run("git add -A", label="git add")
        commit_msg = (
            "fix: 場所別実績集計の精度向上 + 実績表示機能強化\\n\\n"
            "- fix: getLocationsMapSummary を全面改修。activityType（LOADING/UNLOADING）で\\n"
            "  集計を分離し、同一場所が積込・荷降の両方で使われるケースで実績が欠落するバグを解消\\n"
            "- fix: search対象から address を除外し、地名の偶然一致による過剰ヒットを解消\\n"
            "  （客先名での検索は operationDetails 経由で対応）\\n"
            "- feat: OperationsMapView.tsx でピン色を 積込のみ=青/荷降のみ=赤/両方=紫 に変更\\n"
            "- feat: InfoWindow・ランキングで積込/荷降回数を分離表示\\n"
            "- feat: 初期表示・フィルタ後にランキング1位の場所を地図中央へ自動配置\\n"
            "- feat: getLocationsUsageStats 新規追加（直近30/90/365日の積込・荷降回数）\\n"
            "- feat: LocationManagement.tsx（積込・積卸場所マスタ一覧）に\\n"
            "  直近30日/90日/1年の積込・荷降実績列を追加"
        )
        run(f'git commit -m "{commit_msg}"', label="git commit")
        rc_push = run("git push", label="git push")
        if rc_push == 0:
            print("\n✅✅✅ GitHubへのPushが完了しました。")
        else:
            print("\n⚠️ git push に失敗しました。手動で確認してください。")
    else:
        print("\n❌❌❌ コンパイルエラーが残っています。GitHubへはPushしません。")
        print("上記のtscエラー出力を確認し、修正が必要です。")

    self_path = os.path.abspath(__file__)
    try:
        os.remove(self_path)
        print(f"\n🗑 スクリプト自身を削除しました: {self_path}")
    except Exception as e:
        print(f"\n⚠️ スクリプト自身の削除に失敗: {e}")


if __name__ == "__main__":
    main()
