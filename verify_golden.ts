// 計算ロジック インライン検証スクリプト（jest不要）

const DEPRECIATION_RATES: Record<number, number> = {
  3: 0.536, 4: 0.438, 5: 0.369, 6: 0.319,
  7: 0.280, 8: 0.250, 9: 0.226, 10: 0.206,
  11: 0.189, 12: 0.175, 13: 0.162, 14: 0.152,
  15: 0.142, 16: 0.134, 17: 0.127, 18: 0.120,
  19: 0.114, 20: 0.109,
};

const MIN_COSTS: Record<string, number> = {
  machinery: 160, measuring_tools: 30, fixtures: 30, building_attachments: 60,
};

function calcWageIncreaseRate(prevWage: number, currWage: number) {
  if (prevWage === 0) return { rate: 100, tier: 'half' };
  const rate = ((currWage - prevWage) / prevWage) * 100;
  if (rate >= 3.0) return { rate, tier: 'quarter' };
  if (rate >= 1.5) return { rate, tier: 'half' };
  return { rate, tier: 'none' };
}

function calcWageGap(prevWage: number, currWage: number): number | null {
  const target = prevWage * 1.015;
  if (currWage >= target) return null;
  return Math.ceil(target - currWage);
}

interface YearlyResult { year: number; assessedValue: number; normalTax: number; specialTax: number; saving: number; }

function calcAssetTaxSchedule(acquisitionCost: number, usefulLife: number, specialRate: number, specialYears: number, taxRate = 0.014): YearlyResult[] {
  const depRate = DEPRECIATION_RATES[usefulLife];
  const minValue = Math.floor(acquisitionCost * 0.05);
  const results: YearlyResult[] = [];
  let value = Math.floor(acquisitionCost * (1 - depRate / 2));
  for (let y = 1; y <= usefulLife; y++) {
    if (value < minValue) value = minValue;
    const normalTax = Math.floor(value * taxRate);
    const appliedRate = y <= specialYears ? specialRate : 1.0;
    const specialTax = Math.floor(value * appliedRate * taxRate);
    results.push({ year: y, assessedValue: value, normalTax, specialTax, saving: normalTax - specialTax });
    value = Math.floor(value * (1 - depRate));
  }
  return results;
}

function checkExemption(currentStandardAmount: number, newAssetValue: number) {
  const total = currentStandardAmount + newAssetValue;
  return { exempt: total < 150, total };
}

function calcNetBenefit(input: {
  prevWage: number; currWage: number; currentStandardAmount: number;
  acquisitionCost: number; equipmentType: string; usefulLife: number;
}) {
  const minCost = MIN_COSTS[input.equipmentType];
  if (input.acquisitionCost < minCost) return { eligible: false, reason: 'below_minimum', minCost };
  const wage = calcWageIncreaseRate(input.prevWage, input.currWage);
  if (wage.tier === 'none') {
    const gap = calcWageGap(input.prevWage, input.currWage);
    return { eligible: false, reason: 'wage_insufficient', gap, rate: wage.rate };
  }
  const costYen = input.acquisitionCost * 10000;
  const depRate = DEPRECIATION_RATES[input.usefulLife];
  const firstYearValue = Math.floor(costYen * (1 - depRate / 2));
  const exemption = checkExemption(input.currentStandardAmount, firstYearValue / 10000);
  if (exemption.exempt) return { eligible: false, reason: 'below_exemption', total: exemption.total };
  const specialRate = wage.tier === 'quarter' ? 0.25 : 0.5;
  const specialYears = wage.tier === 'quarter' ? 5 : 3;
  const schedule = calcAssetTaxSchedule(costYen, input.usefulLife, specialRate, specialYears);
  const totalSaving = schedule.reduce((sum, r) => sum + r.saving, 0);
  return { eligible: true, wageTier: wage.tier, wageRate: wage.rate, schedule, totalSaving, specialRate, specialYears };
}

// ============ ゴールデン検証 ============
let pass = 0, fail = 0;
const TOL = 1;

