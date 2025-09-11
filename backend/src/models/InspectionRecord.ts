// backend/src/models/InspectionRecord.ts
import { PrismaClient, inspection_type as PrismaInspectionType, inspection_status as PrismaInspectionStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 点検記録モデル - Prismaスキーマ完全準拠版
 * 車両点検記録の管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface InspectionRecordModel {
  id: string;
  vehicle_id: string;
  inspector_id: string;
  operation_id?: string | null;
  inspection_type: PrismaInspectionType;
  status: PrismaInspectionStatus;
  started_at?: Date | null;
  completed_at?: Date | null;
  overall_result?: boolean | null;
  overall_notes?: string | null;
  defects_found?: number | null;
  latitude?: number | null; // Decimal型をnumberで扱う
  longitude?: number | null; // Decimal型をnumberで扱う
  location_name?: string | null;
  weather_condition?: string | null;
  temperature?: number | null; // Decimal型をnumberで扱う
  created_at: Date;
  updated_at: Date;
}

export interface InspectionRecordCreateInput {
  vehicle_id: string;
  inspector_id: string;
  operation_id?: string;
  inspection_type: PrismaInspectionType;
  status?: PrismaInspectionStatus;
  started_at?: Date;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  weather_condition?: string;
  temperature?: number;
}

export interface InspectionRecordUpdateInput {
  vehicle_id?: string;
  inspector_id?: string;
  operation_id?: string;
  inspection_type?: PrismaInspectionType;
  status?: PrismaInspectionStatus;
  started_at?: Date;
  completed_at?: Date;
  overall_result?: boolean;
  overall_notes?: string;
  defects_found?: number;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  weather_condition?: string;
  temperature?: number;
}

export interface InspectionRecordWhereInput {
  id?: string;
  vehicle_id?: string;
  inspector_id?: string;
  operation_id?: string;
  inspection_type?: PrismaInspectionType | PrismaInspectionType[];
  status?: PrismaInspectionStatus | PrismaInspectionStatus[];
  overall_result?: boolean;
  started_at?: {
    gte?: Date;
    lte?: Date;
  };
  completed_at?: {
    gte?: Date;
    lte?: Date;
  };
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface InspectionRecordOrderByInput {
  id?: 'asc' | 'desc';
  inspection_type?: 'asc' | 'desc';
  status?: 'asc' | 'desc';
  started_at?: 'asc' | 'desc';
  completed_at?: 'asc' | 'desc';
  overall_result?: 'asc' | 'desc';
  defects_found?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface InspectionRecordResponseDTO {
  id: string;
  vehicle_id: string;
  inspector_id: string;
  operation_id?: string | null;
  inspection_type: PrismaInspectionType;
  status: PrismaInspectionStatus;
  started_at?: Date | null;
  completed_at?: Date | null;
  overall_result?: boolean | null;
  overall_notes?: string | null;
  defects_found?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  weather_condition?: string | null;
  temperature?: number | null;
  created_at: Date;
  updated_at: Date;
  // リレーションデータ
  vehicle?: {
    plate_number: string;
    model: string;
  };
  inspector?: {
    name: string;
    employee_id?: string;
  };
  operation?: {
    operation_number: string;
    status: string;
  };
}

export interface InspectionRecordStats {
  total_inspections: number;
  completed_inspections: number;
  in_progress_inspections: number;
  failed_inspections: number;
  passed_inspections: number;
  pending_inspections: number;
  total_defects_found: number;
  average_defects_per_inspection: number;
  inspection_completion_rate: number;
  inspection_pass_rate: number;
  inspections_today: number;
  inspections_this_week: number;
  inspections_this_month: number;
}

export interface InspectionSummary {
  inspection_id: string;
  vehicle_plate_number: string;
  inspector_name: string;
  inspection_type: PrismaInspectionType;
  status: PrismaInspectionStatus;
  started_at?: Date;
  completed_at?: Date;
  duration_minutes?: number;
  overall_result?: boolean;
  defects_found: number;
  items_checked: number;
  items_passed: number;
  items_failed: number;
  completion_percentage: number;
}

export interface DailyInspectionReport {
  date: Date;
  total_inspections: number;
  completed_inspections: number;
  passed_inspections: number;
  failed_inspections: number;
  total_defects: number;
  vehicles_inspected: number;
  inspectors_active: number;
  average_inspection_time: number;
  inspections: InspectionSummary[];
}

export interface InspectionAlert {
  type: 'OVERDUE' | 'FAILED' | 'HIGH_DEFECTS' | 'INCOMPLETE';
  inspection_id: string;
  vehicle_plate_number: string;
  inspector_name: string;
  inspection_type: PrismaInspectionType;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  due_date?: Date;
  days_overdue?: number;
}

// =====================================
// 点検記録モデルクラス
// =====================================

export class InspectionRecord {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 点検記録作成
   */
  async create(data: InspectionRecordCreateInput): Promise<InspectionRecordModel> {
    try {
      return await this.prisma.inspection_records.create({
        data: {
          ...data,
          status: data.status || PrismaInspectionStatus.PENDING,
          started_at: data.started_at || new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検記録作成エラー: ${error}`);
    }
  }

  /**
   * 点検記録取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<InspectionRecordModel | null> {
    try {
      return await this.prisma.inspection_records.findUnique({
        where: { id },
        include: includeRelations ? {
          vehicles: true,
          users: true,
          operations: true,
          inspection_item_results: {
            include: {
              inspection_items: true
            }
          }
        } : undefined
      });
    } catch (error) {
      throw new Error(`点検記録取得エラー: ${error}`);
    }
  }

  /**
   * 点検記録一覧取得
   */
  async findMany(params: {
    where?: InspectionRecordWhereInput;
    orderBy?: InspectionRecordOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      vehicle?: boolean;
      inspector?: boolean;
      operation?: boolean;
      item_results?: boolean;
    };
  }): Promise<InspectionRecordModel[]> {
    try {
      return await this.prisma.inspection_records.findMany({
        where: params.where,
        orderBy: params.orderBy || { created_at: 'desc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          vehicles: params.include.vehicle,
          users: params.include.inspector,
          operations: params.include.operation,
          inspection_item_results: params.include.item_results ? {
            include: {
              inspection_items: true
            }
          } : undefined
        } : undefined
      });
    } catch (error) {
      throw new Error(`点検記録一覧取得エラー: ${error}`);
    }
  }

  /**
   * 点検記録更新
   */
  async update(id: string, data: InspectionRecordUpdateInput): Promise<InspectionRecordModel> {
    try {
      return await this.prisma.inspection_records.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検記録更新エラー: ${error}`);
    }
  }

  /**
   * 点検記録削除
   */
  async delete(id: string): Promise<InspectionRecordModel> {
    try {
      return await this.prisma.inspection_records.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`点検記録削除エラー: ${error}`);
    }
  }

  /**
   * 点検記録数カウント
   */
  async count(where?: InspectionRecordWhereInput): Promise<number> {
    try {
      return await this.prisma.inspection_records.count({ where });
    } catch (error) {
      throw new Error(`点検記録数取得エラー: ${error}`);
    }
  }

  /**
   * 点検開始
   */
  async startInspection(id: string): Promise<InspectionRecordModel> {
    try {
      return await this.prisma.inspection_records.update({
        where: { id },
        data: {
          status: PrismaInspectionStatus.IN_PROGRESS,
          started_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検開始エラー: ${error}`);
    }
  }

  /**
   * 点検完了
   */
  async completeInspection(id: string, data: {
    overall_result: boolean;
    overall_notes?: string;
    defects_found?: number;
  }): Promise<InspectionRecordModel> {
    try {
      return await this.prisma.inspection_records.update({
        where: { id },
        data: {
          status: data.overall_result ? PrismaInspectionStatus.COMPLETED : PrismaInspectionStatus.FAILED,
          completed_at: new Date(),
          overall_result: data.overall_result,
          overall_notes: data.overall_notes,
          defects_found: data.defects_found || 0,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検完了エラー: ${error}`);
    }
  }

  /**
   * 点検スキップ
   */
  async skipInspection(id: string, reason?: string): Promise<InspectionRecordModel> {
    try {
      return await this.prisma.inspection_records.update({
        where: { id },
        data: {
          status: PrismaInspectionStatus.SKIPPED,
          overall_notes: reason ? `スキップ理由: ${reason}` : 'スキップ',
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検スキップエラー: ${error}`);
    }
  }

  /**
   * 車両の点検記録取得
   */
  async findByVehicleId(vehicle_id: string, limit?: number): Promise<InspectionRecordModel[]> {
    try {
      return await this.prisma.inspection_records.findMany({
        where: { vehicle_id },
        include: {
          users: true,
          operations: true
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`車両点検記録取得エラー: ${error}`);
    }
  }

  /**
   * 点検者の点検記録取得
   */
  async findByInspectorId(inspector_id: string, limit?: number): Promise<InspectionRecordModel[]> {
    try {
      return await this.prisma.inspection_records.findMany({
        where: { inspector_id },
        include: {
          vehicles: true,
          operations: true
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`点検者記録取得エラー: ${error}`);
    }
  }

  /**
   * 進行中点検取得
   */
  async findActiveInspections(): Promise<InspectionRecordModel[]> {
    try {
      return await this.prisma.inspection_records.findMany({
        where: { status: PrismaInspectionStatus.IN_PROGRESS },
        include: {
          vehicles: true,
          users: true
        },
        orderBy: { started_at: 'asc' }
      });
    } catch (error) {
      throw new Error(`進行中点検取得エラー: ${error}`);
    }
  }

  /**
   * 点検統計取得
   */
  async getStats(period?: { start_date?: Date; end_date?: Date }): Promise<InspectionRecordStats> {
    try {
      const whereClause = period ? {
        created_at: {
          gte: period.start_date,
          lte: period.end_date
        }
      } : {};

      const [
        total_inspections,
        completed_inspections,
        in_progress_inspections,
        failed_inspections,
        passed_inspections,
        pending_inspections,
        defects_result,
        today_inspections,
        week_inspections,
        month_inspections
      ] = await Promise.all([
        this.prisma.inspection_records.count({ where: whereClause }),
        this.prisma.inspection_records.count({ where: { ...whereClause, status: PrismaInspectionStatus.COMPLETED } }),
        this.prisma.inspection_records.count({ where: { ...whereClause, status: PrismaInspectionStatus.IN_PROGRESS } }),
        this.prisma.inspection_records.count({ where: { ...whereClause, status: PrismaInspectionStatus.FAILED } }),
        this.prisma.inspection_records.count({ where: { ...whereClause, overall_result: true } }),
        this.prisma.inspection_records.count({ where: { ...whereClause, status: PrismaInspectionStatus.PENDING } }),
        this.prisma.inspection_records.aggregate({
          where: whereClause,
          _sum: { defects_found: true },
          _avg: { defects_found: true }
        }),
        this.prisma.inspection_records.count({
          where: {
            created_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        this.prisma.inspection_records.count({
          where: {
            created_at: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        this.prisma.inspection_records.count({
          where: {
            created_at: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        })
      ]);

      return {
        total_inspections,
        completed_inspections,
        in_progress_inspections,
        failed_inspections,
        passed_inspections,
        pending_inspections,
        total_defects_found: defects_result._sum.defects_found || 0,
        average_defects_per_inspection: defects_result._avg.defects_found || 0,
        inspection_completion_rate: total_inspections > 0 ? (completed_inspections / total_inspections) * 100 : 0,
        inspection_pass_rate: completed_inspections > 0 ? (passed_inspections / completed_inspections) * 100 : 0,
        inspections_today: today_inspections,
        inspections_this_week: week_inspections,
        inspections_this_month: month_inspections
      };
    } catch (error) {
      throw new Error(`点検統計取得エラー: ${error}`);
    }
  }

  /**
   * 日次点検レポート取得
   */
  async getDailyReport(date: Date): Promise<DailyInspectionReport> {
    try {
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const inspections = await this.prisma.inspection_records.findMany({
        where: {
          created_at: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        include: {
          vehicles: true,
          users: true,
          inspection_item_results: true
        }
      });

      const summaries: InspectionSummary[] = inspections.map(inspection => {
        const duration = inspection.started_at && inspection.completed_at ?
          (inspection.completed_at.getTime() - inspection.started_at.getTime()) / (1000 * 60) : undefined;

        const items_checked = inspection.inspection_item_results.length;
        const items_passed = inspection.inspection_item_results.filter(r => r.is_passed === true).length;
        const items_failed = inspection.inspection_item_results.filter(r => r.is_passed === false).length;
        const completion_percentage = items_checked > 0 ? (items_passed / items_checked) * 100 : 0;

        return {
          inspection_id: inspection.id,
          vehicle_plate_number: inspection.vehicles.plate_number,
          inspector_name: inspection.users.name,
          inspection_type: inspection.inspection_type,
          status: inspection.status,
          started_at: inspection.started_at,
          completed_at: inspection.completed_at,
          duration_minutes: duration,
          overall_result: inspection.overall_result,
          defects_found: inspection.defects_found || 0,
          items_checked,
          items_passed,
          items_failed,
          completion_percentage
        };
      });

      const total_time = summaries
        .filter(s => s.duration_minutes)
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      return {
        date: startOfDay,
        total_inspections: inspections.length,
        completed_inspections: inspections.filter(i => i.status === PrismaInspectionStatus.COMPLETED).length,
        passed_inspections: inspections.filter(i => i.overall_result === true).length,
        failed_inspections: inspections.filter(i => i.overall_result === false).length,
        total_defects: inspections.reduce((sum, i) => sum + (i.defects_found || 0), 0),
        vehicles_inspected: new Set(inspections.map(i => i.vehicle_id)).size,
        inspectors_active: new Set(inspections.map(i => i.inspector_id)).size,
        average_inspection_time: summaries.length > 0 ? total_time / summaries.length : 0,
        inspections: summaries
      };
    } catch (error) {
      throw new Error(`日次点検レポート取得エラー: ${error}`);
    }
  }

  /**
   * 点検アラート取得
   */
  async getInspectionAlerts(): Promise<InspectionAlert[]> {
    try {
      const alerts: InspectionAlert[] = [];
      const now = new Date();

      // 期限切れ点検
      const overdueInspections = await this.prisma.inspection_records.findMany({
        where: {
          status: PrismaInspectionStatus.PENDING,
          created_at: {
            lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24時間前
          }
        },
        include: {
          vehicles: true,
          users: true
        }
      });

      overdueInspections.forEach(inspection => {
        const daysOverdue = Math.floor((now.getTime() - inspection.created_at.getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          type: 'OVERDUE',
          inspection_id: inspection.id,
          vehicle_plate_number: inspection.vehicles.plate_number,
          inspector_name: inspection.users.name,
          inspection_type: inspection.inspection_type,
          message: `点検が${daysOverdue}日遅れています`,
          priority: daysOverdue > 3 ? 'CRITICAL' : daysOverdue > 1 ? 'HIGH' : 'MEDIUM',
          days_overdue: daysOverdue
        });
      });

      // 失敗した点検
      const failedInspections = await this.prisma.inspection_records.findMany({
        where: {
          status: PrismaInspectionStatus.FAILED,
          created_at: {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7日以内
          }
        },
        include: {
          vehicles: true,
          users: true
        }
      });

      failedInspections.forEach(inspection => {
        alerts.push({
          type: 'FAILED',
          inspection_id: inspection.id,
          vehicle_plate_number: inspection.vehicles.plate_number,
          inspector_name: inspection.users.name,
          inspection_type: inspection.inspection_type,
          message: `点検で不具合が発見されました（${inspection.defects_found || 0}件）`,
          priority: (inspection.defects_found || 0) > 5 ? 'CRITICAL' : 'HIGH'
        });
      });

      return alerts.sort((a, b) => {
        const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
      throw new Error(`点検アラート取得エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(inspection: any): InspectionRecordResponseDTO {
    return {
      id: inspection.id,
      vehicle_id: inspection.vehicle_id,
      inspector_id: inspection.inspector_id,
      operation_id: inspection.operation_id,
      inspection_type: inspection.inspection_type,
      status: inspection.status,
      started_at: inspection.started_at,
      completed_at: inspection.completed_at,
      overall_result: inspection.overall_result,
      overall_notes: inspection.overall_notes,
      defects_found: inspection.defects_found,
      latitude: inspection.latitude,
      longitude: inspection.longitude,
      location_name: inspection.location_name,
      weather_condition: inspection.weather_condition,
      temperature: inspection.temperature,
      created_at: inspection.created_at,
      updated_at: inspection.updated_at,
      vehicle: inspection.vehicles ? {
        plate_number: inspection.vehicles.plate_number,
        model: inspection.vehicles.model
      } : undefined,
      inspector: inspection.users ? {
        name: inspection.users.name,
        employee_id: inspection.users.employee_id
      } : undefined,
      operation: inspection.operations ? {
        operation_number: inspection.operations.operation_number,
        status: inspection.operations.status
      } : undefined
    };
  }

  /**
   * 点検記録存在確認
   */
  async exists(where: { 
    id?: string;
    vehicle_id?: string;
    inspector_id?: string;
  }): Promise<boolean> {
    try {
      const inspection = await this.prisma.inspection_records.findFirst({ where });
      return inspection !== null;
    } catch (error) {
      throw new Error(`点検記録存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const inspectionRecordModel = new InspectionRecord();
export default inspectionRecordModel;