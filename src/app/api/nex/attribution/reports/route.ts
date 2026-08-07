// GET /api/nex/attribution/reports?model=&window_days=&since=
import { NextResponse } from "next/server";
import { computeReport, labelReport } from "@/lib/nex/attribution/reports";
import type { AttributionModel } from "@/lib/nex/attribution/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const model = (url.searchParams.get("model") ?? "last_touch") as AttributionModel;
  const window_days = url.searchParams.get("window_days");
  const since = url.searchParams.get("since") ?? undefined;
  const report = await computeReport({ model, window_days: window_days ? Number(window_days) : undefined, since });
  const labelled = await labelReport(report);
  return NextResponse.json({ ok: true, ...labelled });
}
