import nodemailer from 'nodemailer';
import { 
  UserModel,
  NotificationModel 
} from '../types';
import { emailConfig } from '../config/email';
import { PrismaClient, User } from '@prisma/client';
import { Operation } from '@prisma/client';
import { InspectionRecord } from '@prisma/client';
import { AppError } from '../utils/errors';

// 通知タイプ
export
enum NotificationType {
  OPERATION_START = 'OPERATION_START',
  OPERATION_COMPLETE = 'OPERATION_COMPLETE',
  INSPECTION_ALERT = 'INSPECTION_ALERT',
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  REPORT_GENERATION_COMPLETE = 'REPORT_GENERATION_COMPLETE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION'
}

interface EmailTemplate {
  type: NotificationType;
  subject: string;
  html: string;
}

const prisma = new PrismaClient();

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
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

  /**
   * メール送信（基本機能）
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    attachments?: Array<{
      filename: string;
      path?: string;
      content?: Buffer;
      contentType?: string;
    }>
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
    } catch (error) {
      console.error('メール送信エラー:', error);
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
    attachments?: Array<{
      filename: string;
      path?: string;
      content?: Buffer;
      contentType?: string;
    }>
  ): Promise<void> {
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
  }

  /**
   * 運行開始通知
   */
  async sendOperationStartNotification(
    operation: Operation & { driver: User; vehicle: any },
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.OPERATION_START,
      subject: '運行開始通知 - {{vehicleNumber}} ({{driverName}})',
      html: `
        <html>
          <body>
            <h2>運行開始通知</h2>
            <p>以下の運行が開始されました。</p>
            
            <table border="1" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <th style="padding: 8px; background-color: #f0f0f0;">項目</th>
                <th style="padding: 8px; background-color: #f0f0f0;">内容</th>
              </tr>
              <tr>
                <td style="padding: 8px;">運行日</td>
                <td style="padding: 8px;">{{operationDate}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">運転手</td>
                <td style="padding: 8px;">{{driverName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">車両</td>
                <td style="padding: 8px;">{{vehicleNumber}} ({{vehicleType}})</td>
              </tr>
              <tr>
                <td style="padding: 8px;">開始時刻</td>
                <td style="padding: 8px;">{{startTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">開始時走行距離</td>
                <td style="padding: 8px;">{{startMileage}} km</td>
              </tr>
            </table>

            <p>備考: {{notes}}</p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const startMileage = (operation as any).startMileage ?? 0;

    const variables = {
      operationDate: (operation.actualStartTime ?? operation.actualEndTime ?? operation.createdAt)?.toLocaleDateString('ja-JP') || '未設定',
      driverName: operation.driver.name,
      vehicleNumber: operation.vehicle.vehicleNumber,
      vehicleType: operation.vehicle.vehicleType,
      startTime: operation.actualStartTime?.toLocaleString('ja-JP') || '未設定',
      startMileage,
      notes: operation.notes || 'なし'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * 運行完了通知
   */
  async sendOperationCompleteNotification(
    operation: Operation & { driver: User; vehicle: any; endMileage?: number },
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.OPERATION_COMPLETE,
      subject: '運行完了通知 - {{vehicleNumber}} ({{driverName}})',
      html: `
        <html>
          <body>
            <h2>運行完了通知</h2>
            <p>以下の運行が完了しました。</p>
            
            <table border="1" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <th style="padding: 8px; background-color: #f0f0f0;">項目</th>
                <th style="padding: 8px; background-color: #f0f0f0;">内容</th>
              </tr>
              <tr>
                <td style="padding: 8px;">運行日</td>
                <td style="padding: 8px;">{{operationDate}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">運転手</td>
                <td style="padding: 8px;">{{driverName}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">車両</td>
                <td style="padding: 8px;">{{vehicleNumber}} ({{vehicleType}})</td>
              </tr>
              <tr>
                <td style="padding: 8px;">運行時間</td>
                <td style="padding: 8px;">{{startTime}} ～ {{endTime}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">走行距離</td>
                <td style="padding: 8px;">{{totalDistance}} km</td>
              </tr>
              <tr>
                <td style="padding: 8px;">走行距離（開始）</td>
                <td style="padding: 8px;">{{startMileage}} km</td>
              </tr>
              <tr>
                <td style="padding: 8px;">走行距離（終了）</td>
                <td style="padding: 8px;">{{endMileage}} km</td>
              </tr>
            </table>

            <p>備考: {{notes}}</p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    const startMileage = (operation as any).startMileage ?? 0;
    const endMileage = (operation as any).endMileage ?? 0;
    const totalDistance = endMileage - startMileage;

    const variables = {
      operationDate: (operation.actualStartTime ?? operation.actualEndTime ?? operation.createdAt)?.toLocaleDateString('ja-JP') || '未設定',
      driverName: operation.driver.name,
      vehicleNumber: operation.vehicle.vehicleNumber,
      vehicleType: operation.vehicle.vehicleType,
      startTime: operation.actualStartTime?.toLocaleString('ja-JP') || '未設定',
      endTime: operation.actualEndTime?.toLocaleString('ja-JP') || '未設定',
      startMileage,
      endMileage,
      totalDistance,
      notes: operation.notes || 'なし'
    };
      notes: operation.notes || 'なし'
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * 点検異常通知
   */
  async sendInspectionAlertNotification(
    inspectionRecord: InspectionRecord & { 
      inspectionItem: any; 
      operation: Operation & { driver: User; vehicle: any }; 
      inspector: User 
    },
    recipients: string[]
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.INSPECTION_ALERT,
      subject: '【緊急】点検異常発見 - {{vehicleNumber}} ({{inspectionItem}})',
      html: `
        <html>
          <body>
            <h2 style="color: #d32f2f;">【緊急】点検異常発見</h2>
            <p>車両点検で異常が発見されました。至急確認してください。</p>
            
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
    vehicle: any,
    maintenanceRecord: any,
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
                <td style="padding: 8px;">車両</td>
                <td style="padding: 8px;">{{vehicleNumber}} ({{vehicleType}})</td>
              </tr>
              <tr>
                <td style="padding: 8px;">メンテナンス種別</td>
                <td style="padding: 8px;">{{maintenanceType}}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">前回実施日</td>
                <td style="padding: 8px;">{{lastMaintenanceDate}}</td>
              </tr>
              <tr style="background-color: #fff3e0;">
                <td style="padding: 8px;"><strong>次回予定日</strong></td>
                <td style="padding: 8px;"><strong style="color: #ff9800;">{{nextDueDate}}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px;">現在走行距離</td>
                <td style="padding: 8px;">{{currentMileage}} km</td>
              </tr>
            </table>

            <p>メンテナンススケジュールを確認し、適切な時期に実施してください。</p>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.vehicleType,
      maintenanceType: maintenanceRecord.maintenanceType,
      lastMaintenanceDate: maintenanceRecord.performedAt.toLocaleDateString('ja-JP'),
      nextDueDate: maintenanceRecord.nextDue?.toLocaleDateString('ja-JP') || '未設定',
      currentMileage: vehicle.currentMileage
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * 帳票生成完了通知
   */
  async sendReportGenerationCompleteNotification(
    report: any,
    recipient: string
  ): Promise<void> {
    const template: EmailTemplate = {
      type: NotificationType.REPORT_GENERATION_COMPLETE,
      subject: '帳票生成完了通知 - {{reportTitle}}',
      html: `
        <html>
          <body>
            <h2>帳票生成完了通知</h2>
            <p>ご依頼いただいた帳票の生成が完了しました。</p>
            
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
      subject: `【${priority === 'HIGH' ? '重要' : priority === 'MEDIUM' ? '通知' : '情報'}】${title}`,
      html: `
        <html>
          <body>
            <h2 style="color: ${priorityColors[priority]};">${title}</h2>
            <div style="border-left: 4px solid ${priorityColors[priority]}; padding-left: 16px; margin: 20px 0;">
              <p>${message}</p>
            </div>
            
            <hr>
            <p><small>このメールは自動送信されています。</small></p>
          </body>
        </html>
      `
    };

    const variables = {
      title,
      message
    };

    await this.sendTemplateEmail(template, recipients, variables);
  }

  /**
   * 管理者向け通知取得
   */
  async getNotificationRecipients(type: NotificationType): Promise<string[]> {
    const adminUsers = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        isActive: true,
        NOT: { email: null }
      },
      select: { email: true }
    });

    return adminUsers.map(user => user.email).filter(Boolean);
  }

  /**
   * 通知履歴保存
   */
  private async saveNotificationHistory(notification: {
    type: NotificationType;
    recipients: string[];
    subject: string;
    content: string;
    status: 'SENT' | 'FAILED';
    sentAt: Date;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          notificationType: notification.type,
          recipients: notification.recipients,
          subject: notification.subject,
          content: notification.content,
          status: notification.status,
          sentAt: notification.sentAt,
          errorMessage: notification.errorMessage
        }
      });
    } catch (error) {
      console.error('通知履歴保存エラー:', error);
    }
  }

  /**
   * テンプレート変数置換
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  /**
   * ファイル形式表示名取得
   */
  private getFormatDisplayName(mimeType: string): string {
    const formats: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
      'text/csv': 'CSV'
    };
    return formats[mimeType] || mimeType;
  }

  /**
   * ファイルサイズフォーマット
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}