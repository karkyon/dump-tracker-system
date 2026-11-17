// =====================================
// backend/src/utils/gpsGap.ts
// GPS欠落（途切れ）の判定ロジック（純粋関数）
// =====================================

/** この秒数を超えて記録が途切れたら「途切れ」候補とする */
export const GPS_GAP_THRESHOLD_SECONDS = 90;
/** これ未満の移動は直線距離で十分（道路経路を取らない） */
export const GAP_FILL_MIN_STRAIGHT_KM = 0.3;
/** 連続記録では起こり得ない速度（m/s）。これを超える移動は「記録が無い区間を移動した」とみなす */
export const IMPOSSIBLE_SPEED_MPS = 40;

/**
 * 2点間が「道路経路で補完すべき途切れ」かどうか。
 *  - 距離が小さい（停車中など）なら補完しない
 *  - 時間が閾値を超えて空いている、または時間の割に距離が大き過ぎる場合は補完する
 *    （イベント時刻と位置の記録がずれていて、時間差が小さく見えるケースを拾う）
 */
export function isFillableGap(distanceKm: number, gapSeconds: number): boolean {
  if (!(distanceKm >= GAP_FILL_MIN_STRAIGHT_KM)) return false;
  if (gapSeconds > GPS_GAP_THRESHOLD_SECONDS) return true;
  const sec = Math.max(gapSeconds, 1);
  return (distanceKm * 1000) / sec > IMPOSSIBLE_SPEED_MPS;
}
