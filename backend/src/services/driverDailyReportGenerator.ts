/**
 * 運転日報車輛点検 PDFジェネレーター
 * 帳票イメージに準拠したA4横向きレイアウト
 *
 * 配置先: backend/src/services/driverDailyReportGenerator.ts
 */

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const FONT_PATHS = [
  '/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf',
  '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
  '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
];

function findJapaneseFont(): string {
  for (const fp of FONT_PATHS) {
    if (fs.existsSync(fp)) return fp;
  }
  throw new Error('日本語フォントが見つかりません');
}

export interface OperationRowData {
  companyName?: string;
  loadingLocation?: string;
  unloadingLocation?: string;
  itemName?: string;
  trips?: number;
  tons?: number;
  loadingCondition?: string;
  loadingStartTime?: string;
  loadingEndTime?: string;
}

export interface InspectionCheckItem {
  before?: string;
  after?: string;
  action?: string;
}

export interface DriverDailyReportData {
  date: Date;
  driverName: string;
  vehiclePlateNumber: string;
  startKm?: number;
  endKm?: number;
  operations: OperationRowData[];
  fuelAmount?: number;
  fuelKm?: number;
  oilAmount?: number;
  greaseAmount?: number;
  punctures?: number;
  tireParts?: number;
  inspection?: {
    engineOilCoolant?: InspectionCheckItem;
    tireParts2?: InspectionCheckItem;
    hydraulicOil?: InspectionCheckItem;
    reverseAlarm?: InspectionCheckItem;
    gauges?: InspectionCheckItem;
    steering?: InspectionCheckItem;
    numberPlate?: InspectionCheckItem;
    speedometer?: InspectionCheckItem;
    clutchPedal?: InspectionCheckItem;
    brakes?: InspectionCheckItem;
    mirrors?: InspectionCheckItem;
    lights?: InspectionCheckItem;
    discWheel?: InspectionCheckItem;
    notes?: string;
  };
}

export async function generateDriverDailyReport(
  data: DriverDailyReportData,
  outputPath: string
): Promise<void> {
  const fontPath = findJapaneseFont();
  logger.info('[DriverDailyReport] PDF生成開始', { outputPath, fontPath });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 15, bottom: 15, left: 18, right: 18 },
    });

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc.registerFont('JP', fontPath);

    const ML = 18;
    const MT = 15;
    const TW = 841.89 - ML * 2;
    let cy = MT;

    cy = _drawTitle(doc, ML, cy, TW);
    cy = _drawHeaderRow(doc, ML, cy, TW, data);
    cy = _drawOperationSection(doc, ML, cy, TW, data.operations);
    cy = _drawMaintenanceRow(doc, ML, cy, TW, data);
    cy = _drawSignatureRow(doc, ML, cy, TW);
    cy = _drawInspectionSection(doc, ML, cy, TW, data.inspection || {});

    doc.font('JP').fontSize(7).fillColor('#333');
    doc.text('L ……… 異常なし　　× ……… 要修理調整', ML, cy + 4);

    doc.end();
    stream.on('finish', () => {
      const sz = fs.statSync(outputPath).size;
      logger.info('[DriverDailyReport] PDF生成完了', { outputPath, fileSize: sz });
      resolve();
    });
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

function _drawTitle(doc: PDFKit.PDFDocument, x: number, y: number, w: number): number {
  const title = '運　転　日　報　車　輛　点　検';
  doc.font('JP').fontSize(15).fillColor('black');
  doc.text(title, x, y, { width: w, align: 'center' });
  const tw = doc.widthOfString(title);
  const tx = x + (w - tw) / 2;
  doc.moveTo(tx, y + 17).lineTo(tx + tw, y + 17).lineWidth(1.2).strokeColor('black').stroke();
  return y + 26;
}

