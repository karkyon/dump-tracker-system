import subprocess, sys

BASE = "/home/karkyon/projects/dump-tracker"

# ======================================================
# 修正1: GoogleMapWrapper.tsx
# sendDebugLog の URL を /api/v1/mobile/debug/log に修正
# VITE_API_BASE_URL=/api/v1 なので /api/v1 は含めない
# ======================================================
f1 = f"{BASE}/frontend/mobile/src/components/GoogleMapWrapper.tsx"
with open(f1, 'r') as f:
    c1 = f.read()

old_send = (
    "const sendDebugLog = (message: string, data?: any) => {\n"
    "  try {\n"
    "    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '';\n"
    "    fetch(`${apiBase}/api/v1/mobile/debug/log`, {"
)
new_send = (
    "const sendDebugLog = (message: string, data?: any) => {\n"
    "  try {\n"
    "    // VITE_API_BASE_URL=/api/v1 なので mobile/debug/log だけ追加\n"
    "    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';\n"
    "    fetch(`${apiBase}/mobile/debug/log`, {"
)

if old_send in c1:
    c1 = c1.replace(old_send, new_send)
    print("OK: sendDebugLog URL修正完了")
else:
    print("ERROR: sendDebugLog パターンが見つかりません")
    idx = c1.find('sendDebugLog')
    if idx >= 0:
        print(repr(c1[idx:idx+300]))
    sys.exit(1)

with open(f1, 'w') as f:
    f.write(c1)

# ======================================================
# 修正2: App.tsx
# console.log/warn/error を全てバックエンドに送信するinterceptorを追加
# これにより全フロントエンドログをバックエンドで確認可能
# ======================================================
f2 = f"{BASE}/frontend/mobile/src/App.tsx"
with open(f2, 'r') as f:
    c2 = f.read()

if 'consoleInterceptor' in c2 or '_originalConsole' in c2:
    print("INFO: console interceptor 既に存在")
else:
    # checkServerConnection の呼び出しの直前にinterceptorを追加
    old_app_effect = (
        "    console.log('🚀 ダンプ運行記録モバイルアプリ起動中...');\n"
        "    console.log('📋 環境変数:');\n"
        "    console.log(`  - API_BASE_URL: ${import.meta.env.VITE_API_BASE_URL || '未設定'}`);\n"
        "    console.log(`  - NODE_ENV: ${import.meta.env.MODE}`);\n"
        "    \n"
        "    checkServerConnection();"
    )
    new_app_effect = (
        "    console.log('🚀 ダンプ運行記録モバイルアプリ起動中...');\n"
        "    console.log('📋 環境変数:');\n"
        "    console.log(`  - API_BASE_URL: ${import.meta.env.VITE_API_BASE_URL || '未設定'}`);\n"
        "    console.log(`  - NODE_ENV: ${import.meta.env.MODE}`);\n"
        "\n"
        "    // 🐛 フロントエンドconsoleをバックエンドに転送\n"
        "    const _apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';\n"
        "    const _logUrl = `${_apiBase}/mobile/debug/log`;\n"
        "    let _logBuf: any[] = [];\n"
        "    let _logTimer: any = null;\n"
        "    const _flush = () => {\n"
        "      if (_logBuf.length === 0) return;\n"
        "      const batch = _logBuf.splice(0);\n"
        "      fetch(_logUrl, {\n"
        "        method: 'POST',\n"
        "        headers: { 'Content-Type': 'application/json' },\n"
        "        body: JSON.stringify({ level: 'info', message: '[CONSOLE_BATCH]', data: batch }),\n"
        "        keepalive: true\n"
        "      }).catch(() => {});\n"
        "    };\n"
        "    const _intercept = (level: string, orig: (...a: any[]) => void) =>\n"
        "      (...args: any[]) => {\n"
        "        orig.apply(console, args);\n"
        "        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');\n"
        "        _logBuf.push({ level, msg, t: new Date().toISOString() });\n"
        "        if (_logBuf.length >= 10) { clearTimeout(_logTimer); _flush(); }\n"
        "        else { clearTimeout(_logTimer); _logTimer = setTimeout(_flush, 2000); }\n"
        "      };\n"
        "    console.log = _intercept('log', console.log);\n"
        "    console.warn = _intercept('warn', console.warn);\n"
        "    console.error = _intercept('error', console.error);\n"
        "\n"
        "    checkServerConnection();"
    )

    if old_app_effect in c2:
        c2 = c2.replace(old_app_effect, new_app_effect)
        with open(f2, 'w') as f:
            f.write(c2)
        print("OK: App.tsx console interceptor追加完了")
    else:
        print("WARNING: App.tsx パターン見つからず - URLのみ修正で継続")

# ======================================================
# TSCコンパイルチェック
# ======================================================
for pkg, d in [("mobile","frontend/mobile"),("CMS","frontend/cms"),("backend","backend")]:
    r = subprocess.run(["./node_modules/.bin/tsc","--noEmit"],
        cwd=f"{BASE}/{d}", capture_output=True, text=True)
    print(f"TSC {pkg} RC:", r.returncode)
    if r.returncode != 0:
        print(r.stdout[:3000])
        print(r.stderr[:1000])
        print("TSCエラー - pushしません"); sys.exit(1)

print("\nTSC全RC=0 - git commit & push")
subprocess.run(["git","add","-A"],cwd=BASE)
r=subprocess.run(["git","commit","-m",
    "fix: sendDebugLog URL修正(/api/v1重複解消); App.tsx console全ログをbackendに転送"],
    cwd=BASE,capture_output=True,text=True)
print("Commit:",r.stdout.strip())
rp=subprocess.run(["git","push","origin","main"],cwd=BASE,capture_output=True,text=True)
print("Push STDERR:",rp.stderr.strip())
print("Push RC:",rp.returncode)
