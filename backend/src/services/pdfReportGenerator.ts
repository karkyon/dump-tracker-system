// =====================================
// backend/src/services/pdfReportGenerator.ts
// 運転日報車両点検 PDF生成 - 帳票デザイン完全準拠版
// A4横向き・帳票フォーマット出力
// 修正: 2026-03-11 (修正指示A〜G全対応)
//   A: キロ始/終セル幅均等化
//   B: 業者名列幅2倍（82→164pt）
//   C: 空行積降場所の「—」削除
//   D: 積み込み時間を2行×3列構造（積込始/終/時間 + 積降始/終/時間）
//   E: 給油セクション下の空白行削除（1行化）
//   F: 署名欄を正方形デザイン
//   G: 点検行高さ半分（30→15pt）、措置列幅2倍（34→56pt）
// =====================================

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

// =====================================
// 定数
// =====================================

export const REPORTS_OUTPUT_DIR = path.join(process.cwd(), 'generated_reports');

// A4横向き: 841.89 × 595.28 pt
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN_L = 15;
const MARGIN_T = 12;
const CONTENT_W = PAGE_W - MARGIN_L * 2;  // 811.89

// セクション高さ定義
const TITLE_H = 22;
const HEADER_H = 26;
const COL_HEADER_H = 24;     // D対応: 2行ヘッダーのため高さ増加 (旧:16)
const OP_ROW_H = 34;         // 運行記録行（変更なし、2サブ行 each=17pt）
const OP_ROWS = 6;
const FUEL_H = 50;           // E/F対応: 1行化 + 正方形署名欄の高さ（旧:52）
const INSP_HEADER_H = 16;
const INSP_ROW_H = 15;       // G対応: 半分に縮小（旧:30）
const INSP_ROWS = 8;         // ⑦修正: 8行対応
const LEGEND_H = 14;

// 運行表カラム幅
const COL_CONTRACTOR = 115;  // ①修正: 現在幅の70%に縮小
const COL_LOADING = 128;     // 積込場所（変更なし）
const COL_UNLOADING = 128;   // 積降場所（変更なし）
const COL_ITEM = 68;         // ②修正: 現在幅の110%に拡大
const COL_COUNT = 32;        // 台数（変更なし）
const COL_TONS = 38;         // トン数（変更なし）
const COL_CONDITION = 38;    // 積付状況（変更なし）
// D対応: 積み込み時間列（残り幅 = 約221pt, 3等分 ≈ 73.6pt/sub-col）
const COL_TIME = CONTENT_W - COL_CONTRACTOR - COL_LOADING - COL_UNLOADING
               - COL_ITEM - COL_COUNT - COL_TONS - COL_CONDITION;

// 点検表（3列）
const INSP_GROUP_W = Math.floor(CONTENT_W / 3);   // ≈ 270
const INSP_PRE_W = 28;    // 乗車前（変更なし）
const INSP_POST_W = 28;   // 乗車後（変更なし）
const INSP_ACT_W = 56;    // G対応: 措置列幅2倍（旧:34, PRE/POST=28の2倍）
const INSP_ITEM_W = INSP_GROUP_W - INSP_PRE_W - INSP_POST_W - INSP_ACT_W;  // 点検項目名幅

// F対応: 署名欄の正方形サイズ（FUEL_H × FUEL_H）
const SIGN_CELL_W = FUEL_H;  // = 50pt（正方形）

// =====================================
// データ型定義
// =====================================

/** 1運行サイクル（積込→積降）の記録 */
export interface TripCycleRow {
  contractorName: string;       // 業者名
  loadingLocation: string;      // 積込場所
  unloadingLocation: string;    // 積降場所
  itemName: string;             // 品名
  vehicleCount: number;         // 台数
  quantityTons: number;         // トン数
  loadingCondition: string;     // 積付状況
  // D対応: 積込時間（3フィールド）
  loadingStartTime: string;     // 積込開始時刻 hh:mm (A-1)
  loadingEndTime: string;       // 積込終了時刻 hh:mm (A-2)
  loadingDuration: string;      // 積込所要時間 hh時間mm分 (A-3)
  // D対応: 積降時間（3フィールド）
  unloadingStartTime: string;   // 積降開始時刻 hh:mm (A-4)
  unloadingEndTime: string;     // 積降終了時刻 hh:mm (A-5)
  unloadingDuration: string;    // 積降所要時間 hh時間mm分 (A-6)
}

/** 点検チェック1項目 */
export interface InspCheckItem {
  name: string;        // 点検項目名
  preResult: string;   // 乗車前: 'レ' | '×' | ''
  postResult: string;  // 乗車後: 'レ' | '×' | ''
  measure: string;     // 措置
}

