import { DEPRECIATION_RATES } from './constants';

// 設計書§4.2: 年度別計算結果
export interface YearlyResult {
  year: number;
  assessedValue: number;  // 評価額（円）
  normalTax: number;      // 通常税額（円）
  specialTax: number;     // 特例適用後税額（円）
  saving: number;         // 軽減額（円）
}

// 設計書§4.2: 償却資産税の年度別計算
export function calcAssetTaxSchedule(
  acquisitionCost: number,   // 取得価額（円）
  usefulLife: number,        // 耐用年数
  specialRate: number,       // 特例率（1.0 / 0.5 / 0.25）
  specialYears: number,      // 特例期間（0 / 3 / 5）
  taxRate: number = 0.014    // 税率
): YearlyResult[] {

  const depRate = DEPRECIATION_RATES[usefulLife];
  const minValue = Math.floor(acquisitionCost * 0.05);  // DA3: 最低5%
  const results: YearlyResult[] = [];

  let value = Math.floor(acquisitionCost * (1 - depRate / 2));  // DA2: 初年度半年

  for (let y = 1; y <= usefulLife; y++) {
    if (value < minValue) value = minValue;  // DA3

    const normalTax = Math.floor(value * taxRate);
    const appliedRate = (y <= specialYears) ? specialRate : 1.0;
    const specialTax = Math.floor(value * appliedRate * taxRate);

    results.push({
      year: y,
      assessedValue: value,
      normalTax,
      specialTax,
      saving: normalTax - specialTax,
    });

    value = Math.floor(value * (1 - depRate));  // DA2
  }
  return results;
}

// 設計書§4.3: 免税点チェック（DA4）
export function checkExemption(
  currentStandardAmount: number,  // 現在の課税標準額（万円）
  newAssetValue: number           // 新規設備の初年度評価額（万円）
): { exempt: boolean; total: number } {

  const total = currentStandardAmount + newAssetValue;
  return {
    exempt: total < 150,  // DA4: 150万円未満は非課税
    total,
  };
}
