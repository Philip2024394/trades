// Simulation dispatcher. Given a merchant + a canned scenario,
// runs the right scenario runner and returns a formatted reply.

import {
  runAdvertisingBoost,
  runExtraHire,
  runFuelIncrease,
  runPriceRise,
  runVanPurchase
} from "./scenarios";
import { NO_PERSIST_DISCLAIMER, type ScenarioKind, type ScenarioResult, type SimulationReply } from "./types";

export type SimulationInput = {
  merchantSlug: string;
  scenario:     ScenarioKind;
  parameters:   Record<string, unknown>;
};

export async function runSimulation(input: SimulationInput): Promise<SimulationReply> {
  const now = new Date();
  const errors: SimulationReply["errors"] = [];
  const results: ScenarioResult[] = [];

  try {
    switch (input.scenario) {
      case "fuel_increase": {
        const pct = Number(input.parameters.pct ?? 20);
        results.push(await runFuelIncrease(input.merchantSlug, { pct }));
        break;
      }
      case "price_rise": {
        const pct = Number(input.parameters.pct ?? 10);
        results.push(await runPriceRise(input.merchantSlug, { pct }));
        break;
      }
      case "extra_hire": {
        const trade = String(input.parameters.trade ?? "carpenter");
        const annual = Number(input.parameters.annual_cost_gbp ?? 30_000);
        results.push(await runExtraHire(input.merchantSlug, { trade, annual_cost_gbp: annual }));
        break;
      }
      case "van_purchase": {
        const price = Number(input.parameters.price_gbp ?? 25_000);
        results.push(await runVanPurchase(input.merchantSlug, { price_gbp: price }));
        break;
      }
      case "advertising_boost": {
        const monthly = Number(input.parameters.monthly_gbp ?? 500);
        results.push(await runAdvertisingBoost(input.merchantSlug, { monthly_gbp: monthly }));
        break;
      }
    }
  } catch (err) {
    errors.push({ scenario: input.scenario, error: err instanceof Error ? err.message : String(err) });
  }

  return {
    computed_at:   now.toISOString(),
    merchant_slug: input.merchantSlug,
    results,
    speak:         formatSimulation(results),
    errors
  };
}

// ─── Formatter ─────────────────────────────────────────────

function formatSimulation(results: ScenarioResult[]): string {
  if (results.length === 0) return "No scenario ran — the parameters didn't produce anything.";
  const lines: string[] = [];
  for (const r of results) {
    lines.push(r.headline);
    if (r.deltas.length > 0) {
      lines.push("");
      for (const d of r.deltas) {
        const before = fmt(d.before, d.unit);
        const after  = fmt(d.after,  d.unit);
        const diff   = d.diff === null ? "" : ` (${d.diff > 0 ? "+" : ""}${fmt(d.diff, d.unit)})`;
        lines.push(`- ${d.label}: ${before} → ${after}${diff}`);
      }
    }
    if (r.assumptions.length > 0) {
      lines.push("");
      lines.push("Assumptions:");
      for (const a of r.assumptions) lines.push(`- ${a}`);
    }
    lines.push("");
    lines.push(NO_PERSIST_DISCLAIMER);
  }
  return lines.join("\n");
}

function fmt(v: number | null, unit: string): string {
  if (v === null) return "—";
  switch (unit) {
    case "gbp":   return `£${(v / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
    case "pct":   return `${v}%`;
    case "count": return `${v}`;
    case "days":  return `${v} days`;
    case "hours": return `${v} h`;
    default:      return `${v}`;
  }
}

export { formatSimulation };
