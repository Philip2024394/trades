// src/app/api/nex/scheduled/[job_id]/runs/route.ts
//
// Founder Phase 18 · P18-3 · List recent runs for a job.

import { NextResponse } from "next/server";
import { listRuns, findJobById } from "@/lib/nex/scheduled";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ job_id: string }> }) {
  const { job_id } = await ctx.params;
  const job = await findJobById(job_id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 20)));
  const runs = await listRuns(job_id, limit);
  return NextResponse.json({ job, runs });
}
