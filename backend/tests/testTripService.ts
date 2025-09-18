import { TripService } from "../src/services/tripService";
import { authService } from "../src/services/authService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 環境変数の設定（テスト用）
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-development-only';

// テスト用データ格納変数
interface TestData {
  adminUser: any;
  managerUser: any;
  driverUser: any;
  vehicle1: any;
  vehicle2: any;
  location1: any;
  location2: any;
  item1: any;
  item2: any;
  trip1: any;
  trip2: any;
  loadingRecord: any;
  unloadingRecord: any;
  gpsLog: any;
}

let testData: TestData = {
  adminUser: null,
  managerUser: null,
  driverUser: null,
  vehicle1: null,
  vehicle2: null,
  location1: null,
  location2: null,
  item1: null,
  item2: null,
  trip1: null,
  trip2: null,
  loadingRecord: null,
  unloadingRecord: null,
  gpsLog: null
};

const tripService = new TripService(prisma);

async function createTestUsers() {
  console.log("=== テストユーザー作成 ===");
  
  // 管理者ユーザー作成
  testData.adminUser = await authService.createUser({
    username: "tripadmin",
    email: "tripadmin@example.com",
    password: "password123",
    name: "運行管理者",
    role: "ADMIN",
    isActive: true
  }, "system");
  
  console.log("✓ 管理者ユーザー作成完了:", testData.adminUser.username);

  // マネージャーユーザー作成
  testData.managerUser = await authService.createUser({
    username: "tripmanager",
    email: "tripmanager@example.com",
    password: "password123",
    name: "運行マネージャー",
    role: "MANAGER",
    isActive: true
  }, "system");
  
  console.log("✓ マネージャーユーザー作成完了:", testData.managerUser.username);

  // 運転手ユーザー作成
  testData.driverUser = await authService.createUser({
    username: "tripdriver",
    email: "tripdriver@example.com",
    password: "password123",
    name: "テスト運転手",
    role: "DRIVER",
    isActive: true
  }, "system");
  
  console.log("✓ 運転手ユーザー作成完了:", testData.driverUser.username);
  console.log("");
}

async function createTestVehicles() {
  console.log("=== テスト車両作成 ===");
  
  // 車両1作成（利用可能）
  testData.vehicle1 = await prisma.vehicle.create({
    data: {
      plateNumber: "TRIP-001",
      vehicleType: "DUMP_TRUCK",
      manufacturer: "トリップメーカー",
      model: "ダンプモデルA",
      year: 2023,
      capacityTons: 10.0,
      fuelType: "DIESEL",
      status: "ACTIVE",
      currentMileage: 5000,
      purchaseDate: new Date("2023-01-01"),
      insuranceExpiry: new Date("2025-12-31"),
      inspectionExpiry: new Date("2025-06-30")
    }
  });
  
  console.log("✓ テスト車両1作成完了:", testData.vehicle1.plateNumber);

  // 車両2作成（メンテナンス中）
  testData.vehicle2 = await prisma.vehicle.create({
    data: {
      plateNumber: "TRIP-002",
      vehicleType: "DUMP_TRUCK",
      manufacturer: "トリップメーカー",
      model: "ダンプモデルB",
      year: 2022,
      capacityTons: 8.0,
      fuelType: "DIESEL",
      status: "MAINTENANCE",
      currentMileage: 15000
    }
  });
  
  console.log("✓ テスト車両2作成完了:", testData.vehicle2.plateNumber);
  console.log("");
}

async function createTestLocations() {
  console.log("=== テスト場所作成 ===");
  
  // 積込場所作成
  testData.location1 = await prisma.location.create({
    data: {
      name: "テスト積込場所A",
      address: "東京都千代田区1-1-1",
      latitude: 35.6762,
      longitude: 139.6503,
      locationType: "LOADING",
      clientName: "積込クライアントA",
      contactPerson: "積込担当者",
      contactPhone: "03-1234-5678",
      contactEmail: "loading@example.com",
      operatingHours: "8:00-17:00",
      isActive: true
    }
  });
  
  console.log("✓ 積込場所作成完了:", testData.location1.name);

  // 積降場所作成
  testData.location2 = await prisma.location.create({
    data: {
      name: "テスト積降場所B",
      address: "東京都港区2-2-2",
      latitude: 35.6580,
      longitude: 139.7016,
      locationType: "UNLOADING",
      clientName: "積降クライアントB",
      contactPerson: "積降担当者",
      contactPhone: "03-8765-4321",
      contactEmail: "unloading@example.com",
      operatingHours: "9:00-18:00",
      isActive: true
    }
  });
  
  console.log("✓ 積降場所作成完了:", testData.location2.name);
  console.log("");
}

