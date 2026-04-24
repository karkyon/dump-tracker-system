// frontend/mobile/src/components/ActivityEditSheet.tsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import apiService from '../services/api';
import { useOperationStore } from '../stores/operationStore';

export interface ActivityRecord {
  id: string;
  activityType: string;
  locationName: string;
  locationId?: string;
  locationLat?: number;
  locationLng?: number;
  itemName?: string;
  itemId?: string;
  quantity?: number;
  startTime: string | null;
  endTime: string | null;
  notes?: string;
  sequenceNumber: number;
  customerName?: string;
}

interface ActivityEditSheetProps {
  activity: ActivityRecord | null;
  operationId: string;
  onClose: () => void;
  onSaved: (updatedActivity: ActivityRecord) => void;
  customers: { id: string; name: string }[];
  items: { id: string; name: string }[];
}

// ── 時分ダイヤル ──
const TimeDial: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  accentColor: string;
}> = ({ label, value, onChange, accentColor }) => {
  const [open, setOpen] = useState(false);
  const [tempH, setTempH] = useState(0);
  const [tempM, setTempM] = useState(0);

  const parts = (value || '').split(':');
  const displayH = parts[0] || '--';
  const displayM = parts[1] || '--';

  const openDial = () => {
    const raw = (value || '00:00').split(':');
    const h = parseInt(raw[0] ?? '0', 10);
    const m = parseInt(raw[1] ?? '0', 10);
    setTempH(isNaN(h) ? 0 : h);
    setTempM(isNaN(m) ? 0 : m);
    setOpen(true);
  };

  const confirm = () => {
    onChange(`${String(tempH).padStart(2, '0')}:${String(tempM).padStart(2, '0')}`);
    setOpen(false);
  };

  const adjH = (d: number) => setTempH(h => (h + d + 24) % 24);
  const adjM = (d: number) => setTempM(m => (m + d + 60) % 60);

  return (
    <div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>{label}</div>
      <div onClick={openDial} style={{ background: '#f3f4f6', border: '0.5px solid #d1d5db', borderRadius: 7, padding: '7px 10px', fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span>{displayH}:{displayM}</span>
        <span style={{ fontSize: 14, color: '#9ca3af' }}>🕐</span>
      </div>
      {open && (
        <div style={{ marginTop: 4, border: '0.5px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <div style={{ background: `linear-gradient(135deg, ${accentColor}dd 0%, ${accentColor} 100%)`, color: '#fff', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500 }}>{label}を設定</span>
            <span style={{ fontSize: 9, opacity: .8 }}>↑↓ タップで±1</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, padding: '6px 8px 4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 58 }}>
              <div onClick={() => adjH(1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempH + 1) % 24).padStart(2, '0')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#111827', background: '#f3f4f6', borderRadius: 5, padding: '4px 0', width: '100%', textAlign: 'center', border: `1.5px solid ${accentColor}` }}>{String(tempH).padStart(2, '0')}</div>
              <div onClick={() => adjH(-1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempH - 1 + 24) % 24).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: '#6b7280', marginTop: 3 }}>時</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#6b7280', paddingBottom: 24 }}>:</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 58 }}>
              <div onClick={() => adjM(1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempM + 1) % 60).padStart(2, '0')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#111827', background: '#f3f4f6', borderRadius: 5, padding: '4px 0', width: '100%', textAlign: 'center', border: `1.5px solid ${accentColor}` }}>{String(tempM).padStart(2, '0')}</div>
              <div onClick={() => adjM(-1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempM - 1 + 60) % 60).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: '#6b7280', marginTop: 3 }}>分</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', padding: '2px 0 4px' }}>上下の数字をタップで変更</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, padding: '5px 8px 6px', borderTop: '0.5px solid #e5e7eb' }}>
            <div onClick={() => setOpen(false)} style={{ padding: 6, textAlign: 'center', background: '#f3f4f6', borderRadius: 6, fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>取消</div>
            <div onClick={confirm} style={{ padding: 6, textAlign: 'center', background: accentColor, borderRadius: 6, fontSize: 10, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
              OK — {String(tempH).padStart(2, '0')}:{String(tempM).padStart(2, '0')} に設定
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ミニMAP ──
const MiniMap: React.FC<{ accentColor: string }> = ({ accentColor }) => (
  <div>
    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
      場所ピン調整<span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>— ドラッグで微調整</span>
    </div>
    <div style={{ borderRadius: 7, overflow: 'hidden', position: 'relative', height: 90, border: '0.5px solid #d1d5db', background: 'repeating-linear-gradient(0deg,#c8d8c4 0,#c8d8c4 1px,#dce8d8 1px,#dce8d8 28px),repeating-linear-gradient(90deg,#c8d8c4 0,#c8d8c4 1px,#dce8d8 1px,#dce8d8 28px)' }}>
      <div style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%, -100%)' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: accentColor, position: 'relative' }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', position: 'absolute', top: 5, left: 5 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.52)', color: '#fff', fontSize: 9, padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>ドラッグでピン移動</div>
      <div style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(255,255,255,0.88)', borderRadius: 5, padding: '2px 6px', fontSize: 9, color: '#333', border: '0.5px solid rgba(0,0,0,0.15)', cursor: 'pointer' }}>拡大 ⛶</div>
    </div>
  </div>
);

// 種別ごとのカラー定義（OperationRecord のトレードカラーに統一）
// 積込: 青  #2196F3 / 積降: 緑  #4CAF50 / 給油: オレンジ #FF9800 / 休憩: 紫  #9C27B0
const ACTIVITY_CONFIG: Record<string, {
  label: string; color: string; colorLight: string; badge: string;
  bannerBg: string; bannerText: string; bannerBorder: string;
}> = {
  // 積込: 青系 #2196F3
  LOADING:            { label: '積込 編集', color: '#1565C0', colorLight: '#2196F3', badge: '積込到着',  bannerBg: '#E3F2FD', bannerText: '#1565C0', bannerBorder: '#2196F3' },
  LOADING_START:      { label: '積込 編集', color: '#1565C0', colorLight: '#2196F3', badge: '積込到着',  bannerBg: '#E3F2FD', bannerText: '#1565C0', bannerBorder: '#2196F3' },
  LOADING_COMPLETE:   { label: '積込 編集', color: '#1565C0', colorLight: '#2196F3', badge: '積込完了',  bannerBg: '#E3F2FD', bannerText: '#1565C0', bannerBorder: '#2196F3' },
  // 積降: 緑系 #4CAF50
  UNLOADING:          { label: '積降 編集', color: '#2E7D32', colorLight: '#4CAF50', badge: '積降完了',  bannerBg: '#E8F5E9', bannerText: '#2E7D32', bannerBorder: '#4CAF50' },
  UNLOADING_START:    { label: '積降 編集', color: '#2E7D32', colorLight: '#4CAF50', badge: '積降到着',  bannerBg: '#E8F5E9', bannerText: '#2E7D32', bannerBorder: '#4CAF50' },
  UNLOADING_COMPLETE: { label: '積降 編集', color: '#2E7D32', colorLight: '#4CAF50', badge: '積降完了',  bannerBg: '#E8F5E9', bannerText: '#2E7D32', bannerBorder: '#4CAF50' },
  // 給油: オレンジ系 #FF9800
  FUELING:            { label: '給油 編集', color: '#E65100', colorLight: '#FF9800', badge: '給油',      bannerBg: '#FFF3E0', bannerText: '#E65100', bannerBorder: '#FF9800' },
  FUEL:               { label: '給油 編集', color: '#E65100', colorLight: '#FF9800', badge: '給油',      bannerBg: '#FFF3E0', bannerText: '#E65100', bannerBorder: '#FF9800' },
  // 休憩: 紫系 #9C27B0
  BREAK:              { label: '休憩 編集', color: '#6A1B9A', colorLight: '#9C27B0', badge: '休憩',      bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' },
  BREAK_START:        { label: '休憩 編集', color: '#6A1B9A', colorLight: '#9C27B0', badge: '休憩開始',  bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' },
  BREAK_END:          { label: '休憩 編集', color: '#6A1B9A', colorLight: '#9C27B0', badge: '休憩終了',  bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' },
};

const getCfg = (t: string) => ACTIVITY_CONFIG[t] || { label: '編集', color: '#5048b8', colorLight: '#7c6de0', badge: t, bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' };
const isLoad  = (t: string) => ['LOADING','LOADING_START','LOADING_COMPLETE'].includes(t);
const isUnl   = (t: string) => ['UNLOADING','UNLOADING_START','UNLOADING_COMPLETE'].includes(t);
const isFuel  = (t: string) => ['FUELING','FUEL'].includes(t);
const isBreak = (t: string) => ['BREAK','BREAK_START','BREAK_END'].includes(t);

const toHHMM = (iso: string | null): string => {
  if (!iso) return '';
  try { return new Date(iso).toTimeString().slice(0, 5); } catch { return ''; }
};

const toISO = (base: string | null, hhmm: string): string => {
  if (!hhmm) return base ?? new Date().toISOString();
  const parts = hhmm.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const d = base ? new Date(base) : new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const ActivityEditSheet: React.FC<ActivityEditSheetProps> = ({
  activity, onClose, onSaved, items
}) => {
  const operationStore = useOperationStore();
  const [startHHMM, setStartHHMM] = useState('');
  const [endHHMM,   setEndHHMM]   = useState('');
  const [locationName, setLocationName] = useState('');
  const [customerDisplayName, setCustomerDisplayName] = useState('');
  const [itemId,    setItemId]    = useState('');
  const [quantity,  setQuantity]  = useState('');
  const [fuelAmount,setFuelAmount]= useState('');
  const [fuelCost,  setFuelCost]  = useState('');
  const [notes,     setNotes]     = useState('');
  const [isSaving,  setIsSaving]  = useState(false);

  useEffect(() => {
    if (!activity) return;
    setStartHHMM(toHHMM(activity.startTime));
    setEndHHMM(toHHMM(activity.endTime));
    setLocationName(activity.locationName || '');
    setCustomerDisplayName(activity.customerName || (operationStore.customerName ?? ''));
    setItemId(activity.itemId || '');
    setQuantity(activity.quantity != null && activity.quantity > 0 ? String(activity.quantity) : '');
    setFuelAmount(''); setFuelCost('');
    setNotes(activity.notes || '');
  }, [activity]);

  if (!activity) return null;

  const cfg = getCfg(activity.activityType);

  const handleSave = async () => {
    if (!startHHMM) { toast.error('開始時刻を入力してください'); return; }
    setIsSaving(true);
    try {
      const body: Record<string, any> = {
        actualStartTime: toISO(activity.startTime, startHHMM),
        actualEndTime:   endHHMM ? toISO(activity.endTime, endHHMM) : undefined,
        notes,
      };
      // locationName は全種別で送信（空の場合も送信して既存値を上書き可能に）
      body.locationName = locationName;
      if (isLoad(activity.activityType)) {
        if (itemId)   body.itemId       = itemId;
        if (quantity) body.quantityTons = parseFloat(quantity);
      }
      if (isFuel(activity.activityType)) {
        if (fuelAmount) body.quantityTons = parseFloat(fuelAmount);
        if (fuelCost)   body.notes = `給油 ${fuelAmount}L ¥${fuelCost} ${notes}`.trim();
      }
      const res = await (apiService as any).updateActivityRecord(activity.id, body);
      if (res?.success) {
        toast.success('保存しました');
        onSaved({ ...activity, startTime: body.actualStartTime, endTime: body.actualEndTime ?? activity.endTime });
      } else {
        toast.error(res?.message || '保存に失敗しました');
      }
    } catch {
      toast.error('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#f3f4f6', border: '0.5px solid #d1d5db',
    borderRadius: 7, padding: '7px 8px', fontSize: 13, color: '#111827',
    boxSizing: 'border-box'
  };

  return (
    <>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 3000, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease-out' }}>
        {/* ヘッダー */}
        <div style={{ background: `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.colorLight} 100%)`, color: '#fff', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, opacity: .85, cursor: 'pointer', whiteSpace: 'nowrap', color: '#fff' }} onClick={onClose}>← 詳細へ戻る</span>
          <span style={{ fontSize: 14, fontWeight: 500, flex: 1, textAlign: 'center', color: '#fff' }}>{cfg.label}</span>
          <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'rgba(255,255,255,0.22)', color: '#fff' }}>{cfg.badge}</span>
        </div>
        {/* バナー */}
        <div style={{ margin: '10px 12px 0', borderRadius: 7, padding: '6px 10px', fontSize: 10, lineHeight: 1.6, borderLeft: `3px solid ${cfg.bannerBorder}`, background: cfg.bannerBg, color: cfg.bannerText }}>
          {isLoad(activity.activityType)  && '積込の到着・完了時刻、品目・重量を修正できます。'}
          {isUnl(activity.activityType)   && '積降の到着・完了時刻と場所を修正できます。'}
          {isFuel(activity.activityType)  && '給油の時刻・量・金額・場所を修正できます。'}
          {isBreak(activity.activityType) && '休憩の開始・終了時刻と場所を修正できます。'}
        </div>
        {/* フォーム */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', flex: 1 }}>
          {/* 時刻 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <TimeDial label={isBreak(activity.activityType) ? '開始時刻' : '到着時刻'} value={startHHMM} onChange={setStartHHMM} accentColor={cfg.color} />
            <TimeDial label={isBreak(activity.activityType) ? '終了時刻' : '完了時刻'} value={endHHMM}   onChange={setEndHHMM}   accentColor={cfg.color} />
          </div>
          {/* 積込専用 */}
          {isLoad(activity.activityType) && (<>
            {/* 積込場所名 */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>積込場所名</div>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder="例: 翠香園町ダート"
                style={{ ...inputStyle, fontSize: 15, height: 44 }}
              />
            </div>
            {/* 客先（表示のみ） */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>客先</div>
              <div style={{
                ...inputStyle,
                height: 44,
                background: '#f9fafb',
                color: customerDisplayName ? '#374151' : '#9ca3af',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'default', pointerEvents: 'none'
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>
                  🏢 {customerDisplayName || '（客先積載物入力画面で変更）'}
                </span>
                <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 6 }}>変更不可</span>
              </div>
            </div>
            {/* 品目 */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>品目</div>
              <select
                value={itemId}
                onChange={e => setItemId(e.target.value)}
                style={{ ...inputStyle, fontSize: 15, height: 44 }}
              >
                <option value="">-- 品目を選択 --</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              {items.length === 0 && (
                <div style={{ fontSize: 10, color: '#ef4444', marginTop: 3 }}>※ 品目が読み込まれていません</div>
              )}
            </div>
            {/* 重量 */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>
                重量（トン）<span style={{ fontSize: 9, color: '#ef4444', marginLeft: 4 }}>必須</span>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="例: 12.5"
                step="0.1"
                min="0"
                style={{ ...inputStyle, fontSize: 16, height: 44 }}
              />
            </div>
          </>)}
          {/* 給油専用 */}
          {isFuel(activity.activityType) && (<>
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>スタンド名</div>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="例: ENEOS セルフ" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>給油量（L）</div>
                <input type="number" value={fuelAmount} onChange={e => setFuelAmount(e.target.value)} placeholder="例: 35" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>金額（円）</div>
                <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="例: 6300" style={inputStyle} />
              </div>
            </div>
          </>)}
          {/* 積降・休憩共通: 場所名 */}
          {(isUnl(activity.activityType) || isBreak(activity.activityType)) && (
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>場所名</div>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="例: ABC建材センター" style={inputStyle} />
            </div>
          )}
          {/* ミニMAP */}
          <MiniMap accentColor={cfg.color} />
          {/* 休憩のみ: 備考 */}
          {isBreak(activity.activityType) && (
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>備考 <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>任意</span></div>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="例: 疲労休憩" style={inputStyle} />
            </div>
          )}
        </div>
        {/* フッター */}
        <div style={{ padding: '8px 12px 12px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 7, borderTop: '0.5px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          <div style={{ padding: 9, textAlign: 'center', background: '#f3f4f6', borderRadius: 7, fontSize: 12, color: '#6b7280', border: '0.5px solid #d1d5db', cursor: 'pointer' }} onClick={onClose}>取消</div>
          <div style={{ padding: 9, textAlign: 'center', background: isSaving ? '#9ca3af' : `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.colorLight} 100%)`, borderRadius: 7, fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer' }} onClick={isSaving ? undefined : handleSave}>
            {isSaving ? '保存中...' : '保存する'}
          </div>
        </div>
      </div>
    </>
  );
};

export default ActivityEditSheet;
