// POST /api/nex/shadow/promote
// body: { record_id: string, founder_intent: string }
//
// Founder-authored promotion of a SHADOW_FAILURE into a candidate regression
// fixture. Writes to a founder-review queue · NEVER auto-applies (SH-4).
// The actual regression pool is only updated by a subsequent founder ADR.

import { NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { readRecent } from "@/lib/nex-shadow/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const record_id = typeof body?.record_id === "string" ? body.record_id : "";
  const founder_intent = typeof body?.founder_intent === "string" ? body.founder_intent : "";
  if (!record_id || !founder_intent) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  // Look up the record from recent history (up to 500)
  const records = readRecent(500);
  const rec = records.find((r) => r.record_id === record_id);
  if (!rec) return NextResponse.json({ error: "record_not_found" }, { status: 404 });
  if (rec.examiner.evaluation !== "SHADOW_FAILURE") {
    return NextResponse.json({ error: "only_SHADOW_FAILURE_may_be_promoted", observed: rec.examiner.evaluation }, { status: 400 });
  }

  const queueDir = resolve(process.cwd(), "data/nex1-shadow/founder-promotion-queue");
  if (!existsSync(queueDir)) mkdirSync(queueDir, { recursive: true });
  const line = JSON.stringify({
    at: new Date().toISOString(),
    record_id,
    founder_intent,
    utterance_preserved: rec.utterance_preserved,
    observed_final: rec.pipeline_decision.final_disposition,
    observed_refuses_at: rec.pipeline_decision.refuses_at_layer,
    matched_expectation_id: rec.examiner.matched_expectation_id,
    failure_layer: rec.examiner.failure_layer,
    failure_rule: rec.examiner.failure_rule,
    variance_reason: rec.examiner.variance_reason,
    note: "candidate-only · SH-4 · NOT applied to any regression fixture until founder-authored ADR",
    taught_by: "master_ai_engineer",
  }) + "\n";
  const p = resolve(queueDir, `queue-${new Date().toISOString().slice(0, 10)}.jsonl`);
  try { appendFileSync(p, line, "utf8"); }
  catch (e) { return NextResponse.json({ error: "queue_write_failed", detail: (e as Error).message }, { status: 500 }); }

  return NextResponse.json({
    ok: true,
    queued_to: `data/nex1-shadow/founder-promotion-queue/queue-${new Date().toISOString().slice(0, 10)}.jsonl`,
    record_id,
    disclaimer: "SH-4 · this is a founder-review candidate only · no classifier · no regression pool · no policy has been modified. Applying it requires a founder-authored ADR.",
  }, { headers: { "Cache-Control": "no-store" } });
}
