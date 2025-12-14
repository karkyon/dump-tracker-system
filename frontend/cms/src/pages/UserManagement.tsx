// frontend/cms/src/pages/UserManagement.tsx - 無限ループ修正版
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../store/userStore';
import { User } from '../types';
import Button from '../components/common/Button';
import Input, { Select } from '../components/common/Input';
import Table, { StatusBadge, ActionButtons } from '../components/common/Table';
import Pagination from '../components/common/Pagination';
import { FormModal, ConfirmDialog } from '../components/common/Modal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';

const UserManagement: React.FC = () => {
  const {
    users,
    isLoading,
    error,
    pagination,
    filters,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    setFilters,
    setPage,
    clearError,
  } = useUserStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // フォームデータ
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    name: '',
    role: 'DRIVER' as 'ADMIN' | 'MANAGER' | 'DRIVER',
    status: 'active' as 'active' | 'inactive',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ✅✅✅ 修正: 初回マウント時のみfetchUsersを実行
  useEffect(() => {
    console.log('[UserManagement] Initial mount - fetching users');
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ 空の依存配列 - マウント時のみ実行

  // ✅✅✅ 修正: ページ変更時にfetchUsersを実行（無限ループ防止）
  const prevPageRef = useRef(pagination.page);
  useEffect(() => {
    if (prevPageRef.current !== pagination.page) {
      console.log('[UserManagement] Page changed:', prevPageRef.current, '->', pagination.page);
      prevPageRef.current = pagination.page;
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]); // ✅ fetchUsersを依存配列から削除

  // ✅✅✅ 修正: フィルター変更時にfetchUsersを実行（無限ループ防止）
  const prevFiltersRef = useRef<string>('');
  useEffect(() => {
    const filtersString = JSON.stringify(filters);
    if (prevFiltersRef.current && prevFiltersRef.current !== filtersString) {
      console.log('[UserManagement] Filters changed - fetching users');
      fetchUsers();
    }
    prevFiltersRef.current = filtersString;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]); // ✅ fetchUsersを依存配列から削除

  // エラー処理
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // ✅✅✅ 修正: 検索処理（デバウンス）- useCallbackでメモ化
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    
    // デバウンス処理
    const timeoutId = setTimeout(() => {
      console.log('[UserManagement] Search term debounced:', term);
      setFilters({ searchTerm: term });
      setPage(1); // 検索時はページを1にリセット
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [setFilters, setPage]);

  // テーブルの列定義
  const columns = [
    {
      key: 'username',
      header: 'ユーザーID',
      sortable: true,
    },
    {
      key: 'name',
      header: '氏名',
      sortable: true,
    },
    {
      key: 'email',
      header: 'メールアドレス',
      sortable: true,
    },
    {
      key: 'role',
      header: '権限',
      render: (value: string) => (
        <StatusBadge 
          status={value} 
          type="user"
        />
      ),
    },
    {
      key: 'isActive',
      header: 'ステータス',
      render: (value: boolean) => (
        <StatusBadge 
          status={value ? 'active' : 'inactive'} 
          type="user"
        />
      ),
    },
    {
      key: 'createdAt',
      header: '作成日',
      render: (value: string) => formatDate(value),
    },
    {
      key: 'lastLoginAt',
      header: '最終ログイン',
      render: (value: string) => value ? formatDate(value) : '-',
    },
    {
      key: 'actions',
      header: '操作',
      render: (_: any, user: User) => (
        <ActionButtons
          onEdit={() => handleEdit(user)}
          onDelete={() => handleDelete(user)}
        />
      ),
    },
  ];

  // フォームバリデーション
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = 'ユーザーIDは必須です';
    }

    if (!formData.email.trim()) {
      errors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    if (!formData.name.trim()) {
      errors.name = '氏名は必須です';
    }

    if (!selectedUserId && !formData.password) {
      errors.password = 'パスワードは必須です';
    }

    if (!selectedUserId && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'パスワードが一致しません';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      name: '',
      role: 'DRIVER',
      status: 'active',
      password: '',
      confirmPassword: '',
    });
    setFormErrors({});
    setSelectedUserId(null);
  };

  // 新規作成
  const handleCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  // 編集
  const handleEdit = (user: User) => {
    setSelectedUserId(user.id);
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name || '',
      role: user.role,
      status: user.isActive ? 'active' : 'inactive',
      password: '',
      confirmPassword: '',
    });
    setShowEditModal(true);
  };

  // 削除
  const handleDelete = (user: User) => {
    setSelectedUserId(user.id);
    setShowDeleteDialog(true);
  };

  // 作成実行
  const handleSubmitCreate = async () => {
    if (!validateForm()) return;

    const success = await createUser({
      username: formData.username,
      email: formData.email,
      name: formData.name,
      role: formData.role,
      password: formData.password,
    });

    if (success) {
      toast.success('ユーザーを作成しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  // 更新実行
  const handleSubmitEdit = async () => {
    if (!validateForm() || !selectedUserId) return;

    const updateData: Partial<User> = {
      username: formData.username,
      email: formData.email,
      name: formData.name,
      role: formData.role,
      isActive: formData.status === 'active',
    };

    const success = await updateUser(selectedUserId, updateData);

    if (success) {
      toast.success('ユーザーを更新しました');
      setShowEditModal(false);
      resetForm();
    }
  };

  // 削除実行
  const handleConfirmDelete = async () => {
    if (!selectedUserId) return;

    const success = await deleteUser(selectedUserId);

    if (success) {
      toast.success('ユーザーを削除しました');
      setShowDeleteDialog(false);
      setSelectedUserId(null);
    }
  };

  if (isLoading && users.length === 0) {
    return <SectionLoading />;
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            システムユーザーの登録・管理を行います
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          新規ユーザー追加
        </Button>
      </div>

      {/* 検索・フィルター */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="ユーザーを検索..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            options={[
              { value: '', label: 'すべての権限' },
              { value: 'ADMIN', label: '管理者' },
              { value: 'MANAGER', label: 'マネージャー' },
              { value: 'DRIVER', label: '運転手' },
            ]}
            value={filters.role || ''}
            onChange={(e) => {
              setFilters({ role: e.target.value });
              setPage(1);
            }}
          />

          <Select
            options={[
              { value: '', label: 'すべてのステータス' },
              { value: 'active', label: 'アクティブ' },
              { value: 'inactive', label: '非アクティブ' },
            ]}
            value={filters.status || ''}
            onChange={(e) => {
              setFilters({ status: e.target.value });
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* ユーザー一覧テーブル */}
      <Table
        data={users}
        columns={columns}
        loading={isLoading}
        emptyMessage="ユーザーが見つかりません"
      />

      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
      )}

      {/* 新規作成モーダル */}
      <FormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="新規ユーザー追加"
        onSubmit={handleSubmitCreate}
        loading={isLoading}
        size="md"
      >
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="ユーザーID"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            error={formErrors.username}
            required
          />
          
          <Input
            label="氏名"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          
          <Input
            label="メールアドレス"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={formErrors.email}
            required
          />
          
          <Select
            label="権限"
            options={[
              { value: 'DRIVER', label: '運転手' },
              { value: 'MANAGER', label: 'マネージャー' },
              { value: 'ADMIN', label: '管理者' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'MANAGER' | 'DRIVER' })}
            required
          />
          
          <Input
            label="パスワード"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={formErrors.password}
            required
          />
          
          <Input
            label="パスワード（確認）"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            error={formErrors.confirmPassword}
            required
          />
        </div>
      </FormModal>

      {/* 編集モーダル */}
      <FormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="ユーザー編集"
        onSubmit={handleSubmitEdit}
        loading={isLoading}
        size="md"
      >
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="ユーザーID"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            error={formErrors.username}
            required
          />
          
          <Input
            label="氏名"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          
          <Input
            label="メールアドレス"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={formErrors.email}
            required
          />
          
          <Select
            label="権限"
            options={[
              { value: 'DRIVER', label: '運転手' },
              { value: 'MANAGER', label: 'マネージャー' },
              { value: 'ADMIN', label: '管理者' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'MANAGER' | 'DRIVER' })}
            required
          />
          
          <Select
            label="ステータス"
            options={[
              { value: 'active', label: 'アクティブ' },
              { value: 'inactive', label: '非アクティブ' },
            ]}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
            required
          />
        </div>
      </FormModal>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedUserId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="ユーザー削除確認"
        message="このユーザーを削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除"
        variant="danger"
      />
    </div>
  );
};

export default UserManagement;
