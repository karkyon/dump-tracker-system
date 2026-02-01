// frontend/mobile/src/stores/operationStore.ts
// 運行状態管理Store - フェーズ管理機能追加版
// 🔧 修正: phase, loadingLocation, unloadingLocation フィールドとアクション追加 (2025-12-12)
// 🔧 修正: previousPhase フィールドとアクション追加 (2025-12-28) - 休憩終了時のフェーズ復元対応

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 🆕 運行フェーズ型定義
 */
export type OperationPhase = 
  | 'TO_LOADING' 
  | 'AT_LOADING' 
  | 'TO_UNLOADING' 
  | 'AT_UNLOADING' 
  | 'UNLOADING_IN_PROGRESS'  // 🆕 追加: 積降作業中
  | 'BREAK' 
  | 'REFUEL';

/**
 * 運行状態インターフェース
 * 🔧 修正: phase, loadingLocation, unloadingLocation フィールド追加
 * 🔧 修正: previousPhase フィールド追加 (2025-12-28)
 */
export interface OperationState {
  // 運行情報
  operationId: string | null;
  vehicleId: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  driverId: string | null;
  driverName: string | null;
  startMileage: number | null;
  
  // 🆕 運行フェーズ管理
  phase: OperationPhase;
  previousPhase: OperationPhase | null; // 🆕 休憩前のフェーズを記憶 (2025-12-28)
  loadingLocation: string | null;
  unloadingLocation: string | null;
  
  // 運行ステータス
  status: 'IDLE' | 'INSPECTING' | 'IN_PROGRESS' | 'COMPLETED';
  
  // 点検完了フラグ
  inspectionCompleted: boolean;
  inspectionRecordId: string | null;
  
  // Actions
  setVehicleInfo: (info: {
    vehicleId: string;
    vehicleNumber: string;
    vehicleType: string;
    startMileage: number;
  }) => void;
  
  setDriverInfo: (info: {
    driverId: string;
    driverName: string;
  }) => void;
  
  setInspectionCompleted: (recordId: string) => void;
  
  startOperation: (operationId: string) => void;
  
  // 🆕 フェーズ管理アクション
  setPhase: (phase: OperationPhase) => void;
  savePreviousPhase: (phase: OperationPhase) => void; // 🆕 休憩前フェーズ保存 (2025-12-28)
  incrementBreakCount: () => void;              // 🔧 休憩回数インクリメント (2026-02-01)
  setLoadingLocation: (location: string) => void;
  setUnloadingLocation: (location: string) => void;
  
  completeOperation: () => void;
  
  resetOperation: () => void;
}

/**
 * 運行状態管理Store
 */
