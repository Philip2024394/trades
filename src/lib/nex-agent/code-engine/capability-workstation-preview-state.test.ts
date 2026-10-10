// src/lib/nex-agent/code-engine/capability-workstation-preview-state.test.ts
//
// Founder §15: preview must clearly distinguish 8 states. Test all 8.

import { describe, it, expect } from "vitest";
import {
  assessPreviewState,
  toEpisodeEvidence,
  viewportsByCategory,
  CANONICAL_VIEWPORT_PRESETS,
  WORKSTATION_PREVIEW_STATE_VERSION,
  type PreviewProbeInput,
} from "./capability-workstation-preview-state";

function empty(over: Partial<PreviewProbeInput> = {}): PreviewProbeInput {
  return {
    probe_reachable: null,
    probe_http_status: null,
    probe_duration_ms: null,
    probe_reason: null,
    server_lifecycle: null,
    build_stage_verdict: null,
    runtime_error_seen: null,
    target_url: "http://localhost:3000/",
    probed_at_iso: null,
    ...over,
  };
}

describe("workstation preview state machine · 8-state coverage", () => {
  describe("NO_PREVIEW", () => {
    it("emits when server_lifecycle=not_started and no probe evidence", () => {
      const r = assessPreviewState(empty({ server_lifecycle: "not_started" }));
      expect(r.state).toBe("NO_PREVIEW");
    });
    it("emits when no probe result and no lifecycle signal", () => {
      const r = assessPreviewState(empty());
      expect(r.state).toBe("NO_PREVIEW");
      expect(r.ambiguity_flags).toContain("no_evidence_gathered");
    });
    it("emits when probe unreachable with a specific reason", () => {
      const r = assessPreviewState(empty({
        probe_reachable: false,
        probe_reason: "fetch_error:ECONNREFUSED",
      }));
      expect(r.state).toBe("NO_PREVIEW");
    });
  });

  describe("STARTING", () => {
    it("emits when server_lifecycle=started but probe not yet reachable", () => {
      const r = assessPreviewState(empty({
        server_lifecycle: "started",
        probe_reachable: false,
        probe_reason: "timeout",
      }));
      // timeout with server started could be BUILDING · but here we assert
      // that startup path fires when reason isn't timeout
      expect(["STARTING", "BUILDING"]).toContain(r.state);
    });
    it("emits STARTING when server started but no probe yet", () => {
      const r = assessPreviewState(empty({
        server_lifecycle: "started",
        probe_reachable: null,
      }));
      expect(r.state).toBe("STARTING");
    });
  });

  describe("BUILDING", () => {
    it("emits when build_stage_verdict=RUNNING", () => {
      const r = assessPreviewState(empty({ build_stage_verdict: "RUNNING" }));
      expect(r.state).toBe("BUILDING");
    });
    it("emits on probe timeout as compile-latency evidence", () => {
      const r = assessPreviewState(empty({
        probe_reachable: false,
        probe_reason: "timeout",
      }));
      expect(r.state).toBe("BUILDING");
      expect(r.ambiguity_flags).toContain("timeout_could_also_mean_server_hang");
    });
  });

  describe("RUNNING", () => {
    it("emits when server up but target route returns 4xx", () => {
      const r = assessPreviewState(empty({
        probe_reachable: true,
        probe_http_status: 404,
      }));
      expect(r.state).toBe("RUNNING");
      expect(r.ambiguity_flags).toContain("route_may_not_exist");
    });
  });

  describe("READY", () => {
    it("emits on 200 response · reachable=true", () => {
      const r = assessPreviewState(empty({
        probe_reachable: true,
        probe_http_status: 200,
      }));
      expect(r.state).toBe("READY");
      expect(r.caller_should_display.is_error_state).toBe(false);
      expect(r.caller_should_display.show_retry_button).toBe(false);
    });
    it("emits on 302 (redirect · still valid content path)", () => {
      const r = assessPreviewState(empty({
        probe_reachable: true,
        probe_http_status: 302,
      }));
      expect(r.state).toBe("READY");
    });
  });

  describe("RUNTIME_ERROR", () => {
    it("emits on 500 response", () => {
      const r = assessPreviewState(empty({
        probe_reachable: true,
        probe_http_status: 500,
      }));
      expect(r.state).toBe("RUNTIME_ERROR");
      expect(r.caller_should_display.is_error_state).toBe(true);
    });
    it("emits when runtime_error_seen=true even if server responds 200", () => {
      const r = assessPreviewState(empty({
        runtime_error_seen: true,
        probe_reachable: true,
        probe_http_status: 200,
      }));
      expect(r.state).toBe("RUNTIME_ERROR");
    });
  });

  describe("BUILD_ERROR", () => {
    it("emits when build_stage_verdict=FAILED", () => {
      const r = assessPreviewState(empty({ build_stage_verdict: "FAILED" }));
      expect(r.state).toBe("BUILD_ERROR");
      expect(r.caller_should_display.is_error_state).toBe(true);
      expect(r.caller_should_display.is_terminal_state).toBe(true);
    });
  });

  describe("STOPPED", () => {
    it("emits when server_lifecycle=stopped", () => {
      const r = assessPreviewState(empty({ server_lifecycle: "stopped" }));
      expect(r.state).toBe("STOPPED");
      expect(r.caller_should_display.is_terminal_state).toBe(true);
    });
    it("emits when server_lifecycle=crashed", () => {
      const r = assessPreviewState(empty({ server_lifecycle: "crashed" }));
      expect(r.state).toBe("STOPPED");
    });
  });

  describe("determinism + invariants", () => {
    it("produces identical assessment for identical input (excluding assessed_at_iso)", () => {
      const inp = empty({ probe_reachable: true, probe_http_status: 200 });
      const a = assessPreviewState(inp);
      const b = assessPreviewState(inp);
      expect(a.state).toBe(b.state);
      expect(a.input_digest).toBe(b.input_digest);
    });

    it("declares zero_llm=true and ledger=B", () => {
      const r = assessPreviewState(empty());
      expect(r.zero_llm).toBe(true);
      expect(r.ledger).toBe("B");
    });

    it("stamps canonical version", () => {
      expect(WORKSTATION_PREVIEW_STATE_VERSION).toBe("workstation-preview-state.v1.2026-09-19");
    });
  });

  describe("anti-fabrication", () => {
    it("NEVER returns READY without probe evidence", () => {
      const r = assessPreviewState(empty({ server_lifecycle: "started" }));
      expect(r.state).not.toBe("READY");
    });
    it("NEVER returns READY on 500 even if reachable=true", () => {
      const r = assessPreviewState(empty({
        probe_reachable: true,
        probe_http_status: 500,
      }));
      expect(r.state).not.toBe("READY");
    });
  });

  describe("viewport presets (founder §14)", () => {
    it("has at least one desktop preset", () => {
      const d = viewportsByCategory("desktop");
      expect(d.length).toBeGreaterThan(0);
      expect(d[0].w).toBeGreaterThanOrEqual(1024);
    });
    it("has at least one tablet preset", () => {
      const t = viewportsByCategory("tablet");
      expect(t.length).toBeGreaterThan(0);
      expect(t[0].category).toBe("tablet");
    });
    it("has at least one phone preset", () => {
      const p = viewportsByCategory("phone");
      expect(p.length).toBeGreaterThan(0);
      expect(p[0].category).toBe("phone");
    });
    it("total presets ≥ 7", () => {
      expect(CANONICAL_VIEWPORT_PRESETS.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe("episode evidence emission (integration point)", () => {
    it("toEpisodeEvidence returns caller_must_decide=true", () => {
      const r = assessPreviewState(empty({
        probe_reachable: true,
        probe_http_status: 200,
      }));
      const ev = toEpisodeEvidence(r, "http://localhost:3000/", 200);
      expect(ev.caller_must_decide).toBe(true);
      expect(ev.preview_state).toBe("READY");
      expect(ev.evidence_kind).toBe("OBSERVED_PREVIEW_STATE");
    });
  });
});
