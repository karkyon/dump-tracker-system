// frontend/mobile/src/stores/operationStore.ts
// 運行状態管理Store

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
    (set) => ({
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
        console.log('[Operation Store] Set vehicle info:', info);
        set({
          vehicleId: info.vehicleId,
          vehicleNumber: info.vehicleNumber,
          vehicleType: info.vehicleType,
          startMileage: info.startMileage,
          status: 'IDLE'
        });
      },

      setDriverInfo: (info) => {
        console.log('[Operation Store] Set driver info:', info);
        set({
          driverId: info.driverId,
          driverName: info.driverName
        });
      },

      setInspectionCompleted: (recordId) => {
        console.log('[Operation Store] Inspection completed:', recordId);
        set({
          inspectionCompleted: true,
          inspectionRecordId: recordId,
          status: 'INSPECTING'
        });
      },

      startOperation: (operationId) => {
        console.log('[Operation Store] Start operation:', operationId);
        set({
          operationId,
          status: 'IN_PROGRESS'
        });
      },

      completeOperation: () => {
        console.log('[Operation Store] Complete operation');
        set({
          status: 'COMPLETED'
        });
      },

      resetOperation: () => {
        console.log('[Operation Store] Reset operation');
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
      partialize: (state) => ({
        operationId: state.operationId,
        vehicleId: state.vehicleId,
        vehicleNumber: state.vehicleNumber,
        vehicleType: state.vehicleType,
        driverId: state.driverId,
        driverName: state.driverName,
        startMileage: state.startMileage,
        status: state.status,
        inspectionCompleted: state.inspectionCompleted,
        inspectionRecordId: state.inspectionRecordId
      })
    }
  )
);