export const useOperationStore = create<OperationState>()(
  persist(
    (set, get) => ({
      // 初期状態
      operationId: null,
      vehicleId: null,
      vehicleNumber: null,
      vehicleType: null,
      driverId: null,
      driverName: null,
      startMileage: null,
      status: 'IDLE',
      inspectionCompleted: false,
      inspectionRecordId: null,
      
      // 🆕 フェーズ管理初期値
      phase: 'TO_LOADING',
      breakCount: 0,                           // 🔧 休憩回数（永続化対象）(2026-02-01)
      previousPhase: null, // 🆕 初期状態ではnull (2025-12-28)
      loadingLocation: null,
      unloadingLocation: null,

      // Actions
      setVehicleInfo: (info) => {
        console.log('[Operation Store] ✅ Set vehicle info:', info);
        set({
          vehicleId: info.vehicleId,
          vehicleNumber: info.vehicleNumber,
          vehicleType: info.vehicleType,
          startMileage: info.startMileage,
          status: 'IDLE'
        });
        
        // デバッグ: 設定後の状態確認
        const currentState = get();
        console.log('[Operation Store] 📊 Current state after setVehicleInfo:', {
          vehicleId: currentState.vehicleId,
          vehicleNumber: currentState.vehicleNumber,
          status: currentState.status
        });
      },

      setDriverInfo: (info) => {
        console.log('[Operation Store] ✅ Set driver info:', info);
        set({
          driverId: info.driverId,
          driverName: info.driverName
        });
        
        const currentState = get();
        console.log('[Operation Store] 📊 Current state after setDriverInfo:', {
          driverId: currentState.driverId,
          driverName: currentState.driverName
        });
      },

      setInspectionCompleted: (recordId) => {
        console.log('[Operation Store] ✅ Inspection completed:', recordId);
        set({
          inspectionCompleted: true,
          inspectionRecordId: recordId,
          status: 'INSPECTING'
        });
        
        const currentState = get();
        console.log('[Operation Store] 📊 Current state after setInspectionCompleted:', {
          inspectionCompleted: currentState.inspectionCompleted,
          inspectionRecordId: currentState.inspectionRecordId,
          status: currentState.status
        });
      },

      startOperation: (operationId) => {
        console.log('[Operation Store] 🚀 START OPERATION CALLED:', operationId);
        console.log('[Operation Store] 📋 Before update - current state:', get());
        
        set({
          operationId,
          status: 'IN_PROGRESS',
          phase: 'TO_LOADING' // 🔧 運行開始時は積込場所へ移動中から始まる
        });
        
        // デバッグ: 設定後の状態確認
        const currentState = get();
        console.log('[Operation Store] ✅ After update - operationId set to:', currentState.operationId);
        console.log('[Operation Store] ✅ After update - phase set to:', currentState.phase);
        console.log('[Operation Store] 📊 Full state after startOperation:', currentState);
        
        // localStorage確認
        setTimeout(() => {
          const stored = localStorage.getItem('operation-storage');
          console.log('[Operation Store] 💾 localStorage after startOperation:', stored);
        }, 100);
      },

      // フェーズ設定
      setPhase: (phase) => {
        console.log('[Operation Store] 🔄 SET PHASE CALLED:', phase);
        console.log('[Operation Store] 📋 Before update - current phase:', get().phase);
        
        set({ phase });
        
        const currentState = get();
        console.log('[Operation Store] ✅ After update - phase set to:', currentState.phase);
        console.log('[Operation Store] 📊 Full state after setPhase:', currentState);
        
        // localStorage確認
        setTimeout(() => {
          const stored = localStorage.getItem('operation-storage');
          console.log('[Operation Store] 💾 localStorage after setPhase:', stored);
        }, 100);
      },

      // 休憩前フェーズ保存 (2025-12-28)
      savePreviousPhase: (phase) => {
        console.log('[Operation Store] 💾 SAVE PREVIOUS PHASE CALLED:', phase);
        console.log('[Operation Store] 📋 Before save - current previousPhase:', get().previousPhase);
        
        set({ previousPhase: phase });
        
        const currentState = get();
        console.log('[Operation Store] ✅ After save - previousPhase set to:', currentState.previousPhase);
        console.log('[Operation Store] 📊 Full state after savePreviousPhase:', currentState);
        
        // localStorage確認
        setTimeout(() => {
          const stored = localStorage.getItem('operation-storage');
          console.log('[Operation Store] 💾 localStorage after savePreviousPhase:', stored);
        }, 100);
      },

      // 休憩回数インクリメント (2026-02-01)
      incrementBreakCount: () => {
        const newCount = get().breakCount + 1;
        console.log('[Operation Store] ☕ INCREMENT BREAK COUNT:', newCount);
        set({ breakCount: newCount });
      },

      // 積込場所設定
      setLoadingLocation: (location) => {
        console.log('[Operation Store] 📍 SET LOADING LOCATION:', location);
        set({ loadingLocation: location });
        
        const currentState = get();
        console.log('[Operation Store] 📊 Full state after setLoadingLocation:', currentState);
      },

      // 🆕 積降場所設定
      setUnloadingLocation: (location) => {
        console.log('[Operation Store] 📍 SET UNLOADING LOCATION:', location);
        set({ unloadingLocation: location });
        
        const currentState = get();
        console.log('[Operation Store] 📊 Full state after setUnloadingLocation:', currentState);
      },

      completeOperation: () => {
        console.log('[Operation Store] ✅ Complete operation');
        set({
          status: 'COMPLETED'
        });
      },

      resetOperation: () => {
        console.log('[Operation Store] 🔄 Reset operation');
        set({
          operationId: null,
          vehicleId: null,
          vehicleNumber: null,
          vehicleType: null,
          driverId: null,
          driverName: null,
          startMileage: null,
          status: 'IDLE',
          inspectionCompleted: false,
          inspectionRecordId: null,
          phase: 'TO_LOADING', // 🔧 リセット時も初期フェーズに戻す
          breakCount: 0,       // 🔧 休憩回数もリセット (2026-02-01)
          previousPhase: null, // 🆕 リセット時にクリア (2025-12-28)
          loadingLocation: null,
          unloadingLocation: null
        });
      }
    }),
    {
      name: 'operation-storage',
      partialize: (state) => {
        console.log('[Operation Store] 💾 Partialize called - saving state:', {
          operationId: state.operationId,
          vehicleId: state.vehicleId,
          status: state.status,
          phase: state.phase, // 🔧 フェーズも保存
          breakCount: state.breakCount,       // 🔧 休憩回数も永続化 (2026-02-01)
          previousPhase: state.previousPhase // 🆕 休憩前フェーズも保存 (2025-12-28)
        });
        
        return {
          operationId: state.operationId,
          vehicleId: state.vehicleId,
          vehicleNumber: state.vehicleNumber,
          vehicleType: state.vehicleType,
          driverId: state.driverId,
          driverName: state.driverName,
          startMileage: state.startMileage,
          status: state.status,
          inspectionCompleted: state.inspectionCompleted,
          inspectionRecordId: state.inspectionRecordId,
          // 🆕 フェーズ管理フィールドも永続化
          phase: state.phase,
          previousPhase: state.previousPhase, // 🆕 休憩前フェーズも永続化 (2025-12-28)
          loadingLocation: state.loadingLocation,
          unloadingLocation: state.unloadingLocation
        };
      },
      // デバッグ: 復元時のログ
      onRehydrateStorage: () => {
        console.log('[Operation Store] 🔄 Rehydration started');
        return (state, error) => {
          if (error) {
            console.error('[Operation Store] ❌ Rehydration error:', error);
          } else {
            console.log('[Operation Store] ✅ Rehydration complete:', state);
          }
        };
      }
    }
  )
);

