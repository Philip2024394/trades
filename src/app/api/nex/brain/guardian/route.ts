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
import { z } from "zod";
import { runMemoryGuardian } from "@/lib/nex/brain/workers/memory-guardian";
// V-1b · D9 route-boundary validation adopted 2026-08-10.
import { validateJsonBody } from "@/lib/nex/brain/http/validate-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BodySchema = z.object({
  create_contradictions: z.boolean().optional(),
  create_audit_entries: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = await validateJsonBody(req, BodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
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
