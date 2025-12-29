// =====================================
// frontend/cms/src/pages/OperationDebug.tsx
// 運行・点検デバッグ画面 - 完全修正版
// 作成日: 2025年12月29日
// 修正日: 2025年12月29日 - トークンキー修正
// 目的: 運行履歴の詳細データをデバッグ確認する管理者専用画面
// =====================================

import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { SectionLoading } from '../components/ui/LoadingSpinner';

// =====================================
// 型定義
// =====================================

interface OperationListItem {
  id: string;
  operationNumber: string;
  startTime: string;
  endTime: string | null;
  status: string;
  vehiclePlateNumber: string;
  driverName: string;
}

interface InspectionItemDetail {
  operation_id: string;
  運行番号: string;
  inspection_record_id: string;
  点検種別: string;
  inspection_item_id: string;
  カテゴリー: string;
  点検項目名: string;
  項目説明: string;
  表示順序: number;
  result_id: string;
  結果値: string;
  is_passed: boolean;
  判定: string;
  備考: string | null;
  checked_at: string;
  点検時刻: string;
}

interface OperationDetail {
  operation_id: string;
  運行番号: string;
  運行ステータス: string;
  車両番号: string;
  車種: string;
  メーカー: string;
  driver_name: string;
  社員番号: string;
  開始時刻: string;
  終了時刻: string | null;
  開始走行距離_km: number;
  終了走行距離_km: number | null;
  走行距離_km: number | null;
  開始燃料_L: number;
  終了燃料_L: number | null;
  燃料消費_L: number | null;
  点検種別: string;
  点検ステータス: string;
  点検開始時刻: string;
  点検完了時刻: string | null;
  総合結果: string;
  総合備考: string | null;
  点検項目総数: number;
  合格項目数: number;
  不合格項目数: number;
}

// =====================================
// メインコンポーネント
// =====================================

