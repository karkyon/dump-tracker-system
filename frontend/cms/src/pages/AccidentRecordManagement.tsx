// frontend/cms/src/pages/AccidentRecordManagement.tsx
// 事故記録管理ページ（新規作成: P4-06）
// ADMIN / MANAGER 専用

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type {
  AccidentRecord,
  AccidentRecordSummary,
  AccidentType,
  TransportRegion,
} from '../types';
import { TRANSPORT_REGION_LABELS } from '../types';
import { accidentRecordAPI } from '../utils/api';

// =====================================
// 定数
// =====================================

const ACCIDENT_TYPE_LABELS: Record<AccidentType, string> = {
  TRAFFIC: '交通事故',
  SERIOUS: '重大事故',
};

const FISCAL_YEARS = (() => {
  const curr = new Date().getMonth() >= 3
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;
  return Array.from({ length: 5 }, (_, i) => curr - i);
})();

const EMPTY_FORM: Partial<AccidentRecord> = {
  accidentDate: new Date().toISOString().split('T')[0],
  accidentType: 'TRAFFIC',
  vehicleId:    null,
  driverId:     null,
  operationId:  null,
  casualties:   0,
  injuries:     0,
  region:       null,
  description:  null,
};

// =====================================
// コンポーネント
// =====================================

