// frontend/cms/src/components/Layout/Layout.tsx
// 🔧 修正内容:
//   - ヘッダーを画面全幅（両端）に配置
//   - ヘッダーの下にサイドバーとメインコンテンツを横並びで配置
//   - 既存機能（サイドバー開閉・リサイズ処理・Toast通知）は100%保持

import React, { useEffect, useState } from 'react';
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
    // ② 修正: flex-col にすることでヘッダーを最上部・全幅に配置
    <div className="h-screen flex flex-col bg-gray-100">

      {/* ヘッダー: 画面最上部・両端まで全幅表示 */}
      <Header
        onMenuToggle={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
      />

      {/* ヘッダー下段: サイドバー + メインコンテンツ を横並び */}
      <div className="flex flex-1 overflow-hidden">

        {/* サイドバー（デスクトップは常時表示、モバイルはオーバーレイ） */}
        <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

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