// frontend/cms/src/utils/index.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSSのクラス名を結合してマージ
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
