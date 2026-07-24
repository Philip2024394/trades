// VAT summary.
//
// Sources today:
//   • Output VAT — sum of vat_pence on accepted quotes in the window.
//   • Input VAT — estimated by applying the VAT rate to material/supplier
//     cost lines. Rough — merchant's accountant is authoritative.
//
// The disclaimer is NON-NEGOTIABLE: Nex is not a tax adviser. Every
// callers must surface it.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type VATSummary } from "./types";

const DAY_MS = 86_400_000;
const DEFAULT_VAT_PCT = 20;

const DISCLAIMER =
  "Nex is not a tax adviser. These figures are estimated from your Trade OS ledger for your own planning; " +
  "your accountant remains authoritative for the actual VAT return.";

export type BuildVATInput = {
  merchantId:        string;
  merchantListingId: string;
  vatRatePct?:       number;   // default 20 (UK standard)
  windowDays?:       number;   // default 90
  now?:              Date;
};

export async function buildVAT(opts: BuildVATInput): Promise<VATSummary> {
  const now      = opts.now ?? new Date();
  const rate     = opts.vatRatePct ?? DEFAULT_VAT_PCT;
  const window   = opts.windowDays ?? 90;
  const fromIso  = new Date(now.getTime() - window * DAY_MS).toISOString();
  const evidence = evidenceFor(
    "app_quote_workspace_quotes (vat_pence) + hammerex_sitebook_costs (material/supplier)",
    ["app_quote_workspace_quotes", "hammerex_sitebook_costs"]
  );

  const quotes = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("vat_pence")
    .eq("merchant_id", opts.merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", fromIso);

  const output = (quotes.data ?? []).reduce((s, r) => s + Number(r.vat_pence ?? 0), 0);

  // Input VAT — apply rate to net material/supplier spend on this
  // merchant's costs.
  const costs = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("agreed_pence, paid_pence, kind")
    .eq("trade_listing_id", opts.merchantListingId)
    .in("kind", ["materials", "supplier"])
    .gte("created_at", fromIso)
    .neq("status", "cancelled");

  const vatableSpend = (costs.data ?? []).reduce((s, r) => {
    const amt = Number(r.paid_pence ?? 0) > 0 ? Number(r.paid_pence) : Number(r.agreed_pence ?? 0);
    return s + amt;
  }, 0);
  // Rough: the cost stored is the merchant-recorded price. Assume it
  // was gross of VAT (typical) — VAT reclaimable = amount × rate/(100+rate).
  const inputVat = Math.round(vatableSpend * (rate / (100 + rate)));

  return {
    window_days:               window,
    vat_rate_pct:              rate,
    vat_payable_pence:         output,
    vat_reclaimable_est_pence: inputVat,
    vat_net_pence:             output - inputVat,
    disclaimer:                DISCLAIMER,
    evidence
  };
}
