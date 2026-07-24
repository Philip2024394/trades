// BOS answer router — classifier + entry point for chat.
//
// Handles Phase 25 asks:
//   • "morning intelligence report" / "run business intelligence"
//   • "predict risks on my projects"
//   • "what's happening in my market?"
//   • "growth opportunities"
//   • "can I afford X?"        (delegates to decision.ts)
//   • "what do I know about plumbing?"  (delegates to graph.ts)
//   • "draft the reminders"    (returns action drafts)

import { buildMorningReport, formatMorningReport, type BuildMorningReportInput } from "./advisor";
import { predictRisks, type PredictInput } from "./predict";
import { detectIndustrySignals, type DetectIndustrySignalsInput } from "./industry";
import { suggestGrowth, type SuggestGrowthInput } from "./growth";
import { makeDecision } from "./decision";
import { suggestActions, type SuggestActionsInput } from "./actions";
import { getTradeNode, findTradesMatching } from "./graph";
import type { FinancialSnapshot } from "../fi/types";
import type { DecisionInput, MorningReport } from "./types";

export type BOSQuestion =
  | { kind: "morning_report" }
  | { kind: "predict_risks" }
  | { kind: "industry_signals" }
  | { kind: "growth_opportunities" }
  | { kind: "afford"; label: string; price_pence: number; urgency: "now" | "soon" | "flexible" }
  | { kind: "trade_graph"; trade: string }
  | { kind: "draft_actions" }
  | { kind: "none" };

const AFFORD_RE = /\bcan\s+i\s+afford\s+(?:a\s+|an\s+|another\s+)?([a-z0-9 -]+?)(?:\s+(?:for|at)\s+£?\s?([\d,]+))?\?*$/i;

export function classifyBOSQuestion(ask: string): BOSQuestion {
  const t = ask.trim().toLowerCase();

  if (/\bmorning\s+(intelligence\s+)?report\b/.test(t)
    || /\bbusiness\s+(intelligence|status|briefing)\b/.test(t)
    || /\brun\s+my\s+business\s+intelligence\b/.test(t)) {
    return { kind: "morning_report" };
  }
  if (/\bpredict\b|\brisk\s+report\b|\bwhat\s+could\s+go\s+wrong\b|\bproject\s+risks\b/.test(t)) {
    return { kind: "predict_risks" };
  }
  if (/\bmarket\s+(signals?|trends?)\b|\bindustry\s+(signals?|trends?)\b|\bwhat'?s\s+happening\s+in\s+my\s+market\b/.test(t)) {
    return { kind: "industry_signals" };
  }
  if (/\bgrowth\s+(opportunities|opps?)\b|\bwhere\s+can\s+i\s+grow\b|\bhow\s+can\s+i\s+grow\b/.test(t)) {
    return { kind: "growth_opportunities" };
  }
  const affordMatch = ask.match(AFFORD_RE);
  if (affordMatch) {
    const label = (affordMatch[1] ?? "").trim() || "the purchase";
    const priceGbp = affordMatch[2] ? parseInt(affordMatch[2].replace(/,/g, ""), 10) : 25_000;
    const urgency: DecisionInput["urgency"] = /\bnow\b|\btoday\b/.test(t) ? "now" : /\bsoon\b|\bthis\s+month\b/.test(t) ? "soon" : "flexible";
    return { kind: "afford", label, price_pence: priceGbp * 100, urgency };
  }
  const tradeMatch = ask.match(/\bwhat\s+do\s+i\s+know\s+about\s+([a-z][a-z ]+?)\??$/i)
    ?? ask.match(/\btell\s+me\s+about\s+the\s+([a-z][a-z ]+?)\s+trade\b/i);
  if (tradeMatch) return { kind: "trade_graph", trade: tradeMatch[1]!.trim() };

  if (/\bdraft\s+(the\s+)?(reminders?|actions?|follow[- ]ups?|quotes?)\b/.test(t)) {
    return { kind: "draft_actions" };
  }
  return { kind: "none" };
}

// ─── Answerer ───────────────────────────────────────────────────

export type AnswerBOSInput = {
  question:      BOSQuestion;
  merchant_slug: string;
  merchant_name: string;
  finance?:      FinancialSnapshot | null;
  predict_input?: PredictInput;
  industry_input?: DetectIndustrySignalsInput;
  growth_input?:   SuggestGrowthInput;
  actions_input?:  SuggestActionsInput;
};

