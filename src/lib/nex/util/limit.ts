// Result-limit resolver — shared by every Nex search-shaped feature.
//
// Rule (per user directive 2026-07-23):
//   • Default limit: 3.
//   • When the user asks for a specific number ("show me 5 bricklayers",
//     "top 10 suppliers"), respect it (clamped to a sane cap).
//   • When there are fewer real matches than the resolved limit, the
//     formatter PADS the speak output with opportunity slots that
//     clearly explain what's missing — never fabricates matches.

export const DEFAULT_RESULT_LIMIT = 3;
export const MAX_RESULT_LIMIT     = 25;

const NUMBER_HINT_RE = /\b(?:show\s+me\s+|find\s+me\s+|list\s+|top\s+|first\s+)(\d{1,4})\b/i;
const LEADING_NUM_RE = /\bshow\s+(\d{1,4})\b/i;

/** Parse a user-supplied result limit from the ask, or fall back to
 *  DEFAULT_RESULT_LIMIT. Clamps at MAX_RESULT_LIMIT. */
export function resolveResultLimit(ask: string, fallback: number = DEFAULT_RESULT_LIMIT): number {
  const t = ask.trim();
  const m = t.match(NUMBER_HINT_RE) ?? t.match(LEADING_NUM_RE);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!isFinite(n) || n <= 0) return fallback;
  return Math.min(MAX_RESULT_LIMIT, n);
}

/** Small opportunity bullet the formatter can append when fewer real
 *  matches exist than the resolved limit. Never presented as a real
 *  match — always prefixed with "(no more matches)". */
export function opportunitySlot(kind: "trade" | "product" | "property" | "project" | "supplier"): string {
  switch (kind) {
    case "trade":     return "(no more matches) List your trade here or ask me to widen the area / trade filter.";
    case "product":   return "(no more matches) No further products on the platform — try a wider keyword, or list yours.";
    case "property":  return "(no more matches) No other properties on record for this filter.";
    case "project":   return "(no more matches) Not enough contributing projects to show more — merchants can opt in on completion.";
    case "supplier":  return "(no more matches) No further supplier history to compare — try a wider window.";
  }
}

/** Pad a list of real match-lines to the requested count with
 *  opportunity slots. Returns exactly `limit` entries. */
export function padToLimit(matches: string[], limit: number, kind: Parameters<typeof opportunitySlot>[0]): string[] {
  const out = [...matches.slice(0, limit)];
  while (out.length < limit) out.push(opportunitySlot(kind));
  return out;
}
