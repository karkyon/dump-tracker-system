import subprocess, sys, os

BASE = "/home/karkyon/projects/dump-tracker"
errors = []

# ======================================================
# 修正1: OperationRecord.tsx
# handleBreakEnd: operationStore.phase → operationStore.previousPhase
# handleBreakEnd: operationStore.setPhase(restoredPhase) 追加
# handleBreakEnd: isSubmittingRef で二重実行防止
# isSubmittingRef 定義追加
# ======================================================
f1 = f"{BASE}/frontend/mobile/src/pages/OperationRecord.tsx"
with open(f1, 'r') as f:
    c1 = f.read()

# (A) isSubmittingRef 定義を isSubmitting state の次行に追加
old_is_submitting_decl = "  const [isSubmitting, setIsSubmitting] = useState(false);"
new_is_submitting_decl = ("  const [isSubmitting, setIsSubmitting] = useState(false);\n"
                           "  const isSubmittingRef = React.useRef(false); // \u30015\u4e8c\u91cd\u5b9f\u884c\u9632\u6b62\u7528Ref")

if old_is_submitting_decl not in c1:
    print("ERROR: isSubmitting宣言が見つかりません")
    errors.append("isSubmitting decl")
elif "isSubmittingRef = React.useRef" not in c1:
    c1 = c1.replace(old_is_submitting_decl, new_is_submitting_decl, 1)
    print("✅ isSubmittingRef 定義追加")
else:
    print("INFO: isSubmittingRef 既に存在")

# (B) handleBreakEnd top: 二重実行防止
old_break_end_top = "  const handleBreakEnd = async () => {\n    try {\n      setIsSubmitting(true);"
new_break_end_top = ("  const handleBreakEnd = async () => {\n"
                     "    // \u30025\u4e8c\u91cd\u5b9f\u884c\u9632\u6b62: isSubmitting state\u306freact\u306e\u518d\u30ec\u30f3\u30c0\u30ea\u30f3\u30b0\u524d\u306b\u5909\u308f\u3089\u306a\u3044\u305f\u3081Ref\u3067\u88dc\u5f37\n"
                     "    if (isSubmittingRef.current) {\n"
                     "      console.warn('\u26a0\ufe0f handleBreakEnd: \u65e2\u306b\u51e6\u7406\u4e2d\u306e\u305f\u3081\u7121\u8996');\n"
                     "      return;\n"
                     "    }\n"
                     "    isSubmittingRef.current = true;\n"
                     "    try {\n"
                     "      setIsSubmitting(true);")

if old_break_end_top not in c1:
    print("ERROR: handleBreakEnd top が見つかりません")
    errors.append("breakend top")
else:
    c1 = c1.replace(old_break_end_top, new_break_end_top, 1)
    print("✅ handleBreakEnd: isSubmittingRef チェック追加")

# (C) handleBreakEnd previousPhase バグ修正
old_prev = ("      // \u30015\u4fee\u6b63: operationStore\u304b\u3089\u4f11\u61a9\u524d\u306e\u30d5\u30a7\u30fc\u30ba\u3092\u5fa9\u5143\n"
            "      const previousPhase = operationStore.phase || 'TO_UNLOADING';\n"
            "      \n"
            "      // \u4f11\u61a9\u524d\u306e\u30d5\u30a7\u30fc\u30ba\u306b\u623b\u308b\n"
            "      setOperation(prev => ({ \n"
            "        ...prev, \n"
            "        phase: previousPhase\n"
            "      }));\n"
            "      \n"
            "      toast.success('\u4f11\u61a9\u3092\u7d42\u4e86\u3057\u307e\u3057\u305f');\n"
            "      \n"
            "      setIsSubmitting(false);")
new_prev = ("      // \u30025\u4fee\u6b63: operationStore.previousPhase \u304b\u3089\u4f11\u61a9\u524d\u306e\u30d5\u30a7\u30fc\u30ba\u3092\u5fa9\u5143\n"
            "      // (operationStore.phase\u306fBREAK\u306e\u305f\u3081\u4f7f\u7528\u4e0d\u53ef)\n"
            "      const restoredPhase = operationStore.previousPhase || 'TO_UNLOADING';\n"
            "      console.log('\u23f1\ufe0f \u4f11\u61a9\u7d42\u4e86: \u30d5\u30a7\u30fc\u30ba\u5fa9\u5143', restoredPhase);\n"
            "      \n"
            "      // operationStore\u306ephase\u3082\u66f4\u65b0\uff08\u6c38\u7d9a\u5316\uff09\n"
            "      operationStore.setPhase(restoredPhase);\n"
            "      \n"
            "      // \u4f11\u61a9\u524d\u306e\u30d5\u30a7\u30fc\u30ba\u306b\u623b\u308b\n"
            "      setOperation(prev => ({ \n"
            "        ...prev, \n"
            "        phase: restoredPhase\n"
            "      }));\n"
            "      \n"
            "      toast.success('\u4f11\u61a9\u3092\u7d42\u4e86\u3057\u307e\u3057\u305f');\n"
            "      \n"
            "      isSubmittingRef.current = false;\n"
            "      setIsSubmitting(false);")

if old_prev not in c1:
    print("ERROR: handleBreakEnd previousPhase箇所が見つかりません")
    idx = c1.find("operationStore.phase || 'TO_UNLOADING'")
    if idx >= 0:
        print(repr(c1[max(0,idx-100):idx+300]))
    errors.append("breakend prev")
else:
    c1 = c1.replace(old_prev, new_prev, 1)
    print("✅ handleBreakEnd: previousPhase参照バグ修正 + setPhase + isSubmittingRef.current=false")

# (D) catch ブロックに isSubmittingRef.current = false 追加
old_catch = ("    } catch (error) {\n"
             "      console.error('\u274c \u4f11\u61a9\u7d42\u4e86\u30a8\u30e9\u30fc:', error);\n"
             "      toast.error('\u4f11\u61a9\u7d42\u4e86\u306b\u5931\u6557\u3057\u307e\u3057\u305f');\n"
             "      setIsSubmitting(false);\n"
             "    }\n"
             "  };\n"
             "\n"
             "  /**\n"
             "   * \u2705 \u65e2\u5b58: \u7d66\u6cb9\u8a18\u9332\u30cf\u30f3\u30c9\u30e9\u30fc")
new_catch = ("    } catch (error) {\n"
             "      console.error('\u274c \u4f11\u61a9\u7d42\u4e86\u30a8\u30e9\u30fc:', error);\n"
             "      toast.error('\u4f11\u61a9\u7d42\u4e86\u306b\u5931\u6557\u3057\u307e\u3057\u305f');\n"
             "      isSubmittingRef.current = false;\n"
             "      setIsSubmitting(false);\n"
             "    }\n"
             "  };\n"
             "\n"
             "  /**\n"
             "   * \u2705 \u65e2\u5b58: \u7d66\u6cb9\u8a18\u9332\u30cf\u30f3\u30c9\u30e9\u30fc")

if old_catch not in c1:
    print("ERROR: handleBreakEnd catch が見つかりません")
    errors.append("breakend catch")
else:
    c1 = c1.replace(old_catch, new_catch, 1)
    print("✅ handleBreakEnd catch: isSubmittingRef.current = false 追加")

if errors:
    print("エラーあり:", errors)
    sys.exit(1)

with open(f1, 'w') as f:
    f.write(c1)
print("✅ OperationRecord.tsx 修正完了")

# ======================================================
# 修正2: LogViewer.tsx - timestamp をJST表示に
# ======================================================
f2 = f"{BASE}/frontend/cms/src/pages/LogViewer.tsx"
with open(f2, 'r') as f:
    c2 = f.read()

old_ts = "                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ja-JP') : ''}"
new_ts = "                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false }) : ''}"

if old_ts not in c2:
    print("ERROR: LogViewer timestamp箇所が見つかりません")
    idx = c2.find('toLocaleTimeString')
    if idx >= 0:
        print(repr(c2[max(0,idx-50):idx+150]))
    sys.exit(1)

c2 = c2.replace(old_ts, new_ts)
with open(f2, 'w') as f:
    f.write(c2)
print("✅ LogViewer.tsx: timestamp JST表示修正完了")

# ======================================================
# 修正3: mobileRoutes.ts に Frontend Debug Log API追加
# POST /api/v1/mobile/debug/log
# ======================================================
f3 = f"{BASE}/backend/src/routes/mobileRoutes.ts"
with open(f3, 'r') as f:
    c3 = f.read()

# すでに追加済みかチェック
if "'/debug/log'" in c3 or '"/debug/log"' in c3:
    print("INFO: /debug/log 既に存在")
else:
    old_export = "export default router;"
    new_debug_route = (
        "// ======================================================\n"
        "// \ud83d\udc1b \u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0API\uff08\u8a8d\u8a3c\u4e0d\u8981\uff09\n"
        "// POST /api/v1/mobile/debug/log\n"
        "// \u30e2\u30d0\u30a4\u30eb\u30a2\u30d7\u30ea\u304b\u3089\u30c7\u30d0\u30c3\u30b0\u60c5\u5831\u3092backend\u30ed\u30b0\u306b\u8a18\u9332\u3059\u308b\n"
        "// ======================================================\n"
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
    # 最後の export default router を置換
    last_idx = c3.rfind(old_export)
    if last_idx < 0:
        print("ERROR: export default router が見つかりません")
        sys.exit(1)
    c3 = c3[:last_idx] + new_debug_route + c3[last_idx+len(old_export):]
    with open(f3, 'w') as f:
        f.write(c3)
    print("✅ mobileRoutes.ts: POST /mobile/debug/log 追加")

# ======================================================
# 修正4: GoogleMapWrapper.tsx にデバッグログ送信を追加
# ======================================================
f4 = f"{BASE}/frontend/mobile/src/components/GoogleMapWrapper.tsx"
with open(f4, 'r') as f:
    c4 = f.read()

if 'sendDebugLog' in c4:
    print("INFO: sendDebugLog 既に存在")
else:
    old_set_heading_fn = ("export const setMapHeading = (heading: number) => {\n"
                          "  if (heading === null || heading === undefined || isNaN(heading)) return;\n"
                          "\n"
                          "  // \u30de\u30fc\u30ab\u30fc\u306eSVG\u77e2\u5370\u3092\u5e38\u306b\u66f4\u65b0\n"
                          "  updateMarkerHeading(heading);\n"
                          "\n"
                          "  if (!globalMapInstance) return;\n"
                          "\n"
                          "  // isVector\u5224\u5b9a\u5ec3\u6b62 - MapID+Vector\u8a2d\u5b9a\u6e08\u307f\u306e\u305f\u3081\u76f4\u63a5setHeading\u547c\u3073\u51fa\u3057\n"
                          "  if (typeof globalMapInstance.setHeading === 'function') {\n"
                          "    try {\n"
                          "      globalMapInstance.setHeading(heading);\n"
                          "    } catch (e) {\n"
                          "      console.warn('\u26a0\ufe0f setHeading:', String(e).substring(0, 80));\n"
                          "    }\n"
                          "  }\n"
                          "};")

    new_set_heading_fn = ("// \ud83d\udc1b \u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0\u9001\u4fe1\uff08\u30b5\u30fc\u30d0\u30fc\u306b\u8a18\u9332\uff09\n"
                          "const sendDebugLog = (message: string, data?: any) => {\n"
                          "  try {\n"
                          "    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '';\n"
                          "    fetch(`${apiBase}/api/v1/mobile/debug/log`, {\n"
                          "      method: 'POST',\n"
                          "      headers: { 'Content-Type': 'application/json' },\n"
                          "      body: JSON.stringify({ level: 'info', message, data }),\n"
                          "      keepalive: true\n"
                          "    }).catch(() => {});\n"
                          "  } catch (_) {}\n"
                          "};\n"
                          "let _lastDebugSentAt = 0;\n"
                          "\n"
                          "export const setMapHeading = (heading: number) => {\n"
                          "  if (heading === null || heading === undefined || isNaN(heading)) return;\n"
                          "\n"
                          "  // \u30de\u30fc\u30ab\u30fc\u306eSVG\u77e2\u5370\u3092\u5e38\u306b\u66f4\u65b0\n"
                          "  updateMarkerHeading(heading);\n"
                          "\n"
                          "  if (!globalMapInstance) {\n"
                          "    const now = Date.now();\n"
                          "    if (now - _lastDebugSentAt > 5000) {\n"
                          "      _lastDebugSentAt = now;\n"
                          "      sendDebugLog('setMapHeading: globalMapInstance=null', { heading });\n"
                          "    }\n"
                          "    return;\n"
                          "  }\n"
                          "\n"
                          "  const renderingType = globalMapInstance.getRenderingType?.();\n"
                          "  const VECTOR = (window as any).google?.maps?.RenderingType?.VECTOR;\n"
                          "  const hasSetHeading = typeof globalMapInstance.setHeading === 'function';\n"
                          "\n"
                          "  if (hasSetHeading) {\n"
                          "    try {\n"
                          "      globalMapInstance.setHeading(heading);\n"
                          "      const now = Date.now();\n"
                          "      if (now - _lastDebugSentAt > 5000) {\n"
                          "        _lastDebugSentAt = now;\n"
                          "        sendDebugLog('setMapHeading: OK', {\n"
                          "          heading: Math.round(heading),\n"
                          "          renderingType: String(renderingType),\n"
                          "          isVector: VECTOR ? renderingType === VECTOR : 'VECTOR_API_UNAVAILABLE',\n"
                          "        });\n"
                          "      }\n"
                          "    } catch (e) {\n"
                          "      sendDebugLog('setMapHeading: setHeading ERROR', { heading, error: String(e).substring(0, 100) });\n"
                          "      console.warn('\u26a0\ufe0f setHeading:', String(e).substring(0, 80));\n"
                          "    }\n"
                          "  } else {\n"
                          "    const now = Date.now();\n"
                          "    if (now - _lastDebugSentAt > 5000) {\n"
                          "      _lastDebugSentAt = now;\n"
                          "      sendDebugLog('setMapHeading: setHeading NOT AVAILABLE', {\n"
                          "        heading,\n"
                          "        renderingType: String(renderingType),\n"
                          "        globalMapInstanceType: typeof globalMapInstance\n"
                          "      });\n"
                          "    }\n"
                          "  }\n"
                          "};")

    if old_set_heading_fn not in c4:
        print("ERROR: setMapHeading関数が見つかりません")
        idx = c4.find('export const setMapHeading')
        if idx >= 0:
            print(repr(c4[idx:idx+600]))
        sys.exit(1)

    c4 = c4.replace(old_set_heading_fn, new_set_heading_fn)
    with open(f4, 'w') as f:
        f.write(c4)
    print("✅ GoogleMapWrapper.tsx: setMapHeading にデバッグログ追加")

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
        print("❌ TSCエラー - pushしません"); sys.exit(1)

print("\n✅ TSC全RC=0 - git commit & push")
subprocess.run(["git","add","-A"],cwd=BASE)
r=subprocess.run(["git","commit","-m",
    "fix: handleBreakEnd previousPhase修正+連打防止; LogViewer JST; mobile debug log API; MapWrapper setHeadingデバッグ"],
    cwd=BASE,capture_output=True,text=True)
print("Commit:",r.stdout.strip())
rp=subprocess.run(["git","push","origin","main"],cwd=BASE,capture_output=True,text=True)
print("Push STDOUT:",rp.stdout.strip())
print("Push STDERR:",rp.stderr.strip())
print("Push RC:",rp.returncode)
