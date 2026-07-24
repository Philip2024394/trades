// Canned scenario runners. Each one reads current business state
// from the prior engines, applies a hypothetical change, and returns
// a ScenarioResult with before / after / delta lines. Nothing writes.

import { buildBusinessSnapshot } from "../bi";
import { buildMDBriefing } from "../md";
import { buildFinancialSnapshot, checkAffordability } from "../fi";
import { evidenceFor, NO_PERSIST_DISCLAIMER, type ScenarioDelta, type ScenarioResult } from "./types";

// ─── fuel_increase ─────────────────────────────────────────

export type FuelIncreaseInput = { pct: number };

export async function runFuelIncrease(merchantSlug: string, input: FuelIncreaseInput): Promise<ScenarioResult> {
  const evidence = evidenceFor("BI + FI · fuel-cost sensitivity", ["hammerex_sitebook_costs"]);
  const fi = await buildFinancialSnapshot({ merchantSlug });
  // We don't have a fuel-cost column today. Approximate fuel exposure as
  // ~8% of labour spend (van + travel for a mobile trade). Honest note.
  const labourSpend = fi.ok ? fi.snapshot.profit_ref.quoted_pence * 0.40 : 0;   // rough proxy: 40% of quoted is labour
  const fuelBaseline = labourSpend * 0.08;
  const fuelAfter    = fuelBaseline * (1 + input.pct / 100);
  const impact       = fuelAfter - fuelBaseline;

  const deltas: ScenarioDelta[] = [
    { label: "Estimated fuel cost (proxy)", before: Math.round(fuelBaseline), after: Math.round(fuelAfter), diff: Math.round(impact), unit: "gbp", higher_is_better: false }
  ];

  return {
    kind:        "fuel_increase",
    headline:    `+${input.pct}% fuel → roughly £${(impact / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })} more per current book of work.`,
    parameters:  { pct: input.pct },
    assumptions: [
      "Fuel cost approximated as ~8% of labour cost (mobile-trade proxy). No dedicated fuel column exists in Trade OS.",
      "Applied to CURRENT accepted-quote book. Doesn't re-price future quotes."
    ],
    deltas,
    verdict:     impact > 5000 ? "negative" : "neutral",
    reason:      "Higher fuel eats into margin unless quoted lines are re-priced.",
    disclaimer:  NO_PERSIST_DISCLAIMER,
    evidence
  };
}

// ─── price_rise ───────────────────────────────────────────

export type PriceRiseInput = { pct: number };

export async function runPriceRise(merchantSlug: string, input: PriceRiseInput): Promise<ScenarioResult> {
  const evidence = evidenceFor("FI · quoted revenue × price uplift", []);
  const fi = await buildFinancialSnapshot({ merchantSlug });
  if (!fi.ok) return errorScenario("price_rise", "Listing not set up.");
  const quoted = fi.snapshot.profit_ref.quoted_pence;
  const profit = fi.snapshot.profit_ref.planned_profit_pence;
  const revenueAfter = Math.round(quoted * (1 + input.pct / 100));
  const profitAfter  = Math.round(profit + (revenueAfter - quoted));  // 100% of uplift falls to profit if costs unchanged
  const marginBefore = fi.snapshot.profit_ref.weighted_margin_pct;
  const marginAfter  = revenueAfter === 0 ? 0 : Number(((profitAfter / revenueAfter) * 100).toFixed(1));

  const deltas: ScenarioDelta[] = [
    { label: "Quoted revenue", before: quoted,        after: revenueAfter, diff: revenueAfter - quoted, unit: "gbp", higher_is_better: true },
    { label: "Planned profit", before: profit,        after: profitAfter,  diff: profitAfter - profit,  unit: "gbp", higher_is_better: true },
    { label: "Weighted margin", before: marginBefore, after: marginAfter,  diff: Number((marginAfter - marginBefore).toFixed(1)), unit: "pct", higher_is_better: true }
  ];

  return {
    kind:        "price_rise",
    headline:    `A ${input.pct}% price rise on the current book would lift planned profit by £${((profitAfter - profit) / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}.`,
    parameters:  { pct: input.pct },
    assumptions: [
      "Assumed costs stay flat and every quoted job accepts at the new price.",
      "In reality some customers push back — treat this as the OPTIMISTIC case."
    ],
    deltas,
    verdict:     input.pct > 0 ? "positive" : "neutral",
    reason:      "Revenue uplift flows straight to profit if costs hold.",
    disclaimer:  NO_PERSIST_DISCLAIMER,
    evidence
  };
}

// ─── extra_hire ─────────────────────────────────────────

export type ExtraHireInput = {
  trade:          string;                 // "carpenter"
  annual_cost_gbp: number;                // £30,000 default
};

