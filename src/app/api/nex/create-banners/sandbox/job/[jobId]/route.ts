// src/app/api/nex/create-banners/sandbox/job/[jobId]/route.ts
//
// NEX Create Banners · Sandbox job status endpoint · 2026-09-23
// =============================================================
// GET · returns current job state + per-variant progress.

import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/nex/create-banners/sandbox/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "job_not_found", job_id: jobId },
      { status: 404 }
    );
  }
  return NextResponse.json({
    ok: true,
    job,
  });
}
