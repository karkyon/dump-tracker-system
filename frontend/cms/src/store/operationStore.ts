import { create } from 'zustand';
import { OperationRecord, GPSLocation, FilterOptions, PaginatedResponse, ReportFilter } from '../types';
import { operationAPI, gpsAPI, reportAPI } from '../utils/api';

interface OperationState {
  // 運行記録
  operations: OperationRecord[];
  selectedOperation: OperationRecord | null;
  operationLoading: boolean;
  operationError: string | null;
  operationPagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  operationFilters: FilterOptions;

  // GPS監視
  gpsLocations: GPSLocation[];
  gpsLoading: boolean;
  gpsError: string | null;
  lastGpsUpdate: string | null;

  // 帳票
  reportLoading: boolean;
  reportError: string | null;

  // アクション - 運行記録
  fetchOperations: (filters?: FilterOptions) => Promise<void>;
  fetchOperation: (id: string) => Promise<void>;
  updateOperation: (id: string, operationData: Partial<OperationRecord>) => Promise<boolean>;
  deleteOperation: (id: string) => Promise<boolean>;
  exportOperationsCSV: (filters?: FilterOptions) => Promise<void>;
  setOperationFilters: (filters: Partial<FilterOptions>) => void;
  setOperationPage: (page: number) => void;

  // アクション - GPS監視
  fetchCurrentGPSLocations: () => Promise<void>;
  fetchLocationHistory: (vehicleId: string, filters?: FilterOptions) => Promise<GPSLocation[]>;

  // アクション - 帳票
  generateDailyReport: (filter: ReportFilter) => Promise<void>;
  generateAnnualReport: (filter: ReportFilter) => Promise<void>;

  // その他
  clearErrors: () => void;
  clearSelectedOperation: () => void;
}

