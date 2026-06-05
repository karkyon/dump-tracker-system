#!/usr/bin/env python3
"""
地点登録 CREATE_LOCATION_ERROR 根本修正スクリプト
実行場所: omega-dev (karkyon@omega-dev)
実行方法: python3 /tmp/fix_location_create_error.py

修正内容:
  1. LocationModel.ts create() catchブロック
     → P2002ユニーク制約違反をConflictErrorに変換、全Prismaエラーの詳細を保持
  2. mobileController.ts quickAddLocation
     → tryCreate()が例外throwしてもキャッチしてリトライ
  3. CMS masterStore.ts createLocation
     → APIレスポンスの詳細メッセージをそのまま表示
"""

import subprocess, sys, os

BASE = "/home/karkyon/projects/dump-tracker"

errors = []
modified_files = []

# ======================================================
# 修正1: LocationModel.ts の create() catchブロック
# ======================================================
file1 = f"{BASE}/backend/src/models/LocationModel.ts"
with open(file1, 'r') as f:
    c1 = f.read()

old1 = '''    } catch (error) {
      logger.error('Failed to create location', { error: error as any, data });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new AppError('位置情報の作成に失敗しました', 500);
    }
  }'''

new1 = '''    } catch (error) {
      logger.error('Failed to create location', { error: error as any, data });

      // すでにアプリエラーとして処理済みの場合はそのままスロー
      if (error instanceof ValidationError || error instanceof ConflictError || error instanceof AppError) {
        throw error;
      }

      // Prismaエラーの詳細を解析して適切なエラーに変換
      const errMsg = (error as any)?.message || String(error);
      const errCode = (error as any)?.code || '';

      if (errCode === 'P2002' || errMsg.includes('P2002') || errMsg.includes('Unique constraint') || errMsg.includes('unique constraint')) {
        // P2002: ユニーク制約違反 (name カラム)
        const targetFields = (error as any)?.meta?.target;
        const fieldInfo = Array.isArray(targetFields) ? targetFields.join(', ') : 'name';
        throw new ConflictError(
          `場所名「${data.name}」は既に登録されています（${fieldInfo}の重複）。別の名称を使用してください。`
        );
      }

      if (errCode === 'P2003' || errMsg.includes('P2003') || errMsg.includes('Foreign key constraint')) {
        throw new AppError(`位置情報の作成に失敗しました（関連データエラー）: ${errMsg.substring(0, 150)}`, 400);
      }

      if (errCode?.startsWith('P') || errMsg.toLowerCase().includes('prisma')) {
        throw new AppError(`位置情報の作成に失敗しました（DBエラー: ${errCode || 'unknown'}）: ${errMsg.substring(0, 150)}`, 500);
      }

      throw new AppError(`位置情報の作成に失敗しました: ${errMsg.substring(0, 150)}`, 500);
    }
  }'''

if old1 not in c1:
    errors.append("ERROR: LocationModel.ts create() catch箇所が見つかりません")
    idx = c1.find("Failed to create location")
    if idx >= 0:
        print(f"INFO周辺: {repr(c1[idx:idx+300])}")
else:
    c1 = c1.replace(old1, new1)
    with open(file1, 'w') as f:
        f.write(c1)
    modified_files.append(file1)
    print("✅ LocationModel.ts create() catchブロック修正完了")

# ======================================================
# 修正2: mobileController.ts quickAddLocation
# ======================================================
file2 = f"{BASE}/backend/src/controllers/mobileController.ts"
with open(file2, 'r') as f:
    c2 = f.read()

old2 = """      logger.info('クイック位置登録開始', { baseName, body: req.body });

      let result = await tryCreate(baseName);

      // 失敗時: P2002(unique constraint)ならタイムスタンプ付きでリトライ
      if (!result.success) {
        const errMsg = result.message || '';
        if (errMsg.includes('P2002') || errMsg.includes('unique') || errMsg.includes('Unique') || errMsg.includes('失敗')) {
          const altName = `${baseName}-${Date.now()}`;
          logger.info('名前重複のためリトライ', { baseName, altName });
          result = await tryCreate(altName);
        }
      }

      if (!result.success || !result.data) {
        logger.error('クイック位置登録失敗', { result, body: req.body });
        sendError(res, result.message || '位置情報の作成に失敗しました', 500, 'LOCATION_CREATE_ERROR');
        return;
      }"""

