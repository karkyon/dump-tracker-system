// ============================================================
// frontend/cms/src/constants/itemTypes.ts
//
// 品目区分（ItemType）の定数・日本語ラベル定義
// DB側ENUMと完全一致させること
// ============================================================

/**
 * 品目区分ENUMの値（DBのitem_type ENUMと一致）
 */
export const ITEM_TYPE_VALUES = {
  RECYCLED_MATERIAL: 'RECYCLED_MATERIAL',
  VIRGIN_MATERIAL: 'VIRGIN_MATERIAL',
  WASTE: 'WASTE',
} as const;

export type ItemTypeValue = typeof ITEM_TYPE_VALUES[keyof typeof ITEM_TYPE_VALUES];

/**
 * 品目区分の日本語ラベル
 * API/DBの英語値 → UI表示用日本語 の変換に使用
 */
export const ITEM_TYPE_LABELS: Record<string, string> = {
  RECYCLED_MATERIAL: '再生材',
  VIRGIN_MATERIAL: 'バージン材',
  WASTE: '廃棄物',
};

/**
 * セレクトボックス用オプション配列
 * 品目編集・新規作成フォームの「品目区分」ドロップダウンで使用
 */
export const ITEM_TYPE_OPTIONS = [
  { value: ITEM_TYPE_VALUES.RECYCLED_MATERIAL, label: ITEM_TYPE_LABELS.RECYCLED_MATERIAL },
  { value: ITEM_TYPE_VALUES.VIRGIN_MATERIAL,   label: ITEM_TYPE_LABELS.VIRGIN_MATERIAL },
  { value: ITEM_TYPE_VALUES.WASTE,             label: ITEM_TYPE_LABELS.WASTE },
];

/**
 * 日本語ラベルを返すヘルパー関数
 * @example getItemTypeLabel('RECYCLED_MATERIAL') // → '再生材'
 * @example getItemTypeLabel(undefined)           // → '-'
 */
export const getItemTypeLabel = (itemType: string | null | undefined): string => {
  if (!itemType) return '-';
  return ITEM_TYPE_LABELS[itemType] ?? itemType;
};