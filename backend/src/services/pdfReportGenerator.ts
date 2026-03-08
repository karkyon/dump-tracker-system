/**
 * PDF Report Generator
 * pdfkitを使用して日次運行報告書PDFを生成するモジュール
 *
 * ファイル配置先: backend/src/services/pdfReportGenerator.ts
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// =====================================
// 型定義
// =====================================

export interface DailyReportData {
  reportDate: string; // YYYY-MM-DD
  companyName?: string;
  operations: OperationData[];
  summary: ReportSummary;
}

export interface OperationData {
  operationNumber: string;
  driverName: string;
  vehiclePlateNumber: string;
  vehicleModel: string;
  startTime: Date | null;
  endTime: Date | null;
  totalDistanceKm: number | null;
  fuelConsumedLiters: number | null;
  fuelCostYen: number | null;
  weatherCondition: string | null;
  roadCondition: string | null;
  status: string;
  details: OperationDetailData[];
  preInspection: InspectionData | null;
  postInspection: InspectionData | null;
  notes: string | null;
}

export interface OperationDetailData {
  sequenceNumber: number;
  activityType: string;
  locationName: string | null;
  itemName: string | null;
  quantityTons: number;
  startTime: Date | null;
  endTime: Date | null;
  notes: string | null;
}

export interface InspectionData {
  inspectionType: string;
  overallResult: boolean | null;
  defectsFound: number;
  completedAt: Date | null;
  notes: string | null;
}

export interface ReportSummary {
  totalOperations: number;
  completedOperations: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  totalFuelCostYen: number;
  totalQuantityTons: number;
}

// =====================================
// 定数
// =====================================

// 出力ディレクトリ（バックエンドルートからの相対パス）
export const REPORTS_OUTPUT_DIR = path.join(process.cwd(), 'reports');

// 日本語対応フォントパス（システムフォントを使用）
// NotoSansCJKがない場合はHelveticaにフォールバック
const FONT_PATHS = [
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJKjp-Regular.otf',
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
  '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
];

/**
 * 使用可能な日本語フォントを検索
 */
function findJapaneseFont(): string | null {
  for (const fontPath of FONT_PATHS) {
    if (fs.existsSync(fontPath)) {
      logger.info(`[PDF] 日本語フォント発見: ${fontPath}`);
      return fontPath;
    }
  }
  logger.warn('[PDF] 日本語フォントが見つかりません。デフォルトフォントを使用します。');
  return null;
}

/**
 * 出力ディレクトリを確保する
 */
export function ensureReportDirectory(): void {
  if (!fs.existsSync(REPORTS_OUTPUT_DIR)) {
    fs.mkdirSync(REPORTS_OUTPUT_DIR, { recursive: true });
    logger.info(`[PDF] レポート出力ディレクトリを作成: ${REPORTS_OUTPUT_DIR}`);
  }
}

// =====================================
// ヘルパー関数
// =====================================

function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatNumber(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return '-';
  return Number(n).toFixed(decimals);
}

function getActivityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    LOADING: '積込',
    LOADING_START: '積込開始',
    LOADING_COMPLETE: '積込完了',
    UNLOADING: '積降',
    UNLOADING_START: '積降開始',
    UNLOADING_COMPLETE: '積降完了',
    TRANSPORT: '運搬',
    WAITING: '待機',
    FUEL: '給油',
    FUELING: '給油',
    BREAK: '休憩',
    INSPECTION: '点検',
    MAINTENANCE: 'メンテナンス',
  };
  return labels[type] || type;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PLANNING: '計画中',
    IN_PROGRESS: '運行中',
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
  };
  return labels[status] || status;
}

// =====================================
// PDF生成メイン関数
// =====================================

/**
 * 日次運行報告書PDFを生成する
 * @param data レポートデータ
 * @param outputPath 出力ファイルパス
 * @returns ファイルサイズ（バイト）
 */
