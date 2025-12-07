// frontend/mobile/src/pages/RefuelRecord.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

const RefuelRecord: React.FC = () => {
  const navigate = useNavigate();
  const [fuelAmount, setFuelAmount] = useState<number>(0);
  const [fuelCost, setFuelCost] = useState<number>(0);
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success('給油記録を保存しました');
      navigate('/operation-record'); // 運行記録画面に戻る
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('給油記録保存エラー:', error);
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
              給油量 (L)
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
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              金額 (円)
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
              placeholder="給油場所を入力"
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