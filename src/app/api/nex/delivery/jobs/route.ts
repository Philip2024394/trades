// GET /api/nex/delivery/jobs?status=&campaign_id=&limit=
import { NextResponse } from "next/server";
import { listJobs } from "@/lib/nex/delivery/queue";
import type { JobStatus } from "@/lib/nex/delivery/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as JobStatus | null;
  const campaign_id = url.searchParams.get("campaign_id") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const jobs = await listJobs({ status: status ?? undefined, campaign_id, limit });
  return NextResponse.json({ ok: true, jobs });
}
