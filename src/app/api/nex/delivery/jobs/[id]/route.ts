// GET /api/nex/delivery/jobs/{id} — job + attempt history
import { NextResponse } from "next/server";
import { getAttemptsForJob, getJob } from "@/lib/nex/delivery/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const attempts = await getAttemptsForJob(id);
  return NextResponse.json({ ok: true, job, attempts });
}
