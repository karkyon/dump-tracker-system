// =====================================
// backend/src/services/annualTransportReportPDF.ts
// 貨物自動車運送事業実績報告書 PDF生成
// 貨物自動車運送事業報告規則 第4号様式（A4縦）
// 新規作成: 2026-03-17 (P3-02)
// =====================================

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import {
  AnnualTransportReportData,
  TRANSPORT_REGIONS_ORDERED,
  REGION_LABELS,
} from './annualTransportReportService';
import { ensureReportDirectory, REPORTS_OUTPUT_DIR } from './pdfReportGenerator';

// =====================================
// レイアウト定数（A4縦: 595.28 × 841.89 pt）
// =====================================

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const ML      = 28;   // 左マージン
const MR      = 28;   // 右マージン
const MT      = 30;   // 上マージン
const MB      = 28;   // 下マージン
const CONTENT_W = PAGE_W - ML - MR;  // 539.28

// 行高さ
const HDR_H   = 20;   // ヘッダーセル
const ROW_H   = 18;   // 輸送実績の1行
const TOTAL_H = 20;   // 全国計行

// 列幅（CONTENT_W = 539.28 を7列に配分）
const COL_REGION = 62;
const COL_NUM    = Math.floor((CONTENT_W - COL_REGION) / 7);  // ≈68
const COL_LAST   = CONTENT_W - COL_REGION - COL_NUM * 6;      // 残り（≈69pt）

// =====================================
// フォント検索（pdfReportGenerator.ts と同じロジック）
// =====================================

function findJapaneseFont(): string | null {
  const candidates = [
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJKjp-Regular.otf',
    '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
    '/usr/share/fonts/truetype/takao-gothic/TakaoGothic.ttf',
    '/usr/share/fonts/truetype/ipafont-gothic/ipag.ttf',
    '/usr/share/fonts/truetype/ipafont/ipag.ttf',
    '/usr/share/fonts/opentype/ipafont-gothic/ipag.otf',
    '/usr/share/fonts/truetype/vlgothic/VL-Gothic-Regular.ttf',
    '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
  ];
  for (const f of candidates) {
    if (fs.existsSync(f) && !f.endsWith('.ttc')) {
      logger.info(`[AnnualPDF] フォント: ${f}`);
      return f;
    }
  }
  logger.warn('[AnnualPDF] 日本語フォントなし。英字フォールバック。');
  return null;
}

// =====================================
// セル描画ヘルパー
// =====================================

function cell(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  text: string,
  opts: {
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    bg?: string;
    font?: string;
  } = {}
): void {
  const { fontSize = 7, align = 'center', bold = false, bg, font } = opts;

  if (bg) {
    doc.rect(x, y, w, h).fillColor(bg).fill();
  }
  doc.rect(x, y, w, h).strokeColor('#000').lineWidth(0.4).stroke();

  if (!text) return;

  const usedFont = font ?? (bold ? 'Helvetica-Bold' : 'Helvetica');
  doc.font(usedFont).fontSize(fontSize).fillColor('#000');
  const lineH = fontSize * 1.3;
  const ty = y + (h - lineH) / 2;
  doc.text(text, x + 2, ty, { width: w - 4, align, lineBreak: false });
}

