#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ドキュメントで実際のファイル内容を確認済み。
残骸は2ファイルとも同じパターン:

// ===================================== 
// OperationHistory コンポーネント      ← コンポーネント宣言コメント
// =====================================

[空行2行]

  const d = new Date(dateStr);          ← ここが残骸開始 (宣言なし)
  return d.toLocaleDateString(...);
  ...
};                                       ← エラー行 L60

  const d = new Date(dateStr);          ← 残骸2つ目
  ...
};                                       ← エラー行 L67

  const d = new Date(dateStr);          ← 残骸3つ目
  ...
};                                       ← エラー行 L75

const OperationHistory: React.FC = () => {   ← 本来のコンポーネント開始

この残骸ブロック3つを丸ごと削除する。
"""
import subprocess, sys, os, re

REPO = os.path.expanduser("~/dump-tracker")

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ Written: {path}")

def remove_orphan_blocks(content, comp_name):
    """
    // ===...=== コンポーネントコメント の直後から
    const CompName: React.FC の直前まで にある
    const宣言なしの関数本体ブロックを全削除する
    """
    # コンポーネントコメントブロックの終わり〜const CompName の間を特定
    # パターン: コメント行の後に 空白行、そして残骸
    
    # 「const CompName: React.FC」の直前にある孤立ブロックを削除
    # 孤立ブロック = "  const d = new Date" で始まり "};" で終わる塊
    
    # 正規表現: コンポーネント定義より前にある孤立ブロック群
    # (?s) = DOTALL
    
    pattern = re.compile(
        r'(\n// =+\n// ' + comp_name + r' コンポーネント\n// =+\n)'  # コメントブロック
        r'((?:\n|\s*const d = new Date[^\n]*\n.*?};\n)+?)'            # 残骸ブロック群
        r'(\nconst ' + comp_name + r': React\.FC)',                    # コンポーネント定義
        re.DOTALL
    )
    
    m = pattern.search(content)
    if m:
        # 残骸部分（group2）を空行2つに置換
        new_content = content[:m.start()] + m.group(1) + '\n\n' + m.group(3) + content[m.end():]
        print(f"  ✅ {comp_name}: 残骸ブロック削除成功")
        return new_content
    
    # パターンが見つからない場合: より単純な方法
    # "// コンポーネント\n// ===" の後から "const CompName" までを
    # 行単位で処理して、孤立した }; 行を削除
    
    lines = content.split('\n')
    
    # コンポーネント定義行を探す
    comp_line_idx = None
    for i, line in enumerate(lines):
        if re.match(r'^const ' + comp_name + r': React\.FC', line):
            comp_line_idx = i
            break
    
    if comp_line_idx is None:
        print(f"  ❌ {comp_name}: コンポーネント定義行が見つかりません")
        return content
    
    print(f"  📍 {comp_name}: コンポーネント定義は L{comp_line_idx+1}")
    
    # コンポーネント定義より前の行を確認
    before = lines[:comp_line_idx]
    after  = lines[comp_line_idx:]
    
    # before の末尾から、孤立した関数本体ブロックを削除
    # 孤立ブロックの特徴:
    #   - "  const d = new Date" で始まる行がある
    #   - 対応する "const xxx = " 宣言がない
    #   - "};" で終わる
    
    # before を後ろから走査して孤立ブロックを特定・削除
    cleaned = []
    i = len(before) - 1
    orphan_lines = set()
    
    while i >= 0:
        line = before[i]
        stripped = line.strip()
        
        # "};" の孤立行を検出
        if stripped == '};':
            # この }; から上方向に対応するブロック開始を探す
            # "  const d = new Date" が見つかれば孤立ブロック
            j = i - 1
            block_lines = [i]
            found_start = False
            found_const = False
            
            while j >= 0:
                prev = before[j].strip()
                block_lines.append(j)
                
                if prev.startswith('const d = new Date'):
                    found_start = True
                    break
                if prev.startswith('const ') and not prev.startswith('const d'):
                    found_const = True
                    break
                if prev.startswith('// ===') or prev.startswith('interface ') or prev.startswith('import '):
                    break
                j -= 1
            
            if found_start and not found_const:
                # 孤立ブロック確定
                for bl in block_lines:
                    orphan_lines.add(bl)
                print(f"  🗑️ 孤立ブロック削除: L{j+1}〜L{i+1}")
                i = j - 1
                continue
        
        i -= 1
    
    if orphan_lines:
        new_before = [line for idx, line in enumerate(before) if idx not in orphan_lines]
        # 末尾の余分な空行を整理
        while new_before and new_before[-1].strip() == '':
            new_before.pop()
        new_before.append('')  # 1行空行
        new_before.append('')  # 2行空行
        
        result = '\n'.join(new_before + after)
        print(f"  ✅ {comp_name}: {len(orphan_lines)} 行の孤立ブロック削除")
        return result
    else:
        print(f"  ⚠️ {comp_name}: 孤立ブロックが見つかりませんでした")
        # デバッグ: comp_line_idx の前10行を表示
        for idx in range(max(0, comp_line_idx-15), comp_line_idx):
            print(f"    L{idx+1}: {repr(lines[idx])}")
        return content

def tsc_check():
    print("\n" + "="*60)
    print("コンパイルチェック")
    print("="*60)
    all_ok = True
    for name, cwd in [
        ("Backend",  f"{REPO}/backend"),
        ("Mobile",   f"{REPO}/frontend/mobile"),
        ("CMS",      f"{REPO}/frontend/cms"),
    ]:
        r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=cwd, capture_output=True, text=True)
        ok = r.returncode == 0
        if not ok: all_ok = False
        mark = "✅" if ok else "❌"
        print(f"  {mark} {name} TSC: {'0エラー' if ok else 'エラーあり'}")
        if not ok:
            for line in (r.stdout + r.stderr).strip().splitlines()[:15]:
                print(f"    {line}")
    return all_ok

def git_push():
    subprocess.run(["git", "add", "-A"], cwd=REPO)
    r = subprocess.run(
        ["git", "commit", "-m", "fix: remove JST orphan blocks compile 0 errors (session13)"],
        cwd=REPO, capture_output=True, text=True
    )
    print(f"  {r.stdout.strip()}")
    r2 = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
    if r2.returncode == 0:
        print("  ✅ Git Push 完了")
    else:
        print(f"  ❌ Push失敗: {r2.stderr}")

print("="*60)
print("孤立ブロック完全削除")
print("="*60)

print("\n[1] OperationHistory.tsx")
path1 = f"{REPO}/frontend/mobile/src/pages/OperationHistory.tsx"
c1 = read(path1)
c1 = remove_orphan_blocks(c1, 'OperationHistory')
write(path1, c1)

print("\n[2] OperationHistoryDetail.tsx")
path2 = f"{REPO}/frontend/mobile/src/pages/OperationHistoryDetail.tsx"
c2 = read(path2)
c2 = remove_orphan_blocks(c2, 'OperationHistoryDetail')
write(path2, c2)

ok = tsc_check()
if ok:
    print("\n✅ 全コンパイルOK → Git Push")
    git_push()
else:
    # 修正後のファイルの問題箇所を表示
    for fname, path in [(path1, path1), (path2, path2)]:
        lines = read(path).split('\n')
        print(f"\n  {os.path.basename(fname)} L50-80:")
        for i, l in enumerate(lines[49:80], 50):
            print(f"    L{i}: {repr(l)}")
    sys.exit(1)
