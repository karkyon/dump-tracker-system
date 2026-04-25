#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_debug_routes_gps.py
debugRoutes.ts の古いGPS Inspector APIブロックを削除し
正しいパターン（型エラーなし）で書き直す
"""
import os, subprocess, re

REPO = os.path.expanduser("~/dump-tracker")

def r(p):
    fp = os.path.join(REPO, p)
    return open(fp, encoding='utf-8').read() if os.path.exists(fp) else None

def w(p, c):
    fp = os.path.join(REPO, p)
    open(fp, 'w', encoding='utf-8').write(c)
    print(f"  ✅ Written: {p}")

def tsc(d, label):
    res = subprocess.run(["npx","tsc","--noEmit"],
        cwd=os.path.join(REPO,d), capture_output=True, text=True, timeout=120)
    if res.returncode==0: print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC:\n{(res.stdout+res.stderr)[:3000]}"); return False

print("="*60)
print("debugRoutes.ts GPS API完全書き直し")
print("="*60)

dr_path = "backend/src/routes/debugRoutes.ts"
dr = r(dr_path)

# ── Step1: 450行目前後を確認 ──────────────────────────────
lines = dr.split('\n')
print(f"\n現在の行数: {len(lines)}")
print("445〜460行目:")
for i in range(444, min(460, len(lines))):
    print(f"  {i+1}: {lines[i]}")

# ── Step2: 古いGPS Inspector APIブロックを丸ごと削除 ──────
# "// ✅ GPS Inspector API" から次の "export default router" 直前まで削除
GPS_BLOCK_START = "// ============================================================\n// ✅ GPS Inspector API (ADMIN専用)"

if GPS_BLOCK_START in dr:
    # ブロックの開始位置を探す
    start_idx = dr.find(GPS_BLOCK_START)
    # export default router の位置を探す
    export_idx = dr.find("\nexport default router", start_idx)
    if export_idx != -1:
        # ブロックを削除（GPS_BLOCK_START から export の前まで）
        dr_cleaned = dr[:start_idx] + dr[export_idx:]
        print(f"\n  ✅ 古いGPS APIブロック削除: {start_idx}〜{export_idx}文字")
    else:
        # export が見つからない場合はブロック末尾まで削除
        dr_cleaned = dr[:start_idx]
        print(f"\n  ✅ 古いGPS APIブロック削除（末尾まで）")
else:
    dr_cleaned = dr
    print("\n  ℹ️ GPS Inspector APIブロック未発見 — そのまま追記")

# ── Step3: DatabaseService インポート追加 ─────────────────
if "DatabaseService" not in dr_cleaned:
    dr_cleaned = dr_cleaned.replace(
        "import { getDebugService } from '../services/debugService';",
        "import { getDebugService } from '../services/debugService';\nimport { DatabaseService } from '../utils/database';"
    )
    print("  ✅ DatabaseService import 追加")
else:
    print("  ✅ DatabaseService import 既存")

# ── Step4: 正しいGPS Inspector APIを追加 ─────────────────
# 既存パターンを見ると:
#   router.get('/operations/recent', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
#   return sendSuccess(res, ...) — res の型推論に任せる
# さらに Response 型の競合が起きているため「Response」インポートを使わず res をそのまま使う

CORRECT_GPS_API = """
// ============================================================
// ✅ GPS Inspector API (ADMIN専用) — Session 11
// ============================================================

router.get(
  '/gps/recent-operations',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const limit = Math.min(parseInt(String(req.query.limit || '20')), 50);
    const prisma = DatabaseService.getInstance();
    const operations = await prisma.operation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, operationNumber: true, status: true,
        actualStartTime: true, actualEndTime: true,
        totalDistanceKm: true, startOdometer: true, endOdometer: true,
        vehicles: { select: { plateNumber: true, model: true } },
        usersOperationsDriverIdTousers: { select: { name: true } },
        _count: { select: { gpsLogs: true } }
      }
    });
    return sendSuccess(res as any, operations.map((op: any) => ({
      id: op.id, operationNumber: op.operationNumber, status: op.status,
      actualStartTime: op.actualStartTime, actualEndTime: op.actualEndTime,
      totalDistanceKm: op.totalDistanceKm ? Number(op.totalDistanceKm) : null,
      startOdometer: op.startOdometer ? Number(op.startOdometer) : null,
      endOdometer: op.endOdometer ? Number(op.endOdometer) : null,
      gpsLogCount: op._count.gpsLogs,
      vehiclePlate: op.vehicles?.plateNumber ?? null,
      driverName: op.usersOperationsDriverIdTousers?.name ?? null
    })), '最近の運行一覧を取得しました');
  })
);

