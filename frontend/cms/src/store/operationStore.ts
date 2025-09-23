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

      const response = await operationAPI.getOperations(params);

      if (response.success && response.data) {
        const data = response.data as PaginatedResponse<OperationRecord>;
        set({
          operations: data.items,
          operationPagination: {
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            totalPages: data.totalPages,
          },
          operationFilters: currentFilters,
          operationLoading: false,
        });
      } else {
        set({
          operationError: response.error || '運行記録の取得に失敗しました',
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
      const response = await operationAPI.exportCSV(filters);

      if (response.success && response.data) {
        // ファイルダウンロード処理
        const blob = new Blob([response.data], { type: 'text/csv' });
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
      const response = await gpsAPI.getCurrentLocations();

      if (response.success && response.data) {
        set({
          gpsLocations: response.data,
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
      const response = await gpsAPI.getLocationHistory(vehicleId, filters);

      if (response.success && response.data) {
        return response.data;
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
      const response = await reportAPI.generateDailyReport(filter);

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
      const response = await reportAPI.generateAnnualReport(filter);

      if (response.success && response.data) {
        // ファイルダウンロード処理
        const blob = new Blob([response.data], { 
          type: filter.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const extension = filter.format === 'pdf' ? 'pdf' : 'xlsx';
        const year = new Date().getFullYear();
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