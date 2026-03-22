// =====================================
// backend/src/models/AccidentRecordModel.ts
// 事故記録モデル - 貨物自動車運送事業実績報告書 事故件数欄用
// 新規作成: 2026-03-17 (P2-01)
// =====================================

import { AccidentType, Prisma, TransportRegion } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type AccidentRecordModel = Prisma.AccidentRecordGetPayload<{}>;

// =====================================
// DTO型定義
// =====================================

/** 事故記録 作成DTO */
export interface AccidentRecordCreateDTO {
  accidentDate: Date | string;          // 事故発生日
  accidentType: AccidentType;           // TRAFFIC | SERIOUS
  vehicleId?: string;                   // 関係車両ID（任意）
  driverId?: string;                    // 関係運転者ID（任意）
  operationId?: string;                 // 関連運行ID（任意）
  casualties?: number;                  // 死者数（デフォルト0）
  injuries?: number;                    // 負傷者数（デフォルト0）
  region?: TransportRegion;             // 管轄区域（任意）
  description?: string;                 // 概要（任意）
}

/** 事故記録 更新DTO */
export interface AccidentRecordUpdateDTO extends Partial<AccidentRecordCreateDTO> {}

/** 事故記録 レスポンスDTO */
export interface AccidentRecordResponseDTO {
  id: string;
  accidentDate: Date;
  accidentType: AccidentType;
  vehicleId: string | null;
  driverId: string | null;
  operationId: string | null;
  casualties: number;
  injuries: number;
  region: TransportRegion | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  // リレーション（include時）
  vehicles?: {
    id: string;
    plateNumber: string;
    model: string;
  } | null;
  users?: {
    id: string;
    name: string;
  } | null;
}

/** 事故記録 フィルター */
export interface AccidentRecordFilter {
  fiscalYear?: number;       // 年度（4/1〜3/31）で絞り込む場合
  accidentType?: AccidentType;
  vehicleId?: string;
  driverId?: string;
  region?: TransportRegion;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  page?: number;
  limit?: number;
}

/** 事故記録 サマリー（年度集計） */
export interface AccidentRecordSummary {
  fiscalYear: number;
  trafficAccidents: number;   // 交通事故件数
  seriousAccidents: number;   // 重大事故件数
  totalCasualties: number;    // 死者数合計
  totalInjuries: number;      // 負傷者数合計
}

/** 事故記録一覧レスポンス */
export interface AccidentRecordListResponse {
  data: AccidentRecordResponseDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: AccidentRecordSummary;
}