function _drawHeaderRow(doc: PDFKit.PDFDocument, x: number, y: number, w: number, data: DriverDailyReportData): number {
  const H = 28;
  const WD = ['日', '月', '火', '水', '木', '金', '土'][data.date.getDay()];
  const cells = [
    { label: '年',    val: String(data.date.getFullYear()),    cw: 55 },
    { label: '月',    val: String(data.date.getMonth() + 1),   cw: 30 },
    { label: '日',    val: String(data.date.getDate()),         cw: 30 },
    { label: '曜日',  val: WD,                                  cw: 28 },
    { label: '氏　名', val: data.driverName || '',              cw: 160 },
    { label: '車　番', val: data.vehiclePlateNumber || '',      cw: 100 },
    { label: 'キ　ロ', val: '',                                 cw: 30 },
    { label: '始',    val: data.startKm !== undefined ? String(data.startKm) : '', cw: 65 },
    { label: '終',    val: data.endKm !== undefined ? String(data.endKm) : '',     cw: 0 },
  ];
  let cx = x;
  cells.forEach((cell, i) => {
    const cw = i === cells.length - 1 ? x + w - cx : cell.cw;
    doc.rect(cx, y, cw, H).lineWidth(0.8).strokeColor('black').stroke();
    doc.font('JP').fontSize(6.5).fillColor('#444');
    doc.text(cell.label, cx + 2, y + 2, { width: cw - 4 });
    doc.font('JP').fontSize(10).fillColor('black');
    doc.text(cell.val ?? '', cx + 2, y + 13, { width: cw - 4, align: 'center' });
    cx += cw;
  });
  return y + H;
}

function _buildOpCols(w: number) {
  return [
    { label: '業　者　名',             cw: Math.round(w * 0.10) },
    { label: '積　込　場　所',          cw: Math.round(w * 0.14) },
    { label: '積　降　場　所',          cw: Math.round(w * 0.14) },
    { label: '品　名',                 cw: Math.round(w * 0.08) },
    { label: '台数',                   cw: Math.round(w * 0.05) },
    { label: 'トン数',                 cw: Math.round(w * 0.06) },
    { label: '積付\n状況',             cw: Math.round(w * 0.06) },
    { label: '積　み　込　み　時　間',   cw: 0 },
  ];
}

function _drawOperationSection(doc: PDFKit.PDFDocument, x: number, y: number, w: number, ops: OperationRowData[]): number {
  const cols = _buildOpCols(w);
  const hH = 16;
  let cx = x;
  doc.font('JP').fontSize(6.5).fillColor('#333');
  cols.forEach((col, i) => {
    const cw = i === cols.length - 1 ? x + w - cx : col.cw;
    doc.rect(cx, y, cw, hH).lineWidth(0.8).strokeColor('black').stroke();
    doc.text(col.label, cx + 1, y + 3, { width: cw - 2, align: 'center' });
    cx += cw;
  });
  y += hH;

  const rH = 22;
  for (let i = 0; i < 6; i++) {
    const op = ops[i] || {};
    const timeStr = op.loadingStartTime || op.loadingEndTime
      ? `${op.loadingStartTime || ''}～${op.loadingEndTime || ''}` : '';
    const vals = [
      op.companyName || '',
      op.loadingLocation || '',
      op.unloadingLocation || '',
      op.itemName || '',
      op.trips !== undefined ? String(op.trips) : '',
      op.tons !== undefined ? String(op.tons) : '',
      op.loadingCondition || '',
      timeStr,
    ];
    cx = x;
    cols.forEach((col, ci) => {
      const cw = ci === cols.length - 1 ? x + w - cx : col.cw;
      doc.rect(cx, y, cw, rH).lineWidth(0.5).strokeColor('black').stroke();
      doc.font('JP').fontSize(8).fillColor('black');
      if (vals[ci]) {
        doc.text(vals[ci], cx + 2, y + 6, { width: cw - 4, align: 'center' });
      } else if (ci === 1 || ci === 2) {
        doc.font('JP').fontSize(10).fillColor('#aaa');
        doc.text('—', cx + 2, y + 5, { width: cw - 4, align: 'center' });
      }
      cx += cw;
    });
    y += rH;
  }
  return y;
}

