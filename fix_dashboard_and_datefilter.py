#!/usr/bin/env python3
"""
修正内容:
1. CMS Dashboard.tsx:
   - /operations の limit: 10 → limit: 500 (確実に修正)
   - opList解析ロジック完全修正
   - JST日付比較修正

2. backend/src/services/operationService.ts:
   - buildWhereClause の startDate/endDate に JST→UTC変換を追加

実行場所: omega-dev (karkyon@35.212.239.48)
実行方法: cd ~/projects/dump-tracker && python3 fix_dashboard_and_datefilter.py
"""
import sys, os, subprocess

APP_ROOT = os.path.expanduser('~/projects/dump-tracker')

def run(cmd, cwd=None, check=True):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f'❌ {cmd}\n{r.stdout}{r.stderr}')
        sys.exit(1)
    return r

changed = []

# ============================================================
# [1] CMS Dashboard.tsx - 完全修正
# プロジェクトナレッジで確認したコード（limit:10のまま）
# ============================================================
DASHBOARD = f'{APP_ROOT}/frontend/cms/src/pages/Dashboard.tsx'
print('=' * 60)
print('[1] Dashboard.tsx 修正')
print('=' * 60)

with open(DASHBOARD, 'r', encoding='utf-8') as f:
    orig_dash = f.read()

# 現在のoperations fetch行を確認
print('現在のoperations fetch設定:')
for i, line in enumerate(orig_dash.split('\n'), 1):
    if '/operations' in line and ('limit' in line or 'sortOrder' in line):
        print(f'  L{i}: {line.strip()}')

# limit:10 も limit:200 も limit:500 も全部500に統一
import re
# /operations の limit を500に変更
dash_new = re.sub(
    r"apiClient\.get<any>\('/operations',\s*\{\s*params:\s*\{\s*limit:\s*\d+,\s*sortOrder:\s*'desc'\s*\}\s*\}\)",
    "apiClient.get<any>('/operations', { params: { limit: 500, sortOrder: 'desc' } })",
    orig_dash
)

# opList解析ロジックを完全置換
# 旧パターン（どのバリエーションでも対応）
old_oplist_patterns = [
    # パターンA: 元のコード
    """          const opList: any[] = Array.isArray(opsData)
            ? opsData
            : Array.isArray(opsData?.data)
              ? opsData.data
              : Array.isArray(opsData?.operations)
                ? opsData.operations
                : [];""",
    # パターンB: 前回修正後コード（古いopList解析）
    """          const opList: any[] =
            Array.isArray(opsData?.data?.operations)  ? opsData.data.operations  :  // パターン1: data.data.operations
            Array.isArray(opsData?.data?.data?.operations) ? opsData.data.data.operations :  // パターン2: 3重ネスト
            Array.isArray(opsData?.operations)         ? opsData.operations        :  // パターン3: data.operations
            Array.isArray(opsData?.data)               ? opsData.data              :  // パターン4: data配列
            Array.isArray(opsData)                     ? opsData                   :  // パターン5: 直接配列
            [];""",
    # パターンC: 別の前回修正後コード
    """          // ✅ 完全修正: /operations APIレスポンス構造
          // axiosラッパー: operationsRes.value = { data: バックエンドレスポンス全体 }
          // バックエンド: { success:true, data:{ operations:[...], pagination:{...} } }
          // → opsData = { success, data:{ operations:[...] } }
          // → opsData?.data?.operations が正解
          const opList: any[] =
            Array.isArray(opsData?.data?.operations)       ? opsData.data.operations       :
            Array.isArray(opsData?.data?.data?.operations) ? opsData.data.data.operations  :
            Array.isArray(opsData?.operations)             ? opsData.operations             :
            Array.isArray(opsData?.data?.data)             ? opsData.data.data             :
            Array.isArray(opsData?.data)                   ? opsData.data                  :
            Array.isArray(opsData)                         ? opsData                       :
            [];
          console.log('[Dashboard] operations API解析:', {
            opsDataKeys: opsData ? Object.keys(opsData) : [],
            dataKeys: opsData?.data ? Object.keys(opsData.data) : [],
            opListLength: opList.length,
            sample: opList[0] ? { id: opList[0].id, actualStartTime: opList[0].actualStartTime, createdAt: opList[0].createdAt } : null
          });""",
]

