import { DATE_FORMATS } from './constants';

// 日付関連のヘルパー関数
export const formatDate = (date: string | Date, format: string = DATE_FORMATS.DISPLAY): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  switch (format) {
    case DATE_FORMATS.DISPLAY:
      return `${year}/${month}/${day}`;
    case DATE_FORMATS.INPUT:
      return `${year}-${month}-${day}`;
    case DATE_FORMATS.DATETIME:
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    case DATE_FORMATS.TIME:
      return `${hours}:${minutes}`;
    default:
      return `${year}/${month}/${day}`;
  }
};

export const parseDate = (dateString: string): Date | null => {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

export const isToday = (date: string | Date): boolean => {
  const today = new Date();
  const compareDate = new Date(date);
  return (
    today.getFullYear() === compareDate.getFullYear() &&
    today.getMonth() === compareDate.getMonth() &&
    today.getDate() === compareDate.getDate()
  );
};

export const getRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const compareDate = new Date(date);
  const diffMs = now.getTime() - compareDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  return formatDate(date);
};

// 文字列操作
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

// 配列操作
export const sortByProperty = <T>(array: T[], property: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[property];
    const bVal = b[property];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const group = String(item[key]);
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

export const filterBySearch = <T>(array: T[], searchTerm: string, searchFields: (keyof T)[]): T[] => {
  if (!searchTerm.trim()) return array;
  
  const lowerSearchTerm = searchTerm.toLowerCase();
  return array.filter(item =>
    searchFields.some(field => {
      const value = item[field];
      return String(value).toLowerCase().includes(lowerSearchTerm);
    })
  );
};

// 数値・計算
export const roundToDecimal = (num: number, decimals: number = 2): number => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const formatNumber = (num: number, locale: string = 'ja-JP'): string => {
  return new Intl.NumberFormat(locale).format(num);
};

export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return roundToDecimal((value / total) * 100);
};

export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
           Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

export const smoothHeading = (headingBuffer: number[], newHeading: number): number => {
  headingBuffer.push(newHeading);
  if (headingBuffer.length > 3) {
    headingBuffer.shift();
  }

  if (headingBuffer.length > 1) {
    const lastHeading = headingBuffer[headingBuffer.length - 2];
    const diff = Math.abs(newHeading - lastHeading);
    const adjustedDiff = Math.min(diff, 360 - diff);
    
    if (adjustedDiff > 30) {
      return newHeading;
    }
  }

  let sumX = 0, sumY = 0;
  headingBuffer.forEach(heading => {
    sumX += Math.cos(heading * Math.PI / 180);
    sumY += Math.sin(heading * Math.PI / 180);
  });

  let avgHeading = Math.atan2(sumY, sumX) * 180 / Math.PI;
  return (avgHeading + 360) % 360;
};

export const smoothSpeed = (speedBuffer: number[], newSpeed: number): number => {
  speedBuffer.push(newSpeed);
  if (speedBuffer.length > 2) {
    speedBuffer.shift();
  }
  return speedBuffer.reduce((sum, speed) => sum + speed, 0) / speedBuffer.length;
};

// ファイル操作
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// バリデーション
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateRequired = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

export const validateMinLength = (value: string, minLength: number): boolean => {
  return value.length >= minLength;
};

export const validateMaxLength = (value: string, maxLength: number): boolean => {
  return value.length <= maxLength;
};

// ステータス関連
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    active: 'text-green-600 bg-green-100',
    inactive: 'text-red-600 bg-red-100',
    maintenance: 'text-yellow-600 bg-yellow-100',
    ongoing: 'text-blue-600 bg-blue-100',
    completed: 'text-green-600 bg-green-100',
    cancelled: 'text-red-600 bg-red-100',
    driving: 'text-blue-600 bg-blue-100',
    loading: 'text-orange-600 bg-orange-100',
    unloading: 'text-purple-600 bg-purple-100',
    resting: 'text-gray-600 bg-gray-100',
    refueling: 'text-yellow-600 bg-yellow-100',
    offline: 'text-red-600 bg-red-100',
  };
  
  return statusColors[status] || 'text-gray-600 bg-gray-100';
};

export const getStatusLabel = (status: string, type: string): string => {
  const statusLabels: Record<string, Record<string, string>> = {
    user: {
      active: 'アクティブ',
      inactive: '非アクティブ',
    },
    vehicle: {
      active: '稼働中',
      inactive: '非稼働',
      maintenance: '整備中',
    },
    operation: {
      ongoing: '運行中',
      completed: '完了',
      cancelled: 'キャンセル',
    },
    gps: {
      driving: '運転中',
      loading: '積込中',
      unloading: '積下中',
      resting: '休憩中',
      refueling: '給油中',
      offline: 'オフライン',
    },
  };
  
  return statusLabels[type]?.[status] || status;
};

// LocalStorage操作
export const setStorageItem = (key: string, value: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Failed to read from localStorage:', error);
    return defaultValue;
  }
};

export const removeStorageItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
  }
};

// デバウンス
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// クリップボード操作
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};