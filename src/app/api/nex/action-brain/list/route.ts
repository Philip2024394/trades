// src/app/api/nex/action-brain/list/route.ts
// Founder Path A/B · ECO-2 · list registered actions (MCP-compatible summary).

import { NextResponse } from "next/server";
import { makeActionBrain } from "@/lib/nex/action-brain";

const brain = makeActionBrain();
export const runtime = "nodejs";

export async function GET() {
  try {
    const actions = await brain.listActions();
    return NextResponse.json({ actions });
  } catch (e) {
    return NextResponse.json({
      error: "list_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
