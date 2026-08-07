// GET /api/nex/alerts?state=&limit= — list alerts
import { NextResponse } from "next/server";
import { listAlerts } from "@/lib/nex/alerts/evaluator";
import type { Alert } from "@/lib/nex/alerts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") as Alert["state"] | null;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  return NextResponse.json({ ok: true, alerts: await listAlerts(state ?? undefined, limit) });
}
