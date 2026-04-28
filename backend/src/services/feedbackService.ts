// backend/src/services/feedbackService.ts
// フィードバック管理サービス
// Firebase Firestore読取・ステータス更新・Backlog連携

import logger from '../utils/logger';
import { getFirestore, getStorage } from '../lib/firebase-admin';
import * as admin from 'firebase-admin';

// =============================================
// 型定義
// =============================================

export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'wontfix';
export type FeedbackApp = 'mobile' | 'cms';

export interface FeedbackDocument {
  id: string;
  app: FeedbackApp;
  name?: string;
  reportType: string;
  screen: string;
  operation?: string;
  frequency?: string;
  what: string;
  expected?: string;
  steps?: string;
  severity: number;
  device?: string;
  extra?: string;
  photoPaths?: string[];
  createdAt: Date;
  status: FeedbackStatus;
  adminNotes?: string;
  adminNotesUpdatedAt?: Date;
  adminNotesUpdatedBy?: string;
  backlogIssueId?: string;
  backlogIssueKey?: string;
  backlogLinkedAt?: Date;
  backlogLinkedBy?: string;
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
// ラベル定数
// =============================================

const REPORT_TYPE_LABELS: Record<string, string> = {
  bug: 'バグ・不具合',
  odd: '動作がおかしい',
  improve: '改善要望',
  feature: '新機能提案',
  data: 'データの誤り',
  good: '良かった点',
};

const SEVERITY_LABELS: Record<number, string> = {
  0: '🔴 業務停止',
  1: '🟠 業務に支障',
  2: '🟡 不便',
  3: '🟢 軽微・提案',
};

const BACKLOG_PRIORITY_MAP: Record<number, number> = {
  0: 2, // 緊急
  1: 3, // 高
  2: 3, // 中
  3: 4, // 低
};

// =============================================
// FeedbackService クラス
// =============================================

export class FeedbackService {
  private readonly COLLECTIONS = ['feedback_mobile', 'feedback_cms'] as const;

  // ------------------------------------------
  // Firestoreドキュメントを型変換
  // ------------------------------------------
  private docToFeedback(id: string, data: admin.firestore.DocumentData, app: FeedbackApp): FeedbackDocument {
    return {
      id,
      app,
      name: data.name || null,
      reportType: data.reportType,
      screen: data.screen,
      operation: data.operation || null,
      frequency: data.frequency || null,
      what: data.what,
      expected: data.expected || null,
      steps: data.steps || null,
      severity: data.severity,
      device: data.device || null,
      extra: data.extra || null,
      photoPaths: data.photoPaths || [],
      createdAt: data.createdAt?.toDate?.() || new Date(),
      status: data.status || 'new',
      adminNotes: data.adminNotes || null,
      adminNotesUpdatedAt: data.adminNotesUpdatedAt?.toDate?.() || null,
      adminNotesUpdatedBy: data.adminNotesUpdatedBy || null,
      backlogIssueId: data.backlogIssueId || null,
      backlogIssueKey: data.backlogIssueKey || null,
      backlogLinkedAt: data.backlogLinkedAt?.toDate?.() || null,
      backlogLinkedBy: data.backlogLinkedBy || null,
      statusHistory: data.statusHistory || [],
    };
  }

  // ------------------------------------------
  // 一覧取得
  // ------------------------------------------
  async list(filter: FeedbackFilter): Promise<{ items: FeedbackDocument[]; total: number; stats: FeedbackStats }> {
    const db = getFirestore();
    const page = filter.page || 1;
    const limit = filter.limit || 20;

    const allItems: FeedbackDocument[] = [];

    // mobile と cms 両方のコレクションから取得
    for (const col of this.COLLECTIONS) {
      const appType: FeedbackApp = col === 'feedback_mobile' ? 'mobile' : 'cms';
      if (filter.app && filter.app !== appType) continue;

      let query: admin.firestore.Query = db.collection(col);

      // フィルタ適用
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
        // キーワードフィルタ（Firestoreでは全文検索不可のためクライアント側）
        if (filter.keyword) {
          const kw = filter.keyword.toLowerCase();
          if (
            !fb.what.toLowerCase().includes(kw) &&
            !fb.screen.toLowerCase().includes(kw) &&
            !(fb.name || '').toLowerCase().includes(kw)
          ) continue;
        }
        allItems.push(fb);
      }
    }

    // ソート
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';
    allItems.sort((a, b) => {
      let av: any = a[sortBy as keyof FeedbackDocument];
      let bv: any = b[sortBy as keyof FeedbackDocument];
      if (av instanceof Date) av = av.getTime();
      if (bv instanceof Date) bv = bv.getTime();
      return sortOrder === 'asc' ? av - bv : bv - av;
    });

    // 統計
    const stats: FeedbackStats = {
      total: allItems.length,
      new: allItems.filter(i => i.status === 'new').length,
      in_progress: allItems.filter(i => i.status === 'in_progress').length,
      resolved: allItems.filter(i => i.status === 'resolved').length,
      wontfix: allItems.filter(i => i.status === 'wontfix').length,
    };

