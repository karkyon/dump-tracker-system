import React, { useEffect, useState } from 'react';
import { Plus, Search, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMasterStore } from '../store/masterStore';
import { Location } from '../types';
import Button from '../components/common/Button';
import Input, { Select } from '../components/common/Input';
import Table, { ActionButtons } from '../components/common/Table';
import { ConfirmDialog } from '../components/common/Modal';
import LocationFormModal from '../components/location/LocationFormModal';
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

  interface LocationFormData {
    clientName: string;
    name: string;
    address: string;
    locationType: 'PICKUP' | 'DELIVERY';
    latitude: number;
    longitude: number;
  }

  // フォームデータ
  const [formData, setFormData] = useState<LocationFormData>({
    clientName: '',
    name: '',
    address: '',
    locationType: 'DELIVERY',
    latitude: 0,
    longitude: 0,
  });

  // ページ初期化時にデータを取得
  useEffect(() => {
    console.log('[LocationManagement] Initial mount - fetching locations');
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
  const filteredLocations = Array.isArray(locations) ? locations.filter(location => {
    const matchesSearch = !searchTerm || 
      (location.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (location.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      location.address?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    
    const matchesType = !typeFilter || location.locationType === typeFilter;
    
    return matchesSearch && matchesType;
  }) : [];

  console.log('[LocationManagement] Filtered locations:', filteredLocations.length);

  // テーブルの列定義
  const columns = [
    {
      key: 'clientName',
      header: '客先名',
      sortable: true,
    },
    {
      key: 'name',
      header: '場所名',
      sortable: true,
    },
    {
      key: 'address',
      header: '住所',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm">{value || '-'}</span>
      ),
    },
    {
      key: 'locationType',
      header: '場所種別',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'PICKUP' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {value === 'PICKUP' ? '積込' : '積降'}
        </span>
      ),
    },
    {
      key: 'gpsCoordinates',
      header: 'GPS座標情報',
      render: (_: any, location: Location) => {
        if (location.latitude && location.longitude) {
          return (
            <div className="flex items-center space-x-1">
              <MapPin className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-600">
                {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
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

  // 新規作成
  const handleCreate = () => {
    setFormData({
      clientName: '',
      name: '',
      address: '',
      locationType: 'DELIVERY',
      latitude: 0,
      longitude: 0,
    });
    setShowCreateModal(true);
  };

  // 編集
  const handleEdit = (location: Location) => {
    console.log('[LocationManagement] Editing location:', location);
    setFormData({
      clientName: location.clientName || '',
      name: location.name || '',
      address: location.address || '',
      locationType: (location.locationType === 'PICKUP' || location.locationType === 'DELIVERY') 
        ? location.locationType 
        : 'DELIVERY',
      latitude: location.latitude || 0,
      longitude: location.longitude || 0,
    });
    setSelectedLocationId(location.id);
    setShowEditModal(true);
  };

  // 削除
  const handleDelete = (locationId: string) => {
    setSelectedLocationId(locationId);
    setShowDeleteDialog(true);
  };

  // 作成処理（新しいLocationFormModal用）
  const handleSubmitCreate = async (data: Omit<LocationFormData, 'postalCode'>) => {
    const locationData = {
      clientName: data.clientName,
      name: data.name,
      address: data.address,
      locationType: data.locationType,
      registrationMethod: 'admin' as const,
      ...(data.latitude && data.longitude && {
        latitude: data.latitude,
        longitude: data.longitude,
      }),
    };

    console.log('[LocationManagement] Creating location:', locationData);

    const success = await createLocation(locationData);

    if (success) {
      toast.success('場所を登録しました');
      setShowCreateModal(false);
    }
  };

  // 更新処理（新しいLocationFormModal用）
  const handleSubmitEdit = async (data: Omit<LocationFormData, 'postalCode'>) => {
    if (!selectedLocationId) return;

    const locationData = {
      clientName: data.clientName,
      name: data.name,
      address: data.address,
      locationType: data.locationType,
      ...(data.latitude && data.longitude && {
        latitude: data.latitude,
        longitude: data.longitude,
      }),
    };

    console.log('[LocationManagement] Updating location:', selectedLocationId, locationData);

    const success = await updateLocation(selectedLocationId, locationData);

    if (success) {
      toast.success('場所情報を更新しました');
      setShowEditModal(false);
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

  if (locationLoading && (!locations || locations.length === 0)) {
    return <SectionLoading text="場所一覧を読み込み中..." />;
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">積込・積降場所マスタ</h1>
          <p className="mt-2 text-sm text-gray-700">
            積込場所・積降場所の登録・編集・削除を行います
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
              { value: 'PICKUP', label: '積込' },
              { value: 'DELIVERY', label: '積降' },
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

      {/* 新規作成モーダル（新しいLocationFormModal） */}
      <LocationFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新規場所追加"
        onSubmit={handleSubmitCreate}
        loading={locationLoading}
      />

      {/* 編集モーダル（新しいLocationFormModal） */}
      <LocationFormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedLocationId(null);
        }}
        title="場所情報編集"
        initialData={{
          clientName: formData.clientName,
          name: formData.name,
          address: formData.address,
          locationType: formData.locationType,
          latitude: formData.latitude,
          longitude: formData.longitude,
        }}
        onSubmit={handleSubmitEdit}
        loading={locationLoading}
      />

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