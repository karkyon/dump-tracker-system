// frontend/cms/src/pages/ItemManagement.tsx
// 品目管理ページ

import React, { useState, useEffect } from 'react';
import { useTLog } from '../hooks/useTLog';
import { Plus, ChevronUp, ChevronDown, Save, GripVertical } from 'lucide-react';
import Button from '../components/common/Button';
import Table, { ActionButtons } from '../components/common/Table';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { useMasterStore } from '../store/masterStore';
import { toast } from 'react-hot-toast';
import { Item } from '../types';

// =====================================
// API設定
// =====================================

const API_BASE = (() => {
  try {
    return (window as any).__API_BASE_URL__
      || import.meta.env.VITE_API_BASE_URL
      || 'https://dumptracker-s.ddns.net/api/v1';
  } catch { return 'https://dumptracker-s.ddns.net/api/v1'; }
})();

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** 大区分表示順をAPI経由で保存 (key=item_group_order) */
async function saveGroupOrder(order: string[]): Promise<void> {
  await fetch(`${API_BASE}/settings/system`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify([{ key: 'item_group_order', value: JSON.stringify(order) }]),
  });
}

/** 大区分表示順をAPI経由で取得 */
async function fetchGroupOrder(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/settings/system`, { headers: getAuthHeaders() });
    if (!res.ok) return DEFAULT_GROUP_ORDER;
    const json = await res.json();
    const raw = json.data?.item_group_order;
    if (!raw) return DEFAULT_GROUP_ORDER;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_GROUP_ORDER;
  } catch { return DEFAULT_GROUP_ORDER; }
}

// =====================================
// 定数定義
// =====================================

/** 大区分のデフォルト表示順 */
const DEFAULT_GROUP_ORDER = ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE'];

/** 大区分ラベルマップ */
const GROUP_LABEL_MAP: Record<string, string> = {
  RECYCLED_MATERIAL: '再生材',
  VIRGIN_MATERIAL: 'バージン材',
  WASTE: '廃棄物',
};

/** 品目区分の選択肢とラベルマッピング（単一箇所で管理） */
const ITEM_TYPE_OPTIONS: { value: 'RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE'; label: string }[] = [
  { value: 'RECYCLED_MATERIAL', label: '再生材' },
  { value: 'VIRGIN_MATERIAL',   label: 'バージン材' },
  { value: 'WASTE',             label: '廃棄物' },
];

/** フォームの初期値（新規作成・保存後リセット共通） */
const DEFAULT_FORM_DATA = {
  name: '',
  itemType: 'RECYCLED_MATERIAL' as 'RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE',
  description: '',
  displayOrder: 1,
};

// =====================================
// ヘルパー関数
// =====================================

/** 品目区分の英語値を日本語ラベルに変換する */
const getItemTypeLabel = (itemType: Item['itemType']): string => {
  return ITEM_TYPE_OPTIONS.find((opt) => opt.value === itemType)?.label ?? '-';
};

// =====================================
// コンポーネント
// =====================================

const ItemManagement: React.FC = () => {
  useTLog('ITEM_MANAGEMENT', '品目管理');

  const [searchQuery, setSearchQuery] = useState('');
  // REQ-009: 品目区分フィルタータブ
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const {
    items,
    itemLoading,
    createItem,
    updateItem,
    deleteItem,
    fetchItems,
    updateItemOrder,
  } = useMasterStore();

  // 初回マウント時のみデータ取得
  // zustand ストアのアクション関数は安定参照のため、空依存配列で問題なし
  useEffect(() => {
    fetchItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================================
  // 大区分表示順 state
  // =====================================
  const [groupOrder, setGroupOrder] = React.useState<string[]>(DEFAULT_GROUP_ORDER);
  const [groupOrderSaving, setGroupOrderSaving] = React.useState(false);

  // 初回: APIから大区分表示順を取得
  React.useEffect(() => {
    fetchGroupOrder().then(setGroupOrder);
  }, []);

  /** 大区分を上に移動 */
  const handleGroupMoveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...groupOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setGroupOrder(next);
  };

  /** 大区分を下に移動 */
  const handleGroupMoveDown = (idx: number) => {
    if (idx === groupOrder.length - 1) return;
    const next = [...groupOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setGroupOrder(next);
  };

  /** 大区分表示順を保存 */
  const handleSaveGroupOrder = async () => {
    setGroupOrderSaving(true);
    try {
      await saveGroupOrder(groupOrder);
      toast.success('大区分の表示順を保存しました');
    } catch {
      toast.error('保存に失敗しました');
    } finally {
      setGroupOrderSaving(false);
    }
  };

  // REQ-009: 検索 + 区分フィルタリング + 表示順ソート
  const displayItems = [...items]
    .filter((item: Item) => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = itemTypeFilter === 'all' || item.itemType === itemTypeFilter;
      return matchSearch && matchType;
    })
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  // ----------------
  // ハンドラー
  // ----------------

  const handleAddItem = () => {
    setEditingItem(null);
    // REQ-009: 区分内の件数+1 を初期表示順とする（全件数ではなく区分内連番）
    const sameTypeCount = items.filter((i: Item) => i.itemType === DEFAULT_FORM_DATA.itemType).length;
    setFormData({ ...DEFAULT_FORM_DATA, displayOrder: sameTypeCount + 1 });
    setIsModalOpen(true);
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      itemType: item.itemType ?? 'RECYCLED_MATERIAL',
      description: item.description ?? '',
      displayOrder: item.displayOrder ?? 1,
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('この品目を削除しますか？')) {
      const success = await deleteItem(id);
      if (success) toast.success('品目を削除しました');
      else toast.error('品目の削除に失敗しました');
    }
  };

  const handleMoveUp = async (item: Item, index: number) => {
    if (index === 0) return;
    // REQ-009: 同一 itemType の全品目を displayOrder 順に並べて入れ替え → 区分内 1〜N で連番付け直し
    // ※ displayItems は検索フィルター後のため、検索中でも正しく動作するよう全品目から取得する
    const sameTypeItems = [...items]
      .filter((i: Item) => i.itemType === item.itemType)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    // displayItems 内の index は sameTypeItems でも同じ位置になる（区分タブ選択中のみ↑↓有効）
    const reordered = [...sameTypeItems];
    const tmp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = tmp;
    const updates = reordered.map((it, i) => ({ id: it.id, order: i + 1 }));
    const success = await updateItemOrder(updates);
    if (success) toast.success('表示順を変更しました');
    else toast.error('表示順の変更に失敗しました');
  };

  const handleMoveDown = async (item: Item, index: number) => {
    // REQ-009: 同一 itemType の全品目を displayOrder 順に並べて入れ替え → 区分内 1〜N で連番付け直し
    const sameTypeItems = [...items]
      .filter((i: Item) => i.itemType === item.itemType)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    // 末尾チェックも sameTypeItems の長さで判定（区分内の末尾）
    if (index === sameTypeItems.length - 1) return;
    const reordered = [...sameTypeItems];
    const tmp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = tmp;
    const updates = reordered.map((it, i) => ({ id: it.id, order: i + 1 }));
    const success = await updateItemOrder(updates);
    if (success) toast.success('表示順を変更しました');
    else toast.error('表示順の変更に失敗しました');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem) {
      // 更新：表示順の自動連番付け直し（InspectionItemManagement と同じロジック）
      const success = await updateItem(editingItem.id, {
        name: formData.name,
        itemType: formData.itemType,
        description: formData.description,
      });

      if (success) {
        // REQ-009: 同一 itemType 内のみで挿入・連番付け直し（区分内独立連番）
        // 編集後の itemType（区分変更があった場合は新区分）を基準にする
        const targetItemType = formData.itemType;
        const sameTypeItems = items
          .filter((i: Item) => i.id !== editingItem.id && i.itemType === targetItemType)
          .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
        const targetIndex = Math.min(
          Math.max(0, (formData.displayOrder || 1) - 1),
          sameTypeItems.length
        );
        sameTypeItems.splice(targetIndex, 0, { ...editingItem, itemType: targetItemType, displayOrder: formData.displayOrder });
        const renumbered = sameTypeItems.map((i: Item, idx: number) => ({ id: i.id, order: idx + 1 }));
        await updateItemOrder(renumbered);
        handleCloseModal();
      }
    } else {
      // 新規作成：末尾に追加して連番付け直し
      const success = await createItem({
        name: formData.name,
        itemType: formData.itemType,
        description: formData.description,
      });
      if (success) {
        // 作成後に全件取得し直して連番付け直し
        // 新規アイテムはfetchItems後にstoreに入るため、fetchItems後に連番付け直し
        await fetchItems();
        handleCloseModal();
      }
    }
  };

  // ----------------
  // テーブル定義
  // ----------------

  const columns = [
    { key: 'displayOrder', header: '表示順', width: '100px' },
    { key: 'name',         header: '品目名' },
    { key: 'itemType',    header: '品目区分', width: '120px' },
    { key: 'description',  header: '説明', width: '200px' },
    { key: 'createdAt',    header: '登録日', width: '150px' },
    { key: 'actions',      header: '操作', width: '100px' },
  ];

  const tableData = displayItems.map((item: Item, index: number) => ({
    displayOrder: (
      <div className="flex items-center gap-2">
        <span className="w-6 text-center text-sm">{item.displayOrder ?? '-'}</span>
        {/* REQ-009: allタブ時は並び替えボタン非表示 */}
        {itemTypeFilter !== 'all' && (
          <div className="flex flex-col">
            <button
              onClick={() => handleMoveUp(item, index)}
              disabled={index === 0}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleMoveDown(item, index)}
              disabled={index === items.filter((i: Item) => i.itemType === item.itemType).length - 1}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    ),
    name: item.name,
    itemType: getItemTypeLabel(item.itemType),
    description: item.description ?? '-',
    createdAt: item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('ja-JP')
      : '-',
    actions: (
      <ActionButtons
        onEdit={() => handleEditItem(item)}
        onDelete={() => handleDeleteItem(item.id)}
      />
    ),
  }));

  // ----------------
  // レンダリング
  // ----------------

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">品目管理</h1>
        <Button onClick={handleAddItem}>
          <Plus className="w-4 h-4 mr-2" />
          新規品目追加
        </Button>
      </div>

      {/* ===== 大区分表示順設定 ===== */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
              <GripVertical className="w-4 h-4 text-gray-400" />
              品目大区分の表示順（mobileアプリの品目選択画面に反映）
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">↑↓ボタンで並べ替えて「保存」を押してください</p>
          </div>
          <button
            onClick={handleSaveGroupOrder}
            disabled={groupOrderSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            {groupOrderSaving ? '保存中...' : '保存'}
          </button>
        </div>
        <div className="flex gap-3">
          {groupOrder.map((key, idx) => (
            <div
              key={key}
              className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[120px]"
            >
              <span className="text-xs text-gray-400 font-bold w-4 text-center">{idx + 1}</span>
              <span className="flex-1 text-sm font-medium text-gray-700 text-center">
                {GROUP_LABEL_MAP[key] ?? key}
              </span>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleGroupMoveUp(idx)}
                  disabled={idx === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                  title="上へ"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleGroupMoveDown(idx)}
                  disabled={idx === groupOrder.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                  title="下へ"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          {/* REQ-009: 品目区分タブ */}
          <div className="flex gap-2 border-b border-gray-200 mb-4">
            {([
              { value: 'all',               label: 'すべて' },
              { value: 'RECYCLED_MATERIAL', label: '再生材' },
              { value: 'VIRGIN_MATERIAL',   label: 'バージン材' },
              { value: 'WASTE',             label: '廃棄物' },
            ] as const).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setItemTypeFilter(tab.value)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  itemTypeFilter === tab.value
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-1 text-xs text-gray-400">
                  ({tab.value === 'all'
                    ? items.length
                    : items.filter((i: Item) => i.itemType === tab.value).length})
                </span>
              </button>
            ))}
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">検索・フィルター</h2>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="品目名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-md font-medium text-gray-900 mb-2">
              品目一覧 ({displayItems.length}件)
            </h3>
          </div>

          <Table
            columns={columns}
            data={tableData}
            loading={itemLoading}
            emptyMessage="品目が見つかりません"
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? '品目編集' : '新規品目追加'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              品目名 *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例: RC、RM、砂、砕石、土、汚泥など"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              品目区分 *
            </label>
            <select
              value={formData.itemType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  itemType: e.target.value as 'RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {ITEM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              説明
            </label>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="例: リサイクルコンクリート（再生砕石）"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              表示順 *
            </label>
            <Input
              type="number"
              value={formData.displayOrder}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  displayOrder: parseInt(e.target.value) || 1,
                })
              }
              min="1"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              キャンセル
            </Button>
            <Button type="submit">
              {editingItem ? '更新' : '追加'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ItemManagement;