export async function generateDailyReportPDF(
  data: DailyReportData,
  outputPath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      ensureReportDirectory();

      const japaneseFont = findJapaneseFont();

      // PDFドキュメント初期化
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `日次運行報告書 ${data.reportDate}`,
          Author: data.companyName || 'ダンプ運行記録システム',
          Creator: 'Dump Tracker CMS',
        },
      });

      // フォント設定
      if (japaneseFont) {
        doc.registerFont('Japanese', japaneseFont);
        doc.font('Japanese');
      }

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // ページ幅・マージン定義
      const pageWidth = doc.page.width - 80; // 左右マージン各40
      const startX = 40;

      // =====================================
      // ヘッダーセクション
      // =====================================
      drawHeader(doc, data, startX, pageWidth, japaneseFont);

      // =====================================
      // サマリーセクション
      // =====================================
      doc.moveDown(0.5);
      drawSummary(doc, data.summary, startX, pageWidth, japaneseFont);

      // =====================================
      // 運行記録セクション（各運行）
      // =====================================
      data.operations.forEach((op, index) => {
        // ページ残量チェック（300px以下なら改ページ）
        if (doc.y > doc.page.height - 200) {
          doc.addPage();
        }
        doc.moveDown(0.8);
        drawOperationRecord(doc, op, index + 1, startX, pageWidth, japaneseFont);
      });

      // 運行記録がない場合
      if (data.operations.length === 0) {
        doc.moveDown(1);
        const noDataFont = japaneseFont || 'Helvetica';
        doc.font(noDataFont).fontSize(11)
          .fillColor('#888888')
          .text('この日の運行記録はありません。', startX, doc.y, { align: 'center', width: pageWidth });
      }

      // =====================================
      // フッター
      // =====================================
      drawFooter(doc, japaneseFont);

      doc.end();

      writeStream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        logger.info(`[PDF] 日次運行報告書生成完了: ${outputPath} (${stats.size} bytes)`);
        resolve(stats.size);
      });

      writeStream.on('error', (err) => {
        logger.error('[PDF] ファイル書き込みエラー', { err, outputPath });
        reject(err);
      });

    } catch (error) {
      logger.error('[PDF] PDF生成エラー', { error, outputPath });
      reject(error);
    }
  });
}

// =====================================
// 描画関数群
// =====================================

function drawHeader(
  doc: PDFKit.PDFDocument,
  data: DailyReportData,
  startX: number,
  pageWidth: number,
  japaneseFont: string | null
): void {
  const font = japaneseFont || 'Helvetica-Bold';
  const fontNormal = japaneseFont || 'Helvetica';

  // タイトル背景
  doc.rect(startX, 40, pageWidth, 50).fillColor('#1e3a5f').fill();

  // タイトルテキスト
  doc.font(font).fontSize(18).fillColor('#FFFFFF')
    .text('日次運行報告書', startX, 52, { width: pageWidth, align: 'center' });

  doc.font(fontNormal).fontSize(10).fillColor('#CCDDEE')
    .text(formatDate(data.reportDate), startX, 74, { width: pageWidth, align: 'center' });

  // 会社名・生成日時
  doc.moveDown(0.5);
  const infoY = 100;
  doc.font(fontNormal).fontSize(9).fillColor('#555555');

  if (data.companyName) {
    doc.text(`会社名: ${data.companyName}`, startX, infoY);
  }
  doc.text(
    `出力日時: ${formatDateTime(new Date())}`,
    startX,
    infoY,
    { width: pageWidth, align: 'right' }
  );

  // 区切り線
  doc.moveTo(startX, infoY + 14).lineTo(startX + pageWidth, infoY + 14)
    .strokeColor('#CCCCCC').lineWidth(0.5).stroke();

  doc.y = infoY + 20;
}

function drawSummary(
  doc: PDFKit.PDFDocument,
  summary: ReportSummary,
  startX: number,
  pageWidth: number,
  japaneseFont: string | null
): void {
  const font = japaneseFont || 'Helvetica-Bold';
  const fontNormal = japaneseFont || 'Helvetica';

  // セクションタイトル
  doc.font(font).fontSize(11).fillColor('#1e3a5f')
    .text('■ 当日サマリー', startX, doc.y);
  doc.moveDown(0.3);

  const boxY = doc.y;
  const colWidth = pageWidth / 4;

  // サマリーボックス背景
  doc.rect(startX, boxY, pageWidth, 55).fillColor('#F0F4F8').fill();
  doc.rect(startX, boxY, pageWidth, 55).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

  const summaryItems = [
    { label: '総運行数', value: `${summary.totalOperations}件` },
    { label: '完了運行', value: `${summary.completedOperations}件` },
    { label: '総走行距離', value: `${formatNumber(summary.totalDistanceKm)} km` },
    { label: '総輸送量', value: `${formatNumber(summary.totalQuantityTons)} t` },
  ];

  summaryItems.forEach((item, i) => {
    const x = startX + colWidth * i;

    // 縦区切り線
    if (i > 0) {
      doc.moveTo(x, boxY + 5).lineTo(x, boxY + 50)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    }

    doc.font(fontNormal).fontSize(8).fillColor('#666666')
      .text(item.label, x + 5, boxY + 10, { width: colWidth - 10, align: 'center' });
    doc.font(font).fontSize(14).fillColor('#1e3a5f')
      .text(item.value, x + 5, boxY + 25, { width: colWidth - 10, align: 'center' });
  });

  doc.y = boxY + 65;
}

