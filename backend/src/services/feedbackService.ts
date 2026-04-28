// backend/src/services/feedbackService.ts
// フィードバック管理サービス
// Firebase Firestore読取・ステータス更新・Backlog連携

import logger from '../utils/logger';
import { getFirestore as getFirestoreAsync, getStorage as getStorageAsync } from '../lib/firebase-admin';
import * as admin from 'firebase-admin';

// =============================================
// 型定義
// =============================================

export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'wontfix';
export type FeedbackApp = 'mobile' | 'cms';

export interface FeedbackDocument {
  id: string;
  app: FeedbackApp;
  name?: string | null;
  reportType: string;
  screen: string;
  operation?: string | null;
  frequency?: string | null;
  what: string;
  expected?: string | null;
  steps?: string | null;
  severity: number;
  device?: string | null;
  extra?: string | null;
  photoPaths?: string[];
  createdAt: Date;
  status: FeedbackStatus;
  adminNotes?: string | null;
  adminNotesUpdatedAt?: Date | null;
  adminNotesUpdatedBy?: string | null;
  backlogIssueId?: string | null;
  backlogIssueKey?: string | null;
  backlogLinkedAt?: Date | null;
  backlogLinkedBy?: string | null;
  statusHistory?: StatusHistory[];
}

export interface StatusHistory {
  from: string;
  to: string;
  changedAt: Date;
  changedBy: string;
}

export interface FeedbackFilter {
  app?: FeedbackApp;
  reportType?: string;
  severity?: number;
  status?: FeedbackStatus;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'severity';
  sortOrder?: 'asc' | 'desc';
}

export interface FeedbackStats {
  total: number;
  new: number;
  in_progress: number;
  resolved: number;
  wontfix: number;
}

// =============================================
// Backlog プロジェクト固有定数
// DUMPTRACKER2026 プロジェクト
// =============================================

// issueType ID（curl で確認済み）
const BACKLOG_ISSUE_TYPE_IDS = {
  BUG:     4127519,  // バグ（赤）
  TASK:    4127520,  // タスク（青）
  REQUEST: 4127521,  // 要望（水色）
  OTHER:   4127522,  // その他（オレンジ）
} as const;

// フィードバック種別 → Backlog issueType マッピング
const REPORT_TYPE_TO_ISSUE_TYPE: Record<string, number> = {
  bug:     BACKLOG_ISSUE_TYPE_IDS.BUG,      // 🐛 バグ・不具合 → バグ
  odd:     BACKLOG_ISSUE_TYPE_IDS.BUG,      // ⚠️ 動作おかしい → バグ
  data:    BACKLOG_ISSUE_TYPE_IDS.BUG,      // 📊 データ誤り  → バグ
  improve: BACKLOG_ISSUE_TYPE_IDS.REQUEST,  // 💡 改善要望   → 要望
  feature: BACKLOG_ISSUE_TYPE_IDS.REQUEST,  // ✨ 新機能提案 → 要望
  good:    BACKLOG_ISSUE_TYPE_IDS.OTHER,    // 👍 良かった点 → その他
};

// Backlog 標準優先度 ID
// 2=高, 3=中, 4=低
const SEVERITY_TO_PRIORITY: Record<number, number> = {
  0: 2,  // 🔴 業務停止 → 高
  1: 2,  // 🟠 業務支障 → 高
  2: 3,  // 🟡 不便     → 中
  3: 4,  // 🟢 軽微     → 低
};

// ラベル定数
const REPORT_TYPE_LABELS: Record<string, string> = {
  bug:     'バグ・不具合',
  odd:     '動作がおかしい',
  improve: '改善要望',
  feature: '新機能提案',
  data:    'データの誤り',
  good:    '良かった点',
};

const SEVERITY_LABELS: Record<number, string> = {
  0: '🔴 業務停止',
  1: '🟠 業務に支障',
  2: '🟡 不便',
  3: '🟢 軽微・提案',
};

// =============================================
// FeedbackService クラス
// =============================================

export class FeedbackService {
  private readonly COLLECTIONS = ['feedback_mobile', 'feedback_cms'] as const;

  private docToFeedback(id: string, data: admin.firestore.DocumentData, app: FeedbackApp): FeedbackDocument {
    return {
      id,
      app,
      name: data['name'] || null,
      reportType: String(data['reportType'] || ''),
      screen: String(data['screen'] || ''),
      operation: data['operation'] || null,
      frequency: data['frequency'] || null,
      what: String(data['what'] || ''),
      expected: data['expected'] || null,
      steps: data['steps'] || null,
      severity: Number(data['severity'] ?? 3),
      device: data['device'] || null,
      extra: data['extra'] || null,
      photoPaths: Array.isArray(data['photoPaths']) ? data['photoPaths'] : [],
      createdAt: data['createdAt']?.toDate?.() || new Date(),
      status: (data['status'] as FeedbackStatus) || 'new',
      adminNotes: data['adminNotes'] || null,
      adminNotesUpdatedAt: data['adminNotesUpdatedAt']?.toDate?.() || null,
      adminNotesUpdatedBy: data['adminNotesUpdatedBy'] || null,
      backlogIssueId: data['backlogIssueId'] || null,
      backlogIssueKey: data['backlogIssueKey'] || null,
      backlogLinkedAt: data['backlogLinkedAt']?.toDate?.() || null,
      backlogLinkedBy: data['backlogLinkedBy'] || null,
      statusHistory: Array.isArray(data['statusHistory']) ? data['statusHistory'] : [],
    };
  }

