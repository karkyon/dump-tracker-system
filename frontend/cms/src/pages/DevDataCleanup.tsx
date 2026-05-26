// frontend/cms/src/pages/DevDataCleanup.tsx
// UAT準備用データクリーンアップ画面（ADMIN専用・開発環境裏技）
import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Trash2, RefreshCw, AlertTriangle, CheckCircle, Database, Shield } from 'lucide-react';
import { useTLog } from '../hooks/useTLog';

const API = (window as any).__API_BASE_URL__
  || import.meta.env.VITE_API_BASE_URL
  || '/api/v1';

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
});

interface TableInfo {
  key: string;
  table: string;
  label: string;
  count: number;
}

interface CountData {
  transactionTables: TableInfo[];
  masterTables: TableInfo[];
  totalTransactionRecords: number;
}

// マスタ行データ
interface MasterRow {
  id: string;
  label: string;
  sub?: string;
}

export const DevDataCleanup: React.FC = () => {
  useTLog('DEV_CLEANUP', 'データクリーンアップ');

  const [counts, setCounts] = useState<CountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [txConfirmInput, setTxConfirmInput] = useState('');
  const [txResult, setTxResult] = useState<null | { tables: { label: string; deleted: number }[] }>(null);
  const [phase, setPhase] = useState<'count' | 'tx_confirm' | 'tx_done' | 'master'>('count');

  // マスタ選択状態
  const [activeTable, setActiveTable] = useState<string>('vehicles');
  const [masterRows, setMasterRows] = useState<MasterRow[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dev/cleanup/counts`, { headers: headers() });
      const json = await res.json();
      if (json.success) {
        setCounts(json.data);
        // phaseはリセットしない（マスタ削除後もmaster phaseを維持するため）
        // setPhase('count'); ← 削除
      } else {
        toast.error('件数取得失敗: ' + json.message);
      }
    } catch (e: any) {
      toast.error('通信エラー: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // ---- マスタ一覧取得 ----
  const fetchMasterRows = useCallback(async (table: string) => {
    console.log(`🔥 [DevCleanup] fetchMasterRows 呼び出し開始 table=${table}`);
    setMasterLoading(true);
    setSelectedIds(new Set());
    try {
      // 各テーブルの一覧APIを叩く
      // キーは devCleanupRoutes.ts の MASTER_TABLES.key と完全一致させること
      const endpointMap: Record<string, string> = {
        vehicles:       '/vehicles?limit=100',
        users_driver:   '/users?limit=100&role=DRIVER',
        customers:      '/customers?limit=100',
        locations:      '/locations?limit=100',
        items:          '/items?limit=100',
        inspectionItems: '/inspection-items?limit=100',
      };
      const url = endpointMap[table];
      if (!url) { setMasterRows([]); return; }

      const res = await fetch(`${API}${url}`, { headers: headers() });
      const json = await res.json();

      // ===== デバッグログ =====
      console.group(`[DevCleanup] fetchMasterRows table=${table}`);
      console.log('URL:', `${API}${url}`);
      console.log('HTTP status:', res.status);
      console.log('json (全体):', JSON.stringify(json, null, 2));
      console.log('json.success:', json?.success);
      console.log('json.data:', json?.data);
      console.log('json.data type:', typeof json?.data);
      console.log('Array.isArray(json.data):', Array.isArray(json?.data));
      if (json?.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
        console.log('json.data keys:', Object.keys(json.data));
        Object.keys(json.data).forEach(k => {
          console.log(`  json.data.${k}:`, json.data[k], '| isArray:', Array.isArray(json.data[k]));
        });
      }
      console.groupEnd();
      // ===== デバッグログここまで =====

      // ===== ログで確定した実際のAPIレスポンス構造に基づく解析 =====
      // vehicles:  { success, data:[{...}], meta }          → data が配列直接
      // customers: { success, data:{ customers:[...] } }    → data.customers
      // locations: { success, data:[{...}], meta }          → data が配列直接
      // items:     { success, data:[{...}], meta }          → data が配列直接
      // users:     未確認 → data.users or 配列直接 両方フォールバック
      // inspection_items: 未確認 → data.data or 配列直接 両方フォールバック
      let arr: any[] = [];
      const d = json?.data;
      if (table === 'vehicles' || table === 'locations' || table === 'items') {
        // これらは json.data が配列直接
        arr = Array.isArray(d) ? d : [];
      } else if (table === 'customers') {
        // json.data = { customers:[...], total }
        arr = Array.isArray(d?.customers) ? d.customers : [];
      } else if (table === 'users_driver') {
        // json.data = { users:[...], pagination } → d.users
        arr = Array.isArray(d?.users) ? d.users
            : Array.isArray(d) ? d : [];
      } else if (table === 'inspectionItems') {
        // json.data.data or json.data が配列
        arr = Array.isArray(d?.data) ? d.data
            : Array.isArray(d) ? d : [];
      }

      console.log(`✅ [DevCleanup] arr確定 table=${table} 件数=${arr.length}`, arr.slice(0,2));
      const rows: MasterRow[] = arr.map((r: any) => ({
        id: r.id,
        label: r.plateNumber || r.name || r.username || '(不明)',
        sub: r.model || r.role || r.address || r.unit || r.inspectionType || '',
      }));
      console.log(`✅ [DevCleanup] setMasterRows 件数=${rows.length}`, rows);
      setMasterRows(rows);
    } catch (e: any) {
      toast.error('マスタ取得エラー: ' + e.message);
    } finally {
      setMasterLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log(`⚡ [DevCleanup] useEffect発火 phase=${phase} activeTable=${activeTable}`);
    if (phase === 'master') {
      console.log(`⚡ [DevCleanup] useEffect → fetchMasterRows(${activeTable}) 呼び出し`);
      fetchMasterRows(activeTable);
    }
  }, [phase, activeTable, fetchMasterRows]);

  // ---- トランザクション削除実行 ----
  const handleTxDelete = async () => {
    if (txConfirmInput !== 'DUMPTRACKER2026') {
      toast.error('確認コードが一致しません');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/dev/cleanup/transactions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ confirm: 'DUMPTRACKER2026' }),
      });
      const json = await res.json();
      if (json.success) {
        setTxResult(json.data);
        setPhase('tx_done');
        toast.success('トランザクションデータを全件削除しました');
        fetchCounts();
      } else {
        toast.error('削除失敗: ' + json.message);
      }
    } catch (e: any) {
      toast.error('通信エラー: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- マスタ複数削除 ----
  const handleMasterBulkDelete = async () => {
    if (selectedIds.size === 0) { toast.error('削除対象を選択してください'); return; }
    // フロントのキー(MASTER_TABLES.key) → DBの物理テーブル名 に変換
    const tableMap: Record<string, string> = {
      vehicles:       'vehicles',
      users_driver:   'users',        // users_driver → users (role=DRIVERフィルタはバックエンド側)
      customers:      'customers',
      locations:      'locations',
      items:          'items',
      inspectionItems: 'inspection_items', // inspectionItems → inspection_items
    };
    const table = tableMap[activeTable];
    if (!table) { toast.error('対象外のテーブルです'); return; }
    setMasterLoading(true);
    try {
      const res = await fetch(`${API}/dev/cleanup/master/bulk-delete`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ table, ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${json.deleted}件削除しました`);
        // phaseはmasterのまま維持 → 一覧を再取得するだけ
        fetchMasterRows(activeTable);
        fetchCounts();
      } else {
        toast.error('削除失敗: ' + json.message);
      }
    } catch (e: any) {
      toast.error('通信エラー: ' + e.message);
    } finally {
      setMasterLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === masterRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(masterRows.map(r => r.id)));
    }
  };

  const MASTER_TABS = counts?.masterTables ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h1 className="text-xl font-bold text-red-800">🛠️ UAT準備 データクリーンアップ</h1>
          <p className="text-sm text-red-700 mt-1">
            <strong>ADMIN専用・開発環境限定の裏機能です。</strong>
            この操作は取り消せません。UAT開始前のテストデータ一掃に使用してください。
          </p>
        </div>
      </div>

      {/* STEP 1: 件数確認 */}
      {phase === 'count' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">STEP 1: 現在のデータ件数確認</h2>
            </div>
            <button
              onClick={fetchCounts}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              更新
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">読み込み中...</div>
          ) : counts ? (
            <div className="p-6 space-y-6">
              {/* トランザクション */}
              <div>
                <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <Trash2 className="w-4 h-4" />
                  トランザクションデータ（全件削除対象）
                  <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    合計 {counts.totalTransactionRecords.toLocaleString()} 件
                  </span>
                </h3>
                <div className="overflow-x-auto overflow-y-auto border rounded" style={{ maxHeight: '300px' }}>
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-700">テーブル名</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-red-700">件数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {counts.transactionTables.map(t => (
                        <tr key={t.key} className={t.count > 0 ? 'bg-white' : 'bg-gray-50 opacity-50'}>
                          <td className="px-4 py-2 text-gray-800">{t.label}</td>
                          <td className="px-4 py-2 text-right font-mono">
                            <span className={t.count > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}>
                              {t.count.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* マスタ */}
              <div>
                <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  マスタデータ（個別選択削除）
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {counts.masterTables.map(t => (
                    <div key={t.key} className="border border-blue-200 rounded p-3 bg-blue-50">
                      <div className="text-xs text-blue-600 font-medium">{t.label}</div>
                      <div className="text-lg font-bold text-blue-900">{t.count.toLocaleString()} 件</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ボタン */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPhase('tx_confirm')}
                  disabled={counts.totalTransactionRecords === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  STEP 2: トランザクション全件削除へ
                </button>
                <button
                  onClick={() => setPhase('master')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Shield className="w-4 h-4" />
                  マスタ整理へ
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* STEP 2: トランザクション削除確認 */}
      {phase === 'tx_confirm' && (
        <div className="bg-white rounded-lg border border-red-300 shadow-sm">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50">
            <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              STEP 2: トランザクションデータ 全件削除の最終確認
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
              <strong>以下のデータが全件物理削除されます（取り消し不可）：</strong>
              <ul className="mt-2 space-y-0.5 list-disc list-inside">
                {counts?.transactionTables.filter(t => t.count > 0).map(t => (
                  <li key={t.key}>{t.label}: <strong>{t.count.toLocaleString()}件</strong></li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                実行するには以下を入力してください：
                <code className="ml-2 bg-gray-100 px-2 py-0.5 rounded text-red-700">DUMPTRACKER2026</code>
              </label>
              <input
                type="text"
                value={txConfirmInput}
                onChange={e => setTxConfirmInput(e.target.value)}
                placeholder="DUMPTRACKER2026"
                className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTxDelete}
                disabled={loading || txConfirmInput !== 'DUMPTRACKER2026'}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                {loading ? '削除中...' : '全件削除実行'}
              </button>
              <button
                onClick={() => { setPhase('count'); setTxConfirmInput(''); }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: 削除完了 */}
      {phase === 'tx_done' && txResult && (
        <div className="bg-white rounded-lg border border-green-300 shadow-sm">
          <div className="px-6 py-4 border-b border-green-200 bg-green-50 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-green-800">削除完了</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="overflow-x-auto border rounded" style={{ maxHeight: '300px' }}>
              <table className="w-full text-sm">
                <thead className="bg-green-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-green-700">テーブル</th>
                    <th className="px-4 py-2 text-right text-xs text-green-700">削除件数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {txResult.tables.map((t, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-gray-700">{t.label}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-700 font-bold">{t.deleted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPhase('master')}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Shield className="w-4 h-4" />
                マスタ整理へ
              </button>
              <button
                onClick={() => { setPhase('count'); setTxResult(null); fetchCounts(); }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                件数確認に戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* マスタ整理フェーズ */}
      {phase === 'master' && (
        <div className="bg-white rounded-lg border border-blue-200 shadow-sm">
          <div className="px-6 py-4 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-blue-800">マスタデータ 個別物理削除</h2>
            </div>
            <button
              onClick={() => setPhase('count')}
              className="text-sm text-blue-600 hover:underline"
            >
              ← 件数確認に戻る
            </button>
          </div>

          {/* テーブル切替タブ */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {MASTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => {
                console.log(`🖱️ [DevCleanup] タブクリック key=${t.key} phase=${phase}`);
                setActiveTable(t.key);
                fetchMasterRows(t.key);
              }}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTable === t.key
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* 一括操作バー */}
            {selectedIds.size > 0 && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-red-700">{selectedIds.size}件 選択中</span>
                <button
                  onClick={handleMasterBulkDelete}
                  disabled={masterLoading}
                  className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  選択した{selectedIds.size}件を物理削除
                </button>
              </div>
            )}

            {/* マスタ一覧 */}
            {masterLoading ? (
              <div className="py-8 text-center text-gray-400">読み込み中...</div>
            ) : masterRows.length === 0 ? (
              <div className="py-8 text-center text-gray-400">データがありません</div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto border rounded" style={{ maxHeight: 'calc(100vh - 480px)' }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === masterRows.length && masterRows.length > 0}
                          onChange={toggleAll}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="px-4 py-2 text-left text-xs text-gray-500">名称</th>
                      <th className="px-4 py-2 text-left text-xs text-gray-500">補足</th>
                      <th className="px-4 py-2 text-left text-xs text-gray-500">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {masterRows.map(row => (
                      <tr key={row.id} className={selectedIds.has(row.id) ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-800">{row.label}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{row.sub}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => { setSelectedIds(new Set([row.id])); }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            選択
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DevDataCleanup;
