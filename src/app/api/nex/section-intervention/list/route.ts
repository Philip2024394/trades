// src/app/api/nex/section-intervention/list/route.ts

import { NextResponse } from "next/server";
import { interventionStore } from "@/lib/nex/intervention/intervention-singleton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const interventions = interventionStore.listInterventions();
  const attempts = interventionStore.listAutoRebuildAttempts();
  return NextResponse.json({
    ok: true,
    interventions,
    auto_rebuild_attempts: attempts,
    generated_at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