export type AnswerBOSResult = {
  speak: string;
  data?: {
    morning_report?: MorningReport;
    trade_node?:     ReturnType<typeof getTradeNode>;
    decision?:       ReturnType<typeof makeDecision>;
  };
};

export async function answerBOS(input: AnswerBOSInput): Promise<AnswerBOSResult> {
  const q = input.question;

  switch (q.kind) {
    case "morning_report": {
      const buildInput: BuildMorningReportInput = {
        merchant_slug: input.merchant_slug,
        merchant_name: input.merchant_name,
        predict:  input.predict_input,
        growth:   input.growth_input,
        industry: input.industry_input,
        actions:  input.actions_input
      };
      const report = buildMorningReport(buildInput);
      return { speak: formatMorningReport(report), data: { morning_report: report } };
    }
    case "predict_risks": {
      if (!input.predict_input) return { speak: "I don't have a snapshot to score risks against right now. Try a morning report first." };
      const risks = predictRisks(input.predict_input);
      if (risks.length === 0) return { speak: "No risks scored above the noise floor. Clean sky." };
      const lines = risks.map((r) => {
        const badge = r.severity === "critical" ? "!!" : r.severity === "warning" ? "!" : "·";
        const prob  = r.probability_pct !== null ? ` (${r.probability_pct}% likely)` : "";
        return `${badge} ${r.headline}${prob}\n   Next step. ${r.suggested_action}`;
      });
      return { speak: `Risks I'd watch today:\n\n${lines.join("\n\n")}` };
    }
    case "industry_signals": {
      if (!input.industry_input) return { speak: "No market observations wired in yet. When the industry feed's live I'll surface shifts here." };
      const signals = detectIndustrySignals(input.industry_input);
      if (signals.length === 0) return { speak: "No meaningful market shifts this window." };
      const lines = signals.map((s) => `· ${s.headline}${s.change_pct === null ? "" : ` (${s.change_pct > 0 ? "+" : ""}${s.change_pct.toFixed(0)}%)`}`);
      return { speak: `Market signals:\n${lines.join("\n")}` };
    }
    case "growth_opportunities": {
      if (!input.growth_input) return { speak: "No growth inputs supplied. Give me completed projects, stale quotes, or 5★ customers and I'll spot the openings." };
      const opps = suggestGrowth(input.growth_input);
      if (opps.length === 0) return { speak: "No growth openings above the noise floor right now." };
      const lines = opps.map((o) => `· ${o.headline}\n   Next step. ${o.suggested_action}`);
      return { speak: `Growth openings:\n${lines.join("\n")}` };
    }
    case "afford": {
      const decision = makeDecision({
        input:   { purchase_label: q.label, purchase_pence: q.price_pence, urgency: q.urgency },
        finance: input.finance ?? null
      });
      const verdict = decision.verdict.toUpperCase();
      const wait    = decision.wait_days ? ` Wait about ${decision.wait_days} days.` : "";
      const footnote = decision.footnote ? `\n\n${decision.footnote}` : "";
      return { speak: `${verdict}.${wait}\n\n${decision.reason}${footnote}`, data: { decision } };
    }
    case "trade_graph": {
      const node = getTradeNode(q.trade);
      if (!node) {
        const near = findTradesMatching(q.trade);
        if (near.length === 0) return { speak: `Nothing on file for ${q.trade} yet. I'll add it to my brain when we cover it.` };
        return { speak: `Did you mean: ${near.map((n) => n.label).join(", ")}?` };
      }
      const lines: string[] = [];
      lines.push(`${node.label}:`);
      lines.push(`Tools · ${node.tools.slice(0, 5).join(", ")}`);
      lines.push(`Materials · ${node.materials.slice(0, 5).join(", ")}`);
      lines.push(`Regulations · ${node.regulations.join(", ")}`);
      lines.push(`Common problems · ${node.common_problems.slice(0, 3).join(", ")}`);
      lines.push(`Adjacent trades · ${node.adjacent_trades.join(", ")}`);
      return { speak: lines.join("\n"), data: { trade_node: node } };
    }
    case "draft_actions": {
      if (!input.actions_input) return { speak: "Nothing to draft. No reminders, follow-ups, or quotes queued this run." };
      const actions = suggestActions(input.actions_input);
      if (actions.length === 0) return { speak: "Nothing to draft right now." };
      const lines = actions.map((a, i) => `${i + 1}. ${a.target_label}\n${a.draft}`);
      return { speak: `Drafts ready for your approval:\n\n${lines.join("\n\n---\n\n")}` };
    }
    case "none":
    default:
      return { speak: "" };
  }
}
