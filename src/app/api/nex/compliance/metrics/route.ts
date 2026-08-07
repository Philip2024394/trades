// GET /api/nex/compliance/metrics — Mission Control aggregates
import { NextResponse } from "next/server";
import { getComplianceMetrics } from "@/lib/nex/compliance/engine";
import { POLICY } from "@/lib/nex/compliance/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ...(await getComplianceMetrics()), policy: POLICY });
}
