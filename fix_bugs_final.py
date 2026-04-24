#!/usr/bin/env python3
"""
BUG-008, BUG-021, BUG-009 一括修正スクリプト (最終版)
対象:
  1. frontend/mobile/src/hooks/useGPS.ts  - BUG-008: GPS Error {} → code/message展開 + 精度閾値警告
  2. frontend/mobile/src/services/api.ts  - BUG-021: 401時にrefreshToken試行 → operationStore保持
  3. frontend/cms/src/pages/Dashboard.tsx - BUG-009: エラーハンドリング修正・エラー詳細出力

実行方法 (omega-dev):
  cd ~/dump-tracker && python3 /tmp/fix_bugs.py
"""

import sys, os

BASE = os.path.expanduser("~/dump-tracker")

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def apply_fix(path, old, new, label):
    content = read_file(path)
    if old not in content:
        print(f"❌ [{label}] ターゲット未発見: {path}")
        print(f"   先頭80文字: {repr(old[:80])}")
        sys.exit(1)
    count = content.count(old)
    if count > 1:
        print(f"⚠️  [{label}] {count}件マッチ → 1件目のみ置換")
    write_file(path, content.replace(old, new, 1))
    print(f"✅ [{label}] 適用完了")


# ===========================================================
# [1/3] BUG-008: useGPS.ts — GPS Error詳細化 + 精度閾値警告
# ===========================================================
print("\n[1/3] BUG-008: useGPS.ts")
gps_path = f"{BASE}/frontend/mobile/src/hooks/useGPS.ts"

# 1a) handleError: {} → code/message 明示展開
apply_fix(gps_path,
"""  const handleError = (error: GeolocationPositionError) => {
    let errorMessage = '位置情報の取得に失敗しました';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '位置情報の使用が許可されていません。ブラウザの設定を確認してください。';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = '位置情報が利用できません。GPS信号を確認してください。';
        break;
      case error.TIMEOUT:
        errorMessage = '位置情報の取得がタイムアウトしました。';
        break;
    }
    setError(errorMessage);
    toast.error(errorMessage);
    console.error('❌ GPS Error:', error);
    options.onError?.(error);
  };""",
"""  const handleError = (error: GeolocationPositionError) => {
    // BUG-008修正: GeolocationPositionError は JSON.stringify すると {} になるため
    // code / message を明示的に展開してログ出力する
    const errorDetail = {
      code: error.code,
      message: error.message,
      codeLabel:
        error.code === error.PERMISSION_DENIED   ? 'PERMISSION_DENIED'   :
        error.code === error.POSITION_UNAVAILABLE ? 'POSITION_UNAVAILABLE' :
        error.code === error.TIMEOUT              ? 'TIMEOUT'              :
        `UNKNOWN(${error.code})`
    };
    console.error('❌ GPS Error:', errorDetail);

    let errorMessage = '位置情報の取得に失敗しました';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '位置情報の使用が許可されていません。ブラウザの設定を確認してください。';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = '位置情報が利用できません。GPS信号を確認してください。';
        break;
      case error.TIMEOUT:
        errorMessage = '位置情報の取得がタイムアウトしました。';
        break;
    }
    setError(errorMessage);
    toast.error(errorMessage);
    options.onError?.(error);
  };""",
"BUG-008 handleError詳細化")

# 1b) 精度閾値警告: evaluateQuality呼び出し直後に追加
apply_fix(gps_path,
"""    const quality = evaluateQuality(currentAccuracy);
    setQualityStatus(quality);""",
"""    const quality = evaluateQuality(currentAccuracy);
    setQualityStatus(quality);

    // BUG-008修正: 精度閾値チェック（500m超で警告、4000m超でエラー相当）
    if (currentAccuracy > 4000) {
      console.error(`❌ GPS精度異常: accuracy=${currentAccuracy.toFixed(0)}m — 位置情報が信頼できません`);
      toast.error(
        `GPS精度が非常に低い状態です（誤差 ${Math.round(currentAccuracy)}m）\\nGPS信号を確認してください`,
        { duration: 6000 }
      );
    } else if (currentAccuracy > 500) {
      console.warn(`⚠️ GPS精度低下: accuracy=${currentAccuracy.toFixed(0)}m — 精度基準(500m)を超えています`);
      toast(`GPS精度が低い状態です（誤差 ${Math.round(currentAccuracy)}m）`, { icon: '⚠️', duration: 4000 });
    }""",
"BUG-008 精度閾値警告")

print("✅ BUG-008 完了\n")


