// frontend/cms/src/pages/CustomerManagement.tsx
// 客先マスタ管理ページ
import React, { useEffect, useState } from 'react';
import { useTLog } from '../hooks/useTLog';
import { Plus, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMasterStore } from '../store/masterStore';
import { Customer } from '../types';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Table, { ActionButtons } from '../components/common/Table';
import { ConfirmDialog } from '../components/common/Modal';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';

interface CustomerFormData {
  name: string;
  reading: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyForm = (): CustomerFormData => ({
  name: '', reading: '', address: '', phone: '', email: '', notes: '',
});

const CustomerManagement: React.FC = () => {
  useTLog('CUSTOMER_MANAGEMENT', '客先管理');

  const {
    customers,
    customerLoading,
    customerError,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  } = useMasterStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm());

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    if (customerError) { toast.error(customerError); }
  }, [customerError]);

  const filteredCustomers = Array.isArray(customers) ? customers.filter(c =>
    !searchTerm ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.reading?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const columns = [
    { key: 'name', header: '客先名', sortable: true, width: '160px' },
    { key: 'reading', header: '読み仮名', width: '140px' },
    { key: 'address', header: '住所', width: '240px',
      render: (v: string) => <span className="text-sm">{v || '-'}</span> },
    { key: 'phone', header: '電話番号', width: '120px',
      render: (v: string) => <span className="text-sm">{v || '-'}</span> },
    { key: 'isActive', header: '状態', width: '70px',
      render: (v: boolean) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
          {v !== false ? '有効' : '無効'}
        </span>
      )
    },
    { key: 'createdAt', header: '登録日', render: (v: string) => formatDate(v) },
    { key: 'actions', header: '操作',
      render: (_: any, customer: Customer) => (
        <ActionButtons
          onEdit={() => handleEdit(customer)}
          onDelete={() => { setSelectedId(customer.id); setShowDeleteDialog(true); }}
        />
      )
    },
  ];

  const handleCreate = () => { setFormData(emptyForm()); setShowCreateModal(true); };

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name || '',
      reading: customer.reading || '',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setSelectedId(customer.id);
    setShowEditModal(true);
  };

  const handleSubmitCreate = async () => {
    if (!formData.name.trim()) { toast.error('客先名は必須です'); return; }
    const success = await createCustomer(formData);
    if (success) { toast.success('客先を登録しました'); setShowCreateModal(false); }
  };

  const handleSubmitEdit = async () => {
    if (!selectedId) return;
    if (!formData.name.trim()) { toast.error('客先名は必須です'); return; }
    const success = await updateCustomer(selectedId, formData);
    if (success) { toast.success('客先情報を更新しました'); setShowEditModal(false); setSelectedId(null); }
  };

  const handleConfirmDelete = async () => {
    if (!selectedId) return;
    const success = await deleteCustomer(selectedId);
    if (success) { toast.success('客先を削除しました'); }
    setShowDeleteDialog(false);
    setSelectedId(null);
  };

  const FormBody = () => (
    <div className="space-y-4 p-4">
      <Input label="客先名 *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="例: 株式会社○○" />
      <Input label="読み仮名" value={formData.reading} onChange={e => setFormData({ ...formData, reading: e.target.value })} placeholder="例: かぶしきがいしゃ○○" />
      <Input label="住所" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="例: 大阪府○○市..." />
      <Input label="電話番号" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="例: 06-1234-5678" />
      <Input label="メールアドレス" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="例: info@example.com" />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
          placeholder="備考を入力..."
        />
      </div>
    </div>
  );

  if (customerLoading && customers.length === 0) return <SectionLoading message="客先データを読み込み中..." />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客先マスタ</h1>
          <p className="text-sm text-gray-500 mt-1">客先の登録・編集・削除を行います</p>
        </div>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> 新規客先追加
        </Button>
      </div>

      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="客先名、読み仮名、住所で検索..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Table data={filteredCustomers} columns={columns} loading={customerLoading} emptyMessage="客先が見つかりません" />

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">新規客先追加</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <FormBody />
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>キャンセル</Button>
              <Button onClick={handleSubmitCreate} disabled={customerLoading}>登録</Button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">客先情報編集</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <FormBody />
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>キャンセル</Button>
              <Button onClick={handleSubmitEdit} disabled={customerLoading}>更新</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setSelectedId(null); }}
        onConfirm={handleConfirmDelete}
        title="客先削除"
        message="この客先を削除してもよろしいですか？運行記録に紐づいている場合は無効化されます。"
        confirmText="削除"
        variant="danger"
        loading={customerLoading}
      />
    </div>
  );
};

export default CustomerManagement;
