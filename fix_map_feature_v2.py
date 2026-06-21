#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_map_feature_v2.py
=====================================
運行記録マップ機能 5点修正

①②③ UI修正（OperationRecords.tsx）:
  - タブとフィルタ/一覧ブロックが分離して見える問題を解消
    → タブ・検索フィルタ・一覧（or マップ）を1つの白カードコンテナに統合
  - タブ名「マップ表示」→「実績表示」に変更
  - マップ表示時のタブ下の余白問題を解消（同じ統合コンテナ構造で解決）

④ 表記修正（OperationsMapView.tsx):
  - 「積下」→「荷降」に表示文言を統一（DBのlocationType値=DELIVERYは変更しない）

⑤ 検索バグ修正（バックエンド + フロントエンド）:
  - operationController.ts: getAllOperations に search パラメータ対応を追加
    （運行番号・運転手名・車両番号・客先名・積込/積卸場所名で部分一致検索）
  - OperationRecords.tsx: fetchOperations に search を渡し、searchQuery変更時に
    デバウンス付きで再検索されるようにする

完了後:
  - backend / frontend/cms / frontend/mobile の3パッケージで tsc --noEmit を実行
  - 全て RC=0 の場合のみ git add/commit/push を実行
  - 本スクリプト自身を自動削除
