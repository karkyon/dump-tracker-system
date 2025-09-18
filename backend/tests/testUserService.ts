import { userService } from "../src/services/userService";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// テストユーティリティ
const testUtils = {
  // ランダムなテストデータ生成
  generateTestUser: (suffix = '') => ({
    username: `testuser_${Date.now()}${suffix}`,
    email: `test_${Date.now()}${suffix}@example.com`,
    password: "password123",
    name: `テストユーザー${suffix}`,
    role: "DRIVER" as const,
  }),

  // テスト結果の検証
  assert: (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ ${message}`);
    } else {
      console.error(`❌ ${message}`);
      throw new Error(`アサーション失敗: ${message}`);
    }
  },

  // エラーテストのヘルパー
  expectError: async (fn: () => Promise<any>, expectedMessage?: string) => {
    try {
      await fn();
      throw new Error('エラーが期待されましたが発生しませんでした');
    } catch (error) {
      if (expectedMessage) {
        testUtils.assert(
          (error as Error).message.includes(expectedMessage),
          `期待されたエラーメッセージ: ${expectedMessage}`
        );
      }
      return error;
    }
  }
};

// テストデータクリーンアップ
async function cleanup() {
  console.log("🧹 テストデータクリーンアップ中...");
  try {
    // テスト用ユーザーを削除
    await prisma.user.deleteMany({
      where: {
        OR: [
          { username: { startsWith: 'testuser' } },
          { email: { contains: 'test' } }
        ]
      }
    });
    console.log("✅ クリーンアップ完了");
  } catch (error) {
    console.log("⚠️ クリーンアップ中にエラー:", error);
  }
}

// メインテスト関数
async function runComprehensiveUserServiceTest() {
  console.log("🚀 === UserService 包括的テスト開始 ===\n");

  let testUserId: string | null = null;
  let testUser2Id: string | null = null;

  try {
    // 前処理: クリーンアップ
    await cleanup();

    // ========================================
    // 1. ユーザー作成テスト（正常系）
    // ========================================
    console.log("📝 1. ユーザー作成テスト（正常系）");
    const testUserData = testUtils.generateTestUser('_create');
    const createdUser = await userService.createUser(testUserData);
    
    testUtils.assert(!!createdUser.id, "ユーザーIDが生成されている");
    testUtils.assert(createdUser.username === testUserData.username, "ユーザー名が正しい");
    testUtils.assert(createdUser.email === testUserData.email, "メールアドレスが正しい");
    testUtils.assert(createdUser.name === testUserData.name, "名前が正しい");
    testUtils.assert(createdUser.role === testUserData.role, "ロールが正しい");
    testUtils.assert(createdUser.isActive === true, "デフォルトでアクティブ");
    
    testUserId = createdUser.id;
    console.log("✅ ユーザー作成テスト完了\n");

    // ========================================
    // 2. ユーザー取得テスト（ID指定）
    // ========================================
    console.log("📝 2. ユーザー取得テスト（ID指定）");
    const fetchedUser = await userService.getUserById(testUserId);
    
    testUtils.assert(!!fetchedUser, "ユーザーが取得できる");
    testUtils.assert(fetchedUser.id === testUserId, "正しいユーザーIDが返る");
    testUtils.assert(fetchedUser.username === testUserData.username, "ユーザー名が一致");
    console.log("✅ ユーザー取得テスト完了\n");

    // ========================================
    // 3. ユーザー一覧取得テスト（ページネーション）
    // ========================================
    console.log("📝 3. ユーザー一覧取得テスト（ページネーション）");
    const usersList = await userService.getAllUsers({ 
      page: 1, 
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    
    testUtils.assert(Array.isArray(usersList.data), "データが配列で返る");
    testUtils.assert(usersList.data.length > 0, "ユーザーが存在する");
    testUtils.assert(!!usersList.pagination, "ページネーション情報が含まれる");
    testUtils.assert(usersList.pagination.currentPage === 1, "現在ページが正しい");
    testUtils.assert(usersList.pagination.itemsPerPage === 10, "ページサイズが正しい");
    
    // 作成したユーザーが一覧に含まれているか確認
    const foundUser = usersList.data.find(u => u.id === testUserId);
    testUtils.assert(!!foundUser, "作成したユーザーが一覧に含まれる");
    console.log("✅ ユーザー一覧取得テスト完了\n");

    // ========================================
    // 4. ユーザー更新テスト
    // ========================================
    console.log("📝 4. ユーザー更新テスト");
    const updateData = {
      name: "更新されたテストユーザー",
      employeeId: "EMP001",
      phone: "090-1234-5678"
    };
    
    const updatedUser = await userService.updateUser(testUserId, updateData);
    
    testUtils.assert(updatedUser.name === updateData.name, "名前が更新されている");
    testUtils.assert(updatedUser.employeeId === updateData.employeeId, "従業員IDが更新されている");
    testUtils.assert(updatedUser.phone === updateData.phone, "電話番号が更新されている");
    console.log("✅ ユーザー更新テスト完了\n");

    // ========================================
    // 5. ユーザー検索テスト
    // ========================================
    console.log("📝 5. ユーザー検索テスト");
    const searchResults = await userService.searchUsers("更新された", 5);
    
    testUtils.assert(Array.isArray(searchResults), "検索結果が配列で返る");
    const foundInSearch = searchResults.find(u => u.id === testUserId);
    testUtils.assert(!!foundInSearch, "更新されたユーザーが検索で見つかる");
    console.log("✅ ユーザー検索テスト完了\n");

    // ========================================
    // 6. ロール変更テスト
    // ========================================
    console.log("📝 6. ロール変更テスト");
    // 管理者ユーザーIDを模擬（実際のテストでは適切なIDを設定）
    const adminUserId = "system-admin-id";
    
    const roleChangedUser = await userService.changeUserRole(testUserId, "MANAGER", adminUserId);
    
    testUtils.assert(roleChangedUser.role === "MANAGER", "ロールが正しく変更されている");
    console.log("✅ ロール変更テスト完了\n");

    // ========================================
    // 7. エラーケーステスト
    // ========================================
    console.log("📝 7. エラーケーステスト");
    
    // 7-1. 重複ユーザー名での作成
    console.log("7-1. 重複ユーザー名エラーテスト");
    await testUtils.expectError(
      () => userService.createUser({
        username: testUserData.username, // 同じユーザー名
        email: "different@example.com",
        password: "password123",
        name: "重複テスト",
        role: "DRIVER"
      }),
      "ユーザー名は既に使用されています"
    );
    
    // 7-2. 重複メールアドレスでの作成
    console.log("7-2. 重複メールアドレスエラーテスト");
    await testUtils.expectError(
      () => userService.createUser({
        username: "different_user",
        email: testUserData.email, // 同じメールアドレス
        password: "password123",
        name: "重複テストメール",
        role: "DRIVER"
      }),
      "メールアドレスは既に使用されています"
    );
    
    // 7-3. 存在しないユーザーの取得
    console.log("7-3. 存在しないユーザー取得エラーテスト");
    await testUtils.expectError(
      () => userService.getUserById("00000000-0000-4000-8000-000000000000"), // 有効なUUID形式だが存在しない
      "ユーザーが見つかりません"
    );
    
    // 7-4. 無効なデータでの更新
    console.log("7-4. 無効なデータ更新エラーテスト");
    if (!testUserId) {
      throw new Error("testUserId is null - テストユーザーが作成されていません");
    }
    await testUtils.expectError(
      () => userService.updateUser(testUserId!, {
        username: "", // 空のユーザー名
        email: "invalid-email" // 無効なメール形式
      })
    );
    
    console.log("✅ エラーケーステスト完了\n");

    // ========================================
    // 8. 複数ユーザーでのテスト
    // ========================================
    console.log("📝 8. 複数ユーザーでのテスト");
    
    // 2人目のユーザー作成
    const testUser2Data = testUtils.generateTestUser('_second');
    const createdUser2 = await userService.createUser(testUser2Data);
    testUser2Id = createdUser2.id;
    
    // 最新のユーザー一覧を取得
    const updatedUsersList = await userService.getAllUsers({ 
      page: 1, 
      limit: 20 
    });
    
    testUtils.assert(
      updatedUsersList.data.some(u => u.id === testUserId),
      "1人目のユーザーが一覧に存在"
    );
    testUtils.assert(
      updatedUsersList.data.some(u => u.id === testUser2Id),
      "2人目のユーザーが一覧に存在"
    );
    
    console.log("✅ 複数ユーザーテスト完了\n");

    // ========================================
    // 9. パフォーマンステスト（大量データ対応）
    // ========================================
    console.log("📝 9. パフォーマンステスト");
    const startTime = Date.now();
    const largeUsersList = await userService.getAllUsers({ 
      page: 1, 
      limit: 100 
    });
    const endTime = Date.now();
    
    testUtils.assert(endTime - startTime < 5000, "100件取得が5秒以内に完了");
    testUtils.assert(Array.isArray(largeUsersList.data), "大量データ取得が正常");
    console.log(`⏱️ 100件取得時間: ${endTime - startTime}ms`);
    console.log("✅ パフォーマンステスト完了\n");

    // ========================================
    // 10. データ整合性テスト
    // ========================================
    console.log("📝 10. データ整合性テスト");
    
    // IDで取得したデータと一覧から取得したデータの整合性確認
    const userFromId = await userService.getUserById(testUserId);
    const userFromList = updatedUsersList.data.find(u => u.id === testUserId);
    
    testUtils.assert(
      userFromId.id === userFromList?.id,
      "ID取得と一覧取得で同じユーザーID"
    );
    testUtils.assert(
      userFromId.username === userFromList?.username,
      "ID取得と一覧取得で同じユーザー名"
    );
    
    console.log("✅ データ整合性テスト完了\n");

    console.log("🎉 === 全テスト正常完了 ===");

  } catch (error) {
    console.error("❌ テスト実行エラー:", error);
    console.error("\nスタックトレース:", (error as Error).stack);
    throw error;
  } finally {
    // 後処理: テストデータクリーンアップ
    console.log("\n🧹 === テスト後クリーンアップ ===");
    if (testUserId) {
      try {
        await userService.deleteUser(testUserId, "system-admin-id");
        console.log("✅ テストユーザー1を削除");
      } catch (error) {
        console.log("⚠️ テストユーザー1削除エラー:", error);
      }
    }
    
    if (testUser2Id) {
      try {
        await userService.deleteUser(testUser2Id, "system-admin-id");
        console.log("✅ テストユーザー2を削除");
      } catch (error) {
        console.log("⚠️ テストユーザー2削除エラー:", error);
      }
    }
    
    // 最終クリーンアップ
    await cleanup();
    
    // DB接続クローズ
    try {
      await prisma.$disconnect();
      console.log("✅ データベース接続を閉じました");
    } catch (error) {
      console.log("⚠️ DB切断エラー:", error);
    }
    
    console.log("🏁 === テスト完全終了 ===");
  }
}

// テスト実行
if (require.main === module) {
  runComprehensiveUserServiceTest().catch((error) => {
    console.error("💥 テスト実行失敗:", error);
    process.exit(1);
  });
}

export default runComprehensiveUserServiceTest;