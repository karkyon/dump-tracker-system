import * as inspectionController from "../../src/controllers/inspectionController";
import { authService } from "../../src/services/authService";
import { $Enums, PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../../src/types/auth";

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
      return this; // 重要: thisを返す
    }
  };
  return res as any;
};

// モックリクエストオブジェクトの作成
const createMockRequest = (user: any, params: any = {}, query: any = {}, body: any = {}): AuthenticatedRequest => {
  return {
    user,
    params,
    query,
    body,
    headers: {},
    method: 'GET',
    url: '',
    path: ''
  } as AuthenticatedRequest;
};

// モックnext関数の作成
const createMockNext = () => {
  return (error?: any) => {
    if (error) {
      throw error;
    }
  };
};

async function createTestUsers() {
  console.log("=== テストユーザー作成 ===");
  
  // 管理者ユーザー作成
  testData.adminUser = await authService.createUser({
    username: "testadmin_ctrl",
    email: "testadmin_ctrl@example.com",
    password: "password123",
    name: "テスト管理者（コントローラー）",
    role: "ADMIN",
    isActive: true
  }, "system");
  
  console.log("✓ 管理者ユーザー作成完了:", testData.adminUser.username);

  // マネージャーユーザー作成
  testData.managerUser = await authService.createUser({
    username: "testmanager_ctrl",
    email: "testmanager_ctrl@example.com",
    password: "password123",
    name: "テストマネージャー（コントローラー）",
    role: "MANAGER",
    isActive: true
  }, "system");
  
  console.log("✓ マネージャーユーザー作成完了:", testData.managerUser.username);

  // 運転手ユーザー作成
  testData.driverUser = await authService.createUser({
    username: "testdriver_ctrl",
    email: "testdriver_ctrl@example.com",
    password: "password123",
    name: "テスト運転手（コントローラー）",
    role: "DRIVER",
    isActive: true
  }, "system");
  
  console.log("✓ 運転手ユーザー作成完了:", testData.driverUser.username);
  console.log("");
}

