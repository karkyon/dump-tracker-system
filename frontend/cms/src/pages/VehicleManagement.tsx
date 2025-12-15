import React, { useEffect, useState, useRef } from 'react';
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
  } = useVehicleStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // フォームデータ
  const [formData, setFormData] = useState({
    plateNumber: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    capacity: 0,
    fuelType: 'DIESEL' as 'DIESEL' | 'GASOLINE' | 'HYBRID' | 'ELECTRIC',
    currentMileage: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 車種のオプション
  const vehicleModelOptions = [
    { value: 'エルフ', label: 'エルフ (いすゞ)' },
    { value: 'プロフィア', label: 'プロフィア (日野)' },
    { value: 'ファイター', label: 'ファイター (三菱ふそう)' },
    { value: 'デュトロ', label: 'デュトロ (日野)' },
    { value: 'GIGA', label: 'GIGA (いすゞ)' },
  ];

  // 製造元のオプション
  const manufacturerOptions = [
    { value: 'いすゞ', label: 'いすゞ' },
    { value: '日野', label: '日野' },
    { value: '三菱ふそう', label: '三菱ふそう' },
    { value: 'UDトラックス', label: 'UDトラックス' },
  ];

  // ✅ FIX: 前回値を保存するrefを使用（無限ループ防止）
  const prevPageRef = useRef(pagination.page);
  const prevFiltersRef = useRef<string>('');
  const isInitialMount = useRef(true);

  // ✅ FIX: 初回マウント時のみデータ取得
  useEffect(() => {
    console.log('[VehicleManagement] Initial mount - fetching vehicles');
    fetchVehicles();
    isInitialMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列 - マウント時のみ実行

  // ✅ FIX: ページ変更検知（前回値と比較）
  useEffect(() => {
    if (!isInitialMount.current && prevPageRef.current !== pagination.page) {
      console.log('[VehicleManagement] Page changed:', prevPageRef.current, '->', pagination.page);
      prevPageRef.current = pagination.page;
      fetchVehicles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]);

  // ✅ FIX: フィルター変更検知（JSON文字列で比較）
  useEffect(() => {
    const filtersString = JSON.stringify(filters);
    if (!isInitialMount.current && prevFiltersRef.current && prevFiltersRef.current !== filtersString) {
      console.log('[VehicleManagement] Filters changed');
      fetchVehicles();
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

  // 検索処理（デバウンス）
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value.length >= 2 || value.length === 0) {
      const debouncedUpdate = debounce(() => {
        setFilters({ searchTerm: value });
      }, 500);
      debouncedUpdate();
    }
  };

  // テーブルの列定義
  const columns = [
    {
      key: 'plateNumber',
      header: 'ナンバープレート',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm font-semibold">{value}</span>
      ),
    },
    {
      key: 'model',
      header: 'モデル',
      sortable: true,
    },
    {
      key: 'manufacturer',
      header: '製造元',
      sortable: true,
    },
    {
      key: 'year',
      header: '年式',
      sortable: true,
    },
    {
      key: 'capacity',
      header: '積載量',
      sortable: true,
      render: (value: number) => `${value}t`,
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

    if (!formData.plateNumber.trim()) {
      errors.plateNumber = 'ナンバープレートは必須です';
    }

    if (!formData.model.trim()) {
      errors.model = 'モデルは必須です';
    }

    if (!formData.manufacturer.trim()) {
      errors.manufacturer = '製造元は必須です';
    }

    if (formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      errors.year = '有効な年式を入力してください';
    }

    if (formData.capacity <= 0) {
      errors.capacity = '積載量は0より大きい値を入力してください';
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
      plateNumber: '',
      model: '',
      manufacturer: '',
      year: new Date().getFullYear(),
      capacity: 0,
      fuelType: 'DIESEL',
      currentMileage: 0,
      status: 'ACTIVE',
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
    setSelectedVehicleId(vehicle.id);
    setFormData({
      plateNumber: vehicle.plateNumber || '',
      model: vehicle.model || '',
      manufacturer: vehicle.manufacturer || '',
      year: vehicle.year || new Date().getFullYear(),
      capacity: vehicle.capacity || 0,
      fuelType: vehicle.fuelType || 'DIESEL',
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

    const success = await createVehicle(formData);

    if (success) {
      toast.success('車両を登録しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  // 更新処理
  const handleSubmitEdit = async () => {
    if (!validateForm() || !selectedVehicleId) return;

    const success = await updateVehicle(selectedVehicleId, formData);

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
              placeholder="ナンバープレート、モデル、製造元で検索..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            options={[
              { value: '', label: 'すべての製造元' },
              ...manufacturerOptions,
            ]}
            value={filters.manufacturer || ''}
            onChange={(e) => setFilters({ manufacturer: e.target.value })}
          />

          <Select
            options={[
              { value: '', label: 'すべてのステータス' },
              { value: 'ACTIVE', label: '稼働中' },
              { value: 'INACTIVE', label: '非稼働' },
              { value: 'MAINTENANCE', label: '整備中' },
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
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="ナンバープレート"
            type="text"
            value={formData.plateNumber}
            onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
            error={formErrors.plateNumber}
            placeholder="例: 大阪 500 あ 1001"
            required
          />
          
          <Select
            label="モデル"
            options={[
              { value: '', label: 'モデルを選択してください' },
              ...vehicleModelOptions,
            ]}
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            error={formErrors.model}
            required
          />

          <Select
            label="製造元"
            options={[
              { value: '', label: '製造元を選択してください' },
              ...manufacturerOptions,
            ]}
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            error={formErrors.manufacturer}
            required
          />

          <Input
            label="年式"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
            error={formErrors.year}
            required
          />

          <Input
            label="積載量 (t)"
            type="number"
            min="0"
            step="0.1"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
            error={formErrors.capacity}
            required
          />

          <Select
            label="燃料タイプ"
            options={[
              { value: 'DIESEL', label: 'ディーゼル' },
              { value: 'GASOLINE', label: 'ガソリン' },
              { value: 'HYBRID', label: 'ハイブリッド' },
              { value: 'ELECTRIC', label: '電気' },
            ]}
            value={formData.fuelType}
            onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as any })}
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
              { value: 'ACTIVE', label: '稼働中' },
              { value: 'INACTIVE', label: '非稼働' },
              { value: 'MAINTENANCE', label: '整備中' },
            ]}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            required
          />

          <div className="md:col-span-2">
            <Input
              label="備考"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="備考を入力してください（任意）"
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
          setSelectedVehicleId(null);
        }}
        title="車両情報編集"
        onSubmit={handleSubmitEdit}
        loading={isLoading}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="ナンバープレート"
            type="text"
            value={formData.plateNumber}
            onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
            error={formErrors.plateNumber}
            required
          />
          
          <Select
            label="モデル"
            options={vehicleModelOptions}
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            error={formErrors.model}
            required
          />

          <Select
            label="製造元"
            options={manufacturerOptions}
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            error={formErrors.manufacturer}
            required
          />

          <Input
            label="年式"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
            error={formErrors.year}
            required
          />

          <Input
            label="積載量 (t)"
            type="number"
            min="0"
            step="0.1"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
            error={formErrors.capacity}
            required
          />

          <Select
            label="燃料タイプ"
            options={[
              { value: 'DIESEL', label: 'ディーゼル' },
              { value: 'GASOLINE', label: 'ガソリン' },
              { value: 'HYBRID', label: 'ハイブリッド' },
              { value: 'ELECTRIC', label: '電気' },
            ]}
            value={formData.fuelType}
            onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as any })}
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
              { value: 'ACTIVE', label: '稼働中' },
              { value: 'INACTIVE', label: '非稼働' },
              { value: 'MAINTENANCE', label: '整備中' },
            ]}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            required
          />

          <div className="md:col-span-2">
            <Input
              label="備考"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
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