function _drawMaintenanceRow(doc: PDFKit.PDFDocument, x: number, y: number, w: number, data: DriverDailyReportData): number {
  const H = 32;
  doc.rect(x, y, w, H).lineWidth(0.8).strokeColor('black').stroke();
  const items = [
    { label: '給\n油\n量', unit: '㍑', val: data.fuelAmount },
    { label: '給油時\nキロ',  unit: 'km', val: data.fuelKm },
    { label: 'オ\nイ\nル',  unit: '㍑', val: data.oilAmount },
    { label: 'グ\nリ\nス',  unit: '',   val: data.greaseAmount },
    { label: 'パ\nン\nク',  unit: '',   val: data.punctures },
    { label: 'タイヤ\n偏磨耗', unit: '', val: data.tireParts },
  ];
  const cw = Math.round(w / items.length);
  let cx = x;
  items.forEach((item, i) => {
    const colW = i === items.length - 1 ? x + w - cx : cw;
    doc.rect(cx, y, colW, H).stroke();
    doc.font('JP').fontSize(6.5).fillColor('#444');
    doc.text(item.label, cx + 2, y + 3, { width: 22, lineGap: -1 });
    if (item.unit) doc.text(item.unit, cx + 24, y + 12, { width: 14 });
    if (item.val !== undefined) {
      doc.font('JP').fontSize(10).fillColor('black');
      doc.text(String(item.val), cx + 40, y + 10, { width: colW - 44 });
    }
    cx += colW;
  });
  return y + H;
}

function _drawSignatureRow(doc: PDFKit.PDFDocument, x: number, y: number, w: number): number {
  const H = 55;
  const signW = Math.round(w * 0.35);
  const signX = x + w - signW;
  doc.rect(signX, y, signW, H).lineWidth(0.8).strokeColor('black').stroke();
  const roles = ['運　転　手', '運行管理者', '整備管理者'];
  const rw = Math.round(signW / 3);
  let cx = signX;
  roles.forEach((role, i) => {
    const colW = i === roles.length - 1 ? signX + signW - cx : rw;
    doc.rect(cx, y, colW, H).stroke();
    doc.font('JP').fontSize(6.5).fillColor('#444');
    doc.text(role, cx + 2, y + 3, { width: colW - 4, align: 'center' });
    doc.circle(cx + colW / 2, y + H - 16, 13).lineWidth(0.8).strokeColor('black').stroke();
    cx += colW;
  });
  return y + H;
}

