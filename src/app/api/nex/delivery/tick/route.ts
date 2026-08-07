// POST /api/nex/delivery/tick — process up to N jobs synchronously.
// Called by a cron in production. Manually pressable from the UI in dev.
import { NextResponse } from "next/server";
import { tickBatch } from "@/lib/nex/delivery/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const maxTicks = Math.max(1, Math.min(50, Number(url.searchParams.get("max") ?? 10)));
  const results = await tickBatch(maxTicks);
  const summary = {
    ticks_attempted: results.length,
    jobs_processed: results.filter((r) => r.picked).length,
    successes: results.filter((r) => r.picked && r.outcome === "success").length,
    failures:  results.filter((r) => r.picked && r.outcome !== "success").length,
  };
  return NextResponse.json({ ok: true, summary, results });
}

export async function GET(request: Request) { return POST(request); }
