import React, { useEffect, useState, useRef } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../store/userStore';
import type { User } from '../types';
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
    password: '',
    name: '',
    role: 'DRIVER' as 'ADMIN' | 'MANAGER' | 'DRIVER',
    employeeId: '',
    phone: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ✅ FIX: 前回値を保存するrefを使用（無限ループ防止）
  const prevPageRef = useRef(pagination.page);
  const prevFiltersRef = useRef<string>('');
  const isInitialMount = useRef(true);

  // ✅ FIX: 初回マウント時のみデータ取得
  useEffect(() => {
    console.log('[UserManagement] Initial mount - fetching users');
    fetchUsers();
    isInitialMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列 - マウント時のみ実行

  // ✅ FIX: ページ変更検知（前回値と比較）
  useEffect(() => {
    if (!isInitialMount.current && prevPageRef.current !== pagination.page) {
      console.log('[UserManagement] Page changed:', prevPageRef.current, '->', pagination.page);
      prevPageRef.current = pagination.page;
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]);

  // ✅ FIX: フィルター変更検知（JSON文字列で比較）
  useEffect(() => {
    const filtersString = JSON.stringify(filters);
    if (!isInitialMount.current && prevFiltersRef.current && prevFiltersRef.current !== filtersString) {
      console.log('[UserManagement] Filters changed');
      fetchUsers();
    }
    prevFiltersRef.current = filtersString;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // エラー処理
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // 検索処理
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value.length >= 2 || value.length === 0) {
      setFilters({ searchTerm: value });
    }
  };

  // テーブルの列定義
  const columns = [
    {
      key: 'username',
      header: 'ユーザー名',
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
      header: '役割',
      render: (value: string) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {value === 'ADMIN' ? '管理者' : value === 'MANAGER' ? 'マネージャー' : 'ドライバー'}
        </span>
      ),
    },
    {
      key: 'employeeId',
      header: '社員ID',
    },
    {
      key: 'isActive',
      header: 'ステータス',
      render: (value: boolean) => (
        <StatusBadge 
          status={value ? 'ACTIVE' : 'INACTIVE'} 
          type="user"
        />
      ),
    },
    {
      key: 'lastLoginAt',
      header: '最終ログイン',
      render: (value: string | null) => value ? formatDate(value) : '-',
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
      errors.username = 'ユーザー名は必須です';
    }

    if (!formData.email.trim()) {
      errors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    if (!isEdit && !formData.password.trim()) {
      errors.password = 'パスワードは必須です';
    } else if (!isEdit && formData.password.length < 8) {
      errors.password = 'パスワードは8文字以上で入力してください';
    }

    if (!formData.name.trim()) {
      errors.name = '氏名は必須です';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      name: '',
      role: 'DRIVER',
      employeeId: '',
      phone: '',
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
    setSelectedUserId(user.id);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      employeeId: user.employeeId || '',
      phone: user.phone || '',
    });
    setShowEditModal(true);
  };

  // 削除
  const handleDelete = (userId: string) => {
    setSelectedUserId(userId);
    setShowDeleteDialog(true);
  };

  // 作成処理
  const handleSubmitCreate = async () => {
    if (!validateForm(false)) return;

    const success = await createUser(formData);

    if (success) {
      toast.success('ユーザーを登録しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  // 更新処理
  const handleSubmitEdit = async () => {
    if (!validateForm(true) || !selectedUserId) return;

    // ✅ 修正: delete演算子を使わず、型安全にパスワードを除外
    const { password, ...baseUpdateData } = formData;
    const updateData = password ? { ...baseUpdateData, password } : baseUpdateData;

    const success = await updateUser(selectedUserId, updateData);

    if (success) {
      toast.success('ユーザー情報を更新しました');
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
            システムユーザーの登録・編集・削除を行います
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
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            options={[
              { value: '', label: 'すべての役割' },
              { value: 'ADMIN', label: '管理者' },
              { value: 'MANAGER', label: 'マネージャー' },
              { value: 'DRIVER', label: 'ドライバー' },
            ]}
            value={filters.role || ''}
            onChange={(e) => setFilters({ role: e.target.value })}
          />

          <Select
            options={[
              { value: '', label: 'すべてのステータス' },
              { value: 'true', label: 'アクティブ' },
              { value: 'false', label: '非アクティブ' },
            ]}
            value={filters.isActive?.toString() || ''}
            onChange={(e) => setFilters({ isActive: e.target.value ? e.target.value === 'true' : undefined })}
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
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="ユーザー名"
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

          <Input
            label="パスワード"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={formErrors.password}
            required
          />

          <Select
            label="役割"
            options={[
              { value: 'DRIVER', label: 'ドライバー' },
              { value: 'MANAGER', label: 'マネージャー' },
              { value: 'ADMIN', label: '管理者' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            required
          />

          <Input
            label="社員ID"
            type="text"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
          />

          <div className="md:col-span-2">
            <Input
              label="電話番号"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
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
        title="ユーザー情報編集"
        onSubmit={handleSubmitEdit}
        loading={isLoading}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="ユーザー名"
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

          <Input
            label="パスワード"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={formErrors.password}
            placeholder="変更する場合のみ入力"
          />

          <Select
            label="役割"
            options={[
              { value: 'DRIVER', label: 'ドライバー' },
              { value: 'MANAGER', label: 'マネージャー' },
              { value: 'ADMIN', label: '管理者' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            required
          />

          <Input
            label="社員ID"
            type="text"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
          />

          <div className="md:col-span-2">
            <Input
              label="電話番号"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
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