function _drawInspectionSection(doc: PDFKit.PDFDocument, x: number, y: number, w: number, insp: Record<string, any>): number {
  const TOTAL_H = 118;
  doc.rect(x, y, w, TOTAL_H).lineWidth(0.8).strokeColor('black').stroke();
  const colW = Math.round(w / 3);
  const HDR_H = 16;
  const ROW_H = Math.round((TOTAL_H - HDR_H) / 6);

  [0, 1, 2].forEach(ci => {
    const cx = ci === 2 ? x + colW * 2 : x + ci * colW;
    const cw = ci === 2 ? w - colW * 2 : colW;
    doc.rect(cx, y, cw, HDR_H).lineWidth(0.5).stroke();
    const itemW = Math.round(cw * 0.52);
    const bfW = Math.round(cw * 0.13);
    const afW = Math.round(cw * 0.13);
    const acW = cw - itemW - bfW - afW;
    doc.font('JP').fontSize(6).fillColor('#333');
    doc.text('点　検　項　目', cx + 2, y + 4, { width: itemW - 2 });
    doc.text('業前', cx + itemW, y + 4, { width: bfW, align: 'center' });
    doc.text('業後', cx + itemW + bfW, y + 4, { width: afW, align: 'center' });
    doc.text('措　置', cx + itemW + bfW + afW + 1, y + 4, { width: acW - 2 });
    doc.moveTo(cx + itemW, y).lineTo(cx + itemW, y + HDR_H).stroke();
    doc.moveTo(cx + itemW + bfW, y).lineTo(cx + itemW + bfW, y + HDR_H).stroke();
    doc.moveTo(cx + itemW + bfW + afW, y).lineTo(cx + itemW + bfW + afW, y + HDR_H).stroke();
  });

  const dataY = y + HDR_H;

  const leftItems = [
    { label: 'エンジンオイル・冷却水',  key: 'engineOilCoolant' },
    { label: 'タイヤの磨耗・き裂',      key: 'tireParts2' },
    { label: '各作動油の洩れ',          key: 'hydraulicOil' },
    { label: '後退時警報機、ワイパー',  key: 'reverseAlarm' },
    { label: '各計器の動き',            key: 'gauges' },
    { label: 'ステアリング廻り',        key: 'steering' },
  ];
  const midItems = [
    { label: 'No.プレート・車検証',           key: 'numberPlate' },
    { label: '速度表示装置',                   key: 'speedometer' },
    { label: 'クラッチ・ペダルの遊び操作具合', key: 'clutchPedal' },
    { label: 'ブレーキのきき具合',             key: 'brakes' },
    { label: '後写鏡・反射鏡',               key: 'mirrors' },
    { label: 'ライト・方向指示器の作動',       key: 'lights' },
  ];

  const drawCol = (colX: number, items: Array<{label: string; key: string}>) => {
    const itemW = Math.round(colW * 0.52);
    const bfW = Math.round(colW * 0.13);
    const afW = Math.round(colW * 0.13);
    const acW = colW - itemW - bfW - afW;
    items.forEach((item, i) => {
      const ry = dataY + i * ROW_H;
      doc.rect(colX, ry, colW, ROW_H).lineWidth(0.4).stroke();
      doc.moveTo(colX + itemW, ry).lineTo(colX + itemW, ry + ROW_H).stroke();
      doc.moveTo(colX + itemW + bfW, ry).lineTo(colX + itemW + bfW, ry + ROW_H).stroke();
      doc.moveTo(colX + itemW + bfW + afW, ry).lineTo(colX + itemW + bfW + afW, ry + ROW_H).stroke();
      doc.font('JP').fontSize(6.5).fillColor('black');
      doc.text(item.label, colX + 2, ry + 3, { width: itemW - 4, lineGap: 0 });
      const r = (insp[item.key] || {}) as InspectionCheckItem;
      if (r.before) doc.text(r.before, colX + itemW + 1, ry + 3, { width: bfW - 2, align: 'center' });
      if (r.after)  doc.text(r.after, colX + itemW + bfW + 1, ry + 3, { width: afW - 2, align: 'center' });
      if (r.action) doc.text(r.action, colX + itemW + bfW + afW + 1, ry + 3, { width: acW - 2 });
    });
  };

  drawCol(x, leftItems);
  drawCol(x + colW, midItems);

  // 右列
  const rightX = x + colW * 2;
  const rightW = w - colW * 2;
  const itemW = Math.round(rightW * 0.52);
  const bfW = Math.round(rightW * 0.13);
  const afW = Math.round(rightW * 0.13);
  const acW = rightW - itemW - bfW - afW;
  const row1H = Math.round((TOTAL_H - HDR_H) * 0.40);
  const row2H = (TOTAL_H - HDR_H) - row1H;

  doc.rect(rightX, dataY, rightW, row1H).lineWidth(0.4).stroke();
  doc.moveTo(rightX + itemW, dataY).lineTo(rightX + itemW, dataY + row1H).stroke();
  doc.moveTo(rightX + itemW + bfW, dataY).lineTo(rightX + itemW + bfW, dataY + row1H).stroke();
  doc.moveTo(rightX + itemW + bfW + afW, dataY).lineTo(rightX + itemW + bfW + afW, dataY + row1H).stroke();
  doc.font('JP').fontSize(6.5).fillColor('black');
  doc.text('ディスクホイールの取付状況', rightX + 2, dataY + 3, { width: itemW - 4 });
  const dw = (insp.discWheel || {}) as InspectionCheckItem;
  if (dw.before) doc.text(dw.before, rightX + itemW + 1, dataY + 3, { width: bfW - 2, align: 'center' });
  if (dw.after)  doc.text(dw.after, rightX + itemW + bfW + 1, dataY + 3, { width: afW - 2, align: 'center' });
  if (dw.action) doc.text(dw.action, rightX + itemW + bfW + afW + 1, dataY + 3, { width: acW - 2 });

  const row2Y = dataY + row1H;
  doc.rect(rightX, row2Y, rightW, row2H).lineWidth(0.4).stroke();
  doc.font('JP').fontSize(6.5).fillColor('#444');
  doc.text('備考', rightX + 2, row2Y + 3, { width: rightW - 4 });
  if (insp.notes) {
    doc.font('JP').fontSize(7).fillColor('black');
    doc.text(String(insp.notes), rightX + 2, row2Y + 14, { width: rightW - 4 });
  }

  return y + TOTAL_H;
}