// デバッグ用: グローバルアクセス
if (typeof window !== 'undefined') {
  (window as any).operationStore = useOperationStore;
  console.log('[Operation Store] 🔍 Debug: window.operationStore available');
  console.log('[Operation Store] 🔍 Usage: window.operationStore.getState()');
}

/**
 * 🔧 修正内容 (2025-12-12)
 * 
 * 1. OperationPhase 型定義を追加:
 *    - 'TO_LOADING' | 'AT_LOADING' | 'TO_UNLOADING' | 'AT_UNLOADING' | 'BREAK' | 'REFUEL'
 * 
 * 2. OperationState インターフェースに追加:
 *    - phase: OperationPhase - 現在の運行フェーズ
 *    - loadingLocation: string | null - 積込場所名
 *    - unloadingLocation: string | null - 積降場所名
 * 
 * 3. アクション追加:
 *    - setPhase(phase: OperationPhase) - フェーズを更新
 *    - setLoadingLocation(location: string) - 積込場所名を設定
 *    - setUnloadingLocation(location: string) - 積降場所名を設定
 * 
 * 4. startOperation アクションを修正:
 *    - phase: 'TO_LOADING' を初期値として設定
 * 
 * 5. resetOperation アクションを修正:
 *    - phase, loadingLocation, unloadingLocation もリセット
 * 
 * 6. partialize 設定を修正:
 *    - phase, loadingLocation, unloadingLocation も永続化対象に追加
 * 
 * これにより、フェーズ状態がブラウザ再読み込み後も保持されます。
 * 
 * 🔧 修正内容 (2025-12-28) - 休憩終了時のフェーズ復元対応
 * 
 * 1. OperationState インターフェースに追加:
 *    - previousPhase: OperationPhase | null - 休憩前のフェーズを記憶
 * 
 * 2. アクション追加:
 *    - savePreviousPhase(phase: OperationPhase) - 休憩前のフェーズを保存
 * 
 * 3. 初期状態に追加:
 *    - previousPhase: null
 * 
 * 4. resetOperation アクションを修正:
 *    - previousPhase もリセット
 * 
 * 5. partialize 設定を修正:
 *    - previousPhase も永続化対象に追加
 * 
 * これにより、休憩開始時に現在のフェーズを保存し、休憩終了時に元のフェーズに戻せるようになります。
 * 例: TO_LOADING → 休憩開始(previousPhase=TO_LOADING保存) → BREAK → 休憩終了 → TO_LOADING復元
 */