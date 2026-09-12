// GET /api/nex/shadow/stats
// Founder-only observation surface · aggregate statistics + versions.

import { NextResponse } from "next/server";
import { readStats } from "@/lib/nex-shadow/store";
import { loadExpectations } from "@/lib/nex-shadow/examiner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const stats = readStats();
  const exp = loadExpectations();
  return NextResponse.json({
    at: new Date().toISOString(),
    stats,
    expectations: {
      version: exp.version,
      count: exp.entries.length,
    },
    attribution: {
      external_llm_used: false,
      shadow_mode: true,
      independent_authorship_percent: 0,
      taught_by: "master_ai_engineer",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