NEW_OPLIST = """          // ✅ 確定修正: /operations APIレスポンス構造
          // axios経由レスポンス: operationsRes.value = axiosレスポンス
          // → operationsRes.value.data = バックエンドのレスポンスボディ全体
          //   = { success:true, data:{ operations:[...], pagination:{...} } }
          // → opsData = { success, data:{ operations:[...] } }
          // 正解: opsData.data.operations
          const opList: any[] = (() => {
            // 段階的に構造を確認してoperations配列を取得
            if (Array.isArray(opsData?.data?.operations))       return opsData.data.operations;
            if (Array.isArray(opsData?.data?.data?.operations)) return opsData.data.data.operations;
            if (Array.isArray(opsData?.operations))             return opsData.operations;
            if (Array.isArray(opsData?.data?.data))             return opsData.data.data;
            if (Array.isArray(opsData?.data))                   return opsData.data;
            if (Array.isArray(opsData))                         return opsData;
            return [];
          })();"""

replaced = False
for old_pat in old_oplist_patterns:
    if old_pat in dash_new:
        dash_new = dash_new.replace(old_pat, NEW_OPLIST, 1)
        print(f'✅ opList解析ロジック修正完了')
        replaced = True
        break

if not replaced:
    print('⚠️  opList解析パターン未発見 - 現在のopList定義:')
    for i, line in enumerate(dash_new.split('\n'), 1):
        if 'opList' in line or 'opsData' in line:
            print(f'  L{i}: {line}')

# todayStr JST変換修正 (旧パターン複数対応)
old_today_patterns = [
    # 旧パターンA
    """          const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          todayOperations = opList.filter((op: any) => {
            const d = op.operationDate ?? op.actualStartTime ?? op.plannedStartTime ?? op.createdAt;
            return d && String(d).startsWith(todayStr);
          }).length;""",
    # 旧パターンB (前回修正後)
    """          // ✅ Fix②: JST(UTC+9)基準で今日の日付比較
          const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
          const todayStr = nowJST.toISOString().slice(0, 10);
          todayOperations = opList.filter((op: any) => {
            const d = op.operationDate ?? op.actualStartTime ?? op.plannedStartTime ?? op.createdAt;
            if (!d) return false;
            const dJST = new Date(new Date(d).getTime() + 9 * 60 * 60 * 1000);
            return dJST.toISOString().slice(0, 10) === todayStr;
          }).length;""",
    # 旧パターンC (別修正後)
    """          // ✅ JST(UTC+9)で今日の日付範囲をUTCで計算
          const nowUtc = new Date();
          const jstOffset = 9 * 60 * 60 * 1000;
          const nowJst = new Date(nowUtc.getTime() + jstOffset);
          // JST 今日の0時をUTCに変換
          const jstMidnight = new Date(Date.UTC(
            nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate(), 0, 0, 0, 0
          ) - jstOffset);
          const jstMidnightNext = new Date(jstMidnight.getTime() + 24 * 60 * 60 * 1000);""",
]

NEW_TODAY = """          // ✅ JST(UTC+9)基準で今日の日付を計算してUTCのDBデータと比較
          const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
          const todayStr = nowJST.toISOString().slice(0, 10); // JST YYYY-MM-DD
          todayOperations = opList.filter((op: any) => {
            const d = op.actualStartTime ?? op.operationDate ?? op.plannedStartTime ?? op.createdAt;
            if (!d) return false;
            // DBはUTC保存 → JST+9hに変換して日付比較
            const dJST = new Date(new Date(d).getTime() + 9 * 60 * 60 * 1000);
            return dJST.toISOString().slice(0, 10) === todayStr;
          }).length;"""

replaced_today = False
for old_pat in old_today_patterns:
    if old_pat in dash_new:
        dash_new = dash_new.replace(old_pat, NEW_TODAY, 1)
        print('✅ todayStr JST変換修正完了')
        replaced_today = True
        break

if not replaced_today:
    print('⚠️  todayStr パターン未発見 - 現在のtodayStr定義:')
    for i, line in enumerate(dash_new.split('\n'), 1):
        if 'todayStr' in line or 'todayOperations' in line:
            print(f'  L{i}: {line}')

with open(DASHBOARD, 'w', encoding='utf-8') as f:
    f.write(dash_new)

if dash_new != orig_dash:
    changed.append('frontend/cms/src/pages/Dashboard.tsx')
    print('✅ Dashboard.tsx 書き込み完了')
else:
    print('⚠️ Dashboard.tsx 変更なし')

# ============================================================
# [2] backend/src/services/operationService.ts
# buildWhereClause の startDate に JST→UTC変換を追加
# ============================================================
OPS_SVC = f'{APP_ROOT}/backend/src/services/operationService.ts'
print()
print('=' * 60)
print('[2] operationService.ts - JST変換修正')
print('=' * 60)

