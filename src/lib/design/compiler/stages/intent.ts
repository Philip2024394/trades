// Stage 1 — Intent resolution.
//
// The merchant's raw request ("give me a professional van") becomes a
// structured Intent object the compiler can reason about. The Studio
// provides a natural-language prompt; this stage normalises it into
// a concrete goal + style anchor + urgency signal.
//
// Deterministic. Runs before any AI call so cost is £0.

import type { DesignIR } from "../ir";

export const INTENT_STAGE_VERSION = "1.0.0";

const STYLE_KEYWORDS = new Map<string, string>([
  ["luxury", "Luxury Minimal"],
  ["premium", "Luxury Minimal"],
  ["modern", "Modern Bold"],
  ["clean", "Modern Bold"],
  ["heritage", "Heritage Traditional"],
  ["traditional", "Heritage Traditional"],
  ["classic", "Heritage Traditional"],
  ["industrial", "Industrial Utility"],
  ["rugged", "Industrial Utility"],
  ["professional", "Corporate Trust"],
  ["corporate", "Corporate Trust"],
  ["hi-vis", "Hi-Vis Trades"],
  ["safety", "Hi-Vis Trades"]
]);

export type IntentResolution = {
  style_anchor:  string;
  urgency:       "low" | "normal" | "rush";
  emphasis:      string[];        // extracted keywords the merchant flagged
  version:       string;
};

/** Normalise a user prompt + IR into a resolved Intent. Never calls AI. */
export function resolveIntent(ir: DesignIR, userPrompt: string | undefined): IntentResolution {
  const prompt = (userPrompt ?? "").toLowerCase();

  // Style anchor precedence: explicit style on IR > detected keyword > default.
  const detected = Array.from(STYLE_KEYWORDS.entries()).find(([kw]) => prompt.includes(kw))?.[1];
  const style_anchor = ir.layout?.style_anchor ?? detected ?? "Modern Bold";

  // Urgency detection — light touch. Real ops signal for cost/latency router.
  const rush = /\b(rush|urgent|asap|today|tonight)\b/.test(prompt);
  const slow = /\b(no hurry|whenever|later|next week)\b/.test(prompt);
  const urgency = rush ? "rush" : slow ? "low" : "normal";

  // Extract merchant-emphasised words (capitalised proper nouns or
  // phrases in quotes). Passed to the assembler so prompt reflects the
  // language the merchant actually used.
  const emphasis: string[] = [];
  const quoted = (userPrompt ?? "").match(/"([^"]{2,40})"/g);
  if (quoted) emphasis.push(...quoted.map((q) => q.replace(/"/g, "")));

  return { style_anchor, urgency, emphasis, version: INTENT_STAGE_VERSION };
}
