// frontend/cms/src/components/Layout/Sidebar.tsx - 完全修正版
// 🔧 修正内容: メニュー名を「○○管理」に統一
// - 「車両マスタ」→「車両管理」
// - 「点検項目マスタ」→「点検項目管理」
// - 「積込・積下場所マスタ」→「積込・積下場所管理」
// - 「品目マスタ管理」→「品目管理」
// 既存機能: すべてのコード・ロジック・コメントを100%保持

import React from 'react';
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
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  // ✅ 修正: メニュー名を「○○管理」に統一
  const menuItems = [
    {
      id: 'dashboard',
      name: 'ダッシュボード',
      path: '/dashboard',
      icon: BarChart3,
    },
    {
      id: 'users',
      name: 'ユーザー管理',      // 既存のまま
      path: '/users',
      icon: Users,
    },
    {
      id: 'vehicles',
      name: '車両管理',          // ✅ 修正: 「車両マスタ」→「車両管理」
      path: '/vehicles',
      icon: Truck,
    },
    {
      id: 'inspection-items',
      name: '点検項目管理',      // ✅ 修正: 「点検項目マスタ」→「点検項目管理」
      path: '/inspection-items',
      icon: CheckSquare,
    },
    {
      id: 'locations',
      name: '積込・積下場所管理',  // ✅ 修正: 「積込・積下場所マスタ」→「積込・積下場所管理」
      path: '/locations',
      icon: MapPin,
    },
    {
      id: 'cargo-types',
      name: '品目管理',          // ✅ 修正: 「品目マスタ管理」→「品目管理」
      path: '/cargo-types',
      icon: Package,
    },
    {
      id: 'operations',
      name: '運行記録',          // 既存のまま
      path: '/operations',
      icon: FileText,
    },
    {
      id: 'gps-monitoring',
      name: 'GPSモニタリング',    // 既存のまま
      path: '/gps-monitoring',
      icon: Navigation,
    },
    {
      id: 'reports',
      name: '帳票出力',          // 既存のまま
      path: '/reports',
      icon: Download,
    },
    {
      id: 'settings',
      name: 'システム設定',      // 既存のまま
      path: '/settings',
      icon: Settings,
    },
  ];

  const handleNavClick = () => {
    // モバイルでナビゲーション時にサイドバーを閉じる
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* オーバーレイ（モバイル時） */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75" />
        </div>
      )}

      {/* サイドバー */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* ロゴエリア（モバイル時のみ表示） */}
          <div className="flex items-center h-16 px-4 bg-gray-900 lg:hidden">
            <div className="flex items-center">
              <div className="bg-primary-600 text-white rounded-lg p-2">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
              </div>
              <div className="ml-3">
                <h1 className="text-sm font-semibold text-white">
                  ダンプ運行記録システム
                </h1>
              </div>
            </div>
          </div>

          {/* ナビゲーションメニュー */}
          <nav className="flex-1 px-2 py-4 bg-gray-800 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
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