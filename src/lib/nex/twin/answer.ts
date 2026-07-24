// Twin answer router — parses "what if" style asks into a scenario
// + parameters, dispatches, returns the formatted simulation reply.

import { runSimulation } from "./simulate";
import type { ScenarioKind } from "./types";

export type TwinQuestion =
  | { kind: "simulate"; scenario: ScenarioKind; parameters: Record<string, unknown> }
  | { kind: "list_scenarios" }
  | { kind: "none" };

export function classifyTwinQuestion(text: string): TwinQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\blist\s+scenarios?\b|\bwhat\s+scenarios?\s+can\b/.test(t)) return { kind: "list_scenarios" };

  // fuel_increase
  const fuelMatch = t.match(/\bif\s+fuel\s+(?:increases?|goes?\s+up|rises?)\s+by\s+(\d+(?:\.\d+)?)\s*%?/);
  if (fuelMatch) {
    const pct = Number(fuelMatch[1]);
    if (isFinite(pct) && pct > 0) return { kind: "simulate", scenario: "fuel_increase", parameters: { pct } };
  }

  // price_rise
  const priceMatch = t.match(/\bif\s+i\s+(?:raise|increase|bump)\s+(?:my\s+)?prices?\s+by\s+(\d+(?:\.\d+)?)\s*%?/);
  if (priceMatch) {
    const pct = Number(priceMatch[1]);
    if (isFinite(pct) && pct > 0) return { kind: "simulate", scenario: "price_rise", parameters: { pct } };
  }

  // extra_hire
  const hireMatch = t.match(/\bif\s+i\s+hire\s+(?:another|an?)\s+([a-z][a-z\s-]{1,30})/);
  if (hireMatch) {
    return { kind: "simulate", scenario: "extra_hire", parameters: { trade: hireMatch[1].trim(), annual_cost_gbp: 30_000 } };
  }

  // van_purchase
  const vanMatch = t.match(/\b(?:if\s+i\s+buy|can\s+i\s+buy)\s+(?:another\s+)?(?:a\s+)?van(?:\s+for\s+£?(\d+(?:,\d{3})*))?/);
  if (vanMatch) {
    const price = vanMatch[1] ? Number(vanMatch[1].replace(/,/g, "")) : 25_000;
    return { kind: "simulate", scenario: "van_purchase", parameters: { price_gbp: price } };
  }

  // advertising_boost
  const adMatch = t.match(/\bif\s+i\s+(?:advertise|spend)\s+£?(\d+(?:,\d{3})*)\s*(?:\/mo|per\s+month|\s+a\s+month|\s+monthly)?\s*(?:on\s+ads?|on\s+advertising)?/);
  if (adMatch) {
    const monthly = Number(adMatch[1].replace(/,/g, ""));
    if (isFinite(monthly) && monthly > 0) return { kind: "simulate", scenario: "advertising_boost", parameters: { monthly_gbp: monthly } };
  }

  return { kind: "none" };
}

export type AnswerTwinInput = {
  question:     TwinQuestion;
  merchantSlug: string;
};

export async function answerTwin(input: AnswerTwinInput): Promise<string> {
  const q = input.question;
  switch (q.kind) {
    case "simulate": {
      const res = await runSimulation({
        merchantSlug: input.merchantSlug,
        scenario:     q.scenario,
        parameters:   q.parameters
      });
      return res.speak;
    }
    case "list_scenarios": {
      const lines = ["I can simulate these scenarios (nothing changes — output-only):"];
      lines.push("- 'if fuel increases by 20%' — fuel-cost sensitivity across your current book");
      lines.push("- 'if I raise my prices by 5%' — revenue + profit + margin uplift");
      lines.push("- 'if I hire another carpenter' — annual staff cost vs projected uplift");
      lines.push("- 'if I buy a van for £25,000' — affordability against 90-day cash horizon");
      lines.push("- 'if I spend £500/mo on ads' — projected revenue at industry ROAS");
      return lines.join("\n");
    }
    case "none":
      return "";
  }
}
