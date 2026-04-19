"use client";

import { useState } from "react";
import {
  calcWageIncreaseRate,
  calcWageGap,
  calcAssetTaxSchedule,
  checkExemption,
  EQUIPMENT_LABELS,
  MIN_COSTS,
  ASSET_CATEGORIES,
  DEPRECIATION_RATES,
  type EquipmentType,
  type WageTier,
  type YearlyResult,
} from "@/lib/calc";

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface EquipmentEntry {
  id: number;
  equipmentType: EquipmentType;
  assetCategory: string;
  acquisitionCost: string;
  usefulLife: string;
}

interface FormValues {
  prevWage: string;
  currWage: string;
  currentStandardAmount: string;
  equipment: EquipmentEntry[];
}

let nextId = 1;

function createEquipmentEntry(): EquipmentEntry {
  return {
    id: nextId++,
    equipmentType: "fixtures",
    assetCategory: "0",
    acquisitionCost: "",
    usefulLife: "5",
  };
}

const DEFAULT_FORM: FormValues = {
  prevWage: "",
  currWage: "",
  currentStandardAmount: "",
  equipment: [createEquipmentEntry()],
};

const USEFUL_LIFE_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 3);

// ---------------------------------------------------------------------------
// 複数設備の計算結果
// ---------------------------------------------------------------------------

interface EquipmentResult {
  entry: EquipmentEntry;
  label: string;
  eligible: boolean;
  reason?: string;
  minCost?: number;
  schedule?: YearlyResult[];
  totalSaving?: number;
  specialRate?: number;
  specialYears?: number;
  firstYearValue?: number; // 初年度評価額（万円）
}

type MultiResult = {
  type: "wage_insufficient";
  wageRate: number;
  gap: number | null;
} | {
  type: "below_exemption";
  total: number;
} | {
  type: "calculated";
  wageTier: WageTier;
  wageRate: number;
  wageIncrease: number;
  equipmentResults: EquipmentResult[];
  grandTotalSaving: number;
  exemptionTotal: number;
}

function calcMultiEquipment(
  prevWage: number,
  currWage: number,
  currentStandardAmount: number,
  equipment: EquipmentEntry[],
): MultiResult {
  // Step 1: 賃上げ率チェック
  const wage = calcWageIncreaseRate(prevWage, currWage);
  if (wage.tier === "none") {
    const gap = calcWageGap(prevWage, currWage);
    return { type: "wage_insufficient", wageRate: wage.rate, gap };
  }

  // Step 2: 各設備の初年度評価額を計算し、免税点チェック
  let totalFirstYearValue = 0;
  const equipmentResults: EquipmentResult[] = [];

  for (const entry of equipment) {
    const cost = parseFloat(entry.acquisitionCost);
    const minCost = MIN_COSTS[entry.equipmentType];
    const label = EQUIPMENT_LABELS[entry.equipmentType];
    const cats = ASSET_CATEGORIES[entry.equipmentType];
    const catLabel = entry.assetCategory === "custom"
      ? "手動入力"
      : cats[parseInt(entry.assetCategory)]?.label ?? "";
    const displayLabel = `${catLabel}`;

    // 金額要件チェック
    if (cost < minCost) {
      equipmentResults.push({
        entry,
        label: displayLabel,
        eligible: false,
        reason: "below_minimum",
        minCost,
      });
      continue;
    }

    const costYen = cost * 10000;
    const usefulLife = parseInt(entry.usefulLife);
    const depRate = DEPRECIATION_RATES[usefulLife];
    const firstYearValue = Math.floor(costYen * (1 - depRate / 2)) / 10000;
    totalFirstYearValue += firstYearValue;

    const specialRate = wage.tier === "quarter" ? 0.25 : 0.5;
    const specialYears = wage.tier === "quarter" ? 5 : 3;
    const schedule = calcAssetTaxSchedule(costYen, usefulLife, specialRate, specialYears);
    const totalSaving = schedule.reduce((sum, r) => sum + r.saving, 0);

    equipmentResults.push({
      entry,
      label: displayLabel,
      eligible: true,
      schedule,
      totalSaving,
      specialRate,
      specialYears,
      firstYearValue,
    });
  }

  // 免税点チェック（全設備合計）
  const exemptionTotal = currentStandardAmount + totalFirstYearValue;
  if (exemptionTotal < 150) {
    return { type: "below_exemption", total: exemptionTotal };
  }

  const grandTotalSaving = equipmentResults
    .filter((r) => r.eligible)
    .reduce((sum, r) => sum + (r.totalSaving ?? 0), 0);

  return {
    type: "calculated",
    wageTier: wage.tier,
    wageRate: wage.rate,
    wageIncrease: currWage - prevWage,
    equipmentResults,
    grandTotalSaving,
    exemptionTotal,
  };
}

