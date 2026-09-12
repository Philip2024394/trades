// src/lib/nex/master-ai/strategic-intelligence.test.ts
//
// Phase 6 · strategic-intelligence contract tests

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deriveStrategicRecommendations } from "./strategic-intelligence";

function synthRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex-p6-strat-"));
  mkdirSync(path.join(root, "data", "nex-agent-runtime"), { recursive: true });
  mkdirSync(path.join(root, "data", "master-ai"), { recursive: true });
  mkdirSync(path.join(root, "data", "programmer-improvement"), { recursive: true });
  mkdirSync(path.join(root, "data", "programmer-learning"), { recursive: true });
  return root;
}

describe("Phase 6 · strategic recommendation generator", () => {
  it("empty repo produces ZERO recommendations · never fabricates", () => {
    const root = synthRepo();
    const recs = deriveStrategicRecommendations(root);
    expect(recs.length).toBe(0);
  });

  it("recurring failure pattern (>=3 occurrences) produces REC-A recommendation", () => {
    const root = synthRepo();
    writeFileSync(path.join(root, "data", "master-ai", "failure_patterns.jsonl"),
      JSON.stringify({
        pattern_key: "test_pattern_1",
        occurrence_count: 6,
        affected_agents: ["accommodation"],
        representative_reason: "internet_offline_or_unknown",
        first_seen_iso: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        last_seen_iso: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      }) + "\n", "utf8");
    const recs = deriveStrategicRecommendations(root);
    const failureRec = recs.find((r) => r.generator.startsWith("REC-A"));
    expect(failureRec).toBeDefined();
    expect(failureRec!.evidence_refs[0].identifier).toContain("test_pattern_1");
    expect(failureRec!.counter_evidence_refs.some((r) => r.identifier.includes("single_agent_scope"))).toBe(true);
    expect(failureRec!.alternatives_considered.length).toBeGreaterThan(0);
    expect(failureRec!.adversarial_steelman.length).toBeGreaterThan(20);
    expect(failureRec!.requires_founder_approval).toBe(true);
  });

  it("occurrence_count < 3 → NO REC-A recommendation (evidence threshold enforced)", () => {
    const root = synthRepo();
    writeFileSync(path.join(root, "data", "master-ai", "failure_patterns.jsonl"),
      JSON.stringify({
        pattern_key: "test_pattern_low",
        occurrence_count: 2,
        affected_agents: ["accommodation"],
        representative_reason: "one-off_glitch",
        last_seen_iso: new Date().toISOString(),
      }) + "\n", "utf8");
    const recs = deriveStrategicRecommendations(root);
    expect(recs.filter((r) => r.generator.startsWith("REC-A")).length).toBe(0);
  });

  it("aging AWAITING_APPROVAL candidate produces REC-B recommendation", () => {
    const root = synthRepo();
    writeFileSync(path.join(root, "data", "programmer-improvement", "candidates.jsonl"),
      JSON.stringify({
        candidate_id: "cand_test_1",
        kind: "knowledge",
        affects_capability: "test.capability",
        proposed_knowledge: { knowledge_id: "know_test_1" },
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        verification_status: "UNVERIFIED",
      }) + "\n", "utf8");
    const recs = deriveStrategicRecommendations(root);
    const candRec = recs.find((r) => r.generator.startsWith("REC-B"));
    expect(candRec).toBeDefined();
    expect(candRec!.evidence_refs[0].identifier).toContain("cand_test_1");
    expect(candRec!.counter_evidence_refs[0].identifier).toContain("no_autonomous_promotion");
  });

  it("recent candidate (<2h old) → no REC-B recommendation (avoids nagging)", () => {
    const root = synthRepo();
    writeFileSync(path.join(root, "data", "programmer-improvement", "candidates.jsonl"),
      JSON.stringify({
        candidate_id: "cand_recent",
        created_at: new Date().toISOString(),
        verification_status: "UNVERIFIED",
      }) + "\n", "utf8");
    const recs = deriveStrategicRecommendations(root);
    expect(recs.filter((r) => r.generator.startsWith("REC-B")).length).toBe(0);
  });

  it("every recommendation has evidence_refs, counter_evidence_refs (or explicit alternatives), adversarial_steelman, confidence rationale", () => {
    const root = synthRepo();
    // Setup a variety of evidence sources
    writeFileSync(path.join(root, "data", "master-ai", "failure_patterns.jsonl"),
      JSON.stringify({
        pattern_key: "pk1",
        occurrence_count: 5,
        affected_agents: ["a", "b"],
        representative_reason: "reason",
        last_seen_iso: new Date().toISOString(),
      }) + "\n", "utf8");
    writeFileSync(path.join(root, "data", "programmer-improvement", "candidates.jsonl"),
      JSON.stringify({
        candidate_id: "cand_1",
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        verification_status: "UNVERIFIED",
      }) + "\n", "utf8");
    writeFileSync(path.join(root, "data", "master-ai", "research_findings.jsonl"),
      JSON.stringify({ topic: "t1" }) + "\n", "utf8");
    const recs = deriveStrategicRecommendations(root);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.evidence_refs.length).toBeGreaterThan(0);
      expect(r.hypothesis.length).toBeGreaterThan(20);
      expect(r.decision_it_would_change.length).toBeGreaterThan(10);
      expect(r.adversarial_steelman.length).toBeGreaterThan(20);
      expect(r.confidence_rationale.length).toBeGreaterThan(5);
      // Counter-evidence OR alternatives present
      expect(r.counter_evidence_refs.length + r.alternatives_considered.length).toBeGreaterThan(0);
      expect(r.requires_founder_approval).toBe(true);
    }
  });

  it("anti-recency-bias · all-<24h evidence caps confidence at MEDIUM", () => {
    const root = synthRepo();
    writeFileSync(path.join(root, "data", "master-ai", "failure_patterns.jsonl"),
      JSON.stringify({
        pattern_key: "pk_recent",
        occurrence_count: 10,
        affected_agents: ["a", "b", "c"],
        representative_reason: "recent",
        last_seen_iso: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        first_seen_iso: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      }) + "\n", "utf8");
    const recs = deriveStrategicRecommendations(root);
    const r = recs.find((x) => x.generator.startsWith("REC-A"));
    expect(r).toBeDefined();
    // Confidence cannot be HIGH because all evidence is <24h old
    expect(r!.confidence).not.toBe("HIGH");
  });
});
