// Estimating question router.
//
// Handles two families of questions:
//   1. "Estimate a 42m² plastering job" → build a fresh Estimate
//   2. "Why 18 boards?" / "what's my profit?" → explain from the last
//      Estimate (caller passes it in — engine is stateless)

import { buildEstimate, type BuildEstimateResult } from "./engine";
import { explainLine, speakLine } from "./explain";
import type { Estimate, EstimateContext } from "./types";

export type EstimateQuestion =
  | { kind: "build";      brief: string; tradeHint?: string }
  | { kind: "explain";    hint:  string }
  | { kind: "profit" }
  | { kind: "compare_suppliers" }
  | { kind: "list_trades" }
  | { kind: "none" };

/** Classify a merchant utterance. Order matters — most specific first. */
export function classifyEstimateQuestion(text: string): EstimateQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\b(estimate|quote|price|cost)\b/.test(t) && /\b(\d+(?:\.\d+)?)\s*(m2|m²|m3|m³|sq|square|metres?|cubic|by|x|×)/.test(t)) {
    return { kind: "build", brief: text.trim() };
  }
  if (/^\s*(why|how)\b/.test(t))                        return { kind: "explain", hint: text };
  if (/\b(what'?s?\s+my\s+profit|profit\s+margin|how\s+much\s+profit)\b/.test(t)) return { kind: "profit" };
  if (/\bcompare\s+suppliers?\b/.test(t))               return { kind: "compare_suppliers" };
  if (/\bwhich\s+trades?\s+(can|do)\s+you\b/.test(t))   return { kind: "list_trades" };
  return { kind: "none" };
}

export type AnswerInput = {
  question: EstimateQuestion;
  /** For "explain" / "profit" — the estimate to reason about. */
  lastEstimate?: Estimate;
  /** For "build" — merchant context. */
  context?:      EstimateContext;
};

export async function answerEstimate(input: AnswerInput): Promise<{
  speak:     string;
  estimate?: Estimate;
  suggestions?: string[];
}> {
  switch (input.question.kind) {
    case "build": {
      const res: BuildEstimateResult = await buildEstimate({
        brief:     input.question.brief,
        tradeHint: input.question.tradeHint,
        context:   input.context
      });
      if (!res.ok) {
        if (res.reason === "no_trade_matched") {
          return {
            speak: "I couldn't tell which trade or how much work that is. Try \"estimate 42 m² of plastering\" or \"quote 1.5 m³ concrete pour\".",
            suggestions: ["Estimate 42 m² plastering", "Quote 1.5 m³ concrete", "Which trades can you estimate?"]
          };
        }
        return { speak: `That didn't work: ${res.detail ?? "adapter failed"}.` };
      }
      return {
        speak:    formatEstimateSummary(res.estimate),
        estimate: res.estimate,
        suggestions: ["Why that many hours?", "Send as quotation", "Compare suppliers"]
      };
    }

    case "explain": {
      if (!input.lastEstimate) return { speak: "Ask me for an estimate first, then I'll explain any number in it." };
      const line = explainLine(input.lastEstimate, input.question.hint);
      if (!line) return { speak: "I don't see that on the last estimate. Try naming one of the line labels." };
      return { speak: speakLine(line) };
    }

    case "profit": {
      const e = input.lastEstimate;
      if (!e) return { speak: "Ask me for an estimate first — I calculate profit inside every estimate." };
      const gbp = (p: number) => `£${(p / 100).toLocaleString("en-GB")}`;
      return {
        speak: [
          `Profit on the ${e.scope} estimate: ${gbp(e.profit_pence)}.`,
          `Cost £${(e.subtotal_pence / 100).toLocaleString("en-GB")} + overhead £${(e.overhead_pence / 100).toLocaleString("en-GB")} = £${((e.subtotal_pence + e.overhead_pence) / 100).toLocaleString("en-GB")}.`,
          `Margin ${e.defaults.profit_margin_pct}% (${e.defaults.source.profit_margin === "merchant" ? "your default" : "engine default"}).`
        ].join("\n")
      };
    }

    case "compare_suppliers": {
      return {
        speak: "Supplier comparison needs a live supplier-price feed — I don't have one wired for you yet. When your merchants publish their trade-prices I'll rank them here automatically.",
        suggestions: ["Estimate something else", "Send as quotation"]
      };
    }

    case "list_trades": {
      const { listTrades } = await import("./registry");
      const trades = listTrades();
      return {
        speak: "I can estimate:\n" + trades.map((t) => `- ${t.label}`).join("\n") + "\n\nMore trades land as one file each — ask me and I'll flag it for the roadmap."
      };
    }

    case "none":
      return { speak: "" };
  }
}

/** One-block summary of an estimate for the chat reply. */
export function formatEstimateSummary(e: Estimate): string {
  const gbp = (p: number) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const lines: string[] = [];
  lines.push(`${e.trade_label}: ${e.scope}`);
  lines.push("");
  lines.push(`- Materials: ${gbp(e.materials_pence)}`);
  lines.push(`- Labour: ${gbp(e.labour_pence)} (${e.labour_hours} h across ${e.crew_size} · ~${e.duration_days} day${e.duration_days === 1 ? "" : "s"})`);
  if (e.plant_pence > 0)    lines.push(`- Plant: ${gbp(e.plant_pence)}`);
  if (e.delivery_pence > 0) lines.push(`- Delivery: ${gbp(e.delivery_pence)}`);
  lines.push(`- Waste: ${gbp(e.waste_pence)}`);
  lines.push(`- Overhead: ${gbp(e.overhead_pence)}`);
  lines.push(`- Profit: ${gbp(e.profit_pence)}`);
  lines.push(`- VAT: ${gbp(e.vat_pence)}`);
  lines.push(`- Total (inc VAT): ${gbp(e.total_pence)}`);
  if (e.warnings.length > 0) {
    lines.push("");
    for (const w of e.warnings) lines.push(`- Warning: ${w}`);
  }
  return lines.join("\n");
}