async function createTestVehicle() {
  console.log("=== テスト車両作成 ===");
  
  testData.vehicle = await prisma.vehicle.create({
    data: {
      plateNumber: "TEST-CTRL-001",
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
  console.log("");
}

async function createTestOperation() {
  console.log("=== テスト運行記録作成 ===");
  
  testData.operation = await prisma.operation.create({
    data: {
      vehicleId: testData.vehicle.id,
      driverId: testData.driverUser.id,
      status: "IN_PROGRESS",
      actualStartTime: new Date(),
      plannedEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
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
        name: { contains: "テストコントローラー" }
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
      where: { username: { contains: "_ctrl" } }
    });

    console.log("✓ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("クリーンアップエラー:", error);
  }
}

async function main() {
  console.log("=== InspectionController テスト開始 ===\n");

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
    // 1. 点検項目作成テスト (createInspectionItem)
    // ========================================
    console.log("1. 点検項目作成テスト (createInspectionItem)");
    
    const req1 = createMockRequest(
      testData.adminUser,
      {},
      {},
      {
        name: "テストコントローラーエンジンオイル",
        description: "エンジンオイルの量と汚れをチェック",
        inspection_type: "PRE_TRIP",
        input_type: "CHECKBOX",
        category: "エンジン",
        is_required: true,
        display_order: 10
      }
    );
    const res1 = createMockResponse();
    const next1 = createMockNext();

    try {
      await inspectionController.createInspectionItem(req1, res1, next1);
      
      console.log("レスポンスステータス:", res1.statusCode);
      console.log("レスポンスデータ:", res1.jsonData);
      
      if (res1.statusCode === 201 && res1.jsonData && res1.jsonData.success) {
        console.log("✓ 点検項目作成成功:", res1.jsonData.data.name);
        testData.inspectionItems.push(res1.jsonData.data);
      } else {
        console.log("✗ 点検項目作成失敗 - ステータス:", res1.statusCode, "データ:", res1.jsonData);
      }
    } catch (error) {
      console.log("✗ 点検項目作成でエラー:", error);
      console.log("エラー詳細:", (error as Error).message);
      console.log("スタック:", (error as Error).stack);
    }
    console.log("");

    // ========================================
    // 2. 点検項目一覧取得テスト (getAllInspectionItems)
    // ========================================
    console.log("2. 点検項目一覧取得テスト (getAllInspectionItems)");
    
    const req2 = createMockRequest(
      testData.driverUser,
      {},
      {
        page: 1,
        limit: 10,
        inspection_type: "PRE_TRIP",
        is_active: 'true'
      }
    );
    const res2 = createMockResponse();
    const next2 = createMockNext();

    try {
      await inspectionController.getAllInspectionItems(req2, res2, next2);
      
      console.log("レスポンスステータス:", res2.statusCode);
      console.log("レスポンスデータ:", res2.jsonData);
      
      if (res2.statusCode === 200 && res2.jsonData && res2.jsonData.success) {
        console.log("✓ 点検項目一覧取得成功:", {
          itemsCount: res2.jsonData.data.items.length,
          total: res2.jsonData.data.pagination.total
        });
      } else {
        console.log("✗ 点検項目一覧取得失敗 - ステータス:", res2.statusCode, "データ:", res2.jsonData);
      }
    } catch (error) {
      console.log("✗ 点検項目一覧取得でエラー:", error);
      console.log("エラー詳細:", (error as Error).message);
      console.log("スタック:", (error as Error).stack);
    }
    console.log("");

    // ========================================
    // 3. 点検項目詳細取得テスト (getInspectionItemById)
    // ========================================
    console.log("3. 点検項目詳細取得テスト (getInspectionItemById)");
    
    if (testData.inspectionItems.length > 0) {
      const req3 = createMockRequest(
        testData.driverUser,
        { id: testData.inspectionItems[0].id }
      );
      const res3 = createMockResponse();
      const next3 = createMockNext();

      await inspectionController.getInspectionItemById(req3, res3, next3);
      
      if (res3.statusCode === 200 && res3.jsonData.success) {
        console.log("✓ 点検項目詳細取得成功:", res3.jsonData.data.name);
      } else {
        console.log("✗ 点検項目詳細取得失敗:", res3.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 4. 点検項目更新テスト (updateInspectionItem)
    // ========================================
    console.log("4. 点検項目更新テスト (updateInspectionItem)");
    
    if (testData.inspectionItems.length > 0) {
      const req4 = createMockRequest(
        testData.managerUser,
        { id: testData.inspectionItems[0].id },
        {},
        {
          description: "更新されたエンジンオイルの量と汚れをチェック",
          display_order: 15
        }
      );
      const res4 = createMockResponse();
      const next4 = createMockNext();

      await inspectionController.updateInspectionItem(req4, res4, next4);
      
      if (res4.statusCode === 200 && res4.jsonData.success) {
        console.log("✓ 点検項目更新成功:", res4.jsonData.data.description);
      } else {
        console.log("✗ 点検項目更新失敗:", res4.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 5. 点検記録作成テスト (createInspectionRecord)
    // ========================================
    console.log("5. 点検記録作成テスト (createInspectionRecord)");
    
    const req5 = createMockRequest(
      testData.driverUser,
      {},
      {},
      {
        vehicle_id: testData.vehicle.id,
        operation_id: testData.operation.id,
        inspection_type: "PRE_TRIP",
        latitude: 35.6762,
        longitude: 139.6503,
        location_name: "東京テスト現場",
        weather_condition: "晴れ",
        temperature: 25.0
      }
    );
    const res5 = createMockResponse();
    const next5 = createMockNext();

    await inspectionController.createInspectionRecord(req5, res5, next5);
    
    if (res5.statusCode === 201 && res5.jsonData.success) {
      console.log("✓ 点検記録作成成功:", {
        id: res5.jsonData.data.id,
        inspectionType: res5.jsonData.data.inspectionType
      });
      testData.inspectionRecords.push(res5.jsonData.data);
    } else {
      console.log("✗ 点検記録作成失敗:", res5.jsonData);
    }
    console.log("");

    // ========================================
    // 6. 点検記録一覧取得テスト (getAllInspectionRecords)
    // ========================================
    console.log("6. 点検記録一覧取得テスト (getAllInspectionRecords)");
    
    const req6 = createMockRequest(
      testData.driverUser,
      {},
      {
        page: 1,
        limit: 10,
        vehicle_id: testData.vehicle.id,
        inspection_type: "PRE_TRIP"
      }
    );
    const res6 = createMockResponse();
    const next6 = createMockNext();

    await inspectionController.getAllInspectionRecords(req6, res6, next6);
    
    if (res6.statusCode === 200 && res6.jsonData && res6.jsonData.success) {
      console.log("✓ 点検記録一覧取得成功:", {
        recordsCount: res6.jsonData.data.records.length,
        total: res6.jsonData.data.pagination.total
      });
    } else {
      console.log("✗ 点検記録一覧取得失敗:", res6.jsonData);
    }
    console.log("");

    // ========================================
    // 7. 点検記録詳細取得テスト (getInspectionRecordById)
    // ========================================
    console.log("7. 点検記録詳細取得テスト (getInspectionRecordById)");
    
    if (testData.inspectionRecords.length > 0) {
      const req7 = createMockRequest(
        testData.driverUser,
        { id: testData.inspectionRecords[0].id }
      );
      const res7 = createMockResponse();
      const next7 = createMockNext();

      await inspectionController.getInspectionRecordById(req7, res7, next7);
      
      if (res7.statusCode === 200 && res7.jsonData.success) {
        console.log("✓ 点検記録詳細取得成功:", {
          id: res7.jsonData.data.id,
          status: res7.jsonData.data.status
        });
      } else {
        console.log("✗ 点検記録詳細取得失敗:", res7.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 8. 点検記録更新テスト (updateInspectionRecord)
    // ========================================
    console.log("8. 点検記録更新テスト (updateInspectionRecord)");
    
    if (testData.inspectionRecords.length > 0) {
      const req8 = createMockRequest(
        testData.driverUser,
        { id: testData.inspectionRecords[0].id },
        {},
        {
          status: "COMPLETED",
          overallResult: true,
          overallNotes: "すべて正常です"
        }
      );
      const res8 = createMockResponse();
      const next8 = createMockNext();

      await inspectionController.updateInspectionRecord(req8, res8, next8);
      
      if (res8.statusCode === 200 && res8.jsonData.success) {
        console.log("✓ 点検記録更新成功:", {
          status: res8.jsonData.data.status
        });
      } else {
        console.log("✗ 点検記録更新失敗:", res8.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 9. 点検統計取得テスト (getInspectionStatistics)
    // ========================================
    console.log("9. 点検統計取得テスト (getInspectionStatistics)");
    
    const req9 = createMockRequest(
      testData.managerUser,
      { vehicleId: testData.vehicle.id },
      { period: '30' }
    );
    const res9 = createMockResponse();
    const next9 = createMockNext();

    await inspectionController.getInspectionStatistics(req9, res9, next9);
    
    if (res9.statusCode === 200 && res9.jsonData && res9.jsonData.success) {
      console.log("✓ 点検統計取得成功:", {
        totalRecords: res9.jsonData.data.totalRecords,
        completionRate: res9.jsonData.data.completionRate
      });
    } else {
      console.log("✗ 点検統計取得失敗:", res9.jsonData);
    }
    console.log("");

    // ========================================
    // エラーケーステスト
    // ========================================
    console.log("=== エラーケーステスト ===");

    // 10. 認証なしエラーテスト
    console.log("10. 認証なしエラーテスト");
    try {
      const req10 = createMockRequest(null); // ユーザーなし
      const res10 = createMockResponse();
      const next10 = createMockNext();

      await inspectionController.getAllInspectionItems(req10, res10, next10);
      
      if (res10.statusCode === 401) {
        console.log("✓ 期待通り認証エラー:", res10.jsonData.message);
      } else {
        console.log("✗ 認証エラーが発生すべきでした");
      }
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 11. 権限不足エラーテスト（運転手が点検項目作成）
    console.log("11. 権限不足エラーテスト");
    try {
      const req11 = createMockRequest(
        testData.driverUser, // 運転手ユーザー
        {},
        {},
        {
          name: "権限テスト項目",
          inspection_type: "PRE_TRIP",
          input_type: "CHECKBOX"
        }
      );
      const res11 = createMockResponse();
      const next11 = createMockNext();

      await inspectionController.createInspectionItem(req11, res11, next11);
      
      if (res11.statusCode === 403) {
        console.log("✓ 期待通り権限エラー:", res11.jsonData.message);
      } else {
        console.log("✗ 権限エラーが発生すべきでした");
      }
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 12. 存在しない項目取得エラー
    console.log("12. 存在しない項目取得エラー");
    try {
      const req12 = createMockRequest(
        testData.driverUser,
        { id: "550e8400-e29b-41d4-a716-446655440000" }  // ← 有効なUUID形式
      );
      const res12 = createMockResponse();
      const next12 = createMockNext();

      await inspectionController.getInspectionItemById(req12, res12, next12);
      
      if (res12.statusCode === 404) {
        console.log("✓ 期待通り404エラー:", res12.jsonData.message);
      } else {
        console.log("✗ 404エラーが発生すべきでした");
      }
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 13. 必須フィールド不足エラー
    console.log("13. 必須フィールド不足エラー");
    try {
      const req13 = createMockRequest(
        testData.driverUser,
        {},
        {},
        {
          // vehicle_idが不足
          inspection_type: "PRE_TRIP"
        }
      );
      const res13 = createMockResponse();
      const next13 = createMockNext();

      await inspectionController.createInspectionRecord(req13, res13, next13);
      
      if (res13.statusCode === 400) {
        console.log("✓ 期待通り400エラー:", res13.jsonData.message);
      } else {
        console.log("✗ 400エラーが発生すべきでした");
      }
    } catch (error) {
      console.log("✓ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 14. 管理者のみ削除権限テスト
    console.log("14. 管理者のみ削除権限テスト");
    if (testData.inspectionItems.length > 0) {
      // マネージャーが削除を試行（失敗するはず）
      try {
        const req14a = createMockRequest(
          testData.managerUser,
          { id: testData.inspectionItems[0].id }
        );
        const res14a = createMockResponse();
        const next14a = createMockNext();

        await inspectionController.deleteInspectionItem(req14a, res14a, next14a);
        
        if (res14a.statusCode === 403) {
          console.log("✓ マネージャーには削除権限なし:", res14a.jsonData.message);
        } else {
          console.log("✗ マネージャーの削除は失敗すべきでした");
        }
      } catch (error) {
        console.log("✓ 期待通りエラー:", (error as Error).message);
      }

      // 管理者が削除を試行（成功するはず）
      try {
        const req14b = createMockRequest(
          testData.adminUser,
          { id: testData.inspectionItems[0].id }
        );
        const res14b = createMockResponse();
        const next14b = createMockNext();

        await inspectionController.deleteInspectionItem(req14b, res14b, next14b);
        
        if (res14b.statusCode === 200) {
          console.log("✓ 管理者による削除成功");
        } else {
          console.log("✗ 管理者の削除が失敗しました:", res14b.jsonData);
        }
      } catch (error) {
        console.log("管理者削除エラー:", (error as Error).message);
      }
    }
    console.log("");

    // 15. 運転手が他人の記録を参照（権限エラー）
    console.log("15. 運転手権限制限テスト");
    if (testData.inspectionRecords.length > 0) {
      // 別の運転手ユーザー作成
      const anotherDriver = await authService.createUser({
        username: "testdriver2_ctrl",
        email: "testdriver2_ctrl@example.com",
        password: "password123",
        name: "テスト運転手2（コントローラー）",
        role: "DRIVER",
        isActive: true
      }, "system");

      try {
        const req15 = createMockRequest(
          anotherDriver, // 別の運転手
          { id: testData.inspectionRecords[0].id }
        );
        const res15 = createMockResponse();
        const next15 = createMockNext();

        await inspectionController.getInspectionRecordById(req15, res15, next15);
        
        if (res15.statusCode === 403) {
          console.log("✓ 他人の記録へのアクセス権限なし:", res15.jsonData.message);
        } else {
          console.log("✗ 権限エラーが発生すべきでした");
        }
      } catch (error) {
        console.log("✓ 期待通りエラー:", (error as Error).message);
      }

      // 作成したユーザーをクリーンアップ
      await prisma.user.delete({ where: { id: anotherDriver.id } });
    }
    console.log("");

    console.log("=== すべてのコントローラーテストが完了しました ===");

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