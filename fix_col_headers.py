#!/usr/bin/env python3
"""
日報PDF drawOperationColHeaders 完全修正パッチ
問題:
  1. drawOperationColHeaders が旧構造(COL_MOVEなし、2段分割のみ)のまま
  2. drawOperationRowsAll の timeAreaW = COL_TIME - COL_MOVE で計算するが
     drawOperationColHeaders は COL_TIME をフルで使うので幅がずれる
  3. '業者名'/'積降場所' が残っている
修正:
  drawOperationColHeaders を「新7列構造」に完全置換
  積込(始・終・時間) | 移動時間(COL_MOVE) | 荷降(始・終・時間)
  幅計算を drawOperationRowsAll と完全一致させる
"""
import subprocess, sys, os, re

PROJECT = os.path.expanduser("~/projects/dump-tracker")

def run(cmd, cwd=None, check=True):
    result = subprocess.run(cmd, shell=True, cwd=cwd or PROJECT, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if check and result.returncode != 0:
        print(f"❌ FAILED: {cmd}", file=sys.stderr)
        sys.exit(1)
    return result

PDF_PATH = "backend/src/services/pdfReportGenerator.ts"
with open(os.path.join(PROJECT, PDF_PATH), 'r', encoding='utf-8') as f:
    src = f.read()

# ============================================================
# drawOperationColHeaders 関数全体を行番号ベースで特定して置換
# ============================================================
start_marker = 'function drawOperationColHeaders('
end_marker   = '\nfunction '  # 次の function の直前まで

start_idx = src.find(start_marker)
if start_idx < 0:
    print("❌ drawOperationColHeaders not found")
    sys.exit(1)

# コメントも含める
comment_marker = '/**\n * 運行記録テーブルのカラムヘッダー'
comment_idx = src.rfind(comment_marker, 0, start_idx)
actual_start = comment_idx if comment_idx >= 0 and (start_idx - comment_idx) < 600 else start_idx

# 次の function を探す（drawOperationColHeaders の終了位置）
end_idx = src.find(end_marker, start_idx + len(start_marker))
# "function " の直前の改行も含める → end_idx は \n から始まるので end_idx のまま

print(f"  置換範囲: {actual_start}〜{end_idx}")
print(f"  開始: {repr(src[actual_start:actual_start+60])}")
print(f"  終了: {repr(src[end_idx:end_idx+50])}")

NEW_COL_HEADERS = '''/**
 * 運行記録テーブルのカラムヘッダー
 * 新構造: 客先名|積込場所|荷降場所|品名|台数|トン数|積付状況|積込時間(始終時間)|移動時間|荷降時間(始終時間)
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
  cell(doc, cx, y, COL_CONTRACTOR, h, '客先名',   f8); cx += COL_CONTRACTOR;
  cell(doc, cx, y, COL_LOADING,    h, '積込場所', f8); cx += COL_LOADING;
  cell(doc, cx, y, COL_UNLOADING,  h, '荷降場所', f8); cx += COL_UNLOADING;
  cell(doc, cx, y, COL_ITEM,       h, '品名',     f8); cx += COL_ITEM;
  cell(doc, cx, y, COL_COUNT,      h, '台数',     f8); cx += COL_COUNT;
  cell(doc, cx, y, COL_TONS,       h, 'トン数',   f8); cx += COL_TONS;
  cell(doc, cx, y, COL_CONDITION,  h, '積付状況', f8); cx += COL_CONDITION;

  // ★ 時間列: drawOperationRowsAll と完全一致した幅計算
  // timeAreaW = COL_TIME - COL_MOVE （積込+荷降の合計）
  const timeAreaW = COL_TIME - COL_MOVE;
  const halfTimeW = Math.floor(timeAreaW / 2);
  const remTimeW  = timeAreaW - halfTimeW;
  const sub1W = Math.floor(halfTimeW / 3);
  const sub2W = Math.floor(halfTimeW / 3);
  const sub3W = halfTimeW - sub1W - sub2W;
  const sub4W = Math.floor(remTimeW / 3);
  const sub5W = Math.floor(remTimeW / 3);
  const sub6W = remTimeW - sub4W - sub5W;
  const subH = h / 2;

  // 積込時間グループ（上段ラベル + 下段3列）
  cell(doc, cx,               y,      halfTimeW, subH, '積 込 時 間', f8);
  cell(doc, cx,               y+subH, sub1W,     subH, '始', f6);
  cell(doc, cx+sub1W,         y+subH, sub2W,     subH, '終', f6);
  cell(doc, cx+sub1W+sub2W,   y+subH, sub3W,     subH, '時間', f6);
  cx += halfTimeW;

  // 移動時間列
  cell(doc, cx, y, COL_MOVE, h, '移動\n時間', f6);
  cx += COL_MOVE;

  // 荷降時間グループ（上段ラベル + 下段3列）
  cell(doc, cx,             y,      remTimeW, subH, '荷 降 時 間', f8);
  cell(doc, cx,             y+subH, sub4W,    subH, '始', f6);
  cell(doc, cx+sub4W,       y+subH, sub5W,    subH, '終', f6);
  cell(doc, cx+sub4W+sub5W, y+subH, sub6W,    subH, '時間', f6);
}

'''

src = src[:actual_start] + NEW_COL_HEADERS + src[end_idx:]
print("✅ drawOperationColHeaders 新構造置換完了")

# ============================================================
# countReportPages: OP_ROW_H が1行になったので計算式も修正
# グループ行(GRP_ROW_H) + 時刻行(OP_ROW_H × rows.length) の合計
# ただし countReportPages は trips の rows を知らないので
# 暫定的に「1グループ = GRP_ROW_H + OP_ROW_H * 1行」として近似
# ============================================================
OLD_COUNT = """function countReportPages(data: DailyDriverReportData): number {
  let pages = 1;
  let y = MARGIN_T + TITLE_H + HEADER_H + COL_HEADER_H;
  for (let i = 0; i < data.trips.length; i++) {
    if (y + OP_ROW_H > PAGE_H - 12) {
      pages++;
      y = MARGIN_T + TITLE_H + HEADER_H + COL_HEADER_H;
    }
    y += OP_ROW_H;
  }
  const inspRows = Math.max(data.leftInspItems.length, data.middleInspItems.length, 1);
  const bottomBlockH = FUEL_H + INSP_HEADER_H + INSP_ROW_H * inspRows + LEGEND_H + 4;
  if (y + bottomBlockH > PAGE_H - 12) pages++;
  return pages;
}"""

NEW_COUNT = """function countReportPages(data: DailyDriverReportData): number {
  let pages = 1;
  let y = MARGIN_T + TITLE_H + HEADER_H + COL_HEADER_H;
  for (const trip of data.trips) {
    const rowCount = (trip.rows && trip.rows.length > 0) ? trip.rows.length : 1;
    const blockH = GRP_ROW_H + OP_ROW_H * rowCount;
    if (y + blockH > PAGE_H - 12) {
      pages++;
      y = MARGIN_T + TITLE_H + HEADER_H + COL_HEADER_H;
    }
    y += blockH;
  }
  const inspRows = Math.max(data.leftInspItems.length, data.middleInspItems.length, 1);
  const bottomBlockH = FUEL_H + INSP_HEADER_H + INSP_ROW_H * inspRows + LEGEND_H + 4;
  if (y + bottomBlockH > PAGE_H - 12) pages++;
  return pages;
}"""

if OLD_COUNT in src:
    src = src.replace(OLD_COUNT, NEW_COUNT)
    print("✅ countReportPages グループ対応完了")
else:
    print("⚠️ countReportPages anchor not found（既に修正済みの可能性）")

with open(os.path.join(PROJECT, PDF_PATH), 'w', encoding='utf-8') as f:
    f.write(src)
print(f"✅ Written: {PDF_PATH}")

# ============================================================
# コンパイル
# ============================================================
print("\n🔧 backend compile...")
r = run("./node_modules/.bin/tsc --noEmit", cwd=os.path.join(PROJECT, "backend"), check=False)
if r.returncode != 0:
    print("❌ backend compile error"); sys.exit(1)
print("✅ backend OK")

print("\n🔧 frontend/cms compile...")
r = run("./node_modules/.bin/tsc --noEmit", cwd=os.path.join(PROJECT, "frontend/cms"), check=False)
if r.returncode != 0:
    print("❌ cms compile error"); sys.exit(1)
print("✅ frontend/cms OK")

print("\n🔧 frontend/mobile compile...")
r = run("./node_modules/.bin/tsc --noEmit", cwd=os.path.join(PROJECT, "frontend/mobile"), check=False)
if r.returncode != 0:
    print("❌ mobile compile error"); sys.exit(1)
print("✅ frontend/mobile OK")

print("\n🚀 git commit & push...")
run(f"git add {PDF_PATH}", cwd=PROJECT)
run('git commit -m "fix: 日報PDF drawOperationColHeaders 新7列構造(移動時間列追加・幅一致)\n\n- 客先名/荷降場所/積込時間/移動時間/荷降時間の正しいヘッダー\n- timeAreaW=COL_TIME-COL_MOVE でdrawOperationRowsAllと幅を完全一致\n- countReportPages グループ行高さ対応(GRP_ROW_H+OP_ROW_H*N)"', cwd=PROJECT)
run("git push origin main", cwd=PROJECT)
print("\n✅ 完了")