/** ⑤d: "X時間YY分" → "XX分" に変換（分のみ表示） */
function toMinutesOnly(duration: string): string {
  if (!duration) return '';
  // "X時間YY分" パターン
  const m1 = duration.match(/(\d+)時間(\d+)分/);
  if (m1) {
    const h = parseInt(m1[1] ?? '0', 10);
    const min = parseInt(m1[2] ?? '0', 10);
    return String(h * 60 + min) + '分';
  }
  // 既に "XX分" パターン
  if (/^\d+分$/.test(duration)) return duration;
  return duration;
}

/** 帳票全体データ */
export interface DailyDriverReportData {
  reportDate: string;             // YYYY-MM-DD
  dayOfWeek: string;              // 曜日
  driverName: string;             // 氏名
  vehiclePlateNumber: string;     // 車番
  startOdometer: string;          // キロ 始
  endOdometer: string;            // キロ 終
  trips: TripCycleRow[];          // 運行記録（最大6行）
  fuelLiters: string;             // 給油量 (L)
  fuelOdometerKm: string;         // 給油時キロ (km)
  oilLiters: string;              // オイル (L)
  hasGrease: boolean;             // グリス
  hasPuncture: boolean;           // パンク
  hasTireWear: boolean;           // タイヤ偏磨耗
  leftInspItems: InspCheckItem[];   // 点検左列
  middleInspItems: InspCheckItem[]; // 点検中列
  rightInspItems: InspCheckItem[];  // 点検右列（1項目）
  remarks: string;                // 備考
}

// =====================================
// ヘルパー関数
// =====================================

export function ensureReportDirectory(): void {
  if (!fs.existsSync(REPORTS_OUTPUT_DIR)) {
    fs.mkdirSync(REPORTS_OUTPUT_DIR, { recursive: true });
  }
}

function findJapaneseFont(): string | null {
  const candidates = [
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJKjp-Regular.otf',
    '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/usr/share/fonts/truetype/takao-gothic/TakaoGothic.ttf',
    '/usr/share/fonts/truetype/ipafont-gothic/ipag.ttf',
    '/usr/share/fonts/truetype/ipafont/ipag.ttf',
    '/usr/share/fonts/opentype/ipafont-gothic/ipag.otf',
    '/usr/share/fonts/truetype/vlgothic/VL-Gothic-Regular.ttf',
    '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
  ];
  for (const f of candidates) {
    if (fs.existsSync(f) && !f.endsWith('.ttc')) {
      logger.info(`[PDF] 日本語フォント: ${f}`);
      return f;
    }
  }
  logger.warn('[PDF] 日本語フォントが見つかりません。ASCII文字のみ表示されます。');
  return null;
}

function formatDate(dateStr: string): { year: string; month: string; day: string } {
  try {
    const d = new Date(dateStr);
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1),
      day: String(d.getDate()),
    };
  } catch {
    return { year: '', month: '', day: '' };
  }
}

/** セルを描画するユーティリティ */
function cell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: {
    font?: string;
    fallbackFont?: string;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    pad?: number;
    bg?: string;
    textColor?: string;
    lineWidth?: number;
    wrap?: boolean;
  } = {}
): void {
  const {
    font,
    fallbackFont = 'Helvetica',
    fontSize = 7,
    align = 'center',
    valign = 'middle',
    pad = 2,
    bg,
    textColor = '#000000',
    lineWidth = 0.5,
    wrap = false,
  } = opts;

  // 背景
  if (bg) {
    doc.rect(x, y, w, h).fillColor(bg).fill();
  }
  // 枠線
  doc.rect(x, y, w, h).strokeColor('#000000').lineWidth(lineWidth).stroke();

  if (!text) return;

  // テキスト描画
  const usedFont = font || fallbackFont;
  doc.font(usedFont).fontSize(fontSize).fillColor(textColor);

  const lineH = fontSize * 1.3;
  let ty: number;
  if (valign === 'top') {
    ty = y + pad;
  } else if (valign === 'bottom') {
    ty = y + h - lineH - pad;
  } else {
    ty = y + (h - lineH) / 2;
  }

  doc.text(text, x + pad, ty, {
    width: w - pad * 2,
    height: h - pad * 2,
    align,
    lineBreak: wrap,
  });
}

/**
 * テキストのみ描画（枠線なし）
 */
