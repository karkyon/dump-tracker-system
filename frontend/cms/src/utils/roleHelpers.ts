// frontend/cms/src/utils/roleHelpers.ts
// 役割バッジの色・ラベルをCMS全体で統一する共通ヘルパー
//
// 配色設計:
//   管理者  (ADMIN)   : Purple  — 最高権限・システム管理
//   マネージャー (MANAGER): Blue    — 管理職・運行管理
//   ドライバー   (DRIVER) : Teal/Green — 現場・実務担当

export interface RoleBadgeConfig {
  label: string;
  className: string;
}

export const ROLE_BADGE_CONFIG: Record<string, RoleBadgeConfig> = {
  ADMIN: {
    label: '管理者',
    className:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
      'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-300',
  },
  MANAGER: {
    label: 'マネージャー',
    className:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
      'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-300',
  },
  DRIVER: {
    label: 'ドライバー',
    className:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
      'bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-300',
  },
};

/**
 * 役割コード → バッジ設定を返す
 * 未知の役割はグレーでそのまま表示
 */
export const getRoleBadgeConfig = (role: string): RoleBadgeConfig =>
  ROLE_BADGE_CONFIG[role] ?? {
    label: role,
    className:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
      'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-300',
  };
