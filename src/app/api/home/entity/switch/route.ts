// POST /api/home/entity/switch { entity_id }
// Sets the active-entity cookie after checking the caller is a member.

import { NextResponse } from "next/server";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { loadMembership } from "@/lib/os/entities";
import { setActiveEntityCookie } from "@/lib/os/entitySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: { entity_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const entityId = (body.entity_id ?? "").trim();
  if (!entityId) {
    return NextResponse.json({ ok: false, error: "missing_entity_id" }, { status: 400 });
  }

  const membership = await loadMembership({ entityId, partyId: party.id });
  if (!membership) {
    return NextResponse.json({ ok: false, error: "not_a_member" }, { status: 403 });
  }

  await setActiveEntityCookie(entityId);
  return NextResponse.json({
    ok: true,
    entity: {
      id: membership.entity.id,
      display_name: membership.entity.display_name,
      tier: membership.entity.tier
    },
    role: membership.role
  });
}