function label(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: {
    font?: string;
    fallbackFont?: string;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
    textColor?: string;
  } = {}
): void {
  const {
    font,
    fallbackFont = 'Helvetica',
    fontSize = 7,
    align = 'center',
    textColor = '#000000',
  } = opts;

  const usedFont = font || fallbackFont;
  doc.font(usedFont).fontSize(fontSize).fillColor(textColor);
  const lineH = fontSize * 1.3;
  const ty = y + (h - lineH) / 2;
  doc.text(text, x, ty, { width: w, align, lineBreak: false });
}

// =====================================
// 帳票セクション描画
// =====================================

/** タイトル行 */
function drawTitle(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  fontB: string
): void {
  doc.rect(x, y, w, h).strokeColor('#000000').lineWidth(1).stroke();
  doc.font(fontB).fontSize(13).fillColor('#000000');
  const ty = y + (h - 13 * 1.3) / 2;
  doc.text('運　転　日　報　車　両　点　検', x, ty, {
    width: w,
    align: 'center',
    characterSpacing: 2,
    lineBreak: false,
  });
}

/**
 * ヘッダー行（日付・氏名・車番・キロ）
 * [A修正] 始と終のセルを均等幅にする
 */
function drawHeaderRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  data: DailyDriverReportData,
  fontN: string,
  fontB: string
): void {
  const { year, month, day } = formatDate(data.reportDate);

  // 外枠
  doc.rect(x, y, w, h).strokeColor('#000000').lineWidth(0.5).stroke();

  let cx = x;
  const fLbl = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' };
  const fVal = { font: fontN, fontSize: 8 };

  // 年
  const yearLblW = 55; cell(doc, cx, y, yearLblW, h, '年', fLbl); cx += yearLblW;
  const yearValW = 35; cell(doc, cx, y, yearValW, h, year, fVal); cx += yearValW;

  // 月
  const monthLblW = 30; cell(doc, cx, y, monthLblW, h, '月', fLbl); cx += monthLblW;
  const monthValW = 28; cell(doc, cx, y, monthValW, h, month, fVal); cx += monthValW;

  // 日
  const dayLblW = 28; cell(doc, cx, y, dayLblW, h, '日', fLbl); cx += dayLblW;
  const dayValW = 28; cell(doc, cx, y, dayValW, h, day, fVal); cx += dayValW;

  // 曜日
  const dowLblW = 30; cell(doc, cx, y, dowLblW, h, '曜日', fLbl); cx += dowLblW;
  // ⑤b: 曜日から「曜」を除去して表示
  const dowDisplay = (data.dayOfWeek ?? '').replace('曜', '');
  const dowValW = 28; cell(doc, cx, y, dowValW, h, dowDisplay, fVal); cx += dowValW;

  // 氏名
  const nameLblW = 35; cell(doc, cx, y, nameLblW, h, '氏名', fLbl); cx += nameLblW;
  const nameValW = 90; cell(doc, cx, y, nameValW, h, data.driverName, fVal); cx += nameValW;

  // 車番
  const plateLblW = 32; cell(doc, cx, y, plateLblW, h, '車番', fLbl); cx += plateLblW;
  const plateValW = 80; cell(doc, cx, y, plateValW, h, data.vehiclePlateNumber, fVal); cx += plateValW;

  // キロ ラベル
  const kmLblW = 30; cell(doc, cx, y, kmLblW, h, 'キロ', fLbl); cx += kmLblW;

  // [A修正] 始と終のセル幅を均等化（残り幅の1/2ずつ）
  const kiloRemaining = x + w - cx;
  const kiloHalfW = Math.floor(kiloRemaining / 2);
  const kiloEndW = kiloRemaining - kiloHalfW;

  // 始（上段ラベル / 下段値）
  cell(doc, cx, y,          kiloHalfW, h / 2, '始', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 6, bg: '#F0F0F0' });
  // ⑤c: キロにカンマ + km単位付加
  const fmtKm = (v: string) => {
    if (!v) return '';
    const n = parseFloat(v.replace(/,/g, ''));
    if (isNaN(n)) return v;
    return n.toLocaleString('ja-JP') + 'km';
  };
  cell(doc, cx, y + h / 2,  kiloHalfW, h / 2, fmtKm(data.startOdometer), { font: fontN, fontSize: 7 });
  cx += kiloHalfW;

  // 終（上段ラベル / 下段値）
  cell(doc, cx, y,          kiloEndW,  h / 2, '終', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 6, bg: '#F0F0F0' });
  cell(doc, cx, y + h / 2,  kiloEndW,  h / 2, fmtKm(data.endOdometer), { font: fontN, fontSize: 7 });
}

