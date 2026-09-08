// src/app/api/nex/deterministic-shadow/state/route.ts
//
// Founder BEGIN 2026-09-09 · SHADOW-MODE observability
//
// Returns the last N paired {chat brain, deterministic shadow} records +
// rolling agreement notes so the Founder can watch shadow mode from HQ.
//
// Read-only. Zero fabrication. Zero writes. Zero LLM.
//
// Query params:
//   ?n=25  (default · cap 200)

import { NextResponse, type NextRequest } from "next/server";
import {
  SHADOW_MODE_ENABLED, SHADOW_BUDGET_MS, readLastPairs,
} from "@/lib/nex/intelligence-storage-grid/accommodation/shadow-mode";
import { factHotStats } from "@/lib/nex/intelligence-storage-grid/accommodation/hot-tier-facts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const n = Math.min(200, Math.max(1, Number(url.searchParams.get("n") ?? 25)));
  const { pairs, path: jsonl_path, agreement_notes } = await readLastPairs(n);
  const hot = factHotStats();
  return NextResponse.json({
    now_iso: new Date().toISOString(),
    flag: {
      enabled: SHADOW_MODE_ENABLED,
      budget_ms: SHADOW_BUDGET_MS,
      env: {
        NEX_DETERMINISTIC_SHADOW: process.env.NEX_DETERMINISTIC_SHADOW ?? null,
        NEX_DETERMINISTIC_SHADOW_BUDGET_MS: process.env.NEX_DETERMINISTIC_SHADOW_BUDGET_MS ?? null,
      },
    },
    hot_tier: hot,
    agreement_notes,
    jsonl_path,
    pairs_returned: pairs.length,
    pairs,
    instrument_version: "shadow-state-v1-2026-09-09",
  });
}
