// frontend/mobile/src/pages/RefuelRecord.tsx
// 🆕 2025年12月28日修正: API呼び出し実装
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import apiService from '../services/api';
import { useOperationStore } from '../stores/operationStore';

const RefuelRecord: React.FC = () => {
  const navigate = useNavigate();
  const operationStore = useOperationStore();
  
  const [fuelAmount, setFuelAmount] = useState<number>(0);
  const [fuelCost, setFuelCost] = useState<number>(0);
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 給油記録保存ハンドラー
   * 🆕 2025年12月28日修正: API呼び出し実装
   */
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // 🔧 バリデーション
      if (fuelAmount <= 0) {
        toast.error('給油量を入力してください');
        setIsSubmitting(false);
        return;
      }
      
      if (fuelCost <= 0) {
        toast.error('金額を入力してください');
        setIsSubmitting(false);
        return;
      }
      
      // 🔧 運行ID取得
      const currentOperationId = operationStore.operationId;
      
      if (!currentOperationId) {
        toast.error('運行IDが見つかりません。運行を開始してください。');
        console.error('❌ 運行ID未設定:', {
          operationStoreId: operationStore.operationId
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log('⛽ 給油記録保存開始:', {
        operationId: currentOperationId,
        fuelAmount,
        fuelCost,
        location,
        notes
      });
      
      // 🆕 給油記録API呼び出し
      const response = await apiService.recordFuel(currentOperationId, {
        fuelAmount: fuelAmount,
        fuelCost: fuelCost,
        fuelStation: location || undefined,
        notes: notes || undefined
      });
      
      console.log('✅ 給油記録API成功:', response);
      
      toast.success('給油記録を保存しました');
      navigate('/operation-record'); // 運行記録画面に戻る
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('❌ 給油記録保存エラー:', error);
      toast.error('給油記録の保存に失敗しました');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      background: '#f5f5f5'
    }}>
      {/* ヘッダー */}
      <div style={{
        background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        color: 'white',
        padding: '16px'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
          ⛽ 給油記録
        </h1>
      </div>

      {/* フォーム */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        <div style={{ background: 'white', borderRadius: '8px', padding: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              給油量 (L) <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="number"
              value={fuelAmount}
              onChange={(e) => setFuelAmount(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="給油量を入力"
              min="0"
              step="0.1"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              金額 (円) <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="number"
              value={fuelCost}
              onChange={(e) => setFuelCost(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="金額を入力"
              min="0"
              step="1"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              給油場所
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="給油場所を入力（例: ENEOS ○○店）"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              メモ
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                resize: 'vertical'
              }}
              placeholder="メモを入力"
            />
          </div>
        </div>
      </div>

      {/* ボタン */}
      <div style={{
        background: 'white',
        padding: '16px',
        borderTop: '2px solid #e0e0e0'
      }}>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            background: isSubmitting ? '#ccc' : '#FF9800',
            border: 'none',
            borderRadius: '8px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>

        <button
          onClick={() => navigate('/operation-record')}
          disabled={isSubmitting}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#666',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

export default RefuelRecord;

// =============================================================================
// 🆕🆕🆕 給油記録API呼び出し実装完了（2025年12月28日）
// =============================================================================

/**
 * 【2025年12月28日修正内容】
 *
 * ✅ 追加インポート:
 * - apiService: API呼び出しサービス
 * - useOperationStore: 運行ID取得用ストア
 *
 * ✅ handleSubmit修正:
 * - バリデーション追加（給油量・金額の必須チェック）
 * - 運行ID取得（operationStore.operationId）
 * - apiService.recordFuel() API呼び出し実装
 * - 詳細なログ出力（デバッグ用）
 * - エラーハンドリング強化
 *
 * ✅ UI改善:
 * - 必須項目に「*」マーク追加
 * - input要素にmin/step属性追加
 * - プレースホルダーテキスト改善
 *
 * ✅ 既存機能100%保持:
 * - すべての既存UI・スタイルを保持
 * - キャンセルボタンの動作を保持
 * - isSubmittingによるボタン制御を保持
 *
 * 【使用API】
 * POST /api/v1/trips/:tripId/fuel
 * - fuelAmount: 給油量（リットル）（必須）
 * - fuelCost: 給油金額（円）（必須）
 * - fuelStation: 給油所名（オプション）
 * - notes: メモ（オプション）
 *
 * 【動作フロー】
 * 1. ユーザーが給油量・金額を入力
 * 2. 「保存」ボタンクリック
 * 3. バリデーション実行
 * 4. operationStore.operationIdから運行ID取得
 * 5. apiService.recordFuel() API呼び出し
 * 6. 成功時: トースト表示 → 運行記録画面へ戻る
 * 7. 失敗時: エラートースト表示
 */