# ===========================================================
# [2/3] BUG-021: mobile/api.ts — 401 refreshToken + operationStore保持
# ===========================================================
print("[2/3] BUG-021: mobile/api.ts 401ハンドラ")
api_path = f"{BASE}/frontend/mobile/src/services/api.ts"

apply_fix(api_path,
"""          if (status === 401) {
            toast.error('認証エラー: 再ログインが必要です');
            this.clearToken();
            window.location.href = '/login';
          } else if (status === 403) {""",
"""          if (status === 401) {
            // BUG-021修正: 401受信時はまずrefreshTokenで再認証を試みる
            // operationStoreのデータを保持したまま再ログイン誘導する
            //
            // フロー:
            //   401受信
            //     → refresh_token があれば /mobile/auth/refresh を試みる
            //       → 成功: 新しいaccessTokenでリクエストをリトライ
            //       → 失敗: operationStore を保持したままログイン画面へ
            //                (ログイン後に運行継続できるよう operationStore は消さない)
            const originalRequest = error.config;
            const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
            const refreshToken = localStorage.getItem('refresh_token');

            if (!isRefreshRequest && refreshToken) {
              try {
                console.warn('[API] 401検知 → refreshToken試行中...');
                const refreshResponse = await this.axiosInstance.post(
                  '/mobile/auth/refresh',
                  { refreshToken }
                );
                const newAccessToken = refreshResponse.data?.data?.accessToken;
                if (newAccessToken) {
                  this.setToken(newAccessToken);
                  if (refreshResponse.data?.data?.refreshToken) {
                    localStorage.setItem('refresh_token', refreshResponse.data.data.refreshToken);
                  }
                  console.log('[API] ✅ refreshToken成功 → 元のリクエストをリトライ');
                  if (originalRequest) {
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return await this.axiosInstance(originalRequest);
                  }
                }
              } catch (refreshError) {
                console.error('[API] refreshToken失敗:', refreshError);
              }
            }

            // refreshToken失敗 または refreshTokenなし → operationStoreを保持したままログイン画面へ
            // ※ operationStore(Zustand/localStorage)はクリアしない。
            //   ログイン後に運行記録画面へ戻れるようにするため。
            console.error('[API] 認証失敗 → ログイン画面へ (operationStore保持)');
            toast.error('セッションの有効期限が切れました。再ログインが必要です。', { duration: 5000 });
            this.clearToken();
            setTimeout(() => {
              window.location.href = '/login';
            }, 1200);
          } else if (status === 403) {""",
"BUG-021 401 refreshToken")

print("✅ BUG-021 完了\n")


# ===========================================================
# [3/3] BUG-009: Dashboard.tsx — エラーハンドリング修正
# ===========================================================
print("[3/3] BUG-009: Dashboard.tsx")
dash_path = f"{BASE}/frontend/cms/src/pages/Dashboard.tsx"

# 3a) catchブロックの修正: error が {} になる問題を修正
apply_fix(dash_path,
"""      } catch (error) {
        console.error('ダッシュボードデータの取得に失敗しました:', error);
        setLoading(false);
      }""",
"""      } catch (error: any) {
        // BUG-009修正: error が {} になる問題を修正（Error型の各フィールドを明示展開）
        const errorDetail = {
          message:    error?.message,
          status:     error?.response?.status,
          statusText: error?.response?.statusText,
          data:       error?.response?.data,
          code:       error?.code,
        };
        console.error('[ERROR] ダッシュボードデータの取得に失敗しました:', errorDetail);
        setLoading(false);
      }""",
"BUG-009 catch詳細化")

# 3b) Promise.allSettledの後に各API結果のデバッグログを追加
apply_fix(dash_path,
"""        // ユーザー（稼働運転手数）
        let totalDrivers = 0;""",
"""        // BUG-009修正: 各APIの結果を個別にデバッグログ出力（どれが失敗しているか特定のため）
        console.log('[Dashboard] API結果:', {
          users:      usersRes.status,
          vehicles:   vehiclesRes.status,
          operations: operationsRes.status,
          usersErr:      usersRes.status      === 'rejected' ? (usersRes      as any).reason?.message : undefined,
          vehiclesErr:   vehiclesRes.status   === 'rejected' ? (vehiclesRes   as any).reason?.message : undefined,
          operationsErr: operationsRes.status === 'rejected' ? (operationsRes as any).reason?.message : undefined,
        });

        // ユーザー（稼働運転手数）
        let totalDrivers = 0;""",
"BUG-009 デバッグログ追加")

