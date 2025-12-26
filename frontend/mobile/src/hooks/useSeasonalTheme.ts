// frontend/mobile/src/hooks/useSeasonalTheme.ts
// 季節テーマ自動判定 + 手動上書き対応Hook
// 🔧 文字化け対策: 絵文字はReactコード内で定義

import { useState, useEffect, useMemo } from 'react';
import themes from '../assets/themes.json';

/**
 * テーマキー型定義
 */
export type ThemeKey = keyof typeof themes;

/**
 * テーマデータ型定義（themes.jsonの構造に対応）
 */
export interface Theme {
  primary: string;
  background: string;
  tone: string;
  backgroundImage: string;
  marker: string;
  icon: string; // 動的に追加される絵文字
}

/**
 * テーマ設定データ型定義
 */
interface ThemeSettings {
  autoApply: boolean;
  manualTheme: ThemeKey | null;
}

/**
 * 🎨 絵文字マッピング（文字化け対策）
 * themes.jsonのiconフィールドの代わりにこちらを使用
 */
export const THEME_ICONS: Record<ThemeKey, string> = {
  'default': '●',
  'newyear': '🎍',
  'spring': '🌸',
  'early_summer': '🍃',
  'midsummer': '☀️',
  'rainy': '☔',
  'autumn': '🌾',
  'maple': '🍁',
  'winter': '❄️',
  'snowman': '⛄',
  'valentine': '❤️',
  'children': '🎏',
  'hinamatsuri': '🎎',
  'moon': '🌕',
  'obon': '🏮',
  'war_memorial': '🕊️'
};

/**
 * 日付から季節テーマを自動判定する関数
 */
const determineSeasonalTheme = (date: Date): ThemeKey => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 1 && day <= 7) return 'newyear';
  if (month === 2 && day >= 10 && day <= 14) return 'valentine';
  if (month === 3 && day >= 1 && day <= 3) return 'hinamatsuri';
  if ((month === 3 && day >= 15) || month === 4) return 'spring';
  if (month === 5 && day >= 3 && day <= 5) return 'children';
  if ((month === 5 && day >= 6) || (month === 6 && day <= 10)) return 'early_summer';
  if ((month === 6 && day >= 11) || (month === 7 && day <= 20)) return 'rainy';
  if ((month === 7 && day >= 21) || (month === 8 && day <= 12)) return 'midsummer';
  if (month === 8 && day >= 13 && day <= 16) return 'obon';
  if (month === 9 || month === 10) return 'autumn';
  if (month === 9 && day >= 15 && day <= 20) return 'moon';
  if (month === 11) return 'maple';
  if (month === 12 && day < 25) return 'winter';
  if (month === 12 && day >= 25) return 'snowman';
  if ((month === 1 && day >= 8) || (month === 2 && day <= 9)) return 'winter';

  return 'default';
};

/**
 * 季節テーマ管理Hook
 */
export const useSeasonalTheme = () => {
  const STORAGE_KEY = 'seasonalThemeSettings';

  const [settings, setSettings] = useState<ThemeSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('[useSeasonalTheme] LocalStorage読み込みエラー:', error);
    }
    return {
      autoApply: true,
      manualTheme: null
    };
  });

  const [currentDate, setCurrentDate] = useState(new Date());

  const activeThemeKey: ThemeKey = useMemo(() => {
    if (!settings.autoApply && settings.manualTheme) {
      return settings.manualTheme;
    }
    return determineSeasonalTheme(currentDate);
  }, [settings.autoApply, settings.manualTheme, currentDate]);

  const currentTheme: Theme = useMemo(() => {
    const baseTheme = themes[activeThemeKey];
    return {
      ...baseTheme,
      icon: THEME_ICONS[activeThemeKey] // 🔧 絵文字をReactコードから取得
    };
  }, [activeThemeKey]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[useSeasonalTheme] LocalStorage保存エラー:', error);
    }
  }, [settings]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const toggleAutoApply = () => {
    setSettings(prev => ({
      ...prev,
      autoApply: !prev.autoApply
    }));
  };

  const setManualTheme = (themeKey: ThemeKey | null) => {
    setSettings(prev => ({
      ...prev,
      manualTheme: themeKey,
      autoApply: false
    }));
  };

  const resetToAuto = () => {
    setSettings({
      autoApply: true,
      manualTheme: null
    });
  };

  return {
    currentTheme,
    activeThemeKey,
    isAutoApply: settings.autoApply,
    manualTheme: settings.manualTheme,
    toggleAutoApply,
    setManualTheme,
    resetToAuto,
    allThemes: themes,
    _currentDate: currentDate,
    _autoDetectedTheme: determineSeasonalTheme(currentDate)
  };
};