/**
 * 運行記録テーブルのカラムヘッダー
 * [D修正] 積み込み時間を2行×3列ヘッダーに変更
 *         上行: 積込時間 | 積降時間
 *         下行: 始|終|時間 | 始|終|時間
 */
function drawOperationColHeaders(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  h: number,
  fontB: string
): void {
  const bg = '#E8E8E8';
  const f8 = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg };
  const f6 = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 6, bg };

  let cx = x;
  // [B対応] COL_CONTRACTOR=164で自動反映
  cell(doc, cx, y, COL_CONTRACTOR, h, '業者名', f8); cx += COL_CONTRACTOR;
  cell(doc, cx, y, COL_LOADING,    h, '積込場所', f8); cx += COL_LOADING;
  cell(doc, cx, y, COL_UNLOADING,  h, '積降場所', f8); cx += COL_UNLOADING;
  cell(doc, cx, y, COL_ITEM,       h, '品名', f8); cx += COL_ITEM;
  cell(doc, cx, y, COL_COUNT,      h, '台数', f8); cx += COL_COUNT;
  cell(doc, cx, y, COL_TONS,       h, 'トン数', f8); cx += COL_TONS;
  cell(doc, cx, y, COL_CONDITION,  h, '積付状況', f8); cx += COL_CONDITION;

  // [D修正] 積み込み時間列: 2行×3列ヘッダー
  // COL_TIME を左半分(積込)と右半分(積降)に分割
  const halfTimeW = Math.floor(COL_TIME / 2);
  const remTimeW = COL_TIME - halfTimeW;
  const subH = h / 2;  // 各サブ行の高さ

  // 上段ラベル: 積込時間 | 積降時間
  cell(doc, cx,            y, halfTimeW, subH, '積 込 時 間', f8);
  cell(doc, cx + halfTimeW, y, remTimeW,  subH, '積 降 時 間', f8);

  // 下段: 3サブ列ラベル（積込側）
  const sub1W = Math.floor(halfTimeW / 3);
  const sub2W = Math.floor(halfTimeW / 3);
  const sub3W = halfTimeW - sub1W - sub2W;
  cell(doc, cx,            y + subH, sub1W, subH, '始', f6);
  cell(doc, cx + sub1W,    y + subH, sub2W, subH, '終', f6);
  cell(doc, cx + sub1W + sub2W, y + subH, sub3W, subH, '時間', f6);

  // 下段: 3サブ列ラベル（積降側）
  const sub4W = Math.floor(remTimeW / 3);
  const sub5W = Math.floor(remTimeW / 3);
  const sub6W = remTimeW - sub4W - sub5W;
  cell(doc, cx + halfTimeW,           y + subH, sub4W, subH, '始', f6);
  cell(doc, cx + halfTimeW + sub4W,   y + subH, sub5W, subH, '終', f6);
  cell(doc, cx + halfTimeW + sub4W + sub5W, y + subH, sub6W, subH, '時間', f6);
}

/**
 * 運行記録6行
 * [B対応] COL_CONTRACTOR定数変更で自動反映
 * [C修正] 空行の積降場所の「—」を削除してブランク
 * [D修正] 時間セルを2行×3列構造（積込始/終/時間 + 積降始/終/時間）
 */
