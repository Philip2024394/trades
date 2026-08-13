// GET/PATCH /api/nex/automation/runs — Automation run inspection + approval
//
// GET   list runs · params: limit, status, rule_id, since_hours
//
// PATCH admin decision on an L1/L2 pending run. Body:
//         { run_id, decision: "approve" | "reject", admin, reason? }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listRuns, type RunStatus } from "@/lib/nex/automation/fs-store";
import { approveRun, rejectRun } from "@/lib/nex/automation/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: RunStatus[] = [
  "auto_executed", "suggested", "prepared", "approved", "rejected", "failed", "skipped",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "100") || 100), 1000);
  const hours = Math.min(Math.max(1, Number(searchParams.get("since_hours") ?? "720") || 720), 8760);
  const statusRaw = searchParams.get("status") as RunStatus | null;
  const status = statusRaw && VALID_STATUS.includes(statusRaw) ? statusRaw : undefined;
  const rule_id = searchParams.get("rule_id") ?? undefined;

  try {
    const runs = await listRuns({ limit, status, rule_id, since_ms: hours * 60 * 60 * 1000 });
    return NextResponse.json({ ok: true, backend: "filesystem", runs, count: runs.length });
  } catch (err) {
    console.error("[automation.runs.GET] failed:", err);
    return NextResponse.json({ ok: false, error: "list_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const run_id = typeof body.run_id === "string" ? body.run_id : "";
  const decision = body.decision as "approve" | "reject" | undefined;
  const admin = typeof body.admin === "string" ? body.admin : "admin";
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  if (!run_id) return NextResponse.json({ ok: false, error: "run_id_required" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ ok: false, error: "decision_required", detail: "approve | reject" }, { status: 400 });
  }

  try {
    const updated = decision === "approve"
      ? await approveRun(run_id, admin)
      : await rejectRun(run_id, admin, reason);
    if (!updated) return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, backend: "filesystem", run: updated });
  } catch (err) {
    console.error("[automation.runs.PATCH] failed:", err);
    return NextResponse.json({ ok: false, error: "decision_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
