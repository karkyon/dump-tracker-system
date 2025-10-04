// =====================================
// backend/src/services/emailService.ts
// メール送信サービス - Phase 2完全統合版
// 既存完全実装の100%保持 + Phase 1完成基盤統合版
// 作成日時: 2025年9月27日19:00
// =====================================

import nodemailer from 'nodemailer';
import { PrismaClient, User, Operation, InspectionRecord } from '@prisma/client';

// 🎯 Phase 1完成基盤の活用
import { DatabaseService } from '../utils/database';
import { 
  AppError, 
  ValidationError, 
  NotFoundError,
  DatabaseError 
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 types/からの統一型定義インポート
import { getNotificationService } from '../types';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  ApiResponse,
  OperationResult
} from '../types/common';

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

      logger.error('テンプレートメール送信エラー', { error, template: template.type, to });
      throw error;
    }
  }

  // =====================================
  // 📧 運行関連通知（既存完全実装保持）
  // =====================================

  /**
   * 運行開始通知
   */
  async sendOperationStartNotification(
    operation: OperationWithDetails,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.OPERATION_START,
      subject: '運行開始通知 - {{operationNumber}}',
      html: `
        <html>
          <body>
            <h2 style="color: #4caf50;">運行開始のお知らせ</h2>
            <p>以下の運行が開始されました。</p>
            
            <table border="1" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <th style="padding: 8px; background-color: #e8f5e8;">項目</th>
                <th style="padding: 8px; background-color: #e8f5e8;">内容</th>
              </tr>
              <tr>
                <td style="padding: 8px;">運行番号</td>
                <td style="padding: 8px;"><strong>{{operationNumber}}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px;">車両</td>
                <td style="padding: 8px;">{{vehicleNumber}} ({{vehicleType}})</td>
              </tr>
              <tr>
                <td style="padding: 8px;">運転手</td>
                <td style="padding: 8px;">{{driverName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">開始時刻</td>
                <td style="padding: 8px;">{{startTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">予定終了時刻</td>
                <td style="padding: 8px;">{{endTime}}</td>
              </tr>
            </table>

            <p>安全運行をお祈りしております。</p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      operationNumber: operation.operationNumber,
      vehicleNumber: operation.vehicle.vehicleNumber,
      vehicleType: operation.vehicle.vehicleType,
      driverName: operation.driver.name,
      startTime: operation.actualStartTime?.toLocaleString('ja-JP') 
                || operation.plannedStartTime?.toLocaleString('ja-JP') 
                || '未設定',
      endTime: operation.plannedEndTime?.toLocaleString('ja-JP') 
                || operation.plannedStartTime?.toLocaleString('ja-JP') 
                || '未設定'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * 運行完了通知
   */
  async sendOperationCompleteNotification(
    operation: OperationWithDetails,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.OPERATION_COMPLETE,
      subject: '運行完了通知 - {{operationNumber}}',
      html: `
        <html>
          <body>
            <h2 style="color: #2196f3;">運行完了のお知らせ</h2>
            <p>以下の運行が完了しました。</p>
            
            <table border="1" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <th style="padding: 8px; background-color: #e3f2fd;">項目</th>
                <th style="padding: 8px; background-color: #e3f2fd;">内容</th>
              </tr>
              <tr>
                <td style="padding: 8px;">運行番号</td>
                <td style="padding: 8px;"><strong>{{operationNumber}}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px;">車両</td>
                <td style="padding: 8px;">{{vehicleNumber}} ({{vehicleType}})</td>
              </tr>
              <tr>
                <td style="padding: 8px;">運転手</td>
                <td style="padding: 8px;">{{driverName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">開始時刻</td>
                <td style="padding: 8px;">{{startTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">完了時刻</td>
                <td style="padding: 8px;">{{endTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">総距離</td>
                <td style="padding: 8px;">{{totalDistance}} km</td>
              </tr>
              <tr>
                <td style="padding: 8px;">燃料消費</td>
                <td style="padding: 8px;">{{fuelConsumption}} L</td>
              </tr>
            </table>

            <p>お疲れさまでした。</p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      operationNumber: operation.operationNumber,
      vehicleNumber: operation.vehicle.vehicleNumber,
      vehicleType: operation.vehicle.vehicleType,
      driverName: operation.driver.name,
      startTime: operation.actualStartTime?.toLocaleString('ja-JP') || operation.plannedStartTime.toLocaleString('ja-JP'),
      endTime: operation.actualEndTime?.toLocaleString('ja-JP') || '未完了',
      totalDistance: operation.totalDistanceKm ? operation.totalDistanceKm.toFixed(1) : '未計算',
      fuelConsumption: operation.fuelConsumedLiters ? operation.fuelConsumedLiters.toFixed(1) : '未記録'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  // =====================================
  // 🔍 点検・メンテナンス関連通知（既存完全実装保持）
  // =====================================

  /**
   * 点検アラート通知
   */
  async sendInspectionAlert(
    inspectionRecord: InspectionRecordWithDetails,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.INSPECTION_ALERT,
      subject: '【重要】点検異常通知 - {{vehicleNumber}}',
      html: `
        <html>
          <body>
            <h2 style="color: #f44336;">⚠️ 点検異常通知</h2>
            <p><strong style="color: #f44336;">緊急の注意が必要です。</strong></p>
            
            <table border="1" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <th style="padding: 8px; background-color: #ffebee;">項目</th>
                <th style="padding: 8px; background-color: #ffebee;">内容</th>
              </tr>
              <tr>
                <td style="padding: 8px;">点検日時</td>
                <td style="padding: 8px;">{{inspectionDate}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">車両</td>
                <td style="padding: 8px;">{{vehicleNumber}} ({{vehicleType}})</td>
              </tr>
              <tr>
                <td style="padding: 8px;">運転手</td>
                <td style="padding: 8px;">{{driverName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">点検者</td>
                <td style="padding: 8px;">{{inspectorName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">点検項目</td>
                <td style="padding: 8px;">{{inspectionItem}}</td>
              </tr>
              <tr style="background-color: #ffebee;">
                <td style="padding: 8px;"><strong>点検結果</strong></td>
                <td style="padding: 8px;"><strong style="color: #d32f2f;">{{result}}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px;">備考</td>
                <td style="padding: 8px;">{{notes}}</td>
              </tr>
            </table>

            <p style="color: #d32f2f;"><strong>※至急対応が必要です。車両の使用を中止し、整備担当者に連絡してください。</strong></p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      inspectionDate: inspectionRecord.inspectionDate.toLocaleString('ja-JP'),
      vehicleNumber: inspectionRecord.operation.vehicle.vehicleNumber,
      vehicleType: inspectionRecord.operation.vehicle.vehicleType,
      driverName: inspectionRecord.operation.driver.name,
      inspectorName: inspectionRecord.inspector.name,
      inspectionItem: inspectionRecord.inspectionItem.name,
      result: inspectionRecord.result,
      notes: inspectionRecord.notes || 'なし'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * メンテナンス期限通知
   */
  async sendMaintenanceDueNotification(
    vehicle: MaintenanceVehicle,
    maintenanceRecord: MaintenanceRecord,
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.MAINTENANCE_DUE,
      subject: 'メンテナンス期限通知 - {{vehicleNumber}}',
      html: `
        <html>
          <body>
            <h2 style="color: #ff9800;">メンテナンス期限通知</h2>
            <p>以下の車両のメンテナンス期限が近づいています。</p>
            
            <table border="1" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <th style="padding: 8px; background-color: #fff3e0;">項目</th>
                <th style="padding: 8px; background-color: #fff3e0;">内容</th>
              </tr>
              <tr>
                <td style="padding: 8px;">車両番号</td>
                <td style="padding: 8px;">{{vehicleNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">車両タイプ</td>
                <td style="padding: 8px;">{{vehicleType}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">現在の走行距離</td>
                <td style="padding: 8px;">{{currentMileage}} km</td>
              </tr>
              <tr>
                <td style="padding: 8px;">メンテナンス種類</td>
                <td style="padding: 8px;">{{maintenanceType}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">前回実施日</td>
                <td style="padding: 8px;">{{lastPerformed}}</td>
              </tr>
              <tr style="background-color: #fff3e0;">
                <td style="padding: 8px;"><strong>期限日</strong></td>
                <td style="padding: 8px;"><strong style="color: #f57c00;">{{dueDate}}</strong></td>
              </tr>
            </table>

            <p>速やかにメンテナンスの予約を取ってください。</p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.vehicleType,
      currentMileage: vehicle.currentMileage.toLocaleString(),
      maintenanceType: maintenanceRecord.maintenanceType,
      lastPerformed: maintenanceRecord.performedAt.toLocaleDateString('ja-JP'),
      dueDate: maintenanceRecord.nextDue?.toLocaleDateString('ja-JP') || '未設定'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  // =====================================
  // 📊 レポート・システム通知（既存完全実装保持）
  // =====================================

  /**
   * レポート生成完了通知
   */
  async sendReportGenerationComplete(
    report: ReportData,
    recipient: string
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.REPORT_GENERATION_COMPLETE,
      subject: '帳票生成完了通知 - {{reportTitle}}',
      html: `
        <html>
          <body>
            <h2 style="color: #4caf50;">帳票生成完了</h2>
            <p>ご依頼の帳票の生成が完了しました。</p>
            
            <table border="1" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <th style="padding: 8px; background-color: #f0f0f0;">項目</th>
                <th style="padding: 8px; background-color: #f0f0f0;">内容</th>
              </tr>
              <tr>
                <td style="padding: 8px;">帳票名</td>
                <td style="padding: 8px;">{{reportTitle}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">生成日時</td>
                <td style="padding: 8px;">{{generatedAt}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">ファイル形式</td>
                <td style="padding: 8px;">{{format}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">ファイルサイズ</td>
                <td style="padding: 8px;">{{fileSize}}</td>
              </tr>
            </table>

            <p>システムにログインして帳票をダウンロードしてください。</p>
            <p><a href="{{systemUrl}}/reports/{{reportId}}" style="background-color: #2196f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">帳票をダウンロード</a></p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      reportTitle: report.title,
      generatedAt: report.completedAt.toLocaleString('ja-JP'),
      format: this.getFormatDisplayName(report.mimeType),
      fileSize: this.formatFileSize(report.fileSize),
      systemUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      reportId: report.id
    };

    await this.sendTemplateEmail(template, [recipient], variables);
  }

  /**
   * システム通知
   */
  async sendSystemNotification(
    title: string,
    message: string,
    recipients: string[],
    priority: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): Promise<void> {
    const priorityColors = {
      LOW: '#4caf50',
      MEDIUM: '#ff9800',
      HIGH: '#f44336'
    };

    const template: EmailTemplate = {
      type: NotificationType.SYSTEM_NOTIFICATION,
      subject: `【${priority === 'HIGH' ? '重要' : priority === 'MEDIUM' ? '通知' : '情報'}】{{title}}`,
      html: `
        <html>
          <body>
            <h2 style="color: {{priorityColor}};">システム通知</h2>
            <div style="border-left: 4px solid {{priorityColor}}; padding-left: 16px; margin: 20px 0;">
              <h3>{{title}}</h3>
              <p>{{message}}</p>
            </div>
            
            <p><small>優先度: <strong style="color: {{priorityColor}};">{{priority}}</strong></small></p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      title,
      message,
      priority: priority === 'HIGH' ? '高' : priority === 'MEDIUM' ? '中' : '低',
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

  private async saveNotificationHistory(history: NotificationHistory): Promise<void> {
    try {
      await this.notificationService.create({
        type: history.type,
        title: history.subject,
        message: history.content,
        priority: 'MEDIUM',
        status: history.status === 'SENT' ? 'SENT' : 'FAILED',
        sentAt: history.sentAt,
        errorMessage: history.errorMessage
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
        error: error instanceof Error ? error.message : '不明なエラー'
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