// frontend/cms/src/pages/InspectionItemManagement.tsx - 完全書き換え版
// 🎯 Vehicle/UserManagementと完全に統一されたパターン
// ✅ 専用Store（useInspectionItemStore）を使用
// ✅ すべての標準機能を実装
// ✅ 独自機能: 順序変更（上下移動ボタン）

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
    // selectedItem,       // ← Storeで管理
    isLoading,          // ← 統一命名（inspectionLoading → isLoading）
    error,              // ← 統一命名（inspectionError → error）
    filters,            // ← 追加
    pagination,         // ← ✅追加: ページ変更検知に必要
    fetchItems,         // ← 統一命名（fetchInspectionItems → fetchItems）
    createItem,         // ← 統一命名（createInspectionItem → createItem）
    updateItem,         // ← 統一命名（updateInspectionItem → updateItem）
    deleteItem,         // ← 統一命名（deleteInspectionItem → deleteItem）
    updateOrder,        // ← 統一命名（updateInspectionOrder → updateOrder）
    setFilters,         // ← 追加（Vehicle/UserStoreと統一）
    clearError,         // ← 統一命名（clearErrors → clearError）
    // clearSelectedItem,  // ← 追加（Storeで管理）
  } = useInspectionItemStore();

  // ==========================================
  // ローカルステート
  // ==========================================
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

  // ==========================================
  // 初期化とデータ取得（✅ 無限ループ解消版）
  // ==========================================
  
  /**
   * ✅ 修正1: ページ初期化時のみデータを取得
   * 依存配列を空にすることで、初回マウント時のみ実行
   * UserManagementパターン採用
   */
  useEffect(() => {
    console.log('[InspectionItemManagement] 初期データ取得');
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← 空の依存配列 = 初回マウント時のみ

  /**
   * ✅ 修正2: ページ変更時のみデータ再取得
   * useRefで前回のページ番号を記憶し、変更時のみfetchItemsを実行
   * UserManagementパターン採用
   */
  const prevPageRef = useRef(pagination.page);
  useEffect(() => {
    if (prevPageRef.current !== pagination.page) {
      console.log('[InspectionItemManagement] ページ変更検知:', {
        prev: prevPageRef.current,
        current: pagination.page
      });
      prevPageRef.current = pagination.page;
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]); // ← fetchItemsは依存配列に入れない

  /**
   * ✅ 修正3: フィルター変更時のみデータ再取得
   * useRefで前回のフィルターをJSON文字列として記憶し、変更時のみfetchItemsを実行
   * UserManagementパターン採用
   */
  const prevFiltersRef = useRef<string>('');
  useEffect(() => {
    const filtersString = JSON.stringify(filters);
    if (prevFiltersRef.current && prevFiltersRef.current !== filtersString) {
      console.log('[InspectionItemManagement] フィルター変更検知:', {
        prev: prevFiltersRef.current,
        current: filtersString
      });
      fetchItems();
    }
    prevFiltersRef.current = filtersString;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]); // ← fetchItemsは依存配列に入れない

  /**
   * ✅ 修正4: タブ変更時にフィルターを更新
   * カテゴリフィルターをStoreに反映
   * これによりuseEffect(修正3)が発火してデータが再取得される
   */
  useEffect(() => {
    console.log('[InspectionItemManagement] タブ変更:', activeTab);
    setFilters({ category: activeTab });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // ← setFiltersは依存配列に入れない

  /**
   * エラー処理（統一パターン）
   */
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // ==========================================
  // データフィルタリング
  // ==========================================
  
  /**
   * カテゴリ別にアイテムをフィルタリング
   * Store内のitemsから現在のタブに該当するものだけを抽出
   */
  const filteredItems = items.filter(item => item.category === activeTab);

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
              disabled={index === filteredItems.length - 1}
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

  // ==========================================
  // フォーム処理
  // ==========================================
  
  /**
   * フォームバリデーション
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = '項目名は必須です';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * フォームをリセット
   */
  const resetForm = () => {
    setFormData({
      name: '',
      type: 'checkbox',
      category: activeTab,
      isRequired: true,
    });
    setFormErrors({});
  };

  // ==========================================
  // 順序変更処理（独自機能）
  // ==========================================
  
  /**
   * 項目を上に移動
   * 前の項目とorder値を交換
   */
  const handleMoveUp = async (index: number) => {
    if (index === 0) {
      console.warn('[InspectionItemManagement] 既に最上位です');
      return;
    }
    
    const items = [...filteredItems];
    const currentItem = items[index];
    const previousItem = items[index - 1];
    
    console.log('[InspectionItemManagement] 上に移動:', {
      current: currentItem.name,
      previous: previousItem.name,
    });
    
    // order のデフォルト値を設定
    const currentOrder = currentItem.order ?? index + 1;
    const previousOrder = previousItem.order ?? index;
    
    // 順序を交換
    const updates = [
      { id: currentItem.id, order: previousOrder },
      { id: previousItem.id, order: currentOrder },
    ];
    
    const success = await updateOrder(updates);
    if (success) {
      toast.success('順序を更新しました');
    }
  };

  /**
   * 項目を下に移動
   * 次の項目とorder値を交換
   */
  const handleMoveDown = async (index: number) => {
    if (index === filteredItems.length - 1) {
      console.warn('[InspectionItemManagement] 既に最下位です');
      return;
    }
    
    const items = [...filteredItems];
    const currentItem = items[index];
    const nextItem = items[index + 1];
    
    console.log('[InspectionItemManagement] 下に移動:', {
      current: currentItem.name,
      next: nextItem.name,
    });
    
    // order のデフォルト値を設定
    const currentOrder = currentItem.order ?? index + 1;
    const nextOrder = nextItem.order ?? index + 2;
    
    // 順序を交換
    const updates = [
      { id: currentItem.id, order: nextOrder },
      { id: nextItem.id, order: currentOrder },
    ];
    
    const success = await updateOrder(updates);
    if (success) {
      toast.success('順序を更新しました');
    }
  };

  // ==========================================
  // CRUD操作ハンドラー（統一パターン）
  // ==========================================
  
  /**
   * 新規作成モーダルを開く
   */
  const handleCreate = () => {
    console.log('[InspectionItemManagement] 新規作成モーダルを開く');
    resetForm();
    setFormData(prev => ({ ...prev, category: activeTab }));
    setShowCreateModal(true);
  };

  /**
   * 編集モーダルを開く
   */
  const handleEdit = (item: InspectionItem) => {
    console.log('[InspectionItemManagement] 編集モーダルを開く:', item);
    
    // フォームデータを設定（undefined のデフォルト値を設定）
    setFormData({
      name: item.name,
      type: (item.type as 'checkbox' | 'input') || 'checkbox',
      category: item.category || 'pre',
      isRequired: item.isRequired ?? true,
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

    // undefined を除外して最大値を計算
    const orderValues = filteredItems
      .map(item => item.order)
      .filter((order): order is number => order !== undefined);
    const maxOrder = orderValues.length > 0 ? Math.max(...orderValues) : 0;

    console.log('[InspectionItemManagement] 新規作成データ:', {
      ...formData,
      order: maxOrder + 1,
    });

    const success = await createItem({
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
      {/* ==========================================
          ページヘッダー
          ========================================== */}
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

      {/* ==========================================
          タブメニュー
          ========================================== */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('pre')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pre'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              乗車前点検項目 ({items.filter(item => item.category === 'pre').length}件)
            </button>
            <button
              onClick={() => setActiveTab('post')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'post'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              乗車後点検項目 ({items.filter(item => item.category === 'post').length}件)
            </button>
          </nav>
        </div>

        {/* ==========================================
            点検項目一覧テーブル
            ========================================== */}
        <div className="p-6">
          <Table
            data={filteredItems}
            columns={columns}
            loading={isLoading}
            emptyMessage="点検項目が登録されていません"
          />
        </div>
      </div>

      {/* ==========================================
          新規作成モーダル
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

      {/* ==========================================
          編集モーダル
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

      {/* ==========================================
          削除確認ダイアログ
          ========================================== */}
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
        loading={isLoading}
      />
    </div>
  );
};

export default InspectionItemManagement;