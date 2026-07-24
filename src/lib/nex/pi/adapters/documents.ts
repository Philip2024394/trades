// Documents adapter — reads hammerex_sitebook_cost_documents.
//
// Rolls up quotes / invoices / receipts / spreadsheets / photos / other
// into a per-project inventory. Receipt / drawing AI-extraction is
// future work — today the adapter reports what's stored (never
// fabricates the parsed values).
//
// Homeowner-owned: merchants never see documents on other members'
// jobs. We enforce this by restricting merchants to documents
// attached to costs where they are the assigned trade.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, TimelineEvent, Observation } from "../types";
import { evidenceFor } from "../types";

const KINDS = ["quote", "invoice", "receipt", "spreadsheet", "photo", "other"] as const;

export const documentsAdapter: PIAdapter = {
  aspect: "documents",
  label:  "Documents",
  weight: 1.0,

  async run(ctx) {
    const evidence = evidenceFor("hammerex_sitebook_cost_documents", ["hammerex_sitebook_cost_documents"], `/sitebook/${ctx.projectId}`);

    let q = supabaseAdmin
      .from("hammerex_sitebook_cost_documents")
      .select("id, kind, file_name, storage_url, created_at, cost_id, hammerex_sitebook_costs!left(trade_listing_id, trade_name)")
      .eq("project_id", ctx.projectId)
      .order("created_at", { ascending: false })
      .limit(200);

    // Merchant-side: only documents on their own cost lines.
    if (ctx.viewer === "merchant") {
      q = q.eq("hammerex_sitebook_costs.trade_listing_id", ctx.viewerId);
    }

    const rows = await q;
    const docs = rows.data ?? [];

    const counts: Record<string, number> = {};
    for (const k of KINDS) counts[k] = 0;
    for (const d of docs) counts[String(d.kind)] = (counts[String(d.kind)] ?? 0) + 1;

    const timeline: TimelineEvent[] = docs.slice(0, 20).map((d) => ({
      at:         d.created_at as string,
      event_type: d.kind === "invoice" ? "invoice_added" : "document_uploaded",
      actor_type: null,
      actor_name: null,
      headline:   `${cap(String(d.kind))}: ${String(d.file_name).slice(0, 80)}`,
      evidence
    }));

    // "Missing invoice" observation: any cost marked paid but with no
    // linked invoice document is a red flag for the homeowner (they
    // can't prove the payment happened). Homeowner-visible only.
    const observations: Observation[] = [];
    if (ctx.viewer === "homeowner") {
      const paidWithoutInvoice = await supabaseAdmin
        .from("hammerex_sitebook_costs")
        .select("id, description, paid_pence")
        .eq("project_id", ctx.projectId)
        .eq("status", "paid");
      const paidIds = new Set((paidWithoutInvoice.data ?? []).map((r) => String(r.id)));
      const invoiceCostIds = new Set(
        docs
          .filter((d) => d.kind === "invoice" && d.cost_id)
          .map((d) => String(d.cost_id))
      );
      const missing = [...paidIds].filter((id) => !invoiceCostIds.has(id)).length;
      if (missing > 0) {
        observations.push({
          key:      "invoices_missing",
          aspect:   "documents",
          severity: "notice",
          headline: `${missing} paid ${missing === 1 ? "cost has" : "costs have"} no invoice attached.`,
          detail:   "Attaching the invoice keeps proof of payment for the warranty period.",
          action:   { label: "Attach invoices", href: `/sitebook/${ctx.projectId}` },
          evidence,
          visible_to: ["homeowner"]
        });
      }
    }

    // Sub-score: any doc counts as activity; volume + variety saturate.
    const total = docs.length;
    const variety = KINDS.filter((k) => (counts[k] ?? 0) > 0).length;
    const sub_score = total === 0 ? 40 : Math.min(100, 50 + total * 3 + variety * 5);

    return {
      aspect: "documents",
      label:  "Documents",
      sub_score,
      weight: 1.0,
      metrics: [
        { key: "documents_total", label: "Documents stored", value: total, unit: "count", direction: "higher_is_better", evidence },
        ...KINDS.map((k) => ({
          key:      `documents_${k}`,
          label:    cap(k),
          value:    counts[k] ?? 0,
          unit:     "count" as const,
          direction: "neutral" as const,
          evidence
        }))
      ],
      observations,
      timeline
    };
  }
};

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