=====================================
"""
import subprocess
import sys
import os

ROOT = os.path.expanduser("~/projects/dump-tracker")


def patch(filepath, old, new, label):
    full = os.path.join(ROOT, filepath)
    if not os.path.exists(full):
        print(f"❌ [{label}] ファイルが存在しません: {full}")
        sys.exit(1)
    with open(full, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count == 0:
        print(f"❌ [{label}] 置換対象が見つかりません: {filepath}")
        sys.exit(1)
    if count > 1:
        print(f"❌ [{label}] 置換対象が複数({count}件)見つかりました。一意になるよう調整してください: {filepath}")
        sys.exit(1)
    content = content.replace(old, new)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ [{label}] パッチ適用完了: {filepath}")


def overwrite_file(filepath, content, label):
    full = os.path.join(ROOT, filepath)
    if not os.path.exists(full):
        print(f"❌ [{label}] ファイルが存在しません: {full}")
        sys.exit(1)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ [{label}] ファイル上書き完了: {filepath}")


def run(cmd, cwd=None, label=""):
    print(f"\n▶ 実行: {cmd} (cwd={cwd or ROOT})")
    result = subprocess.run(
        cmd, shell=True, cwd=cwd or ROOT,
        capture_output=True, text=True
    )
    print(result.stdout[-4000:] if result.stdout else "")
    if result.returncode != 0:
        print(f"❌ [{label}] 失敗 (RC={result.returncode})")
        print(result.stderr[-4000:] if result.stderr else "")
    else:
        print(f"✅ [{label}] 成功 (RC=0)")
    return result.returncode


# =====================================================================
# ⑤-A Backend: operationController.ts に search 対応を追加
# =====================================================================

CTRL_OLD = """  getAllOperations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      page = 1,
      limit = 20,
      status,
      vehicleId,
      startDate,
      endDate
    } = req.query as PaginationQuery & {
      status?: string;
      vehicleId?: string;
      startDate?: string;
      endDate?: string;
    };

    logger.info('運行一覧取得', { userId, page, limit, status, vehicleId });

    // WHERE句構築
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.actualStartTime = {};
      if (startDate) where.actualStartTime.gte = new Date(startDate);
      if (endDate) where.actualStartTime.lte = new Date(endDate);
    }

    // ✅ Service層に委譲
    const result = await operationService.findManyWithPagination({
      where,
      page: Number(page),
      pageSize: Number(limit)
    });"""

CTRL_NEW = """  getAllOperations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      page = 1,
      limit = 20,
      status,
      vehicleId,
      startDate,
      endDate,
      search
    } = req.query as PaginationQuery & {
      status?: string;
      vehicleId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    };

    logger.info('運行一覧取得', { userId, page, limit, status, vehicleId, search });

    // WHERE句構築
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.actualStartTime = {};
      if (startDate) where.actualStartTime.gte = new Date(startDate);
      if (endDate) where.actualStartTime.lte = new Date(endDate);
    }

    // ✅ キーワード検索: 運行番号・運転手名・車両番号・客先名・積込/積卸場所名
    const searchTerm = (search as string | undefined)?.trim();
    if (searchTerm) {
      where.OR = [
        { operationNumber: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { vehicles: { plateNumber: { contains: searchTerm, mode: 'insensitive' } } },
        { usersOperationsDriverIdTousers: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { customer: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { operationDetails: { some: { locations: { name: { contains: searchTerm, mode: 'insensitive' } } } } }
      ];
    }

    // ✅ Service層に委譲
    const result = await operationService.findManyWithPagination({
      where,
      page: Number(page),
      pageSize: Number(limit)
    });"""


# =====================================================================
# ①②③⑤-B Frontend CMS: OperationRecords.tsx の各種パッチ
# =====================================================================

# ⑤-B: fetchOperations に search を渡す
OR_FETCH_OLD = """      const response = await apiClient.get('/operations', {
        params: {
          page: pagination.page,
          limit: pagination.pageSize,
          ...(vehicleFilter && { vehicleId: vehicleFilter }),
          ...(driverFilter && { driverId: driverFilter }),
          ...(dateFilter && { startDate: dateFilter })
        }
      });"""

OR_FETCH_NEW = """      const response = await apiClient.get('/operations', {
        params: {
          page: pagination.page,
          limit: pagination.pageSize,
          ...(vehicleFilter && { vehicleId: vehicleFilter }),
          ...(driverFilter && { driverId: driverFilter }),
          ...(dateFilter && { startDate: dateFilter }),
          ...(searchQuery.trim() && { search: searchQuery.trim() })
        }
      });"""

# ⑤-B: searchQuery変更時のデバウンス再検索（既存の vehicleFilter等の useEffect 直後に追加）
OR_EFFECT_OLD = """  useEffect(() => {
    if (vehicleFilter || driverFilter || dateFilter) {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOperations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleFilter, driverFilter, dateFilter]);"""

OR_EFFECT_NEW = """  useEffect(() => {
    if (vehicleFilter || driverFilter || dateFilter) {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOperations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleFilter, driverFilter, dateFilter]);

  // ✅ キーワード検索: 入力後500msデバウンスして再検索（マップ表示からのジャンプ含む）
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOperations();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);"""

# ①②③ UI統合: タブ + 検索フィルタ + 一覧/マップ を1つの白カードに統合
OR_LAYOUT_OLD = """      {/* 表示切替タブ: 一覧表示 / マップ表示 */}
      <div className="flex gap-1">
        <button
          onClick={() => setActiveView('LIST')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg border ${
            activeView === 'LIST'
              ? 'bg-white border-gray-200 border-b-white text-gray-900'
              : 'bg-transparent border-transparent text-gray-500'
          }`}
        >
          📋 一覧表示
        </button>
        <button
          onClick={() => setActiveView('MAP')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg border ${
            activeView === 'MAP'
              ? 'bg-white border-gray-200 border-b-white text-gray-900'
              : 'bg-transparent border-transparent text-gray-500'
          }`}
        >
          🗺️ マップ表示
        </button>
      </div>

      {activeView === 'MAP' ? (
        <OperationsMapView onJumpToList={handleJumpToList} />
      ) : (
      <>
      <div className="bg-white p-6 rounded-lg shadow">"""

OR_LAYOUT_NEW = """      {/* タブ＋検索フィルタ＋一覧/実績表示を1枚の白カードに統合 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* 表示切替タブ */}
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveView('LIST')}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-t border-l border-r -mb-px ${
              activeView === 'LIST'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-transparent border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 一覧表示
          </button>
          <button
            onClick={() => setActiveView('MAP')}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-t border-l border-r -mb-px ${
              activeView === 'MAP'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-transparent border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 実績表示
          </button>
        </div>

      {activeView === 'MAP' ? (
        <OperationsMapView onJumpToList={handleJumpToList} />
      ) : (
      <>
      <div className="p-6">"""

# 一覧表示部の旧来の独立した白カード(検索・フィルター)の終端を、新しい統合構造に合わせて閉じタグ調整
OR_FILTER_CLOSE_OLD = """          <Input label="運行日" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">"""

OR_FILTER_CLOSE_NEW = """          <Input label="運行日" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg mt-4">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">"""

# 末尾の閉じタグ調整（統合カードの外枠 </div> を追加）
OR_CLOSE_OLD = """      {selectedRecord && <OperationDetailDialog operationId={selectedRecord.id}
          initialOperation={selectedRecord} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />}
      </>
      )}
    </div>
  );
};

export default OperationRecords;"""

OR_CLOSE_NEW = """      {selectedRecord && <OperationDetailDialog operationId={selectedRecord.id}
          initialOperation={selectedRecord} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />}
      </>
      )}
      </div>
    </div>
  );
};

export default OperationRecords;"""


# =====================================================================
# ④ OperationsMapView.tsx 表記修正: 「積下」→「荷降」
# =====================================================================

MAPVIEW_OLD_1 = """      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">🔍 場所・客先名で検索</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="場所名・客先名を入力..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">場所種別</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'PICKUP' | 'DELIVERY')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="ALL">すべて（積込・積下）</option>
              <option value="PICKUP">積込のみ</option>
              <option value="DELIVERY">積下のみ</option>
            </select>
          </div>"""

MAPVIEW_NEW_1 = """      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">🔍 場所・客先名で検索</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="場所名・客先名を入力..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">場所種別</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'PICKUP' | 'DELIVERY')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="ALL">すべて（積込・荷降）</option>
              <option value="PICKUP">積込のみ</option>
              <option value="DELIVERY">荷降のみ</option>
            </select>
          </div>"""

MAPVIEW_OLD_2 = """      marker.addListener('click', () => {
        const typeLabel = loc.locationType === 'DELIVERY' ? '積下場所' : '積込場所';"""

MAPVIEW_NEW_2 = """      marker.addListener('click', () => {
        const typeLabel = loc.locationType === 'DELIVERY' ? '荷降場所' : '積込場所';"""

MAPVIEW_OLD_3 = """                  <div className="text-xs font-bold text-gray-800">{loc.name}</div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: loc.locationType === 'DELIVERY' ? '#fee2e2' : '#dbeafe',
                        color: loc.locationType === 'DELIVERY' ? '#b91c1c' : '#1d4ed8'
                      }}
                    >
                      {loc.locationType === 'DELIVERY' ? '積下' : '積込'}
                    </span>"""

MAPVIEW_NEW_3 = """                  <div className="text-xs font-bold text-gray-800">{loc.name}</div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: loc.locationType === 'DELIVERY' ? '#fee2e2' : '#dbeafe',
                        color: loc.locationType === 'DELIVERY' ? '#b91c1c' : '#1d4ed8'
                      }}
                    >
                      {loc.locationType === 'DELIVERY' ? '荷降' : '積込'}
                    </span>"""

MAPVIEW_OLD_4 = """      const color = loc.locationType === 'DELIVERY' ? '#dc2626' : '#2563eb';"""
MAPVIEW_NEW_4 = """      const color = loc.locationType === 'DELIVERY' ? '#dc2626' : '#2563eb'; // 荷降=赤 / 積込=青"""


# =====================================================================
# ⑤-C フロントエンド: クライアント側の二重フィルタを削除
# =====================================================================
# filteredRecords は vehiclePlate/driverName/opNumber のみで再フィルタしており、
# バックエンドの search（場所名・客先名等を含む）で正しく絞り込まれた結果を
# クライアント側で再度弾いてしまうバグがある。バックエンド検索に一本化する。

FILTERED_RECORDS_OLD = """  const filteredRecords = operations.filter((record) => {
    const vehiclePlate = record.vehicles?.plateNumber || '';
    const driverName = record.usersOperationsDriverIdTousers?.name || '';
    const opNumber = record.operationNumber || '';
    const matchesSearch = vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase()) || driverName.toLowerCase().includes(searchQuery.toLowerCase()) || opNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });"""

FILTERED_RECORDS_NEW = """  // ✅ 修正: 検索は既にバックエンド（/operations?search=...）で行われているため、
  //    ここでのクライアント側再フィルタは行わない（二重フィルタによる0件化バグの原因だった）。
  //    場所名・客先名等の検索キーワードはバックエンドのwhere句でのみ判定する。
  const filteredRecords = operations;"""


def main():
    print("=" * 70)
    print("運行記録マップ機能 5点修正スクリプト 開始")
    print("=" * 70)

    # ⑤-A バックエンド: 検索パラメータ対応
    patch(
        "backend/src/controllers/operationController.ts",
        CTRL_OLD,
        CTRL_NEW,
        "operationController.ts: search パラメータ対応追加"
    )

    # ⑤-B フロントエンド: search送信 + デバウンス再検索
    patch(
        "frontend/cms/src/pages/OperationRecords.tsx",
        OR_FETCH_OLD,
        OR_FETCH_NEW,
        "OperationRecords.tsx: search パラメータ送信"
    )
    patch(
        "frontend/cms/src/pages/OperationRecords.tsx",
        OR_EFFECT_OLD,
        OR_EFFECT_NEW,
        "OperationRecords.tsx: searchQueryデバウンス再検索"
    )

    # ⑤-C クライアント側の二重フィルタ削除
    patch(
        "frontend/cms/src/pages/OperationRecords.tsx",
        FILTERED_RECORDS_OLD,
        FILTERED_RECORDS_NEW,
        "OperationRecords.tsx: クライアント側二重フィルタ削除"
    )

    # ①②③ UI統合
    patch(
        "frontend/cms/src/pages/OperationRecords.tsx",
        OR_LAYOUT_OLD,
        OR_LAYOUT_NEW,
        "OperationRecords.tsx: タブ・フィルタ・一覧を統合カード化"
    )
    patch(
        "frontend/cms/src/pages/OperationRecords.tsx",
        OR_FILTER_CLOSE_OLD,
        OR_FILTER_CLOSE_NEW,
        "OperationRecords.tsx: 検索フィルタ/一覧間の枠調整"
    )
    patch(
        "frontend/cms/src/pages/OperationRecords.tsx",
        OR_CLOSE_OLD,
        OR_CLOSE_NEW,
        "OperationRecords.tsx: 統合カード外枠クローズ"
    )

    # ④ 「積下」→「荷降」表記修正
    patch(
        "frontend/cms/src/components/OperationsMapView.tsx",
        MAPVIEW_OLD_1,
        MAPVIEW_NEW_1,
        "OperationsMapView.tsx: 種別セレクト表記修正"
    )
    patch(
        "frontend/cms/src/components/OperationsMapView.tsx",
        MAPVIEW_OLD_2,
        MAPVIEW_NEW_2,
        "OperationsMapView.tsx: InfoWindowラベル修正"
    )
    patch(
        "frontend/cms/src/components/OperationsMapView.tsx",
        MAPVIEW_OLD_3,
        MAPVIEW_NEW_3,
        "OperationsMapView.tsx: ランキングバッジ修正"
    )
    patch(
        "frontend/cms/src/components/OperationsMapView.tsx",
        MAPVIEW_OLD_4,
        MAPVIEW_NEW_4,
        "OperationsMapView.tsx: コメント注記追加"
    )

    print("\n" + "=" * 70)
    print("パッチ適用完了。TypeScriptコンパイルチェックを実行します。")
    print("=" * 70)

    rc_backend = run(
        "./node_modules/.bin/tsc --noEmit",
        cwd=os.path.join(ROOT, "backend"),
        label="backend tsc"
    )
    rc_cms = run(
        "npx tsc --noEmit",
        cwd=os.path.join(ROOT, "frontend/cms"),
        label="frontend/cms tsc"
    )
    rc_mobile = run(
        "npx tsc --noEmit",
        cwd=os.path.join(ROOT, "frontend/mobile"),
        label="frontend/mobile tsc"
    )

    print("\n" + "=" * 70)
    print(f"コンパイル結果: backend={rc_backend} / cms={rc_cms} / mobile={rc_mobile}")
    print("=" * 70)

    if rc_backend == 0 and rc_cms == 0 and rc_mobile == 0:
        print("\n✅ 全パッケージ コンパイルエラー0件。GitHubへPushします。")
        run("git add -A", label="git add")
        commit_msg = (
            "fix: 運行記録マップ機能の5点修正\\n\\n"
            "- UI: タブ・検索フィルタ・一覧/実績表示を1枚の白カードに統合（離れて見える問題を解消）\\n"
            "- UI: タブ名「マップ表示」を「実績表示」に変更\\n"
            "- 表記: 「積下」を「荷降」に統一（OperationsMapView.tsx）\\n"
            "- fix: operationController.ts に search パラメータ対応を追加\\n"
            "  （運行番号・運転手名・車両番号・客先名・積込/積卸場所名で部分一致検索）\\n"
            "- fix: OperationRecords.tsx で検索キーワードがAPIに送信されない不具合を修正\\n"
            "- fix: クライアント側の二重フィルタ（filteredRecords）を削除\\n"
            "  （バックエンド検索結果を再度弾いて0件になっていたバグを解消）"
        )
        run(f'git commit -m "{commit_msg}"', label="git commit")
        rc_push = run("git push", label="git push")
        if rc_push == 0:
            print("\n✅✅✅ GitHubへのPushが完了しました。")
        else:
            print("\n⚠️ git push に失敗しました。手動で確認してください。")
    else:
        print("\n❌❌❌ コンパイルエラーが残っています。GitHubへはPushしません。")
        print("上記のtscエラー出力を確認し、修正が必要です。")

    self_path = os.path.abspath(__file__)
    try:
        os.remove(self_path)
        print(f"\n🗑 スクリプト自身を削除しました: {self_path}")
    except Exception as e:
        print(f"\n⚠️ スクリプト自身の削除に失敗: {e}")


if __name__ == "__main__":
    main()
