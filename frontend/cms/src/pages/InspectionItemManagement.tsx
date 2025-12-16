// frontend/cms/src/pages/InspectionItemManagement.tsx - 完全書き換え版
// 🎯 Vehicle/UserManagementと完全に統一されたパターン
// ✅ 専用Store（useInspectionItemStore）を使用
// ✅ すべての標準機能を実装
// ✅ 独自機能: 順序変更（上下移動ボタン）
// 🐛 修正1: ソート機能実装
// 🐛 修正2: 編集モーダルに順番項目追加
// 🐛 修正3: バックエンドフィールド名修正 (type→inputType, 大文字変換)
// 🐛 修正4: Button icon プロパティ削除（存在しないため）
// 🐛 修正5: Input helpText → helperText に修正
// 🐛 修正6: Table pagination プロパティ削除（存在しないため）

import React, { useEffect, useState, useRef } from 'react';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useInspectionItemStore } from '../store/inspectionItemStore';
import { InspectionItem } from '../types';
import Button from '../components/common/Button';
import Input, { Select } from '../components/common/Input';
import Table, { ActionButtons } from '../components/common/Table';
import { FormModal, ConfirmDialog } from '../components/common/Modal';
import { SectionLoading } from '../components/ui/LoadingSpinner';

const InspectionItemManagement: React.FC = () => {
  // ==========================================
  // Store接続（統一パターン）
  // ==========================================
  const {
    items,              // ← 統一命名（inspectionItems → items）
    isLoading,          // ← 統一命名（inspectionLoading → isLoading）
    error,              // ← 統一命名（inspectionError → error）
    pagination,         // ← ✅追加: ページ変更検知に必要
    fetchItems,         // ← 統一命名（fetchInspectionItems → fetchItems）
    createItem,         // ← 統一命名（createInspectionItem → createItem）
    updateItem,         // ← 統一命名（updateInspectionItem → updateItem）
    deleteItem,         // ← 統一命名（deleteInspectionItem → deleteItem）
    updateOrder,        // ← 統一命名（updateInspectionOrder → updateOrder）
  } = useInspectionItemStore();

  // ==========================================
  // ローカル状態管理
  // ==========================================
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<InspectionItem | null>(null);
  const [selectedItemForDelete, setSelectedItemForDelete] = useState<InspectionItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pre' | 'post'>('all');
  
  // 🐛 修正1: ソート状態を追加
  const [sortBy, setSortBy] = useState<'order' | 'name' | 'createdAt'>('order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // フォームデータ
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    inputType: 'CHECKBOX' as 'CHECKBOX' | 'TEXT' | 'NUMBER' | 'SELECT' | 'TEXTAREA',  // 🐛 修正3: type → inputType
    category: 'pre' as 'pre' | 'post',
    order: 0,  // 🐛 修正2: 順番項目追加
    isRequired: true,
    isActive: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Refを使ってページネーション変更検知
  const prevPaginationRef = useRef(pagination);

  // ==========================================
  // 初回データ取得 & ページネーション変更検知（分離）
  // ==========================================
  
  // 初回マウント時のみデータ取得
  useEffect(() => {
    console.log('[InspectionItemManagement] 初回マウント - データ取得開始');
    fetchItems();
  }, []); // ← 空の依存配列（初回のみ実行）

  // ページネーション変更検知用の独立したuseEffect
  useEffect(() => {
    const prevPage = prevPaginationRef.current.page;
    const currentPage = pagination.page;

    // ページが実際に変更された場合のみ再取得
    if (prevPage !== currentPage && currentPage > 0) {
      console.log('[InspectionItemManagement] ページ変更検知', {
        from: prevPage,
        to: currentPage,
      });
      fetchItems();
    }

    // 現在のページネーション状態を保存
    prevPaginationRef.current = pagination;
  }, [pagination.page]); // ← pagination.pageのみを監視

  // ==========================================
  // フィルタリング & ソート処理
  // ==========================================
  const filteredAndSortedItems = React.useMemo(() => {
    let result = [...items];

    // 検索フィルター
    if (searchQuery) {
      result = result.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // カテゴリフィルター
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }

    // 🐛 修正1: ソート処理を追加
    result.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'order':
          compareValue = (a.order ?? 0) - (b.order ?? 0);
          break;
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return result;
  }, [items, searchQuery, categoryFilter, sortBy, sortOrder]);

  // ==========================================
  // モーダル制御
  // ==========================================
  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      inputType: 'CHECKBOX',  // 🐛 修正3: type → inputType
      category: 'pre',
      order: items.length > 0 ? Math.max(...items.map(i => i.order ?? 0)) + 1 : 1,  // 🐛 修正2: 自動採番
      isRequired: true,
      isActive: true,
    });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (item: InspectionItem) => {
    setSelectedItemForEdit(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      inputType: (item.inputType || item.type || 'CHECKBOX') as 'CHECKBOX' | 'TEXT' | 'NUMBER' | 'SELECT' | 'TEXTAREA',
      category: item.category || 'pre',
      order: item.order ?? 0,  // 🐛 修正2: 順番を表示
      isRequired: item.isRequired ?? true,
      isActive: item.isActive ?? true,
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteDialog = (item: InspectionItem) => {
    setSelectedItemForDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseModals = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteDialogOpen(false);
    setSelectedItemForEdit(null);
    setSelectedItemForDelete(null);
    setFormData({
      name: '',
      description: '',
      inputType: 'CHECKBOX',  // 🐛 修正3: type → inputType
      category: 'pre',
      order: 0,
      isRequired: true,
      isActive: true,
    });
    setFormErrors({});
  };

  // ==========================================
  // フォームバリデーション
  // ==========================================
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = '点検項目名は必須です';
    }

    if (formData.order < 0) {
      errors.order = '表示順序は0以上である必要があります';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ==========================================
  // CRUD操作
  // ==========================================
  const handleCreate = async () => {
    if (!validateForm()) {
      toast.error('入力内容を確認してください');
      return;
    }

    try {
      const success = await createItem({
        name: formData.name,
        description: formData.description || undefined,
        inputType: formData.inputType,  // 🐛 修正3: type → inputType, TEXT値使用
        category: formData.category,
        order: formData.order,
        isRequired: formData.isRequired,
        isActive: formData.isActive,
      });

      if (success) {
        toast.success('点検項目を作成しました');
        handleCloseModals();
      } else {
        toast.error(error || '点検項目の作成に失敗しました');
      }
    } catch (err) {
      console.error('点検項目作成エラー:', err);
      toast.error('点検項目の作成に失敗しました');
    }
  };

  const handleUpdate = async () => {
    if (!selectedItemForEdit || !validateForm()) {
      toast.error('入力内容を確認してください');
      return;
    }

    try {
      const success = await updateItem(selectedItemForEdit.id, {
        name: formData.name,
        description: formData.description || undefined,
        inputType: formData.inputType,  // 🐛 修正3: type → inputType, TEXT値使用
        category: formData.category,
        order: formData.order,
        isRequired: formData.isRequired,
        isActive: formData.isActive,
      });

      if (success) {
        toast.success('点検項目を更新しました');
        handleCloseModals();
      } else {
        toast.error(error || '点検項目の更新に失敗しました');
      }
    } catch (err) {
      console.error('点検項目更新エラー:', err);
      toast.error('点検項目の更新に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!selectedItemForDelete) return;

    try {
      const success = await deleteItem(selectedItemForDelete.id);

      if (success) {
        toast.success('点検項目を削除しました');
        handleCloseModals();
      } else {
        toast.error(error || '点検項目の削除に失敗しました');
      }
    } catch (err) {
      console.error('点検項目削除エラー:', err);
      toast.error('点検項目の削除に失敗しました');
    }
  };

  // ==========================================
  // 順序変更（独自機能）
  // ==========================================
  const handleMoveUp = async (item: InspectionItem, index: number) => {
    if (index === 0) return; // 既に最上位

    const currentItems = [...filteredAndSortedItems];
    const prevItem = currentItems[index - 1];

    try {
      await updateOrder([
        { id: item.id, order: prevItem.order ?? index - 1 },
        { id: prevItem.id, order: item.order ?? index },
      ]);
      toast.success('表示順序を変更しました');
    } catch (err) {
      console.error('順序変更エラー:', err);
      toast.error('順序変更に失敗しました');
    }
  };

  const handleMoveDown = async (item: InspectionItem, index: number) => {
    if (index === filteredAndSortedItems.length - 1) return; // 既に最下位

    const currentItems = [...filteredAndSortedItems];
    const nextItem = currentItems[index + 1];

    try {
      await updateOrder([
        { id: item.id, order: nextItem.order ?? index + 1 },
        { id: nextItem.id, order: item.order ?? index },
      ]);
      toast.success('表示順序を変更しました');
    } catch (err) {
      console.error('順序変更エラー:', err);
      toast.error('順序変更に失敗しました');
    }
  };

  // ==========================================
  // テーブルカラム定義
  // ==========================================
  const columns = [
    {
      key: 'order',
      header: '順序',
      width: '80px',
      sortable: true,
      render: (_: any, item: InspectionItem, index: number) => (
        <div className="flex items-center gap-1">
          <span>{item.order ?? index + 1}</span>
          <div className="flex flex-col">
            <button
              onClick={() => handleMoveUp(item, index)}
              disabled={index === 0}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleMoveDown(item, index)}
              disabled={index === filteredAndSortedItems.length - 1}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'name',
      header: '点検項目名',
      sortable: true,
    },
    {
      key: 'category',
      header: 'カテゴリ',
      width: '120px',
      render: (value: any) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'pre' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {value === 'pre' ? '運行前' : '運行後'}
        </span>
      ),
    },
    {
      key: 'inputType',
      header: '入力形式',  // 🐛 修正3: type → inputType
      width: '120px',
      render: (value: any, item: InspectionItem) => {
        const displayValue = value || item.type || 'CHECKBOX';
        const typeLabels: Record<string, string> = {
          CHECKBOX: 'チェックボックス',
          TEXT: 'テキスト',
          NUMBER: '数値',
          SELECT: '選択',
          TEXTAREA: 'テキストエリア',
        };
        return typeLabels[displayValue.toUpperCase()] || displayValue;
      },
    },
    {
      key: 'isRequired',
      header: '必須',
      width: '80px',
      render: (value: any) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value ? '必須' : '任意'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: '状態',
      width: '100px',
      render: (value: any) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value ? '有効' : '無効'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      width: '150px',
      render: (_: any, item: InspectionItem) => (
        <ActionButtons
          onEdit={() => handleOpenEditModal(item)}
          onDelete={() => handleOpenDeleteDialog(item)}
        />
      ),
    },
  ];

  // ==========================================
  // レンダリング
  // ==========================================
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">点検項目マスタ管理</h1>
        <Button
          variant="primary"
          onClick={handleOpenCreateModal}
        >
          {/* 🐛 修正4: icon プロパティを削除（Buttonコンポーネントに存在しないため） */}
          <Plus className="w-4 h-4 mr-2" />
          新規作成
        </Button>
      </div>

      {/* フィルター */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            type="text"
            placeholder="点検項目名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'pre' | 'post')}
            options={[
              { value: 'all', label: 'すべてのカテゴリ' },
              { value: 'pre', label: '運行前' },
              { value: 'post', label: '運行後' },
            ]}
          />
          <div className="flex gap-2">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'order' | 'name' | 'createdAt')}
              options={[
                { value: 'order', label: '順序' },
                { value: 'name', label: '名前' },
                { value: 'createdAt', label: '作成日時' },
              ]}
            />
            <Select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              options={[
                { value: 'asc', label: '昇順' },
                { value: 'desc', label: '降順' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* テーブル */}
      {isLoading ? (
        <SectionLoading />
      ) : (
        <div className="bg-white rounded-lg shadow">
          <Table
            columns={columns}
            data={filteredAndSortedItems}
            loading={isLoading}
            emptyMessage="点検項目が見つかりません"
            // 🐛 修正6: pagination プロパティを削除（Tableコンポーネントに存在しないため）
          />
        </div>
      )}

      {/* 作成モーダル */}
      <FormModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModals}
        title="新規点検項目作成"
        onSubmit={handleCreate}
        submitText="作成"
        loading={isLoading}
      >
        <div className="space-y-4">
          <Input
            label="点検項目名"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <Input
            label="説明"
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Select
            label="カテゴリ"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as 'pre' | 'post' })}
            options={[
              { value: 'pre', label: '運行前' },
              { value: 'post', label: '運行後' },
            ]}
            required
          />
          <Select
            label="入力形式"
            value={formData.inputType}
            onChange={(e) => setFormData({ ...formData, inputType: e.target.value as any })}
            options={[
              { value: 'CHECKBOX', label: 'チェックボックス' },
              { value: 'TEXT', label: 'テキスト' },
              { value: 'NUMBER', label: '数値' },
              { value: 'SELECT', label: '選択' },
              { value: 'TEXTAREA', label: 'テキストエリア' },
            ]}
            required
          />
          {/* 🐛 修正2: 順番入力フィールドを追加 */}
          <Input
            label="表示順序"
            type="number"
            value={formData.order.toString()}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            error={formErrors.order}
            min="0"
            required
            helperText="表示順序を指定します(0以上の整数)"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">必須項目</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">有効</span>
            </label>
          </div>
        </div>
      </FormModal>

      {/* 編集モーダル */}
      <FormModal
        isOpen={isEditModalOpen}
        onClose={handleCloseModals}
        title="点検項目編集"
        onSubmit={handleUpdate}
        submitText="更新"
        loading={isLoading}
      >
        <div className="space-y-4">
          <Input
            label="点検項目名"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <Input
            label="説明"
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Select
            label="カテゴリ"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as 'pre' | 'post' })}
            options={[
              { value: 'pre', label: '運行前' },
              { value: 'post', label: '運行後' },
            ]}
            required
          />
          <Select
            label="入力形式"
            value={formData.inputType}
            onChange={(e) => setFormData({ ...formData, inputType: e.target.value as any })}
            options={[
              { value: 'CHECKBOX', label: 'チェックボックス' },
              { value: 'TEXT', label: 'テキスト' },
              { value: 'NUMBER', label: '数値' },
              { value: 'SELECT', label: '選択' },
              { value: 'TEXTAREA', label: 'テキストエリア' },
            ]}
            required
          />
          {/* 🐛 修正2: 順番入力フィールドを追加 */}
          <Input
            label="表示順序"
            type="number"
            value={formData.order.toString()}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            error={formErrors.order}
            min="0"
            required
            helperText="表示順序を指定します(0以上の整数)"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">必須項目</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">有効</span>
            </label>
          </div>
        </div>
      </FormModal>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseModals}
        onConfirm={handleDelete}
        title="点検項目の削除"
        message={`「${selectedItemForDelete?.name}」を削除してもよろしいですか？この操作は取り消せません。`}
        confirmText="削除"
        variant="danger"
        loading={isLoading}
      />
    </div>
  );
};

export default InspectionItemManagement;