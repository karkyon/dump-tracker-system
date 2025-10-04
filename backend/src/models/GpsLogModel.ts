// =====================================
// backend/src/models/GpsLogModel.ts
// GPSログモデル - 完全アーキテクチャ改修版
// Phase 1-B-6: 既存完全実装統合・GPS系統合
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月27日 07:30
// =====================================

import type { 
  GpsLog as PrismaGpsLog,
  Prisma,
  Operation,
  Vehicle,
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import type {
  Coordinates,
  LocationInfo,
  NearbyLocation,
  BoundingBox,
  GeographicBounds
} from '../types/location';

import {
  calculateDistance,
  calculateBearing,
  isValidCoordinates,
  validateGpsCoordinates,
  findNearbyLocations
} from '../utils/gpsCalculations';

import logger from '../utils/logger';
import { 
  AppError, 
  ValidationError, 
  NotFoundError,
  DatabaseError 
} from '../utils/errors';

import type {
  ApiResponse,
  ApiListResponse,
  PaginationQuery,
  SearchQuery
} from '../types/common';

// =====================================
// 🔧 基本型定義（既存実装保持）
// =====================================

export type GpsLogModel = PrismaGpsLog;
export type GpsLogCreateInput = Prisma.GpsLogCreateInput;
export type GpsLogUpdateInput = Prisma.GpsLogUpdateInput;  
export type GpsLogWhereInput = Prisma.GpsLogWhereInput;
export type GpsLogWhereUniqueInput = Prisma.GpsLogWhereUniqueInput;
export type GpsLogOrderByInput = Prisma.GpsLogOrderByWithRelationInput;

// =====================================
// 🌍 GPS強化型定義（Phase 1-A基盤統合）
// =====================================

/**
 * GPS座標付きログエントリ
 */
export interface GpsLogWithCoordinates extends GpsLogModel {
  coordinates: Coordinates;
  locationInfo?: LocationInfo;
  isValidPosition: boolean;
  accuracy?: number;
}

/**
 * GPS統計情報
 */
export interface GpsLogStatistics {
  totalDistance: number; // km
  averageSpeed: number; // km/h
  maxSpeed: number; // km/h
  minSpeed: number; // km/h
  totalDuration: number; // minutes
  stopCount: number;
  routeEfficiency: number; // percentage
  fuelEfficiency?: number; // L/100km
}

/**
 * GPS範囲検索パラメータ
 */
export interface GpsLogRangeQuery {
  center: Coordinates;
  radiusKm: number;
  startTime?: Date;
  endTime?: Date;
  vehicleId?: string;
  operationId?: string;
  speedRange?: {
    min: number;
    max: number;
  };
}

/**
 * GPSルート分析結果
 */
export interface GpsRouteAnalysis {
  totalDistance: number;
  estimatedDuration: number;
  actualDuration: number;
  waypoints: Coordinates[];
  stops: {
    location: Coordinates;
    duration: number; // minutes
    timestamp: Date;
  }[];
  speedProfile: {
    timestamp: Date;
    speed: number;
    location: Coordinates;
  }[];
  anomalies: {
    type: 'SPEED_VIOLATION' | 'ROUTE_DEVIATION' | 'LONG_STOP' | 'GPS_SIGNAL_LOSS';
    timestamp: Date;
    location?: Coordinates;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }[];
}

// =====================================
// 🔧 標準DTO（既存実装保持・拡張）
// =====================================

export interface GpsLogResponseDTO extends GpsLogModel {
  coordinates?: Coordinates;
  distanceFromPrevious?: number;
  speedCalculated?: number;
  locationInfo?: LocationInfo;
  anomalies?: string[];
  _count?: {
    [key: string]: number;
  };
}

export interface GpsLogListResponse extends ApiListResponse<GpsLogResponseDTO> {
  summary?: {
    totalDistance: number;
    averageSpeed: number;
    duration: number;
    anomaliesCount: number;
  };
  statistics?: GpsLogStatistics;
  routeAnalysis?: GpsRouteAnalysis;
}

export interface GpsLogCreateDTO extends Omit<GpsLogCreateInput, 'id'> {
  // フロントエンド送信用（既存実装保持）
  validateCoordinates?: boolean;
  autoCalculateSpeed?: boolean;
}

export interface GpsLogUpdateDTO extends Partial<GpsLogCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 🔧 検索・フィルタ型（GPS機能強化）
// =====================================

export interface GpsLogFilter extends PaginationQuery {
  operationId?: string;
  vehicleId?: string;
  startTime?: Date;
  endTime?: Date;
  coordinates?: GpsLogRangeQuery;
  speedRange?: {
    min: number;
    max: number;
  };
  hasAnomalies?: boolean;
  accuracy?: {
    min: number;
    max: number;
  };
  sortBy?: 'timestamp' | 'speed' | 'accuracy' | 'distance';
}

// =====================================
// 🎯 GPS強化CRUDクラス（アーキテクチャ指針準拠）
// =====================================

export class GpsLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 🔧 新規作成（GPS検証統合）
   */
  async create(data: GpsLogCreateInput): Promise<GpsLogResponseDTO> {
    try {
      // GPS座標検証（Phase 1-A基盤活用）
      if (data.latitude !== null && data.longitude !== null) {
        if (!isValidCoordinates(data.latitude, data.longitude)) {
          throw new ValidationError(
            '無効なGPS座標です',
            'coordinates',
            { latitude: data.latitude, longitude: data.longitude }
          );
        }
      }

      // ログ記録開始
      logger.info('GPSログ作成開始', {
        operationId: data.operationId,
        vehicleId: data.vehicleId,
        coordinates: data.latitude && data.longitude ? 
          { lat: data.latitude, lng: data.longitude } : null
      });

      const result = await this.prisma.gpsLog.create({
        data: {
          ...data,
        },
        include: {
          operation: true,
          vehicle: true
        }
      });

      // GPS強化情報の付加
      const enhancedResult = await this.enhanceWithGpsData(result);

      logger.info('GPSログ作成完了', {
        id: result.id,
        operationId: result.operationId,
        coordinates: enhancedResult.coordinates
      });

      return enhancedResult;

    } catch (error) {
      logger.error('GPSログ作成エラー', { error, data });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('GPSログの作成に失敗しました');
    }
  }

  /**
   * 🔧 主キー指定取得（既存実装保持）
   */
  async findByKey(id: string): Promise<GpsLogResponseDTO | null> {
    try {
      const result = await this.prisma.gpsLog.findUnique({
        where: { id },
        include: {
          operation: true,
          vehicle: true
        }
      });

      if (!result) {
        return null;
      }

      return await this.enhanceWithGpsData(result);

    } catch (error) {
      logger.error('GPSログ取得エラー', { error, id });
      throw new DatabaseError('GPSログの取得に失敗しました');
    }
  }

  /**
   * 🔧 条件指定一覧取得（GPS機能強化）
   */
  async findMany(params?: {
    where?: GpsLogWhereInput;
    orderBy?: GpsLogOrderByInput;
    skip?: number;
    take?: number;
    includeGpsAnalysis?: boolean;
  }): Promise<GpsLogResponseDTO[]> {
    try {
      const results = await this.prisma.gpsLog.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { timestamp: 'desc' },
        skip: params?.skip,
        take: params?.take,
        include: {
          operation: true,
          vehicle: true
        }
      });

      // GPS強化情報の付加
      const enhancedResults = await Promise.all(
        results.map(result => this.enhanceWithGpsData(result))
      );

      // GPS分析を含める場合
      if (params?.includeGpsAnalysis) {
        return await this.addGpsAnalysis(enhancedResults);
      }

      return enhancedResults;

    } catch (error) {
      logger.error('GPSログ一覧取得エラー', { error, params });
      throw new DatabaseError('GPSログ一覧の取得に失敗しました');
    }
  }

  /**
   * 🔧 ページネーション付き一覧取得（統計情報追加）
   */
  async findManyWithPagination(params: {
    where?: GpsLogWhereInput;
    orderBy?: GpsLogOrderByInput;
    page: number;
    pageSize: number;
    includeStatistics?: boolean;
    includeRouteAnalysis?: boolean;
  }): Promise<GpsLogListResponse> {
    try {
      const { page, pageSize, where, orderBy } = params;
      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        this.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          includeGpsAnalysis: true
        }),
        this.prisma.gpsLog.count({ where })
      ]);

      const response: GpsLogListResponse = {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };

      // 統計情報の追加
      if (params.includeStatistics && data.length > 0) {
        response.statistics = await this.calculateStatistics(data);
        response.summary = {
          totalDistance: response.statistics.totalDistance,
          averageSpeed: response.statistics.averageSpeed,
          duration: response.statistics.totalDuration,
          anomaliesCount: data.filter(log => log.anomalies && log.anomalies.length > 0).length
        };
      }

      // ルート分析の追加
      if (params.includeRouteAnalysis && data.length > 0) {
        response.routeAnalysis = await this.analyzeRoute(data);
      }

      return response;

    } catch (error) {
      logger.error('GPSログページネーション取得エラー', { error, params });
      throw new DatabaseError('GPSログページネーション取得に失敗しました');
    }
  }

  /**
   * 🌍 GPS範囲検索（新機能）
   */
  async findByRange(rangeQuery: GpsLogRangeQuery): Promise<GpsLogResponseDTO[]> {
    try {
      const { center, radiusKm, startTime, endTime, vehicleId, operationId, speedRange } = rangeQuery;

      // 範囲検索用のバウンディングボックス計算
      const bounds = this.calculateBoundingBox(center, radiusKm);

      const where: GpsLogWhereInput = {
        latitude: {
          gte: bounds.southWest.latitude,
          lte: bounds.northEast.latitude
        },
        longitude: {
          gte: bounds.southWest.longitude,
          lte: bounds.northEast.longitude
        },
        ...(startTime && { timestamp: { gte: startTime } }),
        ...(endTime && { timestamp: { lte: endTime } }),
        ...(vehicleId && { vehicleId }),
        ...(operationId && { operationId }),
        ...(speedRange && { 
          speed: { 
            gte: speedRange.min, 
            lte: speedRange.max 
          } 
        })
      };

      const results = await this.findMany({ where });

      // 精密な距離フィルタリング
      return results.filter(log => {
        if (!log.coordinates) return false;
        const distance = calculateDistance(center, log.coordinates);
        return distance <= radiusKm;
      });

    } catch (error) {
      logger.error('GPS範囲検索エラー', { error, rangeQuery });
      throw new DatabaseError('GPS範囲検索に失敗しました');
    }
  }

  /**
   * 🔧 更新（GPS検証統合）
   */
  async update(id: string, data: GpsLogUpdateInput): Promise<GpsLogResponseDTO> {
    try {
      // GPS座標検証
      if (data.latitude !== null && data.longitude !== null) {
        if (!isValidCoordinates(data.latitude, data.longitude)) {
          throw new ValidationError(
            '無効なGPS座標です',
            'coordinates',
            { latitude: data.latitude, longitude: data.longitude }
          );
        }
      }

      const result = await this.prisma.gpsLog.update({
        where: { id },
        data,
        include: {
          operation: true,
          vehicle: true
        }
      });

      const enhancedResult = await this.enhanceWithGpsData(result);

      logger.info('GPSログ更新完了', { id, data: enhancedResult });

      return enhancedResult;

    } catch (error) {
      logger.error('GPSログ更新エラー', { error, id, data });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('GPSログの更新に失敗しました');
    }
  }

  /**
   * 🔧 削除
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.gpsLog.delete({
        where: { id }
      });

      logger.info('GPSログ削除完了', { id });

    } catch (error) {
      logger.error('GPSログ削除エラー', { error, id });
      throw new DatabaseError('GPSログの削除に失敗しました');
    }
  }

  // =====================================
  // 🌍 GPS分析・統計関数（新機能）
  // =====================================

  /**
   * GPS強化情報の付加
   */
  private async enhanceWithGpsData(log: any): Promise<GpsLogResponseDTO> {
    const enhanced: GpsLogResponseDTO = { ...log };

    // 座標情報の追加
    if (log.latitude !== null && log.longitude !== null) {
      enhanced.coordinates = {
        latitude: log.latitude,
        longitude: log.longitude,
        altitude: log.altitude || undefined,
        accuracy: log.accuracy || undefined
      };

      // 座標検証結果
      enhanced.anomalies = [];
      if (!isValidCoordinates(log.latitude, log.longitude)) {
        enhanced.anomalies.push('INVALID_COORDINATES');
      }

      // 精度チェック
      if (log.accuracy && log.accuracy > 100) {
        enhanced.anomalies.push('LOW_GPS_ACCURACY');
      }
    }

    return enhanced;
  }

  /**
   * GPS分析情報の追加
   */
  private async addGpsAnalysis(logs: GpsLogResponseDTO[]): Promise<GpsLogResponseDTO[]> {
    if (logs.length < 2) return logs;

    for (let i = 1; i < logs.length; i++) {
      const currentLog = logs[i];
      const previousLog = logs[i - 1];

      if (currentLog.coordinates && previousLog.coordinates) {
        // 前のログとの距離計算
        currentLog.distanceFromPrevious = calculateDistance(
          previousLog.coordinates,
          currentLog.coordinates
        );

        // 速度計算
        const timeDiff = new Date(currentLog.timestamp).getTime() - 
                        new Date(previousLog.timestamp).getTime();
        if (timeDiff > 0) {
          const hoursElapsed = timeDiff / (1000 * 60 * 60);
          currentLog.speedCalculated = currentLog.distanceFromPrevious / hoursElapsed;
        }
      }
    }

    return logs;
  }

  /**
   * 統計情報計算
   */
  private async calculateStatistics(logs: GpsLogResponseDTO[]): Promise<GpsLogStatistics> {
    let totalDistance = 0;
    let totalDuration = 0;
    let speeds: number[] = [];
    let stopCount = 0;

    for (let i = 1; i < logs.length; i++) {
      if (logs[i].distanceFromPrevious) {
        totalDistance += logs[i].distanceFromPrevious;
      }
      if (logs[i].speedCalculated !== undefined) {
        speeds.push(logs[i].speedCalculated!);
        if (logs[i].speedCalculated! < 1) {
          stopCount++;
        }
      }
    }

    if (logs.length > 1) {
      totalDuration = (new Date(logs[logs.length - 1].timestamp).getTime() - 
                      new Date(logs[0].timestamp).getTime()) / (1000 * 60);
    }

    return {
      totalDistance,
      totalDuration,
      averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      minSpeed: speeds.length > 0 ? Math.min(...speeds) : 0,
      stopCount,
      routeEfficiency: totalDistance > 0 && totalDuration > 0 ? 
        (totalDistance / (totalDuration / 60)) / 80 * 100 : 0 // 80km/hを基準とした効率
    };
  }

  /**
   * ルート分析
   */
  private async analyzeRoute(logs: GpsLogResponseDTO[]): Promise<GpsRouteAnalysis> {
    const waypoints: Coordinates[] = logs
      .filter(log => log.coordinates)
      .map(log => log.coordinates!);

    const stops = logs
      .filter(log => log.speedCalculated !== undefined && log.speedCalculated < 1)
      .map(log => ({
        location: log.coordinates!,
        duration: 5, // 仮の停止時間
        timestamp: new Date(log.timestamp)
      }));

    const speedProfile = logs
      .filter(log => log.coordinates && log.speedCalculated !== undefined)
      .map(log => ({
        timestamp: new Date(log.timestamp),
        speed: log.speedCalculated!,
        location: log.coordinates!
      }));

    const anomalies = logs
      .filter(log => log.anomalies && log.anomalies.length > 0)
      .map(log => ({
        type: 'GPS_SIGNAL_LOSS' as const,
        timestamp: new Date(log.timestamp),
        location: log.coordinates,
        severity: 'MEDIUM' as const,
        description: log.anomalies!.join(', ')
      }));

    const statistics = await this.calculateStatistics(logs);

    return {
      totalDistance: statistics.totalDistance,
      estimatedDuration: statistics.totalDuration,
      actualDuration: statistics.totalDuration,
      waypoints,
      stops,
      speedProfile,
      anomalies
    };
  }

  /**
   * バウンディングボックス計算
   */
  private calculateBoundingBox(center: Coordinates, radiusKm: number): BoundingBox {
    const lat = center.latitude;
    const lng = center.longitude;
    
    // 簡易計算（正確には地球の曲率を考慮する必要がある）
    const latDelta = radiusKm / 111.32; // 1度 ≈ 111.32km
    const lngDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

    return {
      northEast: {
        latitude: lat + latDelta,
        longitude: lng + lngDelta
      },
      southWest: {
        latitude: lat - latDelta,
        longitude: lng - lngDelta
      }
    };
  }
}

// =====================================
// 🏭 ファクトリ関数（DI対応）
// =====================================

/**
 * GpsLogServiceのファクトリ関数
 * Phase 1-A基盤準拠のDI対応
 */
export function getGpsLogService(prisma: PrismaClient): GpsLogService {
  return new GpsLogService(prisma);
}

// =====================================
// 🔧 エクスポート（types/index.ts統合用）
// =====================================

export default GpsLogService;

// GPS機能追加エクスポート
export type {
  GpsLogWithCoordinates,
  GpsLogStatistics,
  GpsLogRangeQuery,
  GpsRouteAnalysis,
  GpsLogFilter
};