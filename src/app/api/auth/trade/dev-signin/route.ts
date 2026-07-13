// POST /api/auth/trade/dev-signin
//
// [DEV BUTTON] — remove on "remove dev buttons"
//
// Dev-only bypass so the sign-in flow works before OTP-table migrations
// have been applied. In prod (NODE_ENV === "production") this route
// returns 404 and does nothing.
//
// Creates a demo Supabase auth user with email `dev@trade-center.local`,
// upserts a matching profile row, then issues a magic-link token that
// the SSR client immediately verifies so real auth cookies are set.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

const DEV_EMAIL = "dev@trade-center.local";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Find or create the demo user
  let userId: string | null = null;
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === DEV_EMAIL);
  if (found) {
    userId = found.id;
  } else {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEV_EMAIL,
      email_confirm: true,
      user_metadata: { display_name: "Demo Trade" }
    });
    if (error || !created?.user) {
      return NextResponse.json({ error: error?.message ?? "create_failed" }, { status: 500 });
    }
    userId = created.user.id;
  }
  if (!userId) return NextResponse.json({ error: "no_user" }, { status: 500 });

  // Best-effort profile upsert — if the profiles table isn't migrated
  // yet we still return ok so the caller can proceed with an auth-only
  // session; identityComplete will read false and route to
  // /tc/complete-identity, which is where migrations show their absence
  // in the same clear error message.
  await supabaseAdmin
    .from("app_trade_profiles")
    .upsert(
      {
        id:                userId,
        email:             DEV_EMAIL,
        display_name:      "Demo Trade",
        trade_discipline:  "plasterer",
        home_postcode:     "M20",
        identity_complete: true
      },
      { onConflict: "id" }
    )
    .then(() => null, () => null);

  // Set session cookies via SSR client
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: DEV_EMAIL
  });
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }
  if (linkData?.properties?.hashed_token) {
    const supabase = await getSupabaseServer();
    await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token
    });
  }

  return NextResponse.json({ ok: true, tradeId: userId });
}
