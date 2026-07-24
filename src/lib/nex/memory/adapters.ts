// Adapters — turn phase-native events into memory writes.
//
// Every existing engine (Phase 5 BI onwards) already produces the
// events. These adapters are the thin translation layer. Each returns
// the WriteMemoryInput objects; the caller invokes `writeMemory()` for
// each. Splitting this way keeps the adapters pure + easy to unit test
// without a Supabase connection.

import type { FinancialSnapshot } from "../fi/types";
import type {
  WriteCompanyMemoryInput,
  WriteMemoryInput,
  WriteProjectMemoryInput
} from "./types";

// ─── Phase 6 PI — project completion ────────────────────────────

export type ProjectCompletionEvent = {
  merchant_slug:      string;
  project_id:         string;
  duration_days:      number | null;
  labour_hours:       number | null;
  materials_pence:    number | null;
  snags_count:        number | null;
  review_score:       number | null;
  completed_at:       string;
};

export function fromProjectCompletion(ev: ProjectCompletionEvent): WriteProjectMemoryInput[] {
  const base = {
    layer:         "project" as const,
    merchant_slug: ev.merchant_slug,
    project_id:    ev.project_id,
    observed_at:   ev.completed_at,
    visible_to:    "project_participants" as const,
    source_engine: "pi",
    evidence_tables: ["hammerex_projects", "hammerex_jobs"]
  };
  const out: WriteProjectMemoryInput[] = [];
  if (ev.duration_days   !== null) out.push({ ...base, subject: "duration.days",         predicate: "=", value_json: ev.duration_days,   unit: "days" });
  if (ev.labour_hours    !== null) out.push({ ...base, subject: "labour.hours",          predicate: "=", value_json: ev.labour_hours,    unit: "hours" });
  if (ev.materials_pence !== null) out.push({ ...base, subject: "materials.total_pence", predicate: "=", value_json: ev.materials_pence, unit: "pence" });
  if (ev.snags_count     !== null) out.push({ ...base, subject: "snags.count",           predicate: "=", value_json: ev.snags_count,     unit: null });
  if (ev.review_score    !== null) out.push({ ...base, subject: "review.score",          predicate: "=", value_json: ev.review_score,    unit: "stars_5" });
  return out;
}

// ─── Phase 7 est — quote issued ─────────────────────────────────

export type QuoteIssuedEvent = {
  merchant_slug:  string;
  project_id?:    string;
  trade:          string;            // "carpentry" | "kitchen" | ...
  scope:          string;            // free-form, used for retrieval
  total_pence:    number;
  net_pence:      number;
  labour_pence:   number;
  materials_pence: number;
  duration_days:  number;
  issued_at:      string;
};

export function fromQuoteIssued(ev: QuoteIssuedEvent): WriteMemoryInput[] {
  const commonCompany = {
    layer:         "company" as const,
    merchant_slug: ev.merchant_slug,
    observed_at:   ev.issued_at,
    visible_to:    "owner_only" as const,
    source_engine: "est",
    evidence_tables: ["hammerex_quotes"]
  };
  const out: WriteMemoryInput[] = [];
  // Structured — keyed by trade so recall by trade is O(index seek).
  out.push({
    ...commonCompany,
    subject:    `pricing.${ev.trade}.total_pence`,
    predicate:  "=",
    value_json: {
      total_pence:    ev.total_pence,
      net_pence:      ev.net_pence,
      labour_pence:   ev.labour_pence,
      materials_pence: ev.materials_pence,
      duration_days:  ev.duration_days,
      scope:          ev.scope
    },
    unit:       "pence"
  });
  // Also record a per-project cost line if the quote is project-scoped.
  if (ev.project_id) {
    out.push({
      layer: "project", merchant_slug: ev.merchant_slug, project_id: ev.project_id,
      subject: "quoted.total_pence", predicate: "=", value_json: ev.total_pence,
      unit: "pence", observed_at: ev.issued_at,
      visible_to: "project_participants",
      source_engine: "est", evidence_tables: ["hammerex_quotes"]
    });
  }
  return out;
}

// ─── Phase 8 CX — customer payment observed ─────────────────────

export type PaymentObservedEvent = {
  merchant_slug:  string;
  customer_id:    string;
  invoice_pence:  number;
  days_from_invoice_to_pay: number;
  observed_at:    string;
};

export function fromPaymentObserved(ev: PaymentObservedEvent): WriteCompanyMemoryInput[] {
  return [{
    layer:         "company",
    merchant_slug: ev.merchant_slug,
    subject:       `customer.${ev.customer_id}.payment_days`,
    predicate:     "=",
    value_json:    {
      days: ev.days_from_invoice_to_pay,
      invoice_pence: ev.invoice_pence
    },
    unit:          "days",
    observed_at:   ev.observed_at,
    visible_to:    "owner_only",
    source_engine: "cx",
    evidence_tables: ["hammerex_customer_payments", "hammerex_quotes"]
  }];
}

// ─── Phase 10 FI — daily financial snapshot ─────────────────────

export type FinancialSnapshotEvent = {
  merchant_slug:   string;
  snapshot:        FinancialSnapshot;
  observed_at:     string;
};

export function fromFinancialSnapshot(ev: FinancialSnapshotEvent): WriteCompanyMemoryInput[] {
  const base = {
    layer:         "company" as const,
    merchant_slug: ev.merchant_slug,
    observed_at:   ev.observed_at,
    visible_to:    "owner_only" as const,
    source_engine: "fi",
    evidence_tables: ["hammerex_customer_payments", "hammerex_quotes", "hammerex_project_costs"]
  };
  const s = ev.snapshot;
  return [
    { ...base, subject: "financial.health.score",         predicate: "=", value_json: s.health.score, unit: "score_100" },
    { ...base, subject: "financial.cash.next_30d_pence",  predicate: "=", value_json: s.cashflow_ref.next_30d_net_pence, unit: "pence" },
    { ...base, subject: "financial.cash.next_90d_pence",  predicate: "=", value_json: s.cashflow_ref.next_90d_net_pence, unit: "pence" },
    { ...base, subject: "financial.cash.overdue_pence",   predicate: "=", value_json: s.cashflow_ref.overdue_now_pence,  unit: "pence" },
    { ...base, subject: "financial.margin.weighted_pct",  predicate: "=", value_json: s.profit_ref.weighted_margin_pct,  unit: "%" },
    { ...base, subject: "financial.margin.low_jobs_count", predicate: "=", value_json: s.profit_ref.low_margin_jobs_count, unit: null }
  ];
}
