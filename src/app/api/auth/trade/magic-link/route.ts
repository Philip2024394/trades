// POST /api/auth/trade/magic-link
//
// Body: { email: string, next?: string }
//
// Fires a Supabase magic-link email. The link takes the user back to
// /auth/callback which exchanges the token, provisions the trade
// profile, and routes to /tc/complete-identity or `next`.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const next = String(payload.next ?? "/tc/notebook");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const origin = new URL(req.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true
    }
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sentTo: email });
}
