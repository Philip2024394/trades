// GET /api/entity/accept?token=...
//
// Handles the mutation + cookie set for entity invite acceptance, then
// redirects to a success page. Server components can't set cookies,
// route handlers can.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import {
  setActiveEntityCookie,
  ACTIVE_ENTITY_COOKIE
} from "@/lib/os/entitySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";

  if (!token) {
    return NextResponse.redirect(new URL("/entity/accept/error?reason=missing", req.url));
  }

  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.redirect(
      new URL(
        `/home/sign-in?next=${encodeURIComponent(`/api/entity/accept?token=${token}`)}`,
        req.url
      )
    );
  }

  const { data: invite } = await supabaseAdmin
    .from("os_entity_member_invites")
    .select(
      "id, entity_id, proposed_role, can_see_financials, status, expires_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.redirect(
      new URL("/entity/accept/error?reason=unknown", req.url)
    );
  }
  if (invite.status !== "pending") {
    return NextResponse.redirect(
      new URL(`/entity/accept/error?reason=${invite.status}`, req.url)
    );
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(
      new URL("/entity/accept/error?reason=expired", req.url)
    );
  }

  // Idempotent add — if they're already a member, skip insert.
  const { data: existing } = await supabaseAdmin
    .from("os_entity_members")
    .select("id")
    .eq("entity_id", invite.entity_id)
    .eq("party_id", party.id)
    .maybeSingle();

  let memberId = existing?.id ?? null;
  if (!existing) {
    const { data: created } = await supabaseAdmin
      .from("os_entity_members")
      .insert({
        entity_id: invite.entity_id,
        party_id: party.id,
        role: invite.proposed_role,
        can_see_financials: invite.can_see_financials
      })
      .select("id")
      .single();
    memberId = created?.id ?? null;
  }

  await supabaseAdmin
    .from("os_entity_member_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      resulting_member_id: memberId
    })
    .eq("id", invite.id)
    .eq("status", "pending");

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: invite.entity_id,
    actor_party_id: party.id,
    target_party_id: party.id,
    target_member_id: memberId,
    verb: "member.accepted_invite",
    after_state: {
      role: invite.proposed_role,
      can_see_financials: invite.can_see_financials
    }
  });

  // Set the active-entity cookie on the response instead of via
  // cookies().set() (which would need a server action context).
  const res = NextResponse.redirect(new URL("/entity/accept?ok=1", req.url));
  res.cookies.set(ACTIVE_ENTITY_COOKIE, invite.entity_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90
  });
  return res;
}