function drawOperationRows(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  trips: TripCycleRow[],
  fontN: string
): void {
  const fOpt = { font: fontN, fontSize: 7, align: 'center' as const };
  const fSmall = { font: fontN, fontSize: 6, align: 'center' as const };

  // 時間列のサブ幅計算（D対応）
  const halfTimeW = Math.floor(COL_TIME / 2);
  const remTimeW = COL_TIME - halfTimeW;
  const sub1W = Math.floor(halfTimeW / 3);
  const sub2W = Math.floor(halfTimeW / 3);
  const sub3W = halfTimeW - sub1W - sub2W;
  const sub4W = Math.floor(remTimeW / 3);
  const sub5W = Math.floor(remTimeW / 3);
  const sub6W = remTimeW - sub4W - sub5W;
  const subRowH = OP_ROW_H / 2;

  for (let i = 0; i < OP_ROWS; i++) {
    const ry = y + i * OP_ROW_H;
    const trip = trips[i];
    let cx = x;

    if (trip) {
      // データあり行
      cell(doc, cx, ry, COL_CONTRACTOR, OP_ROW_H, trip.contractorName,   { ...fOpt, align: 'left', pad: 3 }); cx += COL_CONTRACTOR;
      cell(doc, cx, ry, COL_LOADING,    OP_ROW_H, trip.loadingLocation,   { ...fOpt, align: 'left', pad: 3 }); cx += COL_LOADING;
      // [C対応] データあり行は積降場所をそのまま表示
      cell(doc, cx, ry, COL_UNLOADING,  OP_ROW_H, trip.unloadingLocation, { ...fOpt, align: 'left', pad: 3 }); cx += COL_UNLOADING;
      cell(doc, cx, ry, COL_ITEM,       OP_ROW_H, trip.itemName,          {...fOpt, wrap: true, align: 'left', pad: 2}); cx += COL_ITEM;  // ②修正: 全品目wrap表示
      cell(doc, cx, ry, COL_COUNT,      OP_ROW_H, trip.vehicleCount > 0 ? String(trip.vehicleCount) : '', fOpt); cx += COL_COUNT;
      cell(doc, cx, ry, COL_TONS,       OP_ROW_H, trip.quantityTons > 0 ? String(trip.quantityTons) : '',  fOpt); cx += COL_TONS;
      cell(doc, cx, ry, COL_CONDITION,  OP_ROW_H, '',  fOpt); cx += COL_CONDITION;  // ③修正: 積付状況非表示

      // ⑥修正: 積込時間（上段）+ 下段空行で枠線確保
      cell(doc, cx,          ry,           sub1W, subRowH, trip.loadingStartTime,  fSmall);
      cell(doc, cx + sub1W,  ry,           sub2W, subRowH, trip.loadingEndTime,    fSmall);
      cell(doc, cx + sub1W + sub2W, ry,    sub3W, subRowH, toMinutesOnly(trip.loadingDuration),   fSmall);
      cell(doc, cx,          ry + subRowH, sub1W, subRowH, '');
      cell(doc, cx + sub1W,  ry + subRowH, sub2W, subRowH, '');
      cell(doc, cx + sub1W + sub2W, ry + subRowH, sub3W, subRowH, '');
      // ⑥修正: 積降時間（上段）+ 下段空行で枠線確保
      cell(doc, cx + halfTimeW,           ry,           sub4W, subRowH, trip.unloadingStartTime,  fSmall);
      cell(doc, cx + halfTimeW + sub4W,   ry,           sub5W, subRowH, trip.unloadingEndTime,    fSmall);
      cell(doc, cx + halfTimeW + sub4W + sub5W, ry,     sub6W, subRowH, toMinutesOnly(trip.unloadingDuration),   fSmall);
      cell(doc, cx + halfTimeW,           ry + subRowH, sub4W, subRowH, '');
      cell(doc, cx + halfTimeW + sub4W,   ry + subRowH, sub5W, subRowH, '');
      cell(doc, cx + halfTimeW + sub4W + sub5W, ry + subRowH, sub6W, subRowH, '');

    } else {
      // [C修正] 空行: 積降場所は「—」なしのブランク
      cell(doc, cx, ry, COL_CONTRACTOR, OP_ROW_H, ''); cx += COL_CONTRACTOR;
      cell(doc, cx, ry, COL_LOADING,    OP_ROW_H, ''); cx += COL_LOADING;
      cell(doc, cx, ry, COL_UNLOADING,  OP_ROW_H, ''); cx += COL_UNLOADING;  // [C修正] '—'→''
      cell(doc, cx, ry, COL_ITEM,       OP_ROW_H, ''); cx += COL_ITEM;
      cell(doc, cx, ry, COL_COUNT,      OP_ROW_H, ''); cx += COL_COUNT;
      cell(doc, cx, ry, COL_TONS,       OP_ROW_H, ''); cx += COL_TONS;
      cell(doc, cx, ry, COL_CONDITION,  OP_ROW_H, ''); cx += COL_CONDITION;

      // [D修正] 空行の時間セル（6サブセル）
      cell(doc, cx,          ry,      sub1W, subRowH, '');
      cell(doc, cx + sub1W,  ry,      sub2W, subRowH, '');
      cell(doc, cx + sub1W + sub2W, ry, sub3W, subRowH, '');
      cell(doc, cx + halfTimeW,        ry, sub4W, subRowH, '');
      cell(doc, cx + halfTimeW + sub4W, ry, sub5W, subRowH, '');
      cell(doc, cx + halfTimeW + sub4W + sub5W, ry, sub6W, subRowH, '');

      // 積込と積降の空白下サブ行
      cell(doc, cx,          ry + subRowH, sub1W, subRowH, '');
      cell(doc, cx + sub1W,  ry + subRowH, sub2W, subRowH, '');
      cell(doc, cx + sub1W + sub2W, ry + subRowH, sub3W, subRowH, '');
      cell(doc, cx + halfTimeW,        ry + subRowH, sub4W, subRowH, '');
      cell(doc, cx + halfTimeW + sub4W, ry + subRowH, sub5W, subRowH, '');
      cell(doc, cx + halfTimeW + sub4W + sub5W, ry + subRowH, sub6W, subRowH, '');
    }
  }
}

