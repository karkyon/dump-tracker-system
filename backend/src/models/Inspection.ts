// backend/src/models/Inspection.ts
import { PrismaClient, InspectionType as PrismaInspectionType, InputType as PrismaInputType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 点検モデル
 * 点検項目と点検記録の管理
 */

export interface InspectionItemModel {
  id: string;
  name: string;
  inspectionType: PrismaInspectionType;
  inputType: PrismaInputType;
  description?: string;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
  category?: string;
  defaultValue?: string;
  validationRules?: string; // JSON形式
  helpText?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  unit?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionRecordModel {
  id: string;
  inspectionItemId: string;
  operationId?: string;
  tripId?: string;
  vehicleId: string;
  inspectorId: string;
  inspectionDate: Date;
  result: string; // 'OK', 'NG', 'WARNING', 'N/A', または具体的な値
  numericValue?: number;
  textValue?: string;
  notes?: string;
  photoUrls: string[];
  latitude?: number;
  longitude?: number;
  isAbnormal: boolean;
  requiresAction: boolean;
  actionTaken?: string;
  followUpRequired: boolean;
  followUpDate?: Date;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionItemCreateInput {
  name: string;
  inspectionType: PrismaInspectionType;
  inputType?: PrismaInputType;
  description?: string;
  displayOrder?: number;
  isRequired?: boolean;
  category?: string;
  defaultValue?: string;
  validationRules?: string;
  helpText?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  unit?: string;
}

export interface InspectionItemUpdateInput {
  name?: string;
  inspectionType?: PrismaInspectionType;
  inputType?: PrismaInputType;
  description?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
  category?: string;
  defaultValue?: string;
  validationRules?: string;
  helpText?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  unit?: string;
}

export interface InspectionRecordCreateInput {
  inspectionItemId: string;
  operationId?: string;
  tripId?: string;
  vehicleId: string;
  inspectorId: string;
  inspectionDate: Date;
  result: string;
  numericValue?: number;
  textValue?: string;
  notes?: string;
  photoUrls?: string[];
  latitude?: number;
  longitude?: number;
  isAbnormal?: boolean;
  requiresAction?: boolean;
  actionTaken?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
}

export interface InspectionRecordUpdateInput {
  result?: string;
  numericValue?: number;
  textValue?: string;
  notes?: string;
  photoUrls?: string[];
  isAbnormal?: boolean;
  requiresAction?: boolean;
  actionTaken?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface InspectionStats {
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  warningInspections: number;
  passRate: number;
  failRate: number;
  warningRate: number;
  averageInspectionTime: number; // 分
  pendingFollowUps: number;
}

export interface InspectionTrend {
  period: string;
  totalInspections: number;
  passRate: number;
  failRate: number;
  commonIssues: Array<{
    itemName: string;
    failureCount: number;
    percentage: number;
  }>;
}

export interface InspectionTemplate {
  inspectionType: PrismaInspectionType;
  items: InspectionItemModel[];
  estimatedDuration: number; // 分
  instructions?: string;
}

export interface InspectionSchedule {
  id: string;
  vehicleId: string;
  inspectionType: PrismaInspectionType;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  intervalDays?: number;
  intervalKm?: number;
  lastInspectionDate?: Date;
  nextDueDate: Date;
  isActive: boolean;
  reminderDays: number;
  createdAt: Date;
}

export interface InspectionAlert {
  id: string;
  vehicleId: string;
  inspectionItemId: string;
  alertType: 'OVERDUE' | 'WARNING' | 'CRITICAL' | 'FOLLOW_UP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  dueDate?: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface InspectionQualityMetrics {
  inspectorId: string;
  inspectorName: string;
  totalInspections: number;
  averageInspectionTime: number;
  accuracyRate: number; // 再検査での一致率
  thoroughnessScore: number; // 発見された問題の網羅性
  consistencyScore: number; // 同じ状況での判定の一貫性
  timeliness: number; // 予定時刻からの遅延度
}

export interface InspectionDefectAnalysis {
  itemId: string;
  itemName: string;
  totalInspections: number;
  defectCount: number;
  defectRate: number;
  criticalDefects: number;
  averageRepairCost: number;
  averageDowntime: number; // 時間
  trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING';
  commonCauses: string[];
  preventiveMeasures: string[];
}

/**
 * 点検モデルクラス
 */
export class Inspection {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  // ===== 点検項目管理 =====

  /**
   * 点検項目作成
   */
  async createItem(data: InspectionItemCreateInput): Promise<InspectionItemModel> {
    // 表示順序が指定されていない場合は最後に追加
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const lastItem = await this.prisma.inspectionItem.findFirst({
        where: { inspectionType: data.inspectionType },
        orderBy: { displayOrder: 'desc' }
      });
      displayOrder = (lastItem?.displayOrder || 0) + 10;
    }

    return await this.prisma.inspectionItem.create({
      data: {
        ...data,
        inputType: data.inputType || PrismaInputType.CHECKBOX,
        displayOrder,
        isRequired: data.isRequired || false
      }
    });
  }

  /**
   * 点検項目取得
   */
  async findItemUnique(where: { id: string }): Promise<InspectionItemModel | null> {
    return await this.prisma.inspectionItem.findUnique({ where });
  }

  /**
   * 点検項目一覧取得
   */
  async findItems(params: {
    where?: {
      inspectionType?: PrismaInspectionType;
      isActive?: boolean;
      category?: string;
    };
    orderBy?: { displayOrder?: 'asc' | 'desc' };
  }): Promise<InspectionItemModel[]> {
    return await this.prisma.inspectionItem.findMany(params);
  }

  /**
   * 点検項目更新
   */
  async updateItem(where: { id: string }, data: InspectionItemUpdateInput): Promise<InspectionItemModel> {
    return await this.prisma.inspectionItem.update({ where, data });
  }

  /**
   * 点検項目削除（論理削除）
   */
  async softDeleteItem(id: string): Promise<InspectionItemModel> {
    return await this.prisma.inspectionItem.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * 点検テンプレート取得
   */
  async getInspectionTemplate(inspectionType: PrismaInspectionType): Promise<InspectionTemplate> {
    const items = await this.prisma.inspectionItem.findMany({
      where: {
        inspectionType,
        isActive: true
      },
      orderBy: { displayOrder: 'asc' }
    });

    // 推定所要時間を計算（項目数に基づく簡易計算）
    const estimatedDuration = items.length * 2; // 1項目あたり2分の想定

    return {
      inspectionType,
      items,
      estimatedDuration,
      instructions: this.getInspectionInstructions(inspectionType)
    };
  }

  // ===== 点検記録管理 =====

  /**
   * 点検記録作成
   */
  async createRecord(data: InspectionRecordCreateInput): Promise<InspectionRecordModel> {
    return await this.prisma.inspectionRecord.create({
      data: {
        ...data,
        photoUrls: data.photoUrls || [],
        isAbnormal: data.isAbnormal || false,
        requiresAction: data.requiresAction || false,
        followUpRequired: data.followUpRequired || false
      }
    });
  }

  /**
   * 点検記録取得
   */
  async findRecordUnique(where: { id: string }): Promise<InspectionRecordModel | null> {
    return await this.prisma.inspectionRecord.findUnique({ where });
  }

  /**
   * 点検記録一覧取得
   */
  async findRecords(params: {
    where?: {
      operationId?: string;
      vehicleId?: string;
      inspectorId?: string;
      inspectionDate?: { gte?: Date; lte?: Date };
      isAbnormal?: boolean;
      requiresAction?: boolean;
    };
    orderBy?: { inspectionDate?: 'asc' | 'desc' };
    skip?: number;
    take?: number;
  }): Promise<InspectionRecordModel[]> {
    return await this.prisma.inspectionRecord.findMany(params);
  }

  /**
   * 点検記録更新
   */
  async updateRecord(where: { id: string }, data: InspectionRecordUpdateInput): Promise<InspectionRecordModel> {
    return await this.prisma.inspectionRecord.update({ where, data });
  }

  /**
   * 運行別点検記録取得
   */
  async getRecordsByOperation(operationId: string): Promise<InspectionRecordModel[]> {
    return await this.prisma.inspectionRecord.findMany({
      where: { operationId },
      include: {
        inspectionItem: true
      },
      orderBy: [
        { inspectionItem: { inspectionType: 'asc' } },
        { inspectionItem: { displayOrder: 'asc' } }
      ]
    });
  }

  /**
   * 車両別点検記録取得
   */
  async getRecordsByVehicle(
    vehicleId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<InspectionRecordModel[]> {
    const where: any = { vehicleId };
    
    if (startDate || endDate) {
      where.inspectionDate = {};
      if (startDate) where.inspectionDate.gte = startDate;
      if (endDate) where.inspectionDate.lte = endDate;
    }

    return await this.prisma.inspectionRecord.findMany({
      where,
      include: {
        inspectionItem: true,
        inspector: { select: { name: true } }
      },
      orderBy: { inspectionDate: 'desc' }
    });
  }

  // ===== 統計・分析 =====

  /**
   * 点検統計取得
   */
  async getInspectionStats(params: {
    startDate?: Date;
    endDate?: Date;
    vehicleId?: string;
    inspectorId?: string;
  }): Promise<InspectionStats> {
    const where: any = {};
    
    if (params.startDate || params.endDate) {
      where.inspectionDate = {};
      if (params.startDate) where.inspectionDate.gte = params.startDate;
      if (params.endDate) where.inspectionDate.lte = params.endDate;
    }
    
    if (params.vehicleId) where.vehicleId = params.vehicleId;
    if (params.inspectorId) where.inspectorId = params.inspectorId;

    const records = await this.prisma.inspectionRecord.findMany({ where });

    const total = records.length;
    const passed = records.filter(r => r.result === 'OK').length;
    const failed = records.filter(r => r.result === 'NG').length;
    const warning = records.filter(r => r.result === 'WARNING').length;
    const pendingFollowUps = records.filter(r => r.followUpRequired && !r.verifiedAt).length;

    return {
      totalInspections: total,
      passedInspections: passed,
      failedInspections: failed,
      warningInspections: warning,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      failRate: total > 0 ? (failed / total) * 100 : 0,
      warningRate: total > 0 ? (warning / total) * 100 : 0,
      averageInspectionTime: 0, // 別途計算が必要
      pendingFollowUps
    };
  }

  /**
   * 点検トレンド分析
   */
  async getInspectionTrends(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'month'
  ): Promise<InspectionTrend[]> {
    const records = await this.prisma.inspectionRecord.findMany({
      where: {
        inspectionDate: { gte: startDate, lte: endDate }
      },
      include: { inspectionItem: true }
    });

    const groupedData = new Map<string, InspectionRecordModel[]>();

    records.forEach(record => {
      let periodKey: string;
      const date = record.inspectionDate;

      switch (groupBy) {
        case 'day':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!groupedData.has(periodKey)) {
        groupedData.set(periodKey, []);
      }
      groupedData.get(periodKey)!.push(record);
    });

    const trends: InspectionTrend[] = [];

    for (const [period, periodRecords] of groupedData.entries()) {
      const total = periodRecords.length;
      const passed = periodRecords.filter(r => r.result === 'OK').length;
      const failed = periodRecords.filter(r => r.result === 'NG').length;

      // 共通問題の分析
      const failureItems = new Map<string, number>();
      periodRecords
        .filter(r => r.result === 'NG')
        .forEach(r => {
          const itemName = (r as any).inspectionItem.name;
          failureItems.set(itemName, (failureItems.get(itemName) || 0) + 1);
        });

      const commonIssues = Array.from(failureItems.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([itemName, count]) => ({
          itemName,
          failureCount: count,
          percentage: total > 0 ? (count / total) * 100 : 0
        }));

      trends.push({
        period,
        totalInspections: total,
        passRate: total > 0 ? (passed / total) * 100 : 0,
        failRate: total > 0 ? (failed / total) * 100 : 0,
        commonIssues
      });
    }

    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * 不具合分析
   */
  async analyzeDefects(itemId?: string): Promise<InspectionDefectAnalysis[]> {
    const where: any = { result: 'NG' };
    if (itemId) where.inspectionItemId = itemId;

    const records = await this.prisma.inspectionRecord.findMany({
      where,
      include: { inspectionItem: true }
    });

    const itemGroups = new Map<string, { item: any; records: InspectionRecordModel[] }>();

    records.forEach(record => {
      const item = (record as any).inspectionItem;
      if (!itemGroups.has(item.id)) {
        itemGroups.set(item.id, { item, records: [] });
      }
      itemGroups.get(item.id)!.records.push(record);
    });

    const analyses: InspectionDefectAnalysis[] = [];

    for (const [itemId, { item, records: defectRecords }] of itemGroups.entries()) {
      // 全体の点検回数を取得
      const totalInspections = await this.prisma.inspectionRecord.count({
        where: { inspectionItemId: itemId }
      });

      const defectCount = defectRecords.length;
      const defectRate = totalInspections > 0 ? (defectCount / totalInspections) * 100 : 0;
      const criticalDefects = defectRecords.filter(r => r.result === 'CRITICAL').length;

      // 共通原因の分析（notes から抽出）
      const commonCauses = this.extractCommonCauses(defectRecords.map(r => r.notes).filter(Boolean));

      // トレンド分析（簡易版）
      const recentDefects = defectRecords.filter(r => 
        r.inspectionDate >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 過去90日
      ).length;
      const olderDefects = defectRecords.filter(r => 
        r.inspectionDate < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      ).length;

      let trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING' = 'STABLE';
      if (recentDefects > olderDefects * 1.2) {
        trendDirection = 'WORSENING';
      } else if (recentDefects < olderDefects * 0.8) {
        trendDirection = 'IMPROVING';
      }

      analyses.push({
        itemId,
        itemName: item.name,
        totalInspections,
        defectCount,
        defectRate,
        criticalDefects,
        averageRepairCost: 0, // 別途計算が必要
        averageDowntime: 0, // 別途計算が必要
        trendDirection,
        commonCauses,
        preventiveMeasures: this.generatePreventiveMeasures(item.name, commonCauses)
      });
    }

    return analyses.sort((a, b) => b.defectRate - a.defectRate);
  }

  /**
   * 点検品質指標取得
   */
  async getQualityMetrics(inspectorId?: string): Promise<InspectionQualityMetrics[]> {
    const where: any = {};
    if (inspectorId) where.inspectorId = inspectorId;

    const records = await this.prisma.inspectionRecord.findMany({
      where,
      include: { inspector: true }
    });

    const inspectorGroups = new Map<string, { inspector: any; records: InspectionRecordModel[] }>();

    records.forEach(record => {
      const inspector = (record as any).inspector;
      if (!inspectorGroups.has(inspector.id)) {
        inspectorGroups.set(inspector.id, { inspector, records: [] });
      }
      inspectorGroups.get(inspector.id)!.records.push(record);
    });

    const metrics: InspectionQualityMetrics[] = [];

    for (const [inspectorId, { inspector, records: inspectorRecords }] of inspectorGroups.entries()) {
      const totalInspections = inspectorRecords.length;
      
      // 各種指標を計算（簡易版）
      const averageInspectionTime = this.calculateAverageInspectionTime(inspectorRecords);
      const accuracyRate = this.calculateAccuracyRate(inspectorRecords);
      const thoroughnessScore = this.calculateThoroughnessScore(inspectorRecords);
      const consistencyScore = this.calculateConsistencyScore(inspectorRecords);
      const timeliness = this.calculateTimeliness(inspectorRecords);

      metrics.push({
        inspectorId,
        inspectorName: inspector.name,
        totalInspections,
        averageInspectionTime,
        accuracyRate,
        thoroughnessScore,
        consistencyScore,
        timeliness
      });
    }

    return metrics.sort((a, b) => b.accuracyRate - a.accuracyRate);
  }

  // ===== ヘルパーメソッド =====

  private getInspectionInstructions(inspectionType: PrismaInspectionType): string {
    const instructions = {
      PRE_TRIP: '運行前の安全確認を実施してください。すべての項目を確認し、異常がある場合は運行を中止してください。',
      POST_TRIP: '運行後の車両状態を確認してください。異常や損傷がある場合は報告してください。'
    };
    return instructions[inspectionType] || '';
  }

  private extractCommonCauses(notes: string[]): string[] {
    // 簡易的なキーワード抽出
    const keywords = ['磨耗', '劣化', '破損', '漏れ', '異音', '振動', '汚れ'];
    const found = new Set<string>();
    
    notes.forEach(note => {
      keywords.forEach(keyword => {
        if (note.includes(keyword)) {
          found.add(keyword);
        }
      });
    });
    
    return Array.from(found);
  }

  private generatePreventiveMeasures(itemName: string, commonCauses: string[]): string[] {
    // 簡易的な予防策生成
    const measures = [];
    
    if (commonCauses.includes('磨耗')) {
      measures.push('定期的な部品交換の実施');
    }
    if (commonCauses.includes('汚れ')) {
      measures.push('清掃頻度の見直し');
    }
    if (commonCauses.includes('異音')) {
      measures.push('潤滑油の定期交換');
    }
    
    measures.push('作業手順の見直し');
    measures.push('作業者への再教育');
    
    return measures;
  }

  private calculateAverageInspectionTime(records: InspectionRecordModel[]): number {
    // 実際の実装では点検開始・終了時刻から計算
    return 15; // 仮の値（分）
  }

  private calculateAccuracyRate(records: InspectionRecordModel[]): number {
    // 実際の実装では再検査との一致率を計算
    return 95; // 仮の値（%）
  }

  private calculateThoroughnessScore(records: InspectionRecordModel[]): number {
    // 実際の実装では発見された問題の網羅性を評価
    return 90; // 仮の値（%）
  }

  private calculateConsistencyScore(records: InspectionRecordModel[]): number {
    // 実際の実装では同じ状況での判定の一貫性を評価
    return 88; // 仮の値（%）
  }

  private calculateTimeliness(records: InspectionRecordModel[]): number {
    // 実際の実装では予定時刻からの遅延度を計算
    return 92; // 仮の値（%）
  }
}