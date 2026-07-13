// PATCH /api/auth/trade/profile — update the current trade's profile.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTrade } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const trade = await getCurrentTrade();
  if (!trade) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof payload.displayName === "string" && payload.displayName.trim()) {
    patch.display_name = payload.displayName.trim();
  }
  if (typeof payload.tradeDiscipline === "string") {
    patch.trade_discipline = payload.tradeDiscipline.trim() || null;
  }
  if (typeof payload.homePostcode === "string") {
    patch.home_postcode = payload.homePostcode.trim().toUpperCase() || null;
  }
  if (typeof payload.homeCity === "string") {
    patch.home_city = payload.homeCity.trim() || null;
  }
  if (typeof payload.identityComplete === "boolean") {
    patch.identity_complete = payload.identityComplete;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("app_trade_profiles")
    .update(patch)
    .eq("id", trade.id);
  if (error) {
    // Common cause in dev: the app_trade_profiles migration hasn't been
    // applied yet. Rather than 500-ing the profile flow (which is the
    // trade's very first experience), surface a soft ok so the UI can
    // proceed. Real prod deploys will always have this table.
    if (/could not find the table|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({
        ok: true,
        migrationsPending: true,
        note: "Profile changes weren't persisted — app_trade_profiles migration not applied."
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
