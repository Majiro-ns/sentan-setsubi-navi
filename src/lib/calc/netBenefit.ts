import { MIN_COSTS, DEPRECIATION_RATES } from './constants';
import type { EquipmentType, WageTier } from './constants';
import { calcWageIncreaseRate, calcWageGap } from './wageCalc';
import { calcAssetTaxSchedule, checkExemption } from './assetCalc';
import type { YearlyResult } from './assetCalc';

// 設計書§4.4: 損得計算結果（判定ケース別）
export type NetBenefitResult =
  | { eligible: false; reason: 'below_minimum'; minCost: number }
  | { eligible: false; reason: 'wage_insufficient'; gap: number | null; rate: number }
  | { eligible: false; reason: 'below_exemption'; total: number }
  | {
      eligible: true;
      wageTier: WageTier;
      wageRate: number;
      schedule: YearlyResult[];
      totalSaving: number;
      specialRate: number;
      specialYears: number;
      wageIncrease: number;   // 人件費増加額（万円）
      netEffect: number;      // ネット効果 = 節税額 - 人件費増加額（円）
    };

// 設計書§4.4: 損得計算の全体フロー
export function calcNetBenefit(input: {
  prevWage: number;               // 前期給与総額（万円）
  currWage: number;               // 当期給与総額（万円）
  currentStandardAmount: number;  // 現在の課税標準額（万円）
  acquisitionCost: number;        // 設備取得価額（万円）
  equipmentType: EquipmentType;   // 設備種類
  usefulLife: number;             // 耐用年数
}): NetBenefitResult {

  // Step 1: 設備金額要件チェック（SS2）
  const minCost = MIN_COSTS[input.equipmentType];
  if (input.acquisitionCost < minCost) {
    return { eligible: false, reason: 'below_minimum', minCost };
  }

  // Step 2: 賃上げ率計算（SS4/SS5）
  const wage = calcWageIncreaseRate(input.prevWage, input.currWage);
  if (wage.tier === 'none') {
    const gap = calcWageGap(input.prevWage, input.currWage);
    return { eligible: false, reason: 'wage_insufficient', gap, rate: wage.rate };
  }

  // Step 3: 免税点チェック（DA4）
  const costYen = input.acquisitionCost * 10000;
  const depRate = DEPRECIATION_RATES[input.usefulLife];
  const firstYearValue = Math.floor(costYen * (1 - depRate / 2));
  const exemption = checkExemption(
    input.currentStandardAmount,
    firstYearValue / 10000
  );
  if (exemption.exempt) {
    return { eligible: false, reason: 'below_exemption', total: exemption.total };
  }

  // Step 4: 税額シミュレーション
  const specialRate = wage.tier === 'quarter' ? 0.25 : 0.5;
  const specialYears = wage.tier === 'quarter' ? 5 : 3;
  const schedule = calcAssetTaxSchedule(costYen, input.usefulLife, specialRate, specialYears);
  const totalSaving = schedule.reduce((sum, r) => sum + r.saving, 0);

  // 人件費増加額（万円）と節税とのネット効果
  const wageIncrease = input.currWage - input.prevWage;  // 万円
  const wageIncreaseYen = wageIncrease * 10000;          // 円
  const netEffect = totalSaving - wageIncreaseYen;       // 円（プラス=トータルで得）

  return {
    eligible: true,
    wageTier: wage.tier,
    wageRate: wage.rate,
    schedule,
    totalSaving,
    specialRate,
    specialYears,
    wageIncrease,
    netEffect,
  };
}
