// GET /api/nex/composer/metrics — Mission Control aggregates
import { NextResponse } from "next/server";
import { ensureSeedTemplates, getComposerMetrics } from "@/lib/nex/composer/templates_registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeedTemplates();
  return NextResponse.json({ ok: true, ...(await getComposerMetrics()) });
}
