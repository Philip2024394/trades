// POST /api/nex-coding-team/interrupt · body: { run_id, strategy?, reason? }
// Writes a `.abort` sentinel that the runtime + queue dispatcher check
// between stages / between polls. The pipeline halts with `aborted` status
// without any process killing.

import { NextResponse } from "next/server";
import { requestAbort, clearAbort, isAborted } from "@/lib/nex-coding-team/interrupt";

export const dynamic = "force-dynamic";

type Strategy = "abort" | "discard" | "edit";

const RUN_ID_RX = /^run-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z-[0-9a-f]+$/;

export async function POST(req: Request) {
  let body: { run_id?: string; strategy?: Strategy; reason?: string; clear?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const run_id = String(body.run_id ?? "").trim();
  if (!RUN_ID_RX.test(run_id)) {
    return NextResponse.json({ ok: false, error: "invalid run_id shape" }, { status: 400 });
  }

  if (body.clear === true) {
    clearAbort(run_id);
    return NextResponse.json({ ok: true, cleared: true, is_aborted: isAborted(run_id) });
  }

  const strategy: Strategy = body.strategy === "discard" || body.strategy === "edit" ? body.strategy : "abort";
  const reason = String(body.reason ?? "founder interrupt");
  if (reason.length > 500) {
    return NextResponse.json({ ok: false, error: "reason too long (max 500)" }, { status: 400 });
  }

  const r = requestAbort({ run_id, strategy, reason });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.reason ?? "abort request rejected" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, run_id, strategy, already_aborted: r.already, is_aborted: isAborted(run_id) });
}
