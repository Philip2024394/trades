// src/app/api/nex/observatory/snapshot/route.ts
//
// Founder Path A/B · ECO-1 · Observatory Brain snapshot endpoint.
// GET /api/nex/observatory/snapshot?window=1h|24h|7d|30d
//
// Read-only surface for operators. Never writes. Never invokes the LLM.

import { NextResponse } from "next/server";
import { makeObservatoryBrain } from "@/lib/nex/observatory-brain";
import type { WindowPreset } from "@/lib/nex/observatory-brain/contract";

const brain = makeObservatoryBrain();

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("window") ?? "24h").toLowerCase();
  const window: WindowPreset =
    raw === "1h" || raw === "24h" || raw === "7d" || raw === "30d"
      ? (raw as WindowPreset) : "24h";
  try {
    const snapshot = await brain.snapshot(window);
    return NextResponse.json(snapshot);
  } catch (e) {
    return NextResponse.json({
      error: "observatory_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
