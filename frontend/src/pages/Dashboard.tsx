import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Truck, 
  FileText, 
  Navigation,
  TrendingUp,
  Clock,
  MapPin,
  Fuel
} from 'lucide-react';
import { formatDate, getRelativeTime } from '../utils/helpers';
import { SectionLoading } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/common/Table';

interface DashboardStats {
  totalDrivers: number;
  activeVehicles: number;
  todayOperations: number;
  onlineVehicles: number;
}

interface RecentOperation {
  id: string;
  date: string;
  driverName: string;
  vehicleNumber: string;
  status: string;
  operationTime: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalDrivers: 0,
    activeVehicles: 0,
    todayOperations: 0,
    onlineVehicles: 0,
  });
  const [recentOperations, setRecentOperations] = useState<RecentOperation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ダミーデータでダッシュボードを初期化
    // 実際の実装では API からデータを取得
    const fetchDashboardData = async () => {
      try {
        // ダミーデータ
        setStats({
          totalDrivers: 8,
          activeVehicles: 4,
          todayOperations: 12,
          onlineVehicles: 3,
        });

        setRecentOperations([
          {
            id: '1',
            date: '2025/01/15 08:30',
            driverName: '山田太郎',
            vehicleNumber: '倉敷100あ1234',
            status: 'ongoing',
            operationTime: '2時間30分',
          },
          {
            id: '2',
            date: '2025/01/15 07:00',
            driverName: '佐藤花子',
            vehicleNumber: '倉敷100あ5678',
            status: 'completed',
            operationTime: '3時間15分',
          },
        ]);

        setLoading(false);
      } catch (error) {
        console.error('ダッシュボードデータの取得に失敗しました:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statsCards = [
    {
      title: '稼働運転手',
      value: stats.totalDrivers,
      icon: Users,
      color: 'blue',
      link: '/users',
    },
    {
      title: '今日の運行数',
      value: stats.todayOperations,
      icon: FileText,
      color: 'green',
      link: '/operations',
    },
    {
      title: '登録車両数',
      value: stats.activeVehicles,
      icon: Truck,
      color: 'purple',
      link: '/vehicles',
    },
    {
      title: 'オンライン車両',
      value: stats.onlineVehicles,
      icon: Navigation,
      color: 'orange',
      link: '/gps-monitoring',
    },
  ];

  if (loading) {
    return <SectionLoading text="ダッシュボードを読み込み中..." height="h-96" />;
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600">
          システムの概要と最近の活動を確認できます
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          const colorClasses = {
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            purple: 'bg-purple-500',
            orange: 'bg-orange-500',
          };

          return (
            <Link
              key={index}
              to={card.link}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-md ${colorClasses[card.color as keyof typeof colorClasses]}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {card.title}
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {card.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* メインコンテンツエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近の運行記録 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">最近の運行記録</h3>
              <Link
                to="/operations"
                className="text-sm text-primary-600 hover:text-primary-900"
              >
                すべて表示
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {recentOperations.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                運行記録がありません
              </div>
            ) : (
              recentOperations.map((operation) => (
                <div key={operation.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Clock className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {operation.driverName} • {operation.vehicleNumber}
                          </p>
                          <p className="text-sm text-gray-500">
                            {operation.date} • 運行時間: {operation.operationTime}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <StatusBadge status={operation.status} type="operation" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* クイックアクション */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">クイックアクション</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/users"
                className="relative group bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-blue-600 text-white">
                    <Users className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900">
                    ユーザー管理
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    運転手・管理者の追加・編集
                  </p>
                </div>
              </Link>

              <Link
                to="/vehicles"
                className="relative group bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-purple-600 text-white">
                    <Truck className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900">
                    車両マスタ
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    車両情報の管理
                  </p>
                </div>
              </Link>

              <Link
                to="/gps-monitoring"
                className="relative group bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-orange-600 text-white">
                    <MapPin className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900">
                    GPS監視
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    リアルタイム位置確認
                  </p>
                </div>
              </Link>

              <Link
                to="/reports"
                className="relative group bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-green-600 text-white">
                    <TrendingUp className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900">
                    帳票出力
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    日報・年次報告書生成
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* システム情報 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">システム情報</h3>
        </div>
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">システムバージョン</dt>
              <dd className="mt-1 text-sm text-gray-900">v1.0.0</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">最終更新</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(new Date())}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">稼働状況</dt>
              <dd className="mt-1 text-sm text-green-600">正常</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">データベース</dt>
              <dd className="mt-1 text-sm text-green-600">接続中</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;