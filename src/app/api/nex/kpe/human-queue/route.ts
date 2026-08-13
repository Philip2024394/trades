// GET/PATCH /api/nex/kpe/human-queue
//
// GET   → list pending human_review decisions + queue stats
// PATCH → admin decision. Body: { chunk_id, decision: "approve"|"reject", admin, reason? }
//
// Closes the loop between the Decision Engine's human_review tier and the
// Brain. Approved chunks land in the correct brain with source_kind=
// "kpe:human_approved" (provenance shows a human made the call, not AI).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listPending, approve, reject, queueStats } from "@/lib/nex/kpe/human-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [pending, stats] = await Promise.all([listPending(), queueStats()]);
    return NextResponse.json({ ok: true, backend: "filesystem", pending, count: pending.length, stats });
  } catch (err) {
    console.error("[kpe.human-queue.GET] failed:", err);
    return NextResponse.json({ ok: false, error: "read_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const chunk_id = typeof body.chunk_id === "string" ? body.chunk_id : "";
  const decision = body.decision as "approve" | "reject" | undefined;
  const admin = typeof body.admin === "string" ? body.admin : "admin";
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  if (!chunk_id) return NextResponse.json({ ok: false, error: "chunk_id_required" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ ok: false, error: "decision_required", detail: "approve | reject" }, { status: 400 });
  }

  try {
    const result = decision === "approve"
      ? await approve(chunk_id, admin, reason)
      : await reject(chunk_id, admin, reason);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true, backend: "filesystem", decision, ...result });
  } catch (err) {
    console.error("[kpe.human-queue.PATCH] failed:", err);
    return NextResponse.json({ ok: false, error: "decision_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
