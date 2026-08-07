// GET /api/nex/contacts/overview — Contact Intelligence Mission Control feed
//
// Aggregates from the canonical contact registry · powers the Contacts
// section in the Communications Centre panel. Same "honest empty vs live"
// pattern as other Runtime services.

import { NextResponse } from "next/server";
import { getOverview, isContactRegistryHealthy } from "@/lib/nex/contacts/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await isContactRegistryHealthy();
  if (!health.healthy) {
    return NextResponse.json({
      ok: false,
      health,
      reason: "registry not reachable · aggregates unavailable",
    }, { status: 503 });
  }
  const overview = await getOverview();
  return NextResponse.json({ ok: true, health, ...overview });
}
