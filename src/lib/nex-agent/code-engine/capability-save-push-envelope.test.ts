// src/lib/nex-agent/code-engine/capability-save-push-envelope.test.ts
//
// Founder §14/§18: never claim remote save without push evidence.

import { describe, it, expect } from "vitest";
import {
  buildSavePushEnvelope,
  SAVE_PUSH_ENVELOPE_VERSION,
  type SavePushEnvelopeInput,
  type ProviderSnapshot,
} from "./capability-save-push-envelope";
import type { ProjectStateAssessment, ProjectGitState } from "./capability-project-state-detector";

function stubState(state: ProjectGitState): ProjectStateAssessment {
  return {
    state,
    rationale: `stub for ${state}`,
    evidence_signals: [],
    ambiguity_flags: [],
    counts: { modified: 0, untracked: 0, staged: 0, deleted: 0, local_commits_ahead: 0, remote_commits_ahead: 0 },
    refs: { local_head_sha: null, remote_head_sha: null, branch: null, remote_tracking_branch: null },
    caller_should_prompt: false,
    caller_may_close_silently: true,
    input_digest: "stub",
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: "test",
  };
}

function providerCatalog(): ProviderSnapshot[] {
  return [
    { provider_id: "github", display_name: "GitHub", connected: true, authenticated: true, has_default_repository: true },
    { provider_id: "gitlab", display_name: "GitLab", connected: false, authenticated: false, has_default_repository: false },
    { provider_id: "bitbucket", display_name: "Bitbucket", connected: false, authenticated: false, has_default_repository: false },
  ];
}

function make(state: ProjectGitState, over: Partial<SavePushEnvelopeInput> = {}): SavePushEnvelopeInput {
  return {
    project_state: stubState(state),
    providers: providerCatalog(),
    project_display_name: "Test Project",
    ...over,
  };
}

