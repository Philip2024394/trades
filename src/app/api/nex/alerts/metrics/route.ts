// GET /api/nex/alerts/metrics — MTTD/MTTA/MTTR + by-rule counts
import { NextResponse } from "next/server";
import { getAlertOpsMetrics } from "@/lib/nex/alerts/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json({ ok: true, ...(await getAlertOpsMetrics()) }); }