function drawOperationRecord(
  doc: PDFKit.PDFDocument,
  op: OperationData,
  index: number,
  startX: number,
  pageWidth: number,
  japaneseFont: string | null
): void {
  const font = japaneseFont || 'Helvetica-Bold';
  const fontNormal = japaneseFont || 'Helvetica';

  // 運行ヘッダーバー
  const headerY = doc.y;
  doc.rect(startX, headerY, pageWidth, 22)
    .fillColor('#2563EB').fill();

  doc.font(font).fontSize(10).fillColor('#FFFFFF')
    .text(
      `運行 #${index}  ${op.operationNumber}  [${getStatusLabel(op.status)}]`,
      startX + 6, headerY + 6,
      { width: pageWidth * 0.6 }
    );
  doc.font(fontNormal).fontSize(9).fillColor('#DDEEFF')
    .text(
      `運転手: ${op.driverName}  |  車両: ${op.vehiclePlateNumber}`,
      startX + pageWidth * 0.35, headerY + 7,
      { width: pageWidth * 0.6, align: 'right' }
    );

  doc.y = headerY + 28;

  // 基本情報行
  const infoBoxY = doc.y;
  doc.rect(startX, infoBoxY, pageWidth, 38).fillColor('#FAFAFA').fill();
  doc.rect(startX, infoBoxY, pageWidth, 38).strokeColor('#E0E0E0').lineWidth(0.5).stroke();

  const col2 = pageWidth / 2;

  doc.font(fontNormal).fontSize(8).fillColor('#555555');
  doc.text(`出発時刻: ${formatDateTime(op.startTime)}`, startX + 6, infoBoxY + 6, { width: col2 - 10 });
  doc.text(`到着時刻: ${formatDateTime(op.endTime)}`, startX + col2 + 6, infoBoxY + 6, { width: col2 - 10 });
  doc.text(
    `走行距離: ${formatNumber(op.totalDistanceKm)} km  |  燃料消費: ${formatNumber(op.fuelConsumedLiters)} L  |  燃料費: ${op.fuelCostYen ? `¥${Math.round(Number(op.fuelCostYen)).toLocaleString()}` : '-'}`,
    startX + 6, infoBoxY + 22,
    { width: pageWidth - 12 }
  );
  if (op.weatherCondition) {
    doc.text(`天候: ${op.weatherCondition}  路面: ${op.roadCondition || '-'}`,
      startX + col2 + 6, infoBoxY + 22, { width: col2 - 10 });
  }

  doc.y = infoBoxY + 45;

  // 点検結果
  if (op.preInspection || op.postInspection) {
    drawInspectionRow(doc, op.preInspection, op.postInspection, startX, pageWidth, fontNormal, font);
  }

  // 運行詳細テーブル
  if (op.details.length > 0) {
    drawDetailsTable(doc, op.details, startX, pageWidth, fontNormal, font);
  }

  // 備考
  if (op.notes) {
    doc.font(fontNormal).fontSize(8).fillColor('#555555')
      .text(`備考: ${op.notes}`, startX + 4, doc.y + 3, { width: pageWidth - 8 });
    doc.moveDown(0.3);
  }

  // 運行区切り線
  doc.moveTo(startX, doc.y + 3).lineTo(startX + pageWidth, doc.y + 3)
    .strokeColor('#BBBBBB').lineWidth(0.5).stroke();
  doc.y += 6;
}

