// POST /api/trade-off/newsletter/unsubscribe
// Public endpoint — no auth. The unsubscribe link in every marketing
// email points to /newsletter/unsubscribe/<unsubscribe_token>; the
// confirm button on that page calls this route.
//
// Body: { token: <uuid> }. We never accept the email + listing — only
// the per-row unsubscribe_token. That keeps the URL list-untargetable
// (a leaked token can only unsubscribe one row, not a whole list).
//
// PECR / GDPR Article 21(2)+(3) — the unsubscribe must be effective
// immediately, single-click, no login. This route satisfies the
// "must be free of charge and frictionless" rule by flipping the
// status flag without any further verification.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const token = s(body.token);
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid unsubscribe link." },
      { status: 400 }
    );
  }

  // Idempotent — clicking "Unsubscribe" twice is fine. We only update
  // rows that are currently 'active' so a re-click after status moved
  // to 'bounced' / 'complained' doesn't quietly overwrite the deeper
  // signal. Returns ok=true either way so the unsubscribe page can
  // show the same success message.
  const upd = await supabaseAdmin
    .from("hammerex_xrated_newsletter_subscribers")
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString()
    })
    .eq("unsubscribe_token", token)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (upd.error) {
    console.error("[newsletter/unsubscribe] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: "Could not unsubscribe — try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
