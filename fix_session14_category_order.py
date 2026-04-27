#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session 14:
  大区分（再生材/バージン材/廃棄物）の表示順をCMSで設定 → API保存 → mobileに反映

  設計:
  - CMS ItemManagement.tsx の上部に「品目大区分の表示順」セクションを追加
  - ↑↓ボタンで並べ替え → PUT /api/v1/settings/system に key=item_group_order, value=JSON で保存
  - mobile LoadingInput.tsx で GET /api/v1/settings/system を取得して groupOrder に反映
"""

import subprocess, sys, os

REPO = os.path.expanduser("~/dump-tracker")

def read(p):
    with open(p, encoding="utf-8") as f: return f.read()

def write(p, c):
    with open(p, "w", encoding="utf-8") as f: f.write(c)
    print(f"  ✅ Written: {p.replace(REPO+'/', '')}")

print("=" * 60)
print("Session 14: 大区分表示順 CMS設定 + Mobile反映")
print("=" * 60)

# =====================================================
# [1] CMS ItemManagement.tsx
#   品目一覧の上に「大区分表示順」セクション追加
#   ↑↓ボタン + 保存ボタン → PUT /settings/system
# =====================================================
print("\n[1] ItemManagement.tsx — 大区分表示順セクション追加")

p_im = f"{REPO}/frontend/cms/src/pages/ItemManagement.tsx"
c_im = read(p_im)

# ---- import に Save / ArrowUp / ArrowDown アイコン追加 ----
old_import = "import { Plus, ChevronUp, ChevronDown } from 'lucide-react';"
new_import  = "import { Plus, ChevronUp, ChevronDown, Save, GripVertical } from 'lucide-react';"
if old_import in c_im:
    c_im = c_im.replace(old_import, new_import, 1)
    print("  ✅ import アイコン追加")

# ---- API base URL 定数を追加（既存の import 直後）----
old_after_imports = "// =====================================\n// 定数定義\n// ====================================="
new_after_imports = (
    "// =====================================\n"
    "// API設定\n"
    "// =====================================\n"
    "\n"
    "const API_BASE = (() => {\n"
    "  try {\n"
    "    return (window as any).__API_BASE_URL__\n"
    "      || import.meta.env.VITE_API_BASE_URL\n"
    "      || 'https://dumptracker-s.ddns.net/api/v1';\n"
    "  } catch { return 'https://dumptracker-s.ddns.net/api/v1'; }\n"
    "})();\n"
    "\n"
    "function getAuthHeaders(): Record<string, string> {\n"
    "  const token = localStorage.getItem('auth_token');\n"
    "  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };\n"
    "}\n"
    "\n"
    "/** 大区分表示順をAPI経由で保存 (key=item_group_order) */\n"
    "async function saveGroupOrder(order: string[]): Promise<void> {\n"
    "  await fetch(`${API_BASE}/settings/system`, {\n"
    "    method: 'PUT',\n"
    "    headers: getAuthHeaders(),\n"
    "    body: JSON.stringify([{ key: 'item_group_order', value: JSON.stringify(order) }]),\n"
    "  });\n"
    "}\n"
    "\n"
    "/** 大区分表示順をAPI経由で取得 */\n"
    "async function fetchGroupOrder(): Promise<string[]> {\n"
    "  try {\n"
    "    const res = await fetch(`${API_BASE}/settings/system`, { headers: getAuthHeaders() });\n"
    "    if (!res.ok) return DEFAULT_GROUP_ORDER;\n"
    "    const json = await res.json();\n"
    "    const raw = json.data?.item_group_order;\n"
    "    if (!raw) return DEFAULT_GROUP_ORDER;\n"
    "    const parsed = JSON.parse(raw);\n"
    "    return Array.isArray(parsed) ? parsed : DEFAULT_GROUP_ORDER;\n"
    "  } catch { return DEFAULT_GROUP_ORDER; }\n"
    "}\n"
    "\n"
    "// =====================================\n"
    "// 定数定義\n"
    "// ====================================="
)
if old_after_imports in c_im:
    c_im = c_im.replace(old_after_imports, new_after_imports, 1)
    print("  ✅ API関数追加")

# ---- DEFAULT_GROUP_ORDER 定数を ITEM_TYPE_OPTIONS の前に追加 ----
old_const_items = (
    "/** 品目区分の選択肢とラベルマッピング（単一箇所で管理） */\n"
    "const ITEM_TYPE_OPTIONS"
)
new_const_items = (
    "/** 大区分のデフォルト表示順 */\n"
    "const DEFAULT_GROUP_ORDER = ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE'];\n"
    "\n"
    "/** 大区分ラベルマップ */\n"
    "const GROUP_LABEL_MAP: Record<string, string> = {\n"
    "  RECYCLED_MATERIAL: '再生材',\n"
    "  VIRGIN_MATERIAL: 'バージン材',\n"
    "  WASTE: '廃棄物',\n"
    "};\n"
    "\n"
    "/** 品目区分の選択肢とラベルマッピング（単一箇所で管理） */\n"
    "const ITEM_TYPE_OPTIONS"
)
if old_const_items in c_im:
    c_im = c_im.replace(old_const_items, new_const_items, 1)
    print("  ✅ DEFAULT_GROUP_ORDER 定数追加")

# ---- コンポーネント内に groupOrder state とhandler 追加 ----
# fetchItems の useEffect の後に追加する
old_after_fetch = (
    "  // 初回マウント時のみデータ取得\n"
    "  // zustand ストアのアクション関数は安定参照のため、空依存配列で問題なし\n"
    "  useEffect(() => {\n"
    "    fetchItems();\n"
    "  // eslint-disable-next-line react-hooks/exhaustive-deps\n"
    "  }, []);"
)
new_after_fetch = (
    "  // 初回マウント時のみデータ取得\n"
    "  // zustand ストアのアクション関数は安定参照のため、空依存配列で問題なし\n"
    "  useEffect(() => {\n"
    "    fetchItems();\n"
    "  // eslint-disable-next-line react-hooks/exhaustive-deps\n"
    "  }, []);\n"
    "\n"
    "  // =====================================\n"
    "  // 大区分表示順 state\n"
    "  // =====================================\n"
    "  const [groupOrder, setGroupOrder] = React.useState<string[]>(DEFAULT_GROUP_ORDER);\n"
    "  const [groupOrderSaving, setGroupOrderSaving] = React.useState(false);\n"
    "\n"
    "  // 初回: APIから大区分表示順を取得\n"
    "  React.useEffect(() => {\n"
    "    fetchGroupOrder().then(setGroupOrder);\n"
    "  }, []);\n"
    "\n"
    "  /** 大区分を上に移動 */\n"
    "  const handleGroupMoveUp = (idx: number) => {\n"
    "    if (idx === 0) return;\n"
    "    const next = [...groupOrder];\n"
    "    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];\n"
    "    setGroupOrder(next);\n"
    "  };\n"
    "\n"
    "  /** 大区分を下に移動 */\n"
    "  const handleGroupMoveDown = (idx: number) => {\n"
    "    if (idx === groupOrder.length - 1) return;\n"
    "    const next = [...groupOrder];\n"
    "    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];\n"
    "    setGroupOrder(next);\n"
    "  };\n"
    "\n"
    "  /** 大区分表示順を保存 */\n"
    "  const handleSaveGroupOrder = async () => {\n"
    "    setGroupOrderSaving(true);\n"
    "    try {\n"
    "      await saveGroupOrder(groupOrder);\n"
    "      toast.success('大区分の表示順を保存しました');\n"
    "    } catch {\n"
    "      toast.error('保存に失敗しました');\n"
    "    } finally {\n"
    "      setGroupOrderSaving(false);\n"
    "    }\n"
    "  };"
)
if old_after_fetch in c_im:
    c_im = c_im.replace(old_after_fetch, new_after_fetch, 1)
    print("  ✅ groupOrder state + handler 追加")

# ---- レンダリング: h1の直後に大区分表示順セクションを追加 ----
old_render_header = (
    "      <div className=\"flex justify-between items-center\">\n"
    "        <h1 className=\"text-2xl font-semibold text-gray-900\">品目管理</h1>\n"
    "        <Button onClick={handleAddItem}>\n"
    "          <Plus className=\"w-4 h-4 mr-2\" />\n"
    "          新規品目追加\n"
    "        </Button>\n"
    "      </div>"
)
new_render_header = (
    "      <div className=\"flex justify-between items-center\">\n"
    "        <h1 className=\"text-2xl font-semibold text-gray-900\">品目管理</h1>\n"
    "        <Button onClick={handleAddItem}>\n"
    "          <Plus className=\"w-4 h-4 mr-2\" />\n"
    "          新規品目追加\n"
    "        </Button>\n"
    "      </div>\n"
    "\n"
    "      {/* ===== 大区分表示順設定 ===== */}\n"
    "      <div className=\"bg-white shadow rounded-lg p-4\">\n"
    "        <div className=\"flex items-center justify-between mb-3\">\n"
    "          <div>\n"
    "            <h2 className=\"text-sm font-semibold text-gray-800 flex items-center gap-1\">\n"
    "              <GripVertical className=\"w-4 h-4 text-gray-400\" />\n"
    "              品目大区分の表示順（mobileアプリの品目選択画面に反映）\n"
    "            </h2>\n"
    "            <p className=\"text-xs text-gray-500 mt-0.5\">↑↓ボタンで並べ替えて「保存」を押してください</p>\n"
    "          </div>\n"
    "          <button\n"
    "            onClick={handleSaveGroupOrder}\n"
    "            disabled={groupOrderSaving}\n"
    "            className=\"flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed\"\n"
    "          >\n"
    "            <Save className=\"w-3.5 h-3.5\" />\n"
    "            {groupOrderSaving ? '保存中...' : '保存'}\n"
    "          </button>\n"
    "        </div>\n"
    "        <div className=\"flex gap-3\">\n"
    "          {groupOrder.map((key, idx) => (\n"
    "            <div\n"
    "              key={key}\n"
    "              className=\"flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[120px]\"\n"
    "            >\n"
    "              <span className=\"text-xs text-gray-400 font-bold w-4 text-center\">{idx + 1}</span>\n"
    "              <span className=\"flex-1 text-sm font-medium text-gray-700 text-center\">\n"
    "                {GROUP_LABEL_MAP[key] ?? key}\n"
    "              </span>\n"
    "              <div className=\"flex flex-col gap-0.5\">\n"
    "                <button\n"
    "                  onClick={() => handleGroupMoveUp(idx)}\n"
    "                  disabled={idx === 0}\n"
    "                  className=\"p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed\"\n"
    "                  title=\"上へ\"\n"
    "                >\n"
    "                  <ChevronUp className=\"w-3.5 h-3.5\" />\n"
    "                </button>\n"
    "                <button\n"
    "                  onClick={() => handleGroupMoveDown(idx)}\n"
    "                  disabled={idx === groupOrder.length - 1}\n"
    "                  className=\"p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed\"\n"
    "                  title=\"下へ\"\n"
    "                >\n"
    "                  <ChevronDown className=\"w-3.5 h-3.5\" />\n"
    "                </button>\n"
    "              </div>\n"
    "            </div>\n"
    "          ))}\n"
    "        </div>\n"
    "      </div>"
)
if old_render_header in c_im:
    c_im = c_im.replace(old_render_header, new_render_header, 1)
    print("  ✅ 大区分表示順セクション UI追加")
else:
    print("  ⚠️  レンダリングヘッダーパターン未発見")

write(p_im, c_im)

# =====================================================
# [2] mobile LoadingInput.tsx
#   groupOrder を ハードコード推定 から API取得に変更
# =====================================================
print("\n[2] LoadingInput.tsx — groupOrder を API取得に変更")

p_li = f"{REPO}/frontend/mobile/src/pages/LoadingInput.tsx"
c_li = read(p_li)

# API_BASE_URLを取得するコードを追加（先頭import群の後）
old_import_api = "import { useOperationStore } from '../stores/operationStore';"
new_import_api = (
    "import { useOperationStore } from '../stores/operationStore';\n"
    "\n"
    "/** システム設定APIから大区分表示順を取得 */\n"
    "async function fetchCategoryOrder(): Promise<('RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE' | undefined)[]> {\n"
    "  const DEFAULT: ('RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE' | undefined)[] =\n"
    "    ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE', undefined];\n"
    "  try {\n"
    "    const apiBase = (window as any).__API_BASE_URL__\n"
    "      || (import.meta as any).env?.VITE_API_BASE_URL\n"
    "      || 'https://dump-tracker.ddns.net/api/v1';\n"
    "    const token = localStorage.getItem('auth_token');\n"
    "    const res = await fetch(`${apiBase}/settings/system`, {\n"
    "      headers: token ? { Authorization: `Bearer ${token}` } : {},\n"
    "    });\n"
    "    if (!res.ok) return DEFAULT;\n"
    "    const json = await res.json();\n"
    "    const raw = json.data?.item_group_order;\n"
    "    if (!raw) return DEFAULT;\n"
    "    const order: string[] = JSON.parse(raw);\n"
    "    // WASTE の後ろに undefined(その他) を追加\n"
    "    const typed = order.filter(k =>\n"
    "      ['RECYCLED_MATERIAL','VIRGIN_MATERIAL','WASTE'].includes(k)\n"
    "    ) as ('RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE')[];\n"
    "    return [...typed, undefined];\n"
    "  } catch { return DEFAULT; }\n"
    "}"
)
if old_import_api in c_li and "fetchCategoryOrder" not in c_li:
    c_li = c_li.replace(old_import_api, new_import_api, 1)
    print("  ✅ fetchCategoryOrder 関数追加")

# groupOrder の初期化ロジックをAPI取得に変更
# 現在: items取得後にdisplayOrderから推定
# 変更: 初回マウント時に fetchCategoryOrder() を呼ぶ useEffect 追加
old_group_init = (
    "  // 大項目グループ順序（CMS品目管理のdisplayOrderを元に動的取得）\n"
    "  const [groupOrder, setGroupOrder] = useState<('RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE' | undefined)[]>(\n"
    "    ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE', undefined]\n"
    "  );"
)
new_group_init = (
    "  // 大項目グループ順序（CMSのシステム設定 item_group_order から取得）\n"
    "  const [groupOrder, setGroupOrder] = useState<('RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE' | undefined)[]>(\n"
    "    ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE', undefined]\n"
    "  );"
)
if old_group_init in c_li:
    c_li = c_li.replace(old_group_init, new_group_init, 1)
    print("  ✅ groupOrder コメント更新")

# fetchItems useEffect の後に fetchCategoryOrder useEffect を追加
old_fetch_items_eff = (
    "  useEffect(() => {\n"
    "    const fetchItems = async () => {\n"
    "      try {\n"
    "        setIsLoadingItems(true);\n"
    "        const response = await apiService.getItems();"
)
new_fetch_items_eff = (
    "  // API から大区分表示順を取得\n"
    "  useEffect(() => {\n"
    "    fetchCategoryOrder().then(setGroupOrder);\n"
    "  }, []);\n"
    "\n"
    "  useEffect(() => {\n"
    "    const fetchItems = async () => {\n"
    "      try {\n"
    "        setIsLoadingItems(true);\n"
    "        const response = await apiService.getItems();"
)
if old_fetch_items_eff in c_li and "fetchCategoryOrder().then(setGroupOrder)" not in c_li:
    c_li = c_li.replace(old_fetch_items_eff, new_fetch_items_eff, 1)
    print("  ✅ fetchCategoryOrder useEffect 追加")

# items 取得後の groupOrder 動的計算ロジックを削除（API取得に一本化）
old_calc_order = (
    "          // 大項目グループ順序を動的計算\n"
    "          const orderMap = new Map();\n"
    "          data.forEach((it) => {\n"
    "            const cur = orderMap.get(it.itemType) ?? 999;\n"
    "            if ((it.displayOrder ?? 999) < cur) orderMap.set(it.itemType, it.displayOrder ?? 999);\n"
    "          });\n"
    "          const typeKeys = ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE', undefined];\n"
    "          typeKeys.sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999));\n"
    "          setGroupOrder(typeKeys as any);"
)
# 前回スクリプトで追加した別パターンも考慮
old_calc_order2 = (
    "          // 大項目グループ順序を動的計算（各typeの最小displayOrderでソート）\n"
    "          const orderMap = new Map<string | undefined, number>();\n"
    "          data.forEach((it) => {\n"
    "            const cur = orderMap.get(it.itemType) ?? 999;\n"
    "            if ((it.displayOrder ?? 999) < cur) orderMap.set(it.itemType, it.displayOrder ?? 999);\n"
    "          });\n"
    "          const typeKeys: ('RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE' | undefined)[] =\n"
    "            ['RECYCLED_MATERIAL', 'VIRGIN_MATERIAL', 'WASTE', undefined];\n"
    "          typeKeys.sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999));\n"
    "          setGroupOrder(typeKeys);"
)

if old_calc_order in c_li:
    c_li = c_li.replace(old_calc_order, "          // groupOrder は fetchCategoryOrder() で取得済み", 1)
    print("  ✅ displayOrder推定ロジック削除（API取得に一本化）")
elif old_calc_order2 in c_li:
    c_li = c_li.replace(old_calc_order2, "          // groupOrder は fetchCategoryOrder() で取得済み", 1)
    print("  ✅ displayOrder推定ロジック削除（代替パターン）")
else:
    print("  ℹ️  displayOrder推定ロジック未発見（既に削除済みか）")

# setItems(data) 前後の data: Item[] 宣言も整理
old_data_decl = "          const data: Item[] = response.data;\n          setItems(data);"
new_data_decl = "          setItems(response.data);"
if old_data_decl in c_li:
    c_li = c_li.replace(old_data_decl, new_data_decl, 1)
    print("  ✅ data: Item[] 宣言削除（response.data直接利用）")

write(p_li, c_li)

# =====================================================
# コンパイルチェック + Push
# =====================================================
print("\n" + "=" * 60)
print("コンパイルチェック")
print("=" * 60)

all_ok = True
for name, cwd in [
    ("Backend", f"{REPO}/backend"),
    ("Mobile",  f"{REPO}/frontend/mobile"),
    ("CMS",     f"{REPO}/frontend/cms"),
]:
    r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=cwd, capture_output=True, text=True)
    ok = r.returncode == 0
    if not ok:
        all_ok = False
        print(f"  ❌ {name} TSC: エラーあり")
        for line in (r.stdout + r.stderr).strip().splitlines()[:12]:
            print(f"    {line}")
    else:
        print(f"  ✅ {name} TSC: 0エラー")

if all_ok:
    subprocess.run(["git", "add", "-A"], cwd=REPO)
    r = subprocess.run(
        ["git", "commit", "-m", "feat: item group order CMS setting via system_settings API (session14)"],
        cwd=REPO, capture_output=True, text=True
    )
    print(r.stdout.strip())
    r2 = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
    print("✅ Git Push 完了" if r2.returncode == 0 else f"❌ Push失敗: {r2.stderr}")
    print("▶️  dt-restart 不要（フロントのみ）")
else:
    print("\n❌ コンパイルエラーあり → Push中止")
    sys.exit(1)
