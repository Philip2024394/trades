// src/app/api/nex-native/engine/health/route.ts
//
// NEX-native · engine + fleet health diagnostic surface.
// ------------------------------------------------------
// Wave-2 of the 2026-09-24 Scaling Doctrine sequence.
//
// Returns an aggregated snapshot of:
//   · which model is active
//   · registered model fleet
//   · in-process telemetry summary
//   · durable-queue depth + capacity signal
//   · recent job outcomes (1-hour window)
//   · process memory footprint
//
// Auth: Founder/HQ diagnostic use only. This route requires an admin
// header shared secret · not exposed to end users. Rotate by setting
// NEX_ENGINE_HEALTH_ADMIN_KEY in .env.local.

import { NextResponse } from "next/server";
import { getEngineHealthAggregate } from "@/lib/nex-native/engine-health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const adminKey = process.env.NEX_ENGINE_HEALTH_ADMIN_KEY;
  if (!adminKey) {
    return NextResponse.json(
      { ok: false, error: "engine_health_disabled_no_admin_key" },
      { status: 503 }
    );
  }
  const provided = request.headers.get("x-nex-admin-key") ?? "";
  if (provided !== adminKey) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const snapshot = await getEngineHealthAggregate();
    return NextResponse.json({ ok: true, snapshot }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `engine_health_failed · ${msg.slice(0, 200)}` },
      { status: 500 }
    );
  }
}