router.get(
  '/gps/operation/:operationId',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { operationId } = req.params as { operationId: string };
    const prisma = DatabaseService.getInstance();

    const operation = await prisma.operation.findUnique({
      where: { id: operationId },
      include: {
        vehicles: { select: { id: true, plateNumber: true, model: true, currentMileage: true } },
        usersOperationsDriverIdTousers: { select: { id: true, name: true, username: true } },
        customer: { select: { id: true, name: true } }
      }
    });
    if (!operation) {
      return sendError(res as any, '運行が見つかりません', 404);
    }

    const gpsLogs = await prisma.gpsLog.findMany({
      where: { operationId },
      orderBy: { recordedAt: 'asc' },
      select: {
        id: true, latitude: true, longitude: true,
        accuracyMeters: true, speedKmh: true, heading: true,
        altitude: true, recordedAt: true, createdAt: true,
        operationId: true, vehicleId: true
      }
    });

    const nullOpCount = await prisma.gpsLog.count({ where: { operationId: null } });

    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2
        + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    let totalKm = 0;
    let noiseKm = 0;
    const logsWithDelta = gpsLogs.map((log: any, i: number) => {
      const prev = gpsLogs[i - 1] as any;
      let deltaKm = 0;
      let isNoise = false;
      if (prev) {
        deltaKm = haversineKm(
          Number(prev.latitude), Number(prev.longitude),
          Number(log.latitude),  Number(log.longitude)
        );
        isNoise = deltaKm < 0.01;
        if (!isNoise) totalKm += deltaKm; else noiseKm += deltaKm;
      }
      return {
        id: log.id,
        latitude: Number(log.latitude),
        longitude: Number(log.longitude),
        accuracyMeters: log.accuracyMeters ? Number(log.accuracyMeters) : null,
        speedKmh:       log.speedKmh       ? Number(log.speedKmh)       : null,
        heading:        log.heading        ? Number(log.heading)        : null,
        altitude:       log.altitude       ? Number(log.altitude)       : null,
        recordedAt:   log.recordedAt,
        operationId:  log.operationId,
        vehicleId:    log.vehicleId,
        deltaKm:       parseFloat(deltaKm.toFixed(5)),
        isNoise,
        cumulativeKm:  parseFloat(totalKm.toFixed(3))
      };
    });

    const accVals = gpsLogs
      .map((l: any) => (l.accuracyMeters ? Number(l.accuracyMeters) : null))
      .filter((v: number | null): v is number => v !== null);

    const accuracyStats = accVals.length > 0 ? {
      min:     String(Math.min(...accVals).toFixed(1)),
      max:     String(Math.max(...accVals).toFixed(1)),
      avg:     String((accVals.reduce((s: number, v: number) => s + v, 0) / accVals.length).toFixed(1)),
      over100m: accVals.filter((v: number) => v > 100).length,
      over150m: accVals.filter((v: number) => v > 150).length,
    } : null;

    return sendSuccess(res as any, {
      operation: {
        id: operation.id,
        operationNumber: operation.operationNumber,
        status: operation.status,
        actualStartTime: operation.actualStartTime,
        actualEndTime: operation.actualEndTime,
        totalDistanceKm: operation.totalDistanceKm ? Number(operation.totalDistanceKm) : null,
        startOdometer:   operation.startOdometer   ? Number(operation.startOdometer)   : null,
        endOdometer:     operation.endOdometer     ? Number(operation.endOdometer)     : null,
        vehicle: operation.vehicles,
        driver:  operation.usersOperationsDriverIdTousers,
        customer: operation.customer
      },
      gpsLogs: logsWithDelta,
      diagnostics: {
        totalLogs: gpsLogs.length,
        logsWithOperationId:    gpsLogs.filter((l: any) =>  l.operationId).length,
        logsWithoutOperationId: gpsLogs.filter((l: any) => !l.operationId).length,
        nullOperationCountInDB: nullOpCount,
        accuracyStats,
        distanceCalc: {
          totalDistanceKm:   parseFloat(totalKm.toFixed(3)),
          noiseSkippedKm:    parseFloat(noiseKm.toFixed(5)),
          noiseSegments:     logsWithDelta.filter((l: any) => l.isNoise).length,
          dbTotalDistanceKm: operation.totalDistanceKm ? Number(operation.totalDistanceKm) : null,
        },
        filters: {
          fix4A_sendThreshold:    '100m (フロント送信スキップ)',
          fix4B_updateThreshold:  '150m (フロント距離計算スキップ)',
          fix1_dbSaveThreshold:   '150m (バックエンドDB保存スキップ)',
          fixS11_3_noiseFilter:   '10m未満 (バックエンド距離計算スキップ)',
          fix5A_maximumAge:       '0ms (キャッシュ無効)',
          fix5C_minDistance:      '10m (フロント最小移動距離)',
          bug031_enableLogging:   'enableLogging=true (useGPS必須オプション)',
        }
      }
    }, 'GPS診断データ取得完了');
  })
);

