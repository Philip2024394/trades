// Memory-backed answer router.
//
// Handles Phase 26 V0 asks:
//   • "how did we price similar jobs before?" / "how did I price a
//     kitchen last time?" — subject_like "pricing.<trade>."
//   • "what have we done like this before?" — subject_like "quoted."
//     scoped to project layer for shape-match
//   • "which customers pay late?" — subject_like "customer.*.payment_days"
//     surfacing slowest median
//   • "how's my cash horizon been?" — subject "financial.cash.*"
//     surfacing trend
//
// V0 = owner-only reads. No cross-tenant benchmarks yet.

import { retrieveMemory } from "./reader";
import type { MemoryRow, ViewerScope } from "./types";

export type MemoryQuestion =
  | { kind: "recall_pricing";     trade: string | null; scope_hint: string | null }
  | { kind: "recall_similar_jobs"; scope_hint: string }
  | { kind: "recall_slow_payers" }
  | { kind: "recall_cash_history" }
  | { kind: "none" };

const TRADE_WORDS = ["kitchen", "bathroom", "loft", "extension", "roof", "roofing", "plumbing", "electrical", "carpentry", "tiling", "plastering", "heating", "masonry", "bricklaying"];

export function classifyMemoryQuestion(ask: string): MemoryQuestion {
  const t = ask.toLowerCase();

  // "How did I price a kitchen last time?" / "How did we price similar jobs?"
  if (/\bhow\s+(did|do)\s+(i|we|you)\s+price\b/.test(t)
   || /\bwhat'?s?\s+my\s+usual\s+price\b/.test(t)
   || /\bwhat\s+did\s+i\s+charge\s+for\b/.test(t)) {
    const trade = TRADE_WORDS.find((w) => t.includes(w)) ?? null;
    return { kind: "recall_pricing", trade, scope_hint: ask };
  }

  // "What have we done like this before?"
  if (/\bwhat\s+have\s+(we|i)\s+done\s+like\s+this\b/.test(t)
   || /\bsimilar\s+jobs?\b/.test(t)
   || /\banything\s+like\s+this\s+before\b/.test(t)) {
    return { kind: "recall_similar_jobs", scope_hint: ask };
  }

  // "Which customers pay late?" / "who owes me money?"
  if (/\bwhich\s+customers?\s+(pay|paid)\s+late\b/.test(t)
   || /\bslow\s+payers?\b/.test(t)
   || /\bwho\s+pays\s+late\b/.test(t)) {
    return { kind: "recall_slow_payers" };
  }

  // "How's my cash horizon been?" / "cash trend"
  if (/\bcash\s+(horizon|trend|history)\b/.test(t)
   || /\bhow'?s\s+cash\s+been\b/.test(t)) {
    return { kind: "recall_cash_history" };
  }

  return { kind: "none" };
}

// ─── Answerer ───────────────────────────────────────────────────

export type AnswerMemoryInput = {
  question:      MemoryQuestion;
  merchant_slug: string;
};

export type AnswerMemoryResult = {
  speak: string;
  rows?: MemoryRow[];
};

export async function answerMemory(input: AnswerMemoryInput): Promise<AnswerMemoryResult> {
  const viewer: ViewerScope = { kind: "merchant", merchant_slug: input.merchant_slug };
  const q = input.question;

  switch (q.kind) {
    case "recall_pricing": {
      const prefix = q.trade ? `pricing.${q.trade}.` : "pricing.";
      const res = await retrieveMemory({
        layer: "company", viewer,
        subject_like: prefix,
        limit: 3
      });
      if (res.rows.length === 0) {
        return { speak: q.trade
          ? `Nothing on file for ${q.trade} pricing yet. Once you've issued a quote or two, I'll be able to look back.`
          : "Nothing on file for prior pricing yet. Once you've issued a quote or two, I'll be able to look back."
        };
      }
      const lines = res.rows.map((r) => formatPricingRow(r));
      const opener = q.trade
        ? `Your last ${res.rows.length} ${q.trade} price${res.rows.length === 1 ? "" : "s"}:`
        : `Your last ${res.rows.length} quotes:`;
      return { speak: `${opener}\n${lines.join("\n")}`, rows: res.rows };
    }

    case "recall_similar_jobs": {
      const res = await retrieveMemory({
        layer: "company", viewer,
        subject_like: "pricing.",
        limit: 3
      });
      if (res.rows.length === 0) return { speak: "Nothing on file for similar jobs yet." };
      const lines = res.rows.map((r) => formatPricingRow(r));
      return { speak: `Closest matches from your history:\n${lines.join("\n")}`, rows: res.rows };
    }

    case "recall_slow_payers": {
      const res = await retrieveMemory({
        layer: "company", viewer,
        subject_like: "customer.",
        limit: 25
      });
      if (res.rows.length === 0) return { speak: "No customer payment history on file yet." };
      const withDays = res.rows
        .map((r) => ({ row: r, days: extractPaymentDays(r) }))
        .filter((x) => x.days !== null)
        .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
        .slice(0, 3);
      if (withDays.length === 0) return { speak: "No customer payment history on file yet." };
      const lines = withDays.map(({ row, days }) => {
        const customerId = extractCustomerId(row.subject);
        return `· Customer ${customerId} · ${days} days to pay`;
      });
      return { speak: `Slowest payers on file:\n${lines.join("\n")}`, rows: withDays.map((x) => x.row) };
    }

    case "recall_cash_history": {
      const res = await retrieveMemory({
        layer: "company", viewer,
        subject: "financial.cash.next_30d_pence",
        limit: 3
      });
      if (res.rows.length === 0) return { speak: "No cash-horizon history on file yet." };
      const lines = res.rows.map((r) => {
        const pence = Number(r.value_json ?? 0);
        const date  = r.observed_at.split("T")[0];
        return `· ${date} · £${(pence / 100).toLocaleString("en-GB")} 30-day net`;
      });
      return { speak: `Your recent cash-horizon reads:\n${lines.join("\n")}`, rows: res.rows };
    }

    case "none":
    default:
      return { speak: "" };
  }
}

// ─── Row formatters ─────────────────────────────────────────────

function formatPricingRow(r: MemoryRow): string {
  const v = (r.value_json as Record<string, unknown>) ?? {};
  const total = typeof v.total_pence === "number" ? v.total_pence : null;
  const days  = typeof v.duration_days === "number" ? v.duration_days : null;
  const scope = typeof v.scope === "string" ? v.scope : null;
  const parts: string[] = [];
  parts.push(`· ${r.observed_at.split("T")[0]}`);
  if (scope) parts.push(scope);
  if (total !== null) parts.push(`£${(total / 100).toLocaleString("en-GB")}`);
  if (days  !== null) parts.push(`${days} days`);
  return parts.join(" · ");
}

function extractPaymentDays(r: MemoryRow): number | null {
  const v = r.value_json as Record<string, unknown> | null;
  if (v && typeof v.days === "number") return v.days;
  if (typeof r.value_json === "number") return r.value_json;
  return null;
}

function extractCustomerId(subject: string): string {
  const m = subject.match(/^customer\.([^.]+)\.payment_days$/);
  return m ? m[1]! : "(unknown)";
}
