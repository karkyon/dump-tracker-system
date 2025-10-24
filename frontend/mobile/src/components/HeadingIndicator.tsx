// frontend/mobile/src/components/HeadingIndicator.tsx
// 🧭 方位インジケーター - デザイン改善版
// 最終更新: 2025-10-24

import React from 'react';
import { Navigation } from 'lucide-react';

interface HeadingIndicatorProps {
  heading: number; // 方位角度 (0-360度)
  className?: string;
}

const HeadingIndicator: React.FC<HeadingIndicatorProps> = ({ heading, className = '' }) => {
  // 方位を8方位に変換
  const getDirection = (deg: number): string => {
    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  };

  // 方位を英語表記に変換
  const getDirectionEn = (deg: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  };

  return (
    <div 
      className={`flex flex-col items-center justify-center rounded-full bg-black bg-opacity-70 text-white p-3 shadow-lg ${className}`}
      style={{
        width: '70px',
        height: '70px',
        backdropFilter: 'blur(4px)'
      }}
    >
      {/* 🧭 回転する矢印アイコン */}
      <div style={{ transform: `rotate(${heading}deg)`, transition: 'transform 0.3s ease' }}>
        <Navigation className="w-5 h-5 text-blue-400" fill="currentColor" />
      </div>
      
      {/* 方位角度 */}
      <div className="text-xs font-bold mt-1">
        {Math.round(heading)}°
      </div>
      
      {/* 方位名 */}
      <div className="text-xs font-semibold">
        {getDirection(heading)}
      </div>
    </div>
  );
};

export default HeadingIndicator;