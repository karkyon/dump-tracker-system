// backend/src/services/reportService.ts
import { PrismaClient, Prisma } from '@prisma/client';
import {
  GeneratedReport,
  ReportType,
  ReportFormat,
  ReportFilter,
  ReportStatus,
  PaginatedResponse,
  UserRole,
  DailyOperationReportParams,
  MonthlyOperationReportParams,
  VehicleUtilizationReportParams,
  DriverPerformanceReportParams,
  TransportationSummaryReportParams,
  InspectionSummaryReportParams,
  CustomReportParams
} from '../types';
import { AppError } from '../utils/asyncHandler';
import { generatePDF } from '../utils/generatePDF';
import { generateCSV } from '../utils/generateCSV';
import { generateExcel } from '../utils/generateExcel';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

export class ReportService {
  /**
   * 帳票一覧取得
   */
  async getReports(
    filter: ReportFilter,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<PaginatedResponse<GeneratedReport>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      reportType,
      status,
      startDate,
      endDate,
      createdById
    } = filter;

    const where: Prisma.GeneratedReportWhereInput = {};

    // フィルター条件
    if (reportType) where.reportType = reportType;
    if (status) where.status = status as ReportStatus;
    if (createdById) where.createdById = createdById;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // 運転手は自分が作成した帳票のみ取得可能
    if (requesterRole === UserRole.DRIVER) {
      where.createdById = requesterId;
    }

    // 総件数取得
    const totalItems = await prisma.generatedReport.count({ where });

    // ページネーション計算
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(totalItems / limit);

