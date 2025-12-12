import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useVehicleStore } from '../store/vehicleStore';
import { Vehicle } from '../types';
import Button from '../components/common/Button';
import Input, { Select } from '../components/common/Input';
import Table, { StatusBadge, ActionButtons } from '../components/common/Table';
import Pagination from '../components/common/Pagination';
import { FormModal, ConfirmDialog } from '../components/common/Modal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate, formatNumber, debounce } from '../utils/helpers';

const VehicleManagement: React.FC = () => {
  const {
    vehicles,
    // selectedVehicle,
    isLoading,
    error,
    pagination,
    filters,
    fetchVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    setFilters,
    setPage,
    clearError,
    // clearSelectedVehicle,
  } = useVehicleStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // フォームデータ
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    vehicleType: '',
    currentMileage: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 車種のオプション
  const vehicleTypeOptions = [
    { value: '大型ダンプ', label: '大型ダンプ' },
    { value: '中型ダンプ', label: '中型ダンプ' },
    { value: '小型ダンプ', label: '小型ダンプ' },
    { value: '4tダンプ', label: '4tダンプ' },
  ];

  // ページ初期化時にデータを取得
  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles, pagination.page, filters]);

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
      key: 'vehicleNumber',
      header: '車番',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      ),
    },
    {
      key: 'vehicleType',
      header: '車種',
      sortable: true,
    },
    {
      key: 'currentMileage',
      header: '現在走行距離',
      sortable: true,
      render: (value: number) => (
        <span>{formatNumber(value)} km</span>
      ),
    },
    {
      key: 'lastDriver',
      header: '最新運転手',
      render: (value: string) => value || '-',
    },
    {
      key: 'status',
      header: 'ステータス',
      render: (value: string) => (
        <StatusBadge 
          status={value} 
          type="vehicle"
        />
      ),
    },
    {
      key: 'createdAt',
      header: '登録日',
      render: (value: string) => formatDate(value),
    },
    {
      key: 'actions',
      header: '操作',
      render: (_: any, vehicle: Vehicle) => (
        <ActionButtons
          onEdit={() => handleEdit(vehicle)}
          onDelete={() => handleDelete(vehicle.id)}
        />
      ),
    },
  ];

  // フォームバリデーション
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.vehicleNumber.trim()) {
      errors.vehicleNumber = '車番は必須です';
    }

    if (!formData.vehicleType.trim()) {
      errors.vehicleType = '車種は必須です';
    }

    if (formData.currentMileage < 0) {
      errors.currentMileage = '走行距離は0以上で入力してください';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      vehicleNumber: '',
      vehicleType: '',
      currentMileage: 0,
      status: 'ACTIVE' ,
      notes: '',
    });
    setFormErrors({});
  };

  // 新規作成
  const handleCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  // 編集
  const handleEdit = (vehicle: Vehicle) => {
    // vehicle.id を保存
    setSelectedVehicleId(vehicle.id);
    
    // フォームデータを設定（undefined 対策）
    setFormData({
      vehicleNumber: vehicle.vehicleNumber || '',
      vehicleType: vehicle.vehicleType || '',
      currentMileage: vehicle.currentMileage || 0,
      status: vehicle.status,
      notes: vehicle.notes || '',
    });
    
    setShowEditModal(true);
  };

  // 削除
  const handleDelete = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setShowDeleteDialog(true);
  };

  // 作成処理
  const handleSubmitCreate = async () => {
    if (!validateForm()) return;

    const success = await createVehicle({
      vehicleNumber: formData.vehicleNumber,
      vehicleType: formData.vehicleType,
      currentMileage: formData.currentMileage,
      status: formData.status,
    });

    if (success) {
      toast.success('車両を登録しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  // 更新処理
  const handleSubmitEdit = async () => {
    if (!validateForm() || !selectedVehicleId) return;

    const success = await updateVehicle(selectedVehicleId, {
      vehicleNumber: formData.vehicleNumber,
      vehicleType: formData.vehicleType,
      currentMileage: formData.currentMileage,
      status: formData.status,
    });

    if (success) {
      toast.success('車両情報を更新しました');
      setShowEditModal(false);
      resetForm();
      setSelectedVehicleId(null);
    }
  };

  // 削除処理
  const handleConfirmDelete = async () => {
    if (!selectedVehicleId) return;

    const success = await deleteVehicle(selectedVehicleId);

    if (success) {
      toast.success('車両を削除しました');
      setShowDeleteDialog(false);
      setSelectedVehicleId(null);
    }
  };

  if (isLoading && vehicles.length === 0) {
    return <SectionLoading text="車両一覧を読み込み中..." />;
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">車両マスタ管理</h1>
          <p className="mt-2 text-sm text-gray-700">
            車両情報の登録・編集・削除を行います
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button
            variant="primary"
            onClick={handleCreate}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            新規車両追加
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
              placeholder="車番、車種で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            options={[
              { value: '', label: 'すべての車種' },
              ...vehicleTypeOptions,
            ]}
            value={filters.vehicleType || ''}
            onChange={(e) => setFilters({ vehicleType: e.target.value })}
          />

          <Select
            options={[
              { value: '', label: 'すべてのステータス' },
              { value: 'active', label: '稼働中' },
              { value: 'inactive', label: '非稼働' },
              { value: 'maintenance', label: '整備中' },
            ]}
            value={filters.status || ''}
            onChange={(e) => setFilters({ status: e.target.value })}
          />
        </div>
      </div>

      {/* 車両一覧テーブル */}
      <Table
        data={vehicles}
        columns={columns}
        loading={isLoading}
        emptyMessage="車両が見つかりません"
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
        title="新規車両追加"
        onSubmit={handleSubmitCreate}
        loading={isLoading}
        size="md"
      >
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="車番"
            type="text"
            value={formData.vehicleNumber}
            onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
            error={formErrors.vehicleNumber}
            placeholder="例: 倉敷100あ1234"
            required
          />
          
          <Select
            label="車種"
            options={[
              { value: '', label: '車種を選択してください' },
              ...vehicleTypeOptions,
            ]}
            value={formData.vehicleType}
            onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
            error={formErrors.vehicleType}
            required
          />
          
          <Input
            label="現在走行距離 (km)"
            type="number"
            min="0"
            value={formData.currentMileage}
            onChange={(e) => setFormData({ ...formData, currentMileage: Number(e.target.value) })}
            error={formErrors.currentMileage}
            required
          />
          
          <Select
            label="ステータス"
            options={[
              { value: 'active', label: '稼働中' },
              { value: 'inactive', label: '非稼働' },
              { value: 'maintenance', label: '整備中' },
            ]}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' })}
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
          setSelectedVehicleId(null);
        }}
        title="車両情報編集"
        onSubmit={handleSubmitEdit}
        loading={isLoading}
        size="md"
      >
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="車番"
            type="text"
            value={formData.vehicleNumber}
            onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
            error={formErrors.vehicleNumber}
            required
          />
          
          <Select
            label="車種"
            options={vehicleTypeOptions}
            value={formData.vehicleType}
            onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
            error={formErrors.vehicleType}
            required
          />
          
          <Input
            label="現在走行距離 (km)"
            type="number"
            min="0"
            value={formData.currentMileage}
            onChange={(e) => setFormData({ ...formData, currentMileage: Number(e.target.value) })}
            error={formErrors.currentMileage}
            required
          />
          
          <Select
            label="ステータス"
            options={[
              { value: 'active', label: '稼働中' },
              { value: 'inactive', label: '非稼働' },
              { value: 'maintenance', label: '整備中' },
            ]}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' })}
            required
          />
        </div>
      </FormModal>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedVehicleId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="車両削除"
        message="この車両を削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除"
        variant="danger"
        loading={isLoading}
      />
    </div>
  );
};

export default VehicleManagement;