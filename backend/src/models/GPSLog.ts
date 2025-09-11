// backend/src/models/GPSLog.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GPSログモデル - Prismaスキーマ完全準拠版
 * 車両位置情報ログの管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface GPSLogModel {
  id: string;
  vehicle_id: string;
  operation_id?: string | null;
  latitude: number; // Decimal型をnumberで扱う
  longitude: number; // Decimal型をnumberで扱う
  altitude?: number | null; // Decimal型をnumberで扱う
  speed_kmh?: number | null; // Decimal型をnumberで扱う
  heading?: number | null; // Decimal型をnumberで扱う
  accuracy_meters?: number | null; // Decimal型をnumberで扱う
  recorded_at: Date;
  created_at: Date;
}

export interface GPSLogCreateInput {
  vehicle_id: string;
  operation_id?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_meters?: number;
  recorded_at: Date;
}

export interface GPSLogUpdateInput {
  vehicle_id?: string;
  operation_id?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_meters?: number;
  recorded_at?: Date;
}

export interface GPSLogWhereInput {
  id?: string;
  vehicle_id?: string;
  operation_id?: string;
  recorded_at?: {
    gte?: Date;
    lte?: Date;
  };
  latitude?: {
    gte?: number;
    lte?: number;
  };
  longitude?: {
    gte?: number;
    lte?: number;
  };
  speed_kmh?: {
    gte?: number;
    lte?: number;
  };
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface GPSLogOrderByInput {
  id?: 'asc' | 'desc';
  vehicle_id?: 'asc' | 'desc';
  recorded_at?: 'asc' | 'desc';
  latitude?: 'asc' | 'desc';
  longitude?: 'asc' | 'desc';
  speed_kmh?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface GPSLogResponseDTO {
  id: string;
  vehicle_id: string;
  operation_id?: string | null;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed_kmh?: number | null;
  heading?: number | null;
  accuracy_meters?: number | null;
  recorded_at: Date;
  created_at: Date;
  // リレーションデータ
  vehicle?: {
    plate_number: string;
    model: string;
  };
  operation?: {
    operation_number: string;
    status: string;
  };
}

export interface GPSLogStats {
  total_logs: number;
  logs_today: number;
  logs_this_week: number;
  logs_this_month: number;
  active_vehicles: number;
  average_speed: number;
  max_speed: number;
  total_distance_tracked: number;
  data_points_per_hour: number;
  coverage_area_km2: number;
}

export interface VehicleTrackingInfo {
  vehicle_id: string;
  vehicle_plate_number: string;
  current_location?: {
    latitude: number;
    longitude: number;
    recorded_at: Date;
    speed_kmh?: number;
    heading?: number;
  };
  last_update: Date;
  is_moving: boolean;
  total_distance_today: number;
  average_speed_today: number;
  max_speed_today: number;
  route_efficiency: number;
  tracking_status: 'ACTIVE' | 'INACTIVE' | 'LOST_SIGNAL';
}

export interface RouteData {
  operation_id?: string;
  vehicle_id: string;
  vehicle_plate_number: string;
  start_time: Date;
  end_time?: Date;
  route_points: RoutePoint[];
  total_distance: number;
  total_duration_minutes: number;
  average_speed: number;
  max_speed: number;
  stops: RouteStop[];
  route_efficiency: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  recorded_at: Date;
  distance_from_previous?: number;
  time_from_previous_seconds?: number;
}

export interface RouteStop {
  latitude: number;
  longitude: number;
  arrival_time: Date;
  departure_time?: Date;
  duration_minutes: number;
  location_name?: string;
  stop_type: 'PLANNED' | 'UNPLANNED' | 'BREAK' | 'LOADING' | 'UNLOADING';
}

export interface GeofenceAlert {
  vehicle_id: string;
  vehicle_plate_number: string;
  alert_type: 'ENTER' | 'EXIT' | 'SPEEDING' | 'IDLE' | 'ROUTE_DEVIATION';
  location: {
    latitude: number;
    longitude: number;
  };
  speed_kmh?: number;
  recorded_at: Date;
  geofence_name?: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// =====================================
// GPSログモデルクラス
// =====================================

export class GPSLog {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * GPSログ作成
   */
  async create(data: GPSLogCreateInput): Promise<GPSLogModel> {
    try {
      return await this.prisma.gps_logs.create({
        data: {
          ...data,
          created_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`GPSログ作成エラー: ${error}`);
    }
  }

  /**
   * GPSログ取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<GPSLogModel | null> {
    try {
      return await this.prisma.gps_logs.findUnique({
        where: { id },
        include: includeRelations ? {
          vehicles: true,
          operations: true
        } : undefined
      });
    } catch (error) {
      throw new Error(`GPSログ取得エラー: ${error}`);
    }
  }

  /**
   * GPSログ一覧取得
   */
  async findMany(params: {
    where?: GPSLogWhereInput;
    orderBy?: GPSLogOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      vehicle?: boolean;
      operation?: boolean;
    };
  }): Promise<GPSLogModel[]> {
    try {
      return await this.prisma.gps_logs.findMany({
        where: params.where,
        orderBy: params.orderBy || { recorded_at: 'desc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          vehicles: params.include.vehicle,
          operations: params.include.operation
        } : undefined
      });
    } catch (error) {
      throw new Error(`GPSログ一覧取得エラー: ${error}`);
    }
  }

  /**
   * GPSログ更新
   */
  async update(id: string, data: GPSLogUpdateInput): Promise<GPSLogModel> {
    try {
      return await this.prisma.gps_logs.update({
        where: { id },
        data
      });
    } catch (error) {
      throw new Error(`GPSログ更新エラー: ${error}`);
    }
  }

  /**
   * GPSログ削除
   */
  async delete(id: string): Promise<GPSLogModel> {
    try {
      return await this.prisma.gps_logs.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`GPSログ削除エラー: ${error}`);
    }
  }

  /**
   * GPSログ数カウント
   */
  async count(where?: GPSLogWhereInput): Promise<number> {
    try {
      return await this.prisma.gps_logs.count({ where });
    } catch (error) {
      throw new Error(`GPSログ数取得エラー: ${error}`);
    }
  }

  /**
   * 車両の最新位置取得
   */
  async getLatestLocation(vehicle_id: string): Promise<GPSLogModel | null> {
    try {
      return await this.prisma.gps_logs.findFirst({
        where: { vehicle_id },
        orderBy: { recorded_at: 'desc' }
      });
    } catch (error) {
      throw new Error(`最新位置取得エラー: ${error}`);
    }
  }

  /**
   * 車両の指定期間ルート取得
   */
  async getVehicleRoute(
    vehicle_id: string,
    start_time: Date,
    end_time: Date
  ): Promise<GPSLogModel[]> {
    try {
      return await this.prisma.gps_logs.findMany({
        where: {
          vehicle_id,
          recorded_at: {
            gte: start_time,
            lte: end_time
          }
        },
        orderBy: { recorded_at: 'asc' }
      });
    } catch (error) {
      throw new Error(`車両ルート取得エラー: ${error}`);
    }
  }

  /**
   * 運行のGPSログ取得
   */
  async getOperationLogs(operation_id: string): Promise<GPSLogModel[]> {
    try {
      return await this.prisma.gps_logs.findMany({
        where: { operation_id },
        orderBy: { recorded_at: 'asc' }
      });
    } catch (error) {
      throw new Error(`運行GPSログ取得エラー: ${error}`);
    }
  }

  /**
   * 指定範囲内の車両取得
   */
  async getVehiclesInArea(
    center_latitude: number,
    center_longitude: number,
    radius_km: number
  ): Promise<GPSLogModel[]> {
    try {
      // 簡単な境界ボックス計算（より正確には距離計算が必要）
      const lat_offset = radius_km / 111; // 約1度=111km
      const lng_offset = radius_km / (111 * Math.cos(center_latitude * Math.PI / 180));

      return await this.prisma.gps_logs.findMany({
        where: {
          latitude: {
            gte: center_latitude - lat_offset,
            lte: center_latitude + lat_offset
          },
          longitude: {
            gte: center_longitude - lng_offset,
            lte: center_longitude + lng_offset
          },
          recorded_at: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // 過去1時間以内
          }
        },
        include: {
          vehicles: true
        },
        orderBy: { recorded_at: 'desc' }
      });
    } catch (error) {
      throw new Error(`エリア内車両取得エラー: ${error}`);
    }
  }

  /**
   * 車両追跡情報取得
   */
  async getVehicleTrackingInfo(vehicle_id: string): Promise<VehicleTrackingInfo | null> {
    try {
      const vehicle = await this.prisma.vehicles.findUnique({
        where: { id: vehicle_id }
      });

      if (!vehicle) {
        return null;
      }

      const latest_log = await this.getLatestLocation(vehicle_id);
      
      if (!latest_log) {
        return null;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const today_logs = await this.prisma.gps_logs.findMany({
        where: {
          vehicle_id,
          recorded_at: { gte: today }
        },
        orderBy: { recorded_at: 'asc' }
      });

      // 今日の総距離計算
      const total_distance_today = this.calculateTotalDistance(today_logs);
      
      // 平均速度計算
      const speeds = today_logs.filter(log => log.speed_kmh && log.speed_kmh > 0)
                              .map(log => log.speed_kmh!);
      const average_speed_today = speeds.length > 0 ? 
        speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0;

      // 最高速度
      const max_speed_today = Math.max(...speeds, 0);

      // 移動状況判定（過去10分以内のログをチェック）
      const recent_logs = today_logs.filter(log => 
        log.recorded_at.getTime() > Date.now() - 10 * 60 * 1000
      );
      const is_moving = recent_logs.some(log => (log.speed_kmh || 0) > 5);

      // 追跡ステータス判定
      const minutes_since_last_update = 
        (Date.now() - latest_log.recorded_at.getTime()) / (1000 * 60);
      
      let tracking_status: 'ACTIVE' | 'INACTIVE' | 'LOST_SIGNAL';
      if (minutes_since_last_update < 5) {
        tracking_status = 'ACTIVE';
      } else if (minutes_since_last_update < 30) {
        tracking_status = 'INACTIVE';
      } else {
        tracking_status = 'LOST_SIGNAL';
      }

      return {
        vehicle_id,
        vehicle_plate_number: vehicle.plate_number,
        current_location: {
          latitude: latest_log.latitude,
          longitude: latest_log.longitude,
          recorded_at: latest_log.recorded_at,
          speed_kmh: latest_log.speed_kmh,
          heading: latest_log.heading
        },
        last_update: latest_log.recorded_at,
        is_moving,
        total_distance_today,
        average_speed_today,
        max_speed_today,
        route_efficiency: this.calculateRouteEfficiency(today_logs),
        tracking_status
      };
    } catch (error) {
      throw new Error(`車両追跡情報取得エラー: ${error}`);
    }
  }

  /**
   * ルートデータ生成
   */
  async generateRouteData(
    vehicle_id: string,
    start_time: Date,
    end_time: Date,
    operation_id?: string
  ): Promise<RouteData | null> {
    try {
      const vehicle = await this.prisma.vehicles.findUnique({
        where: { id: vehicle_id }
      });

      if (!vehicle) {
        return null;
      }

      const logs = await this.getVehicleRoute(vehicle_id, start_time, end_time);
      
      if (logs.length === 0) {
        return null;
      }

      const route_points: RoutePoint[] = [];
      let total_distance = 0;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const prev_log = i > 0 ? logs[i - 1] : null;

        let distance_from_previous = 0;
        let time_from_previous_seconds = 0;

        if (prev_log) {
          distance_from_previous = this.calculateDistance(
            prev_log.latitude, prev_log.longitude,
            log.latitude, log.longitude
          );
          time_from_previous_seconds = 
            (log.recorded_at.getTime() - prev_log.recorded_at.getTime()) / 1000;
          total_distance += distance_from_previous;
        }

        route_points.push({
          latitude: log.latitude,
          longitude: log.longitude,
          altitude: log.altitude,
          speed_kmh: log.speed_kmh,
          heading: log.heading,
          recorded_at: log.recorded_at,
          distance_from_previous,
          time_from_previous_seconds
        });
      }

      const total_duration = (end_time.getTime() - start_time.getTime()) / (1000 * 60);
      const average_speed = total_duration > 0 ? (total_distance / total_duration) * 60 : 0;
      const max_speed = Math.max(...logs.map(log => log.speed_kmh || 0));

      // 停止地点検出
      const stops = this.detectStops(logs);

      return {
        operation_id,
        vehicle_id,
        vehicle_plate_number: vehicle.plate_number,
        start_time,
        end_time,
        route_points,
        total_distance,
        total_duration_minutes: total_duration,
        average_speed,
        max_speed,
        stops,
        route_efficiency: this.calculateRouteEfficiency(logs)
      };
    } catch (error) {
      throw new Error(`ルートデータ生成エラー: ${error}`);
    }
  }

  /**
   * 距離計算（ハーバーサイン式）
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 度数からラジアンに変換
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  /**
   * 総距離計算
   */
  private calculateTotalDistance(logs: GPSLogModel[]): number {
    let total = 0;
    for (let i = 1; i < logs.length; i++) {
      total += this.calculateDistance(
        logs[i-1].latitude, logs[i-1].longitude,
        logs[i].latitude, logs[i].longitude
      );
    }
    return total;
  }

  /**
   * ルート効率計算
   */
  private calculateRouteEfficiency(logs: GPSLogModel[]): number {
    if (logs.length < 2) return 100;

    const actual_distance = this.calculateTotalDistance(logs);
    const direct_distance = this.calculateDistance(
      logs[0].latitude, logs[0].longitude,
      logs[logs.length - 1].latitude, logs[logs.length - 1].longitude
    );

    if (direct_distance === 0) return 100;
    return Math.min(100, (direct_distance / actual_distance) * 100);
  }

  /**
   * 停止地点検出
   */
  private detectStops(logs: GPSLogModel[]): RouteStop[] {
    const stops: RouteStop[] = [];
    const STOP_SPEED_THRESHOLD = 5; // 5km/h以下を停止とみなす
    const MIN_STOP_DURATION = 5; // 5分以上の停止を記録

    let stop_start: GPSLogModel | null = null;
    
    for (const log of logs) {
      const is_stopped = (log.speed_kmh || 0) < STOP_SPEED_THRESHOLD;

      if (is_stopped && !stop_start) {
        stop_start = log;
      } else if (!is_stopped && stop_start) {
        const duration = (log.recorded_at.getTime() - stop_start.recorded_at.getTime()) / (1000 * 60);
        
        if (duration >= MIN_STOP_DURATION) {
          stops.push({
            latitude: stop_start.latitude,
            longitude: stop_start.longitude,
            arrival_time: stop_start.recorded_at,
            departure_time: log.recorded_at,
            duration_minutes: duration,
            stop_type: 'UNPLANNED' // 実際の実装では場所データと照合して判定
          });
        }
        stop_start = null;
      }
    }

    return stops;
  }

  /**
   * GPSログ統計取得
   */
  async getStats(): Promise<GPSLogStats> {
    try {
      const now = new Date();
      const today = new Date(now.setHours(0, 0, 0, 0));
      const week_ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const month_ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        total_logs,
        logs_today,
        logs_this_week,
        logs_this_month,
        active_vehicles_result,
        speed_result
      ] = await Promise.all([
        this.prisma.gps_logs.count(),
        this.prisma.gps_logs.count({ where: { recorded_at: { gte: today } } }),
        this.prisma.gps_logs.count({ where: { recorded_at: { gte: week_ago } } }),
        this.prisma.gps_logs.count({ where: { recorded_at: { gte: month_ago } } }),
        this.prisma.gps_logs.groupBy({
          by: ['vehicle_id'],
          where: { recorded_at: { gte: today } }
        }),
        this.prisma.gps_logs.aggregate({
          where: { 
            speed_kmh: { gt: 0 },
            recorded_at: { gte: today }
          },
          _avg: { speed_kmh: true },
          _max: { speed_kmh: true }
        })
      ]);

      return {
        total_logs,
        logs_today,
        logs_this_week,
        logs_this_month,
        active_vehicles: active_vehicles_result.length,
        average_speed: speed_result._avg.speed_kmh || 0,
        max_speed: speed_result._max.speed_kmh || 0,
        total_distance_tracked: 0, // 複雑な計算のため省略
        data_points_per_hour: logs_today / 24,
        coverage_area_km2: 0 // 複雑な計算のため省略
      };
    } catch (error) {
      throw new Error(`GPSログ統計取得エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(log: any): GPSLogResponseDTO {
    return {
      id: log.id,
      vehicle_id: log.vehicle_id,
      operation_id: log.operation_id,
      latitude: log.latitude,
      longitude: log.longitude,
      altitude: log.altitude,
      speed_kmh: log.speed_kmh,
      heading: log.heading,
      accuracy_meters: log.accuracy_meters,
      recorded_at: log.recorded_at,
      created_at: log.created_at,
      vehicle: log.vehicles ? {
        plate_number: log.vehicles.plate_number,
        model: log.vehicles.model
      } : undefined,
      operation: log.operations ? {
        operation_number: log.operations.operation_number,
        status: log.operations.status
      } : undefined
    };
  }

  /**
   * バルクGPSログ作成
   */
  async createMany(logs: GPSLogCreateInput[]): Promise<{ count: number }> {
    try {
      const logsWithTimestamps = logs.map(log => ({
        ...log,
        created_at: new Date()
      }));

      return await this.prisma.gps_logs.createMany({
        data: logsWithTimestamps,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルクGPSログ作成エラー: ${error}`);
    }
  }

  /**
   * 古いログの削除（データ保持期間管理）
   */
  async deleteOldLogs(days_to_keep: number = 90): Promise<{ count: number }> {
    try {
      const cutoff_date = new Date(Date.now() - days_to_keep * 24 * 60 * 60 * 1000);
      
      return await this.prisma.gps_logs.deleteMany({
        where: {
          recorded_at: { lt: cutoff_date }
        }
      });
    } catch (error) {
      throw new Error(`古いログ削除エラー: ${error}`);
    }
  }

  /**
   * GPSログ存在確認
   */
  async exists(where: { 
    id?: string; 
    vehicle_id?: string;
    operation_id?: string;
  }): Promise<boolean> {
    try {
      const log = await this.prisma.gps_logs.findFirst({ where });
      return log !== null;
    } catch (error) {
      throw new Error(`GPSログ存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const gpsLogModel = new GPSLog();
export default gpsLogModel;