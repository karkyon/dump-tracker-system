// frontend/cms/src/pages/InspectionItemManagement.tsx - 完全修正版
// 🎯 Vehicle/UserManagementと完全に統一されたパターン
// ✅ 専用Store（useInspectionItemStore）を使用
// ✅ すべての標準機能を実装
// ✅ 独自機能: 順序変更（上下移動ボタン）
// 🐛 修正1: ソート機能実装
// 🐛 修正2: 編集モーダルに順番項目追加
// 🐛 修正3: バックエンドフィールド名修正 (type→inputType, INPUT→TEXT)
// 🐛 修正4: 無限ループ修正 (useRefパターン使用)
// 🐛 修正5: 順序更新を個別update APIで実装

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
    filters,            // ← 追加
    pagination,         // ← ✅追加: ページ変更検知に必要
    fetchItems,         // ← 統一命名（fetchInspectionItems → fetchItems）
    createItem,         // ← 統一命名（createInspectionItem → createItem）
    updateItem,         // ← 統一命名（updateInspectionItem → updateItem）
    deleteItem,         // ← 統一命名（deleteInspectionItem → deleteItem）
    setFilters,         // ← 追加（Vehicle/UserStoreと統一）
    setPage,            // ← 追加（ページネーション）
    clearError,         // ← 統一命名（clearErrors → clearError）
  } = useInspectionItemStore();

  // ==========================================
  // ローカル状態（UIのみ）
  // ==========================================
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pre' | 'post'>('pre');
  
  // 🐛 修正1: ソート状態
  const [sortKey, setSortKey] = useState<string>('order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // フォーム状態
  const [formData, setFormData] = useState<{
    name: string;
    inputType: 'CHECKBOX' | 'TEXT';  // 🐛 修正3: INPUT → TEXT
    category: 'pre' | 'post';
    order: number;  // 🐛 修正2: 追加
    isRequired: boolean;
  }>({
    name: '',
    inputType: 'CHECKBOX',
    category: 'pre',
    order: 0,  // 🐛 修正2: デフォルト値
    isRequired: true,
  });

  const [formErrors, setFormErrors] = useState<{
    name?: string;
    order?: string;  // 🐛 修正2: 追加
  }>({});

  // 🐛 修正4: useRefで前回の値を追跡（無限ループ防止）
  const prevFiltersRef = useRef<string>('');
  const prevPageRef = useRef<number>(1);
  const isFirstMountRef = useRef(true);

  // ==========================================
  // エラー処理（統一パターン）
  // ==========================================
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // ==========================================
  // データ取得（統一パターン + 無限ループ修正）
  // ==========================================
  
  /**
   * 初回マウント時のデータ取得
   */
  useEffect(() => {
    console.log('[InspectionItemManagement] 初期データ取得');
    fetchItems();
    isFirstMountRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // 空配列 = 初回マウント時のみ

  /**
   * 🐛 修正4: タブ変更時のデータ取得（useRefパターン）
   */
  useEffect(() => {
    // 初回マウントはスキップ
    if (isFirstMountRef.current) return;

    const filtersString = JSON.stringify(filters);
    const hasChanged = prevFiltersRef.current !== filtersString;

    if (hasChanged) {
      console.log('[InspectionItemManagement] フィルター変更検知:', filters);
      prevFiltersRef.current = filtersString;
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);  // fetchItemsは依存配列に入れない（無限ループ防止）

  /**
   * 🐛 修正4: ページ変更時のデータ取得（useRefパターン）
   */
  useEffect(() => {
    // 初回マウントはスキップ
    if (isFirstMountRef.current) return;

    const hasChanged = prevPageRef.current !== pagination.page;

    if (hasChanged) {
      console.log('[InspectionItemManagement] ページ変更検知:', pagination.page);
      prevPageRef.current = pagination.page;
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]);  // fetchItemsは依存配列に入れない（無限ループ防止）

  // ==========================================
  // UI操作ハンドラー
  // ==========================================
  
  /**
   * タブ切り替え
   */
  const handleTabChange = (tab: 'pre' | 'post') => {
    console.log('[InspectionItemManagement] タブ変更:', tab);
    setActiveTab(tab);
    setFilters({ category: tab });
  };

  /**
   * フォームリセット
   */
  const resetForm = () => {
    setFormData({
      name: '',
      inputType: 'CHECKBOX',
      category: activeTab,
      order: 0,  // 🐛 修正2: リセット
      isRequired: true,
    });
    setFormErrors({});
  };

  /**
   * バリデーション
   */
  const validateForm = (): boolean => {
    const errors: { name?: string; order?: string } = {};

    if (!formData.name.trim()) {
      errors.name = '項目名は必須です';
    }

    // 🐛 修正2: 順番のバリデーション
    if (formData.order < 0) {
      errors.order = '順番は0以上の数値を指定してください';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * 作成モーダルを開く
   */
  const handleCreate = () => {
    console.log('[InspectionItemManagement] 作成モーダルを開く');
    resetForm();
    setShowCreateModal(true);
  };

  /**
   * 編集モーダルを開く
   */
  const handleEdit = (item: InspectionItem) => {
    console.log('[InspectionItemManagement] 編集モーダルを開く:', item);
    setFormData({
      name: item.name,
      inputType: item.inputType as 'CHECKBOX' | 'TEXT',  // 🐛 修正3: type → inputType
      category: item.category || 'pre',
      isRequired: item.isRequired ?? true,
      order: item.order ?? 0,  // 🐛 修正2: order追加
    });
    setSelectedItemId(item.id);
    setFormErrors({});
    setShowEditModal(true);
  };

  /**
   * 削除確認ダイアログを開く
   */
  const handleDelete = (itemId: string) => {
    console.log('[InspectionItemManagement] 削除確認ダイアログを開く:', itemId);
    setSelectedItemId(itemId);
    setShowDeleteDialog(true);
  };

  /**
   * 作成処理を実行
   */
  const handleSubmitCreate = async () => {
    console.log('[InspectionItemManagement] 作成処理開始');
    
    if (!validateForm()) {
      console.warn('[InspectionItemManagement] バリデーションエラー');
      return;
    }

    console.log('[InspectionItemManagement] 新規作成データ:', formData);

    const success = await createItem({
      name: formData.name,
      inputType: formData.inputType,  // 🐛 修正3: type → inputType, TEXT値使用
      category: formData.category,
      order: formData.order,
      isRequired: formData.isRequired,
    });

    if (success) {
      toast.success('点検項目を追加しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  /**
   * 更新処理を実行
   */
  const handleSubmitEdit = async () => {
    console.log('[InspectionItemManagement] 更新処理開始');
    
    if (!validateForm() || !selectedItemId) {
      console.warn('[InspectionItemManagement] バリデーションエラーまたはIDなし');
      return;
    }

    console.log('[InspectionItemManagement] 更新データ:', {
      id: selectedItemId,
      data: formData,
    });

    const success = await updateItem(selectedItemId, {
      name: formData.name,
      inputType: formData.inputType,  // 🐛 修正3: type → inputType, TEXT値使用
      category: formData.category,
      order: formData.order,  // 🐛 修正2: order追加
      isRequired: formData.isRequired,
    });

    if (success) {
      toast.success('点検項目を更新しました');
      setShowEditModal(false);
      resetForm();
      setSelectedItemId(null);
    }
  };

  /**
   * 削除処理を実行
   */
  const handleConfirmDelete = async () => {
    console.log('[InspectionItemManagement] 削除処理開始:', selectedItemId);
    
    if (!selectedItemId) {
      console.warn('[InspectionItemManagement] 削除対象IDがありません');
      return;
    }

    const success = await deleteItem(selectedItemId);

    if (success) {
      toast.success('点検項目を削除しました');
      setShowDeleteDialog(false);
      setSelectedItemId(null);
    }
  };

  // ==========================================
  // 🐛 修正5: 順序変更（個別update APIで実装）
  // ==========================================
  
  /**
   * 上に移動
   */
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    
    console.log('[InspectionItemManagement] 上に移動:', filteredItems[index].name);
    
    const currentItem = filteredItems[index];
    const aboveItem = filteredItems[index - 1];
    
    // 2つのアイテムの順序を入れ替え
    const success = await Promise.all([
      updateItem(currentItem.id, { order: aboveItem.order }),
      updateItem(aboveItem.id, { order: currentItem.order }),
    ]);
    
    if (success.every(s => s)) {
      toast.success('順序を変更しました');
    }
  };

  /**
   * 下に移動
   */
  const handleMoveDown = async (index: number) => {
    if (index === filteredItems.length - 1) return;
    
    console.log('[InspectionItemManagement] 下に移動:', filteredItems[index].name);
    
    const currentItem = filteredItems[index];
    const belowItem = filteredItems[index + 1];
    
    // 2つのアイテムの順序を入れ替え
    const success = await Promise.all([
      updateItem(currentItem.id, { order: belowItem.order }),
      updateItem(belowItem.id, { order: currentItem.order }),
    ]);
    
    if (success.every(s => s)) {
      toast.success('順序を変更しました');
    }
  };

  // ==========================================
  // データ整形
  // ==========================================
  
  /**
   * 現在のタブに応じたフィルター済みアイテム
   */
  const filteredItems = items.filter((item) => {
    if (activeTab === 'pre') {
      return item.category === 'pre' || !item.category;
    }
    return item.category === 'post';
  });

  /**
   * 🐛 修正1: ソート済みアイテム
   */
  const sortedItems = React.useMemo(() => {
    if (!sortKey) return filteredItems;
    
    return [...filteredItems].sort((a, b) => {
      const aValue = a[sortKey as keyof InspectionItem];
      const bValue = b[sortKey as keyof InspectionItem];
      
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortKey, sortOrder]);

  /**
   * 🐛 修正1: ソートハンドラー
   * 列ヘッダーをクリックした時にソート順を切り替える
   */
  const handleSort = (key: string) => {
    console.log('[InspectionItemManagement] ソート:', key);
    if (sortKey === key) {
      // 同じキーをクリックした場合は昇順/降順を切り替え
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 新しいキーの場合は昇順に設定
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // ==========================================
  // テーブル定義
  // ==========================================
  
  /**
   * テーブルの列定義
   * Vehicle/UserManagementと同じパターン
   */
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
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
              title="上に移動"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleMoveDown(index)}
              disabled={index === sortedItems.length - 1}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
              title="下に移動"
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
      onSort: () => handleSort('name'),  // 🐛 修正1: ソートハンドラー追加
    },
    {
      key: 'inputType',  // 🐛 修正3: type → inputType
      header: '入力タイプ',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'CHECKBOX' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {value === 'CHECKBOX' ? 'チェックボックス' : '入力フィールド'}
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
      width: '150px',
      render: (_: any, item: InspectionItem) => (
        <ActionButtons
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item.id)}
        />
      ),
    },
  ];

  // ==========================================
  // レンダリング
  // ==========================================
  
  /**
   * 初回ローディング表示
   */
  if (isLoading && items.length === 0) {
    return <SectionLoading text="点検項目を読み込み中..." />;
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">点検項目管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            点検項目の追加・編集・削除ができます
          </p>
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={handleCreate}
        >
          点検項目追加
        </Button>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('pre')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
              ${activeTab === 'pre'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            乗車前点検
          </button>
          <button
            onClick={() => handleTabChange('post')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
              ${activeTab === 'post'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            乗車後点検
          </button>
        </nav>
      </div>

      {/* テーブル */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <Table
          columns={columns}
          data={sortedItems}
          loading={isLoading}
          emptyMessage={`${activeTab === 'pre' ? '乗車前' : '乗車後'}点検項目がありません`}
          pagination={{
            currentPage: pagination.page,
            totalPages: pagination.totalPages,
            onPageChange: setPage,
          }}
        />
      </div>

      {/* ==========================================
          作成モーダル
          🐛 修正2: 順番入力フィールド追加
          🐛 修正3: inputType に変更、TEXT値使用
          ========================================== */}
      <FormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title={`${activeTab === 'pre' ? '乗車前' : '乗車後'}点検項目追加`}
        onSubmit={handleSubmitCreate}
        loading={isLoading}
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
          
          {/* 🐛 修正3: inputType に変更、TEXT値使用 */}
          <Select
            label="入力タイプ"
            options={[
              { value: 'CHECKBOX', label: 'チェックボックス' },
              { value: 'TEXT', label: '入力フィールド' },  // INPUT → TEXT
            ]}
            value={formData.inputType}
            onChange={(e) => setFormData({ ...formData, inputType: e.target.value as 'CHECKBOX' | 'TEXT' })}
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
          
          {/* 🐛 修正2: 順番入力フィールド追加 */}
          <Input
            label="順番"
            type="number"
            value={formData.order.toString()}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            error={formErrors.order}
            min="0"
            required
            helpText="表示順序を指定します（0以上の整数）"
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

      {/* ==========================================
          編集モーダル
          🐛 修正2: 順番入力フィールド追加
          🐛 修正3: inputType に変更、TEXT値使用
          ========================================== */}
      <FormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
          setSelectedItemId(null);
        }}
        title="点検項目編集"
        onSubmit={handleSubmitEdit}
        loading={isLoading}
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
          
          {/* 🐛 修正3: inputType に変更、TEXT値使用 */}
          <Select
            label="入力タイプ"
            options={[
              { value: 'CHECKBOX', label: 'チェックボックス' },
              { value: 'TEXT', label: '入力フィールド' },  // INPUT → TEXT
            ]}
            value={formData.inputType}
            onChange={(e) => setFormData({ ...formData, inputType: e.target.value as 'CHECKBOX' | 'TEXT' })}
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
          
          {/* 🐛 修正2: 順番入力フィールド追加 */}
          <Input
            label="順番"
            type="number"
            value={formData.order.toString()}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            error={formErrors.order}
            min="0"
            required
            helpText="表示順序を指定します（0以上の整数）"
          />
          
          <div className="flex items-center">
            <input
              id="isRequired-edit"
              name="isRequired"
              type="checkbox"
              checked={formData.isRequired}
              onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isRequired-edit" className="ml-2 block text-sm text-gray-900">
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
        title="点検項目の削除"
        message="この点検項目を削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除"
        cancelText="キャンセル"
        variant="danger"
      />
    </div>
  );
};

export default InspectionItemManagement;