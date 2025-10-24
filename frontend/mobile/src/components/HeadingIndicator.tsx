// frontend/mobile/src/components/HeadingIndicator.tsx
// 🧭 方位表示インジケーターコンポーネント
// 作成日時: 2025-10-24
//
// 機能:
//  ✅ 現在の方位角度を表示 (0-360度)
//  ✅ 方位名を日本語で表示 (北、北東、東、など)
//  ✅ 地図上にオーバーレイ表示

import React from 'react';

interface HeadingIndicatorProps {
  heading: number | null;
  className?: string;
}

const HeadingIndicator: React.FC<HeadingIndicatorProps> = ({ heading, className = '' }) => {
  // 方位名の取得
  const getDirectionName = (deg: number): string => {
    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    const directionIndex = Math.round(deg / 45) % 8;
    return directions[directionIndex];
  };

  if (heading === null || isNaN(heading)) {
    return null;
  }

  const directionName = getDirectionName(heading);
  const roundedHeading = Math.round(heading);

  return (
    <div 
      className={`bg-black bg-opacity-70 text-white px-3 py-2 rounded-full text-xs font-bold shadow-lg ${className}`}
      style={{ zIndex: 1000 }}
    >
      方位: {roundedHeading}° ({directionName})
    </div>
  );
};

export default HeadingIndicator;