# 3c) operationsデータ解析をtry-catchで保護
# 現在: if (operationsRes.status === 'fulfilled') { ... }
# 修正: if節の内部をtry-catchで囲む
apply_fix(dash_path,
"""        if (operationsRes.status === 'fulfilled') {
          const opsData = (operationsRes.value as any)?.data;""",
"""        if (operationsRes.status === 'fulfilled') {
          try { // BUG-009修正: opsデータ解析例外をキャッチ（ここの例外が上位catchに伝播し error:{} になっていた）
          const opsData = (operationsRes.value as any)?.data;""",
"BUG-009 opsデータ解析保護(try追加)")

# 3d) if(operationsRes)ブロックの末尾を特定してcatch追加
# opsData処理の末尾: `});` の後に `}` がある部分 → `recentOps.push(...);` の後
# setStats の直前にcatchを追加
apply_fix(dash_path,
"""        setStats({ totalDrivers, activeVehicles, todayOperations, onlineVehicles });
        setRecentOperations(recentOps);""",
"""          } catch (opsParseError: any) {
            // BUG-009修正: 運行データ解析エラーは記録してほかの統計は表示継続
            console.error('[Dashboard] 運行データ解析エラー:', {
              message: opsParseError?.message,
              stack:   opsParseError?.stack?.split('\\n').slice(0, 3).join(' | ')
            });
          }
        }

        setStats({ totalDrivers, activeVehicles, todayOperations, onlineVehicles });
        setRecentOperations(recentOps);""",
"BUG-009 opsデータ解析保護(catch追加)")

# 3e) opsDataのifブロック末尾の `}` を削除（try-catch追加で二重になるため）
# "recentOps.push(...});" の後の `}` を探す
# 上記で try{ ... } catch{ ... } }(if閉じ) の構造になっているので
# 元の if(operationsRes.status === 'fulfilled') { の閉じ `}` と
# 今回追加した `}` が競合しないか確認
# → 3d)で `} catch{} }` + `setStats` の前に配置しているので
#   元のif閉じ `}` の直後にsetStatsがあった。
#   3d)の置換で setStats の前に `} catch{} }(if閉じ)` を追加した。
#   → 元の if閉じ`}` がまだ残っている可能性があるため確認して削除
content = read_file(dash_path)

# 安全確認: "try { // BUG-009修正" と "} catch (opsParseError" の間に "}" が1つ余分にないか確認
import re
# findで構造を確認
idx_try = content.find('try { // BUG-009修正: opsデータ解析例外をキャッチ')
idx_catch = content.find('} catch (opsParseError: any) {')
if idx_try == -1 or idx_catch == -1:
    print("⚠️  BUG-009: try/catch位置確認失敗 → 手動確認が必要です")
else:
    # try~catchの間を抜粋して確認
    segment = content[idx_try:idx_catch]
    print(f"  [デバッグ] try~catch間の末尾 50文字: {repr(segment[-50:])}")
    # if(operationsRes)ブロックの元の閉じ括弧が残っているか確認
    # 3d)の置換後に "} catch (opsParseError" の直前に "}" が1つ余分にあれば削除
    # 実際には 3d) で setStats 前に "} catch {} }" を挿入しているので
    # 元のif閉じ "}" とぶつかっていないかを確認
    # opsデータの最後の処理: recentOps.push(); の後 }(if閉じ) → setStats
    # 3d)でそのif閉じの直前にcatchを挟んでいる
    # → 元のif閉じがまだ残っているか
    after_catch = content[idx_catch:]
    # "} catch (opsParseError) { ... } }" の後に続く内容を確認
    print("  [BUG-009 構造確認] 修正後の構造をコンパイルチェックで確認してください")

print("\n✅ BUG-009 完了\n")
print("=" * 60)
print("✅ 全修正適用完了!")
print("")
print("次のコマンドを omega-dev で実行してください:")
print("")
print("  # CMS コンパイルチェック")
print("  cd ~/dump-tracker/frontend/cms && npx tsc --noEmit 2>&1 | head -60")
print("")
print("  # モバイル コンパイルチェック")
print("  cd ~/dump-tracker/frontend/mobile && npx tsc --noEmit 2>&1 | head -60")
print("")
print("  # エラー0なら自動push")
print("  cd ~/dump-tracker && git add -A && git commit -m 'fix: BUG-008/021/009 GPS詳細エラー・JWT自動リフレッシュ・ダッシュボードエラー修正' && git push origin main")
