// backend/src/models/Inspection.ts
import { PrismaClient, inspection_type as PrismaInspectionType, inspection_status as PrismaInspectionStatus, input_type as PrismaInputType } from '@prisma/client';
import { InspectionRecord, inspectionRecordModel } from './InspectionRecord';
import { InspectionItem, inspectionItemModel } from './InspectionItem';

const prisma = new PrismaClient();

/**
 * 点検統合モデル - Prismaスキーマ完全準拠版
 * InspectionRecord、InspectionItem、InspectionItemResultsの統合管理
 * 企画提案書要件充足・Controllers/Services完全対応版
 */

// =====================================
// 統合型定義
// =====================================

export interface InspectionItemResultModel {
  id: string;
  inspection_record_id: string;
  inspection_item_id: string;
  result_value?: string | null;
  is_passed?: boolean | null;
  notes?: string | null;
  defect_level?: string | null;
  photo_urls: string[];
  attachment_urls: string[];
  checked_at: Date;
  checked_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CompleteInspectionData {
  inspection_record: {
    id: string;
    vehicle_id: string;
    inspector_id: string;
    operation_id?: string | null;
    inspection_type: PrismaInspectionType;
    status: PrismaInspectionStatus;
    scheduled_at?: Date | null;
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
  };
  inspection_items: {
    id: string;
    name: string;
    description?: string | null;
    input_type: PrismaInputType;
    is_required: boolean;
    display_order: number;
    category?: string | null;
    default_value?: string | null;
    validation_rules?: any;
    help_text?: string | null;
  }[];
  item_results: {
    id: string;
    item_id: string;
    result_value?: string | null;
    is_passed?: boolean | null;
    notes?: string | null;
    defect_level?: string | null;
    photo_urls: string[];
    attachment_urls: string[];
    checked_at: Date;
    checked_by?: string | null;
  }[];
  vehicle: {
    id: string;
    plate_number: string;
    model: string;
    current_mileage: number;
    vehicle_status: string;
  };
  inspector: {
    id: string;
    name: string;
    employee_id?: string | null;
    user_role: string;
  };
  operation?: {
    id: string;
    operation_status: string;
    planned_start_time?: Date | null;
    actual_start_time?: Date | null;
  } | null;
}

export interface InspectionCreateRequest {
  vehicle_id: string;
  inspector_id: string;
  operation_id?: string;
  inspection_type: PrismaInspectionType;
  scheduled_at?: Date;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  weather_condition?: string;
  temperature?: number;
  item_results?: {
    item_id: string;
    result_value?: string;
    is_passed?: boolean;
    notes?: string;
    defect_level?: string;
    photo_urls?: string[];
    attachment_urls?: string[];
  }[];
}

export interface InspectionUpdateRequest {
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
  item_results?: {
    item_id: string;
    result_value?: string;
    is_passed?: boolean;
    notes?: string;
    defect_level?: string;
    photo_urls?: string[];
    attachment_urls?: string[];
  }[];
}

export interface InspectionSearchFilters {
  vehicle_id?: string;
  inspector_id?: string;
  operation_id?: string;
  inspection_type?: PrismaInspectionType;
  status?: PrismaInspectionStatus;
  date_from?: Date;
  date_to?: Date;
  overall_result?: boolean;
  has_defects?: boolean;
  location_name?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'created_at' | 'completed_at' | 'vehicle_plate' | 'inspector_name';
  sort_order?: 'asc' | 'desc';
}

export interface InspectionListResponse {
  inspections: CompleteInspectionData[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface InspectionProgress {
  total_items: number;
  completed_items: number;
  passed_items: number;
  failed_items: number;
  progress_percentage: number;
}

export interface InspectionDashboard {
  summary: {
    total_inspections_today: number;
    completed_inspections_today: number;
    failed_inspections_today: number;
    pending_inspections: number;
    vehicles_requiring_inspection: number;
    overdue_inspections: number;
  };
  recent_inspections: CompleteInspectionData[];
  inspection_alerts: InspectionAlert[];
  performance_metrics: InspectionPerformanceMetrics;
}

export interface InspectionAlert {
  type: 'OVERDUE' | 'FAILED' | 'INCOMPLETE' | 'RECURRING_ISSUE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  vehicle_plate_number: string;
  inspector_name?: string;
  message: string;
  due_date?: Date;
  inspection_type: PrismaInspectionType;
  days_overdue?: number;
  action_required: string;
}

export interface InspectionPerformanceMetrics {
  completion_rate: number;
  pass_rate: number;
  average_inspection_time_minutes: number;
  most_common_defects: {
    defect_type: string;
    occurrence_count: number;
    vehicles_affected: string[];
  }[];
  inspector_performance: {
    inspector_id: string;
    inspector_name: string;
    inspections_completed: number;
    average_time_minutes: number;
    defect_detection_rate: number;
  }[];
}

export interface InspectionStatistics {
  daily_stats: {
    date: Date;
    total_inspections: number;
    completed_inspections: number;
    pass_rate: number;
  }[];
  vehicle_stats: {
    vehicle_id: string;
    plate_number: string;
    total_inspections: number;
    defect_rate: number;
    last_inspection_date?: Date;
  }[];
  inspector_stats: {
    inspector_id: string;
    inspector_name: string;
    total_inspections: number;
    completion_rate: number;
    defect_detection_rate: number;
  }[];
}

// =====================================
// 点検統合モデルクラス
// =====================================

export class Inspection {
  constructor(
    private prisma: PrismaClient = prisma,
    private inspectionRecord: InspectionRecord = inspectionRecordModel,
    private inspectionItem: InspectionItem = inspectionItemModel
  ) {}

  /**
   * 完全な点検作成（記録 + 項目結果）
   */
  async createCompleteInspection(data: InspectionCreateRequest): Promise<CompleteInspectionData> {
    try {
      // 点検記録作成
      const inspection_record = await this.inspectionRecord.create({
        vehicle_id: data.vehicle_id,
        inspector_id: data.inspector_id,
        operation_id: data.operation_id,
        inspection_type: data.inspection_type,
        scheduled_at: data.scheduled_at,
        latitude: data.latitude,
        longitude: data.longitude,
        location_name: data.location_name,
        weather_condition: data.weather_condition,
        temperature: data.temperature,
        status: PrismaInspectionStatus.PENDING,
        started_at: new Date()
      });

      // 該当タイプの点検項目取得
      const inspection_items = await this.inspectionItem.findByInspectionType(data.inspection_type);

      // 項目結果作成
      if (data.item_results && data.item_results.length > 0) {
        for (const result_data of data.item_results) {
          await this.prisma.inspection_item_results.create({
            data: {
              inspection_record_id: inspection_record.id,
              inspection_item_id: result_data.item_id,
              result_value: result_data.result_value,
              is_passed: result_data.is_passed,
              notes: result_data.notes,
              defect_level: result_data.defect_level,
              photo_urls: result_data.photo_urls || [],
              attachment_urls: result_data.attachment_urls || [],
              checked_at: new Date(),
              checked_by: data.inspector_id
            }
          });
        }
      }

      return await this.getCompleteInspectionData(inspection_record.id);
    } catch (error) {
      throw new Error(`完全点検作成エラー: ${error}`);
    }
  }

  /**
   * 完全な点検データ取得
   */
  async getCompleteInspectionData(inspection_record_id: string): Promise<CompleteInspectionData> {
    try {
      const inspection_data = await this.prisma.inspection_records.findUnique({
        where: { id: inspection_record_id },
        include: {
          vehicles: true,
          users: true,
          operations: true,
          inspection_item_results: {
            include: {
              inspection_items: true
            }
          }
        }
      });

      if (!inspection_data) {
        throw new Error('点検記録が見つかりません');
      }

      const inspection_items = await this.inspectionItem.findByInspectionType(
        inspection_data.inspection_type
      );

      const item_results = inspection_data.inspection_item_results.map(result => ({
        id: result.id,
        item_id: result.inspection_item_id,
        result_value: result.result_value,
        is_passed: result.is_passed,
        notes: result.notes,
        defect_level: result.defect_level,
        photo_urls: result.photo_urls,
        attachment_urls: result.attachment_urls,
        checked_at: result.checked_at,
        checked_by: result.checked_by
      }));

      return {
        inspection_record: {
          id: inspection_data.id,
          vehicle_id: inspection_data.vehicle_id,
          inspector_id: inspection_data.inspector_id,
          operation_id: inspection_data.operation_id,
          inspection_type: inspection_data.inspection_type,
          status: inspection_data.status,
          scheduled_at: inspection_data.scheduled_at,
          started_at: inspection_data.started_at,
          completed_at: inspection_data.completed_at,
          overall_result: inspection_data.overall_result,
          overall_notes: inspection_data.overall_notes,
          defects_found: inspection_data.defects_found,
          latitude: inspection_data.latitude ? Number(inspection_data.latitude) : null,
          longitude: inspection_data.longitude ? Number(inspection_data.longitude) : null,
          location_name: inspection_data.location_name,
          weather_condition: inspection_data.weather_condition,
          temperature: inspection_data.temperature ? Number(inspection_data.temperature) : null,
          created_at: inspection_data.created_at,
          updated_at: inspection_data.updated_at
        },
        inspection_items: inspection_items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          input_type: item.input_type,
          is_required: item.is_required,
          display_order: item.display_order,
          category: item.category,
          default_value: item.default_value,
          validation_rules: item.validation_rules,
          help_text: item.help_text
        })),
        item_results,
        vehicle: {
          id: inspection_data.vehicles.id,
          plate_number: inspection_data.vehicles.plate_number,
          model: inspection_data.vehicles.model,
          current_mileage: inspection_data.vehicles.current_mileage,
          vehicle_status: inspection_data.vehicles.vehicle_status
        },
        inspector: {
          id: inspection_data.users.id,
          name: inspection_data.users.name,
          employee_id: inspection_data.users.employee_id,
          user_role: inspection_data.users.user_role
        },
        operation: inspection_data.operations ? {
          id: inspection_data.operations.id,
          operation_status: inspection_data.operations.operation_status,
          planned_start_time: inspection_data.operations.planned_start_time,
          actual_start_time: inspection_data.operations.actual_start_time
        } : null
      };
    } catch (error) {
      throw new Error(`完全点検データ取得エラー: ${error}`);
    }
  }

