import React, { useEffect, useState } from 'react';
import { useTLog } from '../hooks/useTLog';
import { Plus, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMasterStore } from '../store/masterStore';
import { Location } from '../types';
import Button from '../components/common/Button';
// Input/Select は不使用のため削除
import Table, { ActionButtons } from '../components/common/Table';
import { ConfirmDialog } from '../components/common/Modal';
import LocationFormModal from '../components/location/LocationFormModal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';

const LocationManagement: React.FC = () => {
  useTLog('LOCATION_MANAGEMENT', '場所管理');

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
  // ✅ BUG-DELETE-LOCAL: 削除済みIDをローカルで管理（論理削除でも画面から即消す）
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  // ✅ ソート状態
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ✅ ソートハンドラ
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  // ✅ フィルタリング + ソート
  const filteredLocations = React.useMemo(() => {
    const base = Array.isArray(locations) ? locations.filter(location => {
      if (deletedIds.has(location.id)) return false;
      const matchesSearch = !searchTerm ||
        (location.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (location.address?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      const matchesType = !typeFilter ||
        (typeFilter === 'PICKUP' ? (location.locationType === 'PICKUP' || location.locationType === 'DEPOT') :
         typeFilter === 'DELIVERY' ? (location.locationType === 'DELIVERY' || (location.locationType as string) === 'DESTINATION') :
         (location.locationType as string) === typeFilter);
      return matchesSearch && matchesType;
    }) : [];
    return [...base].sort((a, b) => {
      let aVal = (a as any)[sortBy] ?? '';
      let bVal = (b as any)[sortBy] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [locations, searchTerm, typeFilter, sortBy, sortDirection, deletedIds]);


  interface LocationFormData {
    name: string;
    address: string;
    locationType: 'PICKUP' | 'DELIVERY' | 'BOTH';
    latitude: number;
    longitude: number;
  }

  // フォームデータ
  const [formData, setFormData] = useState<LocationFormData>({
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


  console.log('[LocationManagement] Filtered locations:', filteredLocations.length);

  // テーブルの列定義（幅固定・省略・ソート対応・操作列常時表示）
  const columns = [
    {
      key: 'name',
      header: '場所名',
      sortable: true,
      width: '160px',
      render: (value: string) => (
        <span className="block text-sm font-medium max-w-[150px] truncate" title={value || ''}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'address',
      header: '住所',
      sortable: true,
      width: '260px',
      render: (value: string) => (
        <span className="block text-sm max-w-[250px] truncate text-gray-600" title={value || ''}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'locationType',
      header: '場所種別',
      width: '96px',
      render: (value: string) => {
        const config: Record<string, { label: string; className: string }> = {
          PICKUP:      { label: '積込',      className: 'bg-blue-100 text-blue-800' },
          DEPOT:       { label: '積込',      className: 'bg-blue-100 text-blue-800' },
          DELIVERY:    { label: '積降',      className: 'bg-green-100 text-green-800' },
          DESTINATION: { label: '積降',      className: 'bg-green-100 text-green-800' },
          BOTH:        { label: '積込・積降', className: 'bg-purple-100 text-purple-800' },
        };
        const c = config[value] ?? { label: value, className: 'bg-gray-100 text-gray-800' };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      key: 'specialInstructions',   // ✅ DBの実フィールドを直接参照
      header: '登録方法',
      width: '96px',
      render: (value: string, location: Location) => {
        // ✅ 登録方法判定（確実版）:
        // quickAddLocation → specialInstructions = 'モバイルからクイック登録' がDBに保存される
        // CMS登録 → specialInstructions が null/空/undefined
        //
        // value = specialInstructions の値（Tableコンポーネントが location.specialInstructions を渡す）
        // location オブジェクトからも参照（型が合わない場合のフォールバック）
        const sp = value ||
          (location as any).specialInstructions ||
          (location as any).special_instructions || '';
        
        // locationType でのフォールバック判定:
        // DEPOT / DESTINATION → 旧モバイル登録型（以前の実装）
        const lt = location.locationType as string;
        const isOldMobileType = lt === 'DEPOT' || lt === 'DESTINATION';
        
        const isMobile =
          sp.includes('モバイル') ||
          sp.includes('アプリ') ||
          sp.includes('クイック') ||
          isOldMobileType;
          
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isMobile ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'
          }`}>
            {isMobile ? 'アプリから' : 'CMSから'}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: '登録日',
      width: '100px',
      render: (value: string) => formatDate(value),
    },
    {
      key: 'actions',
      header: '操作',
      width: '80px',
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
      name: location.name || '',
      address: location.address || '',
      locationType: (['PICKUP', 'DELIVERY', 'BOTH'].includes(location.locationType))
        ? location.locationType as 'PICKUP' | 'DELIVERY' | 'BOTH'
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

    const idToDelete = selectedLocationId;
    const success = await deleteLocation(idToDelete);

    if (success) {
      // ✅ BUG-DELETE-LOCAL: 削除済みIDをローカルで記録（論理削除でも即時非表示）
      setDeletedIds(prev => new Set([...prev, idToDelete]));
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

      {/* 検索・フィルター（1行レイアウト） */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="客先名、場所名、住所で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md
                focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-gray-500 whitespace-nowrap">場所種別</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-2
                focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">すべての種別</option>
              <option value="PICKUP">積込</option>
              <option value="DELIVERY">積降</option>
              <option value="BOTH">積込・積降（両方）</option>
            </select>
          </div>
        </div>
      </div>

      {/* 場所一覧テーブル */}
      <Table
        data={filteredLocations}
        columns={columns}
        loading={locationLoading}
        emptyMessage="場所が見つかりません"
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
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