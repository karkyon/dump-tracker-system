// frontend/cms/src/pages/ItemManagement.tsx
// 品目管理ページ - Backend /items API 完全対応版（CargoType完全廃止）
// 旧ファイル名: CargoTypeManagement.tsx
// 修正内容:
// - Backend API /items を正しく使用
// - 変数名を items に統一
// - CargoType → Item に完全変更
// - 2重ネスト構造対応
// - useEffect 無限ループ回避

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Table from '../components/common/Table';
import { useMasterStore } from '../store/masterStore';
import { Item } from '../types';  // ✅ Item を使用

const ItemManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);  // ✅ Item 型
  const [formData, setFormData] = useState({
    name: '',
    displayOrder: 1
  });

  // ✅ masterStore から正しいプロパティを取得
  const { 
    items,
    itemLoading,
    createItem,
    updateItem,
    deleteItem,
    fetchItems
  } = useMasterStore();

  // ✅ useEffect 無限ループ回避: 初回マウント時のみ実行
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasFetchedRef.current) {
      console.log('[ItemManagement] 初回データ取得');
      fetchItems();
      hasFetchedRef.current = true;
    }
  }, [fetchItems]);

  const filteredItems = items.filter((item: Item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddItem = () => {
    setEditingItem(null);
    setFormData({ name: '', displayOrder: items.length + 1 });
    setIsModalOpen(true);
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      displayOrder: item.displayOrder || 1
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('この品目を削除しますか？')) {
      const success = await deleteItem(id);
      if (success) {
        console.log('[ItemManagement] 品目削除成功');
      }
    }
  };

  const handleMoveUp = async (item: Item) => {
    const order = item.displayOrder || 1;
    if (order > 1) {
      await updateItem(item.id, {
        displayOrder: order - 1
      });
    }
  };

  const handleMoveDown = async (item: Item) => {
    const order = item.displayOrder || 1;
    if (order < items.length) {
      await updateItem(item.id, {
        displayOrder: order + 1
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let success = false;
    if (editingItem) {
      success = await updateItem(editingItem.id, formData);
    } else {
      success = await createItem(formData);
    }
    
    if (success) {
      setIsModalOpen(false);
      setFormData({ name: '', displayOrder: 1 });
      console.log('[ItemManagement] 品目保存成功');
    }
  };

  const columns = [
    { key: 'displayOrder', header: '表示順', label: '表示順', width: '100px' },
    { key: 'name', header: '品目名', label: '品目名' },
    { key: 'itemType', header: '種別', label: '種別', width: '120px' },
    { key: 'createdAt', header: '登録日', label: '登録日', width: '150px' },
    { key: 'actions', header: '操作', label: '操作', width: '200px' }
  ];

  const tableData = filteredItems.map((item: Item) => ({
    displayOrder: item.displayOrder || '-',
    name: item.name,
    itemType: item.category || item.description || '-',
    createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ja-JP') : '-',
    actions: (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleMoveUp(item)}
          disabled={(item.displayOrder || 1) === 1}
          title="上に移動"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleMoveDown(item)}
          disabled={(item.displayOrder || 1) === items.length}
          title="下に移動"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEditItem(item)}
          title="編集"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => handleDeleteItem(item.id)}
          title="削除"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    )
  }));

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
              品目一覧 ({filteredItems.length}件)
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
        onClose={() => setIsModalOpen(false)}
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
              表示順
            </label>
            <Input
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
              min="1"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
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