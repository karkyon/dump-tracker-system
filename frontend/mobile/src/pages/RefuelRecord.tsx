// frontend/mobile/src/pages/RefuelRecord.tsx
// D7: 給油記録画面 - 完全修正版
// 🔧 修正: 給油量・金額の0固定問題解決
// 🔧 修正: カンマ区切り表示追加
// 🔧 修正: 金額を任意項目に変更
// ✅ 既存機能100%保持

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import apiService from '../services/api';
import { useOperationStore } from '../stores/operationStore';

const RefuelRecord: React.FC = () => {
  const navigate = useNavigate();
  const operationStore = useOperationStore();

  // 🔧 修正: 文字列型に変更（0固定問題解決）
  const [fuelAmount, setFuelAmount] = useState<string>('');      // 給油量（文字列）
  const [fuelCost, setFuelCost] = useState<string>('');          // 金額（文字列）
  const [fuelStation, setFuelStation] = useState<string>('');    // 給油所名
  const [notes, setNotes] = useState<string>('');                // メモ
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 🆕 数値をカンマ区切りに変換
   */
  const formatNumberWithComma = (value: string): string => {
    const numStr = value.replace(/[^\d]/g, '');
    if (!numStr) return '';
    const num = parseInt(numStr, 10);
    return num.toLocaleString('ja-JP');
  };

  /**
   * 🆕 カンマ区切り文字列を数値に変換
   */
  const parseNumberFromComma = (value: string): number => {
    const numStr = value.replace(/[^\d]/g, '');
    return numStr ? parseInt(numStr, 10) : 0;
  };

  /**
   * 🔧 修正: 給油量入力ハンドラー（小数点対応）
   */
  const handleFuelAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 空文字、数値、小数点のみ許可
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFuelAmount(value);
    }
  };

  /**
   * 🔧 修正: 金額入力ハンドラー（カンマ対応）
   */
  const handleFuelCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // カンマと数値を除去して純粋な数値のみ抽出
    const numStr = value.replace(/[^\d]/g, '');
    setFuelCost(numStr);
  };

  /**
   * 保存ハンドラー
   * 🔧 修正: 金額を任意項目に変更
   */
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // バリデーション（給油量のみ必須）
      const fuelAmountNum = parseFloat(fuelAmount);
      if (!fuelAmount || isNaN(fuelAmountNum) || fuelAmountNum <= 0) {
        toast.error('給油量を正しく入力してください');
        setIsSubmitting(false);
        return;
      }

      // 運行ID取得
      const currentOperationId = operationStore.operationId;
      if (!currentOperationId) {
        toast.error('運行が開始されていません');
        setIsSubmitting(false);
        return;
      }

      // 金額の数値変換（任意）
      const fuelCostNum = fuelCost ? parseNumberFromComma(fuelCost) : undefined;

      // 🆕 GPS座標取得
      let gpsCoords: { latitude?: number; longitude?: number; accuracy?: number } = {};
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
          });
        });
        gpsCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        console.log('📍 GPS座標取得成功:', gpsCoords);
      } catch (gpsError) {
        console.warn('⚠️ GPS座標取得失敗（記録は続行）:', gpsError);
      }

      console.log('⛽ 給油記録保存開始:', {
        tripId: currentOperationId,
        fuelAmount: fuelAmountNum,
        fuelCost: fuelCostNum,
        fuelStation: fuelStation || undefined,
        notes: notes || undefined
      });

      // API呼び出し
      await apiService.recordFuel(currentOperationId, {
        fuelAmount: fuelAmountNum,
        fuelCost: fuelCostNum,
        fuelStation: fuelStation || undefined,
        ...gpsCoords,          // 🆕 GPS座標追加
        notes: notes || undefined
      });

      console.log('✅ 給油記録保存完了');
      toast.success('給油記録を保存しました');
      navigate('/operation-record');
      
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
          
          {/* 給油量 (L) - 必須 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              給油量 (L) <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={fuelAmount}
              onChange={handleFuelAmountChange}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="例: 50.5"
            />
          </div>

          {/* 金額 (円) - 任意 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              金額 (円)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={fuelCost ? formatNumberWithComma(fuelCost) : ''}
              onChange={handleFuelCostChange}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="例: 8,000"
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              ※ 任意項目です
            </div>
          </div>

          {/* 給油所名 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              給油所名
            </label>
            <input
              type="text"
              value={fuelStation}
              onChange={(e) => setFuelStation(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="例: ENEOS ○○店"
            />
          </div>

          {/* メモ */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              メモ
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder="メモを入力"
            />
          </div>
        </div>
      </div>

      {/* ボタンエリア */}
      <div style={{ padding: '16px', background: 'white', borderTop: '1px solid #ddd' }}>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !fuelAmount}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            background: isSubmitting || !fuelAmount 
              ? '#ccc' 
              : 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: isSubmitting || !fuelAmount ? 'not-allowed' : 'pointer'
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
// 🔧🔧🔧 給油記録画面修正内容（2026年1月31日）
// =============================================================================

/**
 * 【2026年1月31日修正内容】
 *
 * ✅ 問題1: 給油量・金額が0固定される問題を解決
 * 【原因】
 * - stateがnumber型で初期値0
 * - onChange時にNumber(e.target.value)で変換
 * - 空文字が0に変換される
 * - 入力フィールドのvalueが常に"0"を表示
 *
 * 【解決策】
 * - stateを文字列型に変更
 * - 入力時は文字列のまま保存
 * - 保存時のみ数値に変換
 *
 * ✅ 修正1: State型変更
 * ```typescript
 * // ❌ 修正前
 * const [fuelAmount, setFuelAmount] = useState<number>(0);
 * const [fuelCost, setFuelCost] = useState<number>(0);
 *
 * // ✅ 修正後
 * const [fuelAmount, setFuelAmount] = useState<string>('');
 * const [fuelCost, setFuelCost] = useState<string>('');
 * ```
 *
 * ✅ 修正2: 入力ハンドラー改善
 * - handleFuelAmountChange: 小数点対応
 * - handleFuelCostChange: カンマ除去処理
 *
 * ✅ 修正3: カンマ区切り表示
 * - formatNumberWithComma(): 数値をカンマ区切りに変換
 * - parseNumberFromComma(): カンマ区切りを数値に変換
 * - 金額入力フィールドで自動的にカンマ表示
 *
 * ✅ 修正4: 金額を任意項目に変更
 * - 必須マーク（*）削除
 * - バリデーションから金額チェック削除
 * - API送信時にundefinedで送信可能
 * - ヘルプテキスト追加: "※ 任意項目です"
 *
 * ✅ 修正5: プレースホルダー改善
 * - 具体的な入力例を表示
 * - "例: 50.5"（給油量）
 * - "例: 8,000"（金額）
 *
 * ✅ 修正6: バリデーション強化
 * - 給油量: 空文字 or NaN or <=0 をチェック
 * - 金額: 任意のため未入力OK
 *
 * 【動作フロー】
 * 1. 給油量入力: "50.5" → 文字列として保存 → valueに"50.5"表示
 * 2. 金額入力: "8000" → "8,000"をvalueに表示 → 内部は"8000"
 * 3. 保存ボタンクリック → 文字列を数値に変換 → API送信
 * 4. 成功 → toast表示 → 運行記録画面へ戻る
 *
 * 【既存機能100%保持】
 * - すべての既存UI・スタイルを保持
 * - キャンセルボタンの動作を保持
 * - isSubmittingによるボタン制御を保持
 * - 給油所名・メモ入力機能を保持
 * - apiService.recordFuel() API呼び出しを保持
 */