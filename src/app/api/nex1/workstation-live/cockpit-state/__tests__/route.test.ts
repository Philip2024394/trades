// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit · api route
// NEX bounded infrastructure · cockpit-state route tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { GET } from "../route";
import { saveTrace, clearTracesForTests } from "@/lib/nex1-orchestrator/trace-store";
import type { WorkflowTrace } from "@/lib/nex1-orchestrator/types";

function fakeTrace(trace_id: string, current_state: WorkflowTrace["current_state"]): WorkflowTrace {
  return {
    record_type: "NEX1_WORKFLOW_TRACE",
    trace_id,
    schema_version: "wo1-v1",
    raw_request: "test",
    structured_intent: null,
    requirements_evidence: null,
    work_order: null,
    architecture_evidence: null,
    design_evidence: null,
    builder_plan: null,
    specialist_evidence_ids: [],
    validation_verdicts: [],
    nex2_review_id: null,
    nex3_arbitration_id: null,
    nex3_verdict: null,
    founder_decision: null,
    transitions: [],
    current_state,
    stage_statuses: {},
    audit_trail: [],
    created_at: new Date().toISOString(),
    authorisation: false,
    execution: false,
    authority_boundary: "orchestrator_advisory_until_founder_authorises",
    attribution: {
      external_llm_used: false,
      deterministic: true,
      taught_by: "master_ai_engineer",
      role: "nex1_orchestrator",
    } as WorkflowTrace["attribution"],
  } as WorkflowTrace;
}

function makeGetRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("§36-W-2 · W2 · cockpit-state API route", () => {
  it("R-1 · no trace_id · returns ok with orchestrator_trace not_connected", async () => {
    clearTracesForTests();
    const res = await GET(makeGetRequest("http://localhost:3000/api/nex1/workstation-live/cockpit-state") as never);
    const body = (await res.json()) as {
      ok: boolean;
      view: {
        engineering_activity: string;
        not_connected_surfaces: readonly { surface: string }[];
      };
      source_probe: { trace_id: string | null; trace_present: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.source_probe.trace_present).toBe(false);
    expect(body.view.not_connected_surfaces.map((n) => n.surface)).toContain("orchestrator_trace");
  });

  it("R-2 · unknown trace_id · returns ok with orchestrator_trace not_connected", async () => {
    clearTracesForTests();
    const res = await GET(makeGetRequest("http://localhost:3000/api/nex1/workstation-live/cockpit-state?trace_id=nope") as never);
    const body = (await res.json()) as { source_probe: { trace_present: boolean } };
    expect(body.source_probe.trace_present).toBe(false);
  });

  it("R-3 · known trace_id · returns engineering activity mapped from current_state", async () => {
    clearTracesForTests();
    saveTrace(fakeTrace("t-42", "EXECUTION"));
    const res = await GET(makeGetRequest("http://localhost:3000/api/nex1/workstation-live/cockpit-state?trace_id=t-42&preview_target=/nex-mission-priority-viewer&preview_nonce=1") as never);
    const body = (await res.json()) as {
      ok: boolean;
      view: {
        engineering_activity: string;
        preview_causal_link: { preview_target_url: string; preview_nonce: number };
        grep_marker: string;
      };
      source_probe: { trace_present: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.source_probe.trace_present).toBe(true);
    expect(body.view.engineering_activity).toBe("BUILDING");
    expect(body.view.preview_causal_link.preview_target_url).toBe("/nex-mission-priority-viewer");
    expect(body.view.preview_causal_link.preview_nonce).toBe(1);
    expect(body.view.grep_marker).toBe("§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit");
  });

  it("R-4 · malformed preview_nonce → falls back to 0 (not a 400)", async () => {
    clearTracesForTests();
    const res = await GET(makeGetRequest("http://localhost:3000/api/nex1/workstation-live/cockpit-state?preview_nonce=NaN") as never);
    const body = (await res.json()) as { view: { preview_causal_link: { preview_nonce: number } } };
    expect(body.view.preview_causal_link.preview_nonce).toBe(0);
  });
});
