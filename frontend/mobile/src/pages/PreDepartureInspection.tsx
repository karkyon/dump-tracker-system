// frontend/mobile/src/pages/PreDepartureInspection.tsx
// D3: 乗車前点検画面 - 修正版

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ClipboardCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2,
  Circle,
  MapPin,
  Package,
  Building2,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface InspectionItem {
  id: string;
  label: string;
  checked: boolean;
}

interface LoadingInfo {
  customer: string;
  location: string;
  cargoType: string;
}

const PreDepartureInspection: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([
    { id: '1', label: 'エンジンオイルの量', checked: false },
    { id: '2', label: 'タイヤの空気圧・摩耗・亀裂', checked: false },
    { id: '3', label: 'ブレーキの効き', checked: false },
    { id: '4', label: 'ライト類の点灯確認', checked: false },
    { id: '5', label: 'ウインカー・ハザードの動作', checked: false },
    { id: '6', label: 'ミラーの調整', checked: false },
    { id: '7', label: 'シートベルトの状態', checked: false },
    { id: '8', label: '荷台の清掃・異物確認', checked: false },
    { id: '9', label: '各作動油の漏れ', checked: false },
    { id: '10', label: '燃料の量', checked: false },
  ]);
  
  const [loadingInfo] = useState<LoadingInfo>({
    customer: '○○建設株式会社',
    location: '東京都江東区豊洲1-2-3',
    cargoType: '土砂'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [cargoConfirmed, setCargoConfirmed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    
    const vehicleId = sessionStorage.getItem('selected_vehicle_id');
    if (!vehicleId) {
      toast.error('車両情報を選択してください');
      navigate('/vehicle-info', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const toggleInspectionItem = (id: string) => {
    setInspectionItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const checkAll = () => {
    setInspectionItems(prev =>
      prev.map(item => ({ ...item, checked: true }))
    );
    toast.success('全項目をチェックしました');
  };

  const isAllChecked = inspectionItems.every(item => item.checked);
  const checkedCount = inspectionItems.filter(item => item.checked).length;

  const validateForm = (): boolean => {
    if (!isAllChecked) {
      toast.error('すべての点検項目をチェックしてください');
      return false;
    }
    
    if (!cargoConfirmed) {
      toast.error('積荷内容を確認してください');
      return false;
    }
    
    return true;
  };

  const handleStartOperation = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      sessionStorage.setItem('inspection_completed', 'true');
      sessionStorage.setItem('loading_info', JSON.stringify(loadingInfo));
      
      toast.success('乗車前点検が完了しました');
      
      setTimeout(() => {
        navigate('/operation-record');
      }, 500);
      
    } catch (error: any) {
      console.error('運行開始エラー:', error);
      toast.error('運行開始に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/vehicle-info');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-md mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ClipboardCheck className="w-7 h-7" />
              <h1 className="text-xl font-bold">乗車前点検</h1>
            </div>
            <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-semibold">
              {checkedCount}/{inspectionItems.length}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-blue-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            積込情報
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <Building2 className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">客先名</p>
                <p className="text-sm font-semibold text-gray-800">{loadingInfo.customer}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">積込場所</p>
                <p className="text-sm font-semibold text-gray-800">{loadingInfo.location}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Package className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">品目</p>
                <p className="text-sm font-semibold text-gray-800">{loadingInfo.cargoType}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-5 pt-4 border-t border-gray-200">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cargoConfirmed}
                onChange={(e) => setCargoConfirmed(e.target.checked)}
                className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded 
                  focus:ring-green-500 focus:ring-2 cursor-pointer"
              />
              <span className="ml-3 text-sm font-semibold text-gray-700">
                積荷内容を確認済み
              </span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <ClipboardCheck className="w-5 h-5 mr-2 text-green-600" />
              点検項目
            </h2>
            <button
              onClick={checkAll}
              className="text-sm font-semibold text-green-600 hover:text-green-700 
                px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
            >
              全てチェック
            </button>
          </div>
          
          <div className="space-y-2">
            {inspectionItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => toggleInspectionItem(item.id)}
                className={`w-full flex items-center p-4 rounded-xl border-2 transition-all duration-200
                  ${item.checked
                    ? 'bg-green-50 border-green-300 hover:bg-green-100'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
              >
                <div className="flex-shrink-0 mr-3">
                  {item.checked ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-sm font-medium ${
                    item.checked ? 'text-green-800' : 'text-gray-700'
                  }`}>
                    {index + 1}. {item.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-5 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-gray-700">進捗状況</span>
              <span className={`font-bold ${isAllChecked ? 'text-green-600' : 'text-gray-600'}`}>
                {checkedCount} / {inspectionItems.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isAllChecked ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${(checkedCount / inspectionItems.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleStartOperation}
            disabled={!isAllChecked || !cargoConfirmed || isLoading}
            className={`w-full py-4 rounded-xl font-semibold text-white text-lg
              transition-all duration-200 flex items-center justify-center space-x-3
              ${!isAllChecked || !cargoConfirmed || isLoading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:scale-[0.98] shadow-lg hover:shadow-xl'
              }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>運行開始中...</span>
              </>
            ) : (
              <>
                <span>運行開始</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <button
            onClick={handleBack}
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-semibold text-gray-700 text-lg
              bg-gray-200 hover:bg-gray-300 active:scale-[0.98]
              transition-all duration-200 flex items-center justify-center space-x-3
              shadow-md hover:shadow-lg disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default PreDepartureInspection;