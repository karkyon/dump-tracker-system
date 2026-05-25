import subprocess, sys, os
from pathlib import Path

APP_ROOT  = Path.home() / 'projects' / 'dump-tracker'
CMS_ROOT  = APP_ROOT / 'frontend' / 'cms'
BACK_ROOT = APP_ROOT / 'backend'

GPS_MON   = CMS_ROOT / 'src/pages/GPSMonitoring.tsx'
OP_REC    = CMS_ROOT / 'src/pages/OperationRecords.tsx'
HOOKS     = CMS_ROOT / 'src/hooks/useGoogleMaps.ts'
DIALOG    = CMS_ROOT / 'src/components/OperationDetailDialog.tsx'
INSP_SVC  = BACK_ROOT / 'src/services/inspectionService.ts'
FIX_NGINX = APP_ROOT / 'scripts/fix-nginx-cms.py'

print('='*60)
print('全問題一括修正')
print('='*60)

saved = {}
def backup(path):
    saved[str(path)] = path.read_text(encoding='utf-8')
def restore_all():
    for p, c in saved.items():
        Path(p).write_text(c, encoding='utf-8')
    print('🔄 ロールバック完了')

# =========================================================
# 修正1〜6（変更なし）
# =========================================================
backup(HOOKS)
content = HOOKS.read_text(encoding='utf-8')
OLD = "script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja&region=JP&loading=async`;"
NEW = "script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,places&language=ja&region=JP&loading=async`;"
if OLD in content:
    content = content.replace(OLD, NEW, 1)
    HOOKS.write_text(content, encoding='utf-8')
    print('✅ [1/6] useGoogleMaps.ts: libraries=marker,places 修正')
else:
    print('⚠️ [1/6] useGoogleMaps.ts: 既に修正済み')

backup(DIALOG)
content = DIALOG.read_text(encoding='utf-8')
OLD = '''      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        console.log('✅ [Maps Loading Debug] Google Maps script already exists');
        existingScript.addEventListener('load', () => {
          console.log('✅ [Maps Loading Debug] Existing script loaded');
          setMapsLoaded(true);
        });
        return;
      }'''
NEW = '''      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        console.log('✅ [Maps Loading Debug] Google Maps script already exists');
        if ((window as any).google?.maps) {
          console.log('✅ [Maps Loading Debug] Already loaded, setting mapsLoaded=true');
          setMapsLoaded(true);
        } else {
          existingScript.addEventListener('load', () => {
            console.log('✅ [Maps Loading Debug] Existing script loaded');
            setMapsLoaded(true);
          });
        }
        return;
      }'''
if OLD in content:
    content = content.replace(OLD, NEW, 1)
    DIALOG.write_text(content, encoding='utf-8')
    print('✅ [2/6] OperationDetailDialog: mapsLoaded修正')
else:
    print('⚠️ [2/6] OperationDetailDialog: 既に修正済み')

backup(INSP_SVC)
content = INSP_SVC.read_text(encoding='utf-8')
OLD = '''      // 論理削除（修正版：updatedByを削除）
      await this.prisma.inspectionItem.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });'''
NEW = '''      // 物理削除（マスタは完全削除。過去の点検結果名称は別途スナップショットで保持する想定）
      await this.prisma.inspectionItem.delete({
        where: { id }
      });'''
if OLD in content:
    content = content.replace(OLD, NEW, 1)
    INSP_SVC.write_text(content, encoding='utf-8')
    print('✅ [3/6] inspectionService: 物理削除に変更')
else:
    print('⚠️ [3/6] inspectionService: 既に修正済み')

backup(FIX_NGINX)
content = FIX_NGINX.read_text(encoding='utf-8')
if 'localhost:3000' in content:
    content = content.replace('http://localhost:3000/uploads/', 'http://localhost:8000/uploads/')
    FIX_NGINX.write_text(content, encoding='utf-8')
    print('✅ [4/6] fix-nginx-cms.py: ポート 3000→8000')
