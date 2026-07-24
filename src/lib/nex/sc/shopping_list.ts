// Shopping-list planner — the spec's #1 success criterion.
//
// "What materials do I need for next week's jobs?"
//
// Data flow:
//   1. Find upcoming jobs = app_job_diary_jobs where
//      scheduled_start_date is within `windowDays` from now AND status
//      is not 'signed_off' | 'cancelled'.
//   2. For each job with quote_id, pull material line-items from
//      app_quote_workspace_quote_items (kind='material').
//   3. Aggregate by SKU (or by lowercased label as fallback) —
//      sum qty and cost, list contributing jobs.
//
// Honest: jobs without a quote_id contribute NOTHING to the list —
// we don't invent materials without an estimate.

import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type ShoppingLine, type ShoppingList } from "./types";

const DAY_MS = 86_400_000;

export type BuildShoppingListInput = {
  merchantId:   string;
  windowDays?:  number;    // default 14
  now?:         Date;
};

export async function buildShoppingList(opts: BuildShoppingListInput): Promise<ShoppingList> {
  const now       = opts.now ?? new Date();
  const window    = opts.windowDays ?? 14;
  const fromDate  = now.toISOString().slice(0, 10);
  const toDate    = new Date(now.getTime() + window * DAY_MS).toISOString().slice(0, 10);
  const evidence  = evidenceFor(
    "app_job_diary_jobs + app_quote_workspace_quote_items (kind=material)",
    ["app_job_diary_jobs", "app_quote_workspace_quote_items"]
  );

  const jobs = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("id, title, quote_id, scheduled_start_date, status")
    .eq("merchant_id", opts.merchantId)
    .gte("scheduled_start_date", fromDate)
    .lte("scheduled_start_date", toDate)
    .not("status", "in", "(signed_off,cancelled)")
    .order("scheduled_start_date", { ascending: true });

  const jobRows = jobs.data ?? [];
  const jobsWithQuote = jobRows.filter((j) => !!j.quote_id);
  const warnings: string[] = [];
  const jobsWithoutQuote = jobRows.length - jobsWithQuote.length;
  if (jobsWithoutQuote > 0) warnings.push(`${jobsWithoutQuote} scheduled job${jobsWithoutQuote === 1 ? "" : "s"} in this window have no quote attached — their materials are NOT in the list.`);
  if (jobsWithQuote.length === 0) {
    return {
      window_days: window,
      jobs_count:  jobRows.length,
      lines:       [],
      total_pence: 0,
      warnings:    jobRows.length === 0
        ? ["No jobs scheduled in the next " + window + " days."]
        : warnings,
      evidence
    };
  }

  const quoteIds = jobsWithQuote.map((j) => String(j.quote_id));
  const items = await supabaseAdmin
    .from("app_quote_workspace_quote_items")
    .select("quote_id, sku, label, unit, qty, unit_price_pence, total_pence")
    .in("quote_id", quoteIds)
    .eq("kind", "material");

  const jobByQuote = new Map<string, { id: string; title: string; scheduled_start_date: string | null }>();
  for (const j of jobsWithQuote) jobByQuote.set(String(j.quote_id), { id: String(j.id), title: String(j.title), scheduled_start_date: (j.scheduled_start_date as string | null) ?? null });

  const byKey = new Map<string, ShoppingLine>();
  for (const it of items.data ?? []) {
    const sku      = (it.sku as string | null) ?? null;
    const label    = String(it.label);
    const key      = keyFor(sku, label);
    const qty      = Number(it.qty ?? 0);
    const cost     = Number(it.total_pence ?? 0);
    const job      = jobByQuote.get(String(it.quote_id));
    if (!job) continue;

    const existing = byKey.get(key);
    if (existing) {
      existing.qty_needed     += qty;
      existing.est_cost_pence += cost;
      existing.jobs.push({ job_id: job.id, title: job.title, scheduled_start_date: job.scheduled_start_date, qty });
    } else {
      byKey.set(key, {
        key,
        sku,
        label,
        unit:           (it.unit as string | null) ?? null,
        qty_needed:     qty,
        est_cost_pence: cost,
        jobs:           [{ job_id: job.id, title: job.title, scheduled_start_date: job.scheduled_start_date, qty }],
        evidence
      });
    }
  }

  const lines = Array.from(byKey.values()).sort((a, b) => b.est_cost_pence - a.est_cost_pence);
  const total = lines.reduce((s, l) => s + l.est_cost_pence, 0);

  return {
    window_days: window,
    jobs_count:  jobRows.length,
    lines,
    total_pence: total,
    warnings,
    evidence
  };
}

function keyFor(sku: string | null, label: string): string {
  if (sku) return `sku:${sku}`;
  return `lbl:${createHash("sha1").update(label.toLowerCase().trim()).digest("hex").slice(0, 12)}`;
}
