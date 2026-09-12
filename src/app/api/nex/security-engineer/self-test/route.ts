import { NextResponse } from "next/server";
import { performSecurityAnalysis, securityEngineerVocabGuard } from "@/lib/nex-security-engineer/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fx = (id: string, severity: any = "medium"): any => ({ finding_id: id, category: "injection", severity, rule_id: "R.1", tool: "semgrep", tool_version: "1.0", file: "src/a.ts", line_start: 1, line_end: 1 });

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("SEC.no-finding", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [], scope_complete: true, seed: "s1" }); return { ok: r.outcome === "NO_FINDING_IN_SCOPE", detail: r.outcome }; });
  run("SEC.findings", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [fx("f1")], scope_complete: true, seed: "s2" }); return { ok: r.outcome === "FINDINGS_PRESENT" && r.findings.length === 1, detail: r.outcome }; });
  run("SEC.scope-incomplete", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [], scope_complete: false, seed: "s3" }); return { ok: r.outcome === "SCOPE_INCOMPLETE", detail: r.outcome }; });
  run("SEC.not-measured-no-ruleset", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "", ruleset_version: "1.0", findings: [], scope_complete: true, seed: "s4" }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("SEC.llm-rejected", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [], scope_complete: true, seed: "s5", reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("SEC.attribution", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [], scope_complete: true, seed: "s6" }); return { ok: r.attribution.produced_by === "nex_security_engineer_evidence_specialist", detail: "auth=" + r.attribution.authority }; });
  run("SEC.no-forbidden-vocab", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [fx("f1")], scope_complete: true, seed: "s7" }); const chk = securityEngineerVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("SEC.evidence-validation-passes", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [], scope_complete: true, seed: "s8" }); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  run("SEC.severity-not-elevated", () => { const r = performSecurityAnalysis({ target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [fx("f1", "low")], scope_complete: true, seed: "s9" }); return { ok: r.findings[0].severity === "low", detail: "severity=" + r.findings[0].severity }; });
  run("SEC.deterministic", () => { const p: any = { target_scope: "src/", ruleset_id: "rs1", ruleset_version: "1.0", findings: [fx("f1")], scope_complete: true, seed: "s10" }; const a = performSecurityAnalysis(p); const b = performSecurityAnalysis(p); return { ok: a.determinism_witness.first_run_hash === b.determinism_witness.first_run_hash, detail: a.determinism_witness.first_run_hash }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}
