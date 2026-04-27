#!/usr/bin/env python3
"""
reportController.ts の直接修正:
- DatabaseService import 追加
- getAvailableVehiclesForDate ハンドラー追加
- default export に登録
"""
import subprocess, sys, os, re

BASE = os.path.expanduser("~/dump-tracker")
CTRL = f"{BASE}/backend/src/controllers/reportController.ts"

def read(p):
    with open(p, "r", encoding="utf-8") as f: return f.read()

def write(p, c):
    with open(p, "w", encoding="utf-8") as f: f.write(c)
    print(f"  ✅ Written: {p}")

def tsc(label, cwd):
    r = subprocess.run(["npx","tsc","--noEmit","-p","tsconfig.json"],
                       cwd=cwd, capture_output=True, text=True)
    errs = (r.stdout+r.stderr).strip()
    if r.returncode == 0: print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC:")
    for l in errs.splitlines()[:30]: print(f"    {l}")
    return False

content = read(CTRL)

# ── [1] DatabaseService import ──
if 'DatabaseService' not in content:
    # "import logger from '../utils/logger';" の直後に追加
    content = content.replace(
        "import logger from '../utils/logger';",
        "import logger from '../utils/logger';\nimport { DatabaseService } from '../utils/database';",
        1
    )
    print("  ✅ [1] DatabaseService import追加")
else:
    print("  ⚠️  [1] DatabaseService既存")

# ── [2] getAvailableVehiclesForDate ハンドラー追加 ──
handler = '''
/**
 * 対象日に運行のある車両ID一覧取得
 * GET /api/v1/reports/daily-operation/available-vehicles?date=YYYY-MM-DD
 */
export const getAvailableVehiclesForDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  const { date } = req.query;
  if (!date) return sendError(res, 'dateパラメータが必要です', 400, ERROR_CODES.VALIDATION_ERROR);

  const db = DatabaseService.getInstance();
  const targetDate = new Date(date as string);
  const startOfDay = new Date(targetDate); startOfDay.setHours(0,0,0,0);
  const endOfDay   = new Date(targetDate); endOfDay.setHours(23,59,59,999);

  const ops = await db.operation.findMany({
    where: {
      OR: [
        { actualStartTime:  { gte: startOfDay, lte: endOfDay } },
        { plannedStartTime: { gte: startOfDay, lte: endOfDay } },
      ],
    },
    select: { vehicleId: true },
    distinct: ['vehicleId'],
  });

  const vehicleIds = ops.map((o: any) => o.vehicleId).filter(Boolean);
  return sendSuccess(res, { vehicleIds, date }, '対象日の運行車両一覧を取得しました');
});

'''

if 'getAvailableVehiclesForDate' not in content:
    # generateDailyOperationReport の直前に挿入
    target = "/**\n * 日次運行レポート生成(統合版)\n * POST /api/v1/reports/daily-operation"
    if target in content:
        content = content.replace(target, handler + target, 1)
        print("  ✅ [2] getAvailableVehiclesForDate ハンドラー追加")
    else:
        # フォールバック: generateDailyOperationReport export の直前
        target2 = "export const generateDailyOperationReport"
        if target2 in content:
            content = content.replace(target2, handler.rstrip() + "\n\n" + target2, 1)
            print("  ✅ [2] getAvailableVehiclesForDate ハンドラー追加（代替位置）")
        else:
            print("  ❌ [2] 挿入位置未発見")
else:
    print("  ⚠️  [2] getAvailableVehiclesForDate既存")

# ── [3] default export に登録 ──
old_export = """export default {
  getAllReports,
  getReportById,
  generateDailyOperationReport,"""
new_export = """export default {
  getAllReports,
  getReportById,
  getAvailableVehiclesForDate,
  generateDailyOperationReport,"""

if 'getAvailableVehiclesForDate' in content and 'getAvailableVehiclesForDate,' not in content.split('export default')[1] if 'export default' in content else True:
    if old_export in content:
        content = content.replace(old_export, new_export, 1)
        print("  ✅ [3] default exportに登録")
    else:
        print("  ⚠️  [3] default export パターン未発見")
else:
    print("  ⚠️  [3] default export既存スキップ")

write(CTRL, content)

# ── コンパイルチェック ──
print("\n" + "="*60)
b = tsc("Backend", f"{BASE}/backend")
m = tsc("Mobile",  f"{BASE}/frontend/mobile")
c = tsc("CMS",     f"{BASE}/frontend/cms")

if b and m and c:
    cmds = [
        ["git","add","-A"],
        ["git","commit","-m","fix: add DatabaseService import and getAvailableVehiclesForDate to reportController (session15)"],
        ["git","push","git@github.com:karkyon/dump-tracker-system.git","main"],
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
        out = (r.stdout+r.stderr).strip()
        if r.returncode != 0:
            print(f"  ❌ {' '.join(cmd[:3])}: {out}"); sys.exit(1)
        print(f"  ✅ {' '.join(cmd[:3])}")
        if out: print(f"    {out}")
    print("\n✅ 完了・Push済み")
    print("▶️  dt-restart必要")
else:
    print("\n❌ コンパイルエラーあり → Push中止")
    sys.exit(1)
