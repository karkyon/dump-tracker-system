// backend/src/models/Location.ts
import { PrismaClient, LocationType as PrismaLocationType, RegistrationSource as PrismaRegistrationSource } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 場所モデル
 * 積込・積降場所の管理
 */

export interface LocationModel {
  id: string;
  name: string;
  address: string;
  clientName?: string;
  locationType: PrismaLocationType;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  registrationSource: PrismaRegistrationSource;
  description?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  specialInstructions?: string;
  hazardousArea: boolean;
  accessRestrictions?: string;
  parkingInstructions?: string;
  unloadingInstructions?: string;
  equipmentAvailable?: string;
  photoUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationCreateInput {
  name: string;
  address: string;
  clientName?: string;
  locationType: PrismaLocationType;
  latitude?: number;
  longitude?: number;
  registrationSource?: PrismaRegistrationSource;
  description?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  specialInstructions?: string;
  hazardousArea?: boolean;
  accessRestrictions?: string;
  parkingInstructions?: string;
  unloadingInstructions?: string;
  equipmentAvailable?: string;
  photoUrls?: string[];
}

export interface LocationUpdateInput {
  name?: string;
  address?: string;
  clientName?: string;
  locationType?: PrismaLocationType;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  description?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  specialInstructions?: string;
  hazardousArea?: boolean;
  accessRestrictions?: string;
  parkingInstructions?: string;
  unloadingInstructions?: string;
  equipmentAvailable?: string;
  photoUrls?: string[];
}

export interface LocationWhereInput {
  id?: string;
  name?: { contains?: string; mode?: 'insensitive' };
  address?: { contains?: string; mode?: 'insensitive' };
  clientName?: { contains?: string; mode?: 'insensitive' };
  locationType?: PrismaLocationType;
  isActive?: boolean;
  registrationSource?: PrismaRegistrationSource;
  hazardousArea?: boolean;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface LocationOrderByInput {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  address?: 'asc' | 'desc';
  clientName?: 'asc' | 'desc';
  locationType?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
}

export interface LocationStats {
  totalLocations: number;
  activeLocations: number;
  loadingLocations: number;
  unloadingLocations: number;
  bothTypeLocations: number;
  gpsRegisteredLocations: number;
  manualRegisteredLocations: number;
  hazardousLocations: number;
  newLocationsThisMonth: number;
}

export interface LocationVisitStats {
  locationId: string;
  locationName: string;
  visitCount: number;
  lastVisit?: Date;
  averageStayDuration?: number; // 分
  popularTimeSlots: Array<{
    hour: number;
    count: number;
  }>;
}

export interface LocationDistance {
  fromLocationId: string;
  toLocationId: string;
  distance: number; // km
  estimatedDuration: number; // 分
}

export interface LocationCluster {
  centroid: {
    latitude: number;
    longitude: number;
  };
  locations: LocationModel[];
  radius: number; // km
}

export interface LocationGeocoding {
  address: string;
  latitude: number;
  longitude: number;
  confidence: number;
  components: {
    prefecture?: string;
    city?: string;
    ward?: string;
    district?: string;
    street?: string;
    building?: string;
    postalCode?: string;
  };
}

/**
 * 場所モデルクラス
 */
export class Location {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  /**
   * 場所作成
   */
  async create(data: LocationCreateInput): Promise<LocationModel> {
    return await this.prisma.location.create({
      data: {
        ...data,
        registrationSource: data.registrationSource || PrismaRegistrationSource.MANUAL,
        hazardousArea: data.hazardousArea || false,
        photoUrls: data.photoUrls || []
      }
    });
  }

  /**
   * 場所取得
   */
  async findUnique(where: { id?: string; name?: string }): Promise<LocationModel | null> {
    return await this.prisma.location.findUnique({ where });
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
      loadingTrips?: boolean;
      unloadingTrips?: boolean;
    };
  }): Promise<LocationModel[]> {
    return await this.prisma.location.findMany(params);
  }

  /**
   * 場所更新
   */
  async update(where: { id: string }, data: LocationUpdateInput): Promise<LocationModel> {
    return await this.prisma.location.update({ where, data });
  }

