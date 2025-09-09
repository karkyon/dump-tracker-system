import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Table from '../components/common/Table';
import { useMasterStore } from '../store/masterStore';

interface CargoType {
  id: string;
  name: string;
  displayOrder: number;
  createdAt: string;
}

const CargoTypeManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCargoType, setEditingCargoType] = useState<CargoType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayOrder: 1
  });

  const { cargoTypes, loading, addCargoType, updateCargoType, deleteCargoType, fetchCargoTypes } = useMasterStore();

  useEffect(() => {
    fetchCargoTypes();
  }, [fetchCargoTypes]);

  const filteredCargoTypes = cargoTypes.filter(cargoType =>
    cargoType.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCargoType = () => {
    setEditingCargoType(null);
    setFormData({ name: '', displayOrder: cargoTypes.length + 1 });
    setIsModalOpen(true);
  };

  const handleEditCargoType = (cargoType: CargoType) => {
    setEditingCargoType(cargoType);
    setFormData({
      name: cargoType.name,
      displayOrder: cargoType.displayOrder
    });
    setIsModalOpen(true);
  };

  const handleDeleteCargoType = async (id: string) => {
    if (confirm('この荷物種別を削除しますか？')) {
      await deleteCargoType(id);
    }
  };

  const handleMoveUp = async (cargoType: CargoType) => {
    if (cargoType.displayOrder > 1) {
      await updateCargoType(cargoType.id, {
        displayOrder: cargoType.displayOrder - 1
      });
    }
  };

  const handleMoveDown = async (cargoType: CargoType) => {
    if (cargoType.displayOrder < cargoTypes.length) {
      await updateCargoType(cargoType.id, {
        displayOrder: cargoType.displayOrder + 1
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCargoType) {
      await updateCargoType(editingCargoType.id, formData);
    } else {
      await addCargoType(formData);
    }
    
    setIsModalOpen(false);
    setFormData({ name: '', displayOrder: 1 });
  };

  const columns = [
    { key: 'displayOrder', label: '表示順', width: '100px' },
    { key: 'name', label: '荷物種別名' },
    { key: 'createdAt', label: '登録日', width: '150px' },
    { key: 'actions', label: '操作', width: '200px' }
  ];

  const tableData = filteredCargoTypes.map(cargoType => ({
    displayOrder: cargoType.displayOrder,
    name: cargoType.name,
    createdAt: new Date(cargoType.createdAt).toLocaleDateString('ja-JP'),
    actions: (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleMoveUp(cargoType)}
          disabled={cargoType.displayOrder === 1}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleMoveDown(cargoType)}
          disabled={cargoType.displayOrder === cargoTypes.length}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEditCargoType(cargoType)}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => handleDeleteCargoType(cargoType.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    )
  }));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">荷物種別マスタ管理</h1>
          <Button onClick={handleAddCargoType}>
            <Plus className="w-4 h-4 mr-2" />
            新規荷物種別追加
          </Button>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-gray-900 mb-4">検索・フィルター</h2>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="荷物種別名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="w-4 h-4" />}
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-900 mb-2">
                荷物種別一覧 ({filteredCargoTypes.length}件)
              </h3>
            </div>

            <Table
              columns={columns}
              data={tableData}
              loading={loading}
              emptyMessage="荷物種別が見つかりません"
            />
          </div>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCargoType ? '荷物種別編集' : '新規荷物種別追加'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                荷物種別名 *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: RC、RM、土砂など"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                表示順
              </label>
              <Input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                min="1"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                キャンセル
              </Button>
              <Button type="submit">
                {editingCargoType ? '更新' : '追加'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
};

export default CargoTypeManagement;