import { VehicleService } from "../src/services/vehicleService";
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
  vehicles: any[];
  operations: any[];
  maintenanceRecords: any[];
}

let testData: TestData = {
  adminUser: null,
  managerUser: null,
  driverUser: null,
  vehicles: [],
  operations: [],
  maintenanceRecords: []
};

const vehicleService = new VehicleService();

async function createTestUsers() {
  console.log("=== テストユーザー作成 ===");
  
  // 管理者ユーザー作成
  testData.adminUser = await authService.createUser({
    username: "testadmin_v",
    email: "testadmin_v@example.com",
    password: "password123",
    name: "テスト管理者（車両）",
    role: "ADMIN",
    isActive: true
  }, "system");
  
  console.log("✓ 管理者ユーザー作成完了:", testData.adminUser.username);

  // マネージャーユーザー作成
  testData.managerUser = await authService.createUser({
    username: "testmanager_v",
    email: "testmanager_v@example.com",
    password: "password123",
    name: "テストマネージャー（車両）",
    role: "MANAGER",
    isActive: true
  }, "system");
  
  console.log("✓ マネージャーユーザー作成完了:", testData.managerUser.username);

  // 運転手ユーザー作成
  testData.driverUser = await authService.createUser({
    username: "testdriver_v",
    email: "testdriver_v@example.com",
    password: "password123",
    name: "テスト運転手（車両）",
    role: "DRIVER",
    isActive: true
  }, "system");
  
  console.log("✓ 運転手ユーザー作成完了:", testData.driverUser.username);
  console.log("");
}

async function createTestVehicles() {
  console.log("=== テスト車両作成 ===");
  
  // 車両1作成
  const vehicle1 = await vehicleService.createVehicle({
    plate_number: "TEST-V001",
    model: "テストトラック1",
    manufacturer: "テストメーカー1",
    year: 2023,
    capacity: 10.5,
    fuelType: "DIESEL"
  }, testData.adminUser.id);
  testData.vehicles.push(vehicle1);
  
  console.log("✓ テスト車両1作成完了:", vehicle1.plate_number);

  // 車両2作成
  const vehicle2 = await vehicleService.createVehicle({
    plate_number: "TEST-V002",
    model: "テストトラック2",
    manufacturer: "テストメーカー2",
    year: 2022,
    capacity: 8.0,
    fuelType: "GASOLINE"
  }, testData.adminUser.id);
  testData.vehicles.push(vehicle2);
  
  console.log("✓ テスト車両2作成完了:", vehicle2.plate_number);

  // 車両3作成（統計テスト用）
  const vehicle3 = await vehicleService.createVehicle({
    plate_number: "TEST-V003",
    model: "テストトラック3",
    manufacturer: "テストメーカー1",
    year: 2021,
    capacity: 12.0,
    fuelType: "DIESEL"
  }, testData.adminUser.id);
  testData.vehicles.push(vehicle3);
  
  console.log("✓ テスト車両3作成完了:", vehicle3.plate_number);
  console.log("");
}

async function createTestOperations() {
  console.log("=== テスト運行記録作成 ===");
  
  // 運行記録1作成（車両1用、完了状態）
  const operation1 = await prisma.operation.create({
    data: {
      vehicleId: testData.vehicles[0].id,
      driverId: testData.driverUser.id,
      operationNumber: "OP-TEST-001",
      status: "COMPLETED",
      actualStartTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1日前
      actualEndTime: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20時間前
      totalDistanceKm: 150.5,
      fuelConsumedLiters: 25.8,
      fuelCostYen: 3500,
      startOdometer: 1000.0
    }
  });
  testData.operations.push(operation1);
  
  console.log("✓ テスト運行記録1作成完了:", operation1.operationNumber);

  // 運行記録2作成（車両1用、完了状態）
  const operation2 = await prisma.operation.create({
    data: {
      vehicleId: testData.vehicles[0].id,
      driverId: testData.driverUser.id,
      operationNumber: "OP-TEST-002",
      status: "COMPLETED",
      actualStartTime: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12時間前
      actualEndTime: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8時間前
      totalDistanceKm: 200.0,
      fuelConsumedLiters: 35.2,
      fuelCostYen: 4800,
      startOdometer: 1150.5
    }
  });
  testData.operations.push(operation2);
  
  console.log("✓ テスト運行記録2作成完了:", operation2.operationNumber);

  // 運行記録3作成（車両2用、進行中状態）
  const operation3 = await prisma.operation.create({
    data: {
      vehicleId: testData.vehicles[1].id,
      driverId: testData.driverUser.id,
      operationNumber: "OP-TEST-003",
      status: "IN_PROGRESS",
      actualStartTime: new Date(),
      plannedEndTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4時間後
      startOdometer: 500.0,
      startFuelLevel: 80.0
    }
  });
  testData.operations.push(operation3);
  
  console.log("✓ テスト運行記録3作成完了:", operation3.operationNumber);
  console.log("");
}

