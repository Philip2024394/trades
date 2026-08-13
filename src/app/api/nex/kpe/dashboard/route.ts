// GET /api/nex/kpe/dashboard — single-shot data for the Knowledge Control Centre

import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/nex/kpe/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await buildDashboard();
    return NextResponse.json({ ok: true, backend: "filesystem", ...data });
  } catch (err) {
    console.error("[kpe.dashboard.GET] failed:", err);
    return NextResponse.json({ ok: false, error: "build_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