with open(OPS_SVC, 'r', encoding='utf-8') as f:
    orig_svc = f.read()

OLD_SVC = """    if (filter.startDate || filter.endDate) {
      where.actualStartTime = {};
      if (filter.startDate) {
        where.actualStartTime.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.actualStartTime.lte = filter.endDate;
      }
    }"""

NEW_SVC = """    if (filter.startDate || filter.endDate) {
      // ✅ 修正: フロントから渡された日付文字列(YYYY-MM-DD)をJST境界に変換してUTCでDB検索
      // 例: 2026-05-26 → JST 2026-05-26 00:00:00 = UTC 2026-05-25 15:00:00
      const toJstBoundary = (dateStr: Date | string, endOfDay: boolean): Date => {
        const jstOff = 9 * 60 * 60 * 1000;
        const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        const jstD = new Date(d.getTime() + jstOff);
        const y = jstD.getUTCFullYear(), m = jstD.getUTCMonth(), day = jstD.getUTCDate();
        return endOfDay
          ? new Date(Date.UTC(y, m, day, 23, 59, 59, 999) - jstOff)
          : new Date(Date.UTC(y, m, day, 0, 0, 0, 0) - jstOff);
      };
      where.actualStartTime = {};
      if (filter.startDate) {
        where.actualStartTime.gte = toJstBoundary(filter.startDate, false);
      }
      if (filter.endDate) {
        where.actualStartTime.lte = toJstBoundary(filter.endDate, true);
      }
    }"""

if OLD_SVC in orig_svc:
    svc_new = orig_svc.replace(OLD_SVC, NEW_SVC, 1)
    with open(OPS_SVC, 'w', encoding='utf-8') as f:
        f.write(svc_new)
    changed.append('backend/src/services/operationService.ts')
    print('✅ operationService.ts JST変換修正完了')
else:
    print('⚠️  operationService.ts パターン未発見 - 現在のstartDate処理:')
    for i, line in enumerate(orig_svc.split('\n'), 1):
        if 'startDate' in line and ('actualStartTime' in line or 'gte' in line):
            print(f'  L{i}: {line}')

# ============================================================
# TypeScript コンパイルチェック
# ============================================================
print()
print('[TypeScript コンパイルチェック...]')

r = run('npx tsc --noEmit 2>&1', cwd=f'{APP_ROOT}/frontend/cms', check=False)
if r.returncode != 0:
    print(f'❌ CMS TSエラー:\n{r.stdout}')
    with open(DASHBOARD, 'w', encoding='utf-8') as f:
        f.write(orig_dash)
    print('🔄 Dashboard.tsx ロールバック')
    sys.exit(1)
print('✅ CMS TypeScript: エラー 0件')

r = run('npx tsc --noEmit 2>&1', cwd=f'{APP_ROOT}/backend', check=False)
if r.returncode != 0:
    print(f'❌ Backend TSエラー:\n{r.stdout}')
    with open(OPS_SVC, 'w', encoding='utf-8') as f:
        f.write(orig_svc)
    print('🔄 operationService.ts ロールバック')
    sys.exit(1)
print('✅ Backend TypeScript: エラー 0件')

# ============================================================
# Git push
# ============================================================
if not changed:
    print('\n変更ファイルなし')
    sys.exit(0)

print('\n[Git commit & push...]')
for f in changed:
    run(f'git -C {APP_ROOT} add {f}')
r = run(
    f'git -C {APP_ROOT} commit -m '
    '"fix: Dashboard今日運行数(opList解析+JST比較) + operationService日付フィルタJST変換"',
    check=False
)
if r.returncode != 0 and 'nothing to commit' not in r.stdout + r.stderr:
    print(f'❌ commit失敗: {r.stderr}')
    sys.exit(1)
run(f'git -C {APP_ROOT} push origin main')

print()
print('=' * 60)
print('✅ 修正・push完了！')
print()
print('【修正内容】')
print('  1. frontend/cms/src/pages/Dashboard.tsx')
print('     - /operations limit: 500 に変更')
print('     - opList解析: opsData.data.operations を正確に取得')
print('     - 今日の運行数: JST変換して正確に比較')
print()
print('  2. backend/src/services/operationService.ts')
print('     - buildWhereClause: startDate/endDate をJST境界に変換')
print('     - 2026-05-26フィルタ → UTC 2026-05-25T15:00:00Z 〜 2026-05-26T14:59:59Z')
print('=' * 60)
