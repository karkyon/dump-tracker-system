// frontend/cms/src/pages/ItemManagement.tsx
// 品目管理ページ

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Button from '../components/common/Button';
import Table, { ActionButtons } from '../components/common/Table';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { useMasterStore } from '../store/masterStore';
import { Item } from '../types';

// =====================================
// 定数定義
// =====================================

/** 品目区分の選択肢とラベルマッピング（単一箇所で管理） */
const ITEM_TYPE_OPTIONS: { value: 'MATERIAL' | 'SCRAP'; label: string }[] = [
  { value: 'MATERIAL', label: '原料' },
  { value: 'SCRAP',    label: 'スクラップ' },
];

/** フォームの初期値（新規作成・保存後リセット共通） */
const DEFAULT_FORM_DATA = {
  name: '',
  item_type: 'MATERIAL' as 'MATERIAL' | 'SCRAP',
  description: '',
  displayOrder: 1,
};

// =====================================
// ヘルパー関数
// =====================================

/** 品目区分の英語値を日本語ラベルに変換する */
const getItemTypeLabel = (itemType: Item['item_type']): string => {
  return ITEM_TYPE_OPTIONS.find((opt) => opt.value === itemType)?.label ?? '-';
};

// =====================================
// コンポーネント
// =====================================

const ItemManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
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
  } = useMasterStore();

  // 初回マウント時のみデータ取得
  // zustand ストアのアクション関数は安定参照のため、空依存配列で問題なし
  useEffect(() => {
    fetchItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 検索フィルタリング＋表示順ソート
  const displayItems = [...items]
    .filter((item: Item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
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
      item_type: item.item_type ?? 'MATERIAL',
      description: item.description ?? '',
      displayOrder: item.displayOrder ?? 1,
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('この品目を削除しますか？')) {
      await deleteItem(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = editingItem
      ? await updateItem(editingItem.id, formData)
      : await createItem(formData);

    if (success) {
      handleCloseModal();
    }
  };

  // ----------------
  // テーブル定義
  // ----------------

  const columns = [
    { key: 'displayOrder', header: '表示順', width: '100px' },
    { key: 'name',         header: '品目名' },
    { key: 'item_type',    header: '品目区分', width: '120px' },
    { key: 'description',  header: '説明', width: '200px' },
    { key: 'createdAt',    header: '登録日', width: '150px' },
    { key: 'actions',      header: '操作', width: '100px' },
  ];

  const tableData = displayItems.map((item: Item) => ({
    displayOrder: item.displayOrder ?? '-',
    name: item.name,
    item_type: getItemTypeLabel(item.item_type),
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
              value={formData.item_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  item_type: e.target.value as 'MATERIAL' | 'SCRAP',
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
                  displayOrder: parseInt(e.target.value),
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