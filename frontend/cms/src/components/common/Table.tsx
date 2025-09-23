import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, item: T, index: number) => React.ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  className?: string;
}

function Table<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'データがありません',
  sortBy,
  sortDirection,
  onSort,
  className = '',
}: TableProps<T>) {
  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable && onSort) {
      onSort(key);
    }
  };

  const getSortIcon = (key: string, sortable?: boolean) => {
    if (!sortable) return null;

    if (sortBy === key) {
      return sortDirection === 'asc' ? (
        <ChevronUp className="w-4 h-4" />
      ) : (
        <ChevronDown className="w-4 h-4" />
      );
    }

    return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
  };

  const getValue = (item: T, key: keyof T | string): any => {
    if (typeof key === 'string' && key.includes('.')) {
      // ネストされたプロパティの場合（例: 'user.name'）
      return key.split('.').reduce((obj, prop) => obj?.[prop], item);
    }
    return item[key as keyof T];
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <div className="h-4 bg-gray-300 rounded w-1/4"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-gray-200 px-6 py-4">
              <div className="flex space-x-4">
                <div className="h-4 bg-gray-300 rounded flex-1"></div>
                <div className="h-4 bg-gray-300 rounded flex-1"></div>
                <div className="h-4 bg-gray-300 rounded flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow overflow-hidden sm:rounded-md ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                }`}
                style={{ width: column.width }}
                onClick={() => handleSort(String(column.key), column.sortable)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.header}</span>
                  {getSortIcon(String(column.key), column.sortable)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-12 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    style={{ width: column.width }}
                  >
                    {column.render
                      ? column.render(getValue(item, column.key), item, index)
                      : getValue(item, column.key) || '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ステータスバッジコンポーネント
interface StatusBadgeProps {
  status: string;
  type?: 'user' | 'vehicle' | 'operation' | 'gps';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  type = 'user', 
  className = '' 
}) => {
  const getStatusConfig = () => {
    const configs: Record<string, Record<string, { label: string; className: string }>> = {
      user: {
        active: { label: 'アクティブ', className: 'bg-green-100 text-green-800' },
        inactive: { label: '非アクティブ', className: 'bg-red-100 text-red-800' },
      },
      vehicle: {
        active: { label: '稼働中', className: 'bg-green-100 text-green-800' },
        inactive: { label: '非稼働', className: 'bg-red-100 text-red-800' },
        maintenance: { label: '整備中', className: 'bg-yellow-100 text-yellow-800' },
      },
      operation: {
        ongoing: { label: '運行中', className: 'bg-blue-100 text-blue-800' },
        completed: { label: '完了', className: 'bg-green-100 text-green-800' },
        cancelled: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
      },
      gps: {
        driving: { label: '運転中', className: 'bg-blue-100 text-blue-800' },
        loading: { label: '積込中', className: 'bg-orange-100 text-orange-800' },
        unloading: { label: '積下中', className: 'bg-purple-100 text-purple-800' },
        resting: { label: '休憩中', className: 'bg-gray-100 text-gray-800' },
        refueling: { label: '給油中', className: 'bg-yellow-100 text-yellow-800' },
        offline: { label: 'オフライン', className: 'bg-red-100 text-red-800' },
      },
    };

    return configs[type]?.[status] || { 
      label: status, 
      className: 'bg-gray-100 text-gray-800' 
    };
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
};

// アクションボタングループコンポーネント
interface ActionButtonsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  viewLabel?: string;
  size?: 'sm' | 'md';
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onEdit,
  onDelete,
  onView,
  editLabel = '編集',
  deleteLabel = '削除',
  viewLabel = '詳細',
  size = 'sm',
}) => {
  const buttonClass = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm';

  return (
    <div className="flex space-x-2">
      {onView && (
        <button
          onClick={onView}
          className={`${buttonClass} text-blue-600 hover:text-blue-800 font-medium`}
        >
          {viewLabel}
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className={`${buttonClass} text-indigo-600 hover:text-indigo-800 font-medium`}
        >
          {editLabel}
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className={`${buttonClass} text-red-600 hover:text-red-800 font-medium`}
        >
          {deleteLabel}
        </button>
      )}
    </div>
  );
};

export default Table;