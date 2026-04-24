#!/usr/bin/env python3
"""
BUG-009 / BUG-008 / BUG-021 一括修正スクリプト
ログ解析で根本原因確定:
  BUG-009: allUsers.filter is not a function
           → /users レスポンスは {data:{users:[],pagination:{}}} 構造
             allUsers = usersData?.data ?? [] が {users:[],pagination:{}} になりfilterできない
  BUG-008: GPS Error: {} (GeolocationPositionError のcode/message未展開)
  BUG-021: モバイル401時 refresh試行なしで即ログイン画面遷移
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
        print(f"❌ [{label}] ターゲット未発見")
        print(f"   {repr(old[:100])}")
        sys.exit(1)
    write_file(path, content.replace(old, new, 1))
    print(f"✅ [{label}] 完了")

# ============================================================
# BUG-009: Dashboard.tsx — allUsers.filter is not a function 修正
# ============================================================
print("\n[1/3] BUG-009: Dashboard.tsx ユーザーデータ解析修正")
dash_path = f"{BASE}/frontend/cms/src/pages/Dashboard.tsx"

# 問題のコード:
# usersData = data.users or data or []
# allUsers = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
# → APIレスポンス: data = {success, data:{users:[],pagination:{}}}
# → apiClient.get().data = {success, data:{users:[], pagination:{}}} (axios wrapper)
# → (usersRes.value as any)?.data = {success, data:{users:[],pagination:{}}}
# → data.users = undefined → data = {success,data:{users:[]...}} → ?.data = {users:[],pagination:{}}
# → Array.isArray({users:[],pagination:{}}) = false → allUsers = {users:[],pagination:{}}?.data = undefined??[]
# 実際のレスポンス確認: apiClient.get().data.data.users が配列

apply_fix(dash_path,
        """        // ユーザー（稼働運転手数）
        let totalDrivers = 0;
        if (usersRes.status === 'fulfilled') {
          const usersData = (usersRes.value as any)?.data?.users ?? (usersRes.value as any)?.data ?? [];
          const allUsers = Array.isArray(usersData) ? usersData : (usersData?.data ?? []);
          totalDrivers = allUsers.filter((u: any) =>
            u.role === 'DRIVER' && (u.isActive !== false)
          ).length;
        }""",
        """        // ユーザー（稼働運転手数）
        // BUG-009修正: /users APIレスポンス構造に合わせてユーザー配列を正確に取得
        // apiClient ラッパー経由のレスポンス構造:
        //   usersRes.value.data = { success, data: { users: [...], pagination: {...} } }
        // → users配列は data.data.users にある
        let totalDrivers = 0;
        if (usersRes.status === 'fulfilled') {
          const raw = (usersRes.value as any)?.data;
          // パターン1: { data: { users: [...] } }  (二重ネスト)
          // パターン2: { users: [...] }             (一重ネスト)
          // パターン3: [...]                        (配列直接)
          const allUsers: any[] =
            Array.isArray(raw?.data?.users)  ? raw.data.users  :
            Array.isArray(raw?.data)         ? raw.data        :
            Array.isArray(raw?.users)        ? raw.users       :
            Array.isArray(raw)               ? raw             :
            [];
          console.log('[Dashboard] ユーザーデータ解析:', {
            rawType: typeof raw,
            hasDataUsers: Array.isArray(raw?.data?.users),
            hasDataArray: Array.isArray(raw?.data),
            hasUsers: Array.isArray(raw?.users),
            isArray: Array.isArray(raw),
            resolvedCount: allUsers.length
          });
          totalDrivers = allUsers.filter((u: any) =>
            u.role === 'DRIVER' && (u.isActive !== false)
          ).length;
        }""",
        "BUG-009 ユーザー解析修正")

# catchブロックも修正（エラー詳細展開）
apply_fix(dash_path,
        """      } catch (error) {
        console.error('ダッシュボードデータの取得に失敗しました:', error);
        setLoading(false);
      }""",
        """      } catch (error: any) {
        // BUG-009修正: error が {} になる問題を修正（各フィールドを明示展開）
        console.error('[ERROR] ダッシュボードデータの取得に失敗しました:', {
          message: error?.message,
          status:  error?.response?.status,
          data:    error?.response?.data,
          code:    error?.code,
        });
        setLoading(false);
      }""",
        "BUG-009 catchエラー詳細化")

print("✅ BUG-009 完了\n")

# ============================================================
# BUG-008: useGPS.ts — GPS Error {} → code/message 明示展開 + 精度警告
# ============================================================
print("[2/3] BUG-008: useGPS.ts GPS エラー詳細化 + 精度閾値警告")
gps_path = f"{BASE}/frontend/mobile/src/hooks/useGPS.ts"

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
        error.code === error.PERMISSION_DENIED    ? 'PERMISSION_DENIED'    :
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
      console.warn(`⚠️ GPS精度低下: accuracy=${currentAccuracy.toFixed(0)}m`);
      toast(`GPS精度が低い状態です（誤差 ${Math.round(currentAccuracy)}m）`, { icon: '⚠️', duration: 4000 });
    }""",
        "BUG-008 精度閾値警告")

print("✅ BUG-008 完了\n")

# ============================================================
# BUG-021: mobile/api.ts — 401 refreshToken試行 + operationStore保持
# ============================================================
print("[3/3] BUG-021: mobile/api.ts 401ハンドラ修正")
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
            const originalRequest = error.config;
            const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
            const storedRefreshToken = localStorage.getItem('refresh_token');

            if (!isRefreshRequest && storedRefreshToken) {
              try {
                console.warn('[API] 401検知 → refreshToken試行中...');
                const refreshResponse = await this.axiosInstance.post(
                  '/mobile/auth/refresh',
                  { refreshToken: storedRefreshToken }
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

            // refreshToken失敗 または なし → operationStoreを保持したままログイン画面へ
            // ※ operation-store(localStorage)はクリアしない。ログイン後に運行継続できるようにする。
            console.error('[API] 認証失敗 → ログイン画面へ (operationStore保持)');
            toast.error('セッションの有効期限が切れました。再ログインが必要です。', { duration: 5000 });
            this.clearToken();
            setTimeout(() => { window.location.href = '/login'; }, 1200);
          } else if (status === 403) {""",
        "BUG-021 401 refreshToken")

print("✅ BUG-021 完了\n")
print("=" * 50)
print("全修正適用完了！")