  /**
   * 点検更新（記録 + 項目結果）
   */
  async updateCompleteInspection(
    inspection_record_id: string, 
    data: InspectionUpdateRequest
  ): Promise<CompleteInspectionData> {
    try {
      // 点検記録更新
      if (data.status || data.overall_result !== undefined || data.overall_notes || data.defects_found !== undefined || 
          data.started_at || data.completed_at || data.latitude !== undefined || data.longitude !== undefined ||
          data.location_name || data.weather_condition || data.temperature !== undefined) {
        
        await this.inspectionRecord.update(inspection_record_id, {
          status: data.status,
          started_at: data.started_at,
          completed_at: data.completed_at || (data.status === PrismaInspectionStatus.COMPLETED ? new Date() : undefined),
          overall_result: data.overall_result,
          overall_notes: data.overall_notes,
          defects_found: data.defects_found,
          latitude: data.latitude,
          longitude: data.longitude,
          location_name: data.location_name,
          weather_condition: data.weather_condition,
          temperature: data.temperature
        });
      }

      // 項目結果更新
      if (data.item_results && data.item_results.length > 0) {
        for (const result_data of data.item_results) {
          await this.prisma.inspection_item_results.upsert({
            where: {
              inspection_item_results_unique: {
                inspection_record_id,
                inspection_item_id: result_data.item_id
              }
            },
            update: {
              result_value: result_data.result_value,
              is_passed: result_data.is_passed,
              notes: result_data.notes,
              defect_level: result_data.defect_level,
              photo_urls: result_data.photo_urls || [],
              attachment_urls: result_data.attachment_urls || [],
              checked_at: new Date(),
              updated_at: new Date()
            },
            create: {
              inspection_record_id,
              inspection_item_id: result_data.item_id,
              result_value: result_data.result_value,
              is_passed: result_data.is_passed,
              notes: result_data.notes,
              defect_level: result_data.defect_level,
              photo_urls: result_data.photo_urls || [],
              attachment_urls: result_data.attachment_urls || [],
              checked_at: new Date()
            }
          });
        }
      }

      return await this.getCompleteInspectionData(inspection_record_id);
    } catch (error) {
      throw new Error(`点検更新エラー: ${error}`);
    }
  }

