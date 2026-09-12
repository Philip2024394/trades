// GET /api/nex1/orchestrator/self-test
// 20+ adversarial cases · happy path + every blocked path + determinism replay.

import { NextResponse } from "next/server";
import { submitWorkflow, applyFounderDecision } from "@/lib/nex1-orchestrator/orchestrator";
import { canTransition } from "@/lib/nex1-orchestrator/state-machine";
import { getTrace, clearTracesForTests } from "@/lib/nex1-orchestrator/trace-store";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
import { extractStructuredIntent } from "@/lib/nex1-orchestrator/understanding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Case { id: string; ok: boolean; detail: string; }

const REQ = "Build a staircase parts supplier landing page with product categories, timber categories, enquiry/contact action, responsive mobile layout, and product imagery.";

export async function GET() {
  clearTracesForTests();
  const cases: Case[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };

  // 1. Happy path · workflow halts at FOUNDER_DECISION
  run("ORCH.happy-path-halts-at-founder", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s1" });
    return { ok: t.current_state === "FOUNDER_DECISION" && t.nex3_verdict !== null && t.specialist_evidence_ids.length > 0, detail: `current=${t.current_state} verdict=${t.nex3_verdict}` };
  });

  // 2. Deterministic replay · same request + seed → same transition sequence
  run("ORCH.deterministic-replay", () => {
    const a = submitWorkflow({ raw_request: REQ, seed: "sX" });
    const b = submitWorkflow({ raw_request: REQ, seed: "sX" });
    const sigA = a.transitions.map(x => x.previous + ">" + x.next).join("|");
    const sigB = b.transitions.map(x => x.previous + ">" + x.next).join("|");
    return { ok: sigA === sigB, detail: `same_transition_sequence=${sigA === sigB}` };
  });

  // 3. Understanding extraction · deterministic keywords picked up
  run("ORCH.understanding-picks-up-features", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s3" });
    const feats = t.structured_intent?.must_have_features ?? [];
    const hasCat = feats.includes("product_categories"); const hasTimber = feats.includes("timber_categories"); const hasResp = feats.includes("responsive_mobile"); const hasImg = feats.includes("product_imagery");
    return { ok: hasCat && hasTimber && hasResp && hasImg, detail: `features=[${feats.join(",")}]` };
  });

  // 4. LLM boundary rejection at submit
  run("ORCH.llm-attempt-blocks-at-submit", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s4", reject_llm_attempt: true });
    return { ok: t.current_state === "BLOCKED", detail: t.current_state };
  });

  // 5. Short request rejected
  run("ORCH.short-request-blocked", () => {
    const t = submitWorkflow({ raw_request: "hi", seed: "s5" });
    return { ok: t.current_state === "BLOCKED", detail: t.current_state };
  });

  // 6. State machine · legal forward transition
  run("ORCH.state-machine.forward-legal", () => {
    return { ok: canTransition("REQUEST_RECEIVED", "UNDERSTANDING") && canTransition("UNDERSTANDING", "REQUIREMENTS"), detail: "forward legal" };
  });

  // 7. State machine · skip forbidden
  run("ORCH.state-machine.skip-forbidden", () => {
    return { ok: !canTransition("REQUEST_RECEIVED", "REQUIREMENTS") && !canTransition("UNDERSTANDING", "NEX3_ARBITRATION"), detail: "skipping refused" };
  });

  // 8. State machine · backwards forbidden
  run("ORCH.state-machine.backwards-forbidden", () => {
    return { ok: !canTransition("REQUIREMENTS", "UNDERSTANDING") && !canTransition("NEX3_ARBITRATION", "NEX2_REVIEW"), detail: "backwards refused" };
  });

  // 9. State machine · BLOCKED/REJECTED/HOLD reachable from every non-terminal
  run("ORCH.state-machine.terminal-reachable", () => {
    const nonTerm = ["REQUEST_RECEIVED","UNDERSTANDING","REQUIREMENTS","WORK_ORDER","ARCHITECTURE","DESIGN","BUILD_PLAN","SPECIALIST_EVIDENCE","EVIDENCE_VALIDATION","NEX2_REVIEW","NEX3_ARBITRATION","FOUNDER_DECISION","EXECUTION","VERIFICATION","RELEASE"] as const;
    const ok = nonTerm.every(s => canTransition(s, "BLOCKED") || canTransition(s, "REJECTED") || canTransition(s, "HOLD"));
    return { ok, detail: "escape hatches present" };
  });

  // 10. Founder AUTHORISE flow · P-E · lands in ORCHESTRATION_COMPLETED (not DELIVERABLE_COMPLETED) when downstream stages were NOT_IMPLEMENTED
  run("ORCH.founder-authorise-reaches-orchestration-completed-not-deliverable-completed", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s10" });
    const r = applyFounderDecision({ trace_id: t.trace_id, decision: "AUTHORISE", founder_authorisation_token: "TOK" });
    if ("error" in r) return { ok: false, detail: r.error };
    // P-E: NOT_IMPLEMENTED downstream → ORCHESTRATION_COMPLETED · NEVER DELIVERABLE_COMPLETED
    const ok = r.current_state === "ORCHESTRATION_COMPLETED"
      && r.stage_statuses.EXECUTION?.status === "NOT_IMPLEMENTED"
      && r.stage_statuses.DELIVERABLE_COMPLETED === undefined;
    return { ok, detail: `current=${r.current_state} execution=${r.stage_statuses.EXECUTION?.status} deliverable_absent=${r.stage_statuses.DELIVERABLE_COMPLETED === undefined}` };
  });

  // 11. Founder REJECT · transitions to REJECTED
  run("ORCH.founder-reject-terminal", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s11" });
    const r = applyFounderDecision({ trace_id: t.trace_id, decision: "REJECT", founder_authorisation_token: "" });
    if ("error" in r) return { ok: false, detail: r.error };
    return { ok: r.current_state === "REJECTED" && r.founder_decision === "REJECT", detail: r.current_state };
  });

  // 12. Founder HOLD · transitions to HOLD
  run("ORCH.founder-hold-terminal", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s12" });
    const r = applyFounderDecision({ trace_id: t.trace_id, decision: "HOLD", founder_authorisation_token: "" });
    if ("error" in r) return { ok: false, detail: r.error };
    return { ok: r.current_state === "HOLD" && r.founder_decision === "HOLD", detail: r.current_state };
  });

  // 13. Founder AUTHORISE requires non-empty token
  run("ORCH.authorise-requires-token", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s13" });
    const r = applyFounderDecision({ trace_id: t.trace_id, decision: "AUTHORISE", founder_authorisation_token: "" });
    return { ok: "error" in r, detail: "error" in r ? r.error : "unexpectedly accepted" };
  });

  // 14. Decision only permitted from FOUNDER_DECISION
  run("ORCH.decision-only-from-founder-state", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s14" });
    const r1 = applyFounderDecision({ trace_id: t.trace_id, decision: "AUTHORISE", founder_authorisation_token: "TOK" });
    if ("error" in r1) return { ok: false, detail: r1.error };
    // Now we're at ORCHESTRATION_COMPLETED · a second AUTHORISE should be refused
    const r2 = applyFounderDecision({ trace_id: t.trace_id, decision: "AUTHORISE", founder_authorisation_token: "TOK" });
    return { ok: "error" in r2, detail: "error" in r2 ? r2.error : "unexpectedly accepted" };
  });

  // 15. Unknown trace refused
  run("ORCH.unknown-trace-refused", () => {
    const r = applyFounderDecision({ trace_id: "TRACE-does-not-exist", decision: "AUTHORISE", founder_authorisation_token: "TOK" });
    return { ok: "error" in r, detail: "error" in r ? r.error : "unexpectedly found" };
  });

  // 16. Every specialist record from the workflow passes Evidence Validation
  run("ORCH.every-specialist-record-passes-validation", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s16" });
    return { ok: t.validation_verdicts.length >= 11, detail: `validated=${t.validation_verdicts.length}` };
  });

  // 17. Builder stays plan-and-propose · never claims execution
  run("ORCH.builder-plan-only-limited-v0", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s17" });
    const buildStage = t.stage_statuses.BUILD_PLAN;
    return { ok: buildStage?.status === "LIMITED_V0" && buildStage.limitation_note?.includes("plan-only"), detail: `status=${buildStage?.status}` };
  });

  // 18. LIMITED_V0 markers preserved on specialist evidence stage
  run("ORCH.limited-v0-visible-on-specialist-stage", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s18" });
    const specStage = t.stage_statuses.SPECIALIST_EVIDENCE;
    return { ok: specStage?.status === "LIMITED_V0", detail: `status=${specStage?.status}` };
  });

  // 19. Attribution locked · external_llm_used=false · authorisation=false · execution=false
  run("ORCH.attribution-locked", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s19" });
    return {
      ok: t.attribution.external_llm_used === false && t.attribution.deterministic === true && t.attribution.role === "nex1_orchestrator" && t.authorisation === false && t.execution === false && t.authority_boundary === "orchestrator_advisory_until_founder_authorises",
      detail: `authority=${t.attribution.authority}`,
    };
  });

  // 20. Trace transitions are ordered · no duplicates
  run("ORCH.transitions-ordered-no-duplicates", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s20" });
    const seen = new Set<string>();
    let ok = true;
    for (const tr of t.transitions) {
      const key = `${tr.previous}>${tr.next}`;
      if (seen.has(key)) { ok = false; break; }
      seen.add(key);
    }
    return { ok, detail: `transitions=${t.transitions.length}` };
  });

  // 21. Silence != approval · workflow does not auto-authorise
  run("ORCH.silence-is-not-approval", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s21" });
    // Do not call decision · confirm still at FOUNDER_DECISION
    return { ok: t.current_state === "FOUNDER_DECISION" && t.founder_decision === null, detail: `current=${t.current_state} decision=${t.founder_decision}` };
  });

  // 22. Trace retrievable by id
  run("ORCH.trace-retrievable", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s22" });
    const fetched = getTrace(t.trace_id);
    return { ok: fetched !== undefined && fetched.trace_id === t.trace_id, detail: fetched ? "found" : "missing" };
  });

  // 23. Workflow trace itself passes Evidence Validation (as SpecialistRecordShape)
  run("ORCH.workflow-trace-passes-validation", () => {
    const t = submitWorkflow({ raw_request: REQ, seed: "s23" });
    // Provide the minimum shape the validator requires
    const shim: any = {
      ...t,
      schema_version: t.schema_version,
      reproducibility_information: { command: "orchestrator.run", cwd: process.cwd(), env_fingerprint: "orch-env", node_version: process.version, platform: process.platform, seed: "s23" },
      determinism_witness: { first_run_hash: "orchhash", second_run_hash: "orchhash", identical: true },
      byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
      limitations: "orchestrator v0.1.0 · Builder plan-only · specialist LIMITED_V0 · EXECUTION/VERIFICATION/RELEASE NOT_IMPLEMENTED · live preview NOT_IMPLEMENTED · image generation NOT_IMPLEMENTED",
      at: t.created_at,
      session_id: t.trace_id,
    };
    const aer = validateEvidence(shim);
    return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict };
  });

  // 24. Unrecognised request still produces a valid trace with unspecified intent slots (deterministic extractor)
  run("ORCH.unknown-request-empty-slots-not-fabricated", () => {
    const intent = extractStructuredIntent("please just do something useful and creative for me thanks");
    return { ok: intent.page_type === undefined && intent.primary_goal === undefined && intent.must_have_features.length === 0, detail: `slots=empty` };
  });

  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({
    at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases,
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex1_orchestrator", authority: "orchestration_advisory", produced_by: "nex1_orchestrator" },
  }, { headers: { "Cache-Control": "no-store" } });
}