    // データ取得
    const reports = await prisma.generatedReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    return {
      data: reports,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit
      }
    };
  }

  /**
   * 帳票詳細取得
   */
  async getReportById(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<GeneratedReport> {
    const report = await prisma.generatedReport.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!report) {
      throw new AppError('帳票が見つかりません', 404);
    }

    // 運転手は自分が作成した帳票のみアクセス可能
    if (requesterRole === UserRole.DRIVER && report.createdById !== requesterId) {
      throw new AppError('この帳票にアクセスする権限がありません', 403);
    }

    return report;
  }

  /**
   * 日次運行報告書生成
   */
  async generateDailyOperationReport(params: DailyOperationReportParams): Promise<GeneratedReport> {
    const {
      targetDate,
      format,
      driverId,
      vehicleId,
      includeGpsData,
      includeInspections,
      requesterId,
      requesterRole
    } = params;

    // 権限チェック
    if (requesterRole === UserRole.DRIVER && driverId && driverId !== requesterId) {
      throw new AppError('他の運転手の報告書を生成する権限がありません', 403);
    }

    // データ取得
    const where: Prisma.OperationWhereInput = {
      operationDate: {
        gte: new Date(targetDate.toDateString()),
        lt: new Date(new Date(targetDate).getTime() + 24 * 60 * 60 * 1000)
      }
    };

    if (driverId) where.driverId = driverId;
    if (vehicleId) where.vehicleId = vehicleId;

    const operations = await prisma.operation.findMany({
      where,
      include: {
        driver: true,
        vehicle: true,
        trips: {
          include: {
            loadingLocation: true,
            unloadingLocation: true,
            item: true,
            gpsLogs: includeGpsData,
            fuelRecords: true
          }
        },
        gpsLogs: includeGpsData ? {
          orderBy: { timestamp: 'asc' }
        } : false,
        ...(includeInspections && {
          inspectionRecords: {
            include: {
              inspectionItem: true
            }
          }
        })
      }
    });

    // 帳票レコード作成
    const report = await prisma.generatedReport.create({
      data: {
        reportType: ReportType.DAILY_OPERATION,
        title: `日次運行報告書_${targetDate.toLocaleDateString('ja-JP')}`,
        parameters: JSON.stringify(params),
        status: ReportStatus.GENERATING,
        createdById: requesterId
      }
    });

    try {
      // 帳票データ準備
      const reportData = {
        title: `日次運行報告書`,
        targetDate: targetDate.toLocaleDateString('ja-JP'),
        operations,
        summary: {
          totalOperations: operations.length,
          completedOperations: operations.filter(op => op.status === 'COMPLETED').length,
          totalDistance: operations.reduce((sum, op) => sum + ((op.endMileage || 0) - op.startMileage), 0),
          totalTrips: operations.reduce((sum, op) => sum + op.trips.length, 0)
        },
        generatedAt: new Date(),
        generatedBy: requesterId
      };

      // ファイル生成
      let filePath: string;
      let fileName: string;
      let mimeType: string;

      switch (format) {
        case ReportFormat.PDF:
          fileName = `daily_operation_${targetDate.toISOString().split('T')[0]}.pdf`;
          filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);
          await generatePDF(reportData, filePath, 'daily-operation');
          mimeType = 'application/pdf';
          break;

        case ReportFormat.EXCEL:
          fileName = `daily_operation_${targetDate.toISOString().split('T')[0]}.xlsx`;
          filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);
          await generateExcel(reportData, filePath, 'daily-operation');
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;

        case ReportFormat.CSV:
          fileName = `daily_operation_${targetDate.toISOString().split('T')[0]}.csv`;
          filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);
          await generateCSV(reportData, filePath, 'daily-operation');
          mimeType = 'text/csv';
          break;

        default:
          throw new AppError('サポートされていない形式です', 400);
      }

      // 帳票レコード更新
      const updatedReport = await prisma.generatedReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.COMPLETED,
          filePath,
          fileName,
          mimeType,
          fileSize: (await fs.stat(filePath)).size,
          completedAt: new Date()
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              username: true
            }
          }
        }
      });

      return updatedReport;

    } catch (error) {
      // エラー時は失敗ステータスに更新
      await prisma.generatedReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : '不明なエラー'
        }
      });
      throw error;
    }
  }

  /**
   * 月次運行報告書生成
   */
  async generateMonthlyOperationReport(params: MonthlyOperationReportParams): Promise<GeneratedReport> {
    const {
      year,
      month,
      format,
      driverId,
      vehicleId,
      includeStatistics,
      requesterId,
      requesterRole
    } = params;

    // 権限チェック
    if (requesterRole === UserRole.DRIVER && driverId && driverId !== requesterId) {
      throw new AppError('他の運転手の報告書を生成する権限がありません', 403);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // データ取得
    const where: Prisma.OperationWhereInput = {
      operationDate: {
        gte: startDate,
        lte: endDate
      }
    };

    if (driverId) where.driverId = driverId;
    if (vehicleId) where.vehicleId = vehicleId;

    const operations = await prisma.operation.findMany({
      where,
      include: {
        driver: true,
        vehicle: true,
        trips: {
          include: {
            loadingLocation: true,
            unloadingLocation: true,
            item: true
          }
        }
      }
    });

    // 統計データ
    let statistics = {};
    if (includeStatistics) {
      statistics = {
        totalOperations: operations.length,
        completedOperations: operations.filter(op => op.status === 'COMPLETED').length,
        totalDistance: operations.reduce((sum, op) => sum + ((op.endMileage || 0) - op.startMileage), 0),
        averageDistance: operations.length > 0 ? 
          operations.reduce((sum, op) => sum + ((op.endMileage || 0) - op.startMileage), 0) / operations.length : 0,
        dailyStats: this.calculateDailyStats(operations, startDate, endDate),
        driverStats: this.calculateDriverStats(operations),
        vehicleStats: this.calculateVehicleStats(operations)
      };
    }

    // 帳票レコード作成
    const report = await prisma.generatedReport.create({
      data: {
        reportType: ReportType.MONTHLY_OPERATION,
        title: `月次運行報告書_${year}年${month}月`,
        parameters: JSON.stringify(params),
        status: ReportStatus.GENERATING,
        createdById: requesterId
      }
    });

    try {
      const reportData = {
        title: `月次運行報告書`,
        period: `${year}年${month}月`,
        operations,
        statistics,
        generatedAt: new Date(),
        generatedBy: requesterId
      };

      // ファイル生成
      const fileName = `monthly_operation_${year}_${month.toString().padStart(2, '0')}.${format.toLowerCase()}`;
      const filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);
      
      let mimeType: string;
      switch (format) {
        case ReportFormat.PDF:
          await generatePDF(reportData, filePath, 'monthly-operation');
          mimeType = 'application/pdf';
          break;
        case ReportFormat.EXCEL:
          await generateExcel(reportData, filePath, 'monthly-operation');
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case ReportFormat.CSV:
          await generateCSV(reportData, filePath, 'monthly-operation');
          mimeType = 'text/csv';
          break;
        default:
          throw new AppError('サポートされていない形式です', 400);
      }

      // 帳票レコード更新
      const updatedReport = await prisma.generatedReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.COMPLETED,
          filePath,
          fileName,
          mimeType,
          fileSize: (await fs.stat(filePath)).size,
          completedAt: new Date()
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              username: true
            }
          }
        }
      });

      return updatedReport;

    } catch (error) {
      await prisma.generatedReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : '不明なエラー'
        }
      });
      throw error;
    }
  }

  /**
   * 車両稼働報告書生成
   */
  async generateVehicleUtilizationReport(params: VehicleUtilizationReportParams): Promise<GeneratedReport> {
    // 管理者・マネージャーのみ生成可能
    if (!['ADMIN', 'MANAGER'].includes(params.requesterRole)) {
      throw new AppError('車両稼働報告書生成の権限がありません', 403);
    }

    const where: Prisma.OperationWhereInput = {
      operationDate: {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate)
      }
    };

    if (params.vehicleIds && params.vehicleIds.length > 0) {
      where.vehicleId = { in: params.vehicleIds };
    }

    const operations = await prisma.operation.findMany({
      where,
      include: {
        vehicle: {
          include: {
            maintenanceRecords: params.includeMaintenanceData ? {
              where: {
                performedAt: {
                  gte: new Date(params.startDate),
                  lte: new Date(params.endDate)
                }
              }
            } : false
          }
        },
        driver: true,
        trips: true
      }
    });

    // 車両別統計計算
    const vehicleStats = this.calculateVehicleUtilizationStats(operations);

    const report = await prisma.generatedReport.create({
      data: {
        reportType: ReportType.VEHICLE_UTILIZATION,
        title: `車両稼働報告書_${params.startDate}_${params.endDate}`,
        parameters: JSON.stringify(params),
        status: ReportStatus.GENERATING,
        createdById: params.requesterId
      }
    });

    try {
      const reportData = {
        title: '車両稼働報告書',
        period: `${params.startDate} ～ ${params.endDate}`,
        vehicleStats,
        operations,
        generatedAt: new Date(),
        generatedBy: params.requesterId
      };

      const fileName = `vehicle_utilization_${params.startDate}_${params.endDate}.${params.format.toLowerCase()}`;
      const filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);
      
      let mimeType: string;
      switch (params.format) {
        case ReportFormat.PDF:
          await generatePDF(reportData, filePath, 'vehicle-utilization');
          mimeType = 'application/pdf';
          break;
        case ReportFormat.EXCEL:
          await generateExcel(reportData, filePath, 'vehicle-utilization');
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case ReportFormat.CSV:
          await generateCSV(reportData, filePath, 'vehicle-utilization');
          mimeType = 'text/csv';
          break;
        default:
          throw new AppError('サポートされていない形式です', 400);
      }

      const updatedReport = await prisma.generatedReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.COMPLETED,
          filePath,
          fileName,
          mimeType,
          fileSize: (await fs.stat(filePath)).size,
          completedAt: new Date()
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              username: true
            }
          }
        }
      });

      return updatedReport;

    } catch (error) {
      await prisma.generatedReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : '不明なエラー'
        }
      });
      throw error;
    }
  }

  /**
   * 運転手実績報告書生成
   */
  async generateDriverPerformanceReport(params: DriverPerformanceReportParams): Promise<GeneratedReport> {
    // 実装は他の報告書と同様のパターン
    // ここでは基本構造のみ示す
    const report = await prisma.generatedReport.create({
      data: {
        reportType: ReportType.DRIVER_PERFORMANCE,
        title: `運転手実績報告書_${params.startDate}_${params.endDate}`,
        parameters: JSON.stringify(params),
        status: ReportStatus.GENERATING,
        createdById: params.requesterId
      }
    });

    // 実装...
    return report;
  }

  /**
   * 運送実績報告書生成
   */
  async generateTransportationSummaryReport(params: TransportationSummaryReportParams): Promise<GeneratedReport> {
    // 実装...
    const report = await prisma.generatedReport.create({
      data: {
        reportType: ReportType.TRANSPORTATION_SUMMARY,
        title: `運送実績報告書_${params.year}年${params.month}月`,
        parameters: JSON.stringify(params),
        status: ReportStatus.GENERATING,
        createdById: params.requesterId
      }
    });

    return report;
  }

  /**
   * 点検報告書生成
   */
  async generateInspectionSummaryReport(params: InspectionSummaryReportParams): Promise<GeneratedReport> {
    // 実装...
    const report = await prisma.generatedReport.create({
      data: {
        reportType: ReportType.INSPECTION_SUMMARY,
        title: `点検報告書_${params.startDate}_${params.endDate}`,
        parameters: JSON.stringify(params),
        status: ReportStatus.GENERATING,
        createdById: params.requesterId
      }
    });

    return report;
  }

  /**
   * カスタム帳票生成
   */
  async generateCustomReport(params: CustomReportParams): Promise<GeneratedReport> {
    // 実装...
    const report = await prisma.generatedReport.create({
      data: {
        reportType: ReportType.CUSTOM,
        title: params.title || 'カスタム帳票',
        parameters: JSON.stringify(params),
        status: ReportStatus.GENERATING,
        createdById: params.requesterId
      }
    });

    return report;
  }

  /**
   * 帳票ファイル取得
   */
  async getReportFile(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const report = await prisma.generatedReport.findUnique({
      where: { id }
    });

    if (!report) {
      throw new AppError('帳票が見つかりません', 404);
    }

    if (requesterRole === UserRole.DRIVER && report.createdById !== requesterId) {
      throw new AppError('この帳票にアクセスする権限がありません', 403);
    }

    if (report.status !== ReportStatus.COMPLETED) {
      throw new AppError('帳票が生成完了していません', 400);
    }

    if (!report.filePath || !report.fileName || !report.mimeType) {
      throw new AppError('帳票ファイルが見つかりません', 404);
    }

    return {
      filePath: report.filePath,
      fileName: report.fileName,
      mimeType: report.mimeType
    };
  }

  /**
   * 帳票プレビュー取得
   */
  async getReportPreview(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<any> {
    const report = await this.getReportById(id, requesterId, requesterRole);
    
    if (report.status !== ReportStatus.COMPLETED) {
      throw new AppError('帳票が生成完了していません', 400);
    }

    // プレビュー用データ生成（実装は帳票タイプによって異なる）
    const parameters = JSON.parse(report.parameters || '{}');
    
    return {
      title: report.title,
      type: report.reportType,
      parameters,
      createdAt: report.createdAt,
      fileSize: report.fileSize,
      format: report.mimeType
    };
  }

  /**
   * 帳票削除
   */
  async deleteReport(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<void> {
    const report = await this.getReportById(id, requesterId, requesterRole);

    // ファイル削除
    if (report.filePath) {
      try {
        await fs.unlink(report.filePath);
      } catch (error) {
        // ファイルが存在しない場合は無視
      }
    }

    // レコード削除
    await prisma.generatedReport.delete({
      where: { id }
    });
  }

  /**
   * 帳票生成状況確認
   */
  async getReportStatus(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<{ status: ReportStatus; progress?: number; message?: string }> {
    const report = await this.getReportById(id, requesterId, requesterRole);

    return {
      status: report.status,
      message: report.errorMessage || undefined
    };
  }

  /**
   * 帳票テンプレート一覧取得
   */
  async getReportTemplates(requesterRole: UserRole): Promise<any[]> {
    const templates = [
      {
        type: ReportType.DAILY_OPERATION,
        name: '日次運行報告書',
        description: '1日の運行記録をまとめた報告書',
        formats: [ReportFormat.PDF, ReportFormat.EXCEL, ReportFormat.CSV],
        requiredRole: 'DRIVER'
      },
      {
        type: ReportType.MONTHLY_OPERATION,
        name: '月次運行報告書',
        description: '1ヶ月の運行実績をまとめた報告書',
        formats: [ReportFormat.PDF, ReportFormat.EXCEL],
        requiredRole: 'DRIVER'
      },
      {
        type: ReportType.VEHICLE_UTILIZATION,
        name: '車両稼働報告書',
        description: '車両の稼働状況と効率性を分析した報告書',
        formats: [ReportFormat.PDF, ReportFormat.EXCEL],
        requiredRole: 'MANAGER'
      },
      {
        type: ReportType.DRIVER_PERFORMANCE,
        name: '運転手実績報告書',
        description: '運転手の運行実績と評価をまとめた報告書',
        formats: [ReportFormat.PDF, ReportFormat.EXCEL],
        requiredRole: 'MANAGER'
      }
    ];

    // 権限に応じてフィルタリング
    return templates.filter(template => {
      if (requesterRole === UserRole.ADMIN) return true;
      if (requesterRole === UserRole.MANAGER) return ['DRIVER', 'MANAGER'].includes(template.requiredRole);
      if (requesterRole === UserRole.DRIVER) return template.requiredRole === 'DRIVER';
      return false;
    });
  }

  // ヘルパーメソッド群

  private calculateDailyStats(operations: any[], startDate: Date, endDate: Date) {
    const dailyStats = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOperations = operations.filter(op => 
        op.operationDate.toDateString() === currentDate.toDateString()
      );

      dailyStats.push({
        date: new Date(currentDate),
        operationCount: dayOperations.length,
        completedCount: dayOperations.filter(op => op.status === 'COMPLETED').length,
        totalDistance: dayOperations.reduce((sum, op) => sum + ((op.endMileage || 0) - op.startMileage), 0)
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyStats;
  }

  private calculateDriverStats(operations: any[]) {
    const driverMap = new Map();

    operations.forEach(operation => {
      const driverId = operation.driver.id;
      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          driver: operation.driver,
          operationCount: 0,
          completedCount: 0,
          totalDistance: 0
        });
      }

      const stats = driverMap.get(driverId);
      stats.operationCount++;
      if (operation.status === 'COMPLETED') {
        stats.completedCount++;
        stats.totalDistance += (operation.endMileage || 0) - operation.startMileage;
      }
    });

    return Array.from(driverMap.values());
  }

  private calculateVehicleStats(operations: any[]) {
    const vehicleMap = new Map();

    operations.forEach(operation => {
      const vehicleId = operation.vehicle.id;
      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          vehicle: operation.vehicle,
          operationCount: 0,
          completedCount: 0,
          totalDistance: 0
        });
      }

      const stats = vehicleMap.get(vehicleId);
      stats.operationCount++;
      if (operation.status === 'COMPLETED') {
        stats.completedCount++;
        stats.totalDistance += (operation.endMileage || 0) - operation.startMileage;
      }
    });

    return Array.from(vehicleMap.values());
  }

  private calculateVehicleUtilizationStats(operations: any[]) {
    return this.calculateVehicleStats(operations);
  }
}