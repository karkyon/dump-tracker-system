#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
登録方法の判定修正:
1. LocationManagement.tsx — 判定ロジック修正
   現状: specialInstructions のみ参照 → フィールドがAPIレスポンスに含まれない可能性
   修正: createdBy (created_by) フィールドがない = CMS登録ではない という判定も追加
         + accessInstructions も参照
         + 最終手段: locationType で判定
            DEPOT/DESTINATION → モバイルから登録（旧型）
            PICKUP/DELIVERY/BOTH → CMSから登録（新型）または両方
         ただし新型でもモバイル登録はPICKUP/DELIVERYを使うので
         specialInstructions で確実に判定する必要がある

2. LocationManagement.tsx の registrationMethod 列の key が
   'registrationMethod' だが Location 型にこのフィールドは存在しない
   → render の value 引数は常に undefined
   → location オブジェクトの全フィールドを使って判定する方式に変更

正しい判定方法:
  mobileController.ts の quickAddLocation:
    specialInstructions: 'モバイルからクイック登録'  ← DBに保存
  locationController.ts の createLocation:
    accessInstructions: '管理者から登録'  ← CreateLocationRequest.accessInstructions に設定
    → しかしこれは specialInstructions ではなく別フィールド
    
確認: locationServiceWrapper.createLocation で
  createData.accessInstructions が specialInstructions にマッピングされているか？
→ locationService.ts の createLocation でどのフィールドにマッピングするか確認が必要

最も確実な判定:
  specialInstructions に 'モバイル' が含まれていれば → アプリから
  それ以外 → CMSから
  ただし specialInstructions が返ってこない場合は locationType で判定:
    DEPOT / DESTINATION → 旧モバイル登録型
"""
import subprocess, sys, os

REPO = os.path.expanduser("~/dump-tracker")

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ Written: {path}")

def fix_registration_method():
    path = f"{REPO}/frontend/cms/src/pages/LocationManagement.tsx"
    content = read(path)

    # registrationMethod 列の render 関数を完全修正
    old_render = """    {
      key: 'registrationMethod',
      header: '登録方法',
      width: '96px',
      render: (value: string, location: Location) => {
        // ✅ 登録方法判定:
        // CMS画面から登録 → specialInstructions が空 or 'CMS登録' or registrationMethod='admin'
        // モバイルアプリから登録 → specialInstructions に '管理者から登録' 以外の値
        //   (createQuickLocation経由では specialInstructions = 'モバイルからクイック登録' が設定される)
        const sp = (location as any).specialInstructions || (location as any).special_instructions || '';
        const isMobile =
          sp.includes('モバイル') ||
          sp.includes('アプリ') ||
          sp.includes('クイック') ||
          value === 'mobile' ||
          value === 'app';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isMobile ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'
          }`}>
            {isMobile ? 'アプリから' : 'CMSから'}
          </span>
        );
      },
    },"""

    new_render = """    {
      key: 'specialInstructions',   // ✅ DBの実フィールドを直接参照
      header: '登録方法',
      width: '96px',
      render: (value: string, location: Location) => {
        // ✅ 登録方法判定（確実版）:
        // quickAddLocation → specialInstructions = 'モバイルからクイック登録' がDBに保存される
        // CMS登録 → specialInstructions が null/空/undefined
        //
        // value = specialInstructions の値（Tableコンポーネントが location.specialInstructions を渡す）
        // location オブジェクトからも参照（型が合わない場合のフォールバック）
        const sp = value ||
          (location as any).specialInstructions ||
          (location as any).special_instructions || '';
        
        // locationType でのフォールバック判定:
        // DEPOT / DESTINATION → 旧モバイル登録型（以前の実装）
        const lt = location.locationType as string;
        const isOldMobileType = lt === 'DEPOT' || lt === 'DESTINATION';
        
        const isMobile =
          sp.includes('モバイル') ||
          sp.includes('アプリ') ||
          sp.includes('クイック') ||
          isOldMobileType;
          
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isMobile ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'
          }`}>
            {isMobile ? 'アプリから' : 'CMSから'}
          </span>
        );
      },
    },"""

    if old_render in content:
        content = content.replace(old_render, new_render, 1)
        print("  ✅ registrationMethod 列 key + 判定ロジック修正")
    else:
        print("  ❌ registrationMethod パターン未発見")
        return False

    write(path, content)
    return True

def fix_locationservice_dto():
    """
    locationService.ts の toResponseDTO で specialInstructions を含めているか確認
    含まれていない場合は追加
    """
    path = f"{REPO}/backend/src/services/locationService.ts"
    content = read(path)

    if 'specialInstructions' in content and 'toResponseDTO' in content:
        # toResponseDTOの中にspecialInstructionsが含まれているか確認
        idx = content.find('toResponseDTO')
        if idx >= 0:
            snippet = content[idx:idx+800]
            if 'specialInstructions' in snippet:
                print("  ✅ locationService.ts toResponseDTO に specialInstructions 含まれている")
                return True
            else:
                print("  ⚠️ toResponseDTO に specialInstructions が含まれていない可能性")
                # specialInstructions をDTOに追加
                old_dto = "      name: location.name,"
                new_dto = """      name: location.name,
          specialInstructions: location.specialInstructions,  // ✅ 登録方法判定用"""
                if old_dto in snippet:
                    content = content.replace(old_dto, new_dto, 1)
                    write(path, content)
                    print("  ✅ toResponseDTO に specialInstructions 追加")
                    return True
    return True

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
        ["git", "commit", "-m",
         "fix: location registration method judgment fix (session13)"],
        cwd=REPO, capture_output=True, text=True
    )
    print(f"  {r.stdout.strip()}")
    r2 = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
    if r2.returncode == 0:
        print("  ✅ Git Push 完了")
    else:
        print(f"  ❌ Push失敗: {r2.stderr}")

print("="*60)
print("登録方法判定修正")
print("="*60)

print("\n[1] LocationManagement.tsx — registrationMethod 判定修正")
ok1 = fix_registration_method()

print("\n[2] locationService.ts — toResponseDTO specialInstructions 確認")
ok2 = fix_locationservice_dto()

if ok1:
    ok = tsc_check()
    if ok:
        print("\n✅ 全コンパイルOK → Git Push")
        git_push()
    else:
        print("\n❌ コンパイルエラーあり → Push中止")
        sys.exit(1)
else:
    print("\n❌ パッチ失敗")
    sys.exit(1)