    // ページネーション
    const start = (page - 1) * limit;
    const items = allItems.slice(start, start + limit);

    return { items, total: allItems.length, stats };
  }

  // ------------------------------------------
  // 詳細取得（署名付きStorage URL生成含む）
  // ------------------------------------------
  async getById(id: string): Promise<FeedbackDocument | null> {
    const db = getFirestore();

    for (const col of this.COLLECTIONS) {
      const docRef = db.collection(col).doc(id);
      const snap = await docRef.get();
      if (snap.exists) {
        const appType: FeedbackApp = col === 'feedback_mobile' ? 'mobile' : 'cms';
        const fb = this.docToFeedback(id, snap.data()!, appType);

        // 署名付きURL生成（photoPaths → photoUrls）
        if (fb.photoPaths && fb.photoPaths.length > 0) {
          try {
            const bucket = getStorage().bucket();
            const urls: string[] = [];
            for (const p of fb.photoPaths) {
              const file = bucket.file(p);
              const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1時間
              });
              urls.push(url);
            }
            (fb as any).photoUrls = urls;
          } catch (e) {
            logger.warn('Storage署名URL生成失敗', { id, error: String(e) });
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

  // ------------------------------------------
  // ステータス更新
  // ------------------------------------------
  async updateStatus(id: string, status: FeedbackStatus, changedBy: string): Promise<void> {
    const db = getFirestore();

    for (const col of this.COLLECTIONS) {
      const docRef = db.collection(col).doc(id);
      const snap = await docRef.get();
      if (snap.exists) {
        const prev = snap.data()?.status || 'new';
        const historyEntry: StatusHistory = {
          from: prev,
          to: status,
          changedAt: new Date(),
          changedBy,
        };
        await docRef.update({
          status,
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            ...historyEntry,
            changedAt: admin.firestore.Timestamp.fromDate(historyEntry.changedAt),
          }),
        });
        logger.info('フィードバック ステータス更新', { id, from: prev, to: status, changedBy });
        return;
      }
    }
    throw new Error(`フィードバック ID=${id} が見つかりません`);
  }

  // ------------------------------------------
  // 管理者メモ更新
  // ------------------------------------------
  async updateNotes(id: string, notes: string, updatedBy: string): Promise<void> {
    const db = getFirestore();

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

  // ------------------------------------------
  // Backlog起票
  // ------------------------------------------
  async linkBacklog(
    id: string,
    linkedBy: string,
    customTitle?: string,
    customBody?: string
  ): Promise<{ issueId: string; issueKey: string }> {
    const apiKey = process.env.BACKLOG_API_KEY;
    const spaceKey = process.env.BACKLOG_SPACE_KEY || 'jadeworks';
    const projectId = process.env.BACKLOG_PROJECT_ID;

    if (!apiKey || !projectId) {
      throw new Error('BACKLOG_API_KEY または BACKLOG_PROJECT_ID が設定されていません');
    }

    const fb = await this.getById(id);
    if (!fb) throw new Error(`フィードバック ID=${id} が見つかりません`);

    const shortId = id.substring(0, 6);
    const reportLabel = REPORT_TYPE_LABELS[fb.reportType] || fb.reportType;
    const severityLabel = SEVERITY_LABELS[fb.severity] || String(fb.severity);
    const priorityId = BACKLOG_PRIORITY_MAP[fb.severity] || 3;

    // issueTypeId: バグ=1, 要望=2 (プロジェクトによる)
    const issueTypeId = ['bug', 'odd', 'data'].includes(fb.reportType)
      ? parseInt(process.env.BACKLOG_ISSUE_TYPE_BUG || '1', 10)
      : parseInt(process.env.BACKLOG_ISSUE_TYPE_REQUEST || '2', 10);

    const title = customTitle ||
      `[FB-${shortId}][${reportLabel}] ${fb.screen} - ${fb.what.substring(0, 40)}`;

    const body = customBody || this.buildBacklogBody(fb, reportLabel, severityLabel, shortId);

    const url = `https://${spaceKey}.backlog.com/api/v2/issues?apiKey=${apiKey}`;
    const payload = {
      projectId: parseInt(projectId, 10),
      summary: title,
      issueTypeId,
      priorityId,
      description: body,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backlog API エラー: ${res.status} ${errText}`);
    }

    const data = await res.json() as { id: number; issueKey: string };

    // Firestoreにも保存
    const db = getFirestore();
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

    logger.info('Backlog チケット起票完了', { id, issueKey: data.issueKey, linkedBy });
    return { issueId: String(data.id), issueKey: data.issueKey };
  }

  // ------------------------------------------
  // Backlog連携解除
  // ------------------------------------------
  async unlinkBacklog(id: string): Promise<void> {
    const db = getFirestore();
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

  // ------------------------------------------
  // Backlog本文自動生成
  // ------------------------------------------
  private buildBacklogBody(fb: FeedbackDocument, reportLabel: string, severityLabel: string, shortId: string): string {
    return [
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
      `**報告日時:** ${fb.createdAt.toISOString()}`,
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
      `*Firebase Document ID: ${fb.id}*`,
    ].join('\n');
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
