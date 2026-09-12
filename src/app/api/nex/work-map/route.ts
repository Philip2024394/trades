// src/app/api/nex/work-map/route.ts
//
// Machine-readable Work Map endpoint for NEX1 / NEX2 / NEX3 programmer agents.
//
// Every code-change decision by an agent MUST consult this endpoint first to:
//   1. Identify which CAP-XXX capabilities the change touches
//   2. Evaluate cross-section impact via impact_boost_to graph
//   3. Verify no sibling capability breaks
//   4. Surface any relevant retro_benefits_available
//   5. Preserve Stage 1a foundation invariants
//
// Route: GET /api/nex/work-map
//
// Cache: force-no-store · always fresh · agents need current build state.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const filePath = join(process.cwd(), "docs", "nex-work-map.json");
    const raw = await readFile(filePath, "utf8");
    const map = JSON.parse(raw) as Record<string, unknown>;
    return NextResponse.json(map, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        "Content-Type": "application/json",
        "X-NEX-Work-Map-Version": String(map.map_version ?? "unknown"),
        "X-NEX-Active-Build": String(map.active_build ?? "none"),
        "X-NEX-Next-Suggested": String(map.next_suggested_build ?? "none"),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "work-map-unavailable",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
