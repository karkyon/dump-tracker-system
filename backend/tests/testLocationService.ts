import { LocationService } from "../src/services/locationService";
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
  locations: any[];
  operations: any[];
}

let testData: TestData = {
  adminUser: null,
  managerUser: null,
  driverUser: null,
  locations: [],
  operations: []
};

const locationService = new LocationService();

async function createTestUsers() {
  console.log("=== テストユーザー作成 ===");
  
  // 管理者ユーザー作成
  testData.adminUser = await authService.createUser({
    username: "testadmin_loc",
    email: "testadmin_loc@example.com",
    password: "password123",
    name: "テスト管理者（場所）",
    role: "ADMIN",
    isActive: true
  }, "system");
  
  console.log("✓ 管理者ユーザー作成完了:", testData.adminUser.username);

  // マネージャーユーザー作成
  testData.managerUser = await authService.createUser({
    username: "testmanager_loc",
    email: "testmanager_loc@example.com",
    password: "password123",
    name: "テストマネージャー（場所）",
    role: "MANAGER",
    isActive: true
  }, "system");
  
  console.log("✓ マネージャーユーザー作成完了:", testData.managerUser.username);

  // 運転手ユーザー作成
  testData.driverUser = await authService.createUser({
    username: "testdriver_loc",
    email: "testdriver_loc@example.com",
    password: "password123",
    name: "テスト運転手（場所）",
    role: "DRIVER",
    isActive: true
  }, "system");
  
  console.log("✓ 運転手ユーザー作成完了:", testData.driverUser.username);
  console.log("");
}

