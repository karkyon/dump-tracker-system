#!/usr/bin/env python3
"""
DevDataCleanup.tsx fetchMasterRows に詳細デバッグログを追加
→ コンソールで実際のAPIレスポンス構造を確認してから修正する
"""
import os, subprocess

ROOT = os.path.expanduser('~/projects/dump-tracker')

def patch(path, old, new, label):
    full = os.path.join(ROOT, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'  ❌ [{label}] パターン未発見')
        # 周辺コードを表示
        for i, line in enumerate(content.splitlines(), 1):
            if 'テーブルごとに明示' in line or 'fetch直呼び' in line or 'vehicles' in line and 'arr' in line:
                print(f'    L{i}: {line.rstrip()}')
        return False
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'  ✅ [{label}]')
    return True

print('\n[1] DevDataCleanup.tsx - fetchMasterRows にデバッグログ追加')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''      const res = await fetch(`${API}${url}`, { headers: headers() });
      const json = await res.json();''',
    '''      const res = await fetch(`${API}${url}`, { headers: headers() });
      const json = await res.json();

      // ===== デバッグログ =====
      console.group(`[DevCleanup] fetchMasterRows table=${table}`);
      console.log('URL:', `${API}${url}`);
      console.log('HTTP status:', res.status);
      console.log('json (全体):', JSON.stringify(json, null, 2));
      console.log('json.success:', json?.success);
      console.log('json.data:', json?.data);
      console.log('json.data type:', typeof json?.data);
      console.log('Array.isArray(json.data):', Array.isArray(json?.data));
      if (json?.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
        console.log('json.data keys:', Object.keys(json.data));
        Object.keys(json.data).forEach(k => {
          console.log(`  json.data.${k}:`, json.data[k], '| isArray:', Array.isArray(json.data[k]));
        });
      }
      console.groupEnd();
      // ===== デバッグログここまで =====''',
    'デバッグログ追加'
)

print('\n[TypeScript コンパイルチェック - CMS]')
r = subprocess.run(
    'cd ~/projects/dump-tracker/frontend/cms && npx tsc --noEmit 2>&1',
    shell=True, capture_output=True, text=True
)
errors = [l for l in (r.stdout+r.stderr).splitlines() if 'error TS' in l]
if errors:
    print('❌ TSエラー:')
    for e in errors: print(' ', e)
    exit(1)
print('✅ TypeScript: エラー 0件')

print('\n[Git commit & push...]')
subprocess.run(
    'cd ~/projects/dump-tracker && git add -A && '
    'git commit -m "debug: DevDataCleanup fetchMasterRows に詳細ログ追加" && '
    'git push origin main',
    shell=True
)

print('''
✅ push完了！

【次の手順】
1. ブラウザで https://10.1.119.244:3001/dev/data-cleanup を開く
2. F12 → Console タブ
3. 「マスタ整理へ」ボタンを押す
4. 「ユーザー(DRIVER)」タブをクリック
5. Console に [DevCleanup] fetchMasterRows table=users のグループが出る
6. その中の全内容をコピーしてここに貼り付けてください

同様に「点検項目マスタ」タブもクリックしてログを取ってください。
''')
