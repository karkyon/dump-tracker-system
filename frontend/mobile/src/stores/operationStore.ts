// frontend/mobile/src/stores/operationStore.ts
// 運行状態管理Store - デバッグログ強化版

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 運行状態インターフェース
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
          status: 'IN_PROGRESS'
        });
        
        // デバッグ: 設定後の状態確認
        const currentState = get();
        console.log('[Operation Store] ✅ After update - operationId set to:', currentState.operationId);
        console.log('[Operation Store] 📊 Full state after startOperation:', currentState);
        
        // localStorage確認
        setTimeout(() => {
          const stored = localStorage.getItem('operation-storage');
          console.log('[Operation Store] 💾 localStorage after startOperation:', stored);
        }, 100);
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
          inspectionRecordId: null
        });
      }
    }),
    {
      name: 'operation-storage',
      partialize: (state) => {
        console.log('[Operation Store] 💾 Partialize called - saving state:', {
          operationId: state.operationId,
          vehicleId: state.vehicleId,
          status: state.status
        });
        
        return {
          operationId: state.operationId,  // 🔧 重要: operationIdを必ず含める
          vehicleId: state.vehicleId,
          vehicleNumber: state.vehicleNumber,
          vehicleType: state.vehicleType,
          driverId: state.driverId,
          driverName: state.driverName,
          startMileage: state.startMileage,
          status: state.status,
          inspectionCompleted: state.inspectionCompleted,
          inspectionRecordId: state.inspectionRecordId
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