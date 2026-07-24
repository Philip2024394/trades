// Explain-anything — takes an Estimate and answers "why X?" questions
// by looking up the matching line's explanation field. Every line has
// one; we never fabricate.

import type { Estimate, EstimateLine } from "./types";

/** Find the line most relevant to a "why?" question. Matching is
 *  keyword-based on the label and unit. Returns null when nothing
 *  matches — caller decides how to respond. */
export function explainLine(estimate: Estimate, hint: string): EstimateLine | null {
  const t = hint.toLowerCase();
  const scored = estimate.lines.map((l) => ({ l, score: scoreMatch(l, t) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score === 0) return null;
  return top.l;
}

function scoreMatch(l: EstimateLine, t: string): number {
  const label = l.label.toLowerCase();
  let s = 0;
  // Direct label word match.
  for (const w of label.split(/\W+/)) {
    if (w.length >= 3 && t.includes(w)) s += 5;
  }
  // Category keyword.
  const cats: Record<string, string[]> = {
    material:  ["material", "materials", "boards", "board", "bags", "paint", "concrete", "blocks", "plaster", "tape", "primer", "bead"],
    labour:    ["labour", "labor", "worker", "workers", "plasterer", "plasterers", "decorator", "hours", "days", "crew"],
    plant:     ["plant", "hire", "digger", "pump", "mixer", "compactor", "scaffold"],
    delivery:  ["delivery"],
    waste:     ["waste"],
    overhead:  ["overhead", "overheads"],
    profit:    ["profit", "margin", "markup"],
    vat:       ["vat", "tax"],
    total:     ["total", "grand total"]
  };
  for (const w of cats[l.category] ?? []) if (t.includes(w)) s += 3;
  return s;
}

/** Turn a line into a spoken reply for chat. */
export function speakLine(l: EstimateLine): string {
  return `${l.label} — ${formatValue(l)}\n\n${l.explanation}`;
}

function formatValue(l: EstimateLine): string {
  const gbp = `£${(l.total_pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (l.qty !== undefined && l.unit) return `${l.qty} ${l.unit} · ${gbp}`;
  return gbp;
}
