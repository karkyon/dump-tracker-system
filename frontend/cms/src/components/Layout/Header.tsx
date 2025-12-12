import React, { useState } from 'react';
import { Menu, X, Bell, User, LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  onMenuToggle: () => void;
  isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, isSidebarOpen }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* 左側：メニューボタンとロゴ */}
        <div className="flex items-center">
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
          >
            {isSidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>

          <div className="flex items-center ml-4 lg:ml-0">
            <div className="flex-shrink-0">
              <div className="flex items-center">
                <div className="bg-primary-600 text-white rounded-lg p-2">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h1 className="text-lg font-semibold text-gray-900">
                    ダンプ運行記録システム
                  </h1>
                  <p className="text-sm text-gray-500">管理者向けCMS</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右側：通知とユーザーメニュー */}
        <div className="flex items-center space-x-4">
          {/* 通知ボタン */}
          <button className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <Bell className="h-6 w-6" />
          </button>

          {/* ユーザーメニュー */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center max-w-xs text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 lg:p-2 lg:rounded-md lg:hover:bg-gray-50"
            >
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div className="ml-3 hidden lg:block">
                  <p className="text-sm font-medium text-gray-700">
                    {user?.name || 'ユーザー'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.role === 'ADMIN' ? '管理者' : '運転手'}
                  </p>
                </div>
              </div>
            </button>

            {/* ドロップダウンメニュー */}
            {isUserMenuOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1" role="menu">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  
                  <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4 mr-3" />
                    設定
                  </button>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    ログアウト
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ユーザーメニューのオーバーレイ */}
      {isUserMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;