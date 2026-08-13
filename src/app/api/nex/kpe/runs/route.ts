// GET /api/nex/kpe/runs — list recent KPE processing runs

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { store } from "@/lib/nex/kpe/storage/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "50") || 50), 500);
  try {
    const runs = await store.readRuns(limit);
    const summary = {
      total: runs.length,
      by_outcome: runs.reduce<Record<string, number>>((acc, r) => {
        acc[r.final_outcome] = (acc[r.final_outcome] ?? 0) + 1;
        return acc;
      }, {}),
      total_chunks: runs.reduce((n, r) => n + r.chunks_created, 0),
      total_brain_writes: runs.reduce((n, r) => n + r.brain_writes, 0),
    };
    return NextResponse.json({ ok: true, backend: "filesystem", runs, count: runs.length, summary });
  } catch (err) {
    console.error("[kpe.runs] failed:", err);
    return NextResponse.json({ ok: false, error: "read_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
