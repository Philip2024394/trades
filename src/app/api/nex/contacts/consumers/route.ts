// GET /api/nex/contacts/consumers — Consumer Adoption roster + live metrics
//
// Feeds the Consumer Adoption section of the Contact Registry panel.
// Roster is hardcoded (declarative source of truth) · metrics are derived
// from nex.events per each consumer's audit_signal.

import { NextResponse } from "next/server";
import { CONSUMER_ROSTER, getConsumerMetrics } from "@/lib/nex/contacts/consumers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const metrics = await getConsumerMetrics();
  const merged = CONSUMER_ROSTER.map((c) => {
    const m = metrics.find((x) => x.consumer_id === c.id);
    return { ...c, metrics: m };
  });
  return NextResponse.json({
    ok: true,
    consumers: merged,
    generated_at: new Date().toISOString(),
  });
}
