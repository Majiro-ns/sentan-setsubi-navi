import type { WageTier } from './constants';

// 設計書§4.1: 賃上げ率の計算
export function calcWageIncreaseRate(
  prevWage: number,  // 前期の給与総額（万円）
  currWage: number   // 当期の給与総額（万円）
): { rate: number; tier: WageTier } {

  if (prevWage === 0) {
    // 新規雇用: 1.5%超確定
    return { rate: 100, tier: 'half' };
  }

  const rate = ((currWage - prevWage) / prevWage) * 100;

  if (rate >= 3.0) return { rate, tier: 'quarter' };  // 1/4 × 5年
  if (rate >= 1.5) return { rate, tier: 'half' };      // 1/2 × 3年
  return { rate, tier: 'none' };                        // 適用不可
}

// 設計書§4.1: 「あと○万円で1.5%に届く」計算
export function calcWageGap(prevWage: number, currWage: number): number | null {
  const target = prevWage * 1.015;  // 1.5%増の目標額
  if (currWage >= target) return null;  // 既に達成
  return Math.ceil(target - currWage);  // 不足額（万円、切上げ）
}
