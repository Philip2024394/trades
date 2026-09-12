// GET /api/nex/shadow/unevaluated
// Founder-only queue of clustered UNEVALUATED records with deterministic
// priority scoring. Never auto-authors or auto-promotes.

import { NextResponse } from "next/server";
import { buildUnevaluatedReport } from "@/lib/nex-shadow/unevaluated-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(buildUnevaluatedReport(), { headers: { "Cache-Control": "no-store" } });
}