async function cleanupTestData() {
  console.log("=== テストデータクリーンアップ ===");
  
  try {
    // 運行詳細データ削除
    await prisma.operationDetail.deleteMany({
      where: { 
        operations: {
          driverId: {
            in: [testData.driverUser?.id, testData.managerUser?.id, testData.adminUser?.id]
          }
        }
      }
    });

    // 運行記録削除
    await prisma.operation.deleteMany({
      where: { 
        driverId: {
          in: [testData.driverUser?.id, testData.managerUser?.id, testData.adminUser?.id]
        }
      }
    });

    // 場所削除
    await prisma.location.deleteMany({
      where: { 
        OR: [
          { name: { contains: "テスト" } },
          { clientName: { contains: "テスト" } }
        ]
      }
    });

    // ユーザー削除
    await prisma.user.deleteMany({
      where: { username: { endsWith: "_loc" } }
    });

    console.log("✓ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("クリーンアップエラー:", error);
  }
}

async function main() {
  console.log("=== LocationService テスト開始 ===\n");

  try {
    // テスト前クリーンアップ
    await cleanupTestData();

    // ========================================
    // テストデータ準備
    // ========================================
    await createTestUsers();

    // ========================================
    // 1. 場所作成テスト
    // ========================================
    console.log("1. 場所作成テスト");
    
    // 積込場所作成
    const location1 = await locationService.createLocation({
      name: "テスト積込場所1",
      clientName: "テスト客先A",
      address: "東京都千代田区丸の内1-1-1",
      latitude: 35.6809591,
      longitude: 139.7673068,
      locationType: $Enums.LocationType.LOADING,
      contactPerson: "田中太郎",
      contactPhone: "03-1234-5678",
      contactEmail: "tanaka@test.com",
      operatingHours: "8:00-17:00",
      specialInstructions: "正面玄関から入場"
    }, testData.adminUser.id);
    testData.locations.push(location1);
    
    console.log("✓ 積込場所作成成功:", location1.name);

    // 積下場所作成
    const location2 = await locationService.createLocation({
      name: "テスト積下場所1",
      clientName: "テスト客先B",
      address: "大阪府大阪市北区梅田2-2-2",
      latitude: 34.7024854,
      longitude: 135.4937619,
      locationType: $Enums.LocationType.UNLOADING,
      contactPerson: "佐藤花子",
      contactPhone: "06-9876-5432",
      operatingHours: "9:00-18:00"
    }, testData.adminUser.id);
    testData.locations.push(location2);
    
    console.log("✓ 積下場所作成成功:", location2.name);

    // 両用場所作成
    const location3 = await locationService.createLocation({
      name: "テスト両用場所1",
      clientName: "テスト客先C",
      address: "名古屋市中区栄3-3-3",
      latitude: 35.1677014,
      longitude: 136.9055908,
      locationType: $Enums.LocationType.BOTH,
      hazardousArea: true,
      accessRestrictions: "要事前連絡"
    });
    testData.locations.push(location3);
    
    console.log("✓ 両用場所作成成功:", location3.name);
    console.log("");

    // ========================================
    // 2. 場所一覧取得テスト（フィルター付き）
    // ========================================
    console.log("2. 場所一覧取得テスト（フィルター付き）");
    
    const locationsList = await locationService.getLocations({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      search: 'テスト',
      isActive: true
    });
    
    console.log("✓ 場所一覧取得成功:", {
      totalItems: locationsList.total,
      currentPage: locationsList.page,
      retrievedCount: locationsList.data.length
    });
    console.log("");

    // ========================================
    // 3. 場所詳細取得テスト
    // ========================================
    console.log("3. 場所詳細取得テスト");
    
    const locationDetail = await locationService.getLocationById(location1.id);
    
    console.log("✓ 場所詳細取得成功:", {
      id: locationDetail.id,
      name: locationDetail.name,
      clientName: locationDetail.clientName,
      usageCount: locationDetail.usageCount
    });
    console.log("");

    // ========================================
    // 4. 場所更新テスト
    // ========================================
    console.log("4. 場所更新テスト");
    
    const updatedLocation = await locationService.updateLocation(location1.id, {
      operatingHours: "8:30-17:30",
      specialInstructions: "更新：正面玄関から入場、受付で受付票記入",
      equipmentAvailable: "フォークリフト2台、クレーン1台"
    });
    
    console.log("✓ 場所更新成功:", {
      id: updatedLocation.id,
      operatingHours: updatedLocation.operatingHours,
      equipmentAvailable: updatedLocation.equipmentAvailable
    });
    console.log("");

    // ========================================
    // 5. 場所タイプ別取得テスト
    // ========================================
    console.log("5. 場所タイプ別取得テスト");
    
    // 積込場所一覧取得
    const loadingLocations = await locationService.getLoadingLocations();
    console.log("✓ 積込場所一覧取得成功:", {
      count: loadingLocations.length,
      firstLocation: loadingLocations[0]?.name
    });

    // 積下場所一覧取得
    const unloadingLocations = await locationService.getUnloadingLocations();
    console.log("✓ 積下場所一覧取得成功:", {
      count: unloadingLocations.length,
      firstLocation: unloadingLocations[0]?.name
    });
    console.log("");

    // ========================================
    // 6. 客先一覧取得テスト
    // ========================================
    console.log("6. 客先一覧取得テスト");
    
    const customers = await locationService.getCustomers();
    
    console.log("✓ 客先一覧取得成功:", {
      count: customers.length,
      customers: customers.filter(c => c.includes('テスト'))
    });
    console.log("");

    // ========================================
    // 7. 場所検索テスト（オートコンプリート）
    // ========================================
    console.log("7. 場所検索テスト（オートコンプリート）");
    
    const searchResults = await locationService.searchLocations("テスト", $Enums.LocationType.LOADING, 5);
    
    console.log("✓ 場所検索成功:", {
      count: searchResults.length,
      results: searchResults.map(r => ({ name: r.name, locationType: r.locationType }))
    });
    console.log("");

    // ========================================
    // 8. GPS近隣検索テスト
    // ========================================
    console.log("8. GPS近隣検索テスト");
    
    // 東京駅周辺の場所を検索（1km圏内）
    const nearbyLocations = await locationService.findNearbyLocations(
      35.6812362,  // 東京駅の緯度
      139.7671248, // 東京駅の経度
      1.0,         // 1km圏内
      5            // 最大5件
    );
    
    console.log("✓ GPS近隣検索成功:", {
      count: nearbyLocations.length,
      locations: nearbyLocations.map(loc => ({ 
        name: loc.name, 
        distance: loc.distance,
        clientName: loc.clientName 
      }))
    });
    console.log("");

    // ========================================
    // 9. 場所統計取得テスト
    // ========================================
    console.log("9. 場所統計取得テスト");
    
    const stats = await locationService.getLocationStats(
      location1.id,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日前
      new Date().toISOString()
    );
    
    console.log("✓ 場所統計取得成功:", {
      locationName: stats.locationInfo.name,
      totalUsage: stats.statistics.totalUsage,
      loadingCount: stats.statistics.loadingCount,
      unloadingCount: stats.statistics.unloadingCount
    });
    console.log("");

    // ========================================
    // 10. GPS座標付き自動登録テスト
    // ========================================
    console.log("10. GPS座標付き自動登録テスト");
    
    const autoLocation = await locationService.autoRegisterFromApp({
      name: "テスト自動登録場所",
      clientName: "テストアプリ客先",
      address: "神奈川県横浜市西区みなとみらい4-4-4",
      locationType: $Enums.LocationType.BOTH,
      latitude: 35.4647152,
      longitude: 139.6233333
    });
    testData.locations.push(autoLocation);
    
    console.log("✓ GPS座標付き自動登録成功:", {
      id: autoLocation.id,
      name: autoLocation.name,
      coordinates: `${autoLocation.latitude}, ${autoLocation.longitude}`
    });
    console.log("");

    // ========================================
    // エラーケーステスト
    // ========================================
    console.log("=== エラーケーステスト ===");

    // 11. 存在しない場所取得エラー
    console.log("11. 存在しない場所取得エラーテスト");
    try {
      await locationService.getLocationById("nonexistent-id");
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 12. 重複場所作成エラー
    console.log("12. 重複場所作成エラーテスト");
    try {
      await locationService.createLocation({
        name: "テスト積込場所1", // 既に存在する名前
        clientName: "テスト客先A", // 既に存在する客先名
        address: "東京都千代田区丸の内1-1-1", // 既に存在する住所
        locationType: $Enums.LocationType.LOADING
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 13. 無効なGPS座標エラー
    console.log("13. 無効なGPS座標エラーテスト");
    try {
      await locationService.createLocation({
        name: "テスト無効GPS場所",
        clientName: "テスト客先",
        address: "テスト住所",
        latitude: 200, // 無効な緯度
        longitude: 300, // 無効な経度
        locationType: $Enums.LocationType.LOADING
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 14. GPS近隣検索での無効座標エラー
    console.log("14. GPS近隣検索での無効座標エラーテスト");
    try {
      await locationService.findNearbyLocations(200, 300, 1.0, 5);
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 15. 場所削除テスト（論理削除）
    console.log("15. 場所削除テスト（論理削除）");
    try {
      await locationService.deleteLocation(location3.id);
      
      // 削除後の確認
      const deletedLocation = await locationService.getLocationById(location3.id);
      console.log("✓ 場所削除成功（論理削除）:", {
        id: deletedLocation.id,
        isActive: deletedLocation.isActive
      });
    } catch (error) {
      console.log("場所削除エラー:", (error as Error).message);
    }
    console.log("");

    // 16. 必須フィールド不足エラー
    console.log("16. 必須フィールド不足エラーテスト");
    try {
      await locationService.createLocation({
        // nameが不足
        clientName: "テスト客先",
        address: "テスト住所",
        locationType: $Enums.LocationType.LOADING
      } as any);
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 17. 無効な場所タイプでの検索テスト
    console.log("17. 無効な場所タイプでの検索テスト");
    try {
      const emptyResults = await locationService.searchLocations("", undefined, 10);
      console.log("✓ 空の検索クエリの処理成功:", {
        resultCount: emptyResults.length
      });
    } catch (error) {
      console.log("検索エラー:", (error as Error).message);
    }
    console.log("");

    console.log("=== すべてのテストが完了しました ===");

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
  } finally {
    // テストデータのクリーンアップ
    console.log("\n=== テストデータクリーンアップ ===");
    await cleanupTestData();
    console.log("\n=== テスト終了 ===");
    
    // Prisma の切断（接続解放）
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.warn("Prisma disconnect failed:", e);
    }

    // プロセス終了（重要: Prisma接続の正常終了のため）
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