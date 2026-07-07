// GET /api/home/entity/list
// Returns every membership for the signed-in party, with the active one flagged.

import { NextResponse } from "next/server";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { listMembershipsForParty } from "@/lib/os/entities";
import { loadActiveMembership } from "@/lib/os/entitySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const party = await requireHomeownerSession();
    const [memberships, active] = await Promise.all([
      listMembershipsForParty(party.id),
      loadActiveMembership()
    ]);
    return NextResponse.json({
      ok: true,
      memberships: memberships.map((m) => ({
        entityId: m.entity_id,
        displayName: m.entity.display_name,
        tier: m.entity.tier,
        role: m.role,
        isActive: active ? active.entity_id === m.entity_id : false
      }))
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
}
