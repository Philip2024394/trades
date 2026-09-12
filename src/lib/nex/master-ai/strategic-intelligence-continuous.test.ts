// src/lib/nex/master-ai/strategic-intelligence-continuous.test.ts
//
// Phase 11 · strategic intelligence continuous · contract tests

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  classifyRecommendation,
  fingerprintRecommendation,
  persistRecommendations,
  detectTrends,
  generateWeeklyRollup,
  runStrategicCycle,
  type ClassifiedRecommendation,
} from "./strategic-intelligence-continuous";
import type { StrategicRecommendation } from "./strategic-intelligence";

function synthRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex-p11-cont-"));
  mkdirSync(path.join(root, "data", "nex-agent-runtime"), { recursive: true });
  mkdirSync(path.join(root, "data", "master-ai"), { recursive: true });
  mkdirSync(path.join(root, "data", "programmer-improvement"), { recursive: true });
  return root;
}

function synthRec(overrides: Partial<StrategicRecommendation> = {}): StrategicRecommendation {
  return {
    recommendation_id: "rec_test",
    generator: "REC-A · failure_pattern_repeat",
    hypothesis: "NEX should authorize a targeted improvement for pattern X",
    decision_it_would_change: "Whether to invest engineering time",
    evidence_refs: [{ source: "test", identifier: "pattern_key:xyz", summary: "test" }],
    counter_evidence_refs: [],
    alternatives_considered: ["A", "B"],
    adversarial_steelman: "One should NOT do this if the pattern is dormant",
    confidence: "MEDIUM",
    confidence_rationale: "test",
    requires_founder_approval: true,
    created_at_iso: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Classification ─────────────────────────────────

describe("Phase 11 · classifyRecommendation · deterministic keyword-based", () => {
  it("classifies failure/regression rec as RISK", () => {
    const r = synthRec({ hypothesis: "NEX should fix the crash regression in the accommodation worker" });
    expect(classifyRecommendation(r)).toBe("risk");
  });
  it("classifies promote/approve rec as OPPORTUNITY", () => {
    const r = synthRec({ hypothesis: "NEX Founder should approve promotion of cand_x", decision_it_would_change: "Whether to promote or reject" });
    expect(classifyRecommendation(r)).toBe("opportunity");
  });
  it("classifies pure-information rec as NEUTRAL", () => {
    const r = synthRec({ hypothesis: "Consider examining the observation ledger", decision_it_would_change: "Reading habits", generator: "REC-Z" });
    expect(classifyRecommendation(r)).toBe("neutral");
  });
});

// ─── Fingerprint ────────────────────────────────────

describe("Phase 11 · fingerprintRecommendation · stable across regenerations", () => {
  it("same-generator + same-primary-evidence + same-decision → same fingerprint even if timestamp differs", () => {
    const r1 = synthRec({ recommendation_id: "rec_a", created_at_iso: "2026-09-08T00:00:00Z" });
    const r2 = synthRec({ recommendation_id: "rec_b", created_at_iso: "2026-09-08T12:00:00Z" });
    const fp1 = fingerprintRecommendation(r1);
    const fp2 = fingerprintRecommendation(r2);
    expect(fp1).toBe(fp2);
  });
  it("different generator → different fingerprint", () => {
    const r1 = synthRec({ generator: "REC-A · failure_pattern_repeat" });
    const r2 = synthRec({ generator: "REC-B · aging_awaiting_approval_candidate" });
    expect(fingerprintRecommendation(r1)).not.toBe(fingerprintRecommendation(r2));
  });
  it("different primary evidence → different fingerprint", () => {
    const r1 = synthRec({ evidence_refs: [{ source: "s", identifier: "pattern_key:xyz", summary: "" }] });
    const r2 = synthRec({ evidence_refs: [{ source: "s", identifier: "pattern_key:abc", summary: "" }] });
    expect(fingerprintRecommendation(r1)).not.toBe(fingerprintRecommendation(r2));
  });
});

// ─── Persistence ────────────────────────────────────

describe("Phase 11 · persistRecommendations · append-only · dedup within window", () => {
  it("first append writes · second append within window skips (dedup)", () => {
    const root = synthRepo();
    const rec: ClassifiedRecommendation = { ...synthRec(), classification: "risk", fingerprint: "fp_test" };
    const r1 = persistRecommendations([rec], { repoRoot: root });
    expect(r1.appended).toBe(1);
    expect(r1.skipped_dedup).toBe(0);
    const r2 = persistRecommendations([rec], { repoRoot: root });
    expect(r2.appended).toBe(0);
    expect(r2.skipped_dedup).toBe(1);
  });
  it("outside dedup window → appends again (append-only history preserves trend evidence)", () => {
    const root = synthRepo();
    // Pre-populate the ledger with an OLD record (>6h ago)
    const oldRec: ClassifiedRecommendation = { ...synthRec({ created_at_iso: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() }), classification: "risk", fingerprint: "fp_old" };
    writeFileSync(path.join(root, "data", "master-ai", "strategic_recommendations.jsonl"), JSON.stringify(oldRec) + "\n", "utf8");
    // Try to persist the same fingerprint as a "current" rec
    const currentRec: ClassifiedRecommendation = { ...synthRec({ created_at_iso: new Date().toISOString() }), classification: "risk", fingerprint: "fp_old" };
    const r = persistRecommendations([currentRec], { repoRoot: root });
    expect(r.appended).toBe(1);
    expect(r.skipped_dedup).toBe(0);
  });
});

// ─── Trend detection ────────────────────────────────

describe("Phase 11 · detectTrends · counts sightings across cycles", () => {
  it("fingerprint appearing in past 3 cycles → cycles_observed = 4 (past 3 + this cycle)", () => {
    const fp = "fp_trend";
    const past: ClassifiedRecommendation[] = [
      { ...synthRec({ created_at_iso: "2026-09-01T00:00:00Z" }), classification: "risk", fingerprint: fp },
      { ...synthRec({ created_at_iso: "2026-09-02T00:00:00Z" }), classification: "risk", fingerprint: fp },
      { ...synthRec({ created_at_iso: "2026-09-03T00:00:00Z" }), classification: "risk", fingerprint: fp },
    ];
    const current: ClassifiedRecommendation[] = [{ ...synthRec({ created_at_iso: "2026-09-08T00:00:00Z" }), classification: "risk", fingerprint: fp }];
    const withTrends = detectTrends(current, past);
    expect(withTrends[0].cycles_observed).toBe(4);
    expect(withTrends[0].first_seen_iso).toBe("2026-09-01T00:00:00Z");
  });
  it("fingerprint never seen before → cycles_observed = 1 · first_seen_iso = current created_at", () => {
    const current: ClassifiedRecommendation[] = [{ ...synthRec({ created_at_iso: "2026-09-08T00:00:00Z" }), classification: "risk", fingerprint: "fp_new" }];
    const withTrends = detectTrends(current, []);
    expect(withTrends[0].cycles_observed).toBe(1);
    expect(withTrends[0].first_seen_iso).toBe("2026-09-08T00:00:00Z");
  });
});

// ─── Weekly rollup ──────────────────────────────────

describe("Phase 11 · generateWeeklyRollup", () => {
  it("counts by classification · by confidence · surfaces trending (≥2 sightings)", () => {
    const now = new Date();
    const fpTrend = "fp_trend_a";
    const fpSingle = "fp_single_b";
    const ledger: ClassifiedRecommendation[] = [
      { ...synthRec({ created_at_iso: new Date(now.getTime() - 3 * 86400000).toISOString(), confidence: "MEDIUM" }), classification: "risk", fingerprint: fpTrend },
      { ...synthRec({ created_at_iso: new Date(now.getTime() - 1 * 86400000).toISOString(), confidence: "MEDIUM" }), classification: "risk", fingerprint: fpTrend },
      { ...synthRec({ created_at_iso: new Date(now.getTime() - 1 * 3600000).toISOString(), confidence: "LOW" }), classification: "opportunity", fingerprint: fpSingle },
    ];
    const r = generateWeeklyRollup(ledger, now);
    expect(r.total_recommendations_in_window).toBe(3);
    expect(r.by_classification.risk).toBe(2);
    expect(r.by_classification.opportunity).toBe(1);
    expect(r.by_confidence.MEDIUM).toBe(2);
    expect(r.by_confidence.LOW).toBe(1);
    expect(r.trending_recommendations.length).toBe(1);
    expect(r.trending_recommendations[0].fingerprint).toBe(fpTrend);
    expect(r.trending_recommendations[0].cycles_observed).toBe(2);
    expect(r.stable_recommendations).toBe(2);
    expect(r.new_this_cycle).toBe(1);
  });
  it("records older than 7 days are OUTSIDE the window", () => {
    const now = new Date();
    const ledger: ClassifiedRecommendation[] = [
      { ...synthRec({ created_at_iso: new Date(now.getTime() - 30 * 86400000).toISOString() }), classification: "risk", fingerprint: "fp_old" },
    ];
    const r = generateWeeklyRollup(ledger, now);
    expect(r.total_recommendations_in_window).toBe(0);
  });
});

// ─── Full cycle · dry-run ───────────────────────────

describe("Phase 11 · runStrategicCycle · dry-run leaves ledger unchanged", () => {
  it("dry-run cycle produces recs + rollup but writes nothing", () => {
    const root = synthRepo();
    // No source ledgers exist so no recs will be produced · but the cycle should still succeed
    const result = runStrategicCycle({ repoRoot: root, dry_run: true });
    expect(result.persisted).toBe(false);
    expect(result.recommendations.length).toBe(0);
    expect(result.weekly_rollup.total_recommendations_in_window).toBe(0);
  });
});
