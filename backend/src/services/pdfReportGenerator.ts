// =====================================
// backend/src/services/pdfReportGenerator.ts
// 運転日報車両点検 PDF生成 - 帳票デザイン完全準拠版
// A4横向き・帳票フォーマット出力
// 最終更新: 2026-03-10
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
const COL_HEADER_H = 16;
const OP_ROW_H = 34;        // 運行記録行
const OP_ROWS = 6;
const FUEL_H = 52;
const INSP_HEADER_H = 16;
const INSP_ROW_H = 30;      // 点検行
const INSP_ROWS = 6;
const LEGEND_H = 14;

// 運行表カラム幅
const COL_CONTRACTOR = 82;   // 業者名
const COL_LOADING = 128;     // 積込場所
const COL_UNLOADING = 128;   // 積降場所
const COL_ITEM = 62;         // 品名
const COL_COUNT = 32;        // 台数
const COL_TONS = 38;         // トン数
const COL_CONDITION = 38;    // 積付状況
const COL_TIME = CONTENT_W - COL_CONTRACTOR - COL_LOADING - COL_UNLOADING - COL_ITEM - COL_COUNT - COL_TONS - COL_CONDITION; // 積み込み時間

// 点検表（3列）
const INSP_GROUP_W = Math.floor(CONTENT_W / 3);     // 約270
const INSP_ITEM_W = INSP_GROUP_W - 28 - 28 - 34;   // 項目名幅
const INSP_PRE_W = 28;   // 乗車前
const INSP_POST_W = 28;  // 乗車後
const INSP_ACT_W = 34;   // 措置

// =====================================
// データ型定義
// =====================================

/** 1運行サイクル（積込→積降）の記録 */
export interface TripCycleRow {
  contractorName: string;      // 業者名
  loadingLocation: string;     // 積込場所
  unloadingLocation: string;   // 積降場所
  itemName: string;            // 品名
  vehicleCount: number;        // 台数
  quantityTons: number;        // トン数
  loadingCondition: string;    // 積付状況
  loadingStartTime: string;    // 積み込み時間 開始
  loadingEndTime: string;      // 積み込み時間 終了
}

/** 点検チェック1項目 */
export interface InspCheckItem {
  name: string;        // 点検項目名
  preResult: string;   // 乗車前: 'レ' | '×' | ''
  postResult: string;  // 乗車後: 'レ' | '×' | ''
  measure: string;     // 措置
}

/** 帳票全体データ */
export interface DailyDriverReportData {
  reportDate: string;            // YYYY-MM-DD
  dayOfWeek: string;             // 曜日
  driverName: string;            // 氏名
  vehiclePlateNumber: string;    // 車番
  startOdometer: string;         // キロ 始
  endOdometer: string;           // キロ 終
  trips: TripCycleRow[];         // 運行記録（最大6行）
  fuelLiters: string;            // 給油量 (L)
  fuelOdometerKm: string;        // 給油時キロ (km)
  oilLiters: string;             // オイル (L)
  hasGrease: boolean;            // グリス
  hasPuncture: boolean;          // パンク
  hasTireWear: boolean;          // タイヤ偏磨耗
  leftInspItems: InspCheckItem[];    // 点検左列
  middleInspItems: InspCheckItem[];  // 点検中列
  rightInspItems: InspCheckItem[];   // 点検右列（1項目）
  remarks: string;               // 備考
}

// =====================================
// ヘルパー関数
// =====================================