/**
 * 給油・署名セクション
 * [E修正] 下段空白行を削除（1行のみ: rowH = FUEL_H）
 * [F修正] 署名欄を正方形デザイン（幅=高さ=FUEL_H=50pt）
 */
function drawFuelSection(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  data: DailyDriverReportData,
  fontN: string,
  fontB: string
): void {
  const rowH = FUEL_H;  // [E修正] 1行のみ（旧: 2行 = FUEL_H/2 × 2）
  const bg = '#E8E8E8';
  const fLabel = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg };
  const fVal   = { font: fontN, fontSize: 8 };

  // [F修正] 署名欄は正方形: 幅=FUEL_H（=SIGN_CELL_W=50pt）× 3人分
  const signAreaW = SIGN_CELL_W * 3;  // = 150pt
  const fuelAreaW = w - signAreaW;

  let cx = x;

  // ── 給油量 ──
  const fuelLblW = 40;
  cell(doc, cx, y, fuelLblW, rowH, '給油量', fLabel); cx += fuelLblW;
  const fuelValW = 45;
  cell(doc, cx, y, fuelValW, rowH, data.fuelLiters, fVal); cx += fuelValW;
  const fuelUnitW = 16;
  cell(doc, cx, y, fuelUnitW, rowH, 'ℓ', fLabel); cx += fuelUnitW;

  // ── 給油時キロ ──
  const fuelKmLblW = 50;
  cell(doc, cx, y, fuelKmLblW, rowH, '給油時キロ', fLabel); cx += fuelKmLblW;
  const fuelKmValW = 35;
  cell(doc, cx, y, fuelKmValW, rowH, data.fuelOdometerKm, fVal); cx += fuelKmValW;
  const fuelKmUnitW = 18;
  cell(doc, cx, y, fuelKmUnitW, rowH, 'km', fLabel); cx += fuelKmUnitW;

  // ── オイル ──
  const oilLblW = 32;
  cell(doc, cx, y, oilLblW, rowH, 'オイル', fLabel); cx += oilLblW;
  const oilValW = 32;
  cell(doc, cx, y, oilValW, rowH, data.oilLiters, fVal); cx += oilValW;
  const oilUnitW = 16;
  cell(doc, cx, y, oilUnitW, rowH, 'ℓ', fLabel); cx += oilUnitW;

  // ── グリス ──
  const greaseLblW = 30;
  cell(doc, cx, y, greaseLblW, rowH, 'グリス', fLabel); cx += greaseLblW;
  const greaseValW = 28;
  cell(doc, cx, y, greaseValW, rowH, data.hasGrease ? 'レ' : '', fVal); cx += greaseValW;

  // ── パンク ──
  const punctureLblW = 28;
  cell(doc, cx, y, punctureLblW, rowH, 'パンク', fLabel); cx += punctureLblW;
  const punctureValW = 28;
  cell(doc, cx, y, punctureValW, rowH, data.hasPuncture ? 'レ' : '', fVal); cx += punctureValW;

  // ── タイヤ偏磨耗 ──
  const tireLblW = 50;
  cell(doc, cx, y, tireLblW, rowH, 'タイヤ偏磨耗', { ...fLabel, fontSize: 6.5 }); cx += tireLblW;
  const tireValW = 28;
  cell(doc, cx, y, tireValW, rowH, data.hasTireWear ? 'レ' : '', fVal); cx += tireValW;

  // ── 給油エリアの残りスペース（スペーサー）──
  const usedFuelW = cx - x;
  if (usedFuelW < fuelAreaW) {
    cell(doc, cx, y, fuelAreaW - usedFuelW, rowH, '');
    cx = x + fuelAreaW;
  }

  // [F修正] 署名欄: 正方形セル (SIGN_CELL_W × FUEL_H = 50 × 50pt)
  const roles = ['運転手', '運行管理者', '整備管理者'];
  roles.forEach((role, i) => {
    const cellW = SIGN_CELL_W;
    // 外枠（正方形）
    doc.rect(cx, y, cellW, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
    // ラベル（上部に小さく表示）
    doc.font(fontB).fontSize(6.5).fillColor('#000000');
    doc.text(role, cx + 2, y + 3, { width: cellW - 4, align: 'center', lineBreak: false });
    cx += cellW;
  });
}