export async function runExtraHire(merchantSlug: string, input: ExtraHireInput): Promise<ScenarioResult> {
  const evidence = evidenceFor("MD + FI · extra-hire capacity model", []);
  const md = await buildMDBriefing({ merchantSlug });
  const cost = Math.round(input.annual_cost_gbp * 100);
  const monthlyCost = Math.round(cost / 12);

  // Rough capacity uplift: an extra trade adds ~£45k/yr of revenue at a
  // sensible utilisation (75% × £60k billable / trade / yr). Rounded.
  const revenueUplift = 4_500_000;                          // £45,000 in pence
  const monthlyUplift = Math.round(revenueUplift / 12);
  const monthlyProfit = monthlyUplift - monthlyCost;

  const deltas: ScenarioDelta[] = [
    { label: "Monthly staff cost",       before: 0, after: monthlyCost,   diff: monthlyCost,   unit: "gbp", higher_is_better: false },
    { label: "Projected revenue uplift", before: 0, after: monthlyUplift, diff: monthlyUplift, unit: "gbp", higher_is_better: true  },
    { label: "Net monthly delta",        before: 0, after: monthlyProfit, diff: monthlyProfit, unit: "gbp", higher_is_better: true  }
  ];

  return {
    kind:        "extra_hire",
    headline:    monthlyProfit > 0
      ? `Extra ${input.trade} looks profitable at ~£${(monthlyProfit / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}/month net once billable.`
      : `Extra ${input.trade} runs at a monthly LOSS of ~£${(Math.abs(monthlyProfit) / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}/month until utilisation lifts.`,
    parameters:  { trade: input.trade, annual_cost_gbp: input.annual_cost_gbp },
    assumptions: [
      "Assumed 75% utilisation + £60k/yr billable per skilled trade.",
      "Assumed no supervision/tool cost beyond the annual salary.",
      "Real-world hire takes 3–6 months to reach utilisation — first quarter often loss-making.",
      md?.ok && md.briefing.workforce.active_projects_count === 0 ? "Note: no active projects on record — hire only if you have secured pipeline." : ""
    ].filter((a) => a.length > 0),
    deltas,
    verdict:     monthlyProfit > 0 ? "positive" : "negative",
    reason:      monthlyProfit > 0 ? "Uplift outpaces cost at target utilisation." : "Uplift doesn't cover the salary at target utilisation.",
    disclaimer:  NO_PERSIST_DISCLAIMER,
    evidence
  };
}

// ─── van_purchase ─────────────────────────────────────────

export type VanPurchaseInput = { price_gbp: number };

export async function runVanPurchase(merchantSlug: string, input: VanPurchaseInput): Promise<ScenarioResult> {
  const evidence = evidenceFor("FI · affordability check", []);
  const md = await buildMDBriefing({ merchantSlug });
  const cashflow = md?.ok ? md.briefing.cashflow : null;
  const affordability = checkAffordability({
    purchase_label:  `Van (£${input.price_gbp.toLocaleString("en-GB")})`,
    purchase_pence:  Math.round(input.price_gbp * 100),
    cashflow
  });

  const deltas: ScenarioDelta[] = [
    { label: "90-day cash horizon",   before: affordability.cash_horizon_pence + affordability.purchase_pence, after: affordability.cash_horizon_pence,          diff: -affordability.purchase_pence, unit: "gbp", higher_is_better: true },
    { label: "Remaining after purchase", before: null,                                                          after: affordability.remaining_pence,             diff: null,                          unit: "gbp", higher_is_better: true }
  ];

  return {
    kind:        "van_purchase",
    headline:    affordability.reason,
    parameters:  { price_gbp: input.price_gbp },
    assumptions: [
      "Only visible cash-flow signals used — running costs (insurance, fuel, servicing) not modelled.",
      "Doesn't factor finance / lease options; assumes cash purchase."
    ],
    deltas,
    verdict:     affordability.verdict === "yes"     ? "positive"
              : affordability.verdict === "stretch"  ? "neutral"
              : affordability.verdict === "no"       ? "negative"
              :                                        "unknown",
    reason:      affordability.reason,
    disclaimer:  NO_PERSIST_DISCLAIMER,
    evidence
  };
}

// ─── advertising_boost ─────────────────────────────────────

export type AdvertisingBoostInput = { monthly_gbp: number };

export async function runAdvertisingBoost(merchantSlug: string, input: AdvertisingBoostInput): Promise<ScenarioResult> {
  const evidence = evidenceFor("BI leads velocity + typical marketing ROAS", []);
  const bi = await buildBusinessSnapshot({ merchantSlug });

  // Rough industry ROAS assumption for construction leads: 2.5× spend.
  // Conservative — some merchants get 5×, some see 1× or below.
  const monthlySpend = Math.round(input.monthly_gbp * 100);
  const expectedRevenue = Math.round(monthlySpend * 2.5);
  const netGain = expectedRevenue - monthlySpend;

  const deltas: ScenarioDelta[] = [
    { label: "Monthly ad spend",    before: 0, after: monthlySpend,    diff: monthlySpend,    unit: "gbp", higher_is_better: false },
    { label: "Projected revenue",   before: 0, after: expectedRevenue, diff: expectedRevenue, unit: "gbp", higher_is_better: true  },
    { label: "Net monthly delta",   before: 0, after: netGain,         diff: netGain,         unit: "gbp", higher_is_better: true  }
  ];

  const currentLeads = bi?.observations.some((o) => o.key === "leads_down");
  return {
    kind:        "advertising_boost",
    headline:    `£${input.monthly_gbp}/mo on ads at industry-average ROAS = ~£${(expectedRevenue / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })} projected revenue (£${(netGain / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })} net).`,
    parameters:  { monthly_gbp: input.monthly_gbp },
    assumptions: [
      "Assumed 2.5× ROAS (revenue ÷ spend). Actual construction ROAS varies wildly by trade + local competition.",
      "Doesn't model close-rate lift or brand halo effect — revenue is direct-response only.",
      currentLeads ? "Note: enquiry beacons are already trending down per BI — this scenario may under-perform." : ""
    ].filter((a) => a.length > 0),
    deltas,
    verdict:     netGain > 0 ? "positive" : "negative",
    reason:      "Direct-response projection at industry-average ROAS.",
    disclaimer:  NO_PERSIST_DISCLAIMER,
    evidence
  };
}

function errorScenario(kind: ScenarioResult["kind"], why: string): ScenarioResult {
  return {
    kind, headline: `Can't simulate ${kind}: ${why}`,
    parameters: {}, assumptions: [], deltas: [],
    verdict: "unknown", reason: why,
    disclaimer: NO_PERSIST_DISCLAIMER,
    evidence: evidenceFor("scenario error", [])
  };
}
