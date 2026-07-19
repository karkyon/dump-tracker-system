#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
omega-dev (~/projects/dump-tracker) で実行すること。
対応内容:
  ① D4運行記録メイン画面: スクロール最下部の「＋」ボタンが押しづらい問題を修正
     （同一パターンの OperationHistoryDetail.tsx にも予防修正）
  ② 日報の移動時間から、区間内に発生した休憩時間を差し引くよう修正
  ④ mobileの休憩ボタン表示を「休憩・待機」に変更
  ⑤ 品目選択後のボタン文言を運行パターンで出し分け（P3=運行開始 / P1,P2=積込開始）

実行手順:
  1. git pull で最新化
  2. パッチ適用前に backend / frontend/cms / frontend/mobile を一旦フルコンパイルしてエラー数を記録(ベースライン)
  3. 5件のパッチを一意アンカーで適用（1件でも一致しなければ即中断・変更なし）
  4. パッチ適用後に再度3プロジェクトをフルコンパイルし、エラー数がベースライン以下であることを確認
  5. 3プロジェクトすべてで新規エラー0を確認できた場合のみ commit + push
  6. 自分自身（このファイル）を自己削除

失敗した場合は一切 commit / push を行わず、コード変更のみ作業ツリーに残して終了します。
"""
import subprocess
import sys
import re
import os

REPO_ROOT = os.path.expanduser("~/projects/dump-tracker")

PATCHES = [
    # ---- ① OperationRecord.tsx: スクロール最下部の余白確保 ----
    (
        "frontend/mobile/src/pages/OperationRecord.tsx",
        "            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#fff', WebkitOverflowScrolling: 'touch', padding: '8px 10px' }}>",
        "            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#fff', WebkitOverflowScrolling: 'touch', padding: '8px 10px calc(96px + env(safe-area-inset-bottom, 0px))' }}>",
        "①D4運行記録メイン: リスト最下部の＋ボタン用に下部余白を拡大",
    ),
    # ---- ① OperationHistoryDetail.tsx: 同一パターンの予防修正 ----
    (
        "frontend/mobile/src/pages/OperationHistoryDetail.tsx",
        '    <div className="min-h-screen bg-gray-50 pb-8">',
        '    <div className="min-h-screen bg-gray-50 pb-32">',
        "①運行履歴詳細: 同一パターンの予防修正（下部余白拡大）",
    ),
    # ---- ④ 休憩ボタンの表示変更（メイン操作ボタン） ----
    (
        "frontend/mobile/src/pages/OperationRecord.tsx",
        """          <button
            onClick={handleBreakStart}
            disabled={isSubmitting || operation.phase === 'BREAK'}
            style={{
              padding: '20px 12px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: operation.phase === 'BREAK' ? '#ccc' : '#9C27B0',
              border: 'none',
              borderRadius: '10px',
              cursor: operation.phase === 'BREAK' ? 'not-allowed' : 'pointer'
            }}
          >
            ☕ 休憩
          </button>""",
        """          <button
            onClick={handleBreakStart}
            disabled={isSubmitting || operation.phase === 'BREAK'}
            style={{
              padding: '20px 12px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: operation.phase === 'BREAK' ? '#ccc' : '#9C27B0',
              border: 'none',
              borderRadius: '10px',
              cursor: operation.phase === 'BREAK' ? 'not-allowed' : 'pointer'
            }}
          >
            ☕ 休憩・待機
          </button>""",
        "④休憩ボタン文言変更（D4メインボタン）",
    ),
    # ---- ④ イベント追加ピッカーの休憩ラベル(OperationRecord) ----
    (
        "frontend/mobile/src/pages/OperationRecord.tsx",
        "                { type: 'BREAK_START', label: '☕ 休憩', color: '#6A1B9A', bg: '#F3E5F5' },",
        "                { type: 'BREAK_START', label: '☕ 休憩・待機', color: '#6A1B9A', bg: '#F3E5F5' },",
        "④休憩ボタン文言変更（D4イベント追加ピッカー）",
    ),
    # ---- ④ イベント追加ピッカーの休憩ラベル(OperationHistoryDetail) ----
    (
        "frontend/mobile/src/pages/OperationHistoryDetail.tsx",
        "                { type: 'BREAK_START', label: '☕ 休憩', color: '#6A1B9A', bg: '#F3E5F5' },",
        "                { type: 'BREAK_START', label: '☕ 休憩・待機', color: '#6A1B9A', bg: '#F3E5F5' },",
        "④休憩ボタン文言変更（運行履歴詳細イベント追加ピッカー）",
    ),
    # ---- ⑤ 運行パターンによるボタン文言出し分け: 変数定義追加 ----
    (
        "frontend/mobile/src/pages/LoadingInput.tsx",
        "  const isStartButtonEnabled = hasItemSelected && finalConfirmed && !isSubmitting;\n",
        "  const isStartButtonEnabled = hasItemSelected && finalConfirmed && !isSubmitting;\n\n"
        "  // ⑤ 運行パターンにより表示文言を出し分け: P3=「運行開始」 / P1,P2=「積込開始」\n"
        "  const _startBtnLoadingPattern = Number((operationStore as any).loadingPattern ?? 2);\n"
        "  const startButtonLabel = _startBtnLoadingPattern === 3 ? '運行開始' : '積込開始';\n",
        "⑤startButtonLabel変数追加",
    ),
    # ---- ⑤ 注意文言の動的化 ----
    (
        "frontend/mobile/src/pages/LoadingInput.tsx",
        "               注意: 「運行開始」ボタンを押すと、GPS位置と共に積込記録が登録され、積降場所への移動フェーズに移行します。",
        "               注意: 「{startButtonLabel}」ボタンを押すと、GPS位置と共に積込記録が登録され、積降場所への移動フェーズに移行します。",
        "⑤注意文言の動的化",
    ),
    # ---- ⑤ ボタン本体の文言出し分け ----
    (
        "frontend/mobile/src/pages/LoadingInput.tsx",
        """            {isSubmitting ? (
              <>処理中...</>
            ) : (
              <>
                <PlayCircle style={{ width: '20px', height: '20px' }} />
                運行開始
              </>
            )}
          </button>""",
        """            {isSubmitting ? (
              <>処理中...</>
            ) : (
              <>
                <PlayCircle style={{ width: '20px', height: '20px' }} />
                {startButtonLabel}
              </>
            )}
          </button>""",
        "⑤ボタン文言出し分け本体",
    ),
    # ---- ② 移動時間から休憩時間を除外: ユーティリティ追加 ----
    (
        "backend/src/services/reportService.ts",
        "  const minutesStr = (m: number): string => m < 0 ? '' : `${m}分`;\n\n"
        "  // ---------- Pass2: グループ化 ----------",
        "  const minutesStr = (m: number): string => m < 0 ? '' : `${m}分`;\n\n"
        "  // ---------- 休憩時間区間の収集（移動時間から除外するため）----------\n"
        "  // 積込終了〜荷降開始の間に休憩(BREAK_START〜BREAK_END)が発生していた場合、\n"
        "  // その分を移動時間から差し引く（休憩時間は移動時間に含めない）。\n"
        "  interface BreakInterval { startMin: number; endMin: number; }\n"
        "  const breakIntervals: BreakInterval[] = [];\n"
        "  {\n"
        "    let breakStartMin: number | null = null;\n"
        "    for (const d of allDetails) {\n"
        "      const bAt: string = (d.activity_type ?? d.activityType ?? '').toUpperCase();\n"
        "      if (bAt === 'BREAK_START' || bAt === 'BREAK') {\n"
        "        const st = formatTime(d.actual_start_time ?? d.actualStartTime);\n"
        "        breakStartMin = st ? toMinutes(st) : null;\n"
        "      } else if (bAt === 'BREAK_END') {\n"
        "        if (breakStartMin != null) {\n"
        "          const endRaw = d.actual_start_time ?? d.actualStartTime ?? d.actual_end_time ?? d.actualEndTime;\n"
        "          const endT = formatTime(endRaw);\n"
        "          const endMin = endT ? toMinutes(endT) : -1;\n"
        "          if (endMin >= 0 && endMin >= breakStartMin) {\n"
        "            breakIntervals.push({ startMin: breakStartMin, endMin });\n"
        "          }\n"
        "          breakStartMin = null;\n"
        "        }\n"
        "      }\n"
        "    }\n"
        "  }\n"
        "  const subtractBreakOverlap = (startHHMM: string, endHHMM: string, rawMin: number): number => {\n"
        "    if (rawMin < 0) return rawMin;\n"
        "    const s = toMinutes(startHHMM);\n"
        "    const e = toMinutes(endHHMM);\n"
        "    if (s < 0 || e < 0) return rawMin;\n"
        "    let overlap = 0;\n"
        "    for (const b of breakIntervals) {\n"
        "      const os = Math.max(s, b.startMin);\n"
        "      const oe = Math.min(e, b.endMin);\n"
        "      if (oe > os) overlap += (oe - os);\n"
        "    }\n"
        "    return Math.max(0, rawMin - overlap);\n"
        "  };\n\n"
        "  // ---------- Pass2: グループ化 ----------",
        "②休憩時間除外ユーティリティ追加",
    ),
    # ---- ② moveMin計算に休憩除外を適用 ----
    (
        "backend/src/services/reportService.ts",
        "    // 移動時間 = 積込終了 → 荷降開始\n"
        "    const moveMin = diffMinutes(c.loadingEnd, c.unloadingStart);",
        "    // 移動時間 = 積込終了 → 荷降開始（区間内に休憩があれば休憩時間を差し引く）\n"
        "    const moveMinRaw = diffMinutes(c.loadingEnd, c.unloadingStart);\n"
        "    const moveMin = subtractBreakOverlap(c.loadingEnd, c.unloadingStart, moveMinRaw);",
        "②moveMin計算に休憩除外を適用",
    ),
]

COMMIT_MESSAGE = (
    "fix: D4/運行履歴の追加ボタン下部余白拡大、日報移動時間から休憩時間を除外、"
    "休憩ボタン表示を「休憩・待機」に変更、品目選択後ボタンを運行パターン別に出し分け(P3=運行開始/P1,P2=積込開始)"
)


def run(cmd, cwd):
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def count_errors(output: str) -> int:
    return len(re.findall(r"error TS\d+", output))


def compile_project(rel_path, label, with_prisma_generate=False):
    cwd = os.path.join(REPO_ROOT, rel_path)
    if with_prisma_generate:
        run(["npx", "prisma", "generate", "--schema=prisma/schema.camel.prisma"], cwd)
    result = run(["./node_modules/.bin/tsc", "--noEmit"], cwd)
    output = (result.stdout or "") + (result.stderr or "")
    n = count_errors(output)
    print(f"  -> {label}: error TS 件数 = {n}")
    return n, output


def apply_patch(rel_path, old, new, desc):
    full = os.path.join(REPO_ROOT, rel_path)
    with open(full, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count != 1:
        print(f"[NG] {desc}: アンカー文字列が {count} 件ヒット（1件のみ想定）-> {rel_path}")
        print("     最新コードとズレている可能性があります。中断します（変更は保存済みの分のみ）。")
        sys.exit(1)
    content = content.replace(old, new)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] {desc} -> {rel_path}")


def main():
    if not os.path.isdir(REPO_ROOT):
        print(f"[ERROR] リポジトリが見つかりません: {REPO_ROOT}")
        sys.exit(1)

    print("=== [0/5] git pull で最新化 ===")
    r = run(["git", "pull", "--ff-only", "origin", "main"], REPO_ROOT)
    print(r.stdout, r.stderr)
    if r.returncode != 0:
        print("[ERROR] git pull に失敗しました。作業ツリーの状態を確認してください。")
        sys.exit(1)

    print("\n=== [1/5] パッチ適用前ベースライン計測 ===")
    base_backend, _ = compile_project("backend", "backend(適用前)", with_prisma_generate=True)
    base_cms, _ = compile_project("frontend/cms", "frontend/cms(適用前)")
    base_mobile, _ = compile_project("frontend/mobile", "frontend/mobile(適用前)")

    print("\n=== [2/5] パッチ適用 ===")
    for rel_path, old, new, desc in PATCHES:
        apply_patch(rel_path, old, new, desc)

    print("\n=== [3/5] パッチ適用後コンパイル ===")
    after_backend, out_backend = compile_project("backend", "backend(適用後)", with_prisma_generate=True)
    after_cms, out_cms = compile_project("frontend/cms", "frontend/cms(適用後)")
    after_mobile, out_mobile = compile_project("frontend/mobile", "frontend/mobile(適用後)")

    print("\n=== [4/5] エラー数比較 ===")
    results = [
        ("backend", base_backend, after_backend, out_backend),
        ("frontend/cms", base_cms, after_cms, out_cms),
        ("frontend/mobile", base_mobile, after_mobile, out_mobile),
    ]
    ng = False
    for name, before, after, out in results:
        status = "OK" if after <= before else "NG(新規エラーあり)"
        print(f"  {name}: 適用前={before}件 / 適用後={after}件 -> {status}")
        if after > before:
            ng = True
            print(out)

    if ng:
        print("\n[STOP] 新規コンパイルエラーが発生したため commit / push は行いません。")
        print("       コード変更は作業ツリーに残っています。上記ログを確認してください。")
        sys.exit(1)

    print("\n=== [5/5] commit + push ===")
    r = run(["git", "add", "-A"], REPO_ROOT)
    r = run(["git", "commit", "-m", COMMIT_MESSAGE], REPO_ROOT)
    print(r.stdout, r.stderr)
    if r.returncode != 0:
        print("[ERROR] git commit に失敗しました。")
        sys.exit(1)
    r = run(["git", "push", "origin", "main"], REPO_ROOT)
    print(r.stdout, r.stderr)
    if r.returncode != 0:
        print("[ERROR] git push に失敗しました。commitはローカルに残っています。")
        sys.exit(1)

    print("\n[DONE] push完了。GitHub Actions により本番へ自動デプロイされます。")
    print("       ステージングへの反映は、これまで通り手動でCI/CDをトリガーしてください。")

    # 自己削除
    try:
        os.remove(os.path.abspath(__file__))
        print("[CLEANUP] このスクリプト自身を削除しました。")
    except Exception as e:
        print(f"[WARN] 自己削除に失敗しました（手動で削除してください）: {e}")


if __name__ == "__main__":
    main()
