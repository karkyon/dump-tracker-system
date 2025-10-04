// =====================================
// backend/src/utils/events.ts
// イベントエミッターシステム - 循環依存解消
// サービス間の疎結合通信を実現
// =====================================

import { EventEmitter } from 'events';
import logger from './logger';

/**
 * アプリケーション全体で使用するイベント定義
 */
export enum AppEvents {
  // 車両関連イベント
  VEHICLE_CREATED = 'vehicle:created',
  VEHICLE_UPDATED = 'vehicle:updated',
  VEHICLE_STATUS_CHANGED = 'vehicle:status:changed',
  VEHICLE_DELETED = 'vehicle:deleted',

  // 点検関連イベント
  INSPECTION_STARTED = 'inspection:started',
  INSPECTION_COMPLETED = 'inspection:completed',
  INSPECTION_FAILED = 'inspection:failed',

  // 統計・レポート関連イベント
  STATISTICS_GENERATED = 'statistics:generated',
  REPORT_REQUESTED = 'report:requested',

  // メンテナンス関連イベント
  MAINTENANCE_SCHEDULED = 'maintenance:scheduled',
  MAINTENANCE_REQUIRED = 'maintenance:required'
}

/**
 * イベントペイロード型定義
 */
export interface VehicleCreatedPayload {
  vehicleId: string;
  plateNumber: string;
  model: string;
  createdBy: string;
}

export interface VehicleStatusChangedPayload {
  vehicleId: string;
  oldStatus: string;
  newStatus: string;
  reason?: string;
  changedBy: string;
}

export interface InspectionCompletedPayload {
  inspectionId: string;
  vehicleId: string;
  inspectionType: string;
  passed: boolean;
  failedItems: number;
  criticalIssues: number;
  completedBy: string;
}

export interface MaintenanceRequiredPayload {
  vehicleId: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredBy?: Date;
  triggeredBy: string;
}

export interface StatisticsGeneratedPayload {
  type: 'fleet' | 'vehicle' | 'inspection';
  data: any;
  generatedBy: string;
}

/**
 * 型安全なイベントエミッター
 */
class TypedEventEmitter extends EventEmitter {
  /**
   * イベント発火（型安全）
   */
  emitTyped<T>(event: AppEvents, payload: T): boolean {
    try {
      logger.debug(`イベント発火: ${event}`, { payload });
      return this.emit(event, payload);
    } catch (error) {
      logger.error(`イベント発火エラー: ${event}`, { error, payload });
      return false;
    }
  }

  /**
   * イベントリスナー登録（型安全）
   */
  onTyped<T>(event: AppEvents, listener: (payload: T) => void | Promise<void>): this {
    return this.on(event, async (payload: T) => {
      try {
        await listener(payload);
      } catch (error) {
        logger.error(`イベントリスナーエラー: ${event}`, { error, payload });
      }
    });
  }
}

/**
 * グローバルイベントエミッターインスタンス（シングルトン）
 */
export const appEventEmitter = new TypedEventEmitter();

// イベントエラーハンドリング
appEventEmitter.on('error', (error) => {
  logger.error('EventEmitter Error', { error });
});

/**
 * イベント発火ヘルパー関数
 */
export const emitEvent = {
  vehicleCreated: (payload: VehicleCreatedPayload) =>
    appEventEmitter.emitTyped(AppEvents.VEHICLE_CREATED, payload),

  vehicleStatusChanged: (payload: VehicleStatusChangedPayload) =>
    appEventEmitter.emitTyped(AppEvents.VEHICLE_STATUS_CHANGED, payload),

  inspectionCompleted: (payload: InspectionCompletedPayload) =>
    appEventEmitter.emitTyped(AppEvents.INSPECTION_COMPLETED, payload),

  maintenanceRequired: (payload: MaintenanceRequiredPayload) =>
    appEventEmitter.emitTyped(AppEvents.MAINTENANCE_REQUIRED, payload),

  statisticsGenerated: (payload: StatisticsGeneratedPayload) =>
    appEventEmitter.emitTyped(AppEvents.STATISTICS_GENERATED, payload)
};

/**
 * イベントリスナー登録ヘルパー
 */
export const onEvent = {
  vehicleCreated: (listener: (payload: VehicleCreatedPayload) => void | Promise<void>) =>
    appEventEmitter.onTyped(AppEvents.VEHICLE_CREATED, listener),

  vehicleStatusChanged: (listener: (payload: VehicleStatusChangedPayload) => void | Promise<void>) =>
    appEventEmitter.onTyped(AppEvents.VEHICLE_STATUS_CHANGED, listener),

  inspectionCompleted: (listener: (payload: InspectionCompletedPayload) => void | Promise<void>) =>
    appEventEmitter.onTyped(AppEvents.INSPECTION_COMPLETED, listener),

  maintenanceRequired: (listener: (payload: MaintenanceRequiredPayload) => void | Promise<void>) =>
    appEventEmitter.onTyped(AppEvents.MAINTENANCE_REQUIRED, listener),

  statisticsGenerated: (listener: (payload: StatisticsGeneratedPayload) => void | Promise<void>) =>
    appEventEmitter.onTyped(AppEvents.STATISTICS_GENERATED, listener)
};

export default appEventEmitter;
