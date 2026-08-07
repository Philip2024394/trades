// GET /api/nex/campaigns/metrics — Mission Control aggregates
import { NextResponse } from "next/server";
import { getCampaignMetrics } from "@/lib/nex/campaigns/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ...(await getCampaignMetrics()) });
}
