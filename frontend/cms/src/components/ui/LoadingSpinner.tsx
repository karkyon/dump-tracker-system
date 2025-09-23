import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  overlay?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  text,
  overlay = false,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const spinner = (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className={`animate-spin text-primary-600 ${sizeClasses[size]}`} />
        {text && (
          <p className="text-sm text-gray-600">{text}</p>
        )}
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 shadow-lg">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

// ページローディング用のコンポーネント
export const PageLoading: React.FC<{ text?: string }> = ({ text = '読み込み中...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
};

// セクションローディング用のコンポーネント
export const SectionLoading: React.FC<{ text?: string; height?: string }> = ({ 
  text = '読み込み中...', 
  height = 'h-64' 
}) => {
  return (
    <div className={`flex items-center justify-center ${height}`}>
      <LoadingSpinner size="md" text={text} />
    </div>
  );
};

// インラインローディング用のコンポーネント
export const InlineLoading: React.FC<{ text?: string }> = ({ text }) => {
  return (
    <div className="flex items-center space-x-2">
      <LoadingSpinner size="sm" />
      {text && <span className="text-sm text-gray-600">{text}</span>}
    </div>
  );
};

// スケルトンローディング用のコンポーネント
export const SkeletonLoader: React.FC<{ 
  rows?: number; 
  className?: string;
  showAvatar?: boolean;
}> = ({ 
  rows = 3, 
  className = '',
  showAvatar = false 
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4 py-4">
          {showAvatar && (
            <div className="rounded-full bg-gray-300 h-10 w-10"></div>
          )}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

// カードスケルトンローディング
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-300 rounded"></div>
              <div className="h-3 bg-gray-300 rounded w-5/6"></div>
              <div className="h-3 bg-gray-300 rounded w-4/6"></div>
            </div>
            <div className="mt-4 flex space-x-2">
              <div className="h-8 bg-gray-300 rounded w-16"></div>
              <div className="h-8 bg-gray-300 rounded w-16"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// テーブルスケルトンローディング
export const TableSkeleton: React.FC<{ 
  columns?: number; 
  rows?: number; 
}> = ({ 
  columns = 4, 
  rows = 5 
}) => {
  return (
    <div className="animate-pulse">
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {/* ヘッダー */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <div key={index} className="h-4 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
        
        {/* 行 */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4 border-b border-gray-200">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="h-4 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingSpinner;