#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).parent / "frontend/cms/src/pages/ItemManagement.tsx"
text = path.read_text(encoding="utf-8")

OLD = "        const allItems = [...items];\n"
assert OLD in text, "対象テキストが見つかりません"
text = text.replace(OLD, "")
path.write_text(text, encoding="utf-8")
print("✅ 完了")