async function createTestItems() {
  console.log("=== テスト品目作成 ===");
  
  // 品目1作成
  testData.item1 = await prisma.item.create({
    data: {
      name: "テスト砂利",
      category: "建材",
      unit: "トン",
      standardWeight: 1.5,
      hazardous: false,
      description: "建設用砂利",
      isActive: true,
      displayOrder: 1
    }
  });
  
  console.log("✓ 品目1作成完了:", testData.item1.name);

  // 品目2作成
  testData.item2 = await prisma.item.create({
    data: {
      name: "テスト土砂",
      category: "建材",
      unit: "トン",
      standardWeight: 1.8,
      hazardous: false,
      description: "建設用土砂",
      isActive: true,
      displayOrder: 2
    }
  });
  
  console.log("✓ 品目2作成完了:", testData.item2.name);
  console.log("");
}

async function cleanupTestData() {
  console.log("=== テストデータクリーンアップ ===");
  
  try {
    // GPSログ削除
    await prisma.gpsLog.deleteMany({
      where: { 
        vehicleId: {
          in: [testData.vehicle1?.id, testData.vehicle2?.id].filter(Boolean)
        }
      }
    });

    // 運行詳細削除
    await prisma.operationDetail.deleteMany({
      where: {
        operations: {
          driverId: {
            in: [testData.driverUser?.id, testData.managerUser?.id, testData.adminUser?.id].filter(Boolean)
          }
        }
      }
    });

    // 運行記録削除
    await prisma.operation.deleteMany({
      where: {
        driverId: {
          in: [testData.driverUser?.id, testData.managerUser?.id, testData.adminUser?.id].filter(Boolean)
        }
      }
    });

    // 品目削除
    await prisma.item.deleteMany({
      where: { 
        name: { contains: "テスト" }
      }
    });

    // 場所削除
    await prisma.location.deleteMany({
      where: { 
        name: { contains: "テスト" }
      }
    });

    // 車両削除
    await prisma.vehicle.deleteMany({
      where: { 
        plateNumber: { startsWith: "TRIP-" }
      }
    });

    // ユーザー削除
    await prisma.user.deleteMany({
      where: { username: { startsWith: "trip" } }
    });

    console.log("✓ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("クリーンアップエラー:", error);
  }
}

async function main() {
  console.log("=== TripService テスト開始 ===\n");

  try {
    // テスト前クリーンアップ
    await cleanupTestData();

    // ========================================
    // テストデータ準備
    // ========================================
    await createTestUsers();
    await createTestVehicles();
    await createTestLocations();
    await createTestItems();

    // ========================================
    // 1. 運行開始テスト
    // ========================================
    console.log("1. 運行開始テスト");
    
    testData.trip1 = await tripService.startTrip({
      vehicleId: testData.vehicle1.id,
      driverId: testData.driverUser.id,
      startTime: new Date(),
      notes: "テスト運行1"
    }, testData.driverUser.id);
    
    console.log("✓ 運行開始成功:", {
      id: testData.trip1.id,
      operationNumber: testData.trip1.operationNumber,
      status: testData.trip1.status,
      vehicleId: testData.trip1.vehicleId
    });
    console.log("");

    // ========================================
    // 2. 運行詳細取得テスト
    // ========================================
    console.log("2. 運行詳細取得テスト");
    
    const tripDetail = await tripService.getTripById(testData.trip1.id);
    
    console.log("✓ 運行詳細取得成功:", {
      id: tripDetail.id,
      driverName: tripDetail.usersOperationsDriverIdTousers.name,
      vehiclePlate: tripDetail.vehicles.plateNumber,
      status: tripDetail.status
    });
    console.log("");

    // ========================================
    // 3. 積込記録追加テスト
    // ========================================
    console.log("3. 積込記録追加テスト");
    
    testData.loadingRecord = await tripService.addLoadingRecord(
      testData.trip1.id,
      {
        locationId: testData.location1.id,
        itemId: testData.item1.id,
        quantity: 5.5,
        activityType: "LOADING",
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60 * 1000), // 30分後
        notes: "積込テスト"
      }
    );
    
    console.log("✓ 積込記録追加成功:", {
      id: testData.loadingRecord.id,
      sequenceNumber: testData.loadingRecord.sequenceNumber,
      quantityTons: testData.loadingRecord.quantityTons,
      itemName: testData.loadingRecord.items.name,
      locationName: testData.loadingRecord.locations.name
    });
    console.log("");

    // ========================================
    // 4. 積降記録追加テスト
    // ========================================
    console.log("4. 積降記録追加テスト");
    
    testData.unloadingRecord = await tripService.addUnloadingRecord(
      testData.trip1.id,
      {
        locationId: testData.location2.id,
        itemId: testData.item1.id,
        quantity: 5.5,
        activityType: "UNLOADING",
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
        endTime: new Date(Date.now() + 90 * 60 * 1000), // 1.5時間後
        notes: "積降テスト"
      }
    );
    
    console.log("✓ 積降記録追加成功:", {
      id: testData.unloadingRecord.id,
      sequenceNumber: testData.unloadingRecord.sequenceNumber,
      quantityTons: testData.unloadingRecord.quantityTons,
      locationName: testData.unloadingRecord.locations.name
    });
    console.log("");

    // ========================================
    // 5. GPS位置情報更新テスト
    // ========================================
    console.log("5. GPS位置情報更新テスト");
    
    testData.gpsLog = await tripService.updateGPSLocation(
      testData.trip1.id,
      {
        latitude: 35.6762,
        longitude: 139.6503,
        speedKmh: 40.5,
        heading: 90,
        accuracyMeters: 5,
        timestamp: new Date()
      }
    );
    
    console.log("✓ GPS位置情報更新成功:", {
      id: testData.gpsLog.id,
      latitude: testData.gpsLog.latitude,
      longitude: testData.gpsLog.longitude,
      speedKmh: testData.gpsLog.speedKmh
    });
    console.log("");

    // ========================================
    // 6. 運行更新テスト
    // ========================================
    console.log("6. 運行更新テスト");
    
    const updatedTrip = await tripService.updateTrip(
      testData.trip1.id,
      {
        notes: "更新：テスト運行1、追加確認完了"
      }
    );
    
    console.log("✓ 運行更新成功:", {
      id: updatedTrip.id,
      notes: updatedTrip.notes,
      updatedAt: updatedTrip.updatedAt
    });
    console.log("");

    // ========================================
    // 7. 現在の運行取得テスト（ドライバー別）
    // ========================================
    console.log("7. 現在の運行取得テスト（ドライバー別）");
    
    const currentTrip = await tripService.getCurrentTripByDriver(testData.driverUser.id);
    
    console.log("✓ 現在の運行取得成功:", {
      id: currentTrip.id,
      status: currentTrip.status,
      detailsCount: currentTrip.operationDetails.length
    });
    console.log("");

    // ========================================
    // 8. 運行一覧取得テスト
    // ========================================
    console.log("8. 運行一覧取得テスト");
    
    const tripList = await tripService.getAllTrips({
      page: 1,
      limit: 10,
      driverId: testData.driverUser.id
    });
    
    console.log("✓ 運行一覧取得成功:", {
      total: tripList.total,
      page: tripList.page,
      pageSize: tripList.pageSize,
      dataCount: tripList.data.length
    });
    console.log("");

    // ========================================
    // 9. 運行統計取得テスト
    // ========================================
    console.log("9. 運行統計取得テスト");
    
    const statistics = await tripService.getTripStatistics({
      driverId: testData.driverUser.id,
      vehicleId: testData.vehicle1.id
    });
    
    console.log("✓ 運行統計取得成功:", {
      totalTrips: statistics.totalTrips,
      totalQuantity: statistics.totalQuantity,
      totalActivities: statistics.totalActivities
    });
    console.log("");

    // ========================================
    // 10. 給油記録追加テスト
    // ========================================
    console.log("10. 給油記録追加テスト");
    
    const fuelRecord = await tripService.addFuelRecord(
      testData.trip1.id,
      {
        fuelAmount: 50.5,
        fuelCost: 7575,
        location: "テストガソリンスタンド",
        timestamp: new Date()
      }
    );
    
    console.log("✓ 給油記録追加成功:", {
      tripId: fuelRecord.tripId,
      fuelAmount: fuelRecord.fuelAmount,
      fuelCost: fuelRecord.fuelCost
    });
    console.log("");

    // ========================================
    // 11. 運行終了テスト
    // ========================================
    console.log("11. 運行終了テスト");
    
    const endedTrip = await tripService.endTrip(
      testData.trip1.id,
      {
        endTime: new Date(),
        notes: "運行終了：テスト完了"
      }
    );
    
    console.log("✓ 運行終了成功:", {
      id: endedTrip.id,
      status: endedTrip.status,
      actualEndTime: endedTrip.actualEndTime
    });
    
    // 車両ステータス確認
    const vehicleAfterEnd = await prisma.vehicle.findUnique({
      where: { id: testData.vehicle1.id }
    });
    
    console.log("✓ 車両ステータス復旧確認:", {
      plateNumber: vehicleAfterEnd?.plateNumber,
      status: vehicleAfterEnd?.status
    });
    console.log("");

    // ========================================
    // エラーケーステスト
    // ========================================
    console.log("=== エラーケーステスト ===");

    // 12. ドライバーID未指定エラー
    console.log("12. ドライバーID未指定エラーテスト");
    try {
      await tripService.startTrip({
        vehicleId: testData.vehicle1.id,
        startTime: new Date(),
        notes: "エラーテスト"
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 13. 存在しない車両IDエラー
    console.log("13. 存在しない車両IDエラーテスト");
    try {
      await tripService.startTrip({
        vehicleId: "nonexistent-vehicle-id",
        driverId: testData.driverUser.id,
        startTime: new Date(),
        notes: "エラーテスト"
      }, testData.driverUser.id);
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 14. 利用不可車両エラー
    console.log("14. 利用不可車両エラーテスト");
    try {
      await tripService.startTrip({
        vehicleId: testData.vehicle2.id, // MAINTENANCE状態の車両
        driverId: testData.driverUser.id,
        startTime: new Date(),
        notes: "エラーテスト"
      }, testData.driverUser.id);
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 15. 存在しない運行IDでのGPS更新エラー
    console.log("15. 存在しない運行IDでのGPS更新エラーテスト");
    try {
      await tripService.updateGPSLocation(
        "nonexistent-operation-id",
        {
          latitude: 35.6762,
          longitude: 139.6503,
          timestamp: new Date()
        }
      );
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 16. 存在しない運行の終了エラー
    console.log("16. 存在しない運行の終了エラーテスト");
    try {
      await tripService.endTrip(
        "nonexistent-operation-id",
        {
          endTime: new Date(),
          notes: "エラーテスト"
        }
      );
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // ========================================
    // パフォーマンステスト
    // ========================================
    console.log("=== パフォーマンステスト ===");

    // 17. 複数運行作成のパフォーマンス
    console.log("17. 複数運行作成パフォーマンステスト");
    
    const startTime = Date.now();
    const operations: any[] = [];
    
    // 車両を利用可能状態に戻す
    await prisma.vehicle.update({
      where: { id: testData.vehicle1.id },
      data: { status: "ACTIVE" }
    });
    
    // 3つの運行を順番に作成（同じ車両を使い回す）
    for (let i = 0; i < 3; i++) {
      const operation = await tripService.startTrip({
        vehicleId: testData.vehicle1.id,
        driverId: testData.driverUser.id,
        startTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // 1日ずつ過去に
        notes: `パフォーマンステスト運行${i + 1}`
      }, testData.driverUser.id);
      
      operations.push(operation);
      
      // 運行を即座に終了して車両を開放
      await tripService.endTrip(operation.id, {
        endTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000) + 8 * 60 * 60 * 1000), // 8時間後
        notes: `運行終了${i + 1}`
      });
    }
    
    const endTime = Date.now();
    
    console.log("✓ 複数運行作成完了:", {
      count: operations.length,
      elapsedTime: `${endTime - startTime}ms`
    });
    console.log("");

    // 18. 大量データ取得のパフォーマンス
    console.log("18. 大量データ取得パフォーマンステスト");
    
    const fetchStart = Date.now();
    const allTrips = await tripService.getAllTrips({
      page: 1,
      limit: 100
    });
    const fetchEnd = Date.now();
    
    console.log("✓ 大量データ取得完了:", {
      totalRecords: allTrips.total,
      fetchTime: `${fetchEnd - fetchStart}ms`
    });
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