export function ensureReportDirectory(): void {
  if (!fs.existsSync(REPORTS_OUTPUT_DIR)) {
    fs.mkdirSync(REPORTS_OUTPUT_DIR, { recursive: true });
    logger.info(`[PDF] レポート出力ディレクトリを作成: ${REPORTS_OUTPUT_DIR}`);
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

// =====================================
// 描画ヘルパー
// =====================================

/**
 * セル描画（枠線 + テキスト）
 */
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
  font: string
): void {
  doc.rect(x, y, w, h).strokeColor('#000000').lineWidth(1).stroke();
  doc.font(font).fontSize(13).fillColor('#000000');
  const ty = y + (h - 13 * 1.3) / 2;
  doc.text('運　転　日　報　車　両　点　検', x, ty, {
    width: w,
    align: 'center',
    characterSpacing: 2,
    lineBreak: false,
  });
}

/** ヘッダー行（日付・氏名・車番・キロ） */
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

  // 枠
  doc.rect(x, y, w, h).strokeColor('#000000').lineWidth(0.5).stroke();

  // 年月日エリア（左から）
  let cx = x;

  // 年
  const yearW = 55;
  cell(doc, cx, y, yearW, h, '年', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' });
  cx += yearW;

  // 年の値
  const yearValW = 35;
  cell(doc, cx, y, yearValW, h, year, { font: fontN, fontSize: 8 });
  cx += yearValW;

  // 月
  const monthW = 30;
  cell(doc, cx, y, monthW, h, '月', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' });
  cx += monthW;

  const monthValW = 28;
  cell(doc, cx, y, monthValW, h, month, { font: fontN, fontSize: 8 });
  cx += monthValW;

  // 日
  const dayW = 28;
  cell(doc, cx, y, dayW, h, '日', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' });
  cx += dayW;

  const dayValW = 28;
  cell(doc, cx, y, dayValW, h, day, { font: fontN, fontSize: 8 });
  cx += dayValW;

  // 曜日
  const dowW = 30;
  cell(doc, cx, y, dowW, h, '曜日', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' });
  cx += dowW;

  const dowValW = 28;
  cell(doc, cx, y, dowValW, h, data.dayOfWeek, { font: fontN, fontSize: 8 });
  cx += dowValW;

  // 氏名
  const nameW = 35;
  cell(doc, cx, y, nameW, h, '氏名', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' });
  cx += nameW;

  const nameValW = 90;
  cell(doc, cx, y, nameValW, h, data.driverName, { font: fontN, fontSize: 8 });
  cx += nameValW;

  // 車番
  const plateW = 32;
  cell(doc, cx, y, plateW, h, '車番', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' });
  cx += plateW;

  const plateValW = 80;
  cell(doc, cx, y, plateValW, h, data.vehiclePlateNumber, { font: fontN, fontSize: 8 });
  cx += plateValW;

  // キロ
  const kmLabelW = 30;
  cell(doc, cx, y, kmLabelW, h, 'キロ', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#F0F0F0' });
  cx += kmLabelW;

  // 始
  const kiloStartW = 30;
  cell(doc, cx, y, kiloStartW, h / 2, '始', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 6, bg: '#F0F0F0' });
  cell(doc, cx, y + h / 2, kiloStartW, h / 2, data.startOdometer, { font: fontN, fontSize: 7 });
  cx += kiloStartW;

  // 終
  const kiloEndW = x + w - cx;
  cell(doc, cx, y, kiloEndW, h / 2, '終', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 6, bg: '#F0F0F0' });
  cell(doc, cx, y + h / 2, kiloEndW, h / 2, data.endOdometer, { font: fontN, fontSize: 7 });
}

/** 運行記録テーブルのカラムヘッダー */
function drawOperationColHeaders(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  h: number,
  fontB: string
): void {
  const bg = '#E8E8E8';
  const f8 = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg };

  let cx = x;
  // 業者名（縦書き調）
  cell(doc, cx, y, COL_CONTRACTOR, h, '業者名', f8); cx += COL_CONTRACTOR;
  cell(doc, cx, y, COL_LOADING, h, '積込場所', f8); cx += COL_LOADING;
  cell(doc, cx, y, COL_UNLOADING, h, '積降場所', f8); cx += COL_UNLOADING;
  cell(doc, cx, y, COL_ITEM, h, '品名', f8); cx += COL_ITEM;
  cell(doc, cx, y, COL_COUNT, h, '台数', f8); cx += COL_COUNT;
  cell(doc, cx, y, COL_TONS, h, 'トン数', f8); cx += COL_TONS;
  cell(doc, cx, y, COL_CONDITION, h, '積付状況', f8); cx += COL_CONDITION;
  // 積み込み時間は右端まで
  const timeW = x + CONTENT_W - cx;
  // 積み込み時間ヘッダー（2分割: 始/終）
  const timeHalfW = timeW / 2;
  cell(doc, cx, y, timeW, h / 2, '積 み 込 み 時 間', f8);
  cell(doc, cx, y + h / 2, timeHalfW, h / 2, '始', f8);
  cell(doc, cx + timeHalfW, y + h / 2, timeHalfW, h / 2, '終', f8);
}

/** 運行記録6行 */
function drawOperationRows(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  trips: TripCycleRow[],
  fontN: string
): void {
  const fOpt = { font: fontN, fontSize: 7, align: 'center' as const };

  for (let i = 0; i < OP_ROWS; i++) {
    const ry = y + i * OP_ROW_H;
    const trip = trips[i];
    let cx = x;

    if (trip) {
      cell(doc, cx, ry, COL_CONTRACTOR, OP_ROW_H, trip.contractorName, { ...fOpt, align: 'left', pad: 3 }); cx += COL_CONTRACTOR;
      cell(doc, cx, ry, COL_LOADING, OP_ROW_H, trip.loadingLocation, { ...fOpt, align: 'left', pad: 3 }); cx += COL_LOADING;
      cell(doc, cx, ry, COL_UNLOADING, OP_ROW_H, trip.unloadingLocation, { ...fOpt, align: 'left', pad: 3 }); cx += COL_UNLOADING;
      cell(doc, cx, ry, COL_ITEM, OP_ROW_H, trip.itemName, { ...fOpt, align: 'center' }); cx += COL_ITEM;
      cell(doc, cx, ry, COL_COUNT, OP_ROW_H, trip.vehicleCount > 0 ? String(trip.vehicleCount) : '', fOpt); cx += COL_COUNT;
      cell(doc, cx, ry, COL_TONS, OP_ROW_H, trip.quantityTons > 0 ? String(trip.quantityTons) : '', fOpt); cx += COL_TONS;
      cell(doc, cx, ry, COL_CONDITION, OP_ROW_H, trip.loadingCondition, fOpt); cx += COL_CONDITION;

      // 積み込み時間
      const timeW = x + CONTENT_W - cx;
      const timeHalfW = timeW / 2;
      cell(doc, cx, ry, timeHalfW, OP_ROW_H, trip.loadingStartTime, fOpt);
      cell(doc, cx + timeHalfW, ry, timeHalfW, OP_ROW_H, trip.loadingEndTime, fOpt);
    } else {
      // 空行
      cell(doc, cx, ry, COL_CONTRACTOR, OP_ROW_H, ''); cx += COL_CONTRACTOR;
      cell(doc, cx, ry, COL_LOADING, OP_ROW_H, ''); cx += COL_LOADING;
      // 積降場所に「—」区切り
      cell(doc, cx, ry, COL_UNLOADING, OP_ROW_H, '—', { font: fontN, fontSize: 8 }); cx += COL_UNLOADING;
      cell(doc, cx, ry, COL_ITEM, OP_ROW_H, ''); cx += COL_ITEM;
      cell(doc, cx, ry, COL_COUNT, OP_ROW_H, ''); cx += COL_COUNT;
      cell(doc, cx, ry, COL_TONS, OP_ROW_H, ''); cx += COL_TONS;
      cell(doc, cx, ry, COL_CONDITION, OP_ROW_H, ''); cx += COL_CONDITION;
      const timeW = x + CONTENT_W - cx;
      const timeHalfW = timeW / 2;
      cell(doc, cx, ry, timeHalfW, OP_ROW_H, '');
      cell(doc, cx + timeHalfW, ry, timeHalfW, OP_ROW_H, '');
    }
  }
}

/** 給油・署名セクション */
function drawFuelSection(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  data: DailyDriverReportData,
  fontN: string,
  fontB: string
): void {
  const bg = '#E8E8E8';
  const fLabel = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg };
  const fVal = { font: fontN, fontSize: 8 };

  // 上段高さ / 下段高さ
  const rowH = FUEL_H / 2;
  let cx = x;

  // --- 上段: 給油量 / 給油時キロ / オイル / グリス / パンク / タイヤ偏磨耗 ---
  // 給油量
  const fuelLabelW = 40;
  cell(doc, cx, y, fuelLabelW, rowH, '給油量', fLabel);
  cx += fuelLabelW;
  const fuelUnitW = 16;
  cell(doc, cx, y, fuelUnitW, rowH, 'ℓ', { ...fLabel });
  cx += fuelUnitW;
  const fuelValW = 45;
  cell(doc, cx, y, fuelValW, rowH, data.fuelLiters, fVal);
  cx += fuelValW;

  // 給油時キロ
  const fuelKmLabelW = 50;
  cell(doc, cx, y, fuelKmLabelW, rowH, '給油時キロ', fLabel);
  cx += fuelKmLabelW;
  const fuelKmValW = 35;
  cell(doc, cx, y, fuelKmValW, rowH, data.fuelOdometerKm, fVal);
  cx += fuelKmValW;
  const fuelKmUnitW = 18;
  cell(doc, cx, y, fuelKmUnitW, rowH, 'km', { ...fLabel });
  cx += fuelKmUnitW;

  // オイル
  const oilLabelW = 32;
  cell(doc, cx, y, oilLabelW, rowH, 'オイル', fLabel);
  cx += oilLabelW;
  const oilValW = 32;
  cell(doc, cx, y, oilValW, rowH, data.oilLiters, fVal);
  cx += oilValW;
  const oilUnitW = 16;
  cell(doc, cx, y, oilUnitW, rowH, 'ℓ', { ...fLabel });
  cx += oilUnitW;

  // グリス
  const greaseLabelW = 30;
  cell(doc, cx, y, greaseLabelW, rowH, 'グリス', fLabel);
  cx += greaseLabelW;
  const greaseValW = 28;
  cell(doc, cx, y, greaseValW, rowH, data.hasGrease ? 'レ' : '', fVal);
  cx += greaseValW;

  // パンク
  const punctureLabelW = 28;
  cell(doc, cx, y, punctureLabelW, rowH, 'パンク', fLabel);
  cx += punctureLabelW;
  const punctureValW = 28;
  cell(doc, cx, y, punctureValW, rowH, data.hasPuncture ? 'レ' : '', fVal);
  cx += punctureValW;

  // タイヤ偏磨耗
  const tireLabelW = 50;
  cell(doc, cx, y, tireLabelW, rowH, 'タイヤ偏磨耗', { ...fLabel, fontSize: 6.5 });
  cx += tireLabelW;
  const tireValW = 28;
  cell(doc, cx, y, tireValW, rowH, data.hasTireWear ? 'レ' : '', fVal);
  cx += tireValW;

  // 残りスペースは署名欄 (3分割)
  const signAreaW = x + w - cx;
  const signW = Math.floor(signAreaW / 3);

  // 上段: 署名ラベル
  cell(doc, cx, y, signW, rowH, '運転手', fLabel);
  cell(doc, cx + signW, y, signW, rowH, '運行管理者', fLabel);
  cell(doc, cx + signW * 2, y, signAreaW - signW * 2, rowH, '整備管理者', fLabel);

  // 下段: 署名スペース
  cell(doc, cx, y + rowH, signW, rowH, '');
  cell(doc, cx + signW, y + rowH, signW, rowH, '');
  cell(doc, cx + signW * 2, y + rowH, signAreaW - signW * 2, rowH, '');

  // 下段（給油部分）: 空欄
  cx = x;
  const lowerW = x + w - signAreaW - cx;
  // 下段は空白（幅は上段の給油エリア分）
  const upperFuelW = fuelLabelW + fuelUnitW + fuelValW + fuelKmLabelW + fuelKmValW + fuelKmUnitW +
    oilLabelW + oilValW + oilUnitW + greaseLabelW + greaseValW + punctureLabelW + punctureValW +
    tireLabelW + tireValW;
  cell(doc, x, y + rowH, upperFuelW, rowH, '');
}

/** 点検チェックリスト ヘッダー行 */
function drawInspHeaderRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  h: number,
  fontB: string
): void {
  const bg = '#E0E0E0';
  const fB = { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 6.5, bg };

  // 3グループそれぞれにヘッダー
  for (let g = 0; g < 3; g++) {
    const gx = x + g * INSP_GROUP_W;
    let cx = gx;

    const itemW = g === 2 ? INSP_GROUP_W - INSP_PRE_W - INSP_POST_W - INSP_ACT_W : INSP_ITEM_W;

    cell(doc, cx, y, itemW, h, '点　検　項　目', fB); cx += itemW;
    cell(doc, cx, y, INSP_PRE_W, h, '乗車前', fB); cx += INSP_PRE_W;
    cell(doc, cx, y, INSP_POST_W, h, '乗車後', fB); cx += INSP_POST_W;
    const actW = g === 2 ? x + CONTENT_W - cx : INSP_ACT_W;
    cell(doc, cx, y, actW, h, '措置', fB);
  }
}

/** 点検チェックリスト 行（左・中・右それぞれ） */
function drawInspRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  rowIdx: number,
  leftItem: InspCheckItem | undefined,
  middleItem: InspCheckItem | undefined,
  rightItem: InspCheckItem | undefined,
  fontN: string,
  fontB: string
): void {
  const fN = { font: fontN, fontSize: 7 };

  // 左列
  {
    let cx = x;
    const item = leftItem;
    const bg = rowIdx % 2 === 0 ? undefined : '#FAFAFA';
    cell(doc, cx, y, INSP_ITEM_W, INSP_ROW_H, item?.name ?? '', {
      ...fN, align: 'left', pad: 3, bg,
    }); cx += INSP_ITEM_W;
    cell(doc, cx, y, INSP_PRE_W, INSP_ROW_H, item?.preResult ?? '', fN); cx += INSP_PRE_W;
    cell(doc, cx, y, INSP_POST_W, INSP_ROW_H, item?.postResult ?? '', fN); cx += INSP_POST_W;
    cell(doc, cx, y, INSP_ACT_W, INSP_ROW_H, item?.measure ?? '', { ...fN, fontSize: 6 });
  }

  // 中列
  {
    let cx = x + INSP_GROUP_W;
    const item = middleItem;
    const bg = rowIdx % 2 === 0 ? undefined : '#FAFAFA';
    cell(doc, cx, y, INSP_ITEM_W, INSP_ROW_H, item?.name ?? '', {
      ...fN, align: 'left', pad: 3, bg,
    }); cx += INSP_ITEM_W;
    cell(doc, cx, y, INSP_PRE_W, INSP_ROW_H, item?.preResult ?? '', fN); cx += INSP_PRE_W;
    cell(doc, cx, y, INSP_POST_W, INSP_ROW_H, item?.postResult ?? '', fN); cx += INSP_POST_W;
    cell(doc, cx, y, INSP_ACT_W, INSP_ROW_H, item?.measure ?? '', { ...fN, fontSize: 6 });
  }

  // 右列（6行のうち最初の1行のみディスクホイール、2行目以降は備考）
  {
    const cx = x + INSP_GROUP_W * 2;
    const rightItemW = INSP_GROUP_W - INSP_PRE_W - INSP_POST_W - INSP_ACT_W;
    const actW = x + CONTENT_W - cx - rightItemW - INSP_PRE_W - INSP_POST_W;

    if (rowIdx === 0 && rightItem) {
      // ディスクホイールの取付状況
      let cx2 = cx;
      cell(doc, cx2, y, rightItemW, INSP_ROW_H, rightItem.name, {
        ...fN, align: 'left', pad: 3,
      }); cx2 += rightItemW;
      cell(doc, cx2, y, INSP_PRE_W, INSP_ROW_H, rightItem.preResult, fN); cx2 += INSP_PRE_W;
      cell(doc, cx2, y, INSP_POST_W, INSP_ROW_H, rightItem.postResult, fN); cx2 += INSP_POST_W;
      cell(doc, cx2, y, actW, INSP_ROW_H, rightItem.measure, { ...fN, fontSize: 6 });
    } else if (rowIdx === 1) {
      // 備考ラベル（5行分を占める大きなセル）
      // ここは drawRightInspColumn で一括処理するのでスキップ
      cell(doc, cx, y, CONTENT_W - (cx - x), INSP_ROW_H, '');
    } else {
      // 備考エリア（空）
      cell(doc, cx, y, CONTENT_W - (cx - x), INSP_ROW_H, '');
    }
  }
}

/** 点検右列の備考エリアを一括描画 */
function drawRemarksArea(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  remarks: string,
  fontN: string,
  fontB: string
): void {
  // ラベル「備考」
  const labelH = INSP_ROW_H;
  const contentH = INSP_ROW_H * 5;

  const bg = '#E8E8E8';
  cell(doc, x, y, CONTENT_W - (x - MARGIN_L), labelH, '備　考',
    { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg });

  // 備考テキストエリア
  const areaW = CONTENT_W - (x - MARGIN_L);
  doc.rect(x, y + labelH, areaW, contentH).strokeColor('#000000').lineWidth(0.5).stroke();
  if (remarks) {
    doc.font(fontN).fontSize(7).fillColor('#000000');
    doc.text(remarks, x + 3, y + labelH + 3, {
      width: areaW - 6,
      height: contentH - 6,
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

  // ①タイトル
  drawTitle(doc, x0, y, CONTENT_W, TITLE_H, fontB);
  y += TITLE_H;

  // ②ヘッダー行（日付・氏名・車番・キロ）
  drawHeaderRow(doc, x0, y, CONTENT_W, HEADER_H, data, fontN, fontB);
  y += HEADER_H;

  // ③運行記録カラムヘッダー
  drawOperationColHeaders(doc, x0, y, COL_HEADER_H, fontB);
  y += COL_HEADER_H;

  // ④運行記録6行
  drawOperationRows(doc, x0, y, data.trips, fontN);
  y += OP_ROW_H * OP_ROWS;

  // ⑤給油・署名セクション
  drawFuelSection(doc, x0, y, CONTENT_W, data, fontN, fontB);
  y += FUEL_H;

  // ⑥点検チェックリスト ヘッダー
  drawInspHeaderRow(doc, x0, y, INSP_HEADER_H, fontB);
  y += INSP_HEADER_H;

  // ⑦点検行（左・中で6行、右は1行+備考エリア）
  const rightColX = x0 + INSP_GROUP_W * 2;
  const rightItemW = INSP_GROUP_W - INSP_PRE_W - INSP_POST_W - INSP_ACT_W;

  for (let i = 0; i < INSP_ROWS; i++) {
    const ry = y + i * INSP_ROW_H;
    const leftItem = data.leftInspItems[i];
    const middleItem = data.middleInspItems[i];

    // 左列
    {
      let cx = x0;
      const bg = i % 2 === 0 ? undefined : '#FAFAFA';
      cell(doc, cx, ry, INSP_ITEM_W, INSP_ROW_H, leftItem?.name ?? '', {
        font: fontN, fontSize: 7, align: 'left', pad: 3, bg,
      }); cx += INSP_ITEM_W;
      cell(doc, cx, ry, INSP_PRE_W, INSP_ROW_H, leftItem?.preResult ?? '', { font: fontN, fontSize: 8 }); cx += INSP_PRE_W;
      cell(doc, cx, ry, INSP_POST_W, INSP_ROW_H, leftItem?.postResult ?? '', { font: fontN, fontSize: 8 }); cx += INSP_POST_W;
      cell(doc, cx, ry, INSP_ACT_W, INSP_ROW_H, leftItem?.measure ?? '', { font: fontN, fontSize: 6.5 });
    }

    // 中列
    {
      let cx = x0 + INSP_GROUP_W;
      const bg = i % 2 === 0 ? undefined : '#FAFAFA';
      cell(doc, cx, ry, INSP_ITEM_W, INSP_ROW_H, middleItem?.name ?? '', {
        font: fontN, fontSize: 7, align: 'left', pad: 3, bg,
      }); cx += INSP_ITEM_W;
      cell(doc, cx, ry, INSP_PRE_W, INSP_ROW_H, middleItem?.preResult ?? '', { font: fontN, fontSize: 8 }); cx += INSP_PRE_W;
      cell(doc, cx, ry, INSP_POST_W, INSP_ROW_H, middleItem?.postResult ?? '', { font: fontN, fontSize: 8 }); cx += INSP_POST_W;
      cell(doc, cx, ry, INSP_ACT_W, INSP_ROW_H, middleItem?.measure ?? '', { font: fontN, fontSize: 6.5 });
    }

    // 右列: i=0のみディスクホイール。それ以外はスキップ（備考エリアで一括描画）
    if (i === 0) {
      const rightItem = data.rightInspItems[0];
      const actW = x0 + CONTENT_W - rightColX - rightItemW - INSP_PRE_W - INSP_POST_W;
      let cx = rightColX;
      cell(doc, cx, ry, rightItemW, INSP_ROW_H, rightItem?.name ?? 'ディスクホイールの取付状況', {
        font: fontN, fontSize: 6.5, align: 'left', pad: 2,
      }); cx += rightItemW;
      cell(doc, cx, ry, INSP_PRE_W, INSP_ROW_H, rightItem?.preResult ?? '', { font: fontN, fontSize: 8 }); cx += INSP_PRE_W;
      cell(doc, cx, ry, INSP_POST_W, INSP_ROW_H, rightItem?.postResult ?? '', { font: fontN, fontSize: 8 }); cx += INSP_POST_W;
      cell(doc, cx, ry, actW, INSP_ROW_H, rightItem?.measure ?? '', { font: fontN, fontSize: 6 });
    }
  }

  // 備考ラベル + エリア（右列の i=1〜5 分 = 5行分）
  const remarksY = y + INSP_ROW_H;  // i=1 の y 位置
  const remarksH = INSP_ROW_H * (INSP_ROWS - 1);
  const remarksW = x0 + CONTENT_W - rightColX;

  // 備考ラベル行（右列 i=1 の高さ）
  cell(doc, rightColX, remarksY, remarksW, INSP_ROW_H,
    '備　考', { font: fontB, fallbackFont: 'Helvetica-Bold', fontSize: 7, bg: '#E8E8E8' });

  // 備考内容エリア（i=2〜5 分 = 4行分）
  const remarksContentH = INSP_ROW_H * (INSP_ROWS - 2);
  doc.rect(rightColX, remarksY + INSP_ROW_H, remarksW, remarksContentH)
    .strokeColor('#000000').lineWidth(0.5).stroke();
  if (data.remarks) {
    doc.font(fontN).fontSize(7).fillColor('#000000')
      .text(data.remarks, rightColX + 3, remarksY + INSP_ROW_H + 3, {
        width: remarksW - 6,
        height: remarksContentH - 6,
        lineBreak: true,
      });
  }

  // ⑧凡例
  y += INSP_ROW_H * INSP_ROWS + 2;
  doc.font(fontN).fontSize(7).fillColor('#000000')
    .text('レ……異常なし　　×……要修理調整', x0 + 2, y, { lineBreak: false });
}

// =====================================
// エクスポート関数
// =====================================

/**
 * 運転日報車両点検 PDFを生成する（帳票デザイン準拠版）
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
      stream.on('error', reject);

    } catch (error) {
      logger.error('[PDF] 運転日報生成エラー', { error, outputPath });
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
 * 後方互換性のため残存。reportService.ts からは新関数を呼ぶこと。
 */
export async function generateDailyReportPDF(
  _data: DailyReportData,
  outputPath: string
): Promise<number> {
  logger.warn('[PDF] generateDailyReportPDF は非推奨です。reportService.ts の変換処理を確認してください。');
  // 空PDFを生成して返す
  return new Promise((resolve, reject) => {
    ensureReportDirectory();
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc.fontSize(12).text('レポート生成エラー: 旧インターフェースが呼ばれています。reportService.tsを確認してください。', 40, 40);
    doc.end();
    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      resolve(stats.size);
    });
    stream.on('error', reject);
  });
}
