import { NextResponse } from "next/server";
import { performBuilderPlan, builderVocabGuard } from "@/lib/nex1-builder/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const okWO = () => ({
  work_order_id: "WO-1",
  founder_authorisation: "AUTHORISE-XYZ",
  user_objective: "test",
  acceptance_criteria: [{ requirement_id: "R1", criterion_text: "x" }],
  build_boundaries: ["src/apps/test"],
  build_exclusions: [],
  scope_notes: "test scope",
  rollback_reference: "rollback-ref-1",
  authorised_specialists: ["nex_test_engineer"],
  expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("BUILD.plan-produced", () => { const r = performBuilderPlan({ seed: "s", work_order: okWO() as any, proposed_files: ["src/apps/test/a.ts"] }); return { ok: r.outcome === "PLAN_PRODUCED" && r.candidate_diff_ref !== null, detail: r.outcome }; });
  run("BUILD.missing-authorisation", () => { const wo = okWO() as any; wo.founder_authorisation = ""; const r = performBuilderPlan({ seed: "s", work_order: wo, proposed_files: ["src/apps/test/a.ts"] }); return { ok: r.outcome === "MISSING_AUTHORISATION", detail: r.outcome }; });
  run("BUILD.missing-rollback", () => { const wo = okWO() as any; wo.rollback_reference = ""; const r = performBuilderPlan({ seed: "s", work_order: wo, proposed_files: ["src/apps/test/a.ts"] }); return { ok: r.outcome === "MISSING_ROLLBACK", detail: r.outcome }; });
  run("BUILD.expired", () => { const wo = okWO() as any; wo.expiry = new Date(Date.now() - 60000).toISOString(); const r = performBuilderPlan({ seed: "s", work_order: wo, proposed_files: ["src/apps/test/a.ts"] }); return { ok: r.outcome === "EXPIRED", detail: r.outcome }; });
  run("BUILD.out-of-scope-boundary", () => { const r = performBuilderPlan({ seed: "s", work_order: okWO() as any, proposed_files: ["src/lib/nex-evidence-engine/types.ts"] }); return { ok: r.outcome === "OUT_OF_SCOPE", detail: r.outcome }; });
  run("BUILD.mandatory-exclusion-engineering-brain", () => { const wo = okWO() as any; wo.build_boundaries = ["src/lib"]; const r = performBuilderPlan({ seed: "s", work_order: wo, proposed_files: ["src/lib/nex-evidence-engine/types.ts"] }); return { ok: r.outcome === "OUT_OF_SCOPE", detail: r.outcome }; });
  run("BUILD.insufficient-context", () => { const r = performBuilderPlan({ seed: "s", work_order: okWO() as any, proposed_files: [] }); return { ok: r.outcome === "INSUFFICIENT_CONTEXT", detail: r.outcome }; });
  run("BUILD.llm-rejected", () => { const r = performBuilderPlan({ seed: "s", work_order: okWO() as any, proposed_files: ["src/apps/test/a.ts"], reject_llm_attempt: true }); return { ok: r.outcome === "INSUFFICIENT_CONTEXT", detail: r.outcome }; });
  run("BUILD.attribution", () => { const r = performBuilderPlan({ seed: "s", work_order: okWO() as any, proposed_files: ["src/apps/test/a.ts"] }); return { ok: r.attribution.produced_by === "nex1_builder" && r.authorisation === false && r.execution === false, detail: "auth=" + r.attribution.authority }; });
  run("BUILD.no-forbidden-vocab", () => { const r = performBuilderPlan({ seed: "s", work_order: okWO() as any, proposed_files: ["src/apps/test/a.ts"] }); const chk = builderVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("BUILD.evidence-validation-passes", () => { const r = performBuilderPlan({ seed: "s", work_order: okWO() as any, proposed_files: ["src/apps/test/a.ts"] }); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}