/**
 * 点検チェックリスト ヘッダー行
 * ⑦修正: 2列(各8行) + 備考エリアヘッダー
 */
function drawInspHeaderRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  h: number,
  fontB: string
): void {
  const bg = '#E0E0E0';
  const fB = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 6.5, bg };
  const remarksW = CONTENT_W - INSP_GROUP_W * 2;

  // 左・右2グループ（各: 点検項目|乗車前|乗車後|措置）
  for (let g = 0; g < 2; g++) {
    const gx = x + g * INSP_GROUP_W;
    let cx = gx;
    cell(doc, cx, y, INSP_ITEM_W, h, '点　検　項　目', fB); cx += INSP_ITEM_W;
    cell(doc, cx, y, INSP_PRE_W,  h, '乗車前', fB); cx += INSP_PRE_W;
    cell(doc, cx, y, INSP_POST_W, h, '乗車後', fB); cx += INSP_POST_W;
    cell(doc, cx, y, INSP_ACT_W,  h, '措置', fB);
  }

  // 備考ヘッダー
  const remarksX = x + INSP_GROUP_W * 2;
  cell(doc, remarksX, y, remarksW, h, '備　考',
    { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg });
}

/**
 * 点検チェックリスト 1行描画
 * ⑦修正: 左・右2列のみ（備考エリアはdrawRemarksAreaで別途描画）
 */
function drawInspRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  rowIdx: number,
  leftItem: InspCheckItem | undefined,
  middleItem: InspCheckItem | undefined,
  fontN: string,
  _fontB: string
): void {
  const fN = { font: fontN, fontSize: 6.5 };

  // 左列（1〜8項目）
  {
    let cx = x;
    const item = leftItem;
    const bg = rowIdx % 2 === 0 ? undefined : '#FAFAFA';
    cell(doc, cx, y, INSP_ITEM_W, INSP_ROW_H, item?.name ?? '', { ...fN, align: 'left', pad: 3, bg }); cx += INSP_ITEM_W;
    cell(doc, cx, y, INSP_PRE_W,  INSP_ROW_H, item?.preResult  ?? '', { ...fN, fontSize: 7 }); cx += INSP_PRE_W;
    cell(doc, cx, y, INSP_POST_W, INSP_ROW_H, item?.postResult ?? '', { ...fN, fontSize: 7 }); cx += INSP_POST_W;
    cell(doc, cx, y, INSP_ACT_W,  INSP_ROW_H, item?.measure    ?? '', { ...fN, fontSize: 6 });
  }

  // 右列（9〜16項目）
  {
    let cx = x + INSP_GROUP_W;
    const item = middleItem;
    const bg = rowIdx % 2 === 0 ? undefined : '#FAFAFA';
    cell(doc, cx, y, INSP_ITEM_W, INSP_ROW_H, item?.name ?? '', { ...fN, align: 'left', pad: 3, bg }); cx += INSP_ITEM_W;
    cell(doc, cx, y, INSP_PRE_W,  INSP_ROW_H, item?.preResult  ?? '', { ...fN, fontSize: 7 }); cx += INSP_PRE_W;
    cell(doc, cx, y, INSP_POST_W, INSP_ROW_H, item?.postResult ?? '', { ...fN, fontSize: 7 }); cx += INSP_POST_W;
    cell(doc, cx, y, INSP_ACT_W,  INSP_ROW_H, item?.measure    ?? '', { ...fN, fontSize: 6 });
  }
}

/**
 * 備考エリアコンテンツ描画（ヘッダーはdrawInspHeaderRowで描画済み）
 * ⑦修正: 8行分の高さで備考テキストエリアを描画
 */
function drawRemarksArea(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  totalH: number,
  remarks: string,
  fontN: string
): void {
  const areaW = CONTENT_W - (x - MARGIN_L);
  doc.rect(x, y, areaW, totalH).strokeColor('#000000').lineWidth(0.5).stroke();
  if (remarks) {
    doc.font(fontN).fontSize(7).fillColor('#000000');
    doc.text(remarks, x + 3, y + 3, {
      width: areaW - 6,
      height: totalH - 6,
      lineBreak: true,
    });
  }
}

// =====================================
// メイン描画関数
// =====================================

