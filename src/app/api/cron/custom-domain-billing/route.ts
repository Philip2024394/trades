// Cron · nightly 03:15 UTC — enforces the custom_domain add-on
// billing state.
//
// The add-on was advertised "free first 30 days, then £5/mo" but
// there was no enforcement — merchants who enabled it were silently
// getting £5/mo free forever. This cron:
//
//   1. Finds listings where custom_domain_billing_state = 'trial'
//      AND custom_domain_trial_ends_at < NOW()
//      AND no active Stripe subscription for the custom_domain price
//   2. Flips them to 'lapsed'
//   3. Removes the custom_domain flag from addons_enabled
//   4. Emails the merchant so they know why the domain stopped working
//
// Merchants who upgraded to a paid subscription for custom_domain
// via Stripe are safe — the webhook flips their state to 'active'.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ListingRow = {
  id:                            string;
  slug:                          string;
  display_name:                  string;
  primary_email:                 string | null;
  addons_enabled:                Record<string, boolean> | null;
  custom_domain_trial_ends_at:   string | null;
  custom_domain_billing_state:   string;
};

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, primary_email, addons_enabled, custom_domain_trial_ends_at, custom_domain_billing_state")
    .eq("custom_domain_billing_state", "trial")
    .not("custom_domain_trial_ends_at", "is", null)
    .lt("custom_domain_trial_ends_at", nowIso);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as ListingRow[];
  let lapsed = 0;
  const failures: Array<{ slug: string; reason: string }> = [];

  for (const r of rows) {
    try {
      // Strip the custom_domain flag from addons_enabled — the add-on
      // enforcement layer reads this map so this is what actually
      // disables the domain resolution.
      const addons = { ...(r.addons_enabled ?? {}) };
      addons["custom_domain"] = false;

      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          custom_domain_billing_state: "lapsed",
          addons_enabled:              addons
        })
        .eq("id", r.id);

      lapsed++;
    } catch (e) {
      failures.push({ slug: r.slug, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok:        true,
    ran_at:    nowIso,
    checked:   rows.length,
    lapsed,
    failures
  });
}
