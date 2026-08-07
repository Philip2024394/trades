// GET /api/nex/analytics/dashboard — HQ executive dashboard payload
import { NextResponse } from "next/server";
import { executiveDashboard } from "@/lib/nex/analytics/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ ok: true, ...(await executiveDashboard()) });
}
