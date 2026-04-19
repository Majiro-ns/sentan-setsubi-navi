"use client";

import { useState } from "react";
import {
  calcNetBenefit,
  calcWageIncreaseRate,
  calcAssetTaxSchedule,
  EQUIPMENT_LABELS,
  MIN_COSTS,
  ASSET_CATEGORIES,
  type EquipmentType,
  type NetBenefitResult,
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

interface FormValues {
  prevWage: string;
  currWage: string;
  currentStandardAmount: string;
  acquisitionCost: string;
  equipmentType: EquipmentType;
  assetCategory: string;   // ASSET_CATEGORIES内のインデックス or "custom"
  usefulLife: string;
}

const DEFAULT_FORM: FormValues = {
  prevWage: "",
  currWage: "",
  currentStandardAmount: "",
  acquisitionCost: "",
  equipmentType: "fixtures",
  assetCategory: "0",
  usefulLife: "5",
};

const USEFUL_LIFE_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 3);

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
        💡
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
// 結果画面
// ---------------------------------------------------------------------------

function Disclaimer() {
  return (
    <div className="mt-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 leading-relaxed">
      ⚠️ この数値は一般的な計算式に基づく概算です。具体的な申請判断は税理士等の専門家にご相談ください。
    </div>
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

function ResultView({
  result,
  form,
  onReset,
}: {
  result: NetBenefitResult;
  form: FormValues;
  onReset: () => void;
}) {
  const equipmentLabel = EQUIPMENT_LABELS[form.equipmentType];
  const acquisitionCost = parseFloat(form.acquisitionCost);
  const usefulLife = parseInt(form.usefulLife);

  // ケース1: 設備金額要件未達
  if (!result.eligible && result.reason === "below_minimum") {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <ResultHeader />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">❌</span>
              <div>
                <p className="font-semibold text-gray-800 leading-relaxed">
                  この設備は金額要件を満たしていません
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {equipmentLabel}は <strong>{result.minCost}万円以上</strong> が対象となります。
                  現在の入力値（{fmt(acquisitionCost)}万円）は要件額を下回っています。
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

  // ケース2: 賃上げ率不足
  if (!result.eligible && result.reason === "wage_insufficient") {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <ResultHeader />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold text-gray-800">
                  賃上げ率が{result.rate !== undefined ? result.rate.toFixed(2) : "—"}%のため、現行制度では特例を受けられない可能性があります
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  令和7年4月改正後の制度では、<strong>給与総額1.5%以上の賃上げ表明</strong>が要件となっています。
                </p>
              </div>
            </div>
            {result.gap != null && result.gap > 0 && (
              <div className="ml-9 p-3 rounded-lg bg-blue-50 text-sm text-blue-800">
                💡 あと <strong>{fmt(Math.ceil(result.gap))}万円</strong> の賃上げで1.5%に届く可能性があります
              </div>
            )}
          </div>
          <Disclaimer />
          <ResetButton onReset={onReset} />
        </div>
      </main>
    );
  }

  // ケース3: 免税点以下
  if (!result.eligible && result.reason === "below_exemption") {
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
                  現在の課税標準額 + 新規設備の評価額の合計が
                  <strong> 約{result.total !== undefined ? fmt(Math.round(result.total)) : "—"}万円</strong>
                  と見込まれ、免税点（150万円）を下回っています。
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  先端設備の特例を使うメリットはありません。
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

  // ケース4/5: 特例適用可能
  if (result.eligible) {
    const { wageTier, wageRate, schedule, totalSaving, specialRate, specialYears, wageIncrease, netEffect } = result;
    const tierLabel =
      wageTier === "quarter"
        ? "3.0%以上（最大優遇）"
        : "1.5%以上3.0%未満";
    const specialRateLabel = wageTier === "quarter" ? "1/4" : "1/2";

    // 半分適用の場合、3.0%以上の場合の比較計算
    let quarterSaving: number | null = null;
    let additionalSaving: number | null = null;
    if (wageTier === "half") {
      const costYen = acquisitionCost * 10000;
      const qSchedule = calcAssetTaxSchedule(costYen, usefulLife, 0.25, 5);
      quarterSaving = qSchedule.reduce((s, r) => s + r.saving, 0);
      additionalSaving = quarterSaving - (totalSaving ?? 0);
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
                  賃上げ率{wageRate !== undefined && wageRate < 100 ? `${wageRate.toFixed(2)}%` : "（新規雇用）"}
                  <span className="ml-2 text-sm font-normal text-gray-500">— {tierLabel}</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  課税標準 <strong>{specialRateLabel}</strong> × <strong>{specialYears}年間</strong> の特例が適用される見込みです
                </p>
              </div>
            </div>
          </div>

          {/* 年度別シミュレーション表 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">年度別 税額シミュレーション</h2>
            {schedule && <ScheduleTable schedule={schedule} />}
          </div>

          {/* 人件費増 vs 節税額 トータル比較 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">経営判断サマリ</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">賃上げによる人件費増加（年間）</span>
                <span className="text-sm font-semibold text-red-600">+{fmt(wageIncrease * 10000)}円</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">特例による節税額（{specialYears}年累計）</span>
                <span className="text-sm font-semibold text-blue-700">-{fmt(totalSaving)}円</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">人件費増加（{specialYears}年累計）</span>
                <span className="text-sm font-semibold text-red-600">+{fmt(wageIncrease * 10000 * specialYears)}円</span>
              </div>
              <div className={`flex justify-between items-center py-3 px-3 rounded-lg ${netEffect >= 0 ? 'bg-red-50' : 'bg-red-50'}`}>
                <span className="text-sm font-bold text-gray-800">差引（節税 - 人件費増×{specialYears}年）</span>
                <span className={`text-lg font-bold ${(totalSaving - wageIncrease * 10000 * specialYears) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {(totalSaving - wageIncrease * 10000 * specialYears) >= 0 ? '+' : ''}{fmt(totalSaving - wageIncrease * 10000 * specialYears)}円
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
              この設備投資で、{specialYears}年間で
            </p>
            <p className="text-3xl font-bold">
              約 {fmt(Math.round((totalSaving ?? 0) / 1000) * 1000)} 円
            </p>
            <p className="text-sm opacity-80 mt-1">の償却資産税軽減が見込まれます</p>
          </div>

          {/* 3.0%なら比較 */}
          {wageTier === "half" && quarterSaving !== null && additionalSaving !== null && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-500 mb-2">💡 賃上げ率3.0%以上なら？</h2>
              <p className="text-sm text-gray-700">
                1/4 × 5年間の適用で、さらに
                <strong className="text-green-700 mx-1">約{fmt(Math.round(additionalSaving / 1000) * 1000)}円</strong>
                の追加軽減が見込まれます
              </p>
              <p className="text-xs text-gray-500 mt-1">
                （合計で約{fmt(Math.round(quarterSaving / 1000) * 1000)}円程度の軽減見込み）
              </p>
            </div>
          )}

          {/* 免税点チェック結果 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">⚠️ 免税点チェック</h2>
            <p className="text-sm text-gray-700">
              現在の課税標準額 + 新規設備の評価額の合計が 150万円以上のため、
              償却資産税の課税対象となっています。
            </p>
          </div>

          {/* 次のステップ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">📋 次のステップ</h2>
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

  // フォールバック（到達しないはず）
  return null;
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

// ---------------------------------------------------------------------------
// 入力フォーム（メインページ）
// ---------------------------------------------------------------------------

export default function Home() {
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [submitted, setSubmitted] = useState<{
    result: NetBenefitResult;
    form: FormValues;
  } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const prevWageNum = parseFloat(form.prevWage) || 0;
  const currWageNum = parseFloat(form.currWage) || 0;
  const wageInfo =
    form.prevWage !== "" || form.currWage !== ""
      ? calcWageIncreaseRate(prevWageNum, currWageNum)
      : null;

  function validate(): boolean {
    const errs: Partial<Record<keyof FormValues, string>> = {};
    const pv = parseFloat(form.prevWage);
    const cv = parseFloat(form.currWage);
    const sa = parseFloat(form.currentStandardAmount);
    const ac = parseFloat(form.acquisitionCost);

    if (form.prevWage === "" || isNaN(pv) || pv < 0)
      errs.prevWage = "0以上の数値を入力してください";
    if (form.currWage === "" || isNaN(cv) || cv < 0)
      errs.currWage = "0以上の数値を入力してください";
    if (form.currentStandardAmount === "" || isNaN(sa) || sa < 0)
      errs.currentStandardAmount = "0以上の数値を入力してください";
    if (form.acquisitionCost === "" || isNaN(ac) || ac <= 0)
      errs.acquisitionCost = "0より大きい数値を入力してください";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const result = calcNetBenefit({
      prevWage: prevWageNum,
      currWage: currWageNum,
      currentStandardAmount: parseFloat(form.currentStandardAmount),
      acquisitionCost: parseFloat(form.acquisitionCost),
      equipmentType: form.equipmentType,
      usefulLife: parseInt(form.usefulLife),
    });
    setSubmitted({ result, form });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleReset() {
    setSubmitted(null);
    setForm(DEFAULT_FORM);
    setErrors({});
  }

  if (submitted) {
    return (
      <ResultView
        result={submitted.result}
        form={submitted.form}
        onReset={handleReset}
      />
    );
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
            3項目を入力するだけで、特例を使うと
            <br className="sm:hidden" />
            いくら軽減が見込まれるか計算できます
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* ① 給与の状況 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                ①
              </span>
              <span>給与の状況</span>
              <Tooltip text="従業員全員に支払った給与・賞与の合計（役員報酬は除く）。源泉徴収簿や賃金台帳で確認できます" />
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  前期の給与総額
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
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    万円
                  </span>
                </div>
                {errors.prevWage && (
                  <p className="text-red-500 text-xs mt-1">{errors.prevWage}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  当期の給与総額
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
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    万円
                  </span>
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
                      → 1/2 × 3年の特例見込み
                    </span>
                  )}
                  {wageInfo.tier === "quarter" && (
                    <span className="text-green-600 ml-2 text-xs">
                      → 1/4 × 5年の最大特例見込み
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ② 償却資産の状況 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                ②
              </span>
              <span>償却資産の状況</span>
              <Tooltip text="毎年届く「固定資産税・都市計画税 納税通知書」の償却資産の欄に記載されている金額です" />
            </h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                現在の課税標準額
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
                  placeholder="例: 200"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  万円
                </span>
              </div>
              {errors.currentStandardAmount && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.currentStandardAmount}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                ※ まだ償却資産がない場合は「0」と入力してください
              </p>
            </div>
          </section>

          {/* ③ 今回の設備投資 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                ③
              </span>
              <span>今回の設備投資</span>
              <Tooltip text="取得価額は設備の購入金額（税抜）。据付費・運搬費を含みます。耐用年数は国税庁の「耐用年数表」で確認できます" />
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  設備の種類
                </label>
                <select
                  value={form.equipmentType}
                  onChange={(e) => {
                    const eqType = e.target.value as EquipmentType;
                    const cats = ASSET_CATEGORIES[eqType];
                    setForm((f) => ({
                      ...f,
                      equipmentType: eqType,
                      assetCategory: "0",
                      usefulLife: String(cats[0].usefulLife),
                    }));
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                >
                  {(
                    Object.entries(EQUIPMENT_LABELS) as [EquipmentType, string][]
                  ).map(([k, v]) => (
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
                  value={form.assetCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "custom") {
                      setForm((f) => ({ ...f, assetCategory: "custom" }));
                    } else {
                      const cats = ASSET_CATEGORIES[form.equipmentType];
                      const cat = cats[parseInt(val)];
                      setForm((f) => ({
                        ...f,
                        assetCategory: val,
                        usefulLife: String(cat.usefulLife),
                      }));
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                >
                  {ASSET_CATEGORIES[form.equipmentType].map((cat, i) => (
                    <option key={i} value={String(i)}>
                      {cat.label}（{cat.usefulLife}年）
                    </option>
                  ))}
                  <option value="custom">その他（手動入力）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  取得価額
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={form.acquisitionCost}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        acquisitionCost: e.target.value,
                      }))
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder={`例: ${MIN_COSTS[form.equipmentType]}`}
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    万円
                  </span>
                </div>
                {errors.acquisitionCost && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.acquisitionCost}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  耐用年数
                  {form.assetCategory !== "custom" && (
                    <span className="text-xs text-green-600 ml-2">（自動設定済み）</span>
                  )}
                </label>
                <select
                  value={form.usefulLife}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, usefulLife: e.target.value }))
                  }
                  disabled={form.assetCategory !== "custom"}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white ${form.assetCategory !== "custom" ? "bg-gray-50 text-gray-500" : ""}`}
                >
                  {USEFUL_LIFE_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}年
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
