// backend/src/models/Location.ts
import { PrismaClient, location_type as PrismaLocationType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 場所モデル - Prismaスキーマ完全準拠版
 * 積込・積下場所の管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface LocationModel {
  id: string;
  name: string;
  address: string;
  latitude?: number | null; // Decimal型をnumberで扱う
  longitude?: number | null; // Decimal型をnumberで扱う
  location_type: PrismaLocationType;
  client_name?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  operating_hours?: string | null;
  special_instructions?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LocationCreateInput {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  location_type: PrismaLocationType;
  client_name?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  operating_hours?: string;
  special_instructions?: string;
  is_active?: boolean;
}

export interface LocationUpdateInput {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  location_type?: PrismaLocationType;
  client_name?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  operating_hours?: string;
  special_instructions?: string;
  is_active?: boolean;
}

export interface LocationWhereInput {
  id?: string;
  name?: string | { contains?: string; mode?: 'insensitive' };
  address?: { contains?: string; mode?: 'insensitive' };
  location_type?: PrismaLocationType | PrismaLocationType[];
  client_name?: string | { contains?: string; mode?: 'insensitive' };
  contact_person?: { contains?: string; mode?: 'insensitive' };
  is_active?: boolean;
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface LocationOrderByInput {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  address?: 'asc' | 'desc';
  location_type?: 'asc' | 'desc';
  client_name?: 'asc' | 'desc';
  is_active?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface LocationResponseDTO {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  location_type: PrismaLocationType;
  client_name?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  operating_hours?: string | null;
  special_instructions?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LocationStats {
  total_locations: number;
  active_locations: number;
  loading_locations: number;
  unloading_locations: number;
  both_type_locations: number;
  locations_with_coordinates: number;
  locations_with_contacts: number;
  most_used_locations: LocationUsageStats[];
}

export interface LocationUsageStats {
  location_id: string;
  location_name: string;
  location_type: PrismaLocationType;
  usage_count: number;
  total_quantity_tons: number;
  last_used_date?: Date;
  client_name?: string;
}

export interface LocationDistance {
  from_location_id: string;
  to_location_id: string;
  from_name: string;
  to_name: string;
  distance_km: number;
  estimated_time_minutes: number;
  route_type: 'DIRECT' | 'ROAD' | 'OPTIMIZED';
}

export interface NearbyLocation {
  location: LocationModel;
  distance_km: number;
  bearing_degrees: number;
  is_same_type: boolean;
}

export interface LocationOperatingInfo {
  location_id: string;
  location_name: string;
  is_currently_open: boolean;
  next_opening_time?: Date;
  next_closing_time?: Date;
  operating_status: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  special_notes?: string;
}

// =====================================
// 場所モデルクラス
// =====================================

export class Location {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 場所作成
   */
  async create(data: LocationCreateInput): Promise<LocationModel> {
    try {
      return await this.prisma.locations.create({
        data: {
          ...data,
          is_active: data.is_active ?? true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`場所作成エラー: ${error}`);
    }
  }

  /**
   * 場所取得（ID指定）
   */
  async findById(id: string): Promise<LocationModel | null> {
    try {
      return await this.prisma.locations.findUnique({
        where: { id }
      });
    } catch (error) {
      throw new Error(`場所取得エラー: ${error}`);
    }
  }

  /**
   * 場所取得（名前指定）
   */
  async findByName(name: string): Promise<LocationModel | null> {
    try {
      return await this.prisma.locations.findFirst({
        where: { name }
      });
    } catch (error) {
      throw new Error(`場所取得エラー: ${error}`);
    }
  }

  /**
   * 場所一覧取得
   */
  async findMany(params: {
    where?: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      operation_details?: boolean;
    };
  }): Promise<LocationModel[]> {
    try {
      return await this.prisma.locations.findMany({
        where: params.where,
        orderBy: params.orderBy || { name: 'asc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          operation_details: params.include.operation_details
        } : undefined
      });
    } catch (error) {
      throw new Error(`場所一覧取得エラー: ${error}`);
    }
  }

  /**
   * 場所更新
   */
  async update(id: string, data: LocationUpdateInput): Promise<LocationModel> {
    try {
      return await this.prisma.locations.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`場所更新エラー: ${error}`);
    }
  }

  /**
   * 場所削除（論理削除）
   */
  async softDelete(id: string): Promise<LocationModel> {
    try {
      return await this.prisma.locations.update({
        where: { id },
        data: { 
          is_active: false,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`場所削除エラー: ${error}`);
    }
  }

  /**
   * 場所物理削除
   */
  async delete(id: string): Promise<LocationModel> {
    try {
      return await this.prisma.locations.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`場所物理削除エラー: ${error}`);
    }
  }

  /**
   * 場所数カウント
   */
  async count(where?: LocationWhereInput): Promise<number> {
    try {
      return await this.prisma.locations.count({ where });
    } catch (error) {
      throw new Error(`場所数取得エラー: ${error}`);
    }
  }

  /**
   * アクティブ場所取得
   */
  async findActiveLocations(): Promise<LocationModel[]> {
    try {
      return await this.prisma.locations.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`アクティブ場所取得エラー: ${error}`);
    }
  }

  /**
   * 積込場所取得
   */
  async findLoadingLocations(): Promise<LocationModel[]> {
    try {
      return await this.prisma.locations.findMany({
        where: { 
          location_type: { in: [PrismaLocationType.LOADING, PrismaLocationType.BOTH] },
          is_active: true 
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`積込場所取得エラー: ${error}`);
    }
  }

  /**
   * 積下場所取得
   */
  async findUnloadingLocations(): Promise<LocationModel[]> {
    try {
      return await this.prisma.locations.findMany({
        where: { 
          location_type: { in: [PrismaLocationType.UNLOADING, PrismaLocationType.BOTH] },
          is_active: true 
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`積下場所取得エラー: ${error}`);
    }
  }

  /**
   * タイプ別場所取得
   */
  async findByType(location_type: PrismaLocationType): Promise<LocationModel[]> {
    try {
      return await this.prisma.locations.findMany({
        where: { 
          location_type,
          is_active: true 
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`タイプ別場所取得エラー: ${error}`);
    }
  }

  /**
   * 場所統計取得
   */
  async getStats(): Promise<LocationStats> {
    try {
      const [
        total_locations,
        active_locations,
        loading_locations,
        unloading_locations,
        both_type_locations,
        coordinates_count,
        contacts_count,
        usage_stats
      ] = await Promise.all([
        this.prisma.locations.count(),
        this.prisma.locations.count({ where: { is_active: true } }),
        this.prisma.locations.count({ 
          where: { location_type: PrismaLocationType.LOADING, is_active: true } 
        }),
        this.prisma.locations.count({ 
          where: { location_type: PrismaLocationType.UNLOADING, is_active: true } 
        }),
        this.prisma.locations.count({ 
          where: { location_type: PrismaLocationType.BOTH, is_active: true } 
        }),
        this.prisma.locations.count({
          where: {
            is_active: true,
            latitude: { not: null },
            longitude: { not: null }
          }
        }),
        this.prisma.locations.count({
          where: {
            is_active: true,
            OR: [
              { contact_person: { not: null } },
              { contact_phone: { not: null } },
              { contact_email: { not: null } }
            ]
          }
        }),
        this.getMostUsedLocations(5)
      ]);

      return {
        total_locations,
        active_locations,
        loading_locations,
        unloading_locations,
        both_type_locations,
        locations_with_coordinates: coordinates_count,
        locations_with_contacts: contacts_count,
        most_used_locations: usage_stats
      };
    } catch (error) {
      throw new Error(`場所統計取得エラー: ${error}`);
    }
  }

  /**
   * 使用頻度の高い場所取得
   */
  async getMostUsedLocations(limit: number = 10): Promise<LocationUsageStats[]> {
    try {
      const usage_data = await this.prisma.$queryRaw`
        SELECT 
          l.id as location_id,
          l.name as location_name,
          l.location_type,
          l.client_name,
          COUNT(od.id) as usage_count,
          SUM(od.quantity_tons) as total_quantity_tons,
          MAX(od.created_at) as last_used_date
        FROM locations l
        LEFT JOIN operation_details od ON l.id = od.location_id
        WHERE l.is_active = true
        GROUP BY l.id, l.name, l.location_type, l.client_name
        ORDER BY usage_count DESC, total_quantity_tons DESC
        LIMIT ${limit}
      ` as any[];

      return usage_data.map(location => ({
        location_id: location.location_id,
        location_name: location.location_name,
        location_type: location.location_type,
        usage_count: Number(location.usage_count),
        total_quantity_tons: Number(location.total_quantity_tons) || 0,
        last_used_date: location.last_used_date,
        client_name: location.client_name
      }));
    } catch (error) {
      throw new Error(`使用頻度場所取得エラー: ${error}`);
    }
  }

  /**
   * 場所検索
   */
  async search(query: string, location_type?: PrismaLocationType, limit: number = 10): Promise<LocationModel[]> {
    try {
      const whereClause: any = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
          { client_name: { contains: query, mode: 'insensitive' } },
          { contact_person: { contains: query, mode: 'insensitive' } }
        ],
        is_active: true
      };

      if (location_type) {
        whereClause.location_type = location_type;
      }

      return await this.prisma.locations.findMany({
        where: whereClause,
        take: limit,
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`場所検索エラー: ${error}`);
    }
  }

  /**
   * 座標付き場所取得
   */
  async findLocationsWithCoordinates(): Promise<LocationModel[]> {
    try {
      return await this.prisma.locations.findMany({
        where: {
          is_active: true,
          latitude: { not: null },
          longitude: { not: null }
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`座標付き場所取得エラー: ${error}`);
    }
  }

  /**
   * 指定地点からの距離計算（ハーバーサイン式）
   */
  calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
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
   * 近隣場所取得
   */
  async findNearbyLocations(
    latitude: number, 
    longitude: number, 
    radius_km: number = 50,
    location_type?: PrismaLocationType
  ): Promise<NearbyLocation[]> {
    try {
      const whereClause: any = {
        is_active: true,
        latitude: { not: null },
        longitude: { not: null }
      };

      if (location_type) {
        whereClause.location_type = location_type;
      }

      const locations = await this.prisma.locations.findMany({
        where: whereClause
      });

      const nearbyLocations: NearbyLocation[] = [];

      locations.forEach(location => {
        if (location.latitude && location.longitude) {
          const distance = this.calculateDistance(
            latitude, longitude, 
            location.latitude, location.longitude
          );

          if (distance <= radius_km) {
            const bearing = this.calculateBearing(
              latitude, longitude,
              location.latitude, location.longitude
            );

            nearbyLocations.push({
              location,
              distance_km: Math.round(distance * 100) / 100,
              bearing_degrees: Math.round(bearing),
              is_same_type: location_type ? location.location_type === location_type : false
            });
          }
        }
      });

      return nearbyLocations.sort((a, b) => a.distance_km - b.distance_km);
    } catch (error) {
      throw new Error(`近隣場所取得エラー: ${error}`);
    }
  }

  /**
   * 方位角計算
   */
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
             Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    return (bearing * 180 / Math.PI + 360) % 360;
  }

  /**
   * 場所間距離計算
   */
  async calculateLocationDistance(
    from_location_id: string, 
    to_location_id: string
  ): Promise<LocationDistance | null> {
    try {
      const [fromLocation, toLocation] = await Promise.all([
        this.findById(from_location_id),
        this.findById(to_location_id)
      ]);

      if (!fromLocation || !toLocation || 
          !fromLocation.latitude || !fromLocation.longitude ||
          !toLocation.latitude || !toLocation.longitude) {
        return null;
      }

      const distance = this.calculateDistance(
        fromLocation.latitude, fromLocation.longitude,
        toLocation.latitude, toLocation.longitude
      );

      // 推定時間計算（平均時速40km/hで計算）
      const estimated_time = (distance / 40) * 60; // 分

      return {
        from_location_id,
        to_location_id,
        from_name: fromLocation.name,
        to_name: toLocation.name,
        distance_km: Math.round(distance * 100) / 100,
        estimated_time_minutes: Math.round(estimated_time),
        route_type: 'DIRECT'
      };
    } catch (error) {
      throw new Error(`場所間距離計算エラー: ${error}`);
    }
  }

  /**
   * 営業時間チェック
   */
  checkOperatingStatus(operating_hours: string | null): LocationOperatingInfo['operating_status'] {
    if (!operating_hours) {
      return 'UNKNOWN';
    }

    // 簡単な営業時間チェック（24時間営業、曜日別対応など）
    const now = new Date();
    const currentHour = now.getHours();

    // "24時間" または "24H" の場合
    if (operating_hours.includes('24') || operating_hours.toLowerCase().includes('24h')) {
      return 'OPEN';
    }

    // "09:00-18:00" 形式の解析
    const timeMatch = operating_hours.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const openHour = parseInt(timeMatch[1]);
      const closeHour = parseInt(timeMatch[3]);
      
      if (currentHour >= openHour && currentHour < closeHour) {
        return 'OPEN';
      } else {
        return 'CLOSED';
      }
    }

    return 'UNKNOWN';
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(location: LocationModel): LocationResponseDTO {
    return {
      id: location.id,
      name: location.name,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      location_type: location.location_type,
      client_name: location.client_name,
      contact_person: location.contact_person,
      contact_phone: location.contact_phone,
      contact_email: location.contact_email,
      operating_hours: location.operating_hours,
      special_instructions: location.special_instructions,
      is_active: location.is_active,
      created_at: location.created_at,
      updated_at: location.updated_at
    };
  }

  /**
   * バルク場所作成（CSV等からの一括登録）
   */
  async createMany(locations: LocationCreateInput[]): Promise<{ count: number }> {
    try {
      const locationsWithDefaults = locations.map(location => ({
        ...location,
        is_active: location.is_active ?? true,
        created_at: new Date(),
        updated_at: new Date()
      }));

      return await this.prisma.locations.createMany({
        data: locationsWithDefaults,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルク場所作成エラー: ${error}`);
    }
  }

  /**
   * 場所存在確認
   */
  async exists(where: { 
    id?: string; 
    name?: string 
  }): Promise<boolean> {
    try {
      const location = await this.prisma.locations.findFirst({ where });
      return location !== null;
    } catch (error) {
      throw new Error(`場所存在確認エラー: ${error}`);
    }
  }

  /**
   * 未使用場所取得
   */
  async findUnusedLocations(): Promise<LocationModel[]> {
    try {
      return await this.prisma.locations.findMany({
        where: {
          is_active: true,
          operation_details: {
            none: {}
          }
        },
        orderBy: { created_at: 'desc' }
      });
    } catch (error) {
      throw new Error(`未使用場所取得エラー: ${error}`);
    }
  }

  /**
   * 場所使用履歴取得
   */
  async getUsageHistory(location_id: string, limit: number = 20): Promise<any[]> {
    try {
      return await this.prisma.operation_details.findMany({
        where: { location_id },
        include: {
          operations: {
            include: {
              vehicles: true,
              users_operations_driver_idTousers: true
            }
          },
          items: true
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`場所使用履歴取得エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const locationModel = new Location();
export default locationModel;