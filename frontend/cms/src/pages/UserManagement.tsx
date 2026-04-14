// frontend/cms/src/pages/UserManagement.tsx
// 修正版: 2026-04-05
//   ① バリデーション強化（ユーザー名文字制限・パスワード強度チェックをフロントでも実施）
//   ② ログイン中ユーザーの削除ボタン・無効化ボタンを非活性化
//   ③ 有効/無効ステータス切替ボタンを追加（クリック→確認ダイアログ）
//   ④ バックエンドエラーメッセージをフォームに直接表示

import React, { useEffect, useState, useRef } from 'react';
import { useTLog } from '../hooks/useTLog';
import { Plus, Search, Edit2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';
import Button from '../components/common/Button';
import Input, { Select } from '../components/common/Input';
import Table, { ActionButtons } from '../components/common/Table';
import Pagination from '../components/common/Pagination';
import { FormModal, ConfirmDialog } from '../components/common/Modal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';
import { getRoleBadgeConfig } from '../utils/roleHelpers';

const UserManagement: React.FC = () => {
  useTLog('USER_MANAGEMENT', 'ユーザー管理');

  // ✅ 追加: ログイン中ユーザーを取得（自分自身の削除・無効化禁止に使用）
  const { user: currentUser } = useAuthStore();

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
    toggleUserStatus,   // ✅ 追加: ステータス切替
    setFilters,
    setPage,
    clearError,
  } = useUserStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // ✅ 追加: ステータス切替用ダイアログ
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [toggleTargetUser, setToggleTargetUser] = useState<User | null>(null);
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
  }, []);

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

  // エラー処理（storeのエラーをtoastで表示）
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

  // ✅ 追加: ステータス切替処理（確認ダイアログ表示）
  const handleToggleStatus = (user: User) => {
    setToggleTargetUser(user);
    setShowToggleDialog(true);
  };

  // ✅ 追加: ステータス切替確定処理
  const handleConfirmToggleStatus = async () => {
    if (!toggleTargetUser) return;
    const success = await toggleUserStatus(toggleTargetUser.id);
    if (success) {
      const willBeActive = !toggleTargetUser.isActive;
      toast.success(
        `ユーザー「${toggleTargetUser.name}」を${willBeActive ? '有効' : '無効'}にしました`
      );
      setShowToggleDialog(false);
      setToggleTargetUser(null);
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
      // ✅ 役割別配色: ADMIN=Purple, MANAGER=Blue, DRIVER=Teal（roleHelpers.ts で一元管理）
      render: (value: string) => {
        const cfg = getRoleBadgeConfig(value);
        return <span className={cfg.className}>{cfg.label}</span>;
      },
    },
    {
      key: 'employeeId',
      header: '社員ID',
    },
    {
      key: 'isActive',
      header: 'ステータス',
      // ✅ 修正: クリック可能なステータスバッジに変更（自分自身は切替不可）
      render: (value: boolean, user: User) => {
        const isSelf = user.id === currentUser?.id;
        return (
          <button
            type="button"
            onClick={() => { if (!isSelf) handleToggleStatus(user); }}
            disabled={isSelf}
            title={
              isSelf
                ? '自分自身のステータスは変更できません'
                : value
                ? 'クリックして無効化する'
                : 'クリックして有効化する'
            }
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors
              ${isSelf ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80'}
              ${value ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
            `}
          >
            {value ? '有効' : '無効'}
          </button>
        );
      },
    },
    {
      key: 'lastLoginAt',
      header: '最終ログイン',
      render: (value: string | null) => value ? formatDate(value) : '-',
    },
    {
      key: 'actions',
      header: '操作',
      // ✅ 修正: ゴミ箱→有効/無効トグルボタンに変更（audit_logs外部キー制約のため物理削除不可）
      render: (_: any, user: User) => {
        const isSelf = user.id === currentUser?.id;
        const isActive = user.isActive;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleEdit(user)}
              title="編集"
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {!isSelf && (
              <button
                onClick={() => { setToggleTargetUser(user); setShowToggleDialog(true); }}
                title={isActive ? 'クリックして無効化' : 'クリックして有効化'}
                className={`p-1 rounded transition-colors ${isActive ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-green-500 hover:text-green-700 hover:bg-green-50'}`}
              >
                {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // ✅ 修正: フォームバリデーション（強化版）
  // バックエンドのバリデーションルールと完全一致させてフロントで事前検知する
  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {};

    // ユーザー名: バックエンドの /^[a-zA-Z0-9_-]+$/ に合わせる
    if (!formData.username.trim()) {
      errors.username = 'ユーザー名は必須です';
    } else if (formData.username.length < 3) {
      errors.username = 'ユーザー名は3文字以上で入力してください';
    } else if (formData.username.length > 50) {
      errors.username = 'ユーザー名は50文字以下で入力してください';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      // ✅ 追加: ピリオド・スペース等の禁止文字をフロントで事前チェック
      errors.username = 'ユーザー名は英数字・アンダースコア(_)・ハイフン(-)のみ使用できます（ピリオド不可）';
    }

    // 氏名
    if (!formData.name.trim()) {
      errors.name = '氏名は必須です';
    }

    // メールアドレス
    if (!formData.email.trim()) {
      errors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    // パスワード（新規作成時のみ必須）
    if (!isEdit) {
      if (!formData.password.trim()) {
        errors.password = 'パスワードは必須です';
      } else if (formData.password.length < 8) {
        errors.password = 'パスワードは8文字以上で入力してください';
      }
    } else if (isEdit && formData.password && formData.password.length < 8) {
      errors.password = 'パスワードは8文字以上で入力してください';
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
    setFormErrors({});
    setShowEditModal(true);
  };

  // 削除ダイアログ表示
  const handleDelete = (userId: string) => {
    setSelectedUserId(userId);
    setShowDeleteDialog(true);
  };

  // 作成処理
  const handleSubmitCreate = async () => {
    if (!validateForm(false)) return;

    const result = await createUser(formData);

    if (result.success) {
      toast.success('ユーザーを登録しました');
      setShowCreateModal(false);
      resetForm();
    } else {
      // ✅ 修正: バックエンドのフィールド別エラーをフォームに反映
      if (result.fieldErrors) {
        setFormErrors(prev => ({ ...prev, ...result.fieldErrors }));
      }
      // 全体エラーはuseEffect内のtoastで表示されるが、
      // フィールドエラーがある場合はモーダルを閉じずフォームに表示する
    }
  };

  // 更新処理
  const handleSubmitEdit = async () => {
    if (!validateForm(true) || !selectedUserId) return;

    // ✅ 修正: delete演算子を使わず、型安全にパスワードを除外
    const { password, ...baseUpdateData } = formData;
    const updateData = password ? { ...baseUpdateData, password } : baseUpdateData;

    const result = await updateUser(selectedUserId, updateData);

    if (result.success) {
      toast.success('ユーザー情報を更新しました');
      setShowEditModal(false);
      resetForm();
      setSelectedUserId(null);
    } else {
      if (result.fieldErrors) {
        setFormErrors(prev => ({ ...prev, ...result.fieldErrors }));
      }
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

      {/* ============================
          新規作成モーダル
      ============================ */}
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
        {/* ✅ 追加: ユーザー名制約のガイダンスをフォーム上部に表示 */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>【ユーザー名の入力規則】</strong>{' '}
            英数字・アンダースコア(_)・ハイフン(-)のみ使用可能。
            ピリオド(.)・スペース・全角文字は使用不可。
            （例: tanaka_taro、driver-001）
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="ユーザー名"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            error={formErrors.username}
            placeholder="例: tanaka_taro"
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
            placeholder="8文字以上"
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

      {/* ============================
          編集モーダル
      ============================ */}
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

      {/* ============================
          削除確認ダイアログ
      ============================ */}
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

      {/* ============================
          ✅ 追加: ステータス切替確認ダイアログ
      ============================ */}
      <ConfirmDialog
        isOpen={showToggleDialog}
        onClose={() => {
          setShowToggleDialog(false);
          setToggleTargetUser(null);
        }}
        onConfirm={handleConfirmToggleStatus}
        title={toggleTargetUser?.isActive ? 'ユーザーを無効化' : 'ユーザーを有効化'}
        message={
          toggleTargetUser?.isActive
            ? `「${toggleTargetUser?.name}」を無効化します。\nこのユーザーはログインできなくなります。よろしいですか？`
            : `「${toggleTargetUser?.name}」を有効化します。\nこのユーザーはログインできるようになります。よろしいですか？`
        }
        confirmText={toggleTargetUser?.isActive ? '無効化する' : '有効化する'}
        variant={toggleTargetUser?.isActive ? 'danger' : 'info'}
        loading={isLoading}
      />
    </div>
  );
};

export default UserManagement;