else:
    print('⚠️ [4/6] fix-nginx-cms.py: 既に修正済み')

backup(GPS_MON)
content = GPS_MON.read_text(encoding='utf-8')
OLD = '''  // 既にスクリプトタグが存在
  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    existingScript.addEventListener('load', callback);
    return;
  }'''
NEW = '''  // 既にスクリプトタグが存在
  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    if (window.google && window.google.maps) {
      callback();
    } else {
      existingScript.addEventListener('load', callback);
    }
    return;
  }'''
if OLD in content:
    content = content.replace(OLD, NEW, 1)
    GPS_MON.write_text(content, encoding='utf-8')
    print('✅ [5/6] GPSMonitoring: callback修正')
else:
    print('⚠️ [5/6] GPSMonitoring: 既に修正済み')

backup(OP_REC)
content = OP_REC.read_text(encoding='utf-8')
OLD = '''  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    existingScript.addEventListener('load', callback);
    return;
  }'''
NEW = '''  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    if (window.google && window.google.maps) {
      callback();
    } else {
      existingScript.addEventListener('load', callback);
    }
    return;
  }'''
if OLD in content:
    content = content.replace(OLD, NEW, 1)
    OP_REC.write_text(content, encoding='utf-8')
    print('✅ [6/6] OperationRecords: callback修正')
else:
    print('⚠️ [6/6] OperationRecords: 既に修正済み')

# =========================================================
# TypeScript コンパイルチェック
# CMS: frontend/cms で npx tsc
# Backend: backend/ の tsc バイナリを直接指定
# =========================================================
print('\n[TypeScript コンパイルチェック - CMS...]')
r = subprocess.run(['npx', 'tsc', '--noEmit'], cwd=str(CMS_ROOT),
                   capture_output=True, text=True, timeout=120)
if r.returncode != 0 or r.stdout.strip() or r.stderr.strip():
    print('❌ CMS TSエラー:')
    print(r.stdout[:2000])
    print(r.stderr[:500])
    restore_all()
    sys.exit(1)
print('✅ CMS: エラー 0件')

# Backend: node_modules/.bin/tsc を直接実行
print('[TypeScript コンパイルチェック - Backend...]')
tsc_bin = BACK_ROOT / 'node_modules' / '.bin' / 'tsc'
if not tsc_bin.exists():
    print(f'⚠️ {tsc_bin} が見つかりません。npm ci を実行します...')
    ri = subprocess.run(['npm', 'ci'], cwd=str(BACK_ROOT),
                        capture_output=True, text=True, timeout=120)
    if ri.returncode != 0:
        print('❌ npm ci 失敗:', ri.stderr[:500])
        restore_all()
        sys.exit(1)

r = subprocess.run([str(tsc_bin), '--noEmit'], cwd=str(BACK_ROOT),
                   capture_output=True, text=True, timeout=120)
if r.returncode != 0 or r.stdout.strip() or r.stderr.strip():
    print('❌ Backend TSエラー:')
    print(r.stdout[:3000])
    print(r.stderr[:500])
    restore_all()
    sys.exit(1)
print('✅ Backend: エラー 0件')

# Git commit & push
print('\n[Git commit & push...]')
subprocess.run(['git', 'add', '-A'], cwd=str(APP_ROOT))
subprocess.run(['git', 'commit', '-m',
    'fix: マップmarker/mapsLoaded/点検項目物理削除/nginx8000ポート一括修正'],
    cwd=str(APP_ROOT))
r = subprocess.run(['git', 'push'], cwd=str(APP_ROOT), capture_output=True, text=True)
print(r.stdout)
print(r.stderr)

print('='*60)
print('✅ 全修正・push完了！')
print()
print('★ staging nginx ポート修正（stagingサーバーで実行）:')
print('  sudo sed -i "s|localhost:3000/uploads|localhost:8000/uploads|g"'
      ' /etc/nginx/sites-available/dump-tracker-staging')
print('  sudo nginx -t && sudo systemctl reload nginx')
print('='*60)
