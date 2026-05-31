#!/usr/bin/env python3
"""
devCleanupRoutes.ts 修正スクリプト
バグ: 車両削除時に gps_logs.vehicle_id FK制約違反 (gps_logs_vehicle_id_fkey)
原因:
  - bulk-delete: gps_logs を operation_id 経由でしか削除しておらず、
                 vehicle_id 直接FKのレコードが残る
  - single delete(1件): 同様に gps_logs WHERE vehicle_id = $1 が抜けている
修正: 両方のブロックに vehicle_id 直接削除を追加
"""
import sys

fpath = '/home/karkyon/projects/dump-tracker/backend/src/routes/devCleanupRoutes.ts'

with open(fpath, 'r') as f:
    content = f.read()

original = content
fixes = 0

# ============================================================
# Fix 1: bulk-delete の vehicles ブロック
# operations ループ後・operations本体削除前に vehicle_id 直接削除を追加
# ============================================================
OLD_BULK = (
    "      await tx.$executeRawUnsafe(`DELETE FROM operations WHERE vehicle_id = ANY($1::uuid[])`, ids);\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM maintenance_records WHERE vehicle_id = ANY($1::uuid[])`, ids);"
)
NEW_BULK = (
    "      // gps_logs は operation_id 経由で削除済みだが、vehicle_id 直接FK分も削除（gps_logs_vehicle_id_fkey 対策）\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM gps_logs WHERE vehicle_id = ANY($1::uuid[])`, ids);\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM operations WHERE vehicle_id = ANY($1::uuid[])`, ids);\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM maintenance_records WHERE vehicle_id = ANY($1::uuid[])`, ids);"
)

if OLD_BULK in content:
    content = content.replace(OLD_BULK, NEW_BULK, 1)
    fixes += 1
    print("✅ Fix 1 適用: bulk-delete vehicles に gps_logs vehicle_id 直接削除を追加")
else:
    print("⚠️  Fix 1: 対象文字列が見つかりません（既に修正済みか構造が異なります）")

# ============================================================
# Fix 2: single delete (DELETE /master/:table/:id) の vehicles ブロック
# operations ループ後・operations本体削除前に vehicle_id 直接削除を追加
# ============================================================
OLD_SINGLE = (
    "      await tx.$executeRawUnsafe(`DELETE FROM operations WHERE vehicle_id = $1::uuid`, id);\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM maintenance_records WHERE vehicle_id = $1::uuid`, id);"
)
NEW_SINGLE = (
    "      // gps_logs は operation_id 経由で削除済みだが、vehicle_id 直接FK分も削除（gps_logs_vehicle_id_fkey 対策）\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM gps_logs WHERE vehicle_id = $1::uuid`, id);\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM operations WHERE vehicle_id = $1::uuid`, id);\n"
    "      await tx.$executeRawUnsafe(`DELETE FROM maintenance_records WHERE vehicle_id = $1::uuid`, id);"
)

# 1件削除側は同一文字列が複数ある可能性があるので count 確認
count_single = content.count(OLD_SINGLE)
if count_single > 0:
    content = content.replace(OLD_SINGLE, NEW_SINGLE)  # 全箇所置換
    fixes += 1
    print(f"✅ Fix 2 適用: single-delete vehicles に gps_logs vehicle_id 直接削除を追加 ({count_single}箇所)")
else:
    print("⚠️  Fix 2: 対象文字列が見つかりません（既に修正済みか構造が異なります）")

# ============================================================
# 結果
# ============================================================
if fixes == 0:
    print("\n❌ 修正対象が見つかりませんでした。コードの構造を確認してください。")
    sys.exit(1)

if content == original:
    print("\n❌ 内容が変化しませんでした。")
    sys.exit(1)

with open(fpath, 'w') as f:
    f.write(content)

print(f"\n✅ 修正完了 ({fixes}箇所) → {fpath}")
print("次のステップ: cd ~/projects/dump-tracker && bash scripts/compile_and_push.sh")
