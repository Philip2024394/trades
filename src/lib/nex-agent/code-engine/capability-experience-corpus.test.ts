// src/lib/nex-agent/code-engine/capability-experience-corpus.test.ts
//
// Phase 9-11 tests · unified episode receipt · write barriers · Wilson · retrieval

import { describe, it, expect } from "vitest";
import {
  appendEpisode,
  queryTopOperators,
  wilsonLowerBound95,
  computeCorpusHash,
  EXPERIENCE_CORPUS_VERSION,
  type EpisodeReceipt,
} from "./capability-experience-corpus";
import path from "node:path";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

function makeEpisode(over: Partial<EpisodeReceipt> = {}): EpisodeReceipt {
  const base: EpisodeReceipt = {
    schema_version: EXPERIENCE_CORPUS_VERSION,
    episode_id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    correlation_id: `cor_${Math.random().toString(36).slice(2, 8)}`,
    recorded_at_iso: new Date().toISOString(),
    nex_version: { gate1_state: "FROZEN" },
    task_context: {
      task_kind: "code_edit",
      domain_tag: "coding",
      input_hash: "sha256:abc",
      input_shape_fingerprint: {
        verb_class: "modify",
        target_class: "function",
        activity_class: "maintenance",
        size_bucket: "S",
        language_class: "typescript",
      },
    },
    believed: {
      hypothesis_prediction: "returns 30 given 3",
      caller_must_decide: true,
    },
    observed: {
      verifier_verdict: "TARGET_BEHAVIOUR_VERIFIED",
      agreement_status: "AGREE",
    },
    what_actually_happened: {
      final_outcome: "verified_success",
      repair_iterations: 0,
      reproducibility_check: {
        byte_identical_across_reruns: true,
        reruns_observed: 2,
      },
    },
    what_was_verified: {
      target_pass: true,
      regression_pass: true,
      gate1_frozen_confirmed: true,
    },
    what_failed: { failure_class: null },
    what_was_learned: {
      operator_kind: "replace_return_literal",
      extracted_relationship_type: "OBSERVED",
    },
    epistemic_status: "VERIFIED",
    ledger_classification: "Ledger B structural · Ledger A candidate values",
  };
  return { ...base, ...over };
}

