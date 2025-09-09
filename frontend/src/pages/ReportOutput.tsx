import React, { useState } from 'react';
import { Download, FileText, Calendar, Truck, Settings, CheckCircle } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

const ReportOutput: React.FC = () => {
  const [dailyReportData, setDailyReportData] = useState({
    targetDate: new Date().toISOString().split('T')[0],
    outputFormat: 'pdf',
    includeItems: {
      vehicleInfo: true,
      driverInfo: true,
      operationDetails: true,
      inspectionResults: true
    }
  });

  const [annualReportData, setAnnualReportData] = useState({
    targetYear: new Date().getFullYear(),
    outputFormat: 'pdf'
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const handleDailyReportGenerate = async () => {
    setIsGenerating(true);
    try {
      // 実際のAPI呼び出しをシミュレート
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // ファイルダウンロードをシミュレート
      const filename = `日次運行報告書_${dailyReportData.targetDate}.${dailyReportData.outputFormat}`;
      console.log(`Generated: ${filename}`);
      
      // 実際の実装では、APIからBlobを取得してダウンロード
      alert(`${filename} を生成しました`);
    } catch (error) {
      console.error('Report generation failed:', error);
      alert('帳票生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnnualReportGenerate = async () => {
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const filename = `輸送実績報告書_${annualReportData.targetYear}年.${annualReportData.outputFormat}`;
      console.log(`Generated: ${filename}`);
      
      alert(`${filename} を生成しました`);
    } catch (error) {
      console.error('Report generation failed:', error);
      alert('帳票生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const outputFormatOptions = [
    { value: 'pdf', label: 'PDF' },
    { value: 'excel', label: 'Excel' },
    { value: 'csv', label: 'CSV' }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">帳票出力</h1>
        </div>

        <div className="text-sm text-gray-600">
          日報・輸送実績報告書の生成と出力
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 日次運行報告書 */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-6">
              <div className="bg-blue-100 p-2 rounded-lg mr-3">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">日次運行報告書</h2>
                <p className="text-sm text-gray-600">日別の運行記録をまとめた報告書</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  対象日
                </label>
                <Input
                  type="date"
                  value={dailyReportData.targetDate}
                  onChange={(e) => setDailyReportData({
                    ...dailyReportData,
                    targetDate: e.target.value
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  出力形式
                </label>
                <select
                  value={dailyReportData.outputFormat}
                  onChange={(e) => setDailyReportData({
                    ...dailyReportData,
                    outputFormat: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {outputFormatOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  含まれる項目
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'vehicleInfo', label: '車両情報' },
                    { key: 'driverInfo', label: '運転手情報' },
                    { key: 'operationDetails', label: '運行詳細' },
                    { key: 'inspectionResults', label: '点検結果' }
                  ].map(item => (
                    <label key={item.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={dailyReportData.includeItems[item.key as keyof typeof dailyReportData.includeItems]}
                        onChange={(e) => setDailyReportData({
                          ...dailyReportData,
                          includeItems: {
                            ...dailyReportData.includeItems,
                            [item.key]: e.target.checked
                          }
                        })}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleDailyReportGenerate}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    日報生成
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 輸送実績報告書 */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-6">
              <div className="bg-green-100 p-2 rounded-lg mr-3">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">輸送実績報告書</h2>
                <p className="text-sm text-gray-600">年間の輸送実績をまとめた報告書</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  対象年
                </label>
                <select
                  value={annualReportData.targetYear}
                  onChange={(e) => setAnnualReportData({
                    ...annualReportData,
                    targetYear: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  出力形式
                </label>
                <select
                  value={annualReportData.outputFormat}
                  onChange={(e) => setAnnualReportData({
                    ...annualReportData,
                    outputFormat: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {outputFormatOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  含まれる内容
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    月別輸送実績
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    車両別実績
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    運転手別実績
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    品目別実績
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    燃費・距離統計
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleAnnualReportGenerate}
                disabled={isGenerating}
                className="w-full"
                variant="secondary"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    輸送実績報告書生成
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 最近の生成履歴 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FileText className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">最近の生成履歴</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    帳票名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    対象期間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    形式
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    生成日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    日次運行報告書
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    2025/01/15
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    PDF
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    2025/01/16 09:30
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    輸送実績報告書
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    2024年
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Excel
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    2025/01/10 14:22
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReportOutput;