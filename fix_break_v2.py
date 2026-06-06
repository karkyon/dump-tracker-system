import subprocess, sys

BASE = "/home/karkyon/projects/dump-tracker"

# ======================================================
# 修正1: OperationRecord.tsx handleBreakEnd
# previousPhase バグ修正 + operationStore.setPhase追加
# (isSubmittingRef は前回スクリプトで既に追加済み)
# ======================================================
f1 = f"{BASE}/frontend/mobile/src/pages/OperationRecord.tsx"
with open(f1, 'r') as f:
    c1 = f.read()

# 実際のコード（前回のisSubmittingRef追加後の状態）
# handleBreakEnd top は既に修正済みのはず
# previousPhase の箇所のみ修正する

old_prev = """      // 🔧 修正: operationStoreから休憩前のフェーズを復元
      const previousPhase = operationStore.phase || 'TO_UNLOADING';
      
      // 休憩前のフェーズに戻る
      setOperation(prev => ({ 
        ...prev, 
        phase: previousPhase
      }));
      
      toast.success('休憩を終了しました');
      
      setIsSubmitting(false);"""

new_prev = """      // 🔧 修正: operationStore.previousPhase から休憩前のフェーズを復元
      // (operationStore.phaseはBREAKのため使用不可)
      const restoredPhase = operationStore.previousPhase || 'TO_UNLOADING';
      console.log('⏱️ 休憩終了: フェーズ復元', restoredPhase);
      
      // operationStoreのphaseも更新（永続化）
      operationStore.setPhase(restoredPhase);
      
      // 休憩前のフェーズに戻る
      setOperation(prev => ({ 
        ...prev, 
        phase: restoredPhase
      }));
      
      toast.success('休憩を終了しました');
      
      isSubmittingRef.current = false;
      setIsSubmitting(false);"""

if old_prev in c1:
    c1 = c1.replace(old_prev, new_prev)
    print("✅ handleBreakEnd: previousPhase修正完了")
else:
    # すでに修正済みかチェック
    if 'operationStore.previousPhase' in c1:
        print("INFO: handleBreakEnd previousPhase 既に修正済み")
    else:
        print("ERROR: パターンが見つかりません")
        # デバッグ用: 実際のコード周辺を表示
        idx = c1.find('休憩終了API成功')
        if idx >= 0:
            print("=== 実際のコード ===")
            print(repr(c1[idx:idx+600]))
        sys.exit(1)

# catch ブロックに isSubmittingRef.current = false 追加（なければ）
old_catch = """    } catch (error) {
      console.error('❌ 休憩終了エラー:', error);
      toast.error('休憩終了に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 給油記録ハンドラー"""

new_catch = """    } catch (error) {
      console.error('❌ 休憩終了エラー:', error);
      toast.error('休憩終了に失敗しました');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 給油記録ハンドラー"""

if old_catch in c1:
    c1 = c1.replace(old_catch, new_catch)
    print("✅ handleBreakEnd catch: isSubmittingRef.current=false 追加")
elif 'isSubmittingRef.current = false;\n      setIsSubmitting(false);\n    }\n  };\n\n  /**\n   * ✅ 既存: 給油記録ハンドラー' in c1:
    print("INFO: catch の isSubmittingRef 既に修正済み")
else:
    print("WARNING: catch パターン見つからず（スキップ）")

with open(f1, 'w') as f:
    f.write(c1)
print("✅ OperationRecord.tsx 修正完了")

# ======================================================
# 修正2: LogViewer.tsx - JST表示（未適用なら適用）
# ======================================================
f2 = f"{BASE}/frontend/cms/src/pages/LogViewer.tsx"
with open(f2, 'r') as f:
    c2 = f.read()

old_ts = "new Date(entry.timestamp).toLocaleTimeString('ja-JP')"
new_ts = "new Date(entry.timestamp).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })"

if old_ts in c2:
    c2 = c2.replace(old_ts, new_ts)
    with open(f2, 'w') as f:
        f.write(c2)
    print("✅ LogViewer.tsx: JST表示修正完了")
elif 'Asia/Tokyo' in c2:
    print("INFO: LogViewer JST 既に修正済み")
else:
    print("WARNING: LogViewer timestamp パターン見つからず")