const AccidentRecordManagement: React.FC = () => {
  const { user } = useAuthStore();

  // 一覧 state
  const [records, setRecords]         = useState<AccidentRecord[]>([]);
  const [summary, setSummary]         = useState<AccidentRecordSummary | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // フィルター state
  const [fiscalYear, setFiscalYear]   = useState<number>(FISCAL_YEARS[0]!);
  const [filterType, setFilterType]   = useState<AccidentType | ''>('');

  // モーダル state
  const [showModal, setShowModal]     = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState<Partial<AccidentRecord>>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);

  // 削除確認 state
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);

  // =====================================
  // データ取得
  // =====================================

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accidentRecordAPI.getAll(fiscalYear, filterType || undefined);
      setRecords(result.data);
      setSummary(result.summary);
    } catch (e: any) {
      setError(e.message || 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, filterType]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // =====================================
  // 登録・編集
  // =====================================

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (record: AccidentRecord) => {
    setEditingId(record.id);
    setForm({
      accidentDate: record.accidentDate.split('T')[0],
      accidentType: record.accidentType,
      vehicleId:    record.vehicleId,
      driverId:     record.driverId,
      operationId:  record.operationId,
      casualties:   record.casualties,
      injuries:     record.injuries,
      region:       record.region,
      description:  record.description,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.accidentDate) { setFormError('事故発生日は必須です'); return; }
    if (!form.accidentType) { setFormError('事故種別は必須です');   return; }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await accidentRecordAPI.update(editingId, form);
      } else {
        await accidentRecordAPI.create(form);
      }
      setShowModal(false);
      fetchRecords();
    } catch (e: any) {
      setFormError(e.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // =====================================
  // 削除
  // =====================================

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await accidentRecordAPI.remove(deleteId);
      setDeleteId(null);
      fetchRecords();
    } catch (e: any) {
      alert(e.message || '削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  // =====================================
  // 権限チェック
  // =====================================

  if (user?.role === 'DRIVER') {
    return (
      <div className="p-6 text-center text-gray-500">
        このページへのアクセス権限がありません
      </div>
    );
  }

  // =====================================
  // レンダリング
  // =====================================

  return (
    <div className="p-6 space-y-4">

      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            事故記録管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            交通事故・重大事故の記録管理（実績報告書の事故件数欄に反映）
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          新規事故記録追加
        </button>
      </div>

      {/* フィルターバー */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">対象年度</label>
          <select
            className="border border-gray-300 rounded-md text-sm py-1.5 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={fiscalYear}
            onChange={e => setFiscalYear(Number(e.target.value))}
          >
            {FISCAL_YEARS.map(y => (
              <option key={y} value={y}>
                {y}年度（{y}/4/1〜{y + 1}/3/31）
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">事故種別</label>
          <select
            className="border border-gray-300 rounded-md text-sm py-1.5 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={filterType}
            onChange={e => setFilterType(e.target.value as AccidentType | '')}
          >
            <option value="">すべて</option>
            <option value="TRAFFIC">交通事故</option>
            <option value="SERIOUS">重大事故</option>
          </select>
        </div>
      </div>

      {/* サマリーチップ */}
      {summary && (
        <div className="flex gap-3 flex-wrap">
          {[
            { label: '交通事故',   value: summary.trafficAccidents,  unit: '件' },
            { label: '重大事故',   value: summary.seriousAccidents,  unit: '件' },
            { label: '死者数合計', value: summary.totalCasualties,   unit: '名' },
            { label: '負傷者数合計', value: summary.totalInjuries,   unit: '名' },
          ].map(({ label, value, unit }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm">
              <span className="text-gray-500">{label}: </span>
              <strong className="text-gray-900">{value} {unit}</strong>
            </div>
          ))}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['発生日', '種別', '車両番号', '運転者', '死者', '負傷者', '管轄区域', '操作'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 italic">
                  対象年度に事故記録はありません。「新規事故記録追加」から登録してください。
                </td>
              </tr>
            ) : records.map(record => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">
                  {record.accidentDate.split('T')[0]}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    record.accidentType === 'SERIOUS'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {ACCIDENT_TYPE_LABELS[record.accidentType]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {record.vehicles?.plateNumber ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {record.users?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-center text-gray-900">{record.casualties}</td>
                <td className="px-4 py-3 text-center text-gray-900">{record.injuries}</td>
                <td className="px-4 py-3 text-gray-600">
                  {record.region ? TRANSPORT_REGION_LABELS[record.region] : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(record)}
                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(record.id)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =====================================
          登録・編集モーダル
      ===================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-base font-medium text-gray-900">
                {editingId ? '事故記録編集' : '新規事故記録登録'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 発生日 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    事故発生日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={form.accidentDate as string ?? ''}
                    onChange={e => setForm({ ...form, accidentDate: e.target.value })}
                  />
                </div>

                {/* 種別 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    事故種別 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4 pt-2">
                    {(['TRAFFIC', 'SERIOUS'] as AccidentType[]).map(type => (
                      <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="accidentType"
                          checked={form.accidentType === type}
                          onChange={() => setForm({ ...form, accidentType: type })}
                          className="accent-blue-600"
                        />
                        {ACCIDENT_TYPE_LABELS[type]}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 死者数 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    死者数（名）<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number" min="0"
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={form.casualties ?? 0}
                    onChange={e => setForm({ ...form, casualties: Number(e.target.value) })}
                  />
                </div>

                {/* 負傷者数 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    負傷者数（名）<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number" min="0"
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={form.injuries ?? 0}
                    onChange={e => setForm({ ...form, injuries: Number(e.target.value) })}
                  />
                </div>

                {/* 管轄区域 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">管轄区域（任意）</label>
                  <select
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={form.region ?? ''}
                    onChange={e => setForm({ ...form, region: e.target.value as TransportRegion || null })}
                  >
                    <option value="">選択してください</option>
                    {(Object.entries(TRANSPORT_REGION_LABELS) as [TransportRegion, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {/* 概要 */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">概要（任意）</label>
                  <textarea
                    rows={3}
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-y"
                    placeholder="事故の状況・経緯など（500文字以内）"
                    value={form.description ?? ''}
                    onChange={e => setForm({ ...form, description: e.target.value || null })}
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : editingId ? '更新する' : '登録する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================
          削除確認ダイアログ
      ===================================== */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-2">事故記録を削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-6">この操作は取り消せません。</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccidentRecordManagement;