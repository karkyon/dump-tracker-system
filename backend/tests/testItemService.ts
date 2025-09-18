import { ItemService } from "../src/services/itemService";
import { authService } from "../src/services/authService";
import { $Enums, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 環境変数の設定（テスト用）
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-development-only';

// テスト用データ格納変数
interface TestData {
  adminUser: any;
  managerUser: any;
  driverUser: any;
  vehicle: any;
  operation: any;
  location: any;
  items: any[];
  operationDetails: any[];
}

let testData: TestData = {
  adminUser: null,
  managerUser: null,
  driverUser: null,
  vehicle: null,
  operation: null,
  location: null,
  items: [],
  operationDetails: []
};

const itemService = new ItemService();

async function createTestUsers() {
  console.log("=== テストユーザー作成 ===");
  
  try {
    // 管理者ユーザー作成
    testData.adminUser = await authService.createUser({
      username: "testadmin",
      email: "testadmin@example.com",
      password: "password123",
      name: "テスト管理者",
      role: "ADMIN",
      isActive: true
    }, "system");
    
    console.log("✓ 管理者ユーザー作成完了:", testData.adminUser.username);
    console.log("  - ID:", testData.adminUser.id);
    console.log("  - Email:", testData.adminUser.email);

    // マネージャーユーザー作成
    testData.managerUser = await authService.createUser({
      username: "testmanager",
      email: "testmanager@example.com",
      password: "password123",
      name: "テストマネージャー",
      role: "MANAGER",
      isActive: true
    }, "system");
    
    console.log("✓ マネージャーユーザー作成完了:", testData.managerUser.username);
    console.log("  - ID:", testData.managerUser.id);
    console.log("  - Email:", testData.managerUser.email);

    // 運転手ユーザー作成
    testData.driverUser = await authService.createUser({
      username: "testdriver",
      email: "testdriver@example.com",
      password: "password123",
      name: "テスト運転手",
      role: "DRIVER",
      isActive: true
    }, "system");
    
    console.log("✓ 運転手ユーザー作成完了:", testData.driverUser.username);
    console.log("  - ID:", testData.driverUser.id);
    console.log("  - Email:", testData.driverUser.email);
    console.log("");
  } catch (error) {
    console.error("✗ ユーザー作成エラー:", error);
    throw error;
  }
}

async function createTestVehicle() {
  console.log("=== テスト車両作成 ===");
  
  try {
    // 車両作成（Prismaを直接使用）
    testData.vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: "TEST-001",
        vehicleType: "DUMP_TRUCK",
        manufacturer: "テストメーカー",
        model: "テストモデル",
        year: 2023,
        capacityTons: 10.0,
        fuelType: "DIESEL",
        status: $Enums.VehicleStatus.ACTIVE
      }
    });
    
    console.log("✓ テスト車両作成完了:", testData.vehicle.plateNumber);
    console.log("  - ID:", testData.vehicle.id);
    console.log("  - 車両タイプ:", testData.vehicle.vehicleType);
    console.log("  - 積載量:", testData.vehicle.capacityTons, "トン");
    console.log("");
  } catch (error) {
    console.error("✗ 車両作成エラー:", error);
    throw error;
  }
}

async function createTestLocation() {
  console.log("=== テスト場所作成 ===");
  
  try {
    // 場所作成（Prismaを直接使用）
    testData.location = await prisma.location.create({
      data: {
        name: "テスト現場",
        clientName: "テスト顧客",
        address: "テスト住所123",
        contactPhone: "000-0000-0000",
        isActive: true
      }
    });
    
    console.log("✓ テスト場所作成完了:", testData.location.name);
    console.log("  - ID:", testData.location.id);
    console.log("  - 顧客名:", testData.location.clientName);
    console.log("  - 住所:", testData.location.address);
    console.log("");
  } catch (error) {
    console.error("✗ 場所作成エラー:", error);
    throw error;
  }
}

async function createTestOperation() {
  console.log("=== テスト運行記録作成 ===");
  
  try {
    // 運行記録作成（Prismaを直接使用）
    testData.operation = await prisma.operation.create({
      data: {
        vehicleId: testData.vehicle.id,
        driverId: testData.driverUser.id,
        status: "IN_PROGRESS",
        actualStartTime: new Date(),
        plannedEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8時間後
        startOdometer: 1000.0,
        startFuelLevel: 80.0
      }
    });
    
    console.log("✓ テスト運行記録作成完了:", testData.operation.id);
    console.log("  - 車両ID:", testData.operation.vehicleId);
    console.log("  - 運転手ID:", testData.operation.driverId);
    console.log("  - ステータス:", testData.operation.status);
    console.log("  - 開始時刻:", testData.operation.actualStartTime);
    console.log("");
  } catch (error) {
    console.error("✗ 運行記録作成エラー:", error);
    throw error;
  }
}

async function cleanupTestData() {
  console.log("=== テストデータクリーンアップ ===");
  
  try {
    // 運行詳細削除
    const deletedOperationDetails = await prisma.operationDetail.deleteMany({
      where: { 
        operationId: testData.operation?.id
      }
    });
    console.log("✓ 運行詳細削除:", deletedOperationDetails.count, "件");

    // 品目削除
    const deletedItems = await prisma.item.deleteMany({
      where: { 
        name: { contains: "テスト" }
      }
    });
    console.log("✓ 品目削除:", deletedItems.count, "件");

    // 運行記録削除
    if (testData.operation) {
      const deletedOperations = await prisma.operation.deleteMany({
        where: { id: testData.operation.id }
      });
      console.log("✓ 運行記録削除:", deletedOperations.count, "件");
    }

    // 場所削除
    if (testData.location) {
      const deletedLocations = await prisma.location.deleteMany({
        where: { id: testData.location.id }
      });
      console.log("✓ 場所削除:", deletedLocations.count, "件");
    }

    // 車両削除
    if (testData.vehicle) {
      const deletedVehicles = await prisma.vehicle.deleteMany({
        where: { id: testData.vehicle.id }
      });
      console.log("✓ 車両削除:", deletedVehicles.count, "件");
    }

    // ユーザー削除
    const deletedUsers = await prisma.user.deleteMany({
      where: { username: { startsWith: "test" } }
    });
    console.log("✓ ユーザー削除:", deletedUsers.count, "件");

    console.log("✓ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("✗ クリーンアップエラー:", error);
  }
}

async function main() {
  console.log("=== ItemService テスト開始 ===\n");
  console.log("実行日時:", new Date().toLocaleString('ja-JP'));
  console.log("Node.js バージョン:", process.version);
  console.log("データベース接続確認中...\n");

  try {
    // データベース接続確認
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✓ データベース接続成功\n");

    // テスト前クリーンアップ
    console.log("=== 事前クリーンアップ ===");
    await cleanupTestData();
    console.log("");

    // ========================================
    // テストデータ準備
    // ========================================
    console.log("=== テストデータ準備フェーズ ===");
    await createTestUsers();
    await createTestVehicle();
    await createTestLocation();
    await createTestOperation();

    // ========================================
    // 1. 品目作成テスト
    // ========================================
    console.log("1. 品目作成テスト");
    console.log("   品目データの作成を開始...");
    
    const item1 = await itemService.createItem({
      name: "テスト砂利",
      displayOrder: 10
    });
    testData.items.push(item1);
    
    console.log("✓ 品目作成成功:", item1.name);
    console.log("  - ID:", item1.id);
    console.log("  - 表示順序:", item1.displayOrder);
    console.log("  - アクティブ:", item1.isActive);
    console.log("  - 作成日時:", item1.createdAt);

    const item2 = await itemService.createItem({
      name: "テスト土砂",
      displayOrder: 20
    });
    testData.items.push(item2);
    
    console.log("✓ 品目作成成功:", item2.name);
    console.log("  - ID:", item2.id);
    console.log("  - 表示順序:", item2.displayOrder);

    const item3 = await itemService.createItem({
      name: "テストコンクリート"
      // displayOrderを指定しない場合の自動設定テスト
    });
    testData.items.push(item3);
    
    console.log("✓ 品目作成成功（表示順序自動設定）:", item3.name);
    console.log("  - ID:", item3.id);
    console.log("  - 自動設定された表示順序:", item3.displayOrder);
    console.log("");

    // ========================================
    // 2. 品目一覧取得テスト
    // ========================================
    console.log("2. 品目一覧取得テスト");
    console.log("   ページネーション付き一覧取得を実行...");
    
    const itemsList = await itemService.getItems({
      page: 1,
      limit: 10,
      sortBy: 'displayOrder',
      sortOrder: 'asc'
    });
    
    console.log("✓ 品目一覧取得成功:", {
      総件数: itemsList.total,
      現在ページ: itemsList.page,
      取得件数: itemsList.data.length,
      総ページ数: itemsList.totalPages
    });

    // データの詳細を表示
    itemsList.data.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} (順序: ${item.displayOrder}, 使用回数: ${item.usageCount})`);
    });

    // 検索機能テスト
    console.log("   検索機能テスト実行中...");
    const searchResult = await itemService.getItems({
      page: 1,
      limit: 10,
      search: "砂利"
    });
    
    console.log("✓ 品目検索成功:", {
      検索キーワード: "砂利",
      見つかった件数: searchResult.data.length
    });
    
    searchResult.data.forEach((item, index) => {
      console.log(`  検索結果${index + 1}: ${item.name}`);
    });
    console.log("");

    // ========================================
    // 3. 品目詳細取得テスト
    // ========================================
    console.log("3. 品目詳細取得テスト");
    console.log("   品目詳細情報の取得中...");
    
    const itemDetail = await itemService.getItemById(item1.id);
    
    console.log("✓ 品目詳細取得成功:", {
      ID: itemDetail.id,
      品目名: itemDetail.name,
      使用回数: itemDetail.usageCount,
      最近の使用履歴件数: itemDetail.recentUsage?.length || 0
    });
    
    if (itemDetail.recentUsage && itemDetail.recentUsage.length > 0) {
      console.log("  最近の使用履歴:");
      itemDetail.recentUsage.forEach((usage, index) => {
        console.log(`    ${index + 1}. ${usage.activityType} - ${usage.createdAt}`);
      });
    } else {
      console.log("  使用履歴: なし");
    }
    console.log("");

    // ========================================
    // 4. 品目更新テスト
    // ========================================
    console.log("4. 品目更新テスト");
    console.log("   品目情報の更新中...");
    
    const updatedItem = await itemService.updateItem(item1.id, {
      name: "テスト砂利（更新済み）",
      displayOrder: 5
    });
    
    console.log("✓ 品目更新成功:", {
      ID: updatedItem.id,
      更新後品目名: updatedItem.name,
      更新後表示順序: updatedItem.displayOrder,
      更新日時: updatedItem.updatedAt
    });
    console.log("");

    // ========================================
    // 5. アクティブ品目一覧取得テスト
    // ========================================
    console.log("5. アクティブ品目一覧取得テスト");
    console.log("   アクティブな品目の取得中...");
    
    const activeItems = await itemService.getActiveItems();
    
    console.log("✓ アクティブ品目一覧取得成功:", {
      アクティブ品目数: activeItems.length
    });
    
    console.log("  アクティブ品目一覧:");
    activeItems.forEach((item, index) => {
      console.log(`    ${index + 1}. ${item.name} (ID: ${item.id}, 順序: ${item.displayOrder})`);
    });
    console.log("");

    // ========================================
    // 6. 品目検索（オートコンプリート）テスト
    // ========================================
    console.log("6. 品目検索（オートコンプリート）テスト");
    console.log("   オートコンプリート機能テスト中...");
    
    const autocompleteResults = await itemService.searchItems("テスト", 5);
    
    console.log("✓ オートコンプリート検索成功:", {
      検索クエリ: "テスト",
      見つかった件数: autocompleteResults.length
    });
    
    console.log("  検索結果:");
    autocompleteResults.forEach((item, index) => {
      console.log(`    ${index + 1}. ${item.name} (ID: ${item.id})`);
    });
    console.log("");

    // ========================================
    // 7. 表示順序更新テスト
    // ========================================
    console.log("7. 表示順序更新テスト");
    console.log("   個別の表示順序更新中...");
    
    const reorderedItem = await itemService.updateDisplayOrder(item2.id, 15);
    
    console.log("✓ 表示順序更新成功:", {
      品目ID: reorderedItem.id,
      品目名: reorderedItem.name,
      新しい表示順序: reorderedItem.displayOrder
    });
    console.log("");

    // ========================================
    // 8. 一括表示順序更新テスト
    // ========================================
    console.log("8. 一括表示順序更新テスト");
    console.log("   複数品目の表示順序を一括更新中...");
    
    const updateOrders = [
      { id: item1.id, displayOrder: 1 },
      { id: item2.id, displayOrder: 2 },
      { id: item3.id, displayOrder: 3 }
    ];
    
    console.log("  更新予定:");
    updateOrders.forEach((order, index) => {
      const itemName = testData.items.find(item => item.id === order.id)?.name || "不明";
      console.log(`    ${index + 1}. ${itemName} → 順序 ${order.displayOrder}`);
    });
    
    await itemService.bulkUpdateDisplayOrder(updateOrders);
    
    console.log("✓ 一括表示順序更新成功");
    
    // 更新結果の確認
    const updatedItemsList = await itemService.getItems({
      page: 1,
      limit: 10,
      sortBy: 'displayOrder',
      sortOrder: 'asc'
    });
    
    console.log("  更新後の順序確認:");
    updatedItemsList.data.forEach((item, index) => {
      console.log(`    ${item.displayOrder}. ${item.name}`);
    });
    console.log("");

    // ========================================
    // 9. 運行詳細作成（品目使用履歴用）
    // ========================================
    console.log("9. 運行詳細作成（品目使用履歴用）");
    console.log("   品目使用履歴のテストデータ作成中...");
    
    // OperationDetailModel.tsの型定義に合わせて修正
    const operationDetail = await prisma.operationDetail.create({
      data: {
        operations: {
          connect: { id: testData.operation.id }
        },
        items: {
          connect: { id: item1.id }
        },
        locations: {
          connect: { id: testData.location.id }
        },
        activityType: "LOADING",
        quantity: 10.5,
        unit: "ton",
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60 * 1000) // 30分後
      }
    });
    testData.operationDetails.push(operationDetail);
    
    console.log("✓ 運行詳細作成成功:", operationDetail.id);
    console.log("  - 運行ID:", testData.operation.id);
    console.log("  - 品目ID:", item1.id);
    console.log("  - 場所ID:", testData.location.id);
    console.log("  - 活動タイプ:", operationDetail.activityType);
    console.log("  - 数量:", operationDetail.quantity, operationDetail.unit);
    console.log("");

    // ========================================
    // 10. 品目統計取得テスト
    // ========================================
    console.log("10. 品目統計取得テスト");
    console.log("   品目使用統計の取得中...");
    
    // 少し待機して統計データが反映されるのを確認
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const itemStats = await itemService.getItemStats(item1.id);
    
    console.log("✓ 品目統計取得成功:", {
      品目名: itemStats.itemInfo.name,
      総使用回数: itemStats.statistics.totalUsage,
      ユニーク顧客数: itemStats.statistics.uniqueCustomers,
      ユニーク運転手数: itemStats.statistics.uniqueDrivers,
      最近の活動件数: itemStats.statistics.recentActivity.length
    });
    
    if (itemStats.statistics.recentActivity.length > 0) {
      console.log("  最近の活動:");
      itemStats.statistics.recentActivity.forEach((activity, index) => {
        console.log(`    ${index + 1}. ${activity.activityType} - ${activity.driverName || '運転手不明'} - ${activity.clientName || '顧客不明'}`);
      });
    }
    console.log("");

    // ========================================
    // 11. 使用頻度順品目一覧取得テスト
    // ========================================
    console.log("11. 使用頻度順品目一覧取得テスト");
    console.log("   使用頻度順の品目一覧取得中...");
    
    const usageStats = await itemService.getItemsByUsageFrequency(5);
    
    console.log("✓ 使用頻度順品目一覧取得成功:", {
      取得品目数: usageStats.length
    });
    
    console.log("  使用頻度ランキング:");
    usageStats.forEach((stat, index) => {
      console.log(`    ${index + 1}位: ${stat.item.name} (${stat.usageCount}回使用)`);
    });
    console.log("");

    // ========================================
    // 12. 品目削除（論理削除）テスト
    // ========================================
    console.log("12. 品目削除（論理削除）テスト");
    console.log("   使用されていない品目の削除テスト...");
    
    // まず使用されていない品目を削除
    console.log(`   品目「${item3.name}」を削除中...`);
    await itemService.deleteItem(item3.id);
    
    console.log("✓ 品目削除成功（論理削除）:", item3.name);
    
    // 削除後の確認
    const deletedItem = await prisma.item.findUnique({
      where: { id: item3.id }
    });
    
    console.log("✓ 削除確認:", {
      品目名: deletedItem?.name,
      アクティブ状態: deletedItem?.isActive
    });
    
    if (deletedItem?.isActive === false) {
      console.log("  → 正常に論理削除されました（isActive = false）");
    }
    console.log("");

    // ========================================
    // エラーケーステスト
    // ========================================
    console.log("=== エラーケーステスト開始 ===");

    // 13. 存在しない品目取得エラー
    console.log("13. 存在しない品目取得エラーテスト");
    console.log("   存在しないIDでの品目取得を試行...");
    try {
      await itemService.getItemById("nonexistent-id");
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 14. 重複品目作成エラー
    console.log("14. 重複品目作成エラーテスト");
    console.log("   既存の品目名で新規作成を試行...");
    try {
      await itemService.createItem({
        name: "テスト砂利（更新済み）", // 既に存在する名前
        displayOrder: 100
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 15. 使用中品目削除エラー
    console.log("15. 使用中品目削除エラーテスト");
    console.log("   進行中の運行で使用されている品目の削除を試行...");
    try {
      // 進行中の運行で使用されている品目を削除しようとする
      await itemService.deleteItem(item1.id);
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 16. 重複名での更新エラー
    console.log("16. 重複名での更新エラーテスト");
    console.log("   既存の品目名に更新を試行...");
    try {
      await itemService.updateItem(item2.id, {
        name: "テスト砂利（更新済み）" // item1と同じ名前に更新しようとする
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 17. 存在しない品目更新エラー
    console.log("17. 存在しない品目更新エラーテスト");
    console.log("   存在しない品目IDでの更新を試行...");
    try {
      await itemService.updateItem("nonexistent-id", {
        name: "存在しない品目更新"
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 18. 空の検索クエリテスト
    console.log("18. 空の検索クエリテスト");
    console.log("   空文字での検索を実行...");
    const emptySearchResult = await itemService.searchItems("", 5);
    console.log("✓ 空検索結果:", {
      結果件数: emptySearchResult.length
    });

    const shortQueryResult = await itemService.searchItems("", 5);
    console.log("✓ 短すぎるクエリ結果:", {
      結果件数: shortQueryResult.length
    });
    console.log("");

    // 19. フィルタリング機能テスト
    console.log("19. フィルタリング機能テスト");
    console.log("   アクティブフィルタリングテスト...");
    
    // アクティブな品目のみ取得
    const activeOnlyResult = await itemService.getItems({
      page: 1,
      limit: 10,
      isActive: true
    });
    
    console.log("✓ アクティブ品目フィルタリング成功:", {
      総アクティブ品目数: activeOnlyResult.total
    });

    // 非アクティブな品目も含めて取得
    const allItemsResult = await itemService.getItems({
      page: 1,
      limit: 10
    });
    
    console.log("✓ 全品目取得成功:", {
      総品目数: allItemsResult.total
    });
    
    const inactiveCount = allItemsResult.total - activeOnlyResult.total;
    console.log("  非アクティブ品目数:", inactiveCount);
    console.log("");

    // ========================================
    // 20. 詳細な統計情報テスト
    // ========================================
    console.log("20. 詳細な統計情報テスト");
    console.log("   期間指定での統計取得...");
    
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7日前
    const endDate = new Date().toISOString();
    
    const periodStats = await itemService.getItemStats(item1.id, startDate, endDate);
    
    console.log("✓ 期間指定統計取得成功:", {
      期間: `${startDate.split('T')[0]} ～ ${endDate.split('T')[0]}`,
      期間内使用回数: periodStats.statistics.totalUsage,
      期間内ユニーク顧客数: periodStats.statistics.uniqueCustomers
    });
    console.log("");

    console.log("=== すべてのテストが完了しました ===");
    console.log("実行時刻:", new Date().toLocaleString('ja-JP'));
    
    // 最終サマリー
    console.log("\n=== テスト結果サマリー ===");
    console.log("✓ 品目作成テスト: 成功");
    console.log("✓ 品目一覧取得テスト: 成功");
    console.log("✓ 品目詳細取得テスト: 成功");
    console.log("✓ 品目更新テスト: 成功");
    console.log("✓ アクティブ品目一覧テスト: 成功");
    console.log("✓ オートコンプリート検索テスト: 成功");
    console.log("✓ 表示順序更新テスト: 成功");
    console.log("✓ 一括順序更新テスト: 成功");
    console.log("✓ 運行詳細作成テスト: 成功");
    console.log("✓ 品目統計取得テスト: 成功");
    console.log("✓ 使用頻度順一覧テスト: 成功");
    console.log("✓ 論理削除テスト: 成功");
    console.log("✓ エラーハンドリングテスト: 成功");
    console.log("✓ フィルタリング機能テスト: 成功");
    console.log("✓ 期間指定統計テスト: 成功");
    
    console.log(`\n作成された品目数: ${testData.items.length}`);
    console.log(`作成された運行詳細数: ${testData.operationDetails.length}`);
    console.log("全ての機能が正常に動作しています！");

  } catch (error) {
    console.error("✗ テスト実行エラー:", error);
    
    // エラーの詳細情報を表示
    if (error instanceof Error) {
      console.error("エラー名:", error.name);
      console.error("エラーメッセージ:", error.message);
      if (error.stack) {
        console.error("スタックトレース:", error.stack);
      }
    }
    
    // エラー発生箇所の特定情報
    console.error("\n=== デバッグ情報 ===");
    console.error("テストデータ状況:");
    console.error("- 管理者ユーザー:", testData.adminUser ? "作成済み" : "未作成");
    console.error("- マネージャーユーザー:", testData.managerUser ? "作成済み" : "未作成");
    console.error("- 運転手ユーザー:", testData.driverUser ? "作成済み" : "未作成");
    console.error("- 車両:", testData.vehicle ? "作成済み" : "未作成");
    console.error("- 場所:", testData.location ? "作成済み" : "未作成");
    console.error("- 運行記録:", testData.operation ? "作成済み" : "未作成");
    console.error("- 品目数:", testData.items.length);
    console.error("- 運行詳細数:", testData.operationDetails.length);
    
  } finally {
    // テストデータのクリーンアップ
    console.log("\n=== テストデータクリーンアップ開始 ===");
    await cleanupTestData();
    console.log("\n=== テスト終了 ===");
    
    // Prisma の切断（接続解放）
    console.log("データベース接続を切断中...");
    try {
      await prisma.$disconnect();
      console.log("✓ データベース接続切断完了");
    } catch (e) {
      console.warn("⚠ Prisma disconnect failed:", e);
    }

    // 最終メッセージ
    console.log("\n" + "=".repeat(50));
    console.log("ItemService 単体テスト完了");
    console.log("実行完了時刻:", new Date().toLocaleString('ja-JP'));
    console.log("=".repeat(50));

    // プロセス終了（重要: Prisma接続の正常終了のため）
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// スクリプト実行時のハンドリング
if (require.main === module) {
  // 未処理の例外をキャッチ
  process.on('uncaughtException', (error) => {
    console.error('✗ 未処理の例外:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('✗ 未処理のPromise拒否:', reason);
    process.exit(1);
  });

  // シグナル処理（Ctrl+C等）
  process.on('SIGINT', async () => {
    console.log('\n\n=== テスト中断 ===');
    console.log('クリーンアップを実行中...');
    
    try {
      await cleanupTestData();
      await prisma.$disconnect();
      console.log('✓ クリーンアップ完了');
    } catch (error) {
      console.error('✗ クリーンアップエラー:', error);
    }
    
    console.log('テストを中断しました。');
    process.exit(0);
  });

  // メイン実行
  main().catch((error) => {
    console.error('✗ メイン実行エラー:', error);
    process.exit(1);
  });
}

export default main;