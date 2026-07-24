// Financial answer router.
//
// Routes "how are my finances?" family + "can I afford X?" family
// against a FinancialSnapshot. The "afford X" case parses a purchase
// amount from the utterance and calls the affordability check.

import { checkAffordability } from "./affordability";
import type { CashflowSnapshot } from "../md/types";
import type { FinancialSnapshot } from "./types";

export type FIQuestion =
  | { kind: "overview" }
  | { kind: "revenue" }
  | { kind: "expenses" }
  | { kind: "vat" }
  | { kind: "financial_health" }
  | { kind: "best_customer" }
  | { kind: "afford"; label: string; pence: number | null }
  | { kind: "none" };

const AFFORD_KEYWORDS_TO_PRICE: Array<{ match: RegExp; label: string; pence: number }> = [
  // Rough UK ballpark defaults so "can I afford a new van?" gets a
  // decision without the user having to say a number. Merchant can
  // always say the number explicitly to override.
  { match: /\bnew\s+van\b/i,        label: "a new van (~£25,000)",     pence: 2_500_000 },
  { match: /\bused\s+van\b/i,       label: "a used van (~£8,000)",      pence: 800_000 },
  { match: /\bnew\s+machine\b/i,    label: "a new machine (~£10,000)",  pence: 1_000_000 },
  { match: /\bapprentice\b/i,       label: "an apprentice for a year (~£16,000)", pence: 1_600_000 },
  { match: /\bemployee\b|\bstaff\b/i, label: "another employee for a year (~£30,000)", pence: 3_000_000 },
  { match: /\bbranch\b|\bsecond\s+office\b/i, label: "opening a branch (~£40,000)", pence: 4_000_000 }
];