describe("save/push envelope · 7 close-flow states + anti-fabrication", () => {
  describe("close-flow state mapping", () => {
    it("LOCAL_MODIFIED → LOCAL_UNCOMMITTED_CHANGES", () => {
      const e = buildSavePushEnvelope(make("LOCAL_MODIFIED"));
      expect(e.close_flow_state).toBe("LOCAL_UNCOMMITTED_CHANGES");
      expect(e.show_warning).toBe(true);
    });
    it("LOCAL_COMMITTED → LOCAL_COMMITTED_BUT_UNPUSHED", () => {
      const e = buildSavePushEnvelope(make("LOCAL_COMMITTED"));
      expect(e.close_flow_state).toBe("LOCAL_COMMITTED_BUT_UNPUSHED");
      expect(e.show_warning).toBe(true);
    });
    it("PUSH_PENDING → LOCAL_COMMITTED_BUT_UNPUSHED", () => {
      const e = buildSavePushEnvelope(make("PUSH_PENDING"));
      expect(e.close_flow_state).toBe("LOCAL_COMMITTED_BUT_UNPUSHED");
    });
    it("LOCAL_UNTRACKED → UNTRACKED_FILES (without generated files)", () => {
      const e = buildSavePushEnvelope(make("LOCAL_UNTRACKED"));
      expect(e.close_flow_state).toBe("UNTRACKED_FILES");
    });
    it("LOCAL_UNTRACKED + generated → PENDING_GENERATED_FILES", () => {
      const e = buildSavePushEnvelope(make("LOCAL_UNTRACKED", { known_generated_files: ["a.ts", "b.ts"] }));
      expect(e.close_flow_state).toBe("PENDING_GENERATED_FILES");
    });
    it("PUSH_SUCCEEDED → PUSHED_AND_CURRENT", () => {
      const e = buildSavePushEnvelope(make("PUSH_SUCCEEDED"));
      expect(e.close_flow_state).toBe("PUSHED_AND_CURRENT");
      expect(e.show_warning).toBe(false);
    });
    it("REMOTE_CURRENT → PUSHED_AND_CURRENT", () => {
      const e = buildSavePushEnvelope(make("REMOTE_CURRENT"));
      expect(e.close_flow_state).toBe("PUSHED_AND_CURRENT");
    });
    it("REMOTE_CONFLICT → PENDING_PROJECT_CHANGES", () => {
      const e = buildSavePushEnvelope(make("REMOTE_CONFLICT"));
      expect(e.close_flow_state).toBe("PENDING_PROJECT_CHANGES");
    });
    it("PUSH_FAILED → PENDING_PROJECT_CHANGES", () => {
      const e = buildSavePushEnvelope(make("PUSH_FAILED"));
      expect(e.close_flow_state).toBe("PENDING_PROJECT_CHANGES");
    });
    it("LOCAL_CLEAN → NO_CHANGES", () => {
      const e = buildSavePushEnvelope(make("LOCAL_CLEAN"));
      expect(e.close_flow_state).toBe("NO_CHANGES");
      expect(e.show_warning).toBe(false);
    });
  });

  describe("anti-fabrication: remote_save_verified (founder §14/§18)", () => {
    it("remote_save_verified=true ONLY when PUSH_SUCCEEDED", () => {
      const e = buildSavePushEnvelope(make("PUSH_SUCCEEDED"));
      expect(e.remote_save_verified).toBe(true);
    });
    it("remote_save_verified=false for LOCAL_COMMITTED (commit ≠ push)", () => {
      const e = buildSavePushEnvelope(make("LOCAL_COMMITTED"));
      expect(e.remote_save_verified).toBe(false);
      expect(e.remote_save_verified_reason).toContain("no verified remote-push evidence");
    });
    it("remote_save_verified=false for REMOTE_CURRENT (matches remote but no push attempt evidence)", () => {
      const e = buildSavePushEnvelope(make("REMOTE_CURRENT"));
      // REMOTE_CURRENT means local==remote but doesn't prove OUR push succeeded
      expect(e.remote_save_verified).toBe(false);
    });
    it("remote_save_verified=false for PUSH_FAILED", () => {
      const e = buildSavePushEnvelope(make("PUSH_FAILED"));
      expect(e.remote_save_verified).toBe(false);
    });
    it("remote_save_verified=false for PUSH_PENDING", () => {
      const e = buildSavePushEnvelope(make("PUSH_PENDING"));
      expect(e.remote_save_verified).toBe(false);
    });
  });

  describe("provider filtering (founder §12)", () => {
    it("connected_providers excludes non-connected providers", () => {
      const e = buildSavePushEnvelope(make("LOCAL_COMMITTED"));
      expect(e.connected_providers.length).toBe(1);
      expect(e.connected_providers[0].provider_id).toBe("github");
    });
    it("no providers connected → prompt_connect_provider action offered", () => {
      const e = buildSavePushEnvelope(make("LOCAL_COMMITTED", {
        providers: [
          { provider_id: "github", display_name: "GitHub", connected: false, authenticated: false, has_default_repository: false },
        ],
      }));
      expect(e.allowed_actions).toContain("prompt_save_locally_and_close");
      expect(e.allowed_actions).toContain("prompt_connect_provider");
    });
    it("multiple authenticated providers → prompt_choose_provider action", () => {
      const e = buildSavePushEnvelope(make("LOCAL_COMMITTED", {
        providers: [
          { provider_id: "github", display_name: "GitHub", connected: true, authenticated: true, has_default_repository: true },
          { provider_id: "gitlab", display_name: "GitLab", connected: true, authenticated: true, has_default_repository: true },
        ],
      }));
      expect(e.allowed_actions).toContain("prompt_choose_provider");
    });
  });

  describe("plain-language messages (founder §11)", () => {
    it("uses 'unsaved changes' not 'uncommitted' for LOCAL_MODIFIED", () => {
      const e = buildSavePushEnvelope(make("LOCAL_MODIFIED"));
      expect(e.plain_language_message.toLowerCase()).toContain("unsaved changes");
    });
    it("uses 'haven't been pushed' not 'ahead of remote' for LOCAL_COMMITTED", () => {
      const e = buildSavePushEnvelope(make("LOCAL_COMMITTED"));
      expect(e.plain_language_message.toLowerCase()).toContain("haven't been pushed");
    });
    it("NO_CHANGES message reassures user", () => {
      const e = buildSavePushEnvelope(make("LOCAL_CLEAN"));
      expect(e.plain_language_message.toLowerCase()).toContain("up to date");
    });
  });

  describe("close-silent invariant", () => {
    it("close_silently is ONLY offered for NO_CHANGES or PUSHED_AND_CURRENT", () => {
      const withWarning = ["LOCAL_MODIFIED", "LOCAL_COMMITTED", "LOCAL_UNTRACKED", "PUSH_PENDING", "PUSH_FAILED", "REMOTE_CONFLICT"] as const;
      for (const s of withWarning) {
        const e = buildSavePushEnvelope(make(s));
        expect(e.allowed_actions).not.toContain("close_silently");
      }
      const safe = ["LOCAL_CLEAN", "PUSH_SUCCEEDED", "REMOTE_CURRENT"] as const;
      for (const s of safe) {
        const e = buildSavePushEnvelope(make(s));
        expect(e.allowed_actions).toContain("close_silently");
      }
    });
  });

  describe("determinism + invariants", () => {
    it("produces identical envelope for identical input", () => {
      const inp = make("LOCAL_MODIFIED");
      const a = buildSavePushEnvelope(inp);
      const b = buildSavePushEnvelope(inp);
      expect(a.close_flow_state).toBe(b.close_flow_state);
      expect(a.input_digest).toBe(b.input_digest);
      expect(a.allowed_actions).toEqual(b.allowed_actions);
    });
    it("declares zero_llm=true and ledger=B", () => {
      const e = buildSavePushEnvelope(make("LOCAL_CLEAN"));
      expect(e.zero_llm).toBe(true);
      expect(e.ledger).toBe("B");
    });
    it("stamps canonical version", () => {
      expect(SAVE_PUSH_ENVELOPE_VERSION).toBe("save-push-envelope.v1.2026-09-19");
    });
  });
});