new2 = """      logger.info('クイック位置登録開始', { baseName, body: req.body });

      let result;
      try {
        result = await tryCreate(baseName);
      } catch (createErr: any) {
        const ceMsg = createErr?.message || String(createErr);
        const ceCode = createErr?.code || '';
        // P2002(ユニーク制約違反) または ConflictError → タイムスタンプ付きでリトライ
        if (
          ceCode === 'P2002' ||
          ceMsg.includes('P2002') ||
          ceMsg.includes('Unique constraint') ||
          ceMsg.includes('unique constraint') ||
          ceMsg.includes('既に登録されています') ||
          createErr?.statusCode === 409
        ) {
          const altName = `${baseName}-${Date.now()}`;
          logger.info('名前重複のためリトライ（例外キャッチ）', { baseName, altName, ceMsg });
          try {
            result = await tryCreate(altName);
          } catch (retryErr: any) {
            const retryMsg = retryErr?.message || String(retryErr);
            logger.error('クイック位置登録リトライも失敗', { retryErr });
            sendError(res, `位置の登録に失敗しました: ${retryMsg.substring(0, 100)}`, 500, 'LOCATION_CREATE_ERROR');
            return;
          }
        } else {
          logger.error('クイック位置登録例外（非重複）', { createErr, body: req.body });
          sendError(res, `位置の登録に失敗しました: ${ceMsg.substring(0, 100)}`, 500, 'LOCATION_CREATE_ERROR');
          return;
        }
      }

      if (!result || !result.success || !result.data) {
        logger.error('クイック位置登録失敗', { result, body: req.body });
        sendError(res, result?.message || '位置情報の作成に失敗しました', 500, 'LOCATION_CREATE_ERROR');
        return;
      }"""

if old2 not in c2:
    errors.append("ERROR: mobileController.ts quickAddLocation箇所が見つかりません")
    idx = c2.find('クイック位置登録開始')
    if idx >= 0:
        print(f"INFO周辺: {repr(c2[idx:idx+600])}")
else:
    c2 = c2.replace(old2, new2)
    with open(file2, 'w') as f:
        f.write(c2)
    modified_files.append(file2)
    print("✅ mobileController.ts quickAddLocation 修正完了")

# ======================================================
# 修正3: CMS masterStore.ts createLocation エラーメッセージ改善
# ======================================================
file3 = f"{BASE}/frontend/cms/src/store/masterStore.ts"
with open(file3, 'r') as f:
    c3 = f.read()

old3 = """          locationError: response.error || '場所の作成に失敗しました',
          locationLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[masterStore] createLocation エラー:', error);
      set({
        locationError: 'ネットワークエラーが発生しました',
        locationLoading: false,
      });
      return false;
    }
  },"""

new3 = """          locationError: response.message || response.error || '場所の作成に失敗しました',
          locationLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[masterStore] createLocation エラー:', error);
      const networkErrMsg = (error as any)?.response?.data?.message || (error as any)?.message || 'ネットワークエラーが発生しました';
      set({
        locationError: networkErrMsg,
        locationLoading: false,
      });
      return false;
    }
  },"""

if old3 not in c3:
    print("WARNING: masterStore.ts createLocation エラーハンドリング箇所が見つかりません（スキップ）")
    idx = c3.find("locationError: response.error")
    if idx >= 0:
        print(f"INFO周辺: {repr(c3[max(0,idx-50):idx+200])}")
else:
    c3 = c3.replace(old3, new3)
    with open(file3, 'w') as f:
        f.write(c3)
    modified_files.append(file3)
    print("✅ masterStore.ts createLocation エラーメッセージ改善完了")

