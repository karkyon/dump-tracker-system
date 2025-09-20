import { InspectionService } from "../../src/services/inspectionService";
import { authService } from "../../src/services/authService";
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
  inspectionItems: any[];
  inspectionRecords: any[];
}

let testData: TestData = {
  adminUser: null,
  managerUser: null,
  driverUser: null,
  vehicle: null,
  operation: null,
  inspectionItems: [],
  inspectionRecords: []
};

const inspectionService = new InspectionService();

async function createTestUsers() {
  console.log("=== テストユーザー作成 ===");
  
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
  console.log("");
}

async function createTestVehicle() {
  console.log("=== テスト車両作成 ===");
  
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
  
  console.log("✓ テスト車両作成完了:", testData.vehicle.vehicleNumber);
  console.log("");
}

async function createTestOperation() {
  console.log("=== テスト運行記録作成 ===");
  
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
  console.log("");
}

async function cleanupTestData() {
  console.log("=== テストデータクリーンアップ ===");
  
  try {
    // 点検記録削除
    await prisma.inspectionRecord.deleteMany({
      where: { 
        OR: [
          { inspectorId: testData.driverUser?.id },
          { inspectorId: testData.managerUser?.id },
          { inspectorId: testData.adminUser?.id }
        ]
      }
    });

    // 点検項目削除
    await prisma.inspectionItem.deleteMany({
      where: { 
        name: { contains: "テスト" }
      }
    });

    // 運行記録削除
    if (testData.operation) {
      await prisma.operation.deleteMany({
        where: { id: testData.operation.id }
      });
    }

    // 車両削除
    if (testData.vehicle) {
      await prisma.vehicle.deleteMany({
        where: { id: testData.vehicle.id }
      });
    }

    // ユーザー削除
    await prisma.user.deleteMany({
      where: { username: { startsWith: "test" } }
    });

    console.log("✓ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("クリーンアップエラー:", error);
  }
}

async function main() {
  console.log("=== InspectionService テスト開始 ===\n");

  try {
    // テスト前クリーンアップ
    await cleanupTestData();

    // ========================================
    // テストデータ準備
    // ========================================
    await createTestUsers();
    await createTestVehicle();
    await createTestOperation();

    // ========================================
    // 1. 点検項目作成テスト
    // ========================================
    console.log("1. 点検項目作成テスト");
    
    // 乗車前点検項目作成
    const inspectionItem1 = await inspectionService.createInspectionItem({
      name: "テストエンジンオイル",
      inspectionType: "PRE_TRIP",
      inputType: "CHECKBOX",
      description: "エンジンオイルの量と汚れをチェック",
      displayOrder: 10,
      isRequired: true
    });
    testData.inspectionItems.push(inspectionItem1);
    
    console.log("✓ 乗車前点検項目作成成功:", inspectionItem1.name);

    // 乗車後点検項目作成
    const inspectionItem2 = await inspectionService.createInspectionItem({
      name: "テストタイヤ摩耗",
      inspectionType: "POST_TRIP",
      inputType: "TEXT",
      description: "タイヤの摩耗状況を記録",
      displayOrder: 20,
      isRequired: false
    });
    testData.inspectionItems.push(inspectionItem2);
    
    console.log("✓ 乗車後点検項目作成成功:", inspectionItem2.name);
    console.log("");

    // ========================================
    // 2. 点検項目一覧取得テスト
    // ========================================
    console.log("2. 点検項目一覧取得テスト");
    
    const itemsList = await inspectionService.getInspectionItems({
      page: 1,
      limit: 10,
      inspectionType: "PRE_TRIP",
      isActive: true
    });
    
    console.log("✓ 点検項目一覧取得成功:", {
      totalItems: itemsList.pagination.totalItems,
      currentPage: itemsList.pagination.currentPage
    });
    console.log("");

    // ========================================
    // 3. 点検項目詳細取得テスト
    // ========================================
    console.log("3. 点検項目詳細取得テスト");
    
    const itemDetail = await inspectionService.getInspectionItemById(inspectionItem1.id);
    
    console.log("✓ 点検項目詳細取得成功:", {
      id: itemDetail.id,
      name: itemDetail.name,
      inspectionType: itemDetail.inspectionType
    });
    console.log("");

    // ========================================
    // 4. 点検項目更新テスト
    // ========================================
    console.log("4. 点検項目更新テスト");
    
    const updatedItem = await inspectionService.updateInspectionItem(inspectionItem1.id, {
      description: "更新されたエンジンオイルの量と汚れをチェック",
      displayOrder: 15
    });
    
    console.log("✓ 点検項目更新成功:", {
      id: updatedItem.id,
      description: updatedItem.description
    });
    console.log("");

    // ========================================
    // 5. 点検記録作成テスト（運転手）
    // ========================================
    console.log("5. 点検記録作成テスト（運転手）");
    
    const inspectionRecord1 = await inspectionService.createInspectionRecord({
      vehicleId: testData.vehicle.id,
      inspectorId: testData.driverUser.id,
      inspectionType: "PRE_TRIP",
      operationId: testData.operation.id,
      status: "COMPLETED",
      overallResult: true,
      overallNotes: "全て正常です",
      vehicles: {
        create: undefined,
        connectOrCreate: undefined,
        connect: undefined
      },
      users: {
        create: undefined,
        connectOrCreate: undefined,
        connect: undefined
      }
    });
    testData.inspectionRecords.push(inspectionRecord1);
    
    console.log("✓ 点検記録作成成功:", {
      id: inspectionRecord1.id,
      inspectionType: inspectionRecord1.inspectionType,
      status: inspectionRecord1.status
    });
    console.log("");

    // ========================================
    // 6. 点検記録一覧取得テスト（運転手権限）
    // ========================================
    console.log("6. 点検記録一覧取得テスト（運転手権限）");
    
    const recordsList = await inspectionService.getInspectionRecords(
      {
        page: 1,
        limit: 10,
        inspectionType: "PRE_TRIP"
      },
      testData.driverUser.id,
      "DRIVER"
    );
    
    console.log("✓ 点検記録一覧取得成功（運転手）:", {
      totalItems: recordsList.pagination.totalItems,
      currentPage: recordsList.pagination.currentPage
    });
    console.log("");

    // ========================================
    // 7. 点検記録詳細取得テスト
    // ========================================
    console.log("7. 点検記録詳細取得テスト");
    
    const recordDetail = await inspectionService.getInspectionRecordById(
      inspectionRecord1.id,
      testData.driverUser.id,
      "DRIVER"
    );
    
    console.log("✓ 点検記録詳細取得成功:", {
      id: recordDetail.id,
      status: recordDetail.status,
      overallResult: recordDetail.overallResult
    });
    console.log("");

    // ========================================
    // 8. 点検記録更新テスト
    // ========================================
    console.log("8. 点検記録更新テスト");
    
    const updatedRecord = await inspectionService.updateInspectionRecord(
      inspectionRecord1.id,
      {
        overallNotes: "更新：全て正常、追加確認完了"
      },
      testData.driverUser.id,
      "DRIVER"
    );
    
    console.log("✓ 点検記録更新成功:", {
      id: updatedRecord.id,
      overallNotes: updatedRecord.overallNotes
    });
    console.log("");

    // ========================================
    // 9. 運行別点検記録取得テスト
    // ========================================
    console.log("9. 運行別点検記録取得テスト");
    
    const operationRecords = await inspectionService.getInspectionRecordsByOperation(
      testData.operation.id,
      testData.driverUser.id,
      "DRIVER"
    );
    
    console.log("✓ 運行別点検記録取得成功:", {
      recordsCount: operationRecords.length,
      operationId: testData.operation.id
    });
    console.log("");

    // ========================================
    // 10. 点検統計取得テスト
    // ========================================
    console.log("10. 点検統計取得テスト");
    
    const statistics = await inspectionService.getInspectionStatistics({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日前
      endDate: new Date().toISOString(),
      requesterId: testData.managerUser.id,
      requesterRole: "MANAGER"
    });
    
    console.log("✓ 点検統計取得成功:", {
      totalRecords: statistics.totalRecords,
      okRecords: statistics.okRecords,
      ngRecords: statistics.ngRecords,
      okRate: statistics.okRate
    });
    console.log("");

    // ========================================
    // 11. 点検テンプレート取得テスト
    // ========================================
    console.log("11. 点検テンプレート取得テスト");
    
    const template = await inspectionService.getInspectionTemplate("PRE_TRIP");
    
    console.log("✓ 点検テンプレート取得成功:", {
      itemsCount: template.length,
      inspectionType: "PRE_TRIP"
    });
    console.log("");

    // ========================================
    // 12. 点検項目表示順更新テスト
    // ========================================
    console.log("12. 点検項目表示順更新テスト");
    
    await inspectionService.updateInspectionItemOrder([
      { id: inspectionItem1.id, displayOrder: 5 },
      { id: inspectionItem2.id, displayOrder: 10 }
    ]);
    
    console.log("✓ 点検項目表示順更新成功");
    console.log("");

    // ========================================
    // エラーケーステスト
    // ========================================
    console.log("=== エラーケーステスト ===");

    // 13. 存在しない点検項目取得エラー
    console.log("13. 存在しない点検項目取得エラーテスト");
    try {
      await inspectionService.getInspectionItemById("nonexistent-id");
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 14. 重複点検項目作成エラー
    console.log("14. 重複点検項目作成エラーテスト");
    try {
      await inspectionService.createInspectionItem({
        name: "テストエンジンオイル", // 既に存在する名前
        inspectionType: "PRE_TRIP",
        inputType: "CHECKBOX"
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 15. 権限違反エラー（運転手が他人の記録を更新）
    console.log("15. 権限違反エラーテスト");
    try {
      // 管理者で点検記録作成
      const adminRecord = await inspectionService.createInspectionRecord({
        vehicleId: testData.vehicle.id,
        inspectorId: testData.adminUser.id,
        inspectionType: "POST_TRIP",
        status: "COMPLETED",
        overallResult: true,
        vehicles: {
          create: undefined,
          connectOrCreate: undefined,
          connect: undefined
        },
        users: {
          create: undefined,
          connectOrCreate: undefined,
          connect: undefined
        }
      });

      // 運転手が管理者の記録を更新しようとする
      await inspectionService.updateInspectionRecord(
        adminRecord.id,
        { overallNotes: "不正更新" },
        testData.driverUser.id,
        "DRIVER"
      );
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 16. 重複点検記録作成エラー
    console.log("16. 重複点検記録作成エラーテスト");
    try {
      await inspectionService.createInspectionRecord({
        vehicleId: testData.vehicle.id,
        inspectorId: testData.driverUser.id,
        inspectionType: "PRE_TRIP",
        operationId: testData.operation.id, // 同じ運行ID
        status: "COMPLETED",
        vehicles: {
          create: undefined,
          connectOrCreate: undefined,
          connect: undefined
        },
        users: {
          create: undefined,
          connectOrCreate: undefined,
          connect: undefined
        }
      });
      console.log("✗ エラーが発生すべきでした");
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 17. 必須フィールド不足エラー
    console.log("17. 必須フィールド不足エラーテスト");
    try {
      await inspectionService.createInspectionRecord({
        // vehicleIdが不足
        inspectorId: testData.driverUser.id,
        inspectionType: "PRE_TRIP",
        status: "COMPLETED"
      } as any);
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