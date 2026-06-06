import subprocess, sys

BASE = "/home/karkyon/projects/dump-tracker"

# ======================================================
# 修正1: logger.ts の Winston timestamp を JST に変更
# ======================================================
f1 = f"{BASE}/backend/src/utils/logger.ts"
with open(f1, 'r') as f:
    c1 = f.read()

old_ts = "  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),"
new_ts = ("  winston.format.timestamp({ format: () => {\n"
          "    return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo',\n"
          "      year: 'numeric', month: '2-digit', day: '2-digit',\n"
          "      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false\n"
          "    }).replace(/\\//g, '-');\n"
          "  } }),")

if old_ts in c1:
    c1 = c1.replace(old_ts, new_ts)
    with open(f1, 'w') as f:
        f.write(c1)
    print("OK: logger.ts Winston timestamp JST化")
else:
    print("ERROR: logger timestamp パターン見つからず")
    idx = c1.find('format.timestamp')
    print(repr(c1[max(0,idx-20):idx+100]))
    sys.exit(1)

# ======================================================
# 修正2: mobileRoutes.ts の /debug/log を 404ハンドラーより前に移動
# 現状: 404ハンドラー(router.use('*',...)) の後に追加されている
# → 404ハンドラーより先に定義し直す
# ======================================================
f2 = f"{BASE}/backend/src/routes/mobileRoutes.ts"
with open(f2, 'r') as f:
    c2 = f.read()

# 現在末尾にある debug/log ルートを削除
old_debug_at_end = (
    "// 🐛 フロントエンドデバッグログAPI（認証不要）\n"
    "// POST /api/v1/mobile/debug/log\n"
    "router.post(\n"
    "  '/debug/log',\n"
    "  asyncHandler(async (req: Request, res: Response) => {\n"
    "    const { level = 'info', message, data } = req.body;\n"
    "    const safeLevel = ['error','warn','info','debug'].includes(level) ? level : 'info';\n"
    "    (logger as any)[safeLevel](`[FRONTEND] ${message}`, data || {});\n"
    "    res.json({ success: true });\n"
    "  })\n"
    ");\n\n"
    "export default router;"
)

if old_debug_at_end not in c2:
    print("WARNING: debug/log末尾パターンが見つかりません")
    # 別パターンで探す
    idx = c2.find("'/debug/log'")
    if idx >= 0:
        print(f"INFO: /debug/log は {idx} にある")
else:
    # 末尾から削除してexportだけ残す
    c2 = c2.replace(old_debug_at_end, "export default router;")
    print("OK: 末尾の debug/log 削除")

# 404ハンドラー(router.use('*',...)) の直前に debug/log を挿入
old_404 = "// =====================================\n// 🚫 404ハンドラー\n// ====================================="
new_with_debug = (
    "// 🐛 フロントエンドデバッグログAPI（認証不要・404ハンドラーより前に配置）\n"
    "// POST /api/v1/mobile/debug/log\n"
    "router.post(\n"
    "  '/debug/log',\n"
    "  asyncHandler(async (req: Request, res: Response) => {\n"
    "    const { level = 'info', message, data } = req.body;\n"
    "    const safeLevel = ['error','warn','info','debug'].includes(level) ? level : 'info';\n"
    "    (logger as any)[safeLevel](`[FRONTEND] ${message}`, data || {});\n"
    "    res.json({ success: true });\n"
    "  })\n"
    ");\n\n"
    "// =====================================\n// 🚫 404ハンドラー\n// ====================================="
)

if old_404 in c2:
    c2 = c2.replace(old_404, new_with_debug, 1)
    with open(f2, 'w') as f:
        f.write(c2)
    print("OK: mobileRoutes debug/log を404ハンドラー前に移動")
else:
    print("ERROR: 404ハンドラーセクションが見つかりません")
    sys.exit(1)

# ======================================================
# TSCチェック
# ======================================================
for pkg, d in [("backend","backend"),("mobile","frontend/mobile"),("CMS","frontend/cms")]:
    r = subprocess.run(["./node_modules/.bin/tsc","--noEmit"],
        cwd=f"{BASE}/{d}", capture_output=True, text=True)
    print(f"TSC {pkg} RC:", r.returncode)
    if r.returncode != 0:
        print(r.stdout[:3000])
        print("TSCエラー - pushしません"); sys.exit(1)

print("\nTSC全RC=0 - git commit & push")
subprocess.run(["git","add","-A"],cwd=BASE)
r=subprocess.run(["git","commit","-m",
    "fix: logger JST timestamp; mobileRoutes debug/log を404より前に移動(フロントログ受信修正)"],
    cwd=BASE, capture_output=True, text=True)
print("Commit:",r.stdout.strip())
rp=subprocess.run(["git","push","origin","main"],cwd=BASE,capture_output=True,text=True)
print("Push STDERR:",rp.stderr.strip())
print("Push RC:",rp.returncode)