# ======================================================
# 修正4: Mobile operationStore / LoadingInput の
# エラーメッセージ改善（LOCATION_CREATE_ERROR → APIメッセージ）
# ======================================================
mobile_files_to_check = [
    f"{BASE}/frontend/mobile/src/store/operationStore.ts",
    f"{BASE}/frontend/mobile/src/pages/LoadingInput.tsx",
]
for fp in mobile_files_to_check:
    if not os.path.exists(fp):
        continue
    with open(fp, 'r') as f:
        cf = f.read()
    # LOCATION_CREATE_ERROR のエラーメッセージをAPIレスポンスから取得するよう改善
    # axiosエラーの場合 error.response.data.message を参照
    old_err = "'処理に失敗しました（エラー: LOCATION_CREATE_ERROR）。管理者に連絡してください'"
    new_err = "(error as any)?.response?.data?.message || '位置の登録に失敗しました。管理者に連絡してください'"
    if old_err in cf:
        cf = cf.replace(old_err, new_err)
        with open(fp, 'w') as f:
            f.write(cf)
        modified_files.append(fp)
        print(f"✅ {os.path.basename(fp)} エラーメッセージ改善完了")
    
    # CREATE_LOCATION_ERROR パターン
    old_err2 = "LOCATION_CREATE_ERROR）。管理者に連絡してください"
    if old_err2 in cf:
        print(f"INFO: {os.path.basename(fp)} に他のLOCATION_CREATE_ERRORパターンあり（要確認）")

# ======================================================
# エラーチェック
# ======================================================
if errors:
    for e in errors:
        print(e)
    print("\n❌ 修正エラーあり - TSCをスキップしてpushしません")
    sys.exit(1)

print(f"\n修正ファイル: {len(modified_files)}")
for f in modified_files:
    print(f"  - {f}")

# ======================================================
# TSCコンパイルチェック (backend)
# ======================================================
print("\n=== TSC backend ===")
rb = subprocess.run(
    ["./node_modules/.bin/tsc", "--noEmit"],
    cwd=f"{BASE}/backend",
    capture_output=True, text=True
)
print("RC:", rb.returncode)
if rb.stdout: print("STDOUT:", rb.stdout[:3000])
if rb.stderr: print("STDERR:", rb.stderr[:1000])

# ======================================================
# TSCコンパイルチェック (CMS)
# ======================================================
print("\n=== TSC CMS ===")
rc_cms = subprocess.run(
    ["./node_modules/.bin/tsc", "--noEmit"],
    cwd=f"{BASE}/frontend/cms",
    capture_output=True, text=True
)
print("RC:", rc_cms.returncode)
if rc_cms.stdout: print("STDOUT:", rc_cms.stdout[:3000])
if rc_cms.stderr: print("STDERR:", rc_cms.stderr[:1000])

# ======================================================
# TSCコンパイルチェック (mobile)
# ======================================================
print("\n=== TSC mobile ===")
rc_mob = subprocess.run(
    ["./node_modules/.bin/tsc", "--noEmit"],
    cwd=f"{BASE}/frontend/mobile",
    capture_output=True, text=True
)
print("RC:", rc_mob.returncode)
if rc_mob.stdout: print("STDOUT:", rc_mob.stdout[:3000])
if rc_mob.stderr: print("STDERR:", rc_mob.stderr[:1000])

# ======================================================
# 全RC=0の場合のみ git commit & push
# ======================================================
if rb.returncode != 0 or rc_cms.returncode != 0 or rc_mob.returncode != 0:
    print("\n❌ TSCエラーあり - pushしません")
    sys.exit(1)

print("\n✅ TSC全パッケージエラー0 - git commit & push実行")
subprocess.run(["git", "add", "-A"], cwd=BASE)
r_commit = subprocess.run(
    ["git", "commit", "-m",
     "fix: LocationModel.ts P2002→ConflictError変換; mobileController quickAddLocation例外キャッチ改善; CMSエラーメッセージ詳細化"],
    cwd=BASE, capture_output=True, text=True
)
print("Commit:", r_commit.stdout.strip(), r_commit.stderr.strip())

r_push = subprocess.run(
    ["git", "push", "origin", "main"],
    cwd=BASE, capture_output=True, text=True
)
print("Push STDOUT:", r_push.stdout.strip())
print("Push STDERR:", r_push.stderr.strip())
print("Push RC:", r_push.returncode)

if r_push.returncode == 0:
    print("\n✅ GitHub push完了")
else:
    print("\n❌ push失敗")
    sys.exit(1)
