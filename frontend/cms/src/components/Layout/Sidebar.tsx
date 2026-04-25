// frontend/cms/src/components/Layout/Sidebar.tsx - constants.ts統合版
// 🔧 修正内容:
//   - constants.ts の NAVIGATION_ITEMS をインポートして使用
//   - Layout.tsx の flex-col 構造変更に対応:
//     デスクトップ（lg以上）では static 配置で高さをメインコンテンツと揃える
//     モバイルでは従来通り fixed オーバーレイで表示
//   ② 会社ロゴ: localStorage から読み込みモバイルロゴエリアに表示
//   既存機能: adminOnly フィルタリング・ナビゲーション・フッター表示を100%保持

import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Users,
  Truck,
  CheckSquare,
  MapPin,
  Package,
  FileText,
  Navigation,
  Download,
  Settings,
  LucideIcon,
  Bug,
  AlertTriangle,
  Building2,
  Satellite,
} from 'lucide-react';
import { NAVIGATION_ITEMS } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';  // ✅ 認証ストア追加
import { COMPANY_LOGO_KEY } from '../../pages/SystemSettings';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// ✅ アイコン名から実際のアイコンコンポーネントへのマッピング
const iconMap: Record<string, LucideIcon> = {
  BarChart3:    BarChart3,
  Users:        Users,
  Truck:        Truck,
  CheckSquare:  CheckSquare,
  MapPin:       MapPin,
  Package:      Package,
  FileText:     FileText,
  Navigation:   Navigation,
  Download:     Download,
  Settings:     Settings,
  Bug:          Bug,
  AlertTriangle: AlertTriangle,
  Building2: Building2,
  Satellite: Satellite,
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  // ✅ ユーザー情報取得（adminOnlyフィルタリング用）
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // ② 会社ロゴ: localStorage から読み込み（モバイル時のロゴエリアに表示）
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem(COMPANY_LOGO_KEY) || null;
  });

  // ② storage イベント: 別タブ / システム設定ページでロゴが更新された場合に同期
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === COMPANY_LOGO_KEY) {
        setLogoUrl(e.newValue || null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ② 同一タブ内でのロゴ変更を検知するポーリング（500ms間隔）
  useEffect(() => {
    const interval = setInterval(() => {
      const current = localStorage.getItem(COMPANY_LOGO_KEY) || null;
      setLogoUrl(prev => (prev !== current ? current : prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = () => {
    // モバイルでナビゲーション時にサイドバーを閉じる
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // ✅ adminOnly フィルタリング
  const filteredItems = NAVIGATION_ITEMS.filter((item) => {
    if ((item as any).adminOnly) {
      return isAdmin;
    }
    return true;
  });

  return (
    <>
      {/* モバイル: オーバーレイ背景 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75" />
        </div>
      )}

      {/*
        ② Layout 構造変更対応:
          - デスクトップ(lg以上): static 配置・w-64 固定幅
            Layout の flex-row 子要素として配置されるため、
            ヘッダー下段のサイドバーとして正しく機能する
          - モバイル: 従来通り fixed オーバーレイ表示
      */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:w-64 lg:flex-shrink-0 lg:h-full ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* ロゴエリア（モバイル時のみ表示: lg以上ではヘッダーにロゴがあるため不要） */}
          <div className="flex items-center h-16 px-4 bg-gray-900 lg:hidden">
            <div className="flex items-center">
              {/* ② 会社ロゴ: 登録済みならロゴ画像、未登録ならデフォルトアイコン */}
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="会社ロゴ"
                  className="h-8 w-auto max-w-[100px] object-contain"
                />
              ) : (
                <div className="bg-primary-600 text-white rounded-lg p-2">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
              )}
              <div className="ml-3">
                <h1 className="text-sm font-semibold text-white">
                  ダンプ運行記録システム
                </h1>
              </div>
            </div>
          </div>

          {/* ナビゲーションメニュー */}
          <nav className="flex-1 px-2 py-4 bg-gray-800 space-y-1 overflow-y-auto">
            {filteredItems.map((item) => {
              // ✅ constants.ts の icon 文字列から実際のアイコンコンポーネントを取得
              const Icon = iconMap[item.icon];

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`
                  }
                >
                  <Icon
                    className="mr-3 h-5 w-5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          {/* フッター情報 */}
          <div className="flex-shrink-0 bg-gray-900 p-4">
            <div className="text-xs text-gray-400">
              <p>Version 1.0.0</p>
              <p className="mt-1">© 2025 運行記録システム</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;