describe("experience corpus · Phase 9-11", () => {
  describe("write barriers", () => {
    it("writes verified episode to episodes.jsonl", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        const r = appendEpisode(makeEpisode(), { data_root: root });
        expect(r.written).toBe(true);
        expect(r.path).toBe("episodes.jsonl");
        expect(r.write_barrier_failures).toEqual([]);
        expect(existsSync(path.join(root, "episodes.jsonl"))).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("discards episode with final_outcome=unresolved", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        const r = appendEpisode(
          makeEpisode({
            what_actually_happened: {
              final_outcome: "unresolved",
              repair_iterations: 0,
              reproducibility_check: { byte_identical_across_reruns: null, reruns_observed: 0 },
            },
          }),
          { data_root: root },
        );
        expect(r.written).toBe(false);
        expect(r.path).toBe("discarded.jsonl");
        expect(r.write_barrier_failures).toContain("has_verified_outcome");
        expect(existsSync(path.join(root, "discarded.jsonl"))).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("discards episode with empty episode_id (missing provenance)", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        const r = appendEpisode(
          makeEpisode({ episode_id: "" }),
          { data_root: root },
        );
        expect(r.written).toBe(false);
        expect(r.write_barrier_failures).toContain("has_provenance");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("discards episode containing forbidden task→answer mapping pattern", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        // Inject a forbidden pattern in a field (would fabricate a task-specific lookup)
        const bad = makeEpisode({
          believed: {
            hypothesis_prediction: `if task_id === 'bool-02' return true`,
            caller_must_decide: true,
          },
        });
        const r = appendEpisode(bad, { data_root: root });
        expect(r.written).toBe(false);
        expect(r.write_barrier_failures).toContain("no_forbidden_pattern");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("Wilson lower bound", () => {
    it("returns 0 for 0/0", () => {
      expect(wilsonLowerBound95(0, 0)).toBe(0);
    });
    it("1/1 is NOT 1.0 (prevents manufacturing artefact)", () => {
      // Raw rate would be 1.0 but Wilson lower bound is much lower
      const wilson = wilsonLowerBound95(1, 1);
      expect(wilson).toBeLessThan(0.5);
    });
    it("10/10 gives high but not perfect confidence", () => {
      const wilson = wilsonLowerBound95(10, 10);
      expect(wilson).toBeGreaterThan(0.6);
      expect(wilson).toBeLessThan(1.0);
    });
    it("100/100 approaches but never reaches 1.0", () => {
      const wilson = wilsonLowerBound95(100, 100);
      expect(wilson).toBeGreaterThan(0.9);
      expect(wilson).toBeLessThan(1.0);
    });
    it("50/100 (raw 0.5) gives Wilson ~0.4", () => {
      const wilson = wilsonLowerBound95(50, 100);
      expect(wilson).toBeGreaterThan(0.35);
      expect(wilson).toBeLessThan(0.45);
    });
    it("monotonic in successes for fixed n", () => {
      expect(wilsonLowerBound95(5, 10)).toBeLessThan(wilsonLowerBound95(9, 10));
    });
  });

  describe("retrieval", () => {
    it("returns empty when corpus empty", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        const r = queryTopOperators("nonexistent", { data_root: root });
        expect(r.ranked_operators).toEqual([]);
        expect(r.caller_must_decide).toBe(true);
        expect(r.total_episodes_consulted).toBe(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("ranks operators by Wilson lower bound (never raw rate)", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        // Operator A: 1/1 success = raw 100% but Wilson low
        appendEpisode(makeEpisode({
          episode_id: "epA",
          what_was_learned: { operator_kind: "opA", extracted_relationship_type: "OBSERVED" },
          what_actually_happened: {
            final_outcome: "verified_success", repair_iterations: 0,
            reproducibility_check: { byte_identical_across_reruns: true, reruns_observed: 2 },
          },
        }), { data_root: root });

        // Operator B: 8/10 success = raw 80% but Wilson higher because more support
        for (let i = 0; i < 10; i++) {
          appendEpisode(makeEpisode({
            episode_id: `epB${i}`,
            what_was_learned: { operator_kind: "opB", extracted_relationship_type: "OBSERVED" },
            what_actually_happened: {
              final_outcome: i < 8 ? "verified_success" : "verified_failure",
              repair_iterations: 0,
              reproducibility_check: { byte_identical_across_reruns: true, reruns_observed: 2 },
            },
          }), { data_root: root });
        }

        const r = queryTopOperators("code_edit", { data_root: root });
        expect(r.ranked_operators.length).toBe(2);
        // opB (8/10) should outrank opA (1/1) despite lower raw rate
        expect(r.ranked_operators[0].operator_kind).toBe("opB");
        expect(r.ranked_operators[0].wilson_lower_95).toBeGreaterThan(r.ranked_operators[1].wilson_lower_95);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("every retrieval carries caller_must_decide=true", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        const r = queryTopOperators("anything", { data_root: root });
        expect(r.caller_must_decide).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("returns epistemic_status=OBSERVED when < 3 episodes match", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        appendEpisode(makeEpisode(), { data_root: root });
        const r = queryTopOperators("code_edit", { data_root: root });
        expect(r.epistemic_status).toBe("OBSERVED");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("returns provenance_episode_ids for each operator row", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        appendEpisode(makeEpisode({ episode_id: "ep_alpha" }), { data_root: root });
        appendEpisode(makeEpisode({ episode_id: "ep_beta" }), { data_root: root });
        const r = queryTopOperators("code_edit", { data_root: root });
        expect(r.ranked_operators[0].provenance_episode_ids).toContain("ep_alpha");
        expect(r.ranked_operators[0].provenance_episode_ids).toContain("ep_beta");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("append-only durability", () => {
    it("hash changes deterministically with each append", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        const before = computeCorpusHash({ data_root: root });
        expect(before.episode_count).toBe(0);
        appendEpisode(makeEpisode({ episode_id: "ep_A" }), { data_root: root });
        const after = computeCorpusHash({ data_root: root });
        expect(after.episode_count).toBe(1);
        expect(after.episodes_hash).not.toBe(before.episodes_hash);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("preserves prior episodes across appends (append-only invariant)", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        appendEpisode(makeEpisode({ episode_id: "ep_first" }), { data_root: root });
        appendEpisode(makeEpisode({ episode_id: "ep_second" }), { data_root: root });
        const content = readFileSync(path.join(root, "episodes.jsonl"), "utf8");
        expect(content).toContain("ep_first");
        expect(content).toContain("ep_second");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("version + ledger", () => {
    it("stamps EXPERIENCE_CORPUS_VERSION", () => {
      expect(EXPERIENCE_CORPUS_VERSION).toBe("experience-corpus.v1.2026-09-19");
    });
    it("retrieval declares zero_llm=true and ledger=B", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-exp-"));
      try {
        const r = queryTopOperators("k", { data_root: root });
        expect(r.zero_llm).toBe(true);
        expect(r.ledger).toBe("B");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
