// GET /api/nex/journeys/metrics  · aggregates for the JourneyEnginePanel
import { NextResponse } from "next/server";
import { getJourneyMetrics } from "@/lib/nex/journeys/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json({ ok: true, ...(await getJourneyMetrics()) }); }
