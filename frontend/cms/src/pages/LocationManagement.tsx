import React, { useEffect, useState } from 'react';
import { Plus, Search, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMasterStore } from '../store/masterStore';
import { Location } from '../types';
import Button from '../components/common/Button';
import Input, { Select } from '../components/common/Input';
import Table, { ActionButtons } from '../components/common/Table';
import { FormModal, ConfirmDialog } from '../components/common/Modal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';

const LocationManagement: React.FC = () => {
  const {
    locations,
    locationLoading,
    locationError,
    fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    clearErrors,
  } = useMasterStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // フォームデータ
  const [formData, setFormData] = useState({
    clientName: '',
    locationName: '',
    address: '',
    type: 'pickup' as 'pickup' | 'delivery',
    gpsLatitude: 0,
    gpsLongitude: 0,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ページ初期化時にデータを取得
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // エラー処理
  useEffect(() => {
    if (locationError) {
      toast.error(locationError);
      clearErrors();
    }
  }, [locationError, clearErrors]);

  // フィルタリング処理
  const filteredLocations = locations.filter(location => {
    const matchesSearch = !searchTerm || 
      (location.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (location.locationName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      location.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = !typeFilter || location.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  // テーブルの列定義
  const columns = [
    {
      key: 'clientName',
      header: '客先名',
      sortable: true,
    },
    {
      key: 'locationName',
      header: '場所名',
      sortable: true,
    },
    {
      key: 'address',
      header: '住所',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm">{value}</span>
      ),
    },
    {
      key: 'type',
      header: '場所種別',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'pickup' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {value === 'pickup' ? '積込' : '積下'}
        </span>
      ),
    },
    {
      key: 'gpsCoordinates',
      header: 'GPS座標情報',
      render: (_: any, location: Location) => {
        if (location.gpsLatitude && location.gpsLongitude) {
          return (
            <div className="flex items-center space-x-1">
              <MapPin className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-600">
                {location.gpsLatitude.toFixed(6)}, {location.gpsLongitude.toFixed(6)}
              </span>
            </div>
          );
        }
        return <span className="text-gray-400">未設定</span>;
      },
    },
    {
      key: 'registrationMethod',
      header: '登録方法',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
        }`}>
          {value === 'admin' ? '管理者から' : 'アプリから'}
        </span>
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
      render: (_: any, location: Location) => (
        <ActionButtons
          onEdit={() => handleEdit(location)}
          onDelete={() => handleDelete(location.id)}
        />
      ),
    },
  ];

  // フォームバリデーション
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.clientName.trim()) {
      errors.clientName = '客先名は必須です';
    }

    if (!formData.locationName.trim()) {
      errors.locationName = '場所名は必須です';
    }

    if (!formData.address.trim()) {
      errors.address = '住所は必須です';
    }

    // GPS座標のバリデーション（任意項目）
    if (formData.gpsLatitude && (formData.gpsLatitude < -90 || formData.gpsLatitude > 90)) {
      errors.gpsLatitude = '緯度は-90から90の間で入力してください';
    }

    if (formData.gpsLongitude && (formData.gpsLongitude < -180 || formData.gpsLongitude > 180)) {
      errors.gpsLongitude = '経度は-180から180の間で入力してください';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      clientName: '',
      locationName: '',
      address: '',
      type: 'pickup',
      gpsLatitude: 0,
      gpsLongitude: 0,
    });
    setFormErrors({});
  };

  // 新規作成
  const handleCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  // 編集
  const handleEdit = (location: Location) => {
    setFormData({
      clientName: location.clientName || '',  // ✅ デフォルト値追加
      locationName: location.locationName || '',  // ✅ デフォルト値追加
      address: location.address,
      type: location.type || 'pickup',
      gpsLatitude: location.gpsLatitude || 0,
      gpsLongitude: location.gpsLongitude || 0,
    });
    setSelectedLocationId(location.id);
    setFormErrors({});
    setShowEditModal(true);
  };

  // 削除
  const handleDelete = (locationId: string) => {
    setSelectedLocationId(locationId);
    setShowDeleteDialog(true);
  };

  // 作成処理
  const handleSubmitCreate = async () => {
    if (!validateForm()) return;

    const locationData = {
      clientName: formData.clientName,
      locationName: formData.locationName,
      address: formData.address,
      type: formData.type,
      registrationMethod: 'admin' as const,
      ...(formData.gpsLatitude && formData.gpsLongitude && {
        gpsLatitude: formData.gpsLatitude,
        gpsLongitude: formData.gpsLongitude,
      }),
    };

    const success = await createLocation(locationData);

    if (success) {
      toast.success('場所を登録しました');
      setShowCreateModal(false);
      resetForm();
    }
  };

  // 更新処理
  const handleSubmitEdit = async () => {
    if (!validateForm() || !selectedLocationId) return;

    const locationData = {
      clientName: formData.clientName,
      locationName: formData.locationName,
      address: formData.address,
      type: formData.type,
      ...(formData.gpsLatitude && formData.gpsLongitude && {
        gpsLatitude: formData.gpsLatitude,
        gpsLongitude: formData.gpsLongitude,
      }),
    };

    const success = await updateLocation(selectedLocationId, locationData);

    if (success) {
      toast.success('場所情報を更新しました');
      setShowEditModal(false);
      resetForm();
      setSelectedLocationId(null);
    }
  };

  // 削除処理
  const handleConfirmDelete = async () => {
    if (!selectedLocationId) return;

    const success = await deleteLocation(selectedLocationId);

    if (success) {
      toast.success('場所を削除しました');
      setShowDeleteDialog(false);
      setSelectedLocationId(null);
    }
  };

  if (locationLoading && locations.length === 0) {
    return <SectionLoading text="場所一覧を読み込み中..." />;
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">積込・積下場所マスタ</h1>
          <p className="mt-2 text-sm text-gray-700">
            積込場所・積下場所の登録・編集・削除を行います
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button
            variant="primary"
            onClick={handleCreate}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            新規場所追加
          </Button>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="客先名、場所名、住所で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            options={[
              { value: '', label: 'すべての種別' },
              { value: 'pickup', label: '積込' },
              { value: 'delivery', label: '積下' },
            ]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>
      </div>

      {/* 場所一覧テーブル */}
      <Table
        data={filteredLocations}
        columns={columns}
        loading={locationLoading}
        emptyMessage="場所が見つかりません"
      />

      {/* 新規作成モーダル */}
      <FormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="新規場所追加"
        onSubmit={handleSubmitCreate}
        loading={locationLoading}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="客先名"
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              error={formErrors.clientName}
              placeholder="例: 株式会社○○"
              required
            />
            
            <Input
              label="場所名"
              type="text"
              value={formData.locationName}
              onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
              error={formErrors.locationName}
              placeholder="例: 岡山工場、○○現場"
              required
            />
          </div>
          
          <Input
            label="住所"
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            error={formErrors.address}
            placeholder="例: 岡山県岡山市北区大供1-1-1"
            required
          />
          
          <Select
            label="場所種別"
            options={[
              { value: 'pickup', label: '積込' },
              { value: 'delivery', label: '積下' },
            ]}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'pickup' | 'delivery' })}
            required
          />
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">GPS座標情報（任意）</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="緯度"
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={formData.gpsLatitude}
                onChange={(e) => setFormData({ ...formData, gpsLatitude: Number(e.target.value) })}
                error={formErrors.gpsLatitude}
                placeholder="例: 34.661749"
              />
              
              <Input
                label="経度"
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={formData.gpsLongitude}
                onChange={(e) => setFormData({ ...formData, gpsLongitude: Number(e.target.value) })}
                error={formErrors.gpsLongitude}
                placeholder="例: 133.934406"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              GPS座標を設定すると、モバイルアプリで自動入力が可能になります
            </p>
          </div>
        </div>
      </FormModal>

      {/* 編集モーダル */}
      <FormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
          setSelectedLocationId(null);
        }}
        title="場所情報編集"
        onSubmit={handleSubmitEdit}
        loading={locationLoading}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="客先名"
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              error={formErrors.clientName}
              required
            />
            
            <Input
              label="場所名"
              type="text"
              value={formData.locationName}
              onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
              error={formErrors.locationName}
              required
            />
          </div>
          
          <Input
            label="住所"
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            error={formErrors.address}
            required
          />
          
          <Select
            label="場所種別"
            options={[
              { value: 'pickup', label: '積込' },
              { value: 'delivery', label: '積下' },
            ]}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'pickup' | 'delivery' })}
            required
          />
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">GPS座標情報（任意）</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="緯度"
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={formData.gpsLatitude}
                onChange={(e) => setFormData({ ...formData, gpsLatitude: Number(e.target.value) })}
                error={formErrors.gpsLatitude}
              />
              
              <Input
                label="経度"
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={formData.gpsLongitude}
                onChange={(e) => setFormData({ ...formData, gpsLongitude: Number(e.target.value) })}
                error={formErrors.gpsLongitude}
              />
            </div>
          </div>
        </div>
      </FormModal>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedLocationId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="場所削除"
        message="この場所を削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除"
        variant="danger"
        loading={locationLoading}
      />
    </div>
  );
};

export default LocationManagement;