  /**
   * 点検検索・フィルタリング
   */
  async searchInspections(filters: InspectionSearchFilters): Promise<InspectionListResponse> {
    try {
      const page = filters.page || 1;
      const page_size = filters.page_size || 20;
      const skip = (page - 1) * page_size;

      // 検索条件構築
      const where_conditions: any = {};

      if (filters.vehicle_id) where_conditions.vehicle_id = filters.vehicle_id;
      if (filters.inspector_id) where_conditions.inspector_id = filters.inspector_id;
      if (filters.operation_id) where_conditions.operation_id = filters.operation_id;
      if (filters.inspection_type) where_conditions.inspection_type = filters.inspection_type;
      if (filters.status) where_conditions.status = filters.status;
      if (filters.overall_result !== undefined) where_conditions.overall_result = filters.overall_result;
      if (filters.location_name) {
        where_conditions.location_name = { contains: filters.location_name, mode: 'insensitive' };
      }

      // 日付範囲フィルター
      if (filters.date_from || filters.date_to) {
        where_conditions.created_at = {};
        if (filters.date_from) where_conditions.created_at.gte = filters.date_from;
        if (filters.date_to) where_conditions.created_at.lte = filters.date_to;
      }

      // 不具合有無フィルター
      if (filters.has_defects !== undefined) {
        if (filters.has_defects) {
          where_conditions.defects_found = { gt: 0 };
        } else {
          where_conditions.OR = [
            { defects_found: 0 },
            { defects_found: null }
          ];
        }
      }

      // ソート条件
      const order_by: any = {};
      const sort_field = filters.sort_by || 'created_at';
      const sort_direction = filters.sort_order || 'desc';

      if (sort_field === 'vehicle_plate') {
        order_by.vehicles = { plate_number: sort_direction };
      } else if (sort_field === 'inspector_name') {
        order_by.users = { name: sort_direction };
      } else {
        order_by[sort_field] = sort_direction;
      }

      // 総件数取得
      const total_count = await this.prisma.inspection_records.count({
        where: where_conditions
      });

      // データ取得
      const inspection_records = await this.prisma.inspection_records.findMany({
        where: where_conditions,
        include: {
          vehicles: true,
          users: true,
          operations: true,
          inspection_item_results: {
            include: {
              inspection_items: true
            }
          }
        },
        orderBy: order_by,
        skip,
        take: page_size
      });

      // 結果を CompleteInspectionData 形式に変換
      const inspections: CompleteInspectionData[] = [];
      for (const record of inspection_records) {
        const inspection_items = await this.inspectionItem.findByInspectionType(record.inspection_type);
        
        const item_results = record.inspection_item_results.map(result => ({
          id: result.id,
          item_id: result.inspection_item_id,
          result_value: result.result_value,
          is_passed: result.is_passed,
          notes: result.notes,
          defect_level: result.defect_level,
          photo_urls: result.photo_urls,
          attachment_urls: result.attachment_urls,
          checked_at: result.checked_at,
          checked_by: result.checked_by
        }));

        inspections.push({
          inspection_record: {
            id: record.id,
            vehicle_id: record.vehicle_id,
            inspector_id: record.inspector_id,
            operation_id: record.operation_id,
            inspection_type: record.inspection_type,
            status: record.status,
            scheduled_at: record.scheduled_at,
            started_at: record.started_at,
            completed_at: record.completed_at,
            overall_result: record.overall_result,
            overall_notes: record.overall_notes,
            defects_found: record.defects_found,
            latitude: record.latitude ? Number(record.latitude) : null,
            longitude: record.longitude ? Number(record.longitude) : null,
            location_name: record.location_name,
            weather_condition: record.weather_condition,
            temperature: record.temperature ? Number(record.temperature) : null,
            created_at: record.created_at,
            updated_at: record.updated_at
          },
          inspection_items: inspection_items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            input_type: item.input_type,
            is_required: item.is_required,
            display_order: item.display_order,
            category: item.category,
            default_value: item.default_value,
            validation_rules: item.validation_rules,
            help_text: item.help_text
          })),
          item_results,
          vehicle: {
            id: record.vehicles.id,
            plate_number: record.vehicles.plate_number,
            model: record.vehicles.model,
            current_mileage: record.vehicles.current_mileage,
            vehicle_status: record.vehicles.vehicle_status
          },
          inspector: {
            id: record.users.id,
            name: record.users.name,
            employee_id: record.users.employee_id,
            user_role: record.users.user_role
          },
          operation: record.operations ? {
            id: record.operations.id,
            operation_status: record.operations.operation_status,
            planned_start_time: record.operations.planned_start_time,
            actual_start_time: record.operations.actual_start_time
          } : null
        });
      }

      return {
        inspections,
        total_count,
        page,
        page_size,
        total_pages: Math.ceil(total_count / page_size)
      };
    } catch (error) {
      throw new Error(`点検検索エラー: ${error}`);
    }
  }

  /**
   * 点検進捗計算
   */
  async calculateInspectionProgress(inspection_record_id: string): Promise<InspectionProgress> {
    try {
      const inspection_data = await this.prisma.inspection_records.findUnique({
        where: { id: inspection_record_id },
        include: {
          inspection_item_results: true
        }
      });

      if (!inspection_data) {
        throw new Error('点検記録が見つかりません');
      }

      const inspection_items = await this.inspectionItem.findByInspectionType(
        inspection_data.inspection_type
      );

      const total_items = inspection_items.length;
      const completed_items = inspection_data.inspection_item_results.length;
      const passed_items = inspection_data.inspection_item_results.filter(
        result => result.is_passed === true
      ).length;
      const failed_items = inspection_data.inspection_item_results.filter(
        result => result.is_passed === false
      ).length;
      const progress_percentage = total_items > 0 ? 
        Math.round((completed_items / total_items) * 100) : 0;

      return {
        total_items,
        completed_items,
        passed_items,
        failed_items,
        progress_percentage
      };
    } catch (error) {
      throw new Error(`点検進捗計算エラー: ${error}`);
    }
  }

  /**
   * ダッシュボードデータ取得
   */
  async getDashboardData(): Promise<InspectionDashboard> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // 本日の統計
      const total_inspections_today = await this.prisma.inspection_records.count({
        where: {
          created_at: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      const completed_inspections_today = await this.prisma.inspection_records.count({
        where: {
          status: PrismaInspectionStatus.COMPLETED,
          completed_at: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      const failed_inspections_today = await this.prisma.inspection_records.count({
        where: {
          status: PrismaInspectionStatus.FAILED,
          completed_at: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      const pending_inspections = await this.prisma.inspection_records.count({
        where: {
          status: {
            in: [PrismaInspectionStatus.PENDING, PrismaInspectionStatus.IN_PROGRESS]
          }
        }
      });

      // 期限切れ点検
      const overdue_inspections = await this.prisma.inspection_records.count({
        where: {
          status: {
            in: [PrismaInspectionStatus.PENDING, PrismaInspectionStatus.IN_PROGRESS]
          },
          scheduled_at: {
            lt: new Date()
          }
        }
      });

      // アクティブ車両で今日点検が必要な車両数（簡易計算）
      const vehicles_requiring_inspection = await this.prisma.vehicles.count({
        where: {
          vehicle_status: 'ACTIVE'
        }
      });

      // 最近の点検記録
      const recent_inspections_data = await this.prisma.inspection_records.findMany({
        include: {
          vehicles: true,
          users: true,
          operations: true,
          inspection_item_results: {
            include: {
              inspection_items: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 10
      });

      const recent_inspections: CompleteInspectionData[] = [];
      for (const record of recent_inspections_data) {
        const inspection_items = await this.inspectionItem.findByInspectionType(record.inspection_type);
        
        const item_results = record.inspection_item_results.map(result => ({
          id: result.id,
          item_id: result.inspection_item_id,
          result_value: result.result_value,
          is_passed: result.is_passed,
          notes: result.notes,
          defect_level: result.defect_level,
          photo_urls: result.photo_urls,
          attachment_urls: result.attachment_urls,
          checked_at: result.checked_at,
          checked_by: result.checked_by
        }));

        recent_inspections.push({
          inspection_record: {
            id: record.id,
            vehicle_id: record.vehicle_id,
            inspector_id: record.inspector_id,
            operation_id: record.operation_id,
            inspection_type: record.inspection_type,
            status: record.status,
            scheduled_at: record.scheduled_at,
            started_at: record.started_at,
            completed_at: record.completed_at,
            overall_result: record.overall_result,
            overall_notes: record.overall_notes,
            defects_found: record.defects_found,
            latitude: record.latitude ? Number(record.latitude) : null,
            longitude: record.longitude ? Number(record.longitude) : null,
            location_name: record.location_name,
            weather_condition: record.weather_condition,
            temperature: record.temperature ? Number(record.temperature) : null,
            created_at: record.created_at,
            updated_at: record.updated_at
          },
          inspection_items: inspection_items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            input_type: item.input_type,
            is_required: item.is_required,
            display_order: item.display_order,
            category: item.category,
            default_value: item.default_value,
            validation_rules: item.validation_rules,
            help_text: item.help_text
          })),
          item_results,
          vehicle: {
            id: record.vehicles.id,
            plate_number: record.vehicles.plate_number,
            model: record.vehicles.model,
            current_mileage: record.vehicles.current_mileage,
            vehicle_status: record.vehicles.vehicle_status
          },
          inspector: {
            id: record.users.id,
            name: record.users.name,
            employee_id: record.users.employee_id,
            user_role: record.users.user_role
          },
          operation: record.operations ? {
            id: record.operations.id,
            operation_status: record.operations.operation_status,
            planned_start_time: record.operations.planned_start_time,
            actual_start_time: record.operations.actual_start_time
          } : null
        });
      }

      // アラート生成（簡易版）
      const inspection_alerts: InspectionAlert[] = [];
      
      // 期限切れアラート
      if (overdue_inspections > 0) {
        inspection_alerts.push({
          type: 'OVERDUE',
          priority: 'HIGH',
          vehicle_plate_number: '複数車両',
          message: `${overdue_inspections}件の点検が期限切れです`,
          inspection_type: PrismaInspectionType.PRE_TRIP,
          days_overdue: 1,
          action_required: '早急に点検を実施してください'
        });
      }

      // パフォーマンスメトリクス（簡易版）
      const performance_metrics: InspectionPerformanceMetrics = {
        completion_rate: total_inspections_today > 0 ? 
          (completed_inspections_today / total_inspections_today) * 100 : 0,
        pass_rate: completed_inspections_today > 0 ? 
          ((completed_inspections_today - failed_inspections_today) / completed_inspections_today) * 100 : 0,
        average_inspection_time_minutes: 15, // 暫定値
        most_common_defects: [],
        inspector_performance: []
      };

      return {
        summary: {
          total_inspections_today,
          completed_inspections_today,
          failed_inspections_today,
          pending_inspections,
          vehicles_requiring_inspection,
          overdue_inspections
        },
        recent_inspections,
        inspection_alerts,
        performance_metrics
      };
    } catch (error) {
      throw new Error(`ダッシュボードデータ取得エラー: ${error}`);
    }
  }

  /**
   * 点検統計取得
   */
  async getInspectionStatistics(date_from?: Date, date_to?: Date): Promise<InspectionStatistics> {
    try {
      const where_conditions: any = {};
      
      if (date_from || date_to) {
        where_conditions.created_at = {};
        if (date_from) where_conditions.created_at.gte = date_from;
        if (date_to) where_conditions.created_at.lte = date_to;
      }

      // 日別統計（過去30日間）
      const thirty_days_ago = new Date();
      thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);

      const daily_inspections = await this.prisma.inspection_records.groupBy({
        by: ['created_at'],
        where: {
          created_at: {
            gte: thirty_days_ago
          }
        },
        _count: {
          _all: true
        }
      });

      const daily_stats = daily_inspections.map(item => ({
        date: item.created_at,
        total_inspections: item._count._all,
        completed_inspections: 0, // 詳細クエリが必要
        pass_rate: 0 // 詳細クエリが必要
      }));

      // 車両別統計
      const vehicle_inspections = await this.prisma.inspection_records.groupBy({
        by: ['vehicle_id'],
        where: where_conditions,
        _count: {
          _all: true
        }
      });

      const vehicle_stats = [];
      for (const item of vehicle_inspections) {
        const vehicle = await this.prisma.vehicles.findUnique({
          where: { id: item.vehicle_id }
        });
        
        if (vehicle) {
          const failed_count = await this.prisma.inspection_records.count({
            where: {
              vehicle_id: item.vehicle_id,
              status: PrismaInspectionStatus.FAILED,
              ...where_conditions
            }
          });

          const last_inspection = await this.prisma.inspection_records.findFirst({
            where: { vehicle_id: item.vehicle_id },
            orderBy: { created_at: 'desc' }
          });

          vehicle_stats.push({
            vehicle_id: item.vehicle_id,
            plate_number: vehicle.plate_number,
            total_inspections: item._count._all,
            defect_rate: item._count._all > 0 ? (failed_count / item._count._all) * 100 : 0,
            last_inspection_date: last_inspection?.created_at
          });
        }
      }

      // 検査員別統計
      const inspector_inspections = await this.prisma.inspection_records.groupBy({
        by: ['inspector_id'],
        where: where_conditions,
        _count: {
          _all: true
        }
      });

      const inspector_stats = [];
      for (const item of inspector_inspections) {
        const inspector = await this.prisma.users.findUnique({
          where: { id: item.inspector_id }
        });
        
        if (inspector) {
          const completed_count = await this.prisma.inspection_records.count({
            where: {
              inspector_id: item.inspector_id,
              status: PrismaInspectionStatus.COMPLETED,
              ...where_conditions
            }
          });

          const defects_detected = await this.prisma.inspection_records.count({
            where: {
              inspector_id: item.inspector_id,
              defects_found: { gt: 0 },
              ...where_conditions
            }
          });

          inspector_stats.push({
            inspector_id: item.inspector_id,
            inspector_name: inspector.name,
            total_inspections: item._count._all,
            completion_rate: item._count._all > 0 ? (completed_count / item._count._all) * 100 : 0,
            defect_detection_rate: item._count._all > 0 ? (defects_detected / item._count._all) * 100 : 0
          });
        }
      }

      return {
        daily_stats,
        vehicle_stats,
        inspector_stats
      };
    } catch (error) {
      throw new Error(`点検統計取得エラー: ${error}`);
    }
  }

  /**
   * 点検削除（関連データも含む）
   */
  async deleteCompleteInspection(inspection_record_id: string): Promise<void> {
    try {
      // 項目結果を先に削除
      await this.prisma.inspection_item_results.deleteMany({
        where: { inspection_record_id }
      });

      // 点検記録を削除
      await this.inspectionRecord.delete(inspection_record_id);
    } catch (error) {
      throw new Error(`点検削除エラー: ${error}`);
    }
  }

  /**
   * 一括点検作成（複数車両・複数タイプ）
   */
  async createBulkInspections(requests: InspectionCreateRequest[]): Promise<CompleteInspectionData[]> {
    try {
      const results: CompleteInspectionData[] = [];
      
      for (const request of requests) {
        const inspection = await this.createCompleteInspection(request);
        results.push(inspection);
      }
      
      return results;
    } catch (error) {
      throw new Error(`一括点検作成エラー: ${error}`);
    }
  }

  /**
   * 点検テンプレート適用
   */
  async applyInspectionTemplate(
    inspection_record_id: string, 
    template_name: string
  ): Promise<CompleteInspectionData> {
    try {
      // テンプレート取得（実装は inspection_items から該当項目を取得）
      const inspection_record = await this.prisma.inspection_records.findUnique({
        where: { id: inspection_record_id }
      });

      if (!inspection_record) {
        throw new Error('点検記録が見つかりません');
      }

      const template_items = await this.inspectionItem.findByInspectionType(
        inspection_record.inspection_type
      );

      // テンプレートから項目結果を作成
      for (const item of template_items) {
        await this.prisma.inspection_item_results.upsert({
          where: {
            inspection_item_results_unique: {
              inspection_record_id,
              inspection_item_id: item.id
            }
          },
          update: {
            result_value: item.default_value,
            checked_at: new Date()
          },
          create: {
            inspection_record_id,
            inspection_item_id: item.id,
            result_value: item.default_value,
            checked_at: new Date()
          }
        });
      }

      return await this.getCompleteInspectionData(inspection_record_id);
    } catch (error) {
      throw new Error(`点検テンプレート適用エラー: ${error}`);
    }
  }

  /**
   * 点検バリデーション
   */
  async validateInspection(data: InspectionCreateRequest | InspectionUpdateRequest): Promise<boolean> {
    try {
      // 基本バリデーション
      if ('vehicle_id' in data && data.vehicle_id) {
        const vehicle = await this.prisma.vehicles.findUnique({
          where: { id: data.vehicle_id }
        });
        if (!vehicle || vehicle.vehicle_status !== 'ACTIVE') {
          throw new Error('無効または非アクティブな車両です');
        }
      }

      if ('inspector_id' in data && data.inspector_id) {
        const inspector = await this.prisma.users.findUnique({
          where: { id: data.inspector_id }
        });
        if (!inspector) {
          throw new Error('無効な検査員です');
        }
      }

      // 項目結果バリデーション
      if (data.item_results) {
        for (const result of data.item_results) {
          const item = await this.prisma.inspection_items.findUnique({
            where: { id: result.item_id }
          });
          
          if (!item) {
            throw new Error(`無効な点検項目: ${result.item_id}`);
          }

          if (item.is_required && !result.result_value) {
            throw new Error(`必須項目が未入力です: ${item.name}`);
          }

          // バリデーションルール適用
          if (item.validation_rules && result.result_value) {
            // JSON形式のバリデーションルールを適用（実装詳細は要件による）
          }
        }
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const inspectionModel = new Inspection();
export default inspectionModel;