// ---------------------------------------------------------------------------
// Tooltip コンポーネント
// ---------------------------------------------------------------------------

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label="説明を表示"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 cursor-pointer text-blue-500 text-xs border border-blue-300 rounded-full px-1.5 py-0.5 leading-none hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        ?
      </button>
      {open && (
        <span className="absolute left-0 top-full mt-1 z-20 w-72 max-w-[90vw] bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl leading-relaxed">
          {text}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="block mt-2 text-gray-400 hover:text-white underline text-xs"
          >
            閉じる
          </button>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 共通コンポーネント
// ---------------------------------------------------------------------------

function Disclaimer() {
  return (
    <div className="mt-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 leading-relaxed">
      この数値は一般的な計算式に基づく概算です。具体的な申請判断は税理士等の専門家にご相談ください。
    </div>
  );
}

function ResultHeader() {
  return (
    <header className="mb-4 text-center">
      <h1 className="text-lg sm:text-xl font-bold text-gray-800">計算結果</h1>
    </header>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="w-full mt-4 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 rounded-xl text-base transition-colors"
    >
      条件を変えて再計算
    </button>
  );
}

function ScheduleTable({ schedule }: { schedule: YearlyResult[] }) {
  const totalNormal = schedule.reduce((s, r) => s + r.normalTax, 0);
  const totalSpecial = schedule.reduce((s, r) => s + r.specialTax, 0);
  const totalSaving = schedule.reduce((s, r) => s + r.saving, 0);

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs sm:text-sm border-collapse min-w-[340px]">
        <thead>
          <tr className="bg-gray-100 text-gray-600">
            <th className="text-left py-2 px-2 font-medium rounded-tl-lg">年度</th>
            <th className="text-right py-2 px-2 font-medium">特例なし</th>
            <th className="text-right py-2 px-2 font-medium">特例あり</th>
            <th className="text-right py-2 px-2 font-medium rounded-tr-lg text-blue-700">軽減額</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((row) => (
            <tr key={row.year} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 text-gray-600">{row.year}年目</td>
              <td className="py-2 px-2 text-right text-gray-700">{fmt(row.normalTax)}円</td>
              <td className="py-2 px-2 text-right text-gray-700">{fmt(row.specialTax)}円</td>
              <td className="py-2 px-2 text-right font-medium text-blue-700">
                {row.saving > 0 ? `${fmt(row.saving)}円` : "—"}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
            <td className="py-2 px-2 text-gray-700">累計</td>
            <td className="py-2 px-2 text-right text-gray-700">{fmt(totalNormal)}円</td>
            <td className="py-2 px-2 text-right text-gray-700">{fmt(totalSpecial)}円</td>
            <td className="py-2 px-2 text-right text-blue-700">{fmt(totalSaving)}円</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 結果画面（複数設備対応）
// ---------------------------------------------------------------------------

function MultiResultView({
  result,
  onReset,
}: {
  result: MultiResult;
  onReset: () => void;
}) {
  // 賃上げ率不足
  if (result.type === "wage_insufficient") {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <ResultHeader />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold text-gray-800">
                  賃上げ率が{result.wageRate.toFixed(2)}%のため、特例を受けられない可能性があります
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  <strong>給与総額1.5%以上の賃上げ</strong>が要件です。
                </p>
              </div>
            </div>
            {result.gap != null && result.gap > 0 && (
              <div className="ml-9 p-3 rounded-lg bg-blue-50 text-sm text-blue-800">
                あと <strong>{fmt(Math.ceil(result.gap))}万円</strong> の賃上げで1.5%に届きます
              </div>
            )}
          </div>
          <Disclaimer />
          <ResetButton onReset={onReset} />
        </div>
      </main>
    );
  }

  // 免税点以下
  if (result.type === "below_exemption") {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <ResultHeader />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">ℹ️</span>
              <div>
                <p className="font-semibold text-gray-800">
                  課税標準額の合計が150万円未満のため、そもそも償却資産税がかかりません
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  全設備の評価額合計が
                  <strong> 約{fmt(Math.round(result.total))}万円</strong>
                  と見込まれ、免税点を下回っています。特例を使うメリットはありません。
                </p>
              </div>
            </div>
          </div>
          <Disclaimer />
          <ResetButton onReset={onReset} />
        </div>
      </main>
    );
  }

  // 計算結果表示
  const { wageTier, wageRate, wageIncrease, equipmentResults, grandTotalSaving } = result;
  const eligibleResults = equipmentResults.filter((r) => r.eligible);
  const ineligibleResults = equipmentResults.filter((r) => !r.eligible);
  const tierLabel = wageTier === "quarter" ? "3.0%以上（最大優遇）" : "1.5%以上3.0%未満";
  const specialRateLabel = wageTier === "quarter" ? "1/4" : "1/2";
  const specialYears = wageTier === "quarter" ? 5 : 3;

  // 3%未満の場合の比較計算
  let quarterGrandTotal: number | null = null;
  if (wageTier === "half") {
    quarterGrandTotal = 0;
    for (const er of eligibleResults) {
      const costYen = parseFloat(er.entry.acquisitionCost) * 10000;
      const ul = parseInt(er.entry.usefulLife);
      const qSchedule = calcAssetTaxSchedule(costYen, ul, 0.25, 5);
      quarterGrandTotal += qSchedule.reduce((s, r) => s + r.saving, 0);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <ResultHeader />

        {/* 適用区分 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">あなたの賃上げ区分</h2>
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-bold text-gray-800">
                賃上げ率{wageRate < 100 ? `${wageRate.toFixed(2)}%` : "（新規雇用）"}
                <span className="ml-2 text-sm font-normal text-gray-500">— {tierLabel}</span>
              </p>
              <p className="text-sm text-blue-700 mt-1">
                課税標準 <strong>{specialRateLabel}</strong> x <strong>{specialYears}年間</strong> の特例が適用される見込みです
              </p>
            </div>
          </div>
        </div>

        {/* 金額要件未達の設備がある場合 */}
        {ineligibleResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5">
            <h2 className="text-sm font-semibold text-amber-600 mb-2">対象外の設備</h2>
            {ineligibleResults.map((r) => (
              <p key={r.entry.id} className="text-sm text-gray-700">
                <strong>{r.label}</strong>（{fmt(parseFloat(r.entry.acquisitionCost))}万円）
                — {EQUIPMENT_LABELS[r.entry.equipmentType]}は{r.minCost}万円以上が必要です
              </p>
            ))}
          </div>
        )}

        {/* 設備ごとの年度別シミュレーション */}
        {eligibleResults.map((er, idx) => (
          <div key={er.entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-1">
              設備{eligibleResults.length > 1 ? ` ${idx + 1}` : ""}: {er.label}
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              {fmt(parseFloat(er.entry.acquisitionCost))}万円 / 耐用{er.entry.usefulLife}年
            </p>
            {er.schedule && <ScheduleTable schedule={er.schedule} />}
            <p className="text-sm text-blue-700 font-semibold mt-2 text-right">
              軽減額: {fmt(er.totalSaving ?? 0)}円
            </p>
          </div>
        ))}

        {/* 人件費増 vs 節税額 トータル比較 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">経営判断サマリ</h2>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-100 gap-0.5">
              <span className="text-sm text-gray-600">賃上げによる人件費増加（年間）</span>
              <span className="text-sm font-semibold text-red-600 sm:text-right">+{fmt(wageIncrease * 10000)}円</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-100 gap-0.5">
              <span className="text-sm text-gray-600">特例による節税額（{specialYears}年累計・全設備合計）</span>
              <span className="text-sm font-semibold text-blue-700 sm:text-right">-{fmt(grandTotalSaving)}円</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-100 gap-0.5">
              <span className="text-sm text-gray-600">人件費増加（{specialYears}年累計）</span>
              <span className="text-sm font-semibold text-red-600 sm:text-right">+{fmt(wageIncrease * 10000 * specialYears)}円</span>
            </div>
            <div className={`py-3 px-3 rounded-lg ${(grandTotalSaving - wageIncrease * 10000 * specialYears) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="text-sm font-bold text-gray-800 block">差引（節税 - 人件費増 x {specialYears}年）</span>
              <span className={`text-xl font-bold block mt-1 ${(grandTotalSaving - wageIncrease * 10000 * specialYears) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {(grandTotalSaving - wageIncrease * 10000 * specialYears) >= 0 ? '+' : ''}{fmt(grandTotalSaving - wageIncrease * 10000 * specialYears)}円
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            ※ 人件費増は賃上げが特例期間中も維持される前提での概算です。節税額だけでなく、人材確保・定着への投資効果も含めてご判断ください。
          </p>
        </div>

        {/* 累計軽減額 強調 */}
        <div className="bg-blue-600 rounded-xl p-5 text-white text-center">
          <p className="text-sm opacity-80 mb-1">
            全{eligibleResults.length}件の設備投資で
          </p>
          <p className="text-3xl font-bold">
            約 {fmt(Math.round(grandTotalSaving / 1000) * 1000)} 円
          </p>
          <p className="text-sm opacity-80 mt-1">の償却資産税軽減が見込まれます</p>
        </div>

        {/* 3.0%なら比較 */}
        {wageTier === "half" && quarterGrandTotal !== null && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">賃上げ率3.0%以上なら？</h2>
            <p className="text-sm text-gray-700">
              1/4 x 5年間の適用で、さらに
              <strong className="text-green-700 mx-1">約{fmt(Math.round((quarterGrandTotal - grandTotalSaving) / 1000) * 1000)}円</strong>
              の追加軽減が見込まれます
            </p>
            <p className="text-xs text-gray-500 mt-1">
              （合計で約{fmt(Math.round(quarterGrandTotal / 1000) * 1000)}円程度の軽減見込み）
            </p>
          </div>
        )}

        {/* 次のステップ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">次のステップ</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5">1.</span>
              認定支援機関に相談してください（商工会議所・商工会は無料で対応）
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5">2.</span>
              <strong>設備取得「前」</strong>に先端設備等導入計画の認定申請が必要です
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5">3.</span>
              適用期限は令和9年3月31日までです
            </li>
          </ul>
        </div>

        <Disclaimer />
        <ResetButton onReset={onReset} />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// 設備入力行コンポーネント
// ---------------------------------------------------------------------------

function EquipmentRow({
  entry,
  index,
  total,
  onChange,
  onRemove,
}: {
  entry: EquipmentEntry;
  index: number;
  total: number;
  onChange: (updated: EquipmentEntry) => void;
  onRemove: () => void;
}) {
  const errors: Record<string, string> = {};

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          設備 {total > 1 ? index + 1 : ""}
        </h3>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            削除
          </button>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">設備の種類</label>
          <select
            value={entry.equipmentType}
            onChange={(e) => {
              const eqType = e.target.value as EquipmentType;
              const cats = ASSET_CATEGORIES[eqType];
              onChange({
                ...entry,
                equipmentType: eqType,
                assetCategory: "0",
                usefulLife: String(cats[0].usefulLife),
              });
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            {(Object.entries(EQUIPMENT_LABELS) as [EquipmentType, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}（{MIN_COSTS[k]}万円以上）
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            具体的な資産の種類
            <Tooltip text="該当する資産を選ぶと耐用年数が自動設定されます。一覧にない場合は「その他（手動入力）」を選んでください" />
          </label>
          <select
            value={entry.assetCategory}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "custom") {
                onChange({ ...entry, assetCategory: "custom" });
              } else {
                const cats = ASSET_CATEGORIES[entry.equipmentType];
                const cat = cats[parseInt(val)];
                onChange({
                  ...entry,
                  assetCategory: val,
                  usefulLife: String(cat.usefulLife),
                });
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            {ASSET_CATEGORIES[entry.equipmentType].map((cat, i) => (
              <option key={i} value={String(i)}>
                {cat.label}（{cat.usefulLife}年）
              </option>
            ))}
            <option value="custom">その他（手動入力）</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">購入金額（税抜）</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={entry.acquisitionCost}
              onChange={(e) =>
                onChange({ ...entry, acquisitionCost: e.target.value })
              }
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={`例: ${MIN_COSTS[entry.equipmentType]}`}
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">万円</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            ※ 設置費・運搬費を含む金額です（見積書や契約書の金額）
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            耐用年数
            {entry.assetCategory !== "custom" && (
              <span className="text-xs text-green-600 ml-2">（自動設定済み）</span>
            )}
          </label>
          <select
            value={entry.usefulLife}
            onChange={(e) =>
              onChange({ ...entry, usefulLife: e.target.value })
            }
            disabled={entry.assetCategory !== "custom"}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white ${entry.assetCategory !== "custom" ? "bg-gray-50 text-gray-500" : ""}`}
          >
            {USEFUL_LIFE_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 入力フォーム（メインページ）
// ---------------------------------------------------------------------------

export default function Home() {
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [submitted, setSubmitted] = useState<MultiResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const prevWageNum = parseFloat(form.prevWage) || 0;
  const currWageNum = parseFloat(form.currWage) || 0;
  const wageInfo =
    form.prevWage !== "" || form.currWage !== ""
      ? calcWageIncreaseRate(prevWageNum, currWageNum)
      : null;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const pv = parseFloat(form.prevWage);
    const cv = parseFloat(form.currWage);
    const sa = parseFloat(form.currentStandardAmount);

    if (form.prevWage === "" || isNaN(pv) || pv < 0)
      errs.prevWage = "0以上の数値を入力してください";
    if (form.currWage === "" || isNaN(cv) || cv < 0)
      errs.currWage = "0以上の数値を入力してください";
    if (form.currentStandardAmount !== "" && (isNaN(sa) || sa < 0))
      errs.currentStandardAmount = "0以上の数値を入力してください";

    for (let i = 0; i < form.equipment.length; i++) {
      const ac = parseFloat(form.equipment[i].acquisitionCost);
      if (form.equipment[i].acquisitionCost === "" || isNaN(ac) || ac <= 0)
        errs[`equipment_${i}_cost`] = "0より大きい数値を入力してください";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const standardAmount = form.currentStandardAmount === "" ? 150 : parseFloat(form.currentStandardAmount);
    const result = calcMultiEquipment(
      prevWageNum,
      currWageNum,
      standardAmount,
      form.equipment,
    );
    setSubmitted(result);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleReset() {
    setSubmitted(null);
    setForm(DEFAULT_FORM);
    setErrors({});
  }

  function updateEquipment(index: number, updated: EquipmentEntry) {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.map((eq, i) => (i === index ? updated : eq)),
    }));
  }

  function addEquipment() {
    setForm((f) => ({
      ...f,
      equipment: [...f.equipment, createEquipmentEntry()],
    }));
  }

  function removeEquipment(index: number) {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.filter((_, i) => i !== index),
    }));
  }

  if (submitted) {
    return <MultiResultView result={submitted} onReset={handleReset} />;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* ヘッダー */}
        <header className="mb-6 text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
            先端設備等導入計画
            <br className="sm:hidden" />
            &nbsp;かんたん損得チェック
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            入力するだけで、特例を使うと
            <br className="sm:hidden" />
            いくら軽減が見込まれるか計算できます
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* ① 従業員への給与 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                ①
              </span>
              <span>従業員への給与</span>
              <Tooltip text="従業員全員に支払った給与・賞与の年間合計です（社長の報酬は除く）。源泉徴収簿や賃金台帳、または年末に税務署に出す書類で確認できます" />
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  昨年の給与総額（年間合計）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={form.prevWage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, prevWage: e.target.value }))
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="例: 500"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">万円</span>
                </div>
                {errors.prevWage && (
                  <p className="text-red-500 text-xs mt-1">{errors.prevWage}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  今年の給与総額（予定でOK）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={form.currWage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, currWage: e.target.value }))
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="例: 510"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">万円</span>
                </div>
                {errors.currWage && (
                  <p className="text-red-500 text-xs mt-1">{errors.currWage}</p>
                )}
              </div>

              {/* 賃上げ率 自動計算 */}
              {wageInfo && (
                <div className="p-3 rounded-lg bg-blue-50 text-sm">
                  <span className="text-gray-600">賃上げ率（自動計算）：</span>
                  <span
                    className={`font-bold ml-1 ${
                      wageInfo.tier === "none"
                        ? "text-red-600"
                        : wageInfo.tier === "quarter"
                        ? "text-green-700"
                        : "text-blue-700"
                    }`}
                  >
                    {wageInfo.rate >= 100
                      ? "新規雇用（1.5%超確定）"
                      : `${wageInfo.rate.toFixed(2)}%`}
                  </span>
                  {wageInfo.tier === "none" && (
                    <span className="text-red-500 ml-2 text-xs">
                      （1.5%未満 — 特例見込みなし）
                    </span>
                  )}
                  {wageInfo.tier === "half" && (
                    <span className="text-blue-600 ml-2 text-xs">
                      → 1/2 x 3年の特例見込み
                    </span>
                  )}
                  {wageInfo.tier === "quarter" && (
                    <span className="text-green-600 ml-2 text-xs">
                      → 1/4 x 5年の最大特例見込み
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ② 今持っている設備の状況 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                ②
              </span>
              <span>今持っている設備の状況</span>
              <Tooltip text="毎年届く「固定資産税・都市計画税 納税通知書」の中にある「償却資産」の「課税標準額」欄の金額です。通知書が手元にない場合は空欄のまま計算できます（150万円として概算します）" />
            </h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                償却資産の課税標準額
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={form.currentStandardAmount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      currentStandardAmount: e.target.value,
                    }))
                  }
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="わからなければ空欄でOK"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">万円</span>
              </div>
              {errors.currentStandardAmount && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.currentStandardAmount}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                ※ 空欄の場合は150万円（税金がかかる最低ライン）として計算します
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ※ まだ設備を持っていない（届出をしていない）場合は「0」と入力してください
              </p>
            </div>
          </section>

          {/* ③ 今回の設備投資 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                ③
              </span>
              <span>今回の設備投資</span>
              <Tooltip text="購入を検討している設備について入力してください。複数ある場合は「設備を追加」ボタンで追加できます" />
            </h2>

            {form.equipment.map((entry, i) => (
              <div key={entry.id}>
                <EquipmentRow
                  entry={entry}
                  index={i}
                  total={form.equipment.length}
                  onChange={(updated) => updateEquipment(i, updated)}
                  onRemove={() => removeEquipment(i)}
                />
                {errors[`equipment_${i}_cost`] && (
                  <p className="text-red-500 text-xs mt-1 ml-2">
                    設備{form.equipment.length > 1 ? ` ${i + 1}` : ""}: {errors[`equipment_${i}_cost`]}
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addEquipment}
              className="w-full border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 font-medium py-3 rounded-xl text-sm transition-colors"
            >
              + 設備を追加
            </button>
          </section>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 rounded-xl text-base transition-colors shadow-sm"
          >
            計算する
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4 pb-8">
          ※ 入力情報はサーバーに送信されません
        </p>
      </div>
    </main>
  );
}
