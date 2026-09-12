import { NextResponse } from "next/server";
import { performDesignAnalysis, designVocabGuard } from "@/lib/nex-ui-ux-design/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("DES.brief-resolved", () => { const r = performDesignAnalysis({ seed: "s", kind: "resolve_brief", brief: { page_type: "marketplace", primary_goal: "conversion" }, reference_library_licences: ["MIT"] }); return { ok: r.outcome === "BRIEF_RESOLVED" && r.semantic_model?.page_type === "marketplace", detail: r.outcome }; });
  run("DES.brief-underdetermined", () => { const r = performDesignAnalysis({ seed: "s", kind: "resolve_brief", brief: { page_type: "", primary_goal: "" }, reference_library_licences: ["MIT"] }); return { ok: r.outcome === "BRIEF_UNDERDETERMINED", detail: r.outcome }; });
  run("DES.tokens-resolved", () => { const r = performDesignAnalysis({ seed: "s", kind: "resolve_tokens", reference_library_licences: ["MIT"] }); return { ok: r.outcome === "TOKENS_RESOLVED", detail: r.outcome }; });
  run("DES.composition-produced", () => { const r = performDesignAnalysis({ seed: "s", kind: "compose_components", reference_library_licences: ["MIT"] }); return { ok: r.outcome === "COMPOSITION_PRODUCED" && r.composition?.authorisation === false && r.composition?.execution === false, detail: r.outcome }; });
  run("DES.visual-qa-pass", () => { const r = performDesignAnalysis({ seed: "s", kind: "visual_qa", qa: { blocking_findings: 0, non_blocking_findings: 2 }, reference_library_licences: ["MIT"] }); return { ok: r.outcome === "VISUAL_QA_MEASURED_PASS", detail: r.outcome }; });
  run("DES.visual-qa-fail", () => { const r = performDesignAnalysis({ seed: "s", kind: "visual_qa", qa: { blocking_findings: 1, non_blocking_findings: 0 }, reference_library_licences: ["MIT"] }); return { ok: r.outcome === "VISUAL_QA_MEASURED_FAIL", detail: r.outcome }; });
  run("DES.reference-licence-uncertain", () => { const r = performDesignAnalysis({ seed: "s", kind: "resolve_brief", brief: { page_type: "x", primary_goal: "y" }, reference_library_licences: ["proprietary"] }); return { ok: r.outcome === "REFERENCE_LICENCE_UNCERTAIN", detail: r.outcome }; });
  run("DES.llm-rejected", () => { const r = performDesignAnalysis({ seed: "s", kind: "resolve_brief", brief: { page_type: "x", primary_goal: "y" }, reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("DES.attribution", () => { const r = performDesignAnalysis({ seed: "s", kind: "resolve_tokens", reference_library_licences: ["MIT"] }); return { ok: r.attribution.produced_by === "nex_ui_ux_design_intelligence_evidence_specialist", detail: r.attribution.authority }; });
  run("DES.no-forbidden-vocab", () => { const r = performDesignAnalysis({ seed: "s", kind: "compose_components", reference_library_licences: ["MIT"] }); const chk = designVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("DES.evidence-validation-passes", () => { const r = performDesignAnalysis({ seed: "s", kind: "resolve_tokens", reference_library_licences: ["MIT"] }); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}
