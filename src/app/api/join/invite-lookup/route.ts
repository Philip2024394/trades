// GET /api/join/invite-lookup?token=...
//
// Called by /join/start when it detects ?invite=TOKEN. Returns the
// invite's prefill fields so we can populate the wizard.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from("os_homeowner_trade_invites")
    .select(
      "id, invited_display_name, invited_email, invited_trade, note, status, expires_at, inviter_party_id"
    )
    .eq("token", token)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (data.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "invite_" + data.status },
      { status: 410 }
    );
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { ok: false, error: "invite_expired" },
      { status: 410 }
    );
  }

  const { data: inviter } = await supabaseAdmin
    .from("os_parties")
    .select("display_name")
    .eq("id", data.inviter_party_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    invite: {
      displayName: data.invited_display_name,
      email: data.invited_email,
      trade: data.invited_trade,
      note: data.note,
      inviterName: inviter?.display_name ?? "A homeowner"
    }
  });
}
