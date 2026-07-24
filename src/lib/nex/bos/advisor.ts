// Morning Intelligence Report composer.
//
// Extends Phase 22 ops/briefing with the Phase 25 predictive layer.
// The advisor composes:
//   • Greeting (name-aware)
//   • Risks (predict.ts)
//   • Growth opportunities (growth.ts)
//   • Industry signals (industry.ts, when observations were passed in)
//   • Decisions the merchant is currently weighing (optional array)
//   • Actions Nex is willing to draft (from actions.ts)
//
// Every composition is pure — no persistence, no side-effects. The
// morning report can be re-run any hour and produces the same shape.

import { predictRisks, type PredictInput } from "./predict";
import { detectIndustrySignals, type DetectIndustrySignalsInput } from "./industry";
import { suggestGrowth, type SuggestGrowthInput } from "./growth";
import { makeDecision } from "./decision";
import { suggestActions, type SuggestActionsInput } from "./actions";
import type {
  ActionSuggestion,
  DecisionInput,
  DecisionSuggestion,
  GrowthOpportunity,
  IndustrySignal,
  MorningReport,
  RiskSignal
} from "./types";

export type BuildMorningReportInput = {
  merchant_slug: string;
  merchant_name: string;
  predict?:      PredictInput;
  growth?:       SuggestGrowthInput;
  industry?:     DetectIndustrySignalsInput;
  actions?:      SuggestActionsInput;
  /** Decisions the merchant is currently weighing (e.g. "another van"). */
  weighing?:     Array<{ input: DecisionInput; finance: PredictInput["finance"] }>;
};

export function buildMorningReport(input: BuildMorningReportInput): MorningReport {
  const risks:     RiskSignal[]         = input.predict  ? predictRisks(input.predict)             : [];
  const growth:    GrowthOpportunity[]  = input.growth   ? suggestGrowth(input.growth)             : [];
  const industry:  IndustrySignal[]     = input.industry ? detectIndustrySignals(input.industry)   : [];
  const decisions: DecisionSuggestion[] = (input.weighing ?? []).map((w) => makeDecision({ input: w.input, finance: w.finance ?? null }));
  const actions:   ActionSuggestion[]   = input.actions  ? suggestActions(input.actions)           : [];

  const unavailable: string[] = [];
  if (!input.predict)  unavailable.push("Predictive risks (no snapshot supplied this run)");
  if (!input.growth)   unavailable.push("Growth opportunities (no completed-project tally supplied)");
  if (!input.industry) unavailable.push("Industry signals (no market observations supplied)");
  if (!input.actions)  unavailable.push("Action drafts (no reminder/quote inputs supplied)");

  const errors: MorningReport["errors"] = [];

  return {
    computed_at:      new Date().toISOString(),
    merchant_slug:    input.merchant_slug,
    merchant_name:    input.merchant_name,
    greeting:         composeGreeting(input.merchant_name),
    overall_headline: composeOverallHeadline(risks, growth, decisions),
    risks,
    growth,
    industry,
    decisions,
    actions,
    unavailable,
    errors
  };
}

function composeGreeting(name: string): string {
  const hour = new Date().getHours();
  const stem = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${stem} ${name}.`;
}

function composeOverallHeadline(risks: RiskSignal[], growth: GrowthOpportunity[], decisions: DecisionSuggestion[]): string {
  const criticalCount = risks.filter((r) => r.severity === "critical").length;
  const warningCount  = risks.filter((r) => r.severity === "warning").length;
  const parts: string[] = [];
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (warningCount > 0)  parts.push(`${warningCount} warning${warningCount === 1 ? "" : "s"}`);
  if (growth.length > 0) parts.push(`${growth.length} growth ${growth.length === 1 ? "opportunity" : "opportunities"}`);
  if (decisions.length > 0) parts.push(`${decisions.length} decision${decisions.length === 1 ? "" : "s"} to weigh`);
  return parts.length === 0 ? "Nothing urgent today. Steady state." : `Today: ${parts.join(", ")}.`;
}

// ─── Formatter: Morning report → merchant-facing text ───────────

export function formatMorningReport(r: MorningReport): string {
  const lines: string[] = [];
  lines.push(r.greeting);
  lines.push("");
  lines.push(r.overall_headline);

  if (r.risks.length > 0) {
    lines.push("");
    lines.push("Risks:");
    for (const risk of r.risks) {
      const badge = risk.severity === "critical" ? "!!" : risk.severity === "warning" ? "!" : "·";
      const prob  = risk.probability_pct !== null ? ` (${risk.probability_pct}% likely)` : "";
      lines.push(`  ${badge} ${risk.headline}${prob}`);
      lines.push(`     Next step. ${risk.suggested_action}`);
    }
  }

  if (r.growth.length > 0) {
    lines.push("");
    lines.push("Growth opportunities:");
    for (const g of r.growth) {
      lines.push(`  · ${g.headline}`);
      lines.push(`     Next step. ${g.suggested_action}`);
    }
  }

  if (r.industry.length > 0) {
    lines.push("");
    lines.push("Industry signals:");
    for (const s of r.industry) {
      const pct = s.change_pct === null ? "" : ` (${s.change_pct > 0 ? "+" : ""}${s.change_pct.toFixed(0)}%)`;
      lines.push(`  · ${s.headline}${pct}`);
    }
  }

  if (r.decisions.length > 0) {
    lines.push("");
    lines.push("Decisions:");
    for (const d of r.decisions) {
      lines.push(`  · ${d.input.purchase_label}: ${d.verdict.toUpperCase()}${d.wait_days ? ` (wait ~${d.wait_days} days)` : ""}`);
      lines.push(`     ${d.reason}`);
    }
  }

  if (r.actions.length > 0) {
    lines.push("");
    lines.push("Ready to draft (your approval needed):");
    for (const a of r.actions) {
      lines.push(`  · ${a.target_label}`);
    }
  }

  if (r.unavailable.length > 0) {
    lines.push("");
    lines.push("Not shown this run:");
    for (const u of r.unavailable) lines.push(`  · ${u}`);
  }

  return lines.join("\n");
}
