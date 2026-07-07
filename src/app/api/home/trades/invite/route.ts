// POST /api/home/trades/invite
//
// Owner-only. Records an invitation for Mike the Carpenter (or whoever)
// to join xratedtrade.com. Fires a Notebook invitation email. When Mike
// completes /join with the invite token, the row is marked accepted and
// linked to his newly-created listing.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { hashEmail } from "@/lib/os/hashing";
import { notifyTradeInvited } from "@/lib/os/tradeInviteNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  displayName?: string;
  email?: string;
  trade?: string;
  note?: string;
};

export async function POST(request: Request) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const displayName = (body.displayName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const trade = (body.trade ?? "").trim();
  const note = (body.note ?? "").trim() || null;

  if (!displayName || !email || !trade) {
    return NextResponse.json(
      { ok: false, error: "missing_required_fields" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const emailHashValue = hashEmail(email);

  // If this trade already exists on the platform, don't send a "join" email;
  // fall back to a Circle-add flow (Phase B, not built yet). For now flag it.
  const { data: existingListing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name")
    .eq("email", email)
    .maybeSingle();
  if (existingListing) {
    return NextResponse.json({
      ok: true,
      alreadyOnPlatform: true,
      slug: existingListing.slug,
      displayName: existingListing.display_name
    });
  }

  // Don't spam re-invites for the same email on the same inviter.
  const { data: pending } = await supabaseAdmin
    .from("os_homeowner_trade_invites")
    .select("id, token, status")
    .eq("inviter_party_id", party.id)
    .eq("invited_email_hash", emailHashValue)
    .in("status", ["pending"])
    .maybeSingle();
  if (pending) {
    return NextResponse.json({
      ok: true,
      inviteId: pending.id,
      alreadyPending: true
    });
  }

  const membership = await loadActiveMembership();

  const { data: inserted, error } = await supabaseAdmin
    .from("os_homeowner_trade_invites")
    .insert({
      inviter_party_id: party.id,
      inviter_entity_id: membership?.entity_id ?? null,
      invited_display_name: displayName,
      invited_email: email,
      invited_email_hash: emailHashValue,
      invited_trade: trade,
      note,
      status: "pending",
      sent_at: new Date().toISOString()
    })
    .select("id, token")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  await notifyTradeInvited({
    invitedEmail: email,
    invitedDisplayName: displayName,
    invitedTrade: trade,
    inviterDisplayName: party.display_name || "A homeowner on XRatedTrade",
    note,
    token: inserted.token
  });

  return NextResponse.json({ ok: true, inviteId: inserted.id });
}