  // 一覧取得
  async list(filter: FeedbackFilter): Promise<{ items: FeedbackDocument[]; total: number; stats: FeedbackStats }> {
    const db = await getFirestoreAsync();
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const allItems: FeedbackDocument[] = [];

    for (const col of this.COLLECTIONS) {
      const appType: FeedbackApp = col === 'feedback_mobile' ? 'mobile' : 'cms';
      if (filter.app && filter.app !== appType) continue;

      let query: admin.firestore.Query = db.collection(col);
      if (filter.reportType) query = query.where('reportType', '==', filter.reportType);
      if (filter.severity !== undefined && filter.severity !== null) {
        query = query.where('severity', '==', filter.severity);
      }
      if (filter.status) query = query.where('status', '==', filter.status);
      if (filter.dateFrom) {
        query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(filter.dateFrom)));
      }
      if (filter.dateTo) {
        query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(filter.dateTo)));
      }

      const snapshot = await query.get();
      for (const doc of snapshot.docs) {
        const fb = this.docToFeedback(doc.id, doc.data(), appType);
        if (filter.keyword) {
          const kw = filter.keyword.toLowerCase();
          if (!fb.what.toLowerCase().includes(kw) &&
              !fb.screen.toLowerCase().includes(kw) &&
              !(fb.name || '').toLowerCase().includes(kw)) continue;
        }
        allItems.push(fb);
      }
    }

    // ソート
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';
    allItems.sort((a, b) => {
      const av = sortBy === 'severity' ? a.severity : a.createdAt.getTime();
      const bv = sortBy === 'severity' ? b.severity : b.createdAt.getTime();
      return sortOrder === 'asc' ? av - bv : bv - av;
    });

    const stats: FeedbackStats = {
      total: allItems.length,
      new: allItems.filter(i => i.status === 'new').length,
      in_progress: allItems.filter(i => i.status === 'in_progress').length,
      resolved: allItems.filter(i => i.status === 'resolved').length,
      wontfix: allItems.filter(i => i.status === 'wontfix').length,
    };

    const start = (page - 1) * limit;
    return { items: allItems.slice(start, start + limit), total: allItems.length, stats };
  }

  // 詳細取得（Storage署名付きURL生成）
  async getById(id: string): Promise<FeedbackDocument | null> {
    const db = await getFirestoreAsync();
    for (const col of this.COLLECTIONS) {
      const snap = await db.collection(col).doc(id).get();
      if (snap.exists) {
        const appType: FeedbackApp = col === 'feedback_mobile' ? 'mobile' : 'cms';
        const fb = this.docToFeedback(id, snap.data()!, appType);
        // 署名付きURL生成
        if (fb.photoPaths && fb.photoPaths.length > 0) {
          try {
            const bucket = (await getStorageAsync()).bucket();
            const urls: string[] = [];
            for (const p of fb.photoPaths) {
              const [url] = await bucket.file(p).getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000,
              });
              urls.push(url);
            }
            (fb as any).photoUrls = urls;
          } catch {
            (fb as any).photoUrls = [];
          }
        } else {
          (fb as any).photoUrls = [];
        }
        return fb;
      }
    }
    return null;
  }

  // ステータス更新
  async updateStatus(id: string, status: FeedbackStatus, changedBy: string): Promise<void> {
    const db = await getFirestoreAsync();
    for (const col of this.COLLECTIONS) {
      const docRef = db.collection(col).doc(id);
      const snap = await docRef.get();
      if (snap.exists) {
        const prev = String(snap.data()?.['status'] || 'new');
        await docRef.update({
          status,
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            from: prev, to: status,
            changedAt: admin.firestore.Timestamp.now(),
            changedBy,
          }),
        });
        logger.info('フィードバック ステータス更新', { id, from: prev, to: status, changedBy });
        return;
      }
    }
    throw new Error(`フィードバック ID=${id} が見つかりません`);
  }

  // 管理者メモ更新
  async updateNotes(id: string, notes: string, updatedBy: string): Promise<void> {
    const db = await getFirestoreAsync();
    for (const col of this.COLLECTIONS) {
      const docRef = db.collection(col).doc(id);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.update({
          adminNotes: notes,
          adminNotesUpdatedAt: admin.firestore.Timestamp.now(),
          adminNotesUpdatedBy: updatedBy,
        });
        logger.info('フィードバック メモ更新', { id, updatedBy });
        return;
      }
    }
    throw new Error(`フィードバック ID=${id} が見つかりません`);
  }

  // =============================================
  // Backlog 起票
  // issueType: reportTypeから自動判別
  // priority:  severityから自動判別
  // =============================================
  async linkBacklog(
    id: string,
    linkedBy: string,
    customTitle?: string,
    customBody?: string
  ): Promise<{ issueId: string; issueKey: string }> {
    const apiKey = process.env['BACKLOG_API_KEY'];
    const spaceKey = process.env['BACKLOG_SPACE_KEY'] || 'jadeworks';
    const projectId = process.env['BACKLOG_PROJECT_ID'];

    if (!apiKey) throw new Error('BACKLOG_API_KEY が .env に設定されていません');
    if (!projectId) throw new Error('BACKLOG_PROJECT_ID が .env に設定されていません');

    const fb = await this.getById(id);
    if (!fb) throw new Error(`フィードバック ID=${id} が見つかりません`);

    const shortId = id.substring(0, 6);
    const reportLabel = REPORT_TYPE_LABELS[fb.reportType] || fb.reportType;
    const severityLabel = SEVERITY_LABELS[fb.severity] || String(fb.severity);

    // issueTypeId: フィードバック種別から自動決定
    // 環境変数で上書き可能（未設定時はコード定数を使用）
    const issueTypeId = parseInt(process.env[`BACKLOG_ISSUE_TYPE_${fb.reportType.toUpperCase()}`] || '', 10) ||
      REPORT_TYPE_TO_ISSUE_TYPE[fb.reportType] ||
      BACKLOG_ISSUE_TYPE_IDS.OTHER;

    // priorityId: 影響度から自動決定
    const priorityId = SEVERITY_TO_PRIORITY[fb.severity] ?? 3;

    const title = customTitle ||
      `[FB-${shortId}][${reportLabel}] ${fb.screen} - ${fb.what.substring(0, 40)}`;

    const body = customBody || this.buildBacklogBody(fb, reportLabel, severityLabel, shortId);

    // Backlog REST API v2 呼び出し
    // 重要: projectId は POST (新規作成) にのみ含める
    const url = `https://${spaceKey}.backlog.com/api/v2/issues?apiKey=${apiKey}`;
    const payload = {
      projectId: parseInt(projectId, 10),
      summary: title,
      issueTypeId,
      priorityId,
      description: body,
    };

    logger.info('Backlog API 起票リクエスト', {
      url: `https://${spaceKey}.backlog.com/api/v2/issues`,
      projectId: payload.projectId,
      issueTypeId,
      issueTypeName: Object.entries(BACKLOG_ISSUE_TYPE_IDS).find(([, v]) => v === issueTypeId)?.[0] || 'unknown',
      priorityId,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backlog API エラー: ${res.status} ${errText}`);
    }

    const data = await res.json() as { id: number; issueKey: string; summary: string };
    logger.info('Backlog チケット起票完了', { issueKey: data.issueKey, summary: data.summary });

    // Firestoreに連携情報を保存
    const db = await getFirestoreAsync();
    for (const col of this.COLLECTIONS) {
      const docRef = db.collection(col).doc(id);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.update({
          backlogIssueId: String(data.id),
          backlogIssueKey: data.issueKey,
          backlogLinkedAt: admin.firestore.Timestamp.now(),
          backlogLinkedBy: linkedBy,
        });
        break;
      }
    }

    return { issueId: String(data.id), issueKey: data.issueKey };
  }

  // Backlog連携解除
  async unlinkBacklog(id: string): Promise<void> {
    const db = await getFirestoreAsync();
    for (const col of this.COLLECTIONS) {
      const docRef = db.collection(col).doc(id);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.update({
          backlogIssueId: admin.firestore.FieldValue.delete(),
          backlogIssueKey: admin.firestore.FieldValue.delete(),
          backlogLinkedAt: admin.firestore.FieldValue.delete(),
          backlogLinkedBy: admin.firestore.FieldValue.delete(),
        });
        return;
      }
    }
    throw new Error(`フィードバック ID=${id} が見つかりません`);
  }

  // Backlog本文自動生成
  private buildBacklogBody(
    fb: FeedbackDocument,
    reportLabel: string,
    severityLabel: string,
    shortId: string
  ): string {
    const lines = [
      '## フィードバック詳細',
      '',
      `**報告種類:** ${reportLabel}`,
      `**アプリ種別:** ${fb.app === 'mobile' ? 'モバイルアプリ' : 'CMS管理画面'}`,
      `**発生画面:** ${fb.screen}`,
      `**操作内容:** ${fb.operation || '（未記入）'}`,
      `**発生頻度:** ${fb.frequency || '（未記入）'}`,
      `**影響度:** ${severityLabel}`,
      `**使用端末:** ${fb.device || '（未記入）'}`,
      `**報告者:** ${fb.name || '匿名'}`,
      `**報告日時:** ${fb.createdAt.toLocaleString('ja-JP')}`,
      '',
      '## 問題内容',
      fb.what,
      '',
      '## 期待する動作',
      fb.expected || '（未記入）',
      '',
      '## 再現手順',
      fb.steps || '（未記入）',
      '',
      '## 補足',
      fb.extra || '（なし）',
      '',
      '---',
      '*Dump Tracker フィードバックシステムより自動起票*',
      `*Firebase Document ID: ${fb.id} (短縮: FB-${shortId})*`,
    ];
    return lines.join('\n');
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