function drawDailyDriverReport(
  doc: PDFKit.PDFDocument,
  data: DailyDriverReportData,
  japaneseFont: string | null
): void {
  const fontN = japaneseFont || 'Helvetica';
  const fontB = japaneseFont || 'Helvetica-Bold';

  const x0 = MARGIN_L;
  let y = MARGIN_T;

  // ① タイトル
  drawTitle(doc, x0, y, CONTENT_W, TITLE_H, fontB);
  y += TITLE_H;

  // ② ヘッダー行 [A修正: 始/終均等幅]
  drawHeaderRow(doc, x0, y, CONTENT_W, HEADER_H, data, fontN, fontB);
  y += HEADER_H;

  // ③ 運行記録カラムヘッダー [D修正: 2行×3列]
  drawOperationColHeaders(doc, x0, y, COL_HEADER_H, fontB);
  y += COL_HEADER_H;

  // ④ 運行記録6行 [B/C/D修正]
  drawOperationRows(doc, x0, y, data.trips, fontN);
  y += OP_ROW_H * OP_ROWS;

  // ⑤ 給油・署名セクション [E/F修正: 1行 + 正方形署名欄]
  drawFuelSection(doc, x0, y, CONTENT_W, data, fontN, fontB);
  y += FUEL_H;

  // ⑥ 点検チェックリスト ヘッダー
  drawInspHeaderRow(doc, x0, y, INSP_HEADER_H, fontB);
  y += INSP_HEADER_H;

  // ⑦修正: 点検行（8行×2列）+ 備考エリア（全8行高さ）
  const remarksX = x0 + INSP_GROUP_W * 2;

  for (let i = 0; i < INSP_ROWS; i++) {
    const ry = y + i * INSP_ROW_H;
    drawInspRow(
      doc, x0, ry, i,
      data.leftInspItems[i],
      data.middleInspItems[i],
      fontN, fontB
    );
  }

  // 備考エリア（8行全体の高さ = INSP_ROW_H * INSP_ROWS）
  drawRemarksArea(doc, remarksX, y, INSP_ROW_H * INSP_ROWS, data.remarks, fontN);

  // ⑧ 凡例
  y += INSP_ROW_H * INSP_ROWS + 2;
  doc.font(fontN).fontSize(7).fillColor('#000000')
    .text('レ……異常なし　　×……要修理調整', x0 + 2, y, { lineBreak: false });
}

// =====================================
// エクスポート関数
// =====================================

/**
 * 運転日報車両点検 PDFを生成する（帳票デザイン準拠版）
 * 修正指示A〜G全対応版
 * @param data 帳票データ
 * @param outputPath 出力ファイルパス
 * @returns ファイルサイズ（バイト）
 */
export async function generateDailyDriverReportPDF(
  data: DailyDriverReportData,
  outputPath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      ensureReportDirectory();
      const japaneseFont = findJapaneseFont();

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: MARGIN_T, bottom: 12, left: MARGIN_L, right: MARGIN_L },
        autoFirstPage: false,
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      if (japaneseFont) {
        doc.registerFont('JpFont', japaneseFont);
      }

      doc.addPage();
      drawDailyDriverReport(doc, data, japaneseFont ? 'JpFont' : null);

      doc.end();

      stream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        logger.info('[PDF] 運転日報生成完了', { outputPath, fileSize: stats.size });
        resolve(stats.size);
      });
      stream.on('error', (error: Error) => {
        logger.error('[PDF] 運転日報生成エラー', {
          error: { message: error.message, stack: error.stack, name: error.name },
          outputPath,
        });
        reject(error);
      });
    } catch (error) {
      logger.error('[PDF] 運転日報生成エラー（初期化）', {
        error: error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
        outputPath,
      });
      reject(error);
    }
  });
}

// =====================================
// 後方互換性（旧インターフェース維持）
// =====================================

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

export interface OperationData {
  operationNumber: string;
  driverName: string;
  vehiclePlateNumber: string;
  vehicleModel?: string;
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

export interface ReportSummary {
  totalOperations: number;
  completedOperations: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  totalFuelCostYen: number;
  totalQuantityTons: number;
}

export interface DailyReportData {
  reportDate: string;
  companyName: string;
  operations: OperationData[];
  summary: ReportSummary;
}

/**
 * @deprecated generateDailyDriverReportPDF を使用してください
 * 後方互換性のため残存。
 */
export async function generateDailyReportPDF(
  _data: DailyReportData,
  outputPath: string
): Promise<number> {
  logger.warn('[PDF] generateDailyReportPDF は非推奨です。reportService.ts を確認してください。');
  return new Promise((resolve, reject) => {
    ensureReportDirectory();
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc.fontSize(12).text('レポート生成エラー: 旧インターフェースが呼ばれています。', 40, 40);
    doc.end();
    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      resolve(stats.size);
    });
    stream.on('error', reject);
  });
}
