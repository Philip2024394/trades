// GET  /api/conversations/engagement/[engagementId]  → find-or-create + return
// POST /api/conversations/engagement/[engagementId]  { body } → send a message
//
// Works for both sides — the caller's role is resolved server-side:
// entity_member if they belong to the engagement's owner entity, trade
// if they're the party linked to the engagement's business_id.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import {
  ensureEngagementConversation,
  listMessages,
  loadOtherLastRead,
  markConversationRead
} from "@/lib/os/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { engagementId: string };

async function resolveScope(engagementId: string, partyId: string) {
  const { data: engagement } = await supabaseAdmin
    .from("os_site_engagements")
    .select(
      "id, hired_display_name, business_id, owner_entity_id"
    )
    .eq("id", engagementId)
    .maybeSingle();
  if (!engagement) return null;

  // Am I a member of the entity that owns this engagement?
  const { data: member } = await supabaseAdmin
    .from("os_entity_members")
    .select("id, party_id")
    .eq("entity_id", engagement.owner_entity_id)
    .eq("party_id", partyId)
    .eq("status", "active")
    .maybeSingle();

  // Or am I the trade — via my business listing's party_id?
  let tradeAccess = false;
  if (engagement.business_id) {
    const { data: biz } = await supabaseAdmin
      .from("os_business_listings")
      .select("party_id")
      .eq("id", engagement.business_id)
      .maybeSingle();
    if (biz?.party_id === partyId) tradeAccess = true;
  }

  return { engagement, isMember: !!member, isTrade: tradeAccess };
}

export async function GET(request: Request, ctx: { params: Promise<Params> }) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const { engagementId } = await ctx.params;
  const scope = await resolveScope(engagementId, party.id);
  if (!scope || (!scope.isMember && !scope.isTrade)) {
    return NextResponse.json({ ok: false, error: "no_access" }, { status: 403 });
  }

  // Owner-party ids for the entity (used when a trade opens the thread first)
  const { data: entityOwners } = await supabaseAdmin
    .from("os_entity_members")
    .select("party_id")
    .eq("entity_id", scope.engagement.owner_entity_id)
    .eq("role", "owner")
    .eq("status", "active");

  const conv = await ensureEngagementConversation({
    engagementId,
    entityId: scope.engagement.owner_entity_id,
    businessId: scope.engagement.business_id,
    creatorPartyId: party.id,
    creatorSide: scope.isMember ? "entity_member" : "trade",
    tradePartyId: scope.isTrade ? party.id : null,
    entityOwnerPartyIds: (entityOwners ?? []).map((r) => r.party_id)
  });
  if (!conv) {
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }

  const messages = await listMessages(conv.id);
  const otherLastRead = await loadOtherLastRead({
    conversationId: conv.id,
    meParty: party.id
  });
  await markConversationRead({ conversationId: conv.id, partyId: party.id });

  return NextResponse.json({
    ok: true,
    conversationId: conv.id,
    myRole: scope.isMember ? "entity_member" : "trade",
    myPartyId: party.id,
    otherLastRead,
    engagement: {
      id: scope.engagement.id,
      hired_display_name: scope.engagement.hired_display_name
    },
    messages
  });
}

export async function POST(request: Request, ctx: { params: Promise<Params> }) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const { engagementId } = await ctx.params;
  const scope = await resolveScope(engagementId, party.id);
  if (!scope || (!scope.isMember && !scope.isTrade)) {
    return NextResponse.json({ ok: false, error: "no_access" }, { status: 403 });
  }

  let body: { body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty_body" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ ok: false, error: "too_long" }, { status: 413 });
  }

  const { data: entityOwners } = await supabaseAdmin
    .from("os_entity_members")
    .select("party_id")
    .eq("entity_id", scope.engagement.owner_entity_id)
    .eq("role", "owner")
    .eq("status", "active");

  const conv = await ensureEngagementConversation({
    engagementId,
    entityId: scope.engagement.owner_entity_id,
    businessId: scope.engagement.business_id,
    creatorPartyId: party.id,
    creatorSide: scope.isMember ? "entity_member" : "trade",
    tradePartyId: scope.isTrade ? party.id : null,
    entityOwnerPartyIds: (entityOwners ?? []).map((r) => r.party_id)
  });
  if (!conv) {
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }

  const { data: msg, error } = await supabaseAdmin
    .from("os_messages")
    .insert({
      conversation_id: conv.id,
      sender_party_id: party.id,
      sender_business_id: scope.isTrade ? scope.engagement.business_id : null,
      sender_side: scope.isMember ? "entity_member" : "trade",
      body: text
    })
    .select("id, body, sender_party_id, sender_side, created_at, attachment_url")
    .single();
  if (error || !msg) {
    return NextResponse.json(
      { ok: false, error: "send_failed", detail: error?.message },
      { status: 500 }
    );
  }

  await markConversationRead({ conversationId: conv.id, partyId: party.id });

  return NextResponse.json({ ok: true, message: msg });
}
