import { NextResponse } from "next/server";
import { performReleaseAnalysis, releaseVocabGuard } from "@/lib/nex-release-engineer/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allGates = (result: "PASS" | "FAIL" | "INCONCLUSIVE" | "SKIPPED" = "PASS"): any[] => (["build","test","migration","dependencies","security","configuration","deployment","rollback"] as const).map(g => ({ gate: g, result, detail: "ok" }));

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("REL.all-passed", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: allGates("PASS") }); return { ok: r.outcome === "ALL_GATES_PASSED", detail: r.outcome }; });
  run("REL.gate-failed", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: [...allGates("PASS").slice(0, 7), { gate: "rollback", result: "FAIL", detail: "no snapshot" }] }); return { ok: r.outcome === "GATE_FAILED", detail: r.outcome }; });
  run("REL.inconclusive", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: [...allGates("PASS").slice(0, 7), { gate: "rollback", result: "INCONCLUSIVE", detail: "unclear" }] }); return { ok: r.outcome === "GATE_INCONCLUSIVE", detail: r.outcome }; });
  run("REL.bypass-missing-gate", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: allGates("PASS").slice(0, 7) }); return { ok: r.outcome === "GATE_BYPASS_ATTEMPTED", detail: r.outcome }; });
  run("REL.bypass-skipped-gate", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: [...allGates("PASS").slice(0, 7), { gate: "rollback", result: "SKIPPED", detail: "-" }] }); return { ok: r.outcome === "GATE_BYPASS_ATTEMPTED", detail: r.outcome }; });
  run("REL.llm-rejected", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: allGates("PASS"), reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("REL.no-founder-auth-still-produces-evidence", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: allGates("PASS") }); return { ok: r.founder_authorisation_present === false && r.outcome === "ALL_GATES_PASSED", detail: "evidence produced but founder auth still required for publish" }; });
  run("REL.attribution", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: allGates("PASS") }); return { ok: r.attribution.produced_by === "nex_release_engineer_evidence_specialist", detail: r.attribution.authority }; });
  run("REL.no-forbidden-vocab", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: allGates("PASS") }); const chk = releaseVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("REL.evidence-validation-passes", () => { const r = performReleaseAnalysis({ seed: "s", candidate_build_ref: "b1", gates: allGates("PASS") }); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}