export const useOperationStore = create<OperationState>((set, get) => ({
  // 初期状態
  operations: [],
  selectedOperation: null,
  operationLoading: false,
  operationError: null,
  operationPagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  operationFilters: {},

  gpsLocations: [],
  gpsLoading: false,
  gpsError: null,
  lastGpsUpdate: null,

  reportLoading: false,
  reportError: null,

  // 運行記録一覧取得
  fetchOperations: async (filters = {}) => {
    set({ operationLoading: true, operationError: null });

    try {
      const currentFilters = { ...get().operationFilters, ...filters };
      const params = {
        ...currentFilters,
        page: get().operationPagination.page,
        pageSize: get().operationPagination.pageSize,
      };

      console.log('[OperationStore] fetchOperations called with params:', params);

      const response = await operationAPI.getOperations(params);

      console.log('[OperationStore] Full API response:', response);

      if (response.success && response.data) {
        // ✅ 2重ネスト構造を解決
        // apiClient.get戻り値: { success: true, data: <バックエンドレスポンス全体> }
        // バックエンドレスポンス: { success: true, data: { operations: [...], pagination: {...} } }
        const backendData = (response.data as any).data;

        console.log('[OperationStore] Extracted backend data:', backendData);

        // ✅ 複数のレスポンス構造パターンに対応
        let operations: any[] = [];
        let paginationInfo: any = {};

        // パターン1: { operations: [...], pagination: {...} }
        if (backendData?.operations && Array.isArray(backendData.operations)) {
          console.log('[OperationStore] Pattern 1: backendData.operations detected');
          operations = backendData.operations;
          paginationInfo = backendData.pagination || {};
        }
        // パターン2: { data: [...], pagination: {...} }
        else if (backendData?.data && Array.isArray(backendData.data)) {
          console.log('[OperationStore] Pattern 2: backendData.data detected');
          operations = backendData.data;
          paginationInfo = backendData.pagination || {};
        }
        // パターン3: 直接配列 [...]
        else if (Array.isArray(backendData)) {
          console.log('[OperationStore] Pattern 3: Direct array detected');
          operations = backendData;
          paginationInfo = (response as any).pagination || {};
        }
        // パターン4: response.data自体が配列
        else if (Array.isArray(response.data)) {
          console.log('[OperationStore] Pattern 4: response.data is array');
          operations = response.data;
        }

        console.log('[OperationStore] Extracted operations count:', operations.length);
        console.log('[OperationStore] Extracted pagination:', paginationInfo);

        // ページネーション情報の取得（多段階フォールバック）
        const page = paginationInfo.page || params.page || 1;
        const limit = paginationInfo.limit || paginationInfo.pageSize || params.pageSize || 10;
        const total = paginationInfo.total || operations.length;
        const totalPages = paginationInfo.totalPages || Math.ceil(total / limit);

        console.log('[OperationStore] Final pagination values:', {
          page,
          limit,
          total,
          totalPages
        });

        set({
          operations: operations,
          operationPagination: {
            page,
            pageSize: limit,
            total,
            totalPages,
          },
          operationFilters: currentFilters,
          operationLoading: false,
        });

        console.log('[OperationStore] fetchOperations success:', {
          operationsCount: operations.length,
          pagination: { page, limit, total, totalPages }
        });
      } else {
        console.error('[OperationStore] API response error:', response.error);
        set({
          operationError: response.error || '運行記録の取得に失敗しました',
          operationLoading: false,
        });
      }
    } catch (error) {
      console.error('[OperationStore] Network error:', error);
      set({
        operationError: 'ネットワークエラーが発生しました',
        operationLoading: false,
      });
    }
  },

  // 単一運行記録取得
  fetchOperation: async (id: string) => {
    set({ operationLoading: true, operationError: null });

    try {
      const response = await operationAPI.getOperation(id);

      if (response.success && response.data) {
        set({
          selectedOperation: response.data,
          operationLoading: false,
        });
      } else {
        set({
          operationError: response.error || '運行記録の詳細取得に失敗しました',
          operationLoading: false,
        });
      }
    } catch (error) {
      set({
        operationError: 'ネットワークエラーが発生しました',
        operationLoading: false,
      });
    }
  },

  // 運行記録更新
  updateOperation: async (id: string, operationData: Partial<OperationRecord>) => {
    set({ operationLoading: true, operationError: null });

    try {
      const response = await operationAPI.updateOperation(id, operationData);

      if (response.success) {
        await get().fetchOperations();
        
        if (get().selectedOperation?.id === id) {
          await get().fetchOperation(id);
        }
        
        set({ operationLoading: false });
        return true;
      } else {
        set({
          operationError: response.error || '運行記録の更新に失敗しました',
          operationLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        operationError: 'ネットワークエラーが発生しました',
        operationLoading: false,
      });
      return false;
    }
  },

  // 運行記録削除
  deleteOperation: async (id: string) => {
    set({ operationLoading: true, operationError: null });

    try {
      const response = await operationAPI.deleteOperation(id);

      if (response.success) {
        await get().fetchOperations();
        
        if (get().selectedOperation?.id === id) {
          set({ selectedOperation: null });
        }
        
        set({ operationLoading: false });
        return true;
      } else {
        set({
          operationError: response.error || '運行記録の削除に失敗しました',
          operationLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        operationError: 'ネットワークエラーが発生しました',
        operationLoading: false,
      });
      return false;
    }
  },

  // 運行記録CSV出力
  exportOperationsCSV: async (filters = {}) => {
    set({ operationLoading: true, operationError: null });

    try {
      // ✅ 修正: exportCSV メソッドがないため、getOperations で取得してCSV化
      const response = await operationAPI.getOperations({ ...filters, limit: 10000 });

      if (response.success && response.data) {
        const paginatedData = response.data as PaginatedResponse<OperationRecord>;
        const operations = paginatedData.data;

        // CSV生成
        const headers = ['運行日', '運転手ID', '車両ID', '開始時刻', '終了時刻', '開始場所', '終了場所', 'ステータス'];
        const csvContent = [
          headers.join(','),
          ...operations.map(op => [
            op.date || new Date(op.startTime).toLocaleDateString('ja-JP'),
            op.driverId,
            op.vehicleId,
            op.startTime,
            op.endTime || '',
            op.startLocation,
            op.endLocation || '',
            op.status
          ].join(','))
        ].join('\n');

        // BOM付きUTF-8でエンコード（Excelで文字化け防止）
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `運行記録_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        set({ operationLoading: false });
      } else {
        set({
          operationError: response.error || 'CSV出力に失敗しました',
          operationLoading: false,
        });
      }
    } catch (error) {
      set({
        operationError: 'ネットワークエラーが発生しました',
        operationLoading: false,
      });
    }
  },

  // GPS現在位置取得
  fetchCurrentGPSLocations: async () => {
    set({ gpsLoading: true, gpsError: null });

    try {
      // ✅ 修正: getCurrentLocations がないため、getGpsLocations を使用
      const response = await gpsAPI.getGpsLocations();

      if (response.success && response.data) {
        set({
          gpsLocations: Array.isArray(response.data) ? response.data : [],
          lastGpsUpdate: new Date().toISOString(),
          gpsLoading: false,
        });
      } else {
        set({
          gpsError: response.error || 'GPS位置情報の取得に失敗しました',
          gpsLoading: false,
        });
      }
    } catch (error) {
      set({
        gpsError: 'ネットワークエラーが発生しました',
        gpsLoading: false,
      });
    }
  },

  // GPS履歴取得
  fetchLocationHistory: async (vehicleId: string, filters = {}) => {
    try {
      // ✅ 修正: getLocationHistory がないため、getGpsHistory を使用
      const response = await gpsAPI.getGpsHistory(vehicleId, filters);

      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : [];
      } else {
        throw new Error(response.error || 'GPS履歴の取得に失敗しました');
      }
    } catch (error) {
      throw error;
    }
  },

  // 日報生成
  generateDailyReport: async (filter: ReportFilter) => {
    set({ reportLoading: true, reportError: null });

    try {
      // ✅ 修正: generateDailyReport → getDailyReport
      const response = await reportAPI.getDailyReport(filter.startDate, filter);

      if (response.success && response.data) {
        // ファイルダウンロード処理
        const blob = new Blob([response.data], { 
          type: filter.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const extension = filter.format === 'pdf' ? 'pdf' : 'xlsx';
        const date = filter.startDate || new Date().toISOString().split('T')[0];
        link.download = `日報_${date}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        set({ reportLoading: false });
      } else {
        set({
          reportError: response.error || '日報の生成に失敗しました',
          reportLoading: false,
        });
      }
    } catch (error) {
      set({
        reportError: 'ネットワークエラーが発生しました',
        reportLoading: false,
      });
    }
  },

  // 年間輸送実績報告書生成
  generateAnnualReport: async (filter: ReportFilter) => {
    set({ reportLoading: true, reportError: null });

    try {
      // ✅ 修正: generateAnnualReport → getAnnualReport
      const year = new Date(filter.startDate).getFullYear();
      const response = await reportAPI.getAnnualReport(year, filter);

      if (response.success && response.data) {
        // ファイルダウンロード処理
        const blob = new Blob([response.data], { 
          type: filter.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const extension = filter.format === 'pdf' ? 'pdf' : 'xlsx';
        link.download = `輸送実績報告書_${year}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        set({ reportLoading: false });
      } else {
        set({
          reportError: response.error || '輸送実績報告書の生成に失敗しました',
          reportLoading: false,
        });
      }
    } catch (error) {
      set({
        reportError: 'ネットワークエラーが発生しました',
        reportLoading: false,
      });
    }
  },

  // フィルター設定
  setOperationFilters: (filters: Partial<FilterOptions>) => {
    set({
      operationFilters: { ...get().operationFilters, ...filters },
      operationPagination: { ...get().operationPagination, page: 1 },
    });
  },

  // ページ設定
  setOperationPage: (page: number) => {
    set({
      operationPagination: { ...get().operationPagination, page },
    });
  },

  // エラークリア
  clearErrors: () => set({ 
    operationError: null, 
    gpsError: null, 
    reportError: null 
  }),

  // 選択運行記録クリア
  clearSelectedOperation: () => set({ selectedOperation: null }),
}));