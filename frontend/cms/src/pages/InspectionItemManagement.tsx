import React, { useEffect, useState } from 'react';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMasterStore } from '../store/masterStore';
import { InspectionItem } from '../types';
import Button from '../components/common/Button';
import Input, { Select } from '../components/common/Input';
import Table, { ActionButtons } from '../components/common/Table';
import { FormModal, ConfirmDialog } from '../components/common/Modal';
import { SectionLoading } from '../components/ui/LoadingSpinner';

const InspectionItemManagement: React.FC = () => {
  const {
    inspectionItems,
    inspectionLoading,
    inspectionError,
    fetchInspectionItems,
    createInspectionItem,
    updateInspectionItem,
    deleteInspectionItem,
    updateInspectionOrder,
    clearErrors,
  } = useMasterStore();

  const [activeTab, setActiveTab] = useState<'pre' | 'post'>('pre');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // フォームデータ
  const [formData, setFormData] = useState({
    name: '',
    type: 'checkbox' as 'checkbox' | 'input',
    category: 'pre' as 'pre' | 'post',
    isRequired: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ページ初期化時にデータを取得
  useEffect(() => {
    fetchInspectionItems();
  }, [fetchInspectionItems]);

  // エラー処理
  useEffect(() => {
    if (inspectionError) {
      toast.error(inspectionError);
      clearErrors();
    }
  }, [inspectionError, clearErrors]);

  // カテゴリ別にアイテムをフィルタリング
  const filteredItems = inspectionItems.filter(item => item.category === activeTab);

  // テーブルの列定義
  const columns = [
    {
      key: 'order',
      header: '順番',
      width: '80px',
      render: (_: any, item: InspectionItem, index: number) => (
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium">{item.order}</span>
          <div className="flex flex-col">
            <button
              onClick={() => handleMoveUp(item, index)}
              disabled={index === 0}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleMoveDown(item, index)}
              disabled={index === filteredItems.length - 1}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'name',
      header: '項目名',
      sortable: true,
    },
    {
      key: 'type',
      header: '入力タイプ',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'checkbox' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {value === 'checkbox' ? 'チェックボックス' : '入力フィールド'}
        </span>
      ),
    },
    {
      key: 'isRequired',
      header: '必須',
      render: (value: boolean) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value ? '必須' : '任意'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      render: (_: any, item: InspectionItem) => (
        <ActionButtons
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item.id)}
        />
      ),
    },
  ];

  // フォームバリデーション
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = '項目名は必須です';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      name: '',
      type: 'checkbox',
      category: activeTab,
      isRequired: true,
    });
    setFormErrors({});
  };

  // 順序の変更
  const handleMoveUp = async (item: InspectionItem, index: number) => {
    if (index === 0) return;
    
    const items = [...filteredItems];
    const currentItem = items[index];
    const previousItem = items[index - 1];
    
    // 順序を交換
    const updates = [
      { id: currentItem.id, order: previousItem.order },
      { id: previousItem.id, order: currentItem.order },
    ];
    
    const success = await updateInspectionOrder(updates);
    if (success) {
      toast.success('順序を更新しました');
    }
  };

  const handleMoveDown = async (item: InspectionItem, index: number) => {
    if (index === filteredItems.length - 1) return;
    
    const items = [...filteredItems];
    const currentItem = items[index];
    const nextItem = items[index + 1];
    
    // 順序を交換
    const updates = [
      { id: currentItem.id, order: nextItem.order },
      { id: nextItem.id, order: currentItem.order },
    ];
    
    const success = await updateInspectionOrder(updates);
    if (success) {
      toast.success('順序を更新しました');
    }
  };

  // 新規作成
  const handleCreate = () => {
    resetForm();
    setFormData(prev => ({ ...prev, category: activeTab }));
    setShowCreateModal(true);
  };

  // 編集
  const handleEdit = (item: InspectionItem) => {
    setFormData({
      name: item.name,
      type: item.type,
      category: item.category,
      isRequired: item.isRequired,
    });
    setSelectedItemId(item.id);
    setFormErrors({});
    setShowEditModal(true);
  };

  // 削除
  const handleDelete = (itemId: string) => {
    setSelectedItemId(itemId);
    setShowDeleteDialog(true);
  };

  // 作成処理
  const handleSubmitCreate = async () => {
    if (!validateForm()) return;

    // 新しい項目の順序を計算
    const maxOrder = Math.max(...filteredItems.map(item => item.order), 0);

    const success = await createInspectionItem({
      name: formData.name,
      type: formData.type,
      category: formData.category,
      order: maxOrder + 1,
      isRequired: formData.isRequired,
    });

    if (success) {
      toast.success('点検項目を追加しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  // 更新処理
  const handleSubmitEdit = async () => {
    if (!validateForm() || !selectedItemId) return;

    const success = await updateInspectionItem(selectedItemId, {
      name: formData.name,
      type: formData.type,
      category: formData.category,
      isRequired: formData.isRequired,
    });

    if (success) {
      toast.success('点検項目を更新しました');
      setShowEditModal(false);
      resetForm();
      setSelectedItemId(null);
    }
  };

  // 削除処理
  const handleConfirmDelete = async () => {
    if (!selectedItemId) return;

    const success = await deleteInspectionItem(selectedItemId);

    if (success) {
      toast.success('点検項目を削除しました');
      setShowDeleteDialog(false);
      setSelectedItemId(null);
    }
  };

  if (inspectionLoading && inspectionItems.length === 0) {
    return <SectionLoading text="点検項目を読み込み中..." />;
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">点検項目マスタ管理</h1>
          <p className="mt-2 text-sm text-gray-700">
            乗車前・乗車後の点検項目の追加・編集・削除・順序変更を行います
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button
            variant="primary"
            onClick={handleCreate}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            項目追加
          </Button>
        </div>
      </div>

      {/* タブメニュー */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('pre')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'pre'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              乗車前点検項目 ({inspectionItems.filter(item => item.category === 'pre').length}件)
            </button>
            <button
              onClick={() => setActiveTab('post')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'post'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              乗車後点検項目 ({inspectionItems.filter(item => item.category === 'post').length}件)
            </button>
          </nav>
        </div>

        {/* 点検項目一覧テーブル */}
        <div className="p-6">
          <Table
            data={filteredItems}
            columns={columns}
            loading={inspectionLoading}
            emptyMessage="点検項目が登録されていません"
          />
        </div>
      </div>

      {/* 新規作成モーダル */}
      <FormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title={`${activeTab === 'pre' ? '乗車前' : '乗車後'}点検項目追加`}
        onSubmit={handleSubmitCreate}
        loading={inspectionLoading}
        size="md"
      >
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="項目名"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            placeholder="例: エンジンオイル"
            required
          />
          
          <Select
            label="入力タイプ"
            options={[
              { value: 'checkbox', label: 'チェックボックス' },
              { value: 'input', label: '入力フィールド' },
            ]}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'checkbox' | 'input' })}
            required
          />
          
          <Select
            label="カテゴリ"
            options={[
              { value: 'pre', label: '乗車前点検' },
              { value: 'post', label: '乗車後点検' },
            ]}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as 'pre' | 'post' })}
            required
          />
          
          <div className="flex items-center">
            <input
              id="isRequired"
              name="isRequired"
              type="checkbox"
              checked={formData.isRequired}
              onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isRequired" className="ml-2 block text-sm text-gray-900">
              必須項目にする
            </label>
          </div>
        </div>
      </FormModal>

      {/* 編集モーダル */}
      <FormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
          setSelectedItemId(null);
        }}
        title="点検項目編集"
        onSubmit={handleSubmitEdit}
        loading={inspectionLoading}
        size="md"
      >
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="項目名"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          
          <Select
            label="入力タイプ"
            options={[
              { value: 'checkbox', label: 'チェックボックス' },
              { value: 'input', label: '入力フィールド' },
            ]}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'checkbox' | 'input' })}
            required
          />
          
          <Select
            label="カテゴリ"
            options={[
              { value: 'pre', label: '乗車前点検' },
              { value: 'post', label: '乗車後点検' },
            ]}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as 'pre' | 'post' })}
            required
          />
          
          <div className="flex items-center">
            <input
              id="isRequiredEdit"
              name="isRequiredEdit"
              type="checkbox"
              checked={formData.isRequired}
              onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isRequiredEdit" className="ml-2 block text-sm text-gray-900">
              必須項目にする
            </label>
          </div>
        </div>
      </FormModal>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedItemId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="点検項目削除"
        message="この点検項目を削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除"
        variant="danger"
        loading={inspectionLoading}
      />
    </div>
  );
};

export default InspectionItemManagement;