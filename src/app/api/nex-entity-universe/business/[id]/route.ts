// src/app/api/nex-entity-universe/business/[id]/route.ts
//
// NEX Entity Universe · GET business detail
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
//
// Public read-only endpoint. Returns:
//   · identity (name · alternate names · confidence · owner)
//   · active_placements
//   · historical_placements
//   · closed_placements
//   · ambiguous_placements
//   · discovery_flags (has_active_location · has_multiple_active_locations · ...)
//
// §22 · never asserts as fact any placement that is HISTORICAL or
// CLOSED — the response separates them so callers can render honestly.
//
// GET /api/nex-entity-universe/business/[id]

import { NextResponse } from "next/server";
import { readBusinessDetail } from "@/lib/nex/entity-universe/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || typeof id !== "string" || id.length === 0 || id.length > 200) {
    return NextResponse.json({ ok: false, error: "invalid_business_id" }, { status: 400 });
  }
  const detail = readBusinessDetail(id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "business_not_found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    business: {
      business_id: detail.identity.business_id,
      name: detail.identity.name,
      alternate_names: detail.identity.alternate_names,
      identity_confidence: detail.identity.identity_confidence,
      owner_nex_id: detail.identity.owner_nex_id,
      registered_at_iso: detail.identity.registered_at_iso,
      last_evidence_at_iso: detail.identity.last_evidence_at_iso,
    },
    active_placements: detail.active_placements,
    historical_placements: detail.historical_placements,
    closed_placements: detail.closed_placements,
    ambiguous_placements: detail.ambiguous_placements,
    change_history_count: detail.change_history_count,
    discovery_flags: detail.discovery_flags,
    honesty: {
      note: "NEX distinguishes ACTIVE from HISTORICAL / CLOSED placements. Never treat a historical location as current.",
    },
  });
}