# ======================================================
# 修正3: mobileRoutes.ts - debug/log API（未追加なら追加）
# ======================================================
f3 = f"{BASE}/backend/src/routes/mobileRoutes.ts"
with open(f3, 'r') as f:
    c3 = f.read()

if "'/debug/log'" in c3 or '"/debug/log"' in c3:
    print("INFO: /debug/log 既に存在")
else:
    old_export = "export default router;"
    new_route = (
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
    last_idx = c3.rfind(old_export)
    if last_idx < 0:
        print("ERROR: export default router が見つかりません")
        sys.exit(1)
    c3 = c3[:last_idx] + new_route + c3[last_idx+len(old_export):]
    with open(f3, 'w') as f:
        f.write(c3)
    print("✅ mobileRoutes.ts: POST /mobile/debug/log 追加")

# ======================================================
# 修正4: GoogleMapWrapper.tsx - sendDebugLog（未追加なら追加）
# ======================================================
f4 = f"{BASE}/frontend/mobile/src/components/GoogleMapWrapper.tsx"
with open(f4, 'r') as f:
    c4 = f.read()

if 'sendDebugLog' in c4:
    print("INFO: sendDebugLog 既に存在")
else:
    # 現在の setMapHeading を正確に取得
    idx_start = c4.find('export const setMapHeading')
    idx_end = c4.find('\nexport const ', idx_start + 1)
    if idx_start < 0:
        print("ERROR: setMapHeading 見つからず")
        sys.exit(1)
    
    old_fn = c4[idx_start:idx_end]
    
    new_fn = (
        "// 🐛 フロントエンドデバッグログ送信\n"
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
        "let _lastDebugSentAt = 0;\n\n"
        "export const setMapHeading = (heading: number) => {\n"
        "  if (heading === null || heading === undefined || isNaN(heading)) return;\n"
        "  updateMarkerHeading(heading);\n"
        "  if (!globalMapInstance) {\n"
        "    const now = Date.now();\n"
        "    if (now - _lastDebugSentAt > 5000) {\n"
        "      _lastDebugSentAt = now;\n"
        "      sendDebugLog('setMapHeading: globalMapInstance=null', { heading });\n"
        "    }\n"
        "    return;\n"
        "  }\n"
        "  const renderingType = globalMapInstance.getRenderingType?.();\n"
        "  const VECTOR = (window as any).google?.maps?.RenderingType?.VECTOR;\n"
        "  const hasSetHeading = typeof globalMapInstance.setHeading === 'function';\n"
        "  if (hasSetHeading) {\n"
        "    try {\n"
        "      globalMapInstance.setHeading(heading);\n"
        "      const now = Date.now();\n"
        "      if (now - _lastDebugSentAt > 5000) {\n"
        "        _lastDebugSentAt = now;\n"
        "        sendDebugLog('setMapHeading: OK', {\n"
        "          heading: Math.round(heading),\n"
        "          renderingType: String(renderingType),\n"
        "          isVector: VECTOR ? renderingType === VECTOR : 'NO_VECTOR_API',\n"
        "        });\n"
        "      }\n"
        "    } catch (e) {\n"
        "      sendDebugLog('setMapHeading: ERROR', { heading, error: String(e).substring(0, 100) });\n"
        "      console.warn('⚠️ setHeading:', String(e).substring(0, 80));\n"
        "    }\n"
        "  } else {\n"
        "    const now = Date.now();\n"
        "    if (now - _lastDebugSentAt > 5000) {\n"
        "      _lastDebugSentAt = now;\n"
        "      sendDebugLog('setMapHeading: NO_FUNCTION', {\n"
        "        heading, renderingType: String(renderingType)\n"
        "      });\n"
        "    }\n"
        "  }\n"
        "}"
    )
    
    c4 = c4[:idx_start] + new_fn + c4[idx_end:]
    with open(f4, 'w') as f:
        f.write(c4)
    print("✅ GoogleMapWrapper.tsx: sendDebugLog + setMapHeading書き換え完了")

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
r = subprocess.run(["git","commit","-m",
    "fix: handleBreakEnd previousPhase+連打防止; LogViewer JST; mobile debug log API; MapWrapper debugLog"],
    cwd=BASE,capture_output=True,text=True)
print("Commit:",r.stdout.strip())
rp = subprocess.run(["git","push","origin","main"],cwd=BASE,capture_output=True,text=True)
print("Push STDERR:",rp.stderr.strip())
print("Push RC:",rp.returncode)
