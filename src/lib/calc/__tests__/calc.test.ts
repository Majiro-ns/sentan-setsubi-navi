import { calcNetBenefit, calcAssetTaxSchedule, calcWageIncreaseRate, calcWageGap } from '../index';

// 許容誤差 ±1円
const TOLERANCE = 1;

function expectNear(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

// ========================================================
// ケース1: 機械装置200万・耐用10年・賃上げ2.1%（1/2×3年）
// ========================================================
describe('ケース1: 機械装置200万・耐用10年・賃上げ2.1% (1/2×3年)', () => {
  // prevWage=1000, currWage=1021 → rate=2.1%
  const result = calcNetBenefit({
    prevWage: 1000,
    currWage: 1021,
    currentStandardAmount: 200,
    acquisitionCost: 200,
    equipmentType: 'machinery',
    usefulLife: 10,
  });

  test('eligible=true', () => {
    expect(result.eligible).toBe(true);
  });

  test('wageTier=half', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expect(result.wageTier).toBe('half');
  });

  test('totalSaving=30446(±1)', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.totalSaving, 30446);
  });

  test('schedule[0]: assessedValue=1794000', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].assessedValue, 1794000);
  });

  test('schedule[0]: normalTax=25116', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].normalTax, 25116);
  });

  test('schedule[0]: specialTax=12558', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].specialTax, 12558);
  });

  test('schedule[0]: saving=12558', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].saving, 12558);
  });

  test('schedule[1]: normalTax=19942', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[1].normalTax, 19942);
  });

  test('schedule[2]: normalTax=15834', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[2].normalTax, 15834);
  });
});

// ========================================================
// ケース2: 器具備品50万・耐用5年・賃上げ4.0%（1/4×5年）
// ========================================================
describe('ケース2: 器具備品50万・耐用5年・賃上げ4.0% (1/4×5年)', () => {
  // prevWage=1000, currWage=1040 → rate=4.0%
  const result = calcNetBenefit({
    prevWage: 1000,
    currWage: 1040,
    currentStandardAmount: 200,
    acquisitionCost: 50,
    equipmentType: 'fixtures',
    usefulLife: 5,
  });

  test('eligible=true', () => {
    expect(result.eligible).toBe(true);
  });

  test('wageTier=quarter', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expect(result.wageTier).toBe('quarter');
  });

  test('totalSaving=10442(±1)', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.totalSaving, 10442);
  });

  test('schedule[0]: assessedValue=407750', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].assessedValue, 407750);
  });

  test('schedule[0]: normalTax=5708', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].normalTax, 5708);
  });

  test('schedule[0]: specialTax=1427', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].specialTax, 1427);
  });

  test('schedule[0]: saving=4281', () => {
    if (!result.eligible) throw new Error('should be eligible');
    expectNear(result.schedule[0].saving, 4281);
  });
});

// ========================================================
// ケース3: 機械装置100万（下限160万未満）→ 対象外
// ========================================================
describe('ケース3: 機械装置100万 (下限160万未満)', () => {
  const result = calcNetBenefit({
    prevWage: 1000,
    currWage: 1021,
    currentStandardAmount: 200,
    acquisitionCost: 100,
    equipmentType: 'machinery',
    usefulLife: 10,
  });

  test('eligible=false', () => {
    expect(result.eligible).toBe(false);
  });

  test('reason=below_minimum', () => {
    if (result.eligible) throw new Error('should be ineligible');
    expect(result.reason).toBe('below_minimum');
  });

  test('minCost=160', () => {
    if (result.eligible) throw new Error('should be ineligible');
    if (result.reason !== 'below_minimum') throw new Error('wrong reason');
    expect(result.minCost).toBe(160);
  });
});

// ========================================================
// ケース4: 賃上げ0.5%（1000万→1005万）→ 賃上げ不足
// ========================================================
describe('ケース4: 賃上げ0.5% (1000→1005万)', () => {
  const result = calcNetBenefit({
    prevWage: 1000,
    currWage: 1005,
    currentStandardAmount: 200,
    acquisitionCost: 200,
    equipmentType: 'machinery',
    usefulLife: 10,
  });

  test('eligible=false', () => {
    expect(result.eligible).toBe(false);
  });

  test('reason=wage_insufficient', () => {
    if (result.eligible) throw new Error('should be ineligible');
    expect(result.reason).toBe('wage_insufficient');
  });

  test('gap=10 (ceil(1000*1.015-1005))', () => {
    if (result.eligible) throw new Error('should be ineligible');
    if (result.reason !== 'wage_insufficient') throw new Error('wrong reason');
    // Math.ceil(1000 * 1.015 - 1005) = Math.ceil(1015 - 1005) = Math.ceil(10) = 10
    expect(result.gap).toBe(10);
  });
});

// ========================================================
// ケース5: 課税標準10万 + 器具備品30万・耐用5年 → 免税点
// ========================================================
describe('ケース5: 課税標準10万 + 器具備品30万 → 免税点(合計<150万)', () => {
  // 賃上げは十分とする (prevWage=100, currWage=102 → 2% → half)
  const result = calcNetBenefit({
    prevWage: 100,
    currWage: 102,
    currentStandardAmount: 10,
    acquisitionCost: 30,
    equipmentType: 'fixtures',
    usefulLife: 5,
  });

  test('eligible=false', () => {
    expect(result.eligible).toBe(false);
  });

  test('reason=below_exemption', () => {
    if (result.eligible) throw new Error('should be ineligible');
    expect(result.reason).toBe('below_exemption');
  });

  test('total < 150', () => {
    if (result.eligible) throw new Error('should be ineligible');
    if (result.reason !== 'below_exemption') throw new Error('wrong reason');
    expect(result.total).toBeLessThan(150);
  });
});