export function classifyFinancialQuestion(text: string): FIQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  // Afford questions FIRST — most specific.
  if (/\bcan\s+i\s+afford\b|\bcould\s+i\s+afford\b|\bshould\s+i\s+buy\b|\bcan\s+i\s+buy\b/.test(t)) {
    // Explicit money amount inside the sentence?
    const money = t.match(/[£$]?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m|million)?/i);
    if (money) {
      let value = Number(money[1].replace(/,/g, ""));
      const unit = (money[2] ?? "").toLowerCase();
      if (unit === "k" || unit === "thousand") value *= 1_000;
      else if (unit === "m" || unit === "million") value *= 1_000_000;
      if (isFinite(value) && value > 0) {
        return { kind: "afford", label: text.trim(), pence: Math.round(value * 100) };
      }
    }
    // Fallback: match the keyword table for known items.
    for (const rule of AFFORD_KEYWORDS_TO_PRICE) {
      if (rule.match.test(t)) return { kind: "afford", label: rule.label, pence: rule.pence };
    }
    return { kind: "afford", label: text.trim(), pence: null };
  }

  if (/\bhow\s+are\s+my\s+finances?\b|\bfinancial\s+overview\b|\bfinance\s+director\b/.test(t)) return { kind: "overview" };
  if (/\bfinancial\s+health\b|\bhow\s+healthy\s+are\s+my\s+finances?\b/.test(t))                 return { kind: "financial_health" };
  if (/\bwho'?s\s+my\s+best\s+customer\b|\bwhich\s+customers?\s+earn\s+me\s+the\s+most\b/.test(t)) return { kind: "best_customer" };
  if (/\b(my|our)\s+(vat|tax)\s+(position|summary|liability|bill|return)\b/.test(t)
     || /\bwhat'?s\s+my\s+(vat|tax)\b|\bhow\s+much\s+(vat|tax)\s+do\s+i\s+owe\b/.test(t))         return { kind: "vat" };
  if (/\bwhere\s+am\s+i\s+spending\b|\bexpenses?\b|\bcost\s+breakdown\b/.test(t))                 return { kind: "expenses" };
  if (/\brevenue\b|\bturnover\b|\bincome\b|\brevenue\s+by\s+customer\b/.test(t))                  return { kind: "revenue" };

  return { kind: "none" };
}

export function answerFinancial(q: FIQuestion, snapshot: FinancialSnapshot, cashflow: CashflowSnapshot | null): string {
  switch (q.kind) {
    case "overview":         return overviewReply(snapshot);
    case "revenue":          return revenueReply(snapshot);
    case "expenses":         return expensesReply(snapshot);
    case "vat":              return vatReply(snapshot);
    case "financial_health": return healthReply(snapshot);
    case "best_customer":    return bestCustomerReply(snapshot);
    case "afford":           return affordReply(q, snapshot, cashflow);
    case "none":             return "";
  }
}

// ─── Reply builders ────────────────────────────────────────────

const gbp = (p: number): string => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function overviewReply(s: FinancialSnapshot): string {
  const lines: string[] = [s.health.headline];
  lines.push("");
  lines.push(`- Revenue (last ${s.revenue.window_days} days): ${gbp(s.revenue.total_pence)}.`);
  lines.push(`- Booked profit (planned): ${gbp(s.profit_ref.planned_profit_pence)} at ${s.profit_ref.weighted_margin_pct}% weighted margin.`);
  lines.push(`- Outstanding: ${gbp(s.cashflow_ref.outstanding_now_pence)}${s.cashflow_ref.overdue_now_pence > 0 ? ` (${gbp(s.cashflow_ref.overdue_now_pence)} overdue)` : ""}.`);
  lines.push(`- Weighted pipeline: ${gbp(s.cashflow_ref.pipeline_weighted_pence)}.`);
  lines.push(`- Next-30-day cash net: ${gbp(s.cashflow_ref.next_30d_net_pence)}.`);
  lines.push(`- Expenses (${s.expenses.window_days} days): ${gbp(s.expenses.total_pence)}.`);
  lines.push(`- Supplier spend: ${gbp(s.suppliers_ref.total_spend_pence)} across ${s.suppliers_ref.supplier_count} suppliers.`);
  lines.push(`- Estimated VAT payable (${s.vat.vat_rate_pct}%): ${gbp(s.vat.vat_net_pence)}.`);
  lines.push("");
  lines.push(s.vat.disclaimer);
  return lines.join("\n");
}

function revenueReply(s: FinancialSnapshot): string {
  const lines: string[] = [`Revenue in the last ${s.revenue.window_days} days: ${gbp(s.revenue.total_pence)}.`];
  if (s.revenue.by_customer.length > 0) {
    lines.push("");
    lines.push("Top customers:");
    for (const r of s.revenue.by_customer) lines.push(`- ${r.label} — ${gbp(r.amount_pence)} (${r.count} job${r.count === 1 ? "" : "s"})`);
  }
  if (s.revenue.by_kind.length > 0) {
    lines.push("");
    lines.push("Breakdown by kind:");
    for (const r of s.revenue.by_kind) lines.push(`- ${r.label} — ${gbp(r.amount_pence)}`);
  }
  return lines.join("\n");
}

function expensesReply(s: FinancialSnapshot): string {
  if (s.expenses.total_pence === 0 && s.expenses.categories.length === 0) {
    return `No expenses recorded in the last ${s.expenses.window_days} days.\n\n${s.expenses.untracked_note}`;
  }
  const lines: string[] = [`Expenses in the last ${s.expenses.window_days} days: ${gbp(s.expenses.total_pence)}.`];
  lines.push("");
  lines.push("By category:");
  for (const c of s.expenses.categories) lines.push(`- ${c.label} — ${gbp(c.spend_pence)} across ${c.cost_count} line${c.cost_count === 1 ? "" : "s"}`);
  lines.push("");
  lines.push(s.expenses.untracked_note);
  return lines.join("\n");
}

function vatReply(s: FinancialSnapshot): string {
  const lines: string[] = [];
  lines.push(`VAT position over the last ${s.vat.window_days} days (rate ${s.vat.vat_rate_pct}%):`);
  lines.push(`- Output VAT (from accepted quotes): ${gbp(s.vat.vat_payable_pence)}`);
  lines.push(`- Input VAT reclaimable (estimated on material/supplier spend): ${gbp(s.vat.vat_reclaimable_est_pence)}`);
  lines.push(`- Net VAT: ${gbp(s.vat.vat_net_pence)}`);
  lines.push("");
  lines.push(s.vat.disclaimer);
  return lines.join("\n");
}

function healthReply(s: FinancialSnapshot): string {
  const lines: string[] = [s.health.headline, ""];
  lines.push(`- Cash flow: ${s.health.signals.cash_flow.score ?? "—"} — ${s.health.signals.cash_flow.note}`);
  lines.push(`- Profit: ${s.health.signals.profit.score ?? "—"} — ${s.health.signals.profit.note}`);
  lines.push(`- Payment speed: ${s.health.signals.payment_speed.score ?? "—"} — ${s.health.signals.payment_speed.note}`);
  lines.push(`- Growth: ${s.health.signals.growth.score ?? "—"} — ${s.health.signals.growth.note}`);
  lines.push(`- Stability: ${s.health.signals.stability.score ?? "—"} — ${s.health.signals.stability.note}`);
  return lines.join("\n");
}

function bestCustomerReply(s: FinancialSnapshot): string {
  if (s.revenue.by_customer.length === 0) return "No booked-customer revenue on file yet.";
  const top = s.revenue.by_customer[0];
  return `Your best customer over the last ${s.revenue.window_days} days is ${top.label} at ${gbp(top.amount_pence)} across ${top.count} job${top.count === 1 ? "" : "s"}.`;
}

function affordReply(q: Extract<FIQuestion, { kind: "afford" }>, s: FinancialSnapshot, cashflow: CashflowSnapshot | null): string {
  if (q.pence === null) {
    return "Tell me the price and I'll check honestly. Example: \"Can I afford £8,000?\" or \"Can I afford a new van?\".";
  }
  // Reconstruct a minimal CashflowSnapshot-like from FI's snapshot ref
  // if the caller didn't pass the full MD one.
  const cf: CashflowSnapshot = cashflow ?? {
    currency: "GBP",
    computed_at: s.computed_at,
    buckets: [
      { end_date: "", inflow_pence: 0, outflow_pence: 0, net_pence: s.cashflow_ref.next_30d_net_pence },
      { end_date: "", inflow_pence: 0, outflow_pence: 0, net_pence: s.cashflow_ref.next_60d_net_pence },
      { end_date: "", inflow_pence: 0, outflow_pence: 0, net_pence: s.cashflow_ref.next_90d_net_pence }
    ],
    horizon_pence:           s.cashflow_ref.next_30d_net_pence + s.cashflow_ref.next_60d_net_pence + s.cashflow_ref.next_90d_net_pence,
    outstanding_now_pence:   s.cashflow_ref.outstanding_now_pence,
    overdue_now_pence:       s.cashflow_ref.overdue_now_pence,
    pipeline_weighted_pence: s.cashflow_ref.pipeline_weighted_pence,
    warnings:                [],
    evidence:                { source: "reconstructed", tables: [], computed_at: s.computed_at }
  };
  const ans = checkAffordability({ purchase_label: q.label, purchase_pence: q.pence, cashflow: cf });
  return ans.reason;
}
