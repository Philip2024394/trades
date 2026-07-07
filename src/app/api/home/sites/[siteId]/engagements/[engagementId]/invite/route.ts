// POST /api/home/sites/[siteId]/engagements/[engagementId]/invite
//
// Owner/foreman fires a Notebook invite for the sub-trade named on an
// engagement. The invite carries the engagement_id so when the trade
// completes signup, the engagement links to their new listing.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireEntityRole } from "@/lib/os/entitySession";
import { hashEmail } from "@/lib/os/hashing";
import { notifyTradeInvited } from "@/lib/os/tradeInviteNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { siteId: string; engagementId: string };

export async function POST(
  request: Request,
  ctx: { params: Promise<Params> }
) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  let membership;
  try {
    membership = await requireEntityRole("foreman");
  } catch {
    return NextResponse.json(
      { ok: false, error: "insufficient_role" },
      { status: 403 }
    );
  }

  const { siteId, engagementId } = await ctx.params;

  const { data: engagement } = await supabaseAdmin
    .from("os_site_engagements")
    .select(
      "id, site_id, hired_display_name, hired_trade, service_description, agreed_price_pence, deposit_pence, business_id, owner_entity_id, site:os_sites(name)"
    )
    .eq("id", engagementId)
    .eq("site_id", siteId)
    .maybeSingle();

  if (!engagement || engagement.owner_entity_id !== membership.entity_id) {
    return NextResponse.json(
      { ok: false, error: "engagement_not_found" },
      { status: 404 }
    );
  }
  if (engagement.business_id) {
    return NextResponse.json(
      { ok: false, error: "trade_already_linked" },
      { status: 409 }
    );
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  // Already on the platform? Direct link, no email.
  const { data: existingListing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name")
    .eq("email", email)
    .maybeSingle();

  if (existingListing) {
    // Link the engagement to the existing listing via os_business_listings.
    const { data: osBusiness } = await supabaseAdmin
      .from("os_business_listings")
      .select("id")
      .eq("slug", existingListing.slug)
      .maybeSingle();
    if (osBusiness) {
      await supabaseAdmin
        .from("os_site_engagements")
        .update({ business_id: osBusiness.id, status: "accepted" })
        .eq("id", engagementId);
    }
    return NextResponse.json({
      ok: true,
      alreadyOnPlatform: true,
      linkedListingId: existingListing.id
    });
  }

  const emailHashValue = hashEmail(email);

  // Already pending in this entity?
  const { data: pending } = await supabaseAdmin
    .from("os_homeowner_trade_invites")
    .select("id, token")
    .eq("inviter_entity_id", membership.entity_id)
    .eq("invited_email_hash", emailHashValue)
    .eq("status", "pending")
    .maybeSingle();

  if (pending) {
    // Attach the engagement_id if it's not already.
    await supabaseAdmin
      .from("os_homeowner_trade_invites")
      .update({ engagement_id: engagementId })
      .eq("id", pending.id)
      .is("engagement_id", null);
    return NextResponse.json({
      ok: true,
      alreadyPending: true,
      inviteId: pending.id
    });
  }

  const noteContext = engagement.service_description
    ? `${engagement.service_description}${
        engagement.agreed_price_pence
          ? ` — agreed £${(engagement.agreed_price_pence / 100).toLocaleString("en-GB")}`
          : ""
      }`
    : null;

  const { data: invite, error } = await supabaseAdmin
    .from("os_homeowner_trade_invites")
    .insert({
      inviter_party_id: party.id,
      inviter_entity_id: membership.entity_id,
      engagement_id: engagementId,
      invited_display_name: engagement.hired_display_name,
      invited_email: email,
      invited_email_hash: emailHashValue,
      invited_trade: engagement.hired_trade,
      note: noteContext,
      status: "pending",
      sent_at: new Date().toISOString()
    })
    .select("id, token")
    .single();

  if (error || !invite) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  const siteRecord = Array.isArray(engagement.site) ? engagement.site[0] : engagement.site;

  await notifyTradeInvited({
    invitedEmail: email,
    invitedDisplayName: engagement.hired_display_name,
    invitedTrade: engagement.hired_trade,
    inviterDisplayName: membership.entity.display_name,
    note:
      noteContext ??
      `You've been hired on: ${siteRecord?.name ?? "a site"}`,
    token: invite.token
  });

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: membership.entity_id,
    actor_party_id: party.id,
    verb: "engagement.invite_sent",
    after_state: {
      engagement_id: engagementId,
      email
    }
  });

  return NextResponse.json({ ok: true, inviteId: invite.id });
}