const OperationDebug: React.FC = () => {
  // ステート管理
  const [operationId, setOperationId] = useState<string>('');
  const [recentOperations, setRecentOperations] = useState<OperationListItem[]>([]);
  const [inspectionItems, setInspectionItems] = useState<InspectionItemDetail[]>([]);
  const [operationDetails, setOperationDetails] = useState<OperationDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [showInspectionItems, setShowInspectionItems] = useState(true);
  const [showOperationDetails, setShowOperationDetails] = useState(true);

  // =====================================
  // API呼び出し
  // =====================================

  // 最近の運行一覧取得
  const fetchRecentOperations = async () => {
    try {
      setIsLoadingRecent(true);
      const token = localStorage.getItem('auth_token'); // ✅ 修正: 正しいキー名
      const response = await fetch('/api/debug/operations/recent?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('運行一覧の取得に失敗しました');
      }

      const result = await response.json();
      setRecentOperations(result.data);
    } catch (error) {
      console.error('運行一覧取得エラー:', error);
      toast.error('運行一覧の取得に失敗しました');
    } finally {
      setIsLoadingRecent(false);
    }
  };

  // 運行履歴詳細取得
  const fetchOperationDebugInfo = async (opId: string) => {
    if (!opId.trim()) {
      toast.error('運行IDを入力してください');
      return;
    }

    try {
      setIsLoading(true);
      setInspectionItems([]);
      setOperationDetails([]);

      const token = localStorage.getItem('auth_token'); // ✅ 修正: 正しいキー名
      const response = await fetch(`/api/debug/operations/${opId}/full`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('デバッグ情報の取得に失敗しました');
      }

      const result = await response.json();
      
      setInspectionItems(result.data.inspectionItems || []);
      setOperationDetails(result.data.operationDetail || []);
      
      toast.success('デバッグ情報を取得しました');
    } catch (error) {
      console.error('デバッグ情報取得エラー:', error);
      toast.error('デバッグ情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================
  // イベントハンドラ
  // =====================================

  const handleSearch = () => {
    fetchOperationDebugInfo(operationId);
  };

  const handleSelectOperation = (opId: string) => {
    setOperationId(opId);
    fetchOperationDebugInfo(opId);
  };

  // =====================================
  // useEffect
  // =====================================

  useEffect(() => {
    fetchRecentOperations();
  }, []);

  // =====================================
  // レンダリング用ヘルパー
  // =====================================

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      PLANNED: { color: 'bg-gray-100 text-gray-800', text: '計画中' },
      IN_PROGRESS: { color: 'bg-blue-100 text-blue-800', text: '運行中' },
      COMPLETED: { color: 'bg-green-100 text-green-800', text: '完了' },
      CANCELLED: { color: 'bg-red-100 text-red-800', text: 'キャンセル' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', text: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const getPassedIcon = (isPassed: boolean) => {
    return isPassed ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    );
  };

  // =====================================
  // レンダリング
  // =====================================

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-6 h-6" />
          運行・点検デバッグ
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          運行IDを指定して詳細なデバッグ情報を確認できます（管理者専用）
        </p>
      </div>

      {/* 検索セクション */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              label="運行ID (UUID) を入力してください"
              value={operationId}
              onChange={(e) => setOperationId(e.target.value)}
              placeholder="例: 1a55047f-a168-413c-bc1d-778ccbb041ce"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              disabled={isLoading || !operationId.trim()}
              className="whitespace-nowrap"
            >
              <Search className="w-4 h-4 mr-2" />
              検索
            </Button>
          </div>
        </div>
      </div>

      {/* 最近の運行一覧 */}
      {!isLoading && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近の運行一覧</h2>
          {isLoadingRecent ? (
            <SectionLoading />
          ) : recentOperations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">運行番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">車両</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">運転手</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">開始時刻</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentOperations.map((op) => (
                    <tr key={op.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {op.operationNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{op.vehiclePlateNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{op.driverName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(op.startTime).toLocaleString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(op.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleSelectOperation(op.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          選択
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">運行データがありません</p>
          )}
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && <SectionLoading />}

      {/* デバッグ結果表示 */}
      {!isLoading && operationId && (operationDetails.length > 0 || inspectionItems.length > 0) && (
        <>
          {/* 運行・点検統合詳細 */}
          {operationDetails.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowOperationDetails(!showOperationDetails)}
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  運行・点検統合詳細 ({operationDetails.length}件)
                </h2>
                {showOperationDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {showOperationDetails && (
                <div className="mt-4 overflow-x-auto">
                  <div className="space-y-4">
                    {operationDetails.map((detail, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-semibold text-gray-700">運行番号:</span>
                            <span className="ml-2">{detail.運行番号}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">車両:</span>
                            <span className="ml-2">{detail.車両番号} ({detail.車種})</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">運転手:</span>
                            <span className="ml-2">{detail.driver_name}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">開始時刻:</span>
                            <span className="ml-2">{detail.開始時刻}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">終了時刻:</span>
                            <span className="ml-2">{detail.終了時刻 || '未完了'}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">走行距離:</span>
                            <span className="ml-2">{detail.走行距離_km !== null ? `${detail.走行距離_km} km` : '-'}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">点検種別:</span>
                            <span className="ml-2">{detail.点検種別}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">総合結果:</span>
                            <span className="ml-2">{detail.総合結果}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">点検項目:</span>
                            <span className="ml-2">
                              合格 {detail.合格項目数} / 不合格 {detail.不合格項目数} (計 {detail.点検項目総数})
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 点検項目詳細 */}
          {inspectionItems.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowInspectionItems(!showInspectionItems)}
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  点検項目詳細 ({inspectionItems.length}件)
                </h2>
                {showInspectionItems ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {showInspectionItems && (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検種別</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリー</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検項目名</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">結果値</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">判定</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検時刻</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inspectionItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.点検種別}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.カテゴリー}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.点検項目名}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.結果値}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getPassedIcon(item.is_passed)}
                              <span className="text-sm">{item.判定}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.点検時刻}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{item.備考 || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* データなしメッセージ */}
          {!isLoading && operationId && operationDetails.length === 0 && inspectionItems.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-700">指定された運行IDのデータが見つかりませんでした</p>
              <p className="text-sm text-gray-500 mt-2">運行IDを確認してください</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OperationDebug;