async function createTestMaintenanceRecords() {
  console.log("=== テストメンテナンス記録作成 ===");
  
  // メンテナンス記録1作成
  const maintenance1 = await prisma.maintenanceRecord.create({
    data: {
      vehicleId: testData.vehicles[0].id,
      maintenanceType: "INSPECTION",
      scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1週間前
      completedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      cost: 15000,
      description: "定期点検実施",
      isCompleted: true,
      createdBy: testData.adminUser.id
    }
  });
  testData.maintenanceRecords.push(maintenance1);
  
  console.log("✓ テストメンテナンス記録1作成完了");

  // メンテナンス記録2作成
  const maintenance2 = await prisma.maintenanceRecord.create({
    data: {
      vehicleId: testData.vehicles[0].id,
      maintenanceType: "REPAIR",
      scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3日前
      cost: 25000,
      description: "ブレーキパッド交換",
      isCompleted: false,
      createdBy: testData.adminUser.id
    }
  });
  testData.maintenanceRecords.push(maintenance2);
  
  console.log("✓ テストメンテナンス記録2作成完了");
  console.log("");
}

async function cleanupTestData() {
  console.log("=== テストデータクリーンアップ ===");
  
  try {
    // メンテナンス記録削除
    await prisma.maintenanceRecord.deleteMany({
      where: { 
        OR: [
          { createdBy: testData.adminUser?.id },
          { createdBy: testData.managerUser?.id },
          { createdBy: testData.driverUser?.id }
        ]
      }
    });

    // 運行記録削除
    await prisma.operation.deleteMany({
      where: { 
        operationNumber: { startsWith: "OP-TEST-" }
      }
    });

    // 車両削除
    await prisma.vehicle.deleteMany({
      where: { plateNumber: { startsWith: "TEST-V" } }
    });

    // ユーザー削除
    await prisma.user.deleteMany({
      where: { username: { contains: "_v" } }
    });

    console.log("✓ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("クリーンアップエラー:", error);
  }
}

async function main() {
  console.log("=== VehicleService テスト開始 ===\n");

  try {
    // テスト前クリーンアップ
    await cleanupTestData();

    // ========================================
    // テストデータ準備
    // ========================================
    await createTestUsers();
    await createTestVehicles();
    await createTestOperations();
    await createTestMaintenanceRecords();

    // ========================================
    // 1. 車両一覧取得テスト
    // ========================================
    console.log("1. 車両一覧取得テスト");
    
    const vehiclesList = await vehicleService.getVehicles({
      page: 1,
      limit: 10
    });
    
    console.log("✓ 車両一覧取得成功:", {
      totalVehicles: vehiclesList.total,
      currentPage: vehiclesList.page,
      vehiclesInPage: vehiclesList.data.length
    });
    console.log("");

    // ========================================
    // 2. 検索条件付き車両一覧取得テスト
    // ========================================
    console.log("2. 検索条件付き車両一覧取得テスト");
    
    const filteredVehicles = await vehicleService.getVehicles({
      page: 1,
      limit: 10,
      search: "テストトラック1",
      manufacturer: "テストメーカー1"
    });
    
    console.log("✓ 検索条件付き車両一覧取得成功:", {
      totalVehicles: filteredVehicles.total,
      filteredCount: filteredVehicles.data.length
    });
    console.log("");

    // ========================================
    // 3. 車両詳細取得テスト
    // ========================================
    console.log("3. 車両詳細取得テスト");
    
    const vehicleDetail = await vehicleService.getVehicleById(testData.vehicles[0].id);
    
    console.log("✓ 車両詳細取得成功:", {
      id: vehicleDetail.id,
      plateNumber: vehicleDetail.plate_number,
      recentTripsCount: vehicleDetail.recentTrips?.length || 0,
      maintenanceHistoryCount: vehicleDetail.maintenanceHistory?.length || 0
    });
    console.log("");

    // ========================================
    // 4. 車両作成テスト
    // ========================================
    console.log("4. 車両作成テスト");
    
    const newVehicle = await vehicleService.createVehicle({
      plate_number: "TEST-V999",
      model: "新規テスト車両",
      manufacturer: "新規メーカー",
      year: 2024,
      capacity: 15.0,
      fuelType: "ELECTRIC"
    }, testData.adminUser.id);
    testData.vehicles.push(newVehicle);
    
    console.log("✓ 車両作成成功:", {
      id: newVehicle.id,
      plateNumber: newVehicle.plate_number,
      status: newVehicle.status
    });
    console.log("");

    // ========================================
    // 5. 車両情報更新テスト
    // ========================================
    console.log("5. 車両情報更新テスト");
    
    const updatedVehicle = await vehicleService.updateVehicle(newVehicle.id, {
      model: "更新されたテスト車両",
      capacity: 20.0,
      year: 2025
    });
    
    console.log("✓ 車両情報更新成功:", {
      id: updatedVehicle.id,
      model: updatedVehicle.model,
      capacity: updatedVehicle.capacity
    });
    console.log("");

    // ========================================
    // 6. 車両ステータス更新テスト
    // ========================================
    console.log("6. 車両ステータス更新テスト");
    
    const statusUpdatedVehicle = await vehicleService.updateVehicleStatus(
      testData.vehicles[2].id,
      "MAINTENANCE"
    );
    
    console.log("✓ 車両ステータス更新成功:", {
      id: statusUpdatedVehicle.id,
      status: statusUpdatedVehicle.status
    });
    console.log("");

    // ========================================
    // 7. 利用可能車両一覧取得テスト
    // ========================================
    console.log("7. 利用可能車両一覧取得テスト");
    
    const availableVehicles = await vehicleService.getAvailableVehicles();
    
    console.log("✓ 利用可能車両一覧取得成功:", {
      availableCount: availableVehicles.length
    });
    console.log("");

    // ========================================
    // 8. 車両統計情報取得テスト
    // ========================================
    console.log("8. 車両統計情報取得テスト");
    
    const vehicleStats = await vehicleService.getVehicleStats(testData.vehicles[0].id);
    
    console.log("✓ 車両統計情報取得成功:", {
      vehicleId: testData.vehicles[0].id,
      totalTrips: vehicleStats.statistics.totalTrips,
      totalDistance: vehicleStats.statistics.totalDistance,
      fuelEfficiency: vehicleStats.statistics.fuelEfficiency
    });
    console.log("");

    // ========================================
    // 9. 車両タイプ一覧取得テスト
    // ========================================
    console.log("9. 車両タイプ一覧取得テスト");
    
    const vehicleTypes = await vehicleService.getVehicleTypes();
    
    console.log("✓ 車両タイプ一覧取得成功:", {
      typesCount: vehicleTypes.length
    });
    console.log("");

    // ========================================
    // 10. 車両メーカー一覧取得テスト
    // ========================================
    console.log("10. 車両メーカー一覧取得テスト");
    
    const manufacturers = await vehicleService.getVehicleManufacturers();
    
    console.log("✓ 車両メーカー一覧取得成功:", {
      manufacturersCount: manufacturers.length
    });
    console.log("");

    // ========================================
    // 11. 車両の運行履歴取得テスト
    // ========================================
    console.log("11. 車両の運行履歴取得テスト");
    
    const vehicleTrips = await vehicleService.getVehicleTrips(testData.vehicles[0].id, 5);
    
    console.log("✓ 車両の運行履歴取得成功:", {
      vehicleId: testData.vehicles[0].id,
      tripsCount: vehicleTrips.length
    });
    console.log("");

    // ========================================
    // 12. 車両検索テスト
    // ========================================
    console.log("12. 車両検索テスト");
    
    const searchResults = await vehicleService.searchVehicles("TEST-V", 5);
    
    console.log("✓ 車両検索成功:", {
      query: "TEST-V",
      resultsCount: searchResults.length
    });
    console.log("");

    // ========================================
    // 13. メンテナンス記録追加テスト
    // ========================================
    console.log("13. メンテナンス記録追加テスト");
    
    const newMaintenanceRecord = await vehicleService.addMaintenanceRecord(
      testData.vehicles[0].id,
      {
        inspectionType: "MONTHLY",
        status: "PASS",
        notes: "テスト点検完了",
        nextDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日後
      },
      testData.adminUser.id
    );
    testData.maintenanceRecords.push(newMaintenanceRecord);
    
    console.log("✓ メンテナンス記録追加成功:", {
      id: newMaintenanceRecord.id,
      maintenanceType: newMaintenanceRecord.maintenanceType
    });
    console.log("");

    // ========================================
    // 14. メンテナンス履歴取得テスト
    // ========================================
    console.log("14. メンテナンス履歴取得テスト");
    
    const maintenanceHistory = await vehicleService.getMaintenanceHistory(testData.vehicles[0].id, 10);
    
    console.log("✓ メンテナンス履歴取得成功:", {
      vehicleId: testData.vehicles[0].id,
      historyCount: maintenanceHistory.length
    });
    console.log("");

    // ========================================
    // 15. 車両ステータス一括更新テスト
    // ========================================
    console.log("15. 車両ステータス一括更新テスト");
    
    const bulkUpdateResult = await vehicleService.bulkUpdateVehicleStatus(
      [testData.vehicles[1].id, testData.vehicles[2].id],
      "MAINTENANCE",
      testData.adminUser.id,
      "ADMIN"
    );
    
    console.log("✓ 車両ステータス一括更新成功:", {
      updatedCount: bulkUpdateResult.updatedCount,
      message: bulkUpdateResult.message
    });
    console.log("");

    // ========================================
    // 16. 車両燃費分析テスト
    // ========================================
    console.log("16. 車両燃費分析テスト");
    
    const fuelAnalysis = await vehicleService.getVehicleFuelAnalysis(testData.vehicles[0].id);
    
    console.log("✓ 車両燃費分析成功:", {
      vehicleId: testData.vehicles[0].id,
      totalTrips: fuelAnalysis.overallStatistics.totalTrips,
      averageFuelEfficiency: fuelAnalysis.overallStatistics.averageFuelEfficiency,
      monthlyDataCount: fuelAnalysis.monthlyAnalysis.length
    });
    console.log("");

    // ========================================
    // 17. メンテナンス予定車両取得テスト
    // ========================================
    console.log("17. メンテナンス予定車両取得テスト");
    
    const vehiclesDue = await vehicleService.getVehiclesDueForMaintenance(90);
    
    console.log("✓ メンテナンス予定車両取得成功:", {
      dueVehiclesCount: vehiclesDue.length
    });
    console.log("");

    // ========================================
    // 18. 車両利用率レポート取得テスト
    // ========================================
    console.log("18. 車両利用率レポート取得テスト");
    
    const utilizationReport = await vehicleService.getVehicleUtilizationReport();
    
    console.log("✓ 車両利用率レポート取得成功:", {
      reportItemsCount: utilizationReport.length
    });
    console.log("");

    // ========================================
    // エラーケーステスト
    // ========================================
    console.log("=== エラーケーステスト ===");

    // 19. 存在しない車両詳細取得エラー
    console.log("19. 存在しない車両詳細取得エラーテスト");
    try {
      await vehicleService.getVehicleById("nonexistent-id");
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 20. 重複車番作成エラー
    console.log("20. 重複車番作成エラーテスト");
    try {
      await vehicleService.createVehicle({
        plate_number: "TEST-V001", // 既に存在する車番
        model: "重複テスト車両",
        manufacturer: "テストメーカー",
        year: 2024,
        fuelType: "GASOLINE"
      }, testData.adminUser.id);
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 21. 権限違反エラー（運転手が車両削除）
    console.log("21. 権限違反エラーテスト");
    try {
      await vehicleService.deleteVehicle(
        testData.vehicles[0].id,
        testData.driverUser.id,
        "DRIVER"
      );
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 22. 進行中運行がある車両の削除エラー
    console.log("22. 進行中運行がある車両の削除エラーテスト");
    try {
      await vehicleService.deleteVehicle(
        testData.vehicles[1].id, // 進行中の運行がある車両
        testData.adminUser.id,
        "ADMIN"
      );
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 23. 存在しない車両の統計取得エラー
    console.log("23. 存在しない車両の統計取得エラーテスト");
    try {
      await vehicleService.getVehicleStats("nonexistent-vehicle-id");
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 24. 存在しない点検者でのメンテナンス記録追加エラー
    console.log("24. 存在しない点検者でのメンテナンス記録追加エラーテスト");
    try {
      await vehicleService.addMaintenanceRecord(
        testData.vehicles[0].id,
        {
          inspectionType: "DAILY",
          status: "PASS",
          notes: "テスト点検"
        },
        "nonexistent-inspector-id"
      );
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 25. 権限不足での一括更新エラー
    console.log("25. 権限不足での一括更新エラーテスト");
    try {
      await vehicleService.bulkUpdateVehicleStatus(
        [testData.vehicles[0].id],
        "RETIRED",
        testData.driverUser.id,
        "DRIVER"
      );
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
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