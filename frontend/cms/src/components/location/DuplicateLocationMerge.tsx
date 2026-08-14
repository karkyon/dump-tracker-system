// frontend/cms/src/components/location/DuplicateLocationMerge.tsx
// 🆕 重複場所メンテナンス機能
// - 起点となる場所を選び、半径スライダー（離脱検知設定と同系統のUI）で
//   近隣の場所候補を検索し、選択した候補を起点の場所へ統合する。
// - 統合実行時は、統合元に紐づく運行記録(operation_details.locationId)を
//   統合先へ一括で付け替え、統合元は論理削除（isActive=false）される。

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, AlertTriangle, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { apiClient, locationAPI } from '../../utils/api';

interface DuplicateLocationMergeProps {
  isOpen: boolean;
  onClose: () => void;
  onMerged: () => void;
}

interface UsageStat { loading: number; unloading: number; }
interface LocationUsageStats { last30Days: UsageStat; last90Days: UsageStat; last365Days: UsageStat; }

interface NearbyCandidate {
  location: any;
  distanceM: number | null; // null = 座標が無いため住所完全一致で検出した候補
}

const isMobileRegistered = (loc: any): boolean => {
  const sp = loc?.specialInstructions || loc?.special_instructions || '';
  const lt = loc?.locationType;
  return sp.includes('モバイル') || sp.includes('アプリ') || sp.includes('クイック') || lt === 'DEPOT' || lt === 'DESTINATION';
};

// ✅ 追加: 住所文字列の正規化（空白除去のみの軽量比較。全角/半角スペース差異を吸収）
const normalizeAddress = (addr?: string | null): string => {
  if (!addr) return '';
  return addr.replace(/[\s　]+/g, '').trim();
};

