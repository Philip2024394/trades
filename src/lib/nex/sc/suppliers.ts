// Supplier profiles — extends MD's supplier ranking with reliability
// (paid-on-time %) and last-known prices (grouped by cost label).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type SupplierProfile, type SupplierProfiles } from "./types";

const DAY_MS = 86_400_000;

export type BuildSupplierProfilesInput = {
  merchantListingId: string;
  windowDays?:       number;    // default 180 (need history for reliability)
  now?:              Date;
};

export async function buildSupplierProfiles(opts: BuildSupplierProfilesInput): Promise<SupplierProfiles> {
  const now       = opts.now ?? new Date();
  const window    = opts.windowDays ?? 180;
  const fromIso   = new Date(now.getTime() - window * DAY_MS).toISOString();
  const evidence  = evidenceFor(
    "hammerex_sitebook_costs (kind=supplier|materials) + payment behaviour",
    ["hammerex_sitebook_costs"]
  );

  const rows = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("trade_name, agreed_pence, paid_pence, due_at, created_at, kind, description")
    .in("kind", ["supplier", "materials"])
    .eq("trade_listing_id", opts.merchantListingId)
    .gte("created_at", fromIso);

  type Bucket = {
    profile: SupplierProfile;
    /** Per-supplier per-label most-recent price capture. */
    labelPrices: Map<string, { unit_price_pence: number; when: string }>;
    onTimeCount: number;
    settledCount: number;   // rows we could evaluate for reliability
  };
  const byName = new Map<string, Bucket>();

  for (const r of rows.data ?? []) {
    const key = String(r.trade_name ?? "(unlabelled)");
    const spend = Number(r.paid_pence ?? 0) > 0 ? Number(r.paid_pence) : Number(r.agreed_pence ?? 0);
    const created = String(r.created_at);

    let b = byName.get(key);
    if (!b) {
      b = {
        profile: {
          supplier_key:      key,
          spend_pence:       0,
          cost_count:        0,
          latest_cost_at:    null,
          paid_on_time_pct:  null,
          latest_prices:     [],
          evidence
        },
        labelPrices:  new Map(),
        onTimeCount:  0,
        settledCount: 0
      };
      byName.set(key, b);
    }
    b.profile.spend_pence += spend;
    b.profile.cost_count  += 1;
    if (!b.profile.latest_cost_at || created > b.profile.latest_cost_at) b.profile.latest_cost_at = created;

    // Reliability: settled = paid_pence >= agreed_pence.
    const agreed = Number(r.agreed_pence ?? 0);
    const paid   = Number(r.paid_pence ?? 0);
    if (agreed > 0 && paid >= agreed) {
      b.settledCount++;
      const dueIso = r.due_at as string | null;
      // On-time = no due date (implicit accepted) OR paid before due.
      // We approximate "paid before due" by created_at (proxy) < due_at.
      // The cost table doesn't have a paid_at, so this is a best-effort
      // signal — honest note in the evidence source.
      if (!dueIso || created <= dueIso) b.onTimeCount++;
    }

    // Latest price capture — one entry per (supplier, description).
    const label = String(r.description ?? "").trim().slice(0, 60);
    if (label.length > 0 && agreed > 0) {
      const cur = b.labelPrices.get(label);
      if (!cur || created > cur.when) {
        b.labelPrices.set(label, { unit_price_pence: agreed, when: created });
      }
    }
  }

  const suppliers: SupplierProfile[] = [];
  for (const b of byName.values()) {
    if (b.settledCount >= 3) {
      b.profile.paid_on_time_pct = Number(((b.onTimeCount / b.settledCount) * 100).toFixed(1));
    }
    b.profile.latest_prices = Array.from(b.labelPrices.entries())
      .map(([label, v]) => ({ label, unit_price_pence: v.unit_price_pence, when: v.when }))
      .sort((a, b2) => b2.when.localeCompare(a.when))
      .slice(0, 5);
    suppliers.push(b.profile);
  }
  suppliers.sort((a, b) => b.spend_pence - a.spend_pence);

  const warnings: string[] = [];
  if (suppliers.length === 0) warnings.push("No supplier spend recorded in the window.");
  warnings.push("Reliability is derived from paid-status only — no paid_at column exists yet, so 'paid on time' is a best-effort signal.");

  return {
    window_days: window,
    suppliers,
    warnings,
    evidence
  };
}
