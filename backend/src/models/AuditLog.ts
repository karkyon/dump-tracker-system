// backend/src/models/AuditLog.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 監査ログモデル - Prismaスキーマ完全準拠版
 * システム操作の監査ログ管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  VIEW = 'VIEW'
}

export interface AuditLogModel {
  id: string;
  table_name: string;
  operation_type: OperationType;
  record_id?: string | null;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  old_values?: any | null; // JSON型
  new_values?: any | null; // JSON型
  created_at: Date;
}

export interface AuditLogCreateInput {
  table_name: string;
  operation_type: OperationType;
  record_id?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  old_values?: any;
  new_values?: any;
}

export interface AuditLogWhereInput {
  id?: string;
  table_name?: string | { contains?: string; mode?: 'insensitive' };
  operation_type?: OperationType | OperationType[];
  record_id?: string;
  user_id?: string;
  ip_address?: string;
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface AuditLogOrderByInput {
  id?: 'asc' | 'desc';
  table_name?: 'asc' | 'desc';
  operation_type?: 'asc' | 'desc';
  record_id?: 'asc' | 'desc';
  user_id?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface AuditLogResponseDTO {
  id: string;
  table_name: string;
  operation_type: OperationType;
  record_id?: string | null;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  old_values?: any | null;
  new_values?: any | null;
  created_at: Date;
  // リレーションデータ
  user?: {
    name: string;
    username: string;
    employee_id?: string;
  };
}

export interface AuditLogStats {
  total_logs: number;
  logs_today: number;
  logs_this_week: number;
  logs_this_month: number;
  operations_by_type: {
    [K in OperationType]: number;
  };
  most_active_users: UserActivitySummary[];
  most_accessed_tables: TableAccessSummary[];
  suspicious_activities: number;
  login_attempts_today: number;
  failed_operations: number;
}

export interface UserActivitySummary {
  user_id: string;
  user_name: string;
  username: string;
  operation_count: number;
  last_activity: Date;
  operations_by_type: {
    [K in OperationType]: number;
  };
  most_accessed_table: string;
  ip_addresses: string[];
}

export interface TableAccessSummary {
  table_name: string;
  access_count: number;
  unique_users: number;
  operations_by_type: {
    [K in OperationType]: number;
  };
  last_accessed: Date;
  most_active_user: string;
}

export interface SecurityAlert {
  type: 'MULTIPLE_LOGIN_ATTEMPTS' | 'UNUSUAL_IP' | 'BULK_DELETION' | 'SENSITIVE_DATA_ACCESS' | 'PRIVILEGE_ESCALATION';
  user_id?: string;
  user_name?: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  occurred_at: Date;
  details: any;
  ip_address?: string;
  affected_records?: number;
}

export interface DataChangeHistory {
  record_id: string;
  table_name: string;
  changes: ChangeRecord[];
  total_changes: number;
  first_created: Date;
  last_modified: Date;
  created_by?: string;
  last_modified_by?: string;
}

export interface ChangeRecord {
  id: string;
  operation_type: OperationType;
  field_changes: FieldChange[];
  changed_by: string;
  changed_by_name: string;
  changed_at: Date;
  ip_address?: string;
}

export interface FieldChange {
  field_name: string;
  old_value: any;
  new_value: any;
  change_type: 'ADDED' | 'MODIFIED' | 'REMOVED';
}

// =====================================
// 監査ログモデルクラス
// =====================================

export class AuditLog {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 監査ログ作成
   */
  async create(data: AuditLogCreateInput): Promise<AuditLogModel> {
    try {
      return await this.prisma.audit_logs.create({
        data: {
          ...data,
          created_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`監査ログ作成エラー: ${error}`);
    }
  }

  /**
   * 監査ログ取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<AuditLogModel | null> {
    try {
      return await this.prisma.audit_logs.findUnique({
        where: { id },
        include: includeRelations ? {
          users: true
        } : undefined
      });
    } catch (error) {
      throw new Error(`監査ログ取得エラー: ${error}`);
    }
  }

  /**
   * 監査ログ一覧取得
   */
  async findMany(params: {
    where?: AuditLogWhereInput;
    orderBy?: AuditLogOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      user?: boolean;
    };
  }): Promise<AuditLogModel[]> {
    try {
      return await this.prisma.audit_logs.findMany({
        where: params.where,
        orderBy: params.orderBy || { created_at: 'desc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          users: params.include.user
        } : undefined
      });
    } catch (error) {
      throw new Error(`監査ログ一覧取得エラー: ${error}`);
    }
  }

  /**
   * 監査ログ数カウント
   */
  async count(where?: AuditLogWhereInput): Promise<number> {
    try {
      return await this.prisma.audit_logs.count({ where });
    } catch (error) {
      throw new Error(`監査ログ数取得エラー: ${error}`);
    }
  }

  /**
   * 操作ログ記録（便利メソッド）
   */
  async logOperation(params: {
    table_name: string;
    operation_type: OperationType;
    record_id?: string;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    old_data?: any;
    new_data?: any;
  }): Promise<AuditLogModel> {
    try {
      return await this.create({
        table_name: params.table_name,
        operation_type: params.operation_type,
        record_id: params.record_id,
        user_id: params.user_id,
        ip_address: params.ip_address,
        user_agent: params.user_agent,
        old_values: params.old_data || null,
        new_values: params.new_data || null
      });
    } catch (error) {
      throw new Error(`操作ログ記録エラー: ${error}`);
    }
  }

  /**
   * ログイン記録
   */
  async logLogin(user_id: string, ip_address?: string, user_agent?: string): Promise<AuditLogModel> {
    try {
      return await this.create({
        table_name: 'users',
        operation_type: OperationType.LOGIN,
        record_id: user_id,
        user_id,
        ip_address,
        user_agent,
        new_values: { login_time: new Date() }
      });
    } catch (error) {
      throw new Error(`ログイン記録エラー: ${error}`);
    }
  }

  /**
   * ログアウト記録
   */
  async logLogout(user_id: string, ip_address?: string, user_agent?: string): Promise<AuditLogModel> {
    try {
      return await this.create({
        table_name: 'users',
        operation_type: OperationType.LOGOUT,
        record_id: user_id,
        user_id,
        ip_address,
        user_agent,
        new_values: { logout_time: new Date() }
      });
    } catch (error) {
      throw new Error(`ログアウト記録エラー: ${error}`);
    }
  }

  /**
   * ユーザーのアクティビティ履歴取得
   */
  async getUserActivity(user_id: string, limit: number = 50): Promise<AuditLogModel[]> {
    try {
      return await this.prisma.audit_logs.findMany({
        where: { user_id },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`ユーザーアクティビティ取得エラー: ${error}`);
    }
  }

  /**
   * テーブルの変更履歴取得
   */
  async getTableHistory(table_name: string, limit: number = 100): Promise<AuditLogModel[]> {
    try {
      return await this.prisma.audit_logs.findMany({
        where: { table_name },
        include: { users: true },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`テーブル履歴取得エラー: ${error}`);
    }
  }

  /**
   * レコードの変更履歴取得
   */
  async getRecordHistory(table_name: string, record_id: string): Promise<DataChangeHistory | null> {
    try {
      const logs = await this.prisma.audit_logs.findMany({
        where: {
          table_name,
          record_id
        },
        include: { users: true },
        orderBy: { created_at: 'asc' }
      });

      if (logs.length === 0) {
        return null;
      }

      const changes: ChangeRecord[] = logs.map(log => ({
        id: log.id,
        operation_type: log.operation_type,
        field_changes: this.extractFieldChanges(log.old_values, log.new_values),
        changed_by: log.user_id || 'system',
        changed_by_name: log.users?.name || 'システム',
        changed_at: log.created_at,
        ip_address: log.ip_address
      }));

      return {
        record_id,
        table_name,
        changes,
        total_changes: changes.length,
        first_created: logs[0].created_at,
        last_modified: logs[logs.length - 1].created_at,
        created_by: logs[0].user_id,
        last_modified_by: logs[logs.length - 1].user_id
      };
    } catch (error) {
      throw new Error(`レコード履歴取得エラー: ${error}`);
    }
  }

  /**
   * フィールド変更抽出
   */
  private extractFieldChanges(old_values: any, new_values: any): FieldChange[] {
    const changes: FieldChange[] = [];

    if (!old_values && new_values) {
      // 新規作成
      Object.keys(new_values).forEach(key => {
        changes.push({
          field_name: key,
          old_value: null,
          new_value: new_values[key],
          change_type: 'ADDED'
        });
      });
    } else if (old_values && new_values) {
      // 更新
      const all_keys = new Set([...Object.keys(old_values), ...Object.keys(new_values)]);
      
      all_keys.forEach(key => {
        const old_val = old_values[key];
        const new_val = new_values[key];

        if (old_val === undefined && new_val !== undefined) {
          changes.push({
            field_name: key,
            old_value: null,
            new_value: new_val,
            change_type: 'ADDED'
          });
        } else if (old_val !== undefined && new_val === undefined) {
          changes.push({
            field_name: key,
            old_value: old_val,
            new_value: null,
            change_type: 'REMOVED'
          });
        } else if (old_val !== new_val) {
          changes.push({
            field_name: key,
            old_value: old_val,
            new_value: new_val,
            change_type: 'MODIFIED'
          });
        }
      });
    }

    return changes;
  }

  /**
   * 監査ログ統計取得
   */
  async getStats(): Promise<AuditLogStats> {
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
        operations_by_type_result,
        user_activity_result,
        table_access_result,
        login_attempts_today,
        failed_operations
      ] = await Promise.all([
        this.prisma.audit_logs.count(),
        this.prisma.audit_logs.count({ where: { created_at: { gte: today } } }),
        this.prisma.audit_logs.count({ where: { created_at: { gte: week_ago } } }),
        this.prisma.audit_logs.count({ where: { created_at: { gte: month_ago } } }),
        this.prisma.audit_logs.groupBy({
          by: ['operation_type'],
          _count: { operation_type: true }
        }),
        this.getMostActiveUsers(5),
        this.getMostAccessedTables(5),
        this.prisma.audit_logs.count({
          where: {
            operation_type: OperationType.LOGIN,
            created_at: { gte: today }
          }
        }),
        this.prisma.audit_logs.count({
          where: {
            operation_type: OperationType.DELETE,
            created_at: { gte: week_ago }
          }
        })
      ]);

      const operations_by_type = Object.values(OperationType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as { [K in OperationType]: number });

      operations_by_type_result.forEach(result => {
        operations_by_type[result.operation_type as OperationType] = result._count.operation_type;
      });

      return {
        total_logs,
        logs_today,
        logs_this_week,
        logs_this_month,
        operations_by_type,
        most_active_users: user_activity_result,
        most_accessed_tables: table_access_result,
        suspicious_activities: 0, // 複雑な分析のため省略
        login_attempts_today,
        failed_operations
      };
    } catch (error) {
      throw new Error(`監査ログ統計取得エラー: ${error}`);
    }
  }

  /**
   * 最もアクティブなユーザー取得
   */
  async getMostActiveUsers(limit: number = 10): Promise<UserActivitySummary[]> {
    try {
      const user_activity = await this.prisma.$queryRaw`
        SELECT 
          al.user_id,
          u.name as user_name,
          u.username,
          COUNT(al.id) as operation_count,
          MAX(al.created_at) as last_activity,
          COUNT(DISTINCT al.ip_address) as ip_count,
          ARRAY_AGG(DISTINCT al.ip_address) as ip_addresses,
          MODE() WITHIN GROUP (ORDER BY al.table_name) as most_accessed_table
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.user_id IS NOT NULL
          AND al.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY al.user_id, u.name, u.username
        ORDER BY operation_count DESC
        LIMIT ${limit}
      ` as any[];

      const summaries: UserActivitySummary[] = [];

      for (const activity of user_activity) {
        const operations_by_type = await this.prisma.audit_logs.groupBy({
          by: ['operation_type'],
          where: {
            user_id: activity.user_id,
            created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          },
          _count: { operation_type: true }
        });

        const operations_type_count = Object.values(OperationType).reduce((acc, type) => {
          acc[type] = 0;
          return acc;
        }, {} as { [K in OperationType]: number });

        operations_by_type.forEach(result => {
          operations_type_count[result.operation_type as OperationType] = result._count.operation_type;
        });

        summaries.push({
          user_id: activity.user_id,
          user_name: activity.user_name || '',
          username: activity.username || '',
          operation_count: Number(activity.operation_count),
          last_activity: activity.last_activity,
          operations_by_type: operations_type_count,
          most_accessed_table: activity.most_accessed_table || '',
          ip_addresses: activity.ip_addresses || []
        });
      }

      return summaries;
    } catch (error) {
      throw new Error(`アクティブユーザー取得エラー: ${error}`);
    }
  }

  /**
   * 最もアクセスされたテーブル取得
   */
  async getMostAccessedTables(limit: number = 10): Promise<TableAccessSummary[]> {
    try {
      const table_access = await this.prisma.$queryRaw`
        SELECT 
          al.table_name,
          COUNT(al.id) as access_count,
          COUNT(DISTINCT al.user_id) as unique_users,
          MAX(al.created_at) as last_accessed,
          MODE() WITHIN GROUP (ORDER BY al.user_id) as most_active_user_id
        FROM audit_logs al
        WHERE al.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY al.table_name
        ORDER BY access_count DESC
        LIMIT ${limit}
      ` as any[];

      const summaries: TableAccessSummary[] = [];

      for (const access of table_access) {
        const operations_by_type = await this.prisma.audit_logs.groupBy({
          by: ['operation_type'],
          where: {
            table_name: access.table_name,
            created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          },
          _count: { operation_type: true }
        });

        const operations_type_count = Object.values(OperationType).reduce((acc, type) => {
          acc[type] = 0;
          return acc;
        }, {} as { [K in OperationType]: number });

        operations_by_type.forEach(result => {
          operations_type_count[result.operation_type as OperationType] = result._count.operation_type;
        });

        const most_active_user = await this.prisma.users.findUnique({
          where: { id: access.most_active_user_id }
        });

        summaries.push({
          table_name: access.table_name,
          access_count: Number(access.access_count),
          unique_users: Number(access.unique_users),
          operations_by_type: operations_type_count,
          last_accessed: access.last_accessed,
          most_active_user: most_active_user?.name || 'Unknown'
        });
      }

      return summaries;
    } catch (error) {
      throw new Error(`アクセステーブル取得エラー: ${error}`);
    }
  }

  /**
   * セキュリティアラート検出
   */
  async detectSecurityAlerts(): Promise<SecurityAlert[]> {
    try {
      const alerts: SecurityAlert[] = [];
      const now = new Date();
      const hour_ago = new Date(now.getTime() - 60 * 60 * 1000);

      // 複数ログイン試行検出
      const login_attempts = await this.prisma.$queryRaw`
        SELECT 
          user_id, 
          ip_address, 
          COUNT(*) as attempt_count,
          MAX(created_at) as last_attempt
        FROM audit_logs 
        WHERE operation_type = 'LOGIN' 
          AND created_at >= ${hour_ago}
        GROUP BY user_id, ip_address
        HAVING COUNT(*) > 5
      ` as any[];

      for (const attempt of login_attempts) {
        const user = await this.prisma.users.findUnique({
          where: { id: attempt.user_id }
        });

        alerts.push({
          type: 'MULTIPLE_LOGIN_ATTEMPTS',
          user_id: attempt.user_id,
          user_name: user?.name,
          description: `${attempt.attempt_count}回のログイン試行が検出されました`,
          severity: attempt.attempt_count > 10 ? 'CRITICAL' : 'HIGH',
          occurred_at: attempt.last_attempt,
          details: { attempt_count: Number(attempt.attempt_count) },
          ip_address: attempt.ip_address
        });
      }

      // 大量削除検出
      const bulk_deletions = await this.prisma.$queryRaw`
        SELECT 
          user_id, 
          table_name, 
          COUNT(*) as deletion_count,
          MAX(created_at) as last_deletion
        FROM audit_logs 
        WHERE operation_type = 'DELETE' 
          AND created_at >= ${hour_ago}
        GROUP BY user_id, table_name
        HAVING COUNT(*) > 10
      ` as any[];

      for (const deletion of bulk_deletions) {
        const user = await this.prisma.users.findUnique({
          where: { id: deletion.user_id }
        });

        alerts.push({
          type: 'BULK_DELETION',
          user_id: deletion.user_id,
          user_name: user?.name,
          description: `${deletion.table_name}テーブルで${deletion.deletion_count}件の削除が実行されました`,
          severity: deletion.deletion_count > 50 ? 'CRITICAL' : 'HIGH',
          occurred_at: deletion.last_deletion,
          details: { 
            table_name: deletion.table_name,
            deletion_count: Number(deletion.deletion_count) 
          },
          affected_records: Number(deletion.deletion_count)
        });
      }

      return alerts.sort((a, b) => {
        const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      throw new Error(`セキュリティアラート検出エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(log: any): AuditLogResponseDTO {
    return {
      id: log.id,
      table_name: log.table_name,
      operation_type: log.operation_type,
      record_id: log.record_id,
      user_id: log.user_id,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      old_values: log.old_values,
      new_values: log.new_values,
      created_at: log.created_at,
      user: log.users ? {
        name: log.users.name,
        username: log.users.username,
        employee_id: log.users.employee_id
      } : undefined
    };
  }

  /**
   * 古いログの削除（データ保持期間管理）
   */
  async deleteOldLogs(days_to_keep: number = 365): Promise<{ count: number }> {
    try {
      const cutoff_date = new Date(Date.now() - days_to_keep * 24 * 60 * 60 * 1000);
      
      return await this.prisma.audit_logs.deleteMany({
        where: {
          created_at: { lt: cutoff_date }
        }
      });
    } catch (error) {
      throw new Error(`古いログ削除エラー: ${error}`);
    }
  }

  /**
   * 監査ログ存在確認
   */
  async exists(where: { 
    id?: string; 
    table_name?: string;
    record_id?: string;
    user_id?: string;
  }): Promise<boolean> {
    try {
      const log = await this.prisma.audit_logs.findFirst({ where });
      return log !== null;
    } catch (error) {
      throw new Error(`監査ログ存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const auditLogModel = new AuditLog();
export default auditLogModel;