// Quote-builder — persist an Estimate into the existing quote workspace
// so the customer-facing PDF / share-link / accept-reject flow inherits
// zero rework.
//
// Writes:
//   • one row in app_quote_workspace_quotes (header + totals)
//   • one row per estimate line in app_quote_workspace_quote_items
//   • an audit "drafted" event in app_quote_workspace_quote_events
//
// The quote is drafted (status='draft'), never auto-sent. Merchant
// approves + sends via the existing Studio Quote page.

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Estimate, EstimateCategory } from "./types";

export type PersistedQuote = {
  ok: true;
  quote_id:    string;
  share_token: string;
  total_pence: number;
} | {
  ok: false;
  error: string;
};

export type PersistQuoteInput = {
  estimate:     Estimate;
  merchantId:   string;   // hammerex_trade_off_listings.id
  projectId:    string;   // os_projects.id — required by quote_workspace
  propertyId:   string;   // os_properties.id — required by quote_workspace
  homeownerId?: string | null;
  title?:       string;
  notes?:       string;
};

/** Map estimator categories to the quote-workspace `kind` enum. */
const KIND_MAP: Partial<Record<EstimateCategory, "material" | "labour" | "fee" | "discount" | "note">> = {
  material:     "material",
  labour:       "labour",
  plant:        "fee",
  delivery:     "fee",
  subcontractor: "fee",
  waste:        "fee",
  overhead:     "fee",
  profit:       "fee",
  vat:          "fee"
};

/** Map estimator units to the quote-workspace `unit` enum. */
function mapUnit(u?: string): "each" | "m2" | "linear-m" | "hour" | "day" {
  switch (u) {
    case "m2":   return "m2";
    case "m":    return "linear-m";
    case "hour": return "hour";
    case "day":  return "day";
    default:     return "each";
  }
}

export async function persistEstimateAsQuote(input: PersistQuoteInput): Promise<PersistedQuote> {
  const shareToken = randomUUID();
  const e = input.estimate;

  const header = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .insert({
      project_id:      input.projectId,
      property_id:     input.propertyId,
      merchant_id:     input.merchantId,
      homeowner_id:    input.homeownerId ?? null,
      title:           input.title ?? `${e.trade_label} — ${e.scope}`,
      status:          "draft",
      currency:        e.defaults.currency,
      materials_pence: e.materials_pence + e.plant_pence + e.delivery_pence + e.waste_pence,
      labour_pence:    e.labour_pence,
      vat_pence:       e.vat_pence,
      discount_pence:  0,
      total_pence:     e.total_pence,
      share_token:     shareToken,
      timeline_estimate: `${e.duration_days.toFixed(1)} days`,
      notes:           input.notes ?? e.explanation
    })
    .select("id, share_token")
    .maybeSingle();

  if (header.error || !header.data) {
    return { ok: false, error: header.error?.message ?? "quote-header-insert-failed" };
  }
  const quoteId = String(header.data.id);

  // Line items — skip summary/total lines (the header already carries totals).
  const itemsToInsert = e.lines
    .filter((l) => l.category !== "subtotal" && l.category !== "total")
    .map((l) => ({
      quote_id:            quoteId,
      kind:                KIND_MAP[l.category] ?? "note",
      sku:                 null,
      label:               l.label,
      qty:                 l.qty ?? 1,
      unit:                mapUnit(l.unit),
      unit_price_pence:    l.unit_cost_pence ?? l.total_pence,
      total_pence:         l.total_pence
    }));

  if (itemsToInsert.length > 0) {
    const items = await supabaseAdmin
      .from("app_quote_workspace_quote_items")
      .insert(itemsToInsert);
    if (items.error) {
      return { ok: false, error: `line-items-failed: ${items.error.message}` };
    }
  }

  // Audit event.
  await supabaseAdmin
    .from("app_quote_workspace_quote_events")
    .insert({
      quote_id: quoteId,
      verb:     "drafted",
      metadata: {
        source:        "nex_estimator",
        trade:         e.trade,
        scope:         e.scope,
        defaults_used: e.defaults
      }
    });

  return { ok: true, quote_id: quoteId, share_token: shareToken, total_pence: e.total_pence };
}
