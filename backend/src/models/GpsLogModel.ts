// =====================================
// backend/src/models/GpsLogModel.ts
// GPSログモデル - 完全アーキテクチャ改修版
// Phase 1-B-6: 既存完全実装統合・GPS系統合
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月27日 07:30
// 最終更新: 2025年10月6日 - TypeScriptコンパイルエラー完全修正
// =====================================

import type {
  GpsLog as PrismaGpsLog,
  Prisma,
  Operation,
  Vehicle,
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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
  validateGPSCoordinates,
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
  sortBy?: 'recordedAt' | 'speedKmh' | 'accuracyMeters' | 'distance';
}

// =====================================
// 🔧 ヘルパー関数（Decimal型変換）
// =====================================

/**
 * Decimal型をnumber型に変換
 * Prismaの全ての数値型をサポート
 */
function decimalToNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  return 0;
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
      const lat = decimalToNumber(data.latitude);
      const lon = decimalToNumber(data.longitude);

      if (!isValidCoordinates(lat, lon)) {
        throw new ValidationError(
          '無効なGPS座標です',
          'coordinates',
          { latitude: lat, longitude: lon }
        );
      }

      // ログ記録開始
      logger.info('GPSログ作成開始', {
        vehicleId: data.vehicles.connect?.id,
        coordinates: { latitude: lat, longitude: lon }
      });

      const created = await this.prisma.gpsLog.create({
        data,
        include: {
          operations: true,
          vehicles: true
        }
      });

      logger.info('GPSログ作成完了', { id: created.id });

      return this.toResponseDTO(created);
    } catch (error) {
      logger.error('GPSログ作成エラー', { error, data });
      throw error instanceof AppError ? error : new DatabaseError('GPSログ作成に失敗しました');
    }
  }

  /**
   * 🔍 ID検索
   */
  async findById(id: string): Promise<GpsLogResponseDTO | null> {
    try {
      const log = await this.prisma.gpsLog.findUnique({
        where: { id },
        include: {
          operations: true,
          vehicles: true
        }
      });

      return log ? this.toResponseDTO(log) : null;
    } catch (error) {
      logger.error('GPSログ検索エラー', { error, id });
      throw new DatabaseError('GPSログ検索に失敗しました');
    }
  }

  /**
   * 🔍 複数検索
   */
  async findMany(params: {
    where?: GpsLogWhereInput;
    orderBy?: GpsLogOrderByInput | GpsLogOrderByInput[];
    skip?: number;
    take?: number;
  }): Promise<GpsLogResponseDTO[]> {
    try {
      const logs = await this.prisma.gpsLog.findMany({
        ...params,
        include: {
          operations: true,
          vehicles: true
        }
      });

      return logs.map(log => this.toResponseDTO(log));
    } catch (error) {
      logger.error('GPSログ複数検索エラー', { error, params });
      throw new DatabaseError('GPSログ複数検索に失敗しました');
    }
  }

  /**
   * 🔍 フィルタ検索（ページネーション対応）
   */
  async findManyWithFilter(filter: GpsLogFilter): Promise<GpsLogListResponse> {
    try {
      const {
        page = 1,
        limit = 10,
        operationId,
        vehicleId,
        startTime,
        endTime,
        speedRange,
        hasAnomalies,
        accuracy,
        sortBy = 'recordedAt'
      } = filter;

      const skip = (page - 1) * limit;

      const where: GpsLogWhereInput = {
        ...(operationId && { operationId }),
        ...(vehicleId && { vehicleId }),
        ...(startTime && { recordedAt: { gte: startTime } }),
        ...(endTime && { recordedAt: { lte: endTime } }),
        ...(speedRange && {
          speedKmh: {
            gte: speedRange.min,
            lte: speedRange.max
          }
        }),
        ...(accuracy && {
          accuracyMeters: {
            gte: accuracy.min,
            lte: accuracy.max
          }
        })
      };

      const orderBy: GpsLogOrderByInput = { [sortBy]: 'desc' };

      const [logs, totalCount] = await Promise.all([
        this.findMany({ where, orderBy, skip, take: limit }),
        this.prisma.gpsLog.count({ where })
      ]);

      // GPS分析情報の追加
      const enhancedLogs = await this.addGpsAnalysis(logs);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: enhancedLogs,
        meta: {
          total: totalCount,
          page,
          pageSize: limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        message: 'GPSログ一覧を取得しました',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('GPSログフィルタ検索エラー', { error, filter });
      throw new DatabaseError('GPSログフィルタ検索に失敗しました');
    }
  }

  /**
   * 🗺️ GPS範囲検索
   */
  async findByRange(rangeQuery: GpsLogRangeQuery): Promise<GpsLogResponseDTO[]> {
    try {
      const {
        center,
        radiusKm,
        startTime,
        endTime,
        vehicleId,
        operationId,
        speedRange
      } = rangeQuery;

      // 範囲検索用のバウンディングボックス計算
      const bounds = this.calculateBoundingBox(center, radiusKm);

      const where: GpsLogWhereInput = {
        latitude: {
          gte: new Decimal(bounds.southWest.latitude),
          lte: new Decimal(bounds.northEast.latitude)
        },
        longitude: {
          gte: new Decimal(bounds.southWest.longitude),
          lte: new Decimal(bounds.northEast.longitude)
        },
        ...(startTime && { recordedAt: { gte: startTime } }),
        ...(endTime && { recordedAt: { lte: endTime } }),
        ...(vehicleId && { vehicleId }),
        ...(operationId && { operationId }),
        ...(speedRange && {
          speedKmh: {
            gte: speedRange.min,
            lte: speedRange.max
          }
        })
      };

      const results = await this.findMany({ where });

      // 精密な距離フィルタリング
      return results.filter(log => {
        if (!log.coordinates) return false;
        const distance = calculateDistance(
          center.latitude,
          center.longitude,
          log.coordinates.latitude,
          log.coordinates.longitude
        );
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
      if (data.latitude !== undefined && data.longitude !== undefined) {
        const lat = decimalToNumber(data.latitude);
        const lon = decimalToNumber(data.longitude);

        if (!isValidCoordinates(lat, lon)) {
          throw new ValidationError(
            '無効なGPS座標です',
            'coordinates',
            { latitude: lat, longitude: lon }
          );
        }
      }

      const updated = await this.prisma.gpsLog.update({
        where: { id },
        data,
        include: {
          operations: true,
          vehicles: true
        }
      });

      logger.info('GPSログ更新完了', { id });

      return this.toResponseDTO(updated);
    } catch (error) {
      logger.error('GPSログ更新エラー', { error, id, data });
      throw error instanceof AppError ? error : new DatabaseError('GPSログ更新に失敗しました');
    }
  }

  /**
   * 🗑️ 削除
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.gpsLog.delete({ where: { id } });
      logger.info('GPSログ削除完了', { id });
    } catch (error) {
      logger.error('GPSログ削除エラー', { error, id });
      throw new DatabaseError('GPSログ削除に失敗しました');
    }
  }

  // =====================================
  // 🔧 Private ヘルパーメソッド
  // =====================================

  /**
   * ResponseDTOへの変換
   */
  private toResponseDTO(log: PrismaGpsLog & { operations?: Operation | null; vehicles?: Vehicle | null }): GpsLogResponseDTO {
    const lat = decimalToNumber(log.latitude);
    const lon = decimalToNumber(log.longitude);

    const responseDTO: GpsLogResponseDTO = {
      ...log,
      coordinates: {
        latitude: lat,
        longitude: lon,
        altitude: log.altitude ? decimalToNumber(log.altitude) : undefined,
        accuracy: log.accuracyMeters ? decimalToNumber(log.accuracyMeters) : undefined,
        heading: log.heading ? decimalToNumber(log.heading) : undefined,
        speed: log.speedKmh ? decimalToNumber(log.speedKmh) : undefined
      },
      anomalies: []
    };

    // GPS座標妥当性チェック
    if (!isValidCoordinates(lat, lon)) {
      responseDTO.anomalies!.push('INVALID_COORDINATES');
    }

    // 精度チェック
    if (log.accuracyMeters && decimalToNumber(log.accuracyMeters) > 100) {
      responseDTO.anomalies!.push('LOW_GPS_ACCURACY');
    }

    return responseDTO;
  }

  /**
   * GPS分析情報の追加
   */
  private async addGpsAnalysis(logs: GpsLogResponseDTO[]): Promise<GpsLogResponseDTO[]> {
    if (logs.length < 2) return logs;

    for (let i = 1; i < logs.length; i++) {
      const currentLog = logs[i]!;
      const previousLog = logs[i - 1]!;

      if (currentLog.coordinates && previousLog.coordinates) {
        // 前のログとの距離計算
        currentLog.distanceFromPrevious = calculateDistance(
          previousLog.coordinates.latitude,
          previousLog.coordinates.longitude,
          currentLog.coordinates.latitude,
          currentLog.coordinates.longitude
        );

        // 速度計算
        const timeDiff = new Date(currentLog.recordedAt).getTime() -
                        new Date(previousLog.recordedAt).getTime();
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
    const speeds: number[] = [];
    let stopCount = 0;

    for (let i = 1; i < logs.length; i++) {
      const currentLog = logs[i]!;
      if (currentLog.distanceFromPrevious) {
        totalDistance += currentLog.distanceFromPrevious;
      }
      if (currentLog.speedCalculated !== undefined) {
        speeds.push(currentLog.speedCalculated);
        if (currentLog.speedCalculated < 1) {
          stopCount++;
        }
      }
    }

    if (logs.length > 1) {
      const firstLog = logs[0]!;
      const lastLog = logs[logs.length - 1]!;
      totalDuration = (new Date(lastLog.recordedAt).getTime() -
                      new Date(firstLog.recordedAt).getTime()) / (1000 * 60);
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
        timestamp: new Date(log.recordedAt)
      }));

    const speedProfile = logs
      .filter(log => log.coordinates && log.speedCalculated !== undefined)
      .map(log => ({
        timestamp: new Date(log.recordedAt),
        speed: log.speedCalculated!,
        location: log.coordinates!
      }));

    const anomalies = logs
      .filter(log => log.anomalies && log.anomalies.length > 0)
      .map(log => ({
        type: 'GPS_SIGNAL_LOSS' as const,
        timestamp: new Date(log.recordedAt),
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
