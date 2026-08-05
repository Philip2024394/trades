// POST /api/nex/brain/guardian — run one Memory Guardian audit pass
//
// Batch-cadence worker. Safe to call whenever; typical schedule is
// nightly (via external cron or Supabase pg_cron once live). Returns
// the GuardianReport with every finding surfaced.
//
// Body (optional):
//   { create_contradictions?: boolean, create_audit_entries?: boolean }
// Defaults: both true. Set false for a dry-run.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runMemoryGuardian } from "@/lib/nex/brain/workers/memory-guardian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { create_contradictions?: boolean; create_audit_entries?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* body optional */
  }
  try {
    const report = await runMemoryGuardian({
      create_contradictions: body.create_contradictions,
      create_audit_entries: body.create_audit_entries,
    });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[api.brain.guardian] failed:", err);
    return NextResponse.json({ ok: false, error: "guardian_failed" }, { status: 500 });
  }
}