  /**
   * 場所削除（論理削除）
   */
  async softDelete(id: string): Promise<LocationModel> {
    return await this.prisma.location.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * 場所数カウント
   */
  async count(where?: LocationWhereInput): Promise<number> {
    return await this.prisma.location.count({ where });
  }

  /**
   * アクティブ場所取得
   */
  async findActiveLocations(): Promise<LocationModel[]> {
    return await this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * タイプ別場所取得
   */
  async findByType(type: PrismaLocationType): Promise<LocationModel[]> {
    return await this.prisma.location.findMany({
      where: {
        locationType: type,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * 積込場所一覧取得
   */
  async findLoadingLocations(): Promise<LocationModel[]> {
    return await this.prisma.location.findMany({
      where: {
        locationType: { in: [PrismaLocationType.LOADING, PrismaLocationType.BOTH] },
        isActive: true
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * 積降場所一覧取得
   */
  async findUnloadingLocations(): Promise<LocationModel[]> {
    return await this.prisma.location.findMany({
      where: {
        locationType: { in: [PrismaLocationType.UNLOADING, PrismaLocationType.BOTH] },
        isActive: true
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * 近隣場所検索
   */
  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10
  ): Promise<LocationModel[]> {
    // Haversine公式を使用した距離計算のSQL
    const locations = await this.prisma.$queryRaw<LocationModel[]>`
      SELECT *,
        (
          6371 * acos(
            cos(radians(${latitude})) *
            cos(radians(latitude)) *
            cos(radians(longitude) - radians(${longitude})) +
            sin(radians(${latitude})) *
            sin(radians(latitude))
          )
        ) AS distance
      FROM locations
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND is_active = true
      HAVING distance <= ${radiusKm}
      ORDER BY distance ASC
    `;

    return locations;
  }

  /**
   * 場所統計取得
   */
  async getStats(): Promise<LocationStats> {
    const [
      total,
      active,
      loading,
      unloading,
      both,
      gpsRegistered,
      manual,
      hazardous,
      newThisMonth
    ] = await Promise.all([
      this.prisma.location.count(),
      this.prisma.location.count({ where: { isActive: true } }),
      this.prisma.location.count({ where: { locationType: PrismaLocationType.LOADING, isActive: true } }),
      this.prisma.location.count({ where: { locationType: PrismaLocationType.UNLOADING, isActive: true } }),
      this.prisma.location.count({ where: { locationType: PrismaLocationType.BOTH, isActive: true } }),
      this.prisma.location.count({ where: { registrationSource: PrismaRegistrationSource.GPS_AUTO } }),
      this.prisma.location.count({ where: { registrationSource: PrismaRegistrationSource.MANUAL } }),
      this.prisma.location.count({ where: { hazardousArea: true, isActive: true } }),
      this.prisma.location.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    return {
      totalLocations: total,
      activeLocations: active,
      loadingLocations: loading,
      unloadingLocations: unloading,
      bothTypeLocations: both,
      gpsRegisteredLocations: gpsRegistered,
      manualRegisteredLocations: manual,
      hazardousLocations: hazardous,
      newLocationsThisMonth: newThisMonth
    };
  }

  /**
   * 場所検索
   */
  async search(query: string): Promise<LocationModel[]> {
    return await this.prisma.location.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { address: { contains: query, mode: 'insensitive' } },
              { clientName: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * 場所の使用履歴取得
   */
  async getLocationHistory(locationId: string): Promise<any[]> {
    const history = await this.prisma.trip.findMany({
      where: {
        OR: [
          { loadingLocationId: locationId },
          { unloadingLocationId: locationId }
        ]
      },
      include: {
        operation: {
          include: {
            driver: { select: { id: true, name: true } },
            vehicle: { select: { id: true, vehicleNumber: true } }
          }
        },
        item: true
      },
      orderBy: { startTime: 'desc' },
      take: 100
    });

    return history;
  }

  /**
   * 場所の訪問統計取得
   */
  async getLocationVisitStats(locationId: string): Promise<LocationVisitStats> {
    const trips = await this.prisma.trip.findMany({
      where: {
        OR: [
          { loadingLocationId: locationId },
          { unloadingLocationId: locationId }
        ],
        status: 'COMPLETED'
      },
      select: {
        startTime: true,
        endTime: true,
        createdAt: true
      }
    });

    const visitCount = trips.length;
    const lastVisit = trips.length > 0 ? trips[0].createdAt : undefined;

    // 滞在時間の計算
    const durations = trips
      .filter(trip => trip.startTime && trip.endTime)
      .map(trip => {
        const start = new Date(trip.startTime!);
        const end = new Date(trip.endTime!);
        return (end.getTime() - start.getTime()) / (1000 * 60); // 分
      });

    const averageStayDuration = durations.length > 0
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : undefined;

    // 時間帯別の統計
    const hourlyStats = new Array(24).fill(0).map((_, hour) => ({ hour, count: 0 }));
    trips.forEach(trip => {
      if (trip.startTime) {
        const hour = new Date(trip.startTime).getHours();
        hourlyStats[hour].count++;
      }
    });

    const popularTimeSlots = hourlyStats
      .filter(slot => slot.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const location = await this.findUnique({ id: locationId });

    return {
      locationId,
      locationName: location?.name || '不明',
      visitCount,
      lastVisit,
      averageStayDuration,
      popularTimeSlots
    };
  }

  /**
   * 重複場所検出
   */
  async findDuplicates(threshold: number = 100): Promise<LocationModel[][]> {
    const locations = await this.prisma.location.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null }
      }
    });

    const duplicateGroups: LocationModel[][] = [];
    const processed = new Set<string>();

    for (const location of locations) {
      if (processed.has(location.id)) continue;

      const duplicates = [location];
      processed.add(location.id);

      for (const other of locations) {
        if (processed.has(other.id) || location.id === other.id) continue;

        // 距離計算
        const distance = this.calculateDistance(
          location.latitude!,
          location.longitude!,
          other.latitude!,
          other.longitude!
        );

        if (distance <= threshold) {
          duplicates.push(other);
          processed.add(other.id);
        }
      }

      if (duplicates.length > 1) {
        duplicateGroups.push(duplicates);
      }
    }

    return duplicateGroups;
  }

  /**
   * 座標自動取得
   */
  async geocodeAddress(address: string): Promise<LocationGeocoding | null> {
    // 実際の実装では外部API（Google Maps API等）を使用
    // ここではモック実装
    return {
      address,
      latitude: 35.6762,
      longitude: 139.6503,
      confidence: 0.8,
      components: {
        prefecture: '東京都',
        city: '港区',
        ward: '港区',
        postalCode: '105-0000'
      }
    };
  }

  /**
   * 住所逆引き
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<LocationGeocoding | null> {
    // 実際の実装では外部API（Google Maps API等）を使用
    // ここではモック実装
    return {
      address: '東京都港区',
      latitude,
      longitude,
      confidence: 0.9,
      components: {
        prefecture: '東京都',
        city: '港区',
        ward: '港区',
        postalCode: '105-0000'
      }
    };
  }

  /**
   * GPS自動登録場所取得
   */
  async findAutoRegisteredLocations(): Promise<LocationModel[]> {
    return await this.prisma.location.findMany({
      where: {
        registrationSource: PrismaRegistrationSource.GPS_AUTO,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 距離計算（Haversine公式）
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // km

    return distance;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}