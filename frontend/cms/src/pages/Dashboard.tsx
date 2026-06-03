import React, { useEffect, useState } from 'react';
import { useTLog } from '../hooks/useTLog';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Truck, 
  FileText, 
  Navigation,
  TrendingUp,
  Clock,
  MapPin,
  MessageSquare,
  // Fuel
} from 'lucide-react';
import { apiClient } from '../utils/api';
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
  useTLog('DASHBOARD', 'ダッシュボード');

  const [stats, setStats] = useState<DashboardStats>({
    totalDrivers: 0,
    activeVehicles: 0,
    todayOperations: 0,
    onlineVehicles: 0,
  });
  const [recentOperations, setRecentOperations] = useState<RecentOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentFeedbacks, setRecentFeedbacks] = useState<Array<{
    id: string; reportType: string; screen: string; what: string;
    severity: number; status: string; createdAt: string;
    backlogIssueKey?: string;
  }>>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // ✅ 修正: fetch直接呼び出し → apiClient（axios）に統一
        // apiClientはローカル/staging環境を自動判別し、認証トークンも自動付与
        const [usersRes, vehiclesRes, operationsRes] = await Promise.allSettled([
          apiClient.get<any>('/users', { params: { limit: 200 } }),
          apiClient.get<any>('/vehicles', { params: { limit: 200 } }),
          apiClient.get<any>('/operations', { params: { limit: 100, sortOrder: 'desc' } }),
        ]);

        // ユーザー（稼働運転手数）
        // BUG-009修正: /users APIレスポンス構造に合わせてユーザー配列を正確に取得
        // apiClient ラッパー経由のレスポンス構造:
        //   usersRes.value.data = { success, data: { users: [...], pagination: {...} } }
        // → users配列は data.data.users にある
        let totalDrivers = 0;
        if (usersRes.status === 'fulfilled') {
          const raw = (usersRes.value as any)?.data;
          // パターン1: { data: { users: [...] } }  (二重ネスト)
          // パターン2: { users: [...] }             (一重ネスト)
          // パターン3: [...]                        (配列直接)
          const allUsers: any[] =
            Array.isArray(raw?.data?.users)  ? raw.data.users  :
            Array.isArray(raw?.data)         ? raw.data        :
            Array.isArray(raw?.users)        ? raw.users       :
            Array.isArray(raw)               ? raw             :
            [];
          console.log('[Dashboard] ユーザーデータ解析:', {
            rawType: typeof raw,
            hasDataUsers: Array.isArray(raw?.data?.users),
            hasDataArray: Array.isArray(raw?.data),
            hasUsers: Array.isArray(raw?.users),
            isArray: Array.isArray(raw),
            resolvedCount: allUsers.length
          });
          totalDrivers = allUsers.filter((u: any) =>
            u.role === 'DRIVER' && (u.isActive !== false)
          ).length;
        }

        // 車両（登録車両数・稼働中車両数）
        let activeVehicles = 0;
        let onlineVehicles = 0;
        if (vehiclesRes.status === 'fulfilled') {
          const vData = (vehiclesRes.value as any)?.data;
          const vehicleList: any[] = Array.isArray(vData)
            ? vData
            : Array.isArray(vData?.data)
              ? vData.data
              : Array.isArray(vData?.vehicles)
                ? vData.vehicles
                : [];
          activeVehicles = vehicleList.length;
          onlineVehicles = vehicleList.filter(
            (v: any) => v.status === 'ACTIVE' || v.status === 'IN_USE'
          ).length;
        }

        // 運行（今日の運行数・最近の運行）
        let todayOperations = 0;
        const recentOps: RecentOperation[] = [];
        if (operationsRes.status === 'fulfilled') {
          const opsData = (operationsRes.value as any)?.data;
          // ✅ 確定修正: /operations APIレスポンス構造
          // axios経由レスポンス: operationsRes.value = axiosレスポンス
          // → operationsRes.value.data = バックエンドのレスポンスボディ全体
          //   = { success:true, data:{ operations:[...], pagination:{...} } }
          // → opsData = { success, data:{ operations:[...] } }
          // 正解: opsData.data.operations
          const opList: any[] = (() => {
            // 段階的に構造を確認してoperations配列を取得
            if (Array.isArray(opsData?.data?.operations))       return opsData.data.operations;
            if (Array.isArray(opsData?.data?.data?.operations)) return opsData.data.data.operations;
            if (Array.isArray(opsData?.operations))             return opsData.operations;
            if (Array.isArray(opsData?.data?.data))             return opsData.data.data;
            if (Array.isArray(opsData?.data))                   return opsData.data;
            if (Array.isArray(opsData))                         return opsData;
            return [];
          })();

          // ✅ Fix②: JST(UTC+9)基準で今日の日付を計算して比較
          const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
          const todayStr = nowJST.toISOString().slice(0, 10); // JST YYYY-MM-DD
          todayOperations = opList.filter((op: any) => {
            const d = op.operationDate ?? op.actualStartTime ?? op.plannedStartTime ?? op.createdAt;
            if (!d) return false;
            // DBはUTC保存なのでJST変換して比較
            const dJST = new Date(new Date(d).getTime() + 9 * 60 * 60 * 1000);
            return dJST.toISOString().slice(0, 10) === todayStr;
          }).length;

          // 最近5件を整形
          // ✅ 修正: バックエンドのPrismaリレーション名に対応
          // - ドライバー: usersOperationsDriverIdTousers (Prisma関係名)
          // - 車両: vehicles (Prisma関係名)
          opList.slice(0, 5).forEach((op: any) => {
            const startTime = op.actualStartTime ?? op.plannedStartTime ?? op.createdAt;
            const endTime   = op.actualEndTime   ?? op.plannedEndTime;
            let operationTime = '-';
            if (startTime && endTime) {
              const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
              const hours   = Math.floor(diffMs / 3600000);
              const minutes = Math.floor((diffMs % 3600000) / 60000);
              operationTime = hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
            }

            // ✅ 修正: Prismaリレーション名 → フロントエンド互換名 → フォールバック の優先順位で取得
            const driverName =
              op.usersOperationsDriverIdTousers?.name    // Prismaリレーション (name カラム)
              ?? op.usersOperationsDriverIdTousers?.username  // Prismaリレーション (username カラム)
              ?? op.driver?.name                          // ネスト driver オブジェクト
              ?? op.driver?.username                      // ネスト driver オブジェクト (username)
              ?? op.driverName                            // フラットフィールド
              ?? '未割当';

            const vehicleNumber =
              op.vehicles?.plateNumber                   // Prismaリレーション (vehicles = 複数形)
              ?? op.vehicle?.plateNumber                 // ネスト vehicle オブジェクト
              ?? op.vehicleNumber                        // フラットフィールド
              ?? op.plateNumber                          // フラットフィールド
              ?? '不明';

            recentOps.push({
              id: op.id,
              date: startTime
                ? new Date(startTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit', })
                : '-',
              driverName,
              vehicleNumber,
              status: op.status === 'IN_PROGRESS' ? 'ongoing'
                    : op.status === 'COMPLETED'   ? 'completed'
                    : op.status ?? 'unknown',
              operationTime,
            });
          });
        }

        setStats({ totalDrivers, activeVehicles, todayOperations, onlineVehicles });
        setRecentOperations(recentOps);

        // 直近フィードバック取得
        try {
          const fbToken = localStorage.getItem('auth_token');
          const fbRes = await fetch('/api/v1/feedback?limit=5&sortBy=createdAt&sortOrder=desc', {
            headers: { 'Content-Type': 'application/json', ...(fbToken ? { Authorization: 'Bearer ' + fbToken } : {}) },
          });
          if (fbRes.ok) {
            const fbJson = await fbRes.json();
            setRecentFeedbacks(fbJson.data || []);
          }
        } catch (_) { /* FB取得失敗は無視 */ }

        setLoading(false);
      } catch (error: any) {
        // BUG-009修正: error が {} になる問題を修正（各フィールドを明示展開）
        console.error('[ERROR] ダッシュボードデータの取得に失敗しました:', {
          message: error?.message,
          status:  error?.response?.status,
          data:    error?.response?.data,
          code:    error?.code,
        });
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

      {/* フィードバック直近対応状況 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary-600" />
            <h3 className="text-base font-semibold text-gray-900">直近のフィードバック</h3>
          </div>
          <Link to="/feedback" className="text-xs text-primary-600 hover:underline">
            すべて表示 →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recentFeedbacks.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">フィードバックはありません</div>
          ) : recentFeedbacks.map((fb) => {
            const typeLabels: Record<string, string> = {
              bug: '🐛 バグ', odd: '⚠️ おかしい', improve: '💡 改善',
              feature: '✨ 新機能', data: '📊 データ', good: '👍 良い',
            };
            const statusConfig: Record<string, { color: string; label: string }> = {
              new:         { color: 'text-red-500',    label: '新規' },
              in_progress: { color: 'text-yellow-600', label: '対応中' },
              resolved:    { color: 'text-green-600',  label: '完了' },
              wontfix:     { color: 'text-gray-400',   label: '却下' },
            };
            const sevDots = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];
            const sevDot = sevDots[fb.severity] ?? 'bg-gray-300';
            const st = statusConfig[fb.status] ?? statusConfig['new']!;
            return (
              <Link key={fb.id} to={`/feedback/${fb.id}`} className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${sevDot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-gray-500">{typeLabels[fb.reportType] ?? fb.reportType}</span>
                    <span className="text-xs text-gray-400">{fb.screen}</span>
                    {fb.backlogIssueKey && (
                      <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{fb.backlogIssueKey}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 truncate">{fb.what}</p>
                </div>
                <span className={`text-xs flex-shrink-0 ${st.color}`}>{st.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;