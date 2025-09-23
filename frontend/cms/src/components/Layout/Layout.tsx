import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // サイドバーの開閉制御
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // ウィンドウリサイズ時の処理
  useEffect(() => {
    const handleResize = () => {
      // デスクトップサイズ（lg以上）の場合、サイドバーを閉じる
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen flex bg-gray-100">
      {/* サイドバー */}
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* ヘッダー */}
        <Header 
          onMenuToggle={toggleSidebar} 
          isSidebarOpen={isSidebarOpen} 
        />

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* トースト通知 */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
};

export default Layout;