const DuplicateLocationMerge: React.FC<DuplicateLocationMergeProps> = ({ isOpen, onClose, onMerged }) => {
  const [baseQuery, setBaseQuery] = useState('');
  const [baseCandidates, setBaseCandidates] = useState<any[]>([]);
  const [baseSearching, setBaseSearching] = useState(false);
  const [baseLocation, setBaseLocation] = useState<any | null>(null);

  const [radiusM, setRadiusM] = useState(100);
  const [nearbyCandidates, setNearbyCandidates] = useState<NearbyCandidate[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [usageStatsMap, setUsageStatsMap] = useState<Record<string, LocationUsageStats>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  const baseSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearbyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsageStats = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/locations/usage-stats');
      const raw: any = res?.data;
      // ✅ 修正: レスポンスが { success, data: [...] } のまま渡ってくる場合と、
      //    二重ネスト { success, data: { success, data: [...] } } になる場合の
      //    両方に対応（masterStore.ts の "パターン2" と同じ防御的アンラップ）
      const list: Array<{ locationId: string } & LocationUsageStats> = Array.isArray(raw)
        ? raw
        : (Array.isArray(raw?.data) ? raw.data : []);
      const map: Record<string, LocationUsageStats> = {};
      list.forEach((item) => { map[item.locationId] = item; });
      setUsageStatsMap(map);
    } catch (e) {
      console.warn('実績統計の取得に失敗しました', e);
    }
  }, []);

  // モーダルを開くたびに状態をリセット
  useEffect(() => {
    if (isOpen) {
      setBaseQuery('');
      setBaseCandidates([]);
      setBaseLocation(null);
      setRadiusM(100);
      setNearbyCandidates([]);
      setSelectedIds(new Set());
      setConfirmOpen(false);
      fetchUsageStats();
    }
  }, [isOpen, fetchUsageStats]);

  // 起点候補の検索（デバウンス）
  useEffect(() => {
    if (baseSearchDebounceRef.current) clearTimeout(baseSearchDebounceRef.current);
    if (!baseQuery.trim()) {
      setBaseCandidates([]);
      return;
    }
    baseSearchDebounceRef.current = setTimeout(async () => {
      setBaseSearching(true);
      try {
        const res: any = await locationAPI.getLocations({ search: baseQuery.trim(), limit: 20 });
        const data: any = res?.data;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setBaseCandidates(list);
      } catch (e) {
        console.warn('場所検索に失敗しました', e);
      } finally {
        setBaseSearching(false);
      }
    }, 300);
  }, [baseQuery]);

  // 近隣候補の検索
  // ✅ 修正: GPS半径検索(座標が両方に登録されている場合のみヒット)に加え、
  //    座標が未登録の場所（住所のみ入力・地図ピン未設定）も拾えるよう、
  //    住所文字列の完全一致による補完検索を併用する。
  const fetchNearby = useCallback(async () => {
    if (!baseLocation) return;
    setNearbyLoading(true);
    try {
      const collected = new Map<string, NearbyCandidate>();

      // ① GPS半径検索（起点・候補の両方に座標が登録されている場合のみヒット）
      if (baseLocation.latitude && baseLocation.longitude) {
        const res: any = await apiClient.get('/locations/nearby', {
          params: {
            latitude: baseLocation.latitude,
            longitude: baseLocation.longitude,
            radiusMeters: radiusM,
            limit: 50,
          }
        });
        const raw: any = res?.data;
        const list: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        list
          .filter((item) => item.location?.id !== baseLocation.id)
          .forEach((item) => {
            collected.set(item.location.id, {
              location: item.location,
              distanceM: Math.round((item.distance || 0) * 1000),
            });
          });
      }

      // ② 住所完全一致による補完検索
      //    座標が未登録の場所は①のGPS半径検索では絶対にヒットしないため、
      //    住所文字列の完全一致でも重複候補を拾えるようにする。
      const baseAddrNormalized = normalizeAddress(baseLocation.address);
      if (baseAddrNormalized) {
        const allRes: any = await locationAPI.getLocations({ limit: 100 });
        const allRaw: any = allRes?.data;
        const allList: any[] = Array.isArray(allRaw) ? allRaw : (Array.isArray(allRaw?.data) ? allRaw.data : []);
        allList
          .filter((loc) => loc.id !== baseLocation.id && normalizeAddress(loc.address) === baseAddrNormalized)
          .forEach((loc) => {
            if (!collected.has(loc.id)) {
              collected.set(loc.id, { location: loc, distanceM: null });
            }
          });
      }

      const merged = Array.from(collected.values()).sort((a, b) => {
        if (a.distanceM === null && b.distanceM === null) return 0;
        if (a.distanceM === null) return 1;
        if (b.distanceM === null) return -1;
        return a.distanceM - b.distanceM;
      });
      setNearbyCandidates(merged);
    } catch (e) {
      console.warn('近隣場所の検索に失敗しました', e);
      setNearbyCandidates([]);
    } finally {
      setNearbyLoading(false);
    }
  }, [baseLocation, radiusM]);

  // 起点 or 半径が変わるたびデバウンスして再検索
  useEffect(() => {
    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);
    if (!baseLocation) {
      setNearbyCandidates([]);
      return;
    }
    nearbyDebounceRef.current = setTimeout(() => {
      fetchNearby();
    }, 250);
  }, [baseLocation, radiusM, fetchNearby]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedCandidates = nearbyCandidates.filter(c => selectedIds.has(c.location.id));
  const selectedTotalRecords = selectedCandidates.reduce((sum, c) => {
    const stats = usageStatsMap[c.location.id];
    if (!stats) return sum;
    return sum + stats.last365Days.loading + stats.last365Days.unloading;
  }, 0);

  const handleMerge = async () => {
    if (!baseLocation || selectedIds.size === 0) return;
    setMerging(true);
    try {
      const res: any = await locationAPI.mergeLocations(baseLocation.id, Array.from(selectedIds));
      if (res?.success) {
        toast.success(res?.message || '場所を統合しました');
        setSelectedIds(new Set());
        setConfirmOpen(false);
        onMerged();
        await fetchNearby();
        await fetchUsageStats();
      } else {
        toast.error(res?.message || '統合に失敗しました');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || '統合に失敗しました');
    } finally {
      setMerging(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="重複場所メンテナンス" size="lg">
      <div className="space-y-5">
        {/* (1) 起点となる場所を選択 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            (1) 起点となる場所（統合先）
          </label>
          {baseLocation ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-900 truncate">{baseLocation.name}</p>
                  <p className="text-xs text-blue-700 truncate">{baseLocation.address}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setBaseLocation(null); setBaseQuery(''); setSelectedIds(new Set()); }}
                className="text-xs text-blue-600 underline flex-shrink-0 ml-2"
              >
                変更
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={baseQuery}
                onChange={(e) => setBaseQuery(e.target.value)}
                placeholder="場所名で検索..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
              {(baseSearching || baseCandidates.length > 0) && baseQuery.trim() && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {baseSearching && (
                    <div className="px-3 py-2 text-xs text-gray-400">検索中...</div>
                  )}
                  {!baseSearching && baseCandidates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">該当する場所がありません</div>
                  )}
                  {!baseSearching && baseCandidates.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => { setBaseLocation(loc); setBaseCandidates([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-800 truncate">{loc.name}</p>
                      <p className="text-xs text-gray-500 truncate">{loc.address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* (2) 検索半径スライダー */}
        <div className={!baseLocation ? 'opacity-40 pointer-events-none' : ''}>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            (2) 検索半径
          </label>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">起点からこの距離以内の場所を候補として表示します</span>
            <span className="text-sm font-bold text-blue-600 flex-shrink-0 ml-2">{radiusM} m</span>
          </div>
          <input
            type="range"
            min={20}
            max={1000}
            step={10}
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>20m</span>
            <span>500m</span>
            <span>1000m</span>
          </div>
        </div>

        {/* (3) 候補リスト */}
        {baseLocation && !confirmOpen && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-700">
                (3) 統合する場所を選択（{nearbyCandidates.length}件中 {selectedIds.size}件選択）
              </label>
              {nearbyLoading && <span className="text-xs text-gray-400">検索中...</span>}
            </div>
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
              {!nearbyLoading && nearbyCandidates.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">
                  半径{radiusM}m以内に他の場所は見つかりませんでした
                </p>
              )}
              {nearbyCandidates.map((c) => {
                const stats = usageStatsMap[c.location.id];
                const checked = selectedIds.has(c.location.id);
                return (
                  <label
                    key={c.location.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(c.location.id)}
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.location.name}</p>
                        {c.distanceM !== null ? (
                          <span className="text-xs text-gray-400 flex-shrink-0">{c.distanceM}m</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                            住所一致（座標未登録）
                          </span>
                        )}
                        {isMobileRegistered(c.location) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex-shrink-0">
                            アプリから
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{c.location.address}</p>
                    </div>
                    {stats && (
                      <div className="text-xs text-gray-500 flex-shrink-0 text-right">
                        <div>過去1年 積{stats.last365Days.loading} 降{stats.last365Days.unloading}</div>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* 確認ステップ */}
        {confirmOpen && (
          <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-bold mb-1">
                  {selectedIds.size}件の場所を「{baseLocation?.name}」に統合します
                </p>
                <p>
                  過去1年で合計 <span className="font-bold">{selectedTotalRecords}件</span> の運行記録の紐付け先が変更されます。
                  運行記録のデータ自体は失われず統合先にそのまま引き継がれます。統合元の場所は完全に削除されます（元に戻せません）。
                </p>
              </div>
            </div>
            <ul className="text-xs text-amber-800 pl-7 list-disc space-y-0.5">
              {selectedCandidates.map(c => (
                <li key={c.location.id}>
                  {c.location.name}（{c.distanceM !== null ? `${c.distanceM}m` : '住所一致'}）
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* フッターボタン */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          {confirmOpen ? (
            <>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={merging}>
                戻る
              </Button>
              <Button variant="danger" onClick={handleMerge} loading={merging} disabled={merging}>
                統合を実行
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                閉じる
              </Button>
              <Button
                variant="primary"
                onClick={() => setConfirmOpen(true)}
                disabled={!baseLocation || selectedIds.size === 0}
              >
                統合する（{selectedIds.size}件）
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DuplicateLocationMerge;
