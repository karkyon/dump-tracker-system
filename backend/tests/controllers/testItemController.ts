// テスト用コントローラーのインポート（asyncHandlerなし）
import * as itemController from "../../src/controllers/itemController";
import { authService } from "../../src/services/authService";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../../src/types/auth";

const prisma = new PrismaClient();

// 環境変数の設定（テスト用）
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-development-only';

// テスト用データ格納変数
interface TestData {
  adminUser: any;
  managerUser: any;
  driverUser: any;
  items: any[];
  vehicle: any;
  operation: any;
  operationDetails: any[];
}

let testData: TestData = {
  adminUser: null,
  managerUser: null,
  driverUser: null,
  items: [],
  vehicle: null,
  operation: null,
  operationDetails: []
};

// モックレスポンスオブジェクトの作成（修正版）
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
    },
    send: function(data: any) {
      this.jsonData = data;
      return this;
    },
    end: function() {
      return this;
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

// モックnext関数の作成（エラーハンドリング改善版）
const createMockNext = () => {
  const errors: any[] = [];
  const nextFn = (error?: any) => {
    if (error) {
      errors.push(error);
      console.log(`[NEXT] エラーがnext()に渡されました: ${error.message || error}`);
    }
  };
  nextFn.errors = errors;
  return nextFn;
};

async function createTestUsers(): Promise<void> {
  console.log("=== テストユーザー作成 ===");
  
  // 管理者ユーザー作成
  testData.adminUser = await authService.createUser({
    username: "testadmin_item_ctrl",
    email: "testadmin_item_ctrl@example.com",
    password: "password123",
    name: "テスト管理者（品目コントローラー）",
    role: "ADMIN",
    isActive: true
  }, "system");
  
  console.log("✔ 管理者ユーザー作成完了:", testData.adminUser.username);

  // マネージャーユーザー作成
  testData.managerUser = await authService.createUser({
    username: "testmanager_item_ctrl",
    email: "testmanager_item_ctrl@example.com",
    password: "password123",
    name: "テストマネージャー（品目コントローラー）",
    role: "MANAGER",
    isActive: true
  }, "system");
  
  console.log("✔ マネージャーユーザー作成完了:", testData.managerUser.username);

  // 運転手ユーザー作成
  testData.driverUser = await authService.createUser({
    username: "testdriver_item_ctrl",
    email: "testdriver_item_ctrl@example.com",
    password: "password123",
    name: "テスト運転手（品目コントローラー）",
    role: "DRIVER",
    isActive: true
  }, "system");
  
  console.log("✔ 運転手ユーザー作成完了:", testData.driverUser.username);
  console.log("");
}

async function createTestVehicleAndOperation(): Promise<void> {
  console.log("=== テスト車両・運行記録作成 ===");
  
  // テスト車両作成
  testData.vehicle = await prisma.vehicle.create({
    data: {
      plateNumber: "TEST-ITEM-001",
      vehicleType: "DUMP_TRUCK",
      manufacturer: "テストメーカー",
      model: "テストモデル",
      year: 2023,
      capacityTons: 10.0,
      fuelType: "DIESEL",
      status: "ACTIVE"
    }
  });
  
  console.log("✔ テスト車両作成完了:", testData.vehicle.plateNumber);

  // テスト運行記録作成
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
  
  console.log("✔ テスト運行記録作成完了:", testData.operation.id);
  console.log("");
}

async function cleanupTestData(): Promise<void> {
  console.log("=== テストデータクリーンアップ ===");
  
  try {
    // 運行詳細削除
    if (testData.operationDetails.length > 0) {
      await prisma.operationDetail.deleteMany({
        where: {
          id: { in: testData.operationDetails.map(od => od.id) }
        }
      });
    }

    // 品目削除
    await prisma.item.deleteMany({
      where: {
        name: { contains: "テスト品目" }
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
      where: { username: { contains: "_item_ctrl" } }
    });

    console.log("✔ テストデータクリーンアップ完了");
  } catch (error) {
    console.error("クリーンアップエラー:", error);
  }
}

async function main(): Promise<void> {
  console.log("=== ItemController テスト開始 ===\n");

  try {
    // テスト前クリーンアップ
    await cleanupTestData();

    // ========================================
    // テストデータ準備
    // ========================================
    await createTestUsers();
    await createTestVehicleAndOperation();

    // ========================================
    // 1. 品目作成テスト (createItem)
    // ========================================
    console.log("1. 品目作成テスト (createItem)");
    
    const req1 = createMockRequest(
      testData.adminUser,
      {},
      {},
      {
        name: "テスト品目砂利",
        displayOrder: 1
      }
    );
    const res1 = createMockResponse();
    const next1 = createMockNext();

    try {
      await itemController.createItem(req1, res1, next1);
      
      // 非同期処理完了を待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log("レスポンスステータス:", res1.statusCode);
      console.log("レスポンスデータ:", res1.jsonData);
      
      if (res1.statusCode === 201 && res1.jsonData && res1.jsonData.success) {
        console.log("✔ 品目作成成功:", res1.jsonData.data.name);
        testData.items.push(res1.jsonData.data);
      } else {
        console.log("✗ 品目作成失敗 - ステータス:", res1.statusCode, "データ:", res1.jsonData);
      }
    } catch (error) {
      console.log("✗ 品目作成でエラー:", error);
      console.log("エラー詳細:", (error as Error).message);
    }
    console.log("");

    // 追加品目作成（複数作成テスト）
    const additionalItems: string[] = ["テスト品目砕石", "テスト品目土砂"];
    for (const itemName of additionalItems) {
      const req = createMockRequest(
        testData.managerUser,
        {},
        {},
        {
          name: itemName,
          displayOrder: testData.items.length + 1
        }
      );
      const res = createMockResponse();
      const next = createMockNext();

      await itemController.createItem(req, res, next);
      
      if (res.statusCode === 201 && res.jsonData && res.jsonData.success) {
        testData.items.push(res.jsonData.data);
        console.log("✔ 追加品目作成成功:", itemName);
      }
    }
    console.log("");

    // ========================================
    // 2. 品目一覧取得テスト (getAllItems)
    // ========================================
    console.log("2. 品目一覧取得テスト (getAllItems)");
    
    const req2 = createMockRequest(
      testData.driverUser,
      {},
      {
        page: "1",
        limit: "10",
        sortBy: "displayOrder",
        sortOrder: "asc"
      }
    );
    const res2 = createMockResponse();
    const next2 = createMockNext();

    try {
      await itemController.getAllItems(req2, res2, next2);
      
      console.log("レスポンスステータス:", res2.statusCode);
      
      if (res2.statusCode === 200 && res2.jsonData && res2.jsonData.success) {
        console.log("✔ 品目一覧取得成功:", {
          itemsCount: res2.jsonData.data.data.length,
          total: res2.jsonData.data.pagination.total
        });
        console.log("取得された品目:", res2.jsonData.data.data.map((i: any) => i.name));
      } else {
        console.log("✗ 品目一覧取得失敗:", res2.jsonData);
      }
    } catch (error) {
      console.log("✗ 品目一覧取得でエラー:", error);
    }
    console.log("");

    // ========================================
    // 3. 品目詳細取得テスト (getItemById)
    // ========================================
    console.log("3. 品目詳細取得テスト (getItemById)");
    
    if (testData.items.length > 0) {
      const req3 = createMockRequest(
        testData.driverUser,
        { id: testData.items[0].id }
      );
      const res3 = createMockResponse();
      const next3 = createMockNext();

      await itemController.getItemById(req3, res3, next3);
      
      if (res3.statusCode === 200 && res3.jsonData && res3.jsonData.success) {
        console.log("✔ 品目詳細取得成功:", res3.jsonData.data.name);
        console.log("  使用回数:", res3.jsonData.data.usageCount);
      } else {
        console.log("✗ 品目詳細取得失敗:", res3.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 4. 品目更新テスト (updateItem)
    // ========================================
    console.log("4. 品目更新テスト (updateItem)");
    
    if (testData.items.length > 0) {
      const req4 = createMockRequest(
        testData.managerUser,
        { id: testData.items[0].id },
        {},
        {
          name: "更新済みテスト品目砂利",
          displayOrder: 10
        }
      );
      const res4 = createMockResponse();
      const next4 = createMockNext();

      await itemController.updateItem(req4, res4, next4);
      
      if (res4.statusCode === 200 && res4.jsonData && res4.jsonData.success) {
        console.log("✔ 品目更新成功:", res4.jsonData.data.name);
        testData.items[0] = res4.jsonData.data; // 更新データを保存
      } else {
        console.log("✗ 品目更新失敗:", res4.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 5. アクティブ品目取得テスト (getActiveItems)
    // ========================================
    console.log("5. アクティブ品目取得テスト (getActiveItems)");
    
    const req5 = createMockRequest(testData.driverUser);
    const res5 = createMockResponse();
    const next5 = createMockNext();

    await itemController.getActiveItems(req5, res5, next5);
    
    if (res5.statusCode === 200 && res5.jsonData && res5.jsonData.success) {
      console.log("✔ アクティブ品目取得成功:", {
        count: res5.jsonData.data.length
      });
      console.log("  アクティブ品目:", res5.jsonData.data.map((i: any) => i.name));
    } else {
      console.log("✗ アクティブ品目取得失敗:", res5.jsonData);
    }
    console.log("");

    // ========================================
    // 6. 品目検索テスト (searchItems)
    // ========================================
    console.log("6. 品目検索テスト (searchItems)");
    
    const req6 = createMockRequest(
      testData.driverUser,
      {},
      {
        query: "砂利",
        limit: "5"
      }
    );
    const res6 = createMockResponse();
    const next6 = createMockNext();

    await itemController.searchItems(req6, res6, next6);
    
    if (res6.statusCode === 200 && res6.jsonData && res6.jsonData.success) {
      console.log("✔ 品目検索成功:", {
        resultCount: res6.jsonData.data.length
      });
      console.log("  検索結果:", res6.jsonData.data.map((i: any) => i.name));
    } else {
      console.log("✗ 品目検索失敗:", res6.jsonData);
    }
    console.log("");

    // ========================================
    // 7. 表示順序更新テスト (updateDisplayOrder)
    // ========================================
    console.log("7. 表示順序更新テスト (updateDisplayOrder)");
    
    if (testData.items.length > 1) {
      const req7 = createMockRequest(
        testData.adminUser,
        { id: testData.items[1].id },
        {},
        { displayOrder: 99 }
      );
      const res7 = createMockResponse();
      const next7 = createMockNext();

      await itemController.updateDisplayOrder(req7, res7, next7);
      
      if (res7.statusCode === 200 && res7.jsonData && res7.jsonData.success) {
        console.log("✔ 表示順序更新成功:", {
          name: res7.jsonData.data.name,
          newOrder: res7.jsonData.data.displayOrder
        });
      } else {
        console.log("✗ 表示順序更新失敗:", res7.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 8. 品目統計取得テスト (getItemStats)
    // ========================================
    console.log("8. 品目統計取得テスト (getItemStats)");
    
    if (testData.items.length > 0) {
      const req8 = createMockRequest(
        testData.managerUser,
        { id: testData.items[0].id },
        {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      );
      const res8 = createMockResponse();
      const next8 = createMockNext();

      await itemController.getItemStats(req8, res8, next8);
      
      if (res8.statusCode === 200 && res8.jsonData && res8.jsonData.success) {
        console.log("✔ 品目統計取得成功:", {
          itemName: res8.jsonData.data.itemInfo.name,
          totalUsage: res8.jsonData.data.statistics.totalUsage
        });
      } else {
        console.log("✗ 品目統計取得失敗:", res8.jsonData);
      }
    }
    console.log("");

    // ========================================
    // 9. ステータス切り替えテスト (toggleItemStatus)
    // ========================================
    console.log("9. 品目ステータス切り替えテスト (toggleItemStatus)");
    
    if (testData.items.length > 1) {
      const req9 = createMockRequest(
        testData.adminUser,
        { id: testData.items[1].id }
      );
      const res9 = createMockResponse();
      const next9 = createMockNext();

      await itemController.toggleItemStatus(req9, res9, next9);
      
      if (res9.statusCode === 200 && res9.jsonData && res9.jsonData.success) {
        console.log("✔ ステータス切り替え成功:", {
          name: res9.jsonData.data.name,
          isActive: res9.jsonData.data.isActive
        });
      } else {
        console.log("✗ ステータス切り替え失敗:", res9.jsonData);
      }
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

      await itemController.getAllItems(req10, res10, next10);
      
      if (res10.statusCode === 401) {
        console.log("✔ 期待通り認証エラー:", res10.jsonData.message);
      } else {
        console.log("✗ 認証エラーが発生すべきでした");
      }
    } catch (error) {
      console.log("✔ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 11. 権限不足エラーテスト（運転手が品目作成）
    console.log("11. 権限不足エラーテスト");
    try {
      const req11 = createMockRequest(
        testData.driverUser, // 運転手ユーザー
        {},
        {},
        {
          name: "権限テスト品目",
          displayOrder: 100
        }
      );
      const res11 = createMockResponse();
      const next11 = createMockNext();

      await itemController.createItem(req11, res11, next11);
      
      if (res11.statusCode === 403) {
        console.log("✔ 期待通り権限エラー:", res11.jsonData.message);
      } else {
        console.log("✗ 権限エラーが発生すべきでした");
      }
    } catch (error) {
      console.log("✔ 期待通りエラー:", (error as Error).message);
    }
    console.log("");

    // 12. 存在しない品目取得エラー
    console.log("12. 存在しない品目取得エラー");
    try {
      const req12 = createMockRequest(
        testData.driverUser,
        { id: "550e8400-e29b-41d4-a716-446655440000" }  // 有効なUUID形式
      );
      const res12 = createMockResponse();
      const next12 = createMockNext();

      await itemController.getItemById(req12, res12, next12);
      
      // next関数にエラーが渡されたかチェック
      if ((next12 as any).errors.length > 0) {
        const error = (next12 as any).errors[0];
        if (error.statusCode === 404) {
          console.log("✔ 期待通り404エラー:", error.message);
        } else {
          console.log("✗ 404エラーが期待されましたが、違うエラーでした:", error.message);
        }
      } else if (res12.statusCode === 404) {
        console.log("✔ 期待通り404エラー:", res12.jsonData?.message);
      } else {
        console.log("✗ 404エラーが発生すべきでした");
      }
    } catch (error) {
      if ((error as any).statusCode === 404) {
        console.log("✔ 期待通り404エラー:", (error as Error).message);
      } else {
        console.log("✔ エラーをキャッチ:", (error as Error).message);
      }
    }
    console.log("");

    // 13. 重複品目名エラー
    console.log("13. 重複品目名エラー");
    if (testData.items.length > 0) {
      try {
        const req13 = createMockRequest(
          testData.adminUser,
          {},
          {},
          {
            name: testData.items[0].name, // 既存の品目名
            displayOrder: 200
          }
        );
        const res13 = createMockResponse();
        const next13 = createMockNext();

        await itemController.createItem(req13, res13, next13);
        
        if (res13.statusCode === 409) {
          console.log("✔ 期待通り重複エラー:", res13.jsonData.message);
        } else {
          console.log("✗ 重複エラーが発生すべきでした");
        }
      } catch (error) {
        console.log("✔ 期待通りエラー:", (error as Error).message);
      }
    }
    console.log("");

    // 14. 品目削除テスト（最後に実行）
    console.log("14. 品目削除テスト (deleteItem)");
    if (testData.items.length > 2) {
      // 運転手が削除を試行（失敗するはず）
      try {
        const req14a = createMockRequest(
          testData.driverUser,
          { id: testData.items[2].id }
        );
        const res14a = createMockResponse();
        const next14a = createMockNext();

        await itemController.deleteItem(req14a, res14a, next14a);
        
        if (res14a.statusCode === 403) {
          console.log("✔ 運転手には削除権限なし:", res14a.jsonData.message);
        } else {
          console.log("✗ 運転手の削除は失敗すべきでした");
        }
      } catch (error) {
        console.log("✔ 期待通りエラー:", (error as Error).message);
      }

      // 管理者が削除を試行（成功するはず）
      try {
        const req14b = createMockRequest(
          testData.adminUser,
          { id: testData.items[2].id }
        );
        const res14b = createMockResponse();
        const next14b = createMockNext();

        await itemController.deleteItem(req14b, res14b, next14b);
        
        if (res14b.statusCode === 200) {
          console.log("✔ 管理者による削除成功（論理削除）");
        } else {
          console.log("✗ 管理者の削除が失敗しました:", res14b.jsonData);
        }
      } catch (error) {
        console.log("管理者削除エラー:", (error as Error).message);
      }
    }
    console.log("");

    // 15. 必須フィールド不足エラー
    console.log("15. 必須フィールド不足エラー");
    try {
      const req15 = createMockRequest(
        testData.adminUser,
        {},
        {},
        {
          // nameが不足
          displayOrder: 300
        }
      );
      const res15 = createMockResponse();
      const next15 = createMockNext();

      await itemController.createItem(req15, res15, next15);
      
      if (res15.statusCode === 400) {
        console.log("✔ 期待通り400エラー:", res15.jsonData.message);
      } else {
        console.log("✗ 400エラーが発生すべきでした");
      }
    } catch (error) {
      console.log("✔ 期待通りエラー:", (error as Error).message);
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