// src/app/api/nex/scheduled/[job_id]/run-now/route.ts
//
// Founder Phase 18 · P18-3 · Force-execute a job regardless of cadence.

import { NextResponse } from "next/server";
import { executeJob } from "@/lib/nex/scheduled";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ job_id: string }> }) {
  const { job_id } = await ctx.params;
  const out = await executeJob(job_id, "run-now");
  if (!out.ran) return NextResponse.json({ error: "not_active_or_not_found" }, { status: 404 });
  return NextResponse.json(out);
}
