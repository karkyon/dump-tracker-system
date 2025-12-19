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
    <div className={`bg-white shadow overflow-x-auto sm:rounded-md ${className}`}>
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

interface StatusBadgeProps {
  status: string;
  type?: 'user' | 'vehicle' | 'operation' | 'gps';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'user',
  className = '',
}) => {
  const getStatusConfig = () => {
    switch (type) {
      case 'user':
        switch (status) {
          case 'ACTIVE':
          case 'active':
          case true:
            return { color: 'bg-green-100 text-green-800', label: '有効' };
          case 'INACTIVE':
          case 'inactive':
          case false:
            return { color: 'bg-gray-100 text-gray-800', label: '無効' };
          default:
            return { color: 'bg-gray-100 text-gray-800', label: status };
        }
      case 'vehicle':
        switch (status) {
          case 'ACTIVE':
            return { color: 'bg-green-100 text-green-800', label: '稼働中' };
          case 'INACTIVE':
            return { color: 'bg-gray-100 text-gray-800', label: '停止中' };
          case 'MAINTENANCE':
            return { color: 'bg-yellow-100 text-yellow-800', label: '整備中' };
          default:
            return { color: 'bg-gray-100 text-gray-800', label: status };
        }
      case 'operation':
        switch (status) {
          case 'ongoing':
            return { color: 'bg-blue-100 text-blue-800', label: '運行中' };
          case 'completed':
            return { color: 'bg-green-100 text-green-800', label: '完了' };
          case 'cancelled':
            return { color: 'bg-red-100 text-red-800', label: 'キャンセル' };
          default:
            return { color: 'bg-gray-100 text-gray-800', label: status };
        }
      case 'gps':
        switch (status) {
          case 'moving':
            return { color: 'bg-green-100 text-green-800', label: '移動中' };
          case 'stopped':
            return { color: 'bg-red-100 text-red-800', label: '停止' };
          case 'idle':
            return { color: 'bg-yellow-100 text-yellow-800', label: 'アイドル' };
          default:
            return { color: 'bg-gray-100 text-gray-800', label: status };
        }
      default:
        return { color: 'bg-gray-100 text-gray-800', label: status };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}
    >
      {config.label}
    </span>
  );
};

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