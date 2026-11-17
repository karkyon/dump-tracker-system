import { isFillableGap } from '../../src/utils/gpsGap';

describe('isFillableGap', () => {
  it('停車中（距離が小さい）は補完しない', () => {
    expect(isFillableGap(0.01, 3000)).toBe(false);
    expect(isFillableGap(0.29, 1800)).toBe(false);
  });
  it('90秒超の途切れで300m以上動いていれば補完する', () => {
    expect(isFillableGap(0.3, 91)).toBe(true);
    expect(isFillableGap(21.6, 3120)).toBe(true);
  });
  it('90秒以内でも、時間の割に距離が大き過ぎる（記録時刻と位置のずれ）場合は補完する', () => {
    expect(isFillableGap(17, 240)).toBe(true);   // 4分で17km
    expect(isFillableGap(17, 0)).toBe(true);     // 時刻が同一でも17km離れている
  });
  it('連続記録として自然な移動は補完しない', () => {
    expect(isFillableGap(0.5, 30)).toBe(false);  // 30秒で500m（約60km/h）
  });
});