function numStr(n: number, decimals = 0): string {
  if (n === 0) return '';
  return decimals > 0
    ? n.toLocaleString('ja-JP', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toLocaleString('ja-JP');
}

// =====================================
// 帳票描画メイン
// =====================================

function drawAnnualTransportReport(
  doc: PDFKit.PDFDocument,
  data: AnnualTransportReportData,
  jpFont: string | null
): void {
  const fN = jpFont ?? 'Helvetica';
  const fB = jpFont ?? 'Helvetica-Bold';
  const s = data.businessSettings ?? {};

  let y = MT;

  // ──────────────────────────────────
  // ① 様式番号・タイトル
  // ──────────────────────────────────
  doc.font(fN).fontSize(7).fillColor('#000')
    .text('貨物自動車運送事業報告規則　第４号様式（第２条関係）', ML, y, { lineBreak: false });
  y += 11;
  doc.font(fN).fontSize(7)
    .text('（日本工業規格Ａ列４番）', ML, y, { lineBreak: false });
  y += 14;

  // 区分（一般にチェック）
  doc.font(fN).fontSize(7).text('区分', ML, y, { lineBreak: false });
  const categories = ['一般', '特定', '特積', '利用', '霊柩'];
  let cx = ML + 30;
  categories.forEach(cat => {
    doc.rect(cx, y - 2, 36, 12).strokeColor('#000').lineWidth(0.4).stroke();
    if (cat === '一般') {
      doc.circle(cx + 18, y + 4, 8).strokeColor('#000').lineWidth(0.8).stroke();
    }
    doc.font(fN).fontSize(7).fillColor('#000').text(cat, cx + 2, y, { width: 32, align: 'center', lineBreak: false });
    cx += 40;
  });
  y += 20;

  // タイトル
  doc.font(fB).fontSize(14).fillColor('#000');
  const title = '貨物自動車運送事業実績報告書';
  const titleW = doc.widthOfString(title);
  doc.text(title, ML + (CONTENT_W - titleW) / 2, y, { lineBreak: false });
  y += 20;

  // 提出先・提出者情報
  doc.font(fN).fontSize(8)
    .text(`${s.submissionTarget ?? '　　　　　　　　'} あて`, ML + CONTENT_W - 150, y, { lineBreak: false });
  y += 14;

  doc.font(fN).fontSize(8).text(`住　所　${s.address ?? ''}`, ML, y, { lineBreak: false });
  y += 12;
  doc.font(fN).fontSize(8).text(`事業者名　${s.companyName ?? ''}`, ML, y, { lineBreak: false });
  y += 12;
  doc.font(fN).fontSize(8).text(`代表者名（役職及び氏名）　${s.representativeName ?? ''}`, ML, y, { lineBreak: false });
  y += 12;
  doc.font(fN).fontSize(8).text(`電話番号　${s.phoneNumber ?? ''}`, ML, y, { lineBreak: false });
  y += 16;

  // ──────────────────────────────────
  // ② 事業概況
  // ──────────────────────────────────
  const baseDate = `${data.fiscalYear + 1}年3月31日`;
  doc.font(fB).fontSize(8).text(`事業概況（${baseDate}現在）`, ML, y, { lineBreak: false });
  y += 11;

  doc.font(fN).fontSize(8)
    .text(`事業用自動車数　${data.overview.vehicleCount} 台`, ML, y, { lineBreak: false })
    .text(`従業員数　${data.overview.employeeCount} 人`, ML + 140, y, { lineBreak: false })
    .text(`運転者数　${data.overview.driverCount} 人`, ML + 280, y, { lineBreak: false });
  y += 12;

  // 事業内容（チェックボックス表示）
  const bizContents: [string, string][] = [
    ['DUMP_EARTH',  'ダンプによる土砂等運搬'],
    ['FROZEN',      '冷凍、冷蔵輸送'],
    ['LONG_ITEM',   '基準緩和認定車両による長大物品等輸送'],
    ['TIMBER',      '原木、製材輸送'],
    ['CONTAINER',   '国際海上コンテナ輸送'],
    ['MOVING',      '引越輸送'],
    ['READY_MIX',   'コンクリートミキサー車による生コンクリート輸送'],
    ['OTHER',       'その他'],
    ['HAZARDOUS',   '危険物等輸送'],
  ];
  const selectedTypes: string[] = s.businessTypes ?? [];
  doc.font(fN).fontSize(7).text('事業内容（前年4月1日から3月31日）', ML, y, { lineBreak: false });
  y += 10;
  bizContents.forEach(([key, label], idx) => {
    const bx = ML + (idx % 3) * 178;
    const by = y + Math.floor(idx / 3) * 11;
    const checked = selectedTypes.includes(key);
    doc.rect(bx, by, 8, 8).strokeColor('#000').lineWidth(0.4).stroke();
    if (checked) {
      doc.circle(bx + 4, by + 4, 3.5).strokeColor('#000').lineWidth(0.8).stroke();
    }
    doc.font(fN).fontSize(7).fillColor('#000').text(label, bx + 11, by + 1, { lineBreak: false });
  });
  y += 36;

  // ──────────────────────────────────
  // ③ 輸送実績テーブル（メイン）
  // ──────────────────────────────────
  const tableCaption = `輸送実績（前年${data.fiscalYear}年4月1日から${data.fiscalYear + 1}年3月31日）`;
  doc.font(fB).fontSize(8).fillColor('#000').text(tableCaption, ML, y, { lineBreak: false });
  y += 11;

  const tableX = ML;

  // ヘッダー行1（列タイトル）
  const hdBg = '#EFEFEF';
  let hx = tableX;
  cell(doc, hx, y, COL_REGION, HDR_H * 2, '地域', { fontSize: 7, bold: true, bg: hdBg, font: fB });
  hx += COL_REGION;

  const headers: [string, number][] = [
    ['延実在\n車両数\n（日車）',    COL_NUM],
    ['延実働\n車両数\n（日車）',    COL_NUM],
    ['走行キロ\n（ｷﾛﾒｰﾄﾙ）',    COL_NUM],
    ['実車キロ\n（ｷﾛﾒｰﾄﾙ）',    COL_NUM],
    ['輸送トン数',               COL_NUM * 2],
    ['営業収入\n（千円）',         COL_LAST],
  ];

  // 輸送トン数は2段ヘッダー
  let hxInner = hx;
  headers.forEach(([label, w], i) => {
    if (i === 4) {
      // 輸送トン数: 上段ラベル
      cell(doc, hxInner, y, COL_NUM * 2, HDR_H, '輸送トン数', { fontSize: 6.5, bold: true, bg: hdBg, font: fB });
      // 下段: 実運送 / 利用運送
      cell(doc, hxInner,          y + HDR_H, COL_NUM, HDR_H, '実運送\n（ﾄﾝ）', { fontSize: 6, bold: true, bg: hdBg, font: fB });
      cell(doc, hxInner + COL_NUM, y + HDR_H, COL_NUM, HDR_H, '利用運送\n(ﾄﾝ)', { fontSize: 6, bold: true, bg: hdBg, font: fB });
      hxInner += COL_NUM * 2;
    } else if (i < 4) {
      cell(doc, hxInner, y, w, HDR_H * 2, label.replace(/\\n/g, '\n'), { fontSize: 6, bold: true, bg: hdBg, font: fB });
      hxInner += w;
    } else {
      cell(doc, hxInner, y, w, HDR_H * 2, label.replace(/\\n/g, '\n'), { fontSize: 6, bold: true, bg: hdBg, font: fB });
      hxInner += w;
    }
  });
  // 地域列の縦線補正
  doc.rect(tableX, y, COL_REGION, HDR_H * 2).strokeColor('#000').lineWidth(0.4).stroke();
  y += HDR_H * 2;

  // データ行（10地域）
  data.byRegion.forEach((row, i) => {
    const bg = i % 2 === 0 ? undefined : '#FAFAFA';
    let rx = tableX;
    cell(doc, rx, y, COL_REGION, ROW_H, row.regionLabel, { fontSize: 7, align: 'left', bg, font: fN }); rx += COL_REGION;
    cell(doc, rx, y, COL_NUM,    ROW_H, numStr(row.vehicleDaysTotal),    { fontSize: 7, align: 'right', bg, font: fN }); rx += COL_NUM;
    cell(doc, rx, y, COL_NUM,    ROW_H, numStr(row.vehicleDaysWorked),   { fontSize: 7, align: 'right', bg, font: fN }); rx += COL_NUM;
    cell(doc, rx, y, COL_NUM,    ROW_H, numStr(row.totalDistanceKm),     { fontSize: 7, align: 'right', bg, font: fN }); rx += COL_NUM;
    cell(doc, rx, y, COL_NUM,    ROW_H, numStr(row.loadedDistanceKm),    { fontSize: 7, align: 'right', bg, font: fN }); rx += COL_NUM;
    cell(doc, rx, y, COL_NUM,    ROW_H, numStr(row.transportTons, 1),    { fontSize: 7, align: 'right', bg, font: fN }); rx += COL_NUM;
    cell(doc, rx, y, COL_NUM,    ROW_H, '',                              { fontSize: 7, align: 'right', bg, font: fN }); rx += COL_NUM;
    cell(doc, rx, y, COL_LAST,   ROW_H, numStr(row.revenueThousandYen),  { fontSize: 7, align: 'right', bg, font: fN });
    y += ROW_H;
  });

  // 全国計行
  const t = data.total;
  let tx = tableX;
  const totalBg = '#E8E8E8';
  cell(doc, tx, y, COL_REGION, TOTAL_H, '全国計', { fontSize: 7, bold: true, bg: totalBg, font: fB }); tx += COL_REGION;
  cell(doc, tx, y, COL_NUM,    TOTAL_H, numStr(t.vehicleDaysTotal),   { fontSize: 7, align: 'right', bold: true, bg: totalBg, font: fB }); tx += COL_NUM;
  cell(doc, tx, y, COL_NUM,    TOTAL_H, numStr(t.vehicleDaysWorked),  { fontSize: 7, align: 'right', bold: true, bg: totalBg, font: fB }); tx += COL_NUM;
  cell(doc, tx, y, COL_NUM,    TOTAL_H, numStr(t.totalDistanceKm),    { fontSize: 7, align: 'right', bold: true, bg: totalBg, font: fB }); tx += COL_NUM;
  cell(doc, tx, y, COL_NUM,    TOTAL_H, numStr(t.loadedDistanceKm),   { fontSize: 7, align: 'right', bold: true, bg: totalBg, font: fB }); tx += COL_NUM;
  cell(doc, tx, y, COL_NUM,    TOTAL_H, numStr(t.transportTons, 1),   { fontSize: 7, align: 'right', bold: true, bg: totalBg, font: fB }); tx += COL_NUM;
  cell(doc, tx, y, COL_NUM,    TOTAL_H, '',                           { fontSize: 7, align: 'right', bold: true, bg: totalBg, font: fB }); tx += COL_NUM;
  cell(doc, tx, y, COL_LAST,   TOTAL_H, numStr(t.revenueThousandYen), { fontSize: 7, align: 'right', bold: true, bg: totalBg, font: fB });
  y += TOTAL_H + 12;

  // ──────────────────────────────────
  // ④ 事故件数
  // ──────────────────────────────────
  doc.font(fB).fontSize(8).fillColor('#000')
    .text(`事故件数（前年${data.fiscalYear}年4月1日から${data.fiscalYear + 1}年3月31日）`, ML, y, { lineBreak: false });
  y += 11;

  const acc = data.accidents;
  doc.font(fN).fontSize(8)
    .text(`交通事故件数　${acc.trafficAccidents} 件`, ML,       y, { lineBreak: false })
    .text(`重大事故件数　${acc.seriousAccidents} 件`, ML + 130, y, { lineBreak: false })
    .text(`死者数　${acc.casualties} 件`,              ML + 260, y, { lineBreak: false })
    .text(`負傷者数　${acc.injuries} 件`,              ML + 360, y, { lineBreak: false });
  y += 14;

  // ──────────────────────────────────
  // ⑤ 事業者番号
  // ──────────────────────────────────
  if (s.businessNumber) {
    doc.font(fN).fontSize(7).fillColor('#000')
      .text(`事業者番号　${s.businessNumber}`, ML + CONTENT_W - 120, y, { lineBreak: false });
  }
  y += 12;

  // ──────────────────────────────────
  // ⑥ 備考（法令注記）
  // ──────────────────────────────────
  doc.font(fN).fontSize(6.5).fillColor('#444');
  const notes = [
    '１．区分の欄は、該当する事項を○で囲むこと。',
    '２．従業員数は兼業事業がある場合は、主として当該事業に従事している人数及び共通部門に従事している従業員のうち当該事業分として適正な基準により配分した人数とし、運転者数を含むものとする。',
    '３．事業内容については、主なもの三項目以内を○で囲むこと。',
    '５．輸送実績については、地方運輸局の管轄区域毎に、当該地方運輸局の管轄区域内にある全ての営業所に配置されている事業用自動車の輸送実績を記載すること。',
    '６．交通事故とは、道路交通法（昭和23年法律第105号）第72条1項の交通事故をいう。',
    '７．重大事故とは、自動車事故報告規則第2条の事故をいう。',
  ];
  notes.forEach(note => {
    doc.text(note, ML, y, { width: CONTENT_W, lineBreak: true });
    y += 9;
  });

  // 生成日時（フッター）
  const now = new Date();
  doc.font('Helvetica').fontSize(6).fillColor('#888')
    .text(
      `生成: ${now.toLocaleString('ja-JP')}　DumpTracker`,
      ML, PAGE_H - MB - 8,
      { width: CONTENT_W, align: 'right', lineBreak: false }
    );
}

// =====================================
// エクスポート関数
// =====================================

/**
 * 貨物自動車運送事業実績報告書PDFを生成する
 * @param data 集計データ（annualTransportReportService.ts から取得）
 * @param outputPath 出力ファイルパス
 * @returns ファイルサイズ（バイト）
 */
export async function generateAnnualTransportReportPDF(
  data: AnnualTransportReportData,
  outputPath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      ensureReportDirectory();
      const jpFont = findJapaneseFont();

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: MT, bottom: MB, left: ML, right: MR },
        autoFirstPage: false,
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      if (jpFont) {
        doc.registerFont('JpFont', jpFont);
      }

      doc.addPage();
      drawAnnualTransportReport(doc, data, jpFont ? 'JpFont' : null);
      doc.end();

      stream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        logger.info('[AnnualPDF] 生成完了', { outputPath, fileSize: stats.size });
        resolve(stats.size);
      });
      stream.on('error', (err: Error) => {
        logger.error('[AnnualPDF] 生成エラー', {
          error: { message: err.message, stack: err.stack },
          outputPath,
        });
        reject(err);
      });
    } catch (err) {
      logger.error('[AnnualPDF] 初期化エラー', {
        error: err instanceof Error ? err.message : String(err),
        outputPath,
      });
      reject(err);
    }
  });
}
