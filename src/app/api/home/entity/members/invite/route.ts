// POST /api/home/entity/members/invite
// Owner-only. Adds a pending member invite to the active entity and
// sends an acceptance email.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireEntityRole } from "@/lib/os/entitySession";
import { hashEmail } from "@/lib/os/hashing";
import { notifyEntityMemberInvited } from "@/lib/os/entityInviteNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set([
  "finance",
  "foreman",
  "estimator",
  "viewer",
  "trade"
]);

export async function POST(request: Request) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let membership;
  try {
    membership = await requireEntityRole("owner");
  } catch {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  // Personal entities can't have additional members.
  if (membership.entity.tier === "individual") {
    return NextResponse.json(
      { ok: false, error: "cannot_invite_to_personal_entity" },
      { status: 400 }
    );
  }

  let body: {
    email?: string;
    display_name?: string;
    role?: string;
    can_see_financials?: boolean;
    note?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const displayName = (body.display_name ?? "").trim();
  const role = (body.role ?? "foreman").trim();
  const canSeeFinancials = Boolean(body.can_see_financials);
  const note = (body.note ?? "").trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
  }

  const emailHashValue = hashEmail(email);

  // Already a member?
  const { data: existingMember } = await supabaseAdmin
    .from("os_entity_members")
    .select("id, party:os_parties!inner(email_hash)")
    .eq("entity_id", membership.entity_id)
    .eq("party.email_hash", emailHashValue)
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json(
      { ok: true, alreadyMember: true },
      { status: 200 }
    );
  }

  // Already pending?
  const { data: pending } = await supabaseAdmin
    .from("os_entity_member_invites")
    .select("id, token")
    .eq("entity_id", membership.entity_id)
    .eq("invited_email_hash", emailHashValue)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json(
      { ok: true, alreadyPending: true, inviteId: pending.id },
      { status: 200 }
    );
  }

  const { data: invite, error } = await supabaseAdmin
    .from("os_entity_member_invites")
    .insert({
      entity_id: membership.entity_id,
      inviter_party_id: party.id,
      invited_email: email,
      invited_email_hash: emailHashValue,
      invited_display_name: displayName || null,
      proposed_role: role,
      can_see_financials: canSeeFinancials,
      note,
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

  // Audit trail.
  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: membership.entity_id,
    actor_party_id: party.id,
    verb: "member.invited",
    after_state: { email, role, can_see_financials: canSeeFinancials }
  });

  // Fire the email best-effort.
  try {
    await notifyEntityMemberInvited({
      invitedEmail: email,
      invitedDisplayName: displayName || email.split("@")[0],
      entityDisplayName: membership.entity.display_name,
      inviterDisplayName: party.display_name || "The owner",
      proposedRole: role,
      note,
      token: invite.token
    });
  } catch {
    /* swallow */
  }

  return NextResponse.json({ ok: true, inviteId: invite.id });
}
