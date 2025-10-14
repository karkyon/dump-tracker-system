// =====================================
// backend/src/services/emailService.ts
// メール送信サービス - Phase 2完全統合版 (コンパイルエラー完全修正 v2)
// 既存完全実装の100%保持 + Phase 1完成基盤統合版
// 作成日時: 2025年9月27日19:00
// 最終更新: 2025年10月14日 - コンパイルエラー完全修正 v2
// =====================================

import { InspectionRecord, Operation, PrismaClient, User } from '@prisma/client';
import nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';

// 🎯 Phase 1完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  AppError
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 types/からの統一型定義インポート
import { getNotificationService } from '../types';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  OperationResult
} from '../types/common';

// 🎯 通知関連の型定義インポート
import type {
  NotificationType as ModelNotificationType
} from '../types/notification';

// =====================================
// 🔧 既存完全実装の100%保持 - 通知タイプ enum
// =====================================
export enum NotificationType {
  OPERATION_START = 'OPERATION_START',
  OPERATION_COMPLETE = 'OPERATION_COMPLETE',
  INSPECTION_ALERT = 'INSPECTION_ALERT',
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  REPORT_GENERATION_COMPLETE = 'REPORT_GENERATION_COMPLETE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION'
}

// =====================================
// 🔧 既存完全実装の100%保持 - インターフェース定義
// =====================================
interface EmailTemplate {
  type: NotificationType;
  subject: string;
  html: string;
}

interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
}

interface NotificationHistory {
  type: NotificationType;
  recipients: string[];
  subject: string;
  content: string;
  status: 'SENT' | 'FAILED';
  sentAt: Date;
  errorMessage?: string;
}

// 拡張型定義（既存完全実装保持）
interface OperationWithDetails extends Operation {
  driver: User;
  vehicle: any;
}

interface InspectionRecordWithDetails extends InspectionRecord {
  inspectionItem: any;
  operation: OperationWithDetails;
  inspector: User;
}

interface MaintenanceVehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  currentMileage: number;
}

interface MaintenanceRecord {
  id: string;
  maintenanceType: string;
  performedAt: Date;
  nextDue?: Date;
}

interface ReportData {
  id: string;
  title: string;
  completedAt: Date;
  mimeType: string;
  fileSize: number;
}

