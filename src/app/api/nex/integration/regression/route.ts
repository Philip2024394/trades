// GET /api/nex/integration/regression
// Runs the Integration Gate regression pool end-to-end and returns the report.
// Deterministic. Fails-closed on any drift.

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPipeline } from "@/lib/nex-integration/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Case {
  id: string;
  utterance: string;
  expected_final: string;
  expected_refuses_at: string | null;
  adversarial?: boolean;
  note?: string;
}

export async function GET(): Promise<NextResponse> {
  const p = resolve(process.cwd(), "data/nex1-integration/regression-cases.json");
  const doc = JSON.parse(readFileSync(p, "utf8"));
  const cases: Case[] = doc.cases;
  const per_case: any[] = [];
  let pass = 0, fail = 0;
  const adversarial_pass: string[] = [];
  const adversarial_fail: string[] = [];
  for (const c of cases) {
    // Each case runs in an isolated session so multi-turn state doesn't leak
    const decision = runPipeline({ utterance: c.utterance, session_id: `regression-${c.id}` });
    const finalOk = decision.final_disposition === c.expected_final;
    const layerOk = (decision.refuses_at_layer ?? null) === (c.expected_refuses_at ?? null);
    const ok = finalOk && layerOk;
    if (ok) {
      pass++;
      if (c.adversarial) adversarial_pass.push(c.id);
    } else {
      fail++;
      if (c.adversarial) adversarial_fail.push(c.id);
    }
    per_case.push({
      id: c.id,
      utterance: c.utterance,
      adversarial: c.adversarial === true,
      expected_final: c.expected_final,
      actual_final: decision.final_disposition,
      expected_refuses_at: c.expected_refuses_at,
      actual_refuses_at: decision.refuses_at_layer,
      ok,
      note: c.note,
    });
  }
  return NextResponse.json({
    version: doc.version,
    total_cases: cases.length,
    pass, fail,
    adversarial_total: cases.filter((c) => c.adversarial).length,
    adversarial_pass_count: adversarial_pass.length,
    adversarial_fail_count: adversarial_fail.length,
    adversarial_pass, adversarial_fail,
    per_case,
    taught_by: "master_ai_engineer",
    at: new Date().toISOString(),
    attribution: { external_llm_used: false, independent_authorship_percent: 0 },
    test_only: true,
  }, { headers: { "Cache-Control": "no-store" } });
}
