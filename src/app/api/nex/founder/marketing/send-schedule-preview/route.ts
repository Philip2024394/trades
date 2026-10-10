// POST /api/nex/founder/marketing/send-schedule-preview
//
// Founder-only DRY-RUN preview of a send schedule. Read-only projection ·
// zero mutation · zero queue writes · zero sends. Answers the question:
// "given sender X with reputation Y, how would N emails be scheduled over M hours?"

import { NextResponse } from "next/server";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { computeSendSchedule, type SendSchedulerInput } from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const input: SendSchedulerInput = {
    sender_id: String(body?.sender_id ?? "preview"),
    reputation_state: body?.reputation_state,
    requested_units: Number(body?.requested_units),
    window_hours: Number(body?.window_hours),
    per_hour_cap: Number(body?.per_hour_cap),
    start_at: String(body?.start_at ?? new Date().toISOString()),
    min_slot_size: body?.min_slot_size,
    max_slot_size: body?.max_slot_size,
    min_inter_slot_ms: body?.min_inter_slot_ms,
  };
  const outcome = computeSendSchedule(input);
  return NextResponse.json({ ok: true, outcome, note: "DRY-RUN preview · no sends · no queue writes" });
}
