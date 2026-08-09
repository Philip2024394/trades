// GET /api/nex/storage/gates — Wave 11 · Step 11 · F29 remediation.
//
// Operator-visible snapshot of the six Headquarters feature gates.
// Renders in the NexStoragePanel "Feature Gates" section (UI wire-up
// is a follow-up step · this endpoint unblocks that work). Existing
// operators can hit this endpoint directly to answer:
//
//   · which Brain backend is authoritative right now?
//   · is the Postgres shadow write active?
//   · is the Wave 7 reverse-shadow rollback safety net on?
//   · which Object Storage adapter is selected?
//
// Response shape mirrors `FeatureGates` from `src/lib/nex/config/gates.ts`
// plus a top-level timestamp so the panel can reason about freshness.
// Every field is always present · "unset" is a valid, honest value
// (the operator never opted in · not fabricated as "off").
//
// Auth · this endpoint returns NO secrets · only gate values that are
// already in env. Safe for unauthenticated dashboard consumption in
// the HQ-internal deployment context. If the HQ is later exposed to
// non-operator users, gate this behind the HQ session middleware.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getFeatureGates, GATE_ENV_NAMES } from "@/lib/nex/config/gates";
// W-OBS-1 Path A Layer 1 · ALS scope · observability endpoint · CID
// available to any signal / audit emission downstream.
import { runFromRequest } from "@/lib/nex/observability/correlation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return runFromRequest(req, () => gatesHandler());
}

async function gatesHandler() {
  const gates = getFeatureGates();
  return NextResponse.json({
    ok: true,
    read_at: new Date().toISOString(),
    gate_env_names: GATE_ENV_NAMES,
    gates,
  });
}