// =====================================
// 📧 EmailService クラス - Phase 2統合版
// =====================================
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly db: PrismaClient;
  private readonly notificationService: ReturnType<typeof getNotificationService>;

  constructor(db?: PrismaClient) {
    this.db = db || DatabaseService.getInstance();
    this.notificationService = getNotificationService(this.db);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  // =====================================
  // 📬 基本メール送信機能（既存完全実装保持）
  // =====================================

  /**
   * 基本メール送信機能
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    attachments?: EmailAttachment[]
  ): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@dump-truck-system.com',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        attachments
      };

      await this.transporter.sendMail(mailOptions);

      logger.info('メール送信完了', {
        to: mailOptions.to,
        subject,
        attachments: attachments?.length || 0
      });

    } catch (error) {
      logger.error('メール送信エラー', { error, to, subject });
      throw new AppError('メール送信に失敗しました', 500);
    }
  }

  /**
   * テンプレートメール送信
   */
  async sendTemplateEmail(
    template: EmailTemplate,
    to: string | string[],
    variables: Record<string, any>,
    attachments?: EmailAttachment[]
  ): Promise<void> {
    try {
      const subject = this.replaceVariables(template.subject, variables);
      const html = this.replaceVariables(template.html, variables);

      await this.sendEmail(to, subject, html, attachments);

      // 送信履歴を記録
      await this.saveNotificationHistory({
        type: template.type,
        recipients: Array.isArray(to) ? to : [to],
        subject,
        content: html,
        status: 'SENT',
        sentAt: new Date()
      });

      logger.info('テンプレートメール送信完了', {
        type: template.type,
        recipients: Array.isArray(to) ? to.length : 1
      });

    } catch (error) {
      // 送信失敗履歴を記録
      await this.saveNotificationHistory({
        type: template.type,
        recipients: Array.isArray(to) ? to : [to],
        subject: template.subject,
        content: template.html,
        status: 'FAILED',
        sentAt: new Date(),
        errorMessage: error instanceof Error ? error.message : '不明なエラー'
      });

      throw error;
    }
  }

  // =====================================
  // 📨 業務メール通知機能（既存完全実装保持）
  // =====================================

  /**
   * 運行開始通知メール
   */
  async sendOperationStartNotification(
    operation: OperationWithDetails,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.OPERATION_START,
      subject: '運行開始通知 - {{vehicleNumber}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
            🚛 運行開始通知
          </h2>

          <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #34495e; margin-top: 0;">運行情報</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 40%;">車両番号:</td>
                <td style="padding: 8px;">{{vehicleNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">ドライバー:</td>
                <td style="padding: 8px;">{{driverName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">開始予定時刻:</td>
                <td style="padding: 8px;">{{plannedStartTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">備考:</td>
                <td style="padding: 8px;">{{notes}}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top: 20px; padding: 15px; background-color: #d5f4e6; border-left: 4px solid #27ae60; border-radius: 4px;">
            <p style="margin: 0; color: #27ae60; font-weight: bold;">✓ 運行準備が完了しました</p>
            <p style="margin: 5px 0 0 0; color: #555;">安全運転でお願いします。</p>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 15px;">
            このメールは自動送信されています。
          </p>
        </div>
      `
    };

    // ✅ 修正: plannedStartTime の null チェックを追加
    const plannedStartTime = operation.plannedStartTime
      ? new Date(operation.plannedStartTime).toLocaleString('ja-JP')
      : '未設定';

    const variables = {
      vehicleNumber: operation.vehicle?.vehicleNumber || '不明',
      driverName: operation.driver?.name || '不明',
      plannedStartTime: plannedStartTime,
      notes: operation.notes || 'なし'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * 運行完了通知メール
   */
  async sendOperationCompleteNotification(
    operation: OperationWithDetails,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.OPERATION_COMPLETE,
      subject: '運行完了通知 - {{vehicleNumber}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #27ae60; padding-bottom: 10px;">
            ✅ 運行完了通知
          </h2>

          <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #34495e; margin-top: 0;">運行結果</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 40%;">車両番号:</td>
                <td style="padding: 8px;">{{vehicleNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">ドライバー:</td>
                <td style="padding: 8px;">{{driverName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">開始時刻:</td>
                <td style="padding: 8px;">{{actualStartTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">終了時刻:</td>
                <td style="padding: 8px;">{{actualEndTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">走行距離:</td>
                <td style="padding: 8px;">{{totalDistanceKm}} km</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">運行時間:</td>
                <td style="padding: 8px;">{{duration}}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top: 20px; padding: 15px; background-color: #d5f4e6; border-left: 4px solid #27ae60; border-radius: 4px;">
            <p style="margin: 0; color: #27ae60; font-weight: bold;">✓ 運行が正常に完了しました</p>
            <p style="margin: 5px 0 0 0; color: #555;">お疲れ様でした。</p>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 15px;">
            このメールは自動送信されています。
          </p>
        </div>
      `
    };

    const duration = operation.actualStartTime && operation.actualEndTime
      ? Math.round((new Date(operation.actualEndTime).getTime() - new Date(operation.actualStartTime).getTime()) / (1000 * 60))
      : 0;

    const variables = {
      vehicleNumber: operation.vehicle?.vehicleNumber || '不明',
      driverName: operation.driver?.name || '不明',
      actualStartTime: operation.actualStartTime
        ? new Date(operation.actualStartTime).toLocaleString('ja-JP')
        : '未記録',
      actualEndTime: operation.actualEndTime
        ? new Date(operation.actualEndTime).toLocaleString('ja-JP')
        : '未記録',
      totalDistanceKm: operation.totalDistanceKm?.toString() || '0.00', // ✅ 修正: totalDistance → totalDistanceKm
      duration: `${Math.floor(duration / 60)}時間${duration % 60}分`
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * 点検異常アラート通知メール
   */
  async sendInspectionAlertNotification(
    inspection: InspectionRecordWithDetails,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.INSPECTION_ALERT,
      subject: '【重要】点検異常アラート - {{vehicleNumber}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #c0392b; border-bottom: 3px solid #e74c3c; padding-bottom: 10px;">
            ⚠️ 点検異常アラート
          </h2>

          <div style="background-color: #fadbd8; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e74c3c;">
            <h3 style="color: #c0392b; margin-top: 0;">異常検知</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 40%;">車両番号:</td>
                <td style="padding: 8px;">{{vehicleNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">点検日時:</td>
                <td style="padding: 8px;">{{inspectionDate}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">点検項目:</td>
                <td style="padding: 8px;">{{inspectionItemName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">判定結果:</td>
                <td style="padding: 8px; color: #c0392b; font-weight: bold;">{{result}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">備考:</td>
                <td style="padding: 8px;">{{notes}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">点検者:</td>
                <td style="padding: 8px;">{{inspectorName}}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
            <p style="margin: 0; color: #856404; font-weight: bold;">⚠️ 早急な対応が必要です</p>
            <p style="margin: 5px 0 0 0; color: #555;">速やかに確認と対応をお願いします。</p>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 15px;">
            このメールは自動送信されています。
          </p>
        </div>
      `
    };

    // ✅ 修正: InspectionRecord の正しいプロパティを使用
    const inspectionDate = inspection.scheduledAt || inspection.completedAt || inspection.createdAt; // ✅ 修正: scheduledDate → scheduledAt, completedDate → completedAt
    const inspectionDateStr = inspectionDate ? new Date(inspectionDate).toLocaleString('ja-JP') : '未設定';

    const variables = {
      vehicleNumber: inspection.operation?.vehicle?.vehicleNumber || '不明',
      inspectionDate: inspectionDateStr,
      inspectionItemName: inspection.inspectionItem?.name || '不明',
      result: inspection.status || '不明',
      notes: inspection.overallNotes || '記載なし', // ✅ 修正: remarks → overallNotes
      inspectorName: inspection.inspector?.name || '不明'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * メンテナンス期限通知メール
   */
  async sendMaintenanceDueNotification(
    vehicle: MaintenanceVehicle,
    maintenance: MaintenanceRecord,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.MAINTENANCE_DUE,
      subject: 'メンテナンス期限通知 - {{vehicleNumber}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #f39c12; padding-bottom: 10px;">
            🔧 メンテナンス期限通知
          </h2>

          <div style="background-color: #fef5e7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f39c12;">
            <h3 style="color: #e67e22; margin-top: 0;">メンテナンス情報</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 40%;">車両番号:</td>
                <td style="padding: 8px;">{{vehicleNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">車両タイプ:</td>
                <td style="padding: 8px;">{{vehicleType}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">現在走行距離:</td>
                <td style="padding: 8px;">{{currentMileage}} km</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">メンテナンス種別:</td>
                <td style="padding: 8px;">{{maintenanceType}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">前回実施日:</td>
                <td style="padding: 8px;">{{performedAt}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">次回期限:</td>
                <td style="padding: 8px; color: #e67e22; font-weight: bold;">{{nextDue}}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #f39c12; border-radius: 4px;">
            <p style="margin: 0; color: #856404; font-weight: bold;">⚠️ メンテナンス期限が近づいています</p>
            <p style="margin: 5px 0 0 0; color: #555;">計画的なメンテナンスの実施をお願いします。</p>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 15px;">
            このメールは自動送信されています。
          </p>
        </div>
      `
    };

    const variables = {
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.vehicleType,
      currentMileage: vehicle.currentMileage.toLocaleString(),
      maintenanceType: maintenance.maintenanceType,
      performedAt: new Date(maintenance.performedAt).toLocaleDateString('ja-JP'),
      nextDue: maintenance.nextDue
        ? new Date(maintenance.nextDue).toLocaleDateString('ja-JP')
        : '未設定'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * レポート生成完了通知メール
   */
  async sendReportGenerationCompleteNotification(
    report: ReportData,
    recipients: string[],
    downloadUrl?: string
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.REPORT_GENERATION_COMPLETE,
      subject: 'レポート生成完了 - {{reportTitle}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #9b59b6; padding-bottom: 10px;">
            📊 レポート生成完了
          </h2>

          <div style="background-color: #f4ecf7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #8e44ad; margin-top: 0;">レポート情報</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 40%;">レポート名:</td>
                <td style="padding: 8px;">{{reportTitle}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">生成日時:</td>
                <td style="padding: 8px;">{{completedAt}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">ファイル形式:</td>
                <td style="padding: 8px;">{{format}}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">ファイルサイズ:</td>
                <td style="padding: 8px;">{{fileSize}}</td>
              </tr>
            </table>
          </div>

          ${downloadUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadUrl}"
               style="display: inline-block; background-color: #9b59b6; color: white;
                      padding: 12px 30px; text-decoration: none; border-radius: 5px;
                      font-weight: bold;">
              📥 レポートをダウンロード
            </a>
          </div>
          ` : ''}

          <div style="margin-top: 20px; padding: 15px; background-color: #d5f4e6; border-left: 4px solid #27ae60; border-radius: 4px;">
            <p style="margin: 0; color: #27ae60; font-weight: bold;">✓ レポートが正常に生成されました</p>
            <p style="margin: 5px 0 0 0; color: #555;">ダウンロードしてご確認ください。</p>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 15px;">
            このメールは自動送信されています。
          </p>
        </div>
      `
    };

    const variables = {
      reportTitle: report.title,
      completedAt: new Date(report.completedAt).toLocaleString('ja-JP'),
      format: this.getFormatDisplayName(report.mimeType),
      fileSize: this.formatFileSize(report.fileSize)
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * システム通知メール
   */
  async sendSystemNotification(
    title: string,
    message: string,
    recipients: string[],
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.SYSTEM_NOTIFICATION,
      subject: '【システム通知】{{title}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 3px solid {{priorityColor}}; padding-bottom: 10px;">
            🔔 システム通知
          </h2>

          <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #34495e; margin-top: 0;">{{title}}</h3>
            <div style="padding: 15px; background-color: white; border-radius: 5px; line-height: 1.6;">
              {{message}}
            </div>
          </div>

          <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-left: 4px solid #3498db; border-radius: 4px;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 5px; font-weight: bold; width: 30%;">優先度:</td>
                <td style="padding: 5px; color: {{priorityColor}}; font-weight: bold;">{{priorityLabel}}</td>
              </tr>
              <tr>
                <td style="padding: 5px; font-weight: bold;">通知日時:</td>
                <td style="padding: 5px;">{{timestamp}}</td>
              </tr>
            </table>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 15px;">
            このメールは自動送信されています。
          </p>
        </div>
      `
    };

    const priorityColors: Record<string, string> = {
      LOW: '#95a5a6',
      MEDIUM: '#3498db',
      HIGH: '#f39c12',
      CRITICAL: '#e74c3c'
    };

    const variables = {
      title,
      message,
      timestamp: new Date().toLocaleString('ja-JP'),
      priorityLabel: priority === 'LOW' ? '低' : priority === 'MEDIUM' ? '中' : priority === 'HIGH' ? '高' : '最高',
      priorityColor: priorityColors[priority]
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  // =====================================
  // 🛠️ ユーティリティメソッド群（既存完全実装保持）
  // =====================================

  private replaceVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  private mapNotificationType(type: NotificationType): ModelNotificationType {
    switch (type) {
      case NotificationType.OPERATION_START:
        return 'OPERATION_START' as ModelNotificationType;
      case NotificationType.OPERATION_COMPLETE:
        return 'OPERATION_END' as ModelNotificationType;
      case NotificationType.INSPECTION_ALERT:
        return 'INSPECTION_ABNORMAL' as ModelNotificationType;
      case NotificationType.MAINTENANCE_DUE:
        return 'MAINTENANCE_DUE' as ModelNotificationType;
      case NotificationType.REPORT_GENERATION_COMPLETE:
        return 'SYSTEM_NOTIFICATION' as ModelNotificationType;
      case NotificationType.SYSTEM_NOTIFICATION:
        return 'SYSTEM_NOTIFICATION' as ModelNotificationType;
      default:
        return 'SYSTEM_NOTIFICATION' as ModelNotificationType;
    }
  }

  private async saveNotificationHistory(history: NotificationHistory): Promise<void> {
    try {
      // Prisma の型定義では users が単一の User として定義されているため、
      const userConnect = history.recipients && history.recipients.length > 0
        ? { connect: { email: history.recipients[0] } }
        : undefined;

      await this.notificationService.create({
        id: randomUUID(),
        title: history.subject,
        message: history.content,
        type: this.mapNotificationType(history.type) as any,
        status: history.status as any,
        priority: 'MEDIUM',
        users: userConnect
      });
    } catch (error) {
      logger.error('通知履歴保存エラー', { error, history });
      // 履歴保存失敗は致命的エラーではないため、処理は継続
    }
  }

  private getFormatDisplayName(mimeType: string): string {
    const formats: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (xlsx)',
      'text/csv': 'CSV',
      'application/json': 'JSON'
    };
    return formats[mimeType] || '不明な形式';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * メール設定テスト
   */
  async testEmailConfiguration(): Promise<OperationResult<void>> {
    try {
      await this.transporter.verify();

      return {
        success: true,
        message: 'メール設定は正常です'
      };
    } catch (error) {
      logger.error('メール設定テストエラー', { error });

      return {
        success: false,
        message: 'メール設定に問題があります',
        errors: [{
          field: 'smtp',
          message: error instanceof Error ? error.message : '不明なエラー'
        }]
      };
    }
  }

  /**
   * サービスヘルスチェック
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date; details: any }> {
    try {
      const emailTest = await this.testEmailConfiguration();
      const notificationCount = await this.notificationService.count();

      return {
        status: emailTest.success ? 'healthy' : 'degraded',
        timestamp: new Date(),
        details: {
          emailConfiguration: emailTest.success ? 'working' : 'failed',
          smtpHost: process.env.SMTP_HOST || 'not configured',
          smtpPort: process.env.SMTP_PORT || 'not configured',
          totalNotifications: notificationCount,
          service: 'EmailService'
        }
      };
    } catch (error) {
      logger.error('EmailServiceヘルスチェックエラー', { error });
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : '不明なエラー'
        }
      };
    }
  }
}

// =====================================
// 🔄 シングルトンファクトリ
// =====================================

let _emailServiceInstance: EmailService | null = null;

export const getEmailServiceInstance = (db?: PrismaClient): EmailService => {
  if (!_emailServiceInstance) {
    _emailServiceInstance = new EmailService(db);
  }
  return _emailServiceInstance;
};

// =====================================
// 📤 エクスポート
// =====================================

export default EmailService;