function check(label: string, actual: number, expected: number) {
  const ok = Math.abs(actual - expected) <= TOL;
  console.log(`${ok ? '✓' : '✗'} ${label}: actual=${actual}, expected=${expected}`);
  if (ok) pass++; else fail++;
}
function checkBool(label: string, actual: boolean, expected: boolean) {
  const ok = actual === expected;
  console.log(`${ok ? '✓' : '✗'} ${label}: actual=${actual}, expected=${expected}`);
  if (ok) pass++; else fail++;
}
function checkStr(label: string, actual: string, expected: string) {
  const ok = actual === expected;
  console.log(`${ok ? '✓' : '✗'} ${label}: actual=${actual}, expected=${expected}`);
  if (ok) pass++; else fail++;
}

console.log('\n=== ケース1: 機械200万・10年・賃上げ2.1% ===');
const r1 = calcNetBenefit({ prevWage:1000, currWage:1021, currentStandardAmount:200, acquisitionCost:200, equipmentType:'machinery', usefulLife:10 }) as any;
checkBool('eligible', r1.eligible, true);
checkStr('wageTier', r1.wageTier, 'half');
check('totalSaving', r1.totalSaving, 30446);
check('schedule[0].assessedValue', r1.schedule[0].assessedValue, 1794000);
check('schedule[0].normalTax', r1.schedule[0].normalTax, 25116);
check('schedule[0].specialTax', r1.schedule[0].specialTax, 12558);
check('schedule[0].saving', r1.schedule[0].saving, 12558);
check('schedule[1].normalTax', r1.schedule[1].normalTax, 19942);
check('schedule[2].normalTax', r1.schedule[2].normalTax, 15834);

console.log('\n=== ケース2: 器具備品50万・5年・賃上げ4.0% ===');
const r2 = calcNetBenefit({ prevWage:1000, currWage:1040, currentStandardAmount:200, acquisitionCost:50, equipmentType:'fixtures', usefulLife:5 }) as any;
checkBool('eligible', r2.eligible, true);
checkStr('wageTier', r2.wageTier, 'quarter');
check('totalSaving', r2.totalSaving, 10442);
check('schedule[0].assessedValue', r2.schedule[0].assessedValue, 407750);
check('schedule[0].normalTax', r2.schedule[0].normalTax, 5708);
check('schedule[0].specialTax', r2.schedule[0].specialTax, 1427);
check('schedule[0].saving', r2.schedule[0].saving, 4281);

console.log('\n=== ケース3: 機械100万（下限未満） ===');
const r3 = calcNetBenefit({ prevWage:1000, currWage:1021, currentStandardAmount:200, acquisitionCost:100, equipmentType:'machinery', usefulLife:10 }) as any;
checkBool('eligible', r3.eligible, false);
checkStr('reason', r3.reason, 'below_minimum');
check('minCost', r3.minCost, 160);

console.log('\n=== ケース4: 賃上げ0.5% (1000→1005万) ===');
const r4 = calcNetBenefit({ prevWage:1000, currWage:1005, currentStandardAmount:200, acquisitionCost:200, equipmentType:'machinery', usefulLife:10 }) as any;
checkBool('eligible', r4.eligible, false);
checkStr('reason', r4.reason, 'wage_insufficient');
check('gap', r4.gap, 10);

console.log('\n=== ケース5: 課税標準10万+器具備品30万→免税点 ===');
const r5 = calcNetBenefit({ prevWage:100, currWage:102, currentStandardAmount:10, acquisitionCost:30, equipmentType:'fixtures', usefulLife:5 }) as any;
checkBool('eligible', r5.eligible, false);
checkStr('reason', r5.reason, 'below_exemption');
const r5ok = r5.total < 150;
console.log(`${r5ok ? '✓' : '✗'} total<150: actual=${r5.total}`);
if (r5ok) pass++; else fail++;

console.log(`\n=== 結果: ${pass}/${pass+fail} PASS ===`);
if (fail > 0) process.exit(1);
