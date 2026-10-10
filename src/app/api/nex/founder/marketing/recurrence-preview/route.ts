// POST /api/nex/founder/marketing/recurrence-preview
//
// Founder-only DRY-RUN preview of a recurrence spec. Zero triggers ·
// zero cron activation · pure calculation.

import { NextResponse } from "next/server";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import {
  computeNextRun, enumerateOccurrences,
  type RecurrenceSpec,
} from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const spec = body?.spec as RecurrenceSpec;
  const now_iso = String(body?.now ?? new Date().toISOString());
  const enumerate = body?.enumerate as { from_iso: string; to_iso: string; max: number } | undefined;

  if (!spec || typeof spec !== "object") {
    return NextResponse.json({ ok: false, error: "spec_required" }, { status: 400 });
  }

  const next = computeNextRun(spec, now_iso);
  const list = enumerate
    ? enumerateOccurrences(spec, enumerate)
    : null;

  return NextResponse.json({
    ok: true,
    note: "DRY-RUN recurrence preview · zero triggers · zero cron activation",
    spec,
    next_run: next,
    enumeration: list,
  });
}