function drawInspectionRow(
  doc: PDFKit.PDFDocument,
  pre: InspectionData | null,
  post: InspectionData | null,
  startX: number,
  pageWidth: number,
  fontNormal: string,
  fontBold: string
): void {
  const rowY = doc.y;
  const colW = pageWidth / 2;

  doc.rect(startX, rowY, pageWidth, 22).fillColor('#F8F8F0').fill();
  doc.rect(startX, rowY, pageWidth, 22).strokeColor('#E0E0E0').lineWidth(0.5).stroke();

  const getInspResult = (insp: InspectionData | null) => {
    if (!insp) return '未実施';
    if (insp.overallResult === true) return '✓ 合格';
    if (insp.overallResult === false) return `✗ 不合格 (${insp.defectsFound}件)`;
    return '実施済み';
  };

  const getColor = (insp: InspectionData | null) => {
    if (!insp) return '#888888';
    return insp.overallResult ? '#16a34a' : '#dc2626';
  };

  doc.font(fontBold).fontSize(8).fillColor('#444444')
    .text('乗車前点検:', startX + 6, rowY + 7, { width: 55 });
  doc.font(fontNormal).fontSize(8).fillColor(getColor(pre))
    .text(getInspResult(pre), startX + 62, rowY + 7, { width: colW - 70 });

  doc.font(fontBold).fontSize(8).fillColor('#444444')
    .text('乗車後点検:', startX + colW + 6, rowY + 7, { width: 55 });
  doc.font(fontNormal).fontSize(8).fillColor(getColor(post))
    .text(getInspResult(post), startX + colW + 62, rowY + 7, { width: colW - 70 });

  doc.y = rowY + 28;
}

function drawDetailsTable(
  doc: PDFKit.PDFDocument,
  details: OperationDetailData[],
  startX: number,
  pageWidth: number,
  fontNormal: string,
  fontBold: string
): void {
  // テーブルヘッダー
  const headerY = doc.y;
  const cols = {
    seq: 25,
    type: 55,
    location: pageWidth * 0.25,
    item: pageWidth * 0.2,
    qty: 45,
    start: 75,
    end: 75,
  };

  doc.rect(startX, headerY, pageWidth, 16).fillColor('#E8EDF2').fill();
  doc.rect(startX, headerY, pageWidth, 16).strokeColor('#C0C8D0').lineWidth(0.5).stroke();

  let x = startX + 3;
  doc.font(fontBold).fontSize(7.5).fillColor('#333333');
  doc.text('No', x, headerY + 4, { width: cols.seq }); x += cols.seq;
  doc.text('作業種別', x, headerY + 4, { width: cols.type }); x += cols.type;
  doc.text('場所', x, headerY + 4, { width: cols.location }); x += cols.location;
  doc.text('品目', x, headerY + 4, { width: cols.item }); x += cols.item;
  doc.text('数量(t)', x, headerY + 4, { width: cols.qty, align: 'right' }); x += cols.qty;
  doc.text('開始時刻', x, headerY + 4, { width: cols.start }); x += cols.start;
  doc.text('終了時刻', x, headerY + 4, { width: cols.end });

  doc.y = headerY + 18;

  // データ行
  details.forEach((detail, i) => {
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
    }

    const rowY2 = doc.y;
    const rowHeight = 16;

    // 交互背景色
    if (i % 2 === 1) {
      doc.rect(startX, rowY2, pageWidth, rowHeight).fillColor('#F7F9FB').fill();
    }
    doc.rect(startX, rowY2, pageWidth, rowHeight).strokeColor('#E0E0E0').lineWidth(0.3).stroke();

    let rx = startX + 3;
    doc.font(fontNormal).fontSize(7.5).fillColor('#333333');
    doc.text(String(detail.sequenceNumber), rx, rowY2 + 4, { width: cols.seq }); rx += cols.seq;
    doc.text(getActivityTypeLabel(detail.activityType), rx, rowY2 + 4, { width: cols.type }); rx += cols.type;
    doc.text(detail.locationName || '-', rx, rowY2 + 4, { width: cols.location }); rx += cols.location;
    doc.text(detail.itemName || '-', rx, rowY2 + 4, { width: cols.item }); rx += cols.item;
    doc.text(
      detail.quantityTons > 0 ? formatNumber(detail.quantityTons, 2) : '-',
      rx, rowY2 + 4, { width: cols.qty, align: 'right' }
    ); rx += cols.qty;
    doc.text(formatDateTime(detail.startTime), rx, rowY2 + 4, { width: cols.start }); rx += cols.start;
    doc.text(formatDateTime(detail.endTime), rx, rowY2 + 4, { width: cols.end });

    doc.y = rowY2 + rowHeight;
  });

  doc.y += 4;
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  japaneseFont: string | null
): void {
  const fontNormal = japaneseFont || 'Helvetica';
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;

    doc.font(fontNormal).fontSize(7.5).fillColor('#AAAAAA')
      .text(
        `ダンプ運行記録システム  |  ページ ${i - range.start + 1} / ${range.count}`,
        40, pageHeight - 25,
        { width: pageWidth - 80, align: 'center' }
      );
  }
}
