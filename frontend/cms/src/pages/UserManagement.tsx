import React, { useEffect, useState } from 'react';
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
import { formatDate, debounce } from '../utils/helpers';

const UserManagement: React.FC = () => {
  const {
    users,
    selectedUser,
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
    clearSelectedUser,
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
    role: 'driver' as 'admin' | 'driver',
    status: 'active' as 'active' | 'inactive',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ページ初期化時にデータを取得
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, pagination.page, filters]);

  // エラー処理
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // 検索処理（デバウンス）
  const debouncedSearch = debounce((term: string) => {
    setFilters({ searchTerm: term });
  }, 500);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

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
      key: 'status',
      header: 'ステータス',
      render: (value: string) => (
        <StatusBadge 
          status={value} 
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
      key: 'lastLogin',
      header: '最終ログイン',
      render: (value: string) => value ? formatDate(value) : '-',
    },
    {
      key: 'actions',
      header: '操作',
      render: (_: any, user: User) => (
        <ActionButtons
          onEdit={() => handleEdit(user)}
          onDelete={() => handleDelete(user.id)}
        />
      ),
    },
  ];

  // フォームバリデーション
  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = 'ユーザーIDは必須です';
    }

    if (!formData.name.trim()) {
      errors.name = '氏名は必須です';
    }

    if (!formData.email.trim()) {
      errors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '正しいメールアドレスを入力してください';
    }

    if (!isEdit && !formData.password) {
      errors.password = 'パスワードは必須です';
    }

    if (!isEdit && formData.password !== formData.confirmPassword) {
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
      role: 'driver',
      status: 'active',
      password: '',
      confirmPassword: '',
    });
    setFormErrors({});
  };

  // 新規作成
  const handleCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  // 編集
  const handleEdit = (user: User) => {
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      password: '',
      confirmPassword: '',
    });
    setSelectedUserId(user.id);
    setFormErrors({});
    setShowEditModal(true);
  };

  // 削除
  const handleDelete = (userId: string) => {
    setSelectedUserId(userId);
    setShowDeleteDialog(true);
  };

  // 作成処理
  const handleSubmitCreate = async () => {
    if (!validateForm()) return;

    const success = await createUser({
      username: formData.username,
      email: formData.email,
      name: formData.name,
      role: formData.role,
      status: formData.status,
      password: formData.password,
    });

    if (success) {
      toast.success('ユーザーを作成しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  // 更新処理
  const handleSubmitEdit = async () => {
    if (!validateForm(true) || !selectedUserId) return;

    const updateData: any = {
      username: formData.username,
      email: formData.email,
      name: formData.name,
      role: formData.role,
      status: formData.status,
    };

    if (formData.password) {
      updateData.password = formData.password;
    }

    const success = await updateUser(selectedUserId, updateData);

    if (success) {
      toast.success('ユーザーを更新しました');
      setShowEditModal(false);
      resetForm();
      setSelectedUserId(null);
    }
  };

  // 削除処理
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
    return <SectionLoading text="ユーザー一覧を読み込み中..." />;
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-2 text-sm text-gray-700">
            運転手・管理者のアカウント管理を行います
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button
            variant="primary"
            onClick={handleCreate}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            新規ユーザー追加
          </Button>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="ユーザー名、氏名、メールアドレスで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            options={[
              { value: '', label: 'すべての権限' },
              { value: 'admin', label: '管理者' },
              { value: 'driver', label: '運転手' },
            ]}
            value={filters.role || ''}
            onChange={(e) => setFilters({ role: e.target.value })}
          />

          <Select
            options={[
              { value: '', label: 'すべてのステータス' },
              { value: 'active', label: 'アクティブ' },
              { value: 'inactive', label: '非アクティブ' },
            ]}
            value={filters.status || ''}
            onChange={(e) => setFilters({ status: e.target.value })}
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
              { value: 'driver', label: '運転手' },
              { value: 'admin', label: '管理者' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'driver' })}
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
          
          <Input
            label="パスワード"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={formErrors.password}
            required
          />
          
          <Input
            label="パスワード確認"
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
          setSelectedUserId(null);
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
              { value: 'driver', label: '運転手' },
              { value: 'admin', label: '管理者' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'driver' })}
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
          
          <Input
            label="新しいパスワード"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={formErrors.password}
            helperText="パスワードを変更しない場合は空欄にしてください"
          />
          
          {formData.password && (
            <Input
              label="パスワード確認"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              error={formErrors.confirmPassword}
            />
          )}
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
        title="ユーザー削除"
        message="このユーザーを削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除"
        variant="danger"
        loading={isLoading}
      />
    </div>
  );
};

export default UserManagement;