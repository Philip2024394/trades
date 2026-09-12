// src/app/api/nex/scheduled/tick/route.ts
//
// Founder Phase 18 · P18-3 · Tick endpoint · runs every due job.
//
// Idempotent · repeated calls inside cadence window are no-ops.
// Callable by:
//   · a system cron hitting POST every minute
//   · the /nex/scheduled page's "Tick now" button
//   · smoke matrix

import { NextResponse } from "next/server";
import { tick } from "@/lib/nex/scheduled";

export const runtime = "nodejs";

export async function POST() {
  const summary = await tick();
  return NextResponse.json(summary);
}

// GET also works · convenient for browsers hitting the URL directly.
export async function GET() {
  const summary = await tick();
  return NextResponse.json(summary);
}