router.get(
  '/gps/logs',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const lines = Math.min(parseInt(String(req.query.lines || '200')), 1000);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const logPath = nodePath.join(process.cwd(), 'logs', 'gps.log');

    if (!fs.existsSync(logPath)) {
      return sendSuccess(res as any, {
        entries: [], totalLines: 0, returnedLines: 0,
        message: 'gps.logが存在しません。dt-restart後に運行を実行してください。',
        logPath
      });
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    const allLines = content.split('\\n').filter((l: string) => l.trim());
    const recentLines = allLines.slice(-lines);
    const entries = recentLines.map((line: string) => {
      try { return JSON.parse(line) as object; }
      catch { return { raw: line }; }
    });

    return sendSuccess(res as any, {
      totalLines: allLines.length,
      returnedLines: recentLines.length,
      logPath,
      entries
    });
  })
);

"""

# export default router の直前に追加
dr_final = dr_cleaned.replace(
    "\nexport default router",
    CORRECT_GPS_API + "\nexport default router"
)
print("  ✅ 正しいGPS Inspector API追加")

w(dr_path, dr_final)

# ── Step5: 350行目前後を確認 ──────────────────────────────
lines2 = dr_final.split('\n')
print(f"\n書き込み後の行数: {len(lines2)}")
print("445〜460行目（新しいAPIの先頭）:")
for i in range(444, min(460, len(lines2))):
    print(f"  {i+1}: {lines2[i]}")

# ── Step6: コンパイルチェック & Push ──────────────────────
print("\n" + "="*60)
print("コンパイルチェック")
print("="*60)

be = tsc("backend", "Backend")
mo = tsc("frontend/mobile", "Mobile")
cm = tsc("frontend/cms", "CMS")

if be and mo and cm:
    print("\n✅ 全コンパイルOK → Git Push")
    subprocess.run(["git","add","-A"], cwd=REPO, capture_output=True)
    rc = subprocess.run(
        ["git","commit","-m","feat: GPS Inspector complete - debug API fixed (session11)"],
        cwd=REPO, capture_output=True, text=True)
    print(f"  commit: {rc.stdout.strip()}")
    rp = subprocess.run(["git","push","origin","main"],
        cwd=REPO, capture_output=True, text=True)
    print("  ✅ Push完了" if rp.returncode==0 else f"  ❌ Push失敗: {rp.stderr[:300]}")
else:
    print("\n❌ まだエラーあり")
    # BE エラーを絞り込んで表示
    if not be:
        res2 = subprocess.run(["npx","tsc","--noEmit"],
            cwd=os.path.join(REPO,"backend"), capture_output=True, text=True, timeout=120)
        err = res2.stdout + res2.stderr
        gps_errs = [l for l in err.split('\n') if 'debugRoutes' in l]
        print("debugRoutes.ts エラー:")
        for l in gps_errs[:20]: print(f"  {l}")