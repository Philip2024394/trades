// GET /api/nex/predictive/predictions?target=&contact_id=&limit=
// Lists predictions for observability + audit. INSERT-only source.
import { NextResponse } from "next/server";
import { listPredictions } from "@/lib/nex/predictive/engine";
import type { PredictionTarget } from "@/lib/nex/predictive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("target") as PredictionTarget | null;
  const contact_id = url.searchParams.get("contact_id") ?? undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  const predictions = await listPredictions({ target: target ?? undefined, contact_id, limit });
  return NextResponse.json({ ok: true, predictions });
}
