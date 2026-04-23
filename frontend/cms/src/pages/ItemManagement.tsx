// frontend/cms/src/pages/ItemManagement.tsx
// 品目管理ページ

import React, { useState, useEffect } from 'react';
import { useTLog } from '../hooks/useTLog';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import Button from '../components/common/Button';
import Table, { ActionButtons } from '../components/common/Table';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { useMasterStore } from '../store/masterStore';
import { toast } from 'react-hot-toast';
import { Item } from '../types';

// =====================================
// 定数定義
// =====================================

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
    setFormData({ ...DEFAULT_FORM_DATA, displayOrder: items.length + 1 });
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

  const handleMoveUp = async (_item: Item, index: number) => {
    if (index === 0) return;
    // 配列内で入れ替えてから全件連番付け直し
    const reordered = [...displayItems];
    const tmp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = tmp;
    const updates = reordered.map((it, i) => ({ id: it.id, order: i + 1 }));
    const success = await updateItemOrder(updates);
    if (success) toast.success('表示順を変更しました');
    else toast.error('表示順の変更に失敗しました');
  };

  const handleMoveDown = async (_item: Item, index: number) => {
    // REQ-009: displayItems はフィルター後リストなのでグループ内末尾チェックが正しく機能する
    if (index === displayItems.length - 1) return;
    // 配列内で入れ替えてから全件連番付け直し
    const reordered = [...displayItems];
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
        // 編集対象を除外した配列を作成し、指定位置に挿入して全件連番付け直し
        const withoutEdited = items.filter((i: Item) => i.id !== editingItem.id);
        const targetIndex = Math.min(
          Math.max(0, (formData.displayOrder || 1) - 1),
          withoutEdited.length
        );
        withoutEdited.splice(targetIndex, 0, { ...editingItem, displayOrder: formData.displayOrder });
        const renumbered = withoutEdited.map((i: Item, idx: number) => ({ id: i.id, order: idx + 1 }));
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
              disabled={index === displayItems.length - 1}
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