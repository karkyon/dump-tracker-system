import * as authController from "../../src/controllers/authController";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// 環境変数の設定（テスト用）
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-development-only';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key';

// テスト用データ格納変数
interface TestData {
  testUser: any;
  adminUser: any;
  managerUser: any;
  driverUser: any;
  tokens: {
    accessToken?: string;
    refreshToken?: string;
  };
}

let testData: TestData = {
  testUser: null,
  adminUser: null,
  managerUser: null,
  driverUser: null,
  tokens: {}
};

// モックレスポンスオブジェクトの作成
const createMockResponse = () => {
  const res = {
    statusCode: 200,
    jsonData: null as any,
    status: function(code: number) {
      this.statusCode = code;
      return this;
    },
    json: function(data: any) {
      this.jsonData = data;
      return this;
    }
  };
  return res as any;
};

// モックリクエストオブジェクトの作成
const createMockRequest = (body: any = {}, user?: any, ip?: string, headers: any = {}): Request => {
  return {
    body,
    user,
    ip: ip || '127.0.0.1',
    headers: {
      'User-Agent': 'TestAgent/1.0',
      ...headers
    },
    get: function(header: string) {
      if (header === 'User-Agent') return this.headers['User-Agent'];
      return this.headers[header];
    }
  } as unknown as Request;
};

async function createTestUsers() {
  console.log("=== テストユーザー作成 ===");
  
  try {
    // 管理者ユーザー作成
    const adminPassword = await bcrypt.hash("AdminPass123!", 10);
    testData.adminUser = await prisma.user.create({
      data: {
        username: "testadmin_auth",
        email: "testadmin_auth@example.com",
        passwordHash: adminPassword,
        name: "テスト管理者（認証）",
        role: "ADMIN",
        isActive: true
      }
    });
    console.log("✓ 管理者ユーザー作成完了:", testData.adminUser.username);

    // マネージャーユーザー作成
    const managerPassword = await bcrypt.hash("ManagerPass123!", 10);
    testData.managerUser = await prisma.user.create({
      data: {
        username: "testmanager_auth",
        email: "testmanager_auth@example.com",
        passwordHash: managerPassword,
        name: "テストマネージャー（認証）",
        role: "MANAGER",
        isActive: true
      }
    });
    console.log("✓ マネージャーユーザー作成完了:", testData.managerUser.username);

    // 運転手ユーザー作成
    const driverPassword = await bcrypt.hash("DriverPass123!", 10);
    testData.driverUser = await prisma.user.create({
      data: {
        username: "testdriver_auth",
        email: "testdriver_auth@example.com",
        passwordHash: driverPassword,
        name: "テスト運転手（認証）",
        role: "DRIVER",
        isActive: true
      }
    });
    console.log("✓ 運転手ユーザー作成完了:", testData.driverUser.username);

    // 非アクティブユーザー作成
    const inactivePassword = await bcrypt.hash("InactivePass123!", 10);
    testData.testUser = await prisma.user.create({
      data: {
        username: "testinactive_auth",
        email: "testinactive_auth@example.com",
        passwordHash: inactivePassword,
        name: "テスト非アクティブユーザー（認証）",
        role: "DRIVER",
        isActive: false
      }
    });
    console.log("✓ 非アクティブユーザー作成完了:", testData.testUser.username);
    console.log("");

  } catch (error) {
    console.error("ユーザー作成エラー:", error);
    throw error;
  }
}

async function cleanupTestData() {
  console.log("=== テストデータクリーンアップ ===");
  
  try {
    // テストユーザー削除
    await prisma.user.deleteMany({
      where: { 
        username: { contains: "_auth" }
      }
    });

    console.log("✓ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("クリーンアップエラー:", error);
  }
}

async function main() {
  console.log("=== AuthController テスト開始 ===\n");

  try {
    // テスト前クリーンアップ
    await cleanupTestData();

    // ========================================
    // テストデータ準備
    // ========================================
    await createTestUsers();

    // ========================================
    // 1. ログインテスト (login) - 成功ケース
    // ========================================
    console.log("1. ログインテスト (login) - 成功ケース");
    
    const req1 = createMockRequest({
      username: "testadmin_auth",
      password: "AdminPass123!"
    });
    const res1 = createMockResponse();

    await authController.login(req1, res1);
    
    console.log("レスポンスステータス:", res1.statusCode);
    console.log("レスポンスデータ:", {
      success: res1.jsonData?.success,
      message: res1.jsonData?.message,
      hasUser: !!res1.jsonData?.data?.user,
      hasAccessToken: !!res1.jsonData?.data?.accessToken,
      hasRefreshToken: !!res1.jsonData?.data?.refreshToken
    });
    
    if (res1.statusCode === 200 && res1.jsonData?.success) {
      console.log("✓ ログイン成功:", res1.jsonData.data.user.username);
      testData.tokens.accessToken = res1.jsonData.data.accessToken;
      testData.tokens.refreshToken = res1.jsonData.data.refreshToken;
    } else {
      console.log("✗ ログイン失敗:", res1.jsonData);
    }
    console.log("");

    // ========================================
    // 2. ログインテスト - メールアドレスでのログイン
    // ========================================
    console.log("2. ログインテスト - メールアドレスでのログイン");
    
    const req2 = createMockRequest({
      username: "testdriver_auth@example.com", // メールアドレスで指定
      password: "DriverPass123!"
    });
    const res2 = createMockResponse();

    await authController.login(req2, res2);
    
    if (res2.statusCode === 200 && res2.jsonData?.success) {
      console.log("✓ メールアドレスでのログイン成功");
    } else {
      console.log("✗ メールアドレスでのログイン失敗:", res2.jsonData);
    }
    console.log("");

    // ========================================
    // 3. 現在のユーザー情報取得テスト (getCurrentUser)
    // ========================================
    console.log("3. 現在のユーザー情報取得テスト (getCurrentUser)");
    
    const req3 = createMockRequest(
      {},
      { id: testData.adminUser.id } // 認証済みユーザー情報
    );
    const res3 = createMockResponse();

    await authController.getCurrentUser(req3 as any, res3);
    
    if (res3.statusCode === 200 && res3.jsonData?.success) {
      console.log("✓ ユーザー情報取得成功:", res3.jsonData.data.user.username);
    } else {
      console.log("✗ ユーザー情報取得失敗:", res3.jsonData);
    }
    console.log("");

    // ========================================
    // 4. ログアウトテスト (logout)
    // ========================================
    console.log("4. ログアウトテスト (logout)");
    
    const req4 = createMockRequest(
      { refreshToken: testData.tokens.refreshToken },
      { 
        id: testData.adminUser.id,
        username: testData.adminUser.username
      }
    );
    const res4 = createMockResponse();

    await authController.logout(req4 as any, res4);
    
    if (res4.statusCode === 200 && res4.jsonData?.success) {
      console.log("✓ ログアウト成功");
    } else {
      console.log("✗ ログアウト失敗:", res4.jsonData);
    }
    console.log("");

    // ========================================
    // 5. リフレッシュトークンテスト (refreshToken)
    // ========================================
    console.log("5. リフレッシュトークンテスト (refreshToken)");
    
    // 新しくログインしてトークンを取得
    const loginReq = createMockRequest({
      username: "testmanager_auth",
      password: "ManagerPass123!"
    });
    const loginRes = createMockResponse();
    await authController.login(loginReq, loginRes);
    
    if (loginRes.jsonData?.data?.refreshToken) {
      const req5 = createMockRequest({
        refreshToken: loginRes.jsonData.data.refreshToken
      });
      const res5 = createMockResponse();

      await authController.refreshToken(req5, res5);
      
      if (res5.statusCode === 200 && res5.jsonData?.success) {
        console.log("✓ トークンリフレッシュ成功");
      } else {
        console.log("✗ トークンリフレッシュ失敗:", res5.jsonData);
      }
    }
    console.log("");

    // ========================================
    // エラーケーステスト
    // ========================================
    console.log("=== エラーケーステスト ===");

    // 6. 認証情報不足エラー
    console.log("6. 認証情報不足エラー");
    const req6 = createMockRequest({
      username: "testadmin_auth"
      // passwordが不足
    });
    const res6 = createMockResponse();

    await authController.login(req6, res6);
    
    if (res6.statusCode === 400) {
      console.log("✓ 期待通り認証情報不足エラー:", res6.jsonData.message);
    } else {
      console.log("✗ 認証情報不足エラーが発生すべきでした");
    }
    console.log("");

    // 7. 無効なパスワードエラー
    console.log("7. 無効なパスワードエラー");
    const req7 = createMockRequest({
      username: "testdriver_auth",
      password: "WrongPassword123!"
    });
    const res7 = createMockResponse();

    await authController.login(req7, res7);
    
    if (res7.statusCode === 401) {
      console.log("✓ 期待通りパスワードエラー:", res7.jsonData.message);
    } else {
      console.log("✗ パスワードエラーが発生すべきでした");
    }
    console.log("");

    // 8. 存在しないユーザーエラー
    console.log("8. 存在しないユーザーエラー");
    const req8 = createMockRequest({
      username: "nonexistent_user",
      password: "SomePassword123!"
    });
    const res8 = createMockResponse();

    await authController.login(req8, res8);
    
    if (res8.statusCode === 401) {
      console.log("✓ 期待通りユーザー不在エラー:", res8.jsonData.message);
    } else {
      console.log("✗ ユーザー不在エラーが発生すべきでした");
    }
    console.log("");

    // 9. 非アクティブユーザーログイン試行
    console.log("9. 非アクティブユーザーログイン試行");
    const req9 = createMockRequest({
      username: "testinactive_auth",
      password: "InactivePass123!"
    });
    const res9 = createMockResponse();

    await authController.login(req9, res9);
    
    if (res9.statusCode === 401) {
      console.log("✓ 期待通り非アクティブユーザーエラー");
    } else {
      console.log("✗ 非アクティブユーザーエラーが発生すべきでした");
    }
    console.log("");

    // 10. 無効なリフレッシュトークンエラー
    console.log("10. 無効なリフレッシュトークンエラー");
    const req10 = createMockRequest({
      refreshToken: "invalid.refresh.token"
    });
    const res10 = createMockResponse();

    await authController.refreshToken(req10, res10);
    
    if (res10.statusCode === 401) {
      console.log("✓ 期待通り無効トークンエラー:", res10.jsonData.message);
    } else {
      console.log("✗ 無効トークンエラーが発生すべきでした");
    }
    console.log("");

    // 11. リフレッシュトークンなしエラー
    console.log("11. リフレッシュトークンなしエラー");
    const req11 = createMockRequest({});
    const res11 = createMockResponse();

    await authController.refreshToken(req11, res11);
    
    if (res11.statusCode === 401) {
      console.log("✓ 期待通りトークン不在エラー:", res11.jsonData.message);
    } else {
      console.log("✗ トークン不在エラーが発生すべきでした");
    }
    console.log("");

    // 12. 認証なしでのユーザー情報取得試行
    console.log("12. 認証なしでのユーザー情報取得試行");
    const req12 = createMockRequest({});
    const res12 = createMockResponse();

    await authController.getCurrentUser(req12 as any, res12);
    
    if (res12.statusCode === 404) {
      console.log("✓ 期待通り認証エラー:", res12.jsonData.message);
    } else {
      console.log("✗ 認証エラーが発生すべきでした");
    }
    console.log("");

    // 13. 削除済みユーザーでの情報取得
    console.log("13. 削除済みユーザーでの情報取得");
    
    // 一時的にユーザーを削除
    await prisma.user.delete({
      where: { id: testData.testUser.id }
    });
    
    const req13 = createMockRequest(
      {},
      { id: testData.testUser.id }
    );
    const res13 = createMockResponse();

    await authController.getCurrentUser(req13 as any, res13);
    
    if (res13.statusCode === 404) {
      console.log("✓ 期待通りユーザー不在エラー:", res13.jsonData.message);
    } else {
      console.log("✗ ユーザー不在エラーが発生すべきでした");
    }
    console.log("");

    // 14. 連続ログイン試行（パフォーマンステスト）
    console.log("14. 連続ログイン試行テスト");
    const startTime = Date.now();
    let successCount = 0;
    
    for (let i = 0; i < 5; i++) {
      const req = createMockRequest({
        username: "testadmin_auth",
        password: "AdminPass123!"
      });
      const res = createMockResponse();
      
      await authController.login(req, res);
      
      if (res.statusCode === 200 && res.jsonData?.success) {
        successCount++;
      }
    }
    
    const endTime = Date.now();
    console.log(`✓ 5回のログイン試行: ${successCount}/5 成功`);
    console.log(`  処理時間: ${endTime - startTime}ms`);
    console.log("");

    // 15. トークン有効期限テスト（シミュレーション）
    console.log("15. トークン有効期限テスト");
    
    // 期限切れトークンのシミュレーション（実際には有効期限を操作できないため、無効なトークンでテスト）
    const expiredToken = jwt.sign(
      { userId: testData.adminUser.id },
      'wrong-secret', // 異なるシークレットで署名
      { expiresIn: '1s' }
    );
    
    const req15 = createMockRequest({
      refreshToken: expiredToken
    });
    const res15 = createMockResponse();

    await authController.refreshToken(req15, res15);
    
    if (res15.statusCode === 401) {
      console.log("✓ 期待通り無効トークンエラー");
    } else {
      console.log("✗ 無効トークンエラーが発生すべきでした");
    }
    console.log("");

    console.log("=== すべての認証コントローラーテストが完了しました ===");

  } catch (error) {
    console.error("✗ テスト実行エラー:", error);
    
    if (error instanceof Error) {
      console.error("エラー名:", error.name);
      console.error("エラーメッセージ:", error.message);
      if (error.stack) {
        console.error("スタックトレース:", error.stack);
      }
    }
  } finally {
    // テストデータのクリーンアップ
    console.log("\n=== テストデータクリーンアップ ===");
    await cleanupTestData();
    console.log("\n=== テスト終了 ===");
    
    // Prisma の切断
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.warn("Prisma disconnect failed:", e);
    }

    // プロセス終了
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// スクリプト実行時のハンドリング
if (require.main === module) {
  main().catch(console.error);
}

export default main;