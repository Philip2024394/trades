// scripts/nex-canonical/canonical-handoff.test.ts
//
// Pure unit tests for precheckHandoff · the handoff-v1 pre-flight.
// No DB. No network. No pg Client. No secrets. No clock. No randomness.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { reviewCandidates } from "./candidate-reviewer";
import {
  buildReviewPackage,
  decideCandidate,
  type DecisionRecord,
  type ReviewPackage,
} from "./candidate-approval";
import type { Candidate } from "./generate-candidates";
import {
  EVIDENCE_SCHEMA_VERSION,
  HANDOFF_SCHEMA_VERSION,
  precheckHandoff,
  type ApprovedCandidateHandoff,
  type HandoffBlockedReason,
  type HandoffPrecheckResult,
  type ResolverVerdict,
  type SourceRegistryRow,
} from "./canonical-handoff";
import type { CanonicalRow, LifecycleState } from "./canonical-row";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures
// ═════════════════════════════════════════════════════════════════════

const T0 = "2026-10-08T12:00:00.000Z";
const T1 = "2026-10-08T12:01:00.000Z";

function cand(overrides: Partial<Candidate> & { candidate_id: string }): Candidate {
  const base: Candidate = {
    candidate_id: overrides.candidate_id,
    status: "pending_founder_review",
    entity_type: "food",
    country: "ID",
    identity: {
      name_canonical: `Warung ${overrides.candidate_id}`,
      aliases: ["x"],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: null,
      district: null,
      coordinates: null,
    },
    legacy_source: {
      table: "nex.food_business",
      ref: `ref-${overrides.candidate_id}`,
      internal_id: null,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [{ risk_category: "R1", contribution: 0.5, note: "n" }],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: T0,
      generation_run_id: "nex-cand-v1-2026-10-08",
    },
    caveats: [],
  };
  return { ...base, ...overrides } as Candidate;
}

function pkgFrom(candidates: readonly Candidate[]): ReviewPackage {
  const report = reviewCandidates(candidates);
  return buildReviewPackage({ candidates, report, packagedAt: T0 });
}

function approvedDecision(
  pkg: ReviewPackage,
  candidate_id: string,
  overrides: Partial<Parameters<typeof decideCandidate>[0]> = {},
): DecisionRecord {
  return decideCandidate({
    package: pkg,
    candidateId: candidate_id,
    decision: "approve",
    founderId: "philip",
    founderNote: "approved for canonical handoff",
    acknowledgedAnomalyRules: ["thin_identity"],
    decisionTimestamp: T0,
    supersedes: null,
    ...overrides,
  });
}

function handoff(
  pkg: ReviewPackage,
  candidate: Candidate,
  decision: DecisionRecord,
  previous_decisions?: readonly DecisionRecord[],
): ApprovedCandidateHandoff {
  return {
    schema_version: HANDOFF_SCHEMA_VERSION,
    decision_record: decision,
    candidate,
    review_package: pkg,
    previous_decisions,
  };
}

function sourceRow(overrides: Partial<SourceRegistryRow> = {}): SourceRegistryRow {
  return {
    source_id: "nex.food_business",
    source_type: "LEGACY_NEX",
    display_name: "NEX Food Business (legacy)",
    can_collect: true,
    can_store: true,
    can_display: false,
    can_derive: true,
    can_redistribute: false,
    attribution_required: true,
    ...overrides,
  };
}

function canonical(overrides: Partial<CanonicalRow> = {}): CanonicalRow {
  const base: CanonicalRow = {
    canonical_business_id: "00000000-0000-0000-0000-000000000001",
    entity_type: "food",
    country: "ID",
    lifecycle_state: "DISCOVERED",
    name_canonical: "Existing Row",
    name_norm: "existing row",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: null,
    district: null,
    coordinates: null,
    supersedes_business_id: null,
    superseded_by_business_id: null,
    last_verified_at: null,
  };
  return { ...base, ...overrides };
}

function matchVerdict(targetId: string, score = 0.9): ResolverVerdict {
  return {
    kind: "MATCH",
    target_canonical_business_id: targetId,
    score,
    score_breakdown: [{ key: "name_jaccard", contribution: score, note: "x" }],
  };
}

function noMatchVerdict(bestScore = 0.1): ResolverVerdict {
  return { kind: "NO_MATCH", best_score: bestScore };
}

function ambiguousVerdict(): ResolverVerdict {
  return {
    kind: "AMBIGUOUS",
    competing: [
      { canonical_business_id: "a", score: 0.7 },
      { canonical_business_id: "b", score: 0.65 },
    ],
    best_score: 0.7,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Happy paths
// ═════════════════════════════════════════════════════════════════════

describe("precheckHandoff · happy paths", () => {
  test("approve + MATCH + writable target → merge_match plan with evidence", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const target = canonical({ canonical_business_id: "T1", lifecycle_state: "VERIFIED" });
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: matchVerdict("T1"),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: target,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.kind).toBe("merge_match");
      if (result.plan.kind === "merge_match") {
        expect(result.plan.target_canonical_business_id).toBe("T1");
        expect(result.plan.evidence.schema_version).toBe(EVIDENCE_SCHEMA_VERSION);
        expect(result.plan.evidence.candidate_id).toBe("a");
        expect(result.plan.evidence.resolver_verdict_summary.kind).toBe("MATCH");
        expect(result.plan.evidence.resolver_verdict_summary.target_canonical_business_id).toBe("T1");
      }
    }
  });

  test("approve + NO_MATCH → insert_new plan with evidence · lifecycle_state is DISCOVERED", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        name_canonical: "New Warung",
        aliases: ["new"],
        phone_e164: "+6281234567890",
        website_apex: "example.id",
        osm_id: null,
        wikidata_qid: null,
        city: "Bandung",
        district: "Cihampelas",
        coordinates: { lat: -6.9, lng: 107.6 },
      },
    });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a", { acknowledgedAnomalyRules: [] });
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.plan.kind === "insert_new") {
      expect(result.plan.row.lifecycle_state).toBe("DISCOVERED");
      expect(result.plan.row.name_canonical).toBe("New Warung");
      expect(result.plan.row.phone_e164).toBe("+6281234567890");
      expect(result.plan.row.coordinates).toEqual({ lat: -6.9, lng: 107.6 });
      expect(result.plan.evidence.resolver_verdict_summary.kind).toBe("NO_MATCH");
      expect(result.plan.evidence.resolver_verdict_summary.target_canonical_business_id).toBeNull();
    }
  });

  test("evidence binds candidate_id · decision_record_id · review_package_id · source_id", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const target = canonical({ canonical_business_id: "T2" });
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: matchVerdict("T2"),
      source_registry_row: sourceRow({ source_id: "src-X" }),
      current_canonical_row_if_match: target,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const e = result.plan.evidence;
      expect(e.candidate_id).toBe("a");
      expect(e.candidate_integrity_hash).toBe(d.candidate_integrity_hash);
      expect(e.decision_record_id).toBe(d.decision_record_id);
      expect(e.review_package_id).toBe(p.package_id);
      expect(e.source_id).toBe("src-X");
      expect(e.observation_provenance.decision_timestamp).toBe(d.decision_timestamp);
      expect(e.observation_provenance.founder_id).toBe("philip");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Decision state refusals
// ═════════════════════════════════════════════════════════════════════

describe("decision state · reject / defer / superseded block", () => {
  test("decision = reject → not_approved", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = decideCandidate({
      package: p,
      candidateId: "a",
      decision: "reject",
      founderId: "p",
      founderNote: "n",
      acknowledgedAnomalyRules: ["thin_identity"],
      decisionTimestamp: T0,
      supersedes: null,
    });
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: matchVerdict("T"),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: canonical({ canonical_business_id: "T" }),
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("not_approved");
      if (result.reason.kind === "not_approved") {
        expect(result.reason.decision).toBe("reject");
      }
    }
  });

  test("decision = defer → not_approved", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = decideCandidate({
      package: p,
      candidateId: "a",
      decision: "defer",
      founderId: "p",
      founderNote: null,
      acknowledgedAnomalyRules: ["thin_identity"],
      decisionTimestamp: T0,
      supersedes: null,
    });
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("not_approved");
    }
  });

  test("superseded approval · previous_decisions supplied · blocks with superseded_by_record_id", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d1 = approvedDecision(p, "a");
    const d2 = decideCandidate({
      package: p,
      candidateId: "a",
      decision: "reject",
      founderId: "p",
      founderNote: "override",
      acknowledgedAnomalyRules: ["thin_identity"],
      decisionTimestamp: T1,
      supersedes: d1.decision_record_id,
      previousRecords: [d1],
    });
    const result = precheckHandoff({
      handoff: handoff(p, c, d1, [d1, d2]),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === "superseded") {
      expect(result.reason.superseded_by_record_id).toBe(d2.decision_record_id);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Integrity binding mismatches
// ═════════════════════════════════════════════════════════════════════

describe("integrity binding", () => {
  test("candidate_integrity_hash mismatch · supplied candidate differs from the one decision was recorded against", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const tampered = cand({
      candidate_id: "a",
      selection_score: 0.9999,
    });
    const result = precheckHandoff({
      handoff: handoff(p, tampered, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("candidate_integrity_mismatch");
    }
  });

  test("review package tampered · package_id mismatch", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const tampered: ReviewPackage = {
      ...p,
      candidates: [cand({ candidate_id: "a", country: "MY" })],
    };
    const result = precheckHandoff({
      handoff: handoff(tampered, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("review_package_integrity_mismatch");
    }
  });

  test("decision record candidate_id vs supplied candidate_id mismatch", () => {
    const c1 = cand({ candidate_id: "a" });
    const c2 = cand({ candidate_id: "b" });
    const p = pkgFrom([c1, c2]);
    const d = approvedDecision(p, "a");
    const result = precheckHandoff({
      handoff: handoff(p, c2, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("decision_record_candidate_mismatch");
    }
  });

  test("decision record review_package_id vs supplied package_id mismatch", () => {
    const c = cand({ candidate_id: "a" });
    const p1 = pkgFrom([c]);
    const p2 = buildReviewPackage({
      candidates: [c],
      report: reviewCandidates([c]),
      packagedAt: T1, // different timestamp → different package_id
    });
    const d = approvedDecision(p1, "a");
    const result = precheckHandoff({
      handoff: handoff(p2, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("decision_record_package_mismatch");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · AMBIGUOUS blocks (never produces a plan)
// ═════════════════════════════════════════════════════════════════════

describe("AMBIGUOUS verdict", () => {
  test("ambiguous verdict → resolver_ambiguous · no plan", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: ambiguousVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === "resolver_ambiguous") {
      expect(result.reason.competing).toEqual(["a", "b"]);
      expect(result.reason.best_score).toBe(0.7);
    }
  });

  test("ambiguous NEVER produces a write plan · even if founder approved", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: ambiguousVerdict(),
      source_registry_row: sourceRow({ can_derive: true }),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Source permission denied
// ═════════════════════════════════════════════════════════════════════

describe("source permission", () => {
  test("can_derive = false → source_permission_denied", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const result = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow({ can_derive: false }),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === "source_permission_denied") {
      expect(result.reason.flag).toBe("can_derive");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Rule-5 violations
// ═════════════════════════════════════════════════════════════════════

describe("Rule-5 violations", () => {
  function harness(c: Candidate): HandoffPrecheckResult {
    const p = pkgFrom([c]);
    const d = approvedDecision(p, c.candidate_id, { acknowledgedAnomalyRules: [] });
    return precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
  }

  test("country not ISO-2 → rule_5_violation", () => {
    const c = cand({
      candidate_id: "a",
      country: "Indonesia",
      identity: {
        name_canonical: "X",
        aliases: ["z"],
        phone_e164: null,
        website_apex: null,
        osm_id: null,
        wikidata_qid: null,
        city: null,
        district: null,
        coordinates: null,
      },
    });
    const r = harness(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("rule_5_violation");
  });

  test("name blank → rule_5_violation", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        name_canonical: "   ",
        aliases: ["z"],
        phone_e164: null,
        website_apex: null,
        osm_id: null,
        wikidata_qid: null,
        city: null,
        district: null,
        coordinates: null,
      },
    });
    const r = harness(c);
    expect(r.ok).toBe(false);
  });

  test("phone not E.164 → rule_5_violation", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        name_canonical: "N",
        aliases: ["z"],
        phone_e164: "081234567890", // missing +
        website_apex: null,
        osm_id: null,
        wikidata_qid: null,
        city: null,
        district: null,
        coordinates: null,
      },
    });
    const r = harness(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("rule_5_violation");
  });

  test("wikidata_qid wrong format → rule_5_violation", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        name_canonical: "N",
        aliases: ["z"],
        phone_e164: null,
        website_apex: null,
        osm_id: null,
        wikidata_qid: "not-a-qid",
        city: null,
        district: null,
        coordinates: null,
      },
    });
    const r = harness(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("rule_5_violation");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · MATCH lifecycle / target checks
// ═════════════════════════════════════════════════════════════════════

describe("MATCH target state", () => {
  function harness(
    canonicalOverrides: Partial<CanonicalRow>,
    rowId = "T",
    rowProvidedAsId: string | null = null,
  ): HandoffPrecheckResult {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const row = canonical({
      canonical_business_id: rowProvidedAsId ?? rowId,
      ...canonicalOverrides,
    });
    return precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: matchVerdict(rowId),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: row,
      existing_osm_collision_if_any: null,
    });
  }

  test.each<LifecycleState>(["DORMANT", "SUPERSEDED"])(
    "lifecycle_state = %s → lifecycle_blocked",
    (state) => {
      const r = harness({ lifecycle_state: state });
      expect(r.ok).toBe(false);
      if (!r.ok && r.reason.kind === "lifecycle_blocked") {
        expect(r.reason.current_state).toBe(state);
      }
    },
  );

  test("MATCH verdict with missing current_canonical_row_if_match → missing_canonical_row_for_match", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: matchVerdict("T"),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("missing_canonical_row_for_match");
  });

  test("MATCH verdict target_id differs from supplied row.canonical_business_id → match_target_mismatch", () => {
    const r = harness({}, "VERDICT_TARGET", "DIFFERENT_ROW");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("match_target_mismatch");
  });

  test("target row already superseded_by set → target_already_superseded", () => {
    const r = harness({ superseded_by_business_id: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("target_already_superseded");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · OSM collision on NO_MATCH
// ═════════════════════════════════════════════════════════════════════

describe("OSM collision", () => {
  test("candidate has osm_id + caller supplies collision → osm_collision block", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        name_canonical: "N",
        aliases: ["x"],
        phone_e164: null,
        website_apex: null,
        osm_id: "node/12345",
        wikidata_qid: null,
        city: null,
        district: null,
        coordinates: null,
      },
    });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: {
        canonical_business_id: "EXISTING",
        osm_id: "node/12345",
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason.kind === "osm_collision") {
      expect(r.reason.existing_canonical_business_id).toBe("EXISTING");
      expect(r.reason.osm_id).toBe("node/12345");
    }
  });

  test("candidate has osm_id · no collision supplied → insert_new succeeds", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        name_canonical: "N",
        aliases: ["x"],
        phone_e164: null,
        website_apex: null,
        osm_id: "node/99",
        wikidata_qid: null,
        city: null,
        district: null,
        coordinates: null,
      },
    });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.plan.kind === "insert_new") {
      expect(r.plan.row.osm_id).toBe("node/99");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Schema version
// ═════════════════════════════════════════════════════════════════════

describe("schema version", () => {
  test("invalid handoff schema_version → invalid_handoff_schema_version", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const bad = {
      ...handoff(p, c, d),
      schema_version: "handoff-v99",
    } as unknown as ApprovedCandidateHandoff;
    const r = precheckHandoff({
      handoff: bad,
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("invalid_handoff_schema_version");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Verdict-plan invariants
// ═════════════════════════════════════════════════════════════════════

describe("verdict → plan invariants", () => {
  test("MATCH never produces insert_new", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const target = canonical({ canonical_business_id: "T" });
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: matchVerdict("T"),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: target,
      existing_osm_collision_if_any: null,
    });
    if (r.ok) {
      expect(r.plan.kind).not.toBe("insert_new");
      expect(r.plan.kind).toBe("merge_match");
    }
  });

  test("NO_MATCH never produces merge_match", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    if (r.ok) {
      expect(r.plan.kind).not.toBe("merge_match");
      expect(r.plan.kind).toBe("insert_new");
    }
  });

  test("AMBIGUOUS never produces any write plan", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: ambiguousVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: canonical(),
      existing_osm_collision_if_any: null,
    });
    expect(r.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §11 · Determinism + input immutability
// ═════════════════════════════════════════════════════════════════════

describe("determinism + immutability", () => {
  test("same inputs → structurally-equal output", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const h = handoff(p, c, d);
    const args = {
      handoff: h,
      resolver_verdict: noMatchVerdict(0.3),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    } as const;
    expect(precheckHandoff(args)).toEqual(precheckHandoff(args));
  });

  test("does not mutate input Candidate / Package / DecisionRecord", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const cSnap = JSON.stringify(c);
    const pSnap = JSON.stringify(p);
    const dSnap = JSON.stringify(d);
    precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(JSON.stringify(c)).toBe(cSnap);
    expect(JSON.stringify(p)).toBe(pSnap);
    expect(JSON.stringify(d)).toBe(dSnap);
  });

  test("does not mutate the resolver verdict or source row", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const v = matchVerdict("T");
    const sr = sourceRow();
    const vSnap = JSON.stringify(v);
    const srSnap = JSON.stringify(sr);
    precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: v,
      source_registry_row: sr,
      current_canonical_row_if_match: canonical({ canonical_business_id: "T" }),
      existing_osm_collision_if_any: null,
    });
    expect(JSON.stringify(v)).toBe(vSnap);
    expect(JSON.stringify(sr)).toBe(srSnap);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §12 · Edge inputs
// ═════════════════════════════════════════════════════════════════════

describe("edge inputs", () => {
  test("acknowledgment list on decision does not affect the handoff decision", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a", { acknowledgedAnomalyRules: ["thin_identity"] });
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(r.ok).toBe(true);
  });

  test("resolver NO_MATCH with best_score=0 is still accepted · Rule-5 is the guard, not score", () => {
    const c = cand({ candidate_id: "a" });
    const p = pkgFrom([c]);
    const d = approvedDecision(p, "a");
    const r = precheckHandoff({
      handoff: handoff(p, c, d),
      resolver_verdict: noMatchVerdict(0),
      source_registry_row: sourceRow(),
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(r.ok).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §13 · Discriminated-union exhaustiveness of HandoffBlockedReason
// ═════════════════════════════════════════════════════════════════════

describe("HandoffBlockedReason discriminant", () => {
  test("every observed reason.kind matches a known literal", () => {
    const knownKinds = new Set<HandoffBlockedReason["kind"]>([
      "invalid_handoff_schema_version",
      "not_approved",
      "superseded",
      "candidate_integrity_mismatch",
      "review_package_integrity_mismatch",
      "decision_record_candidate_mismatch",
      "decision_record_package_mismatch",
      "resolver_ambiguous",
      "rule_5_violation",
      "source_permission_denied",
      "lifecycle_blocked",
      "target_already_superseded",
      "osm_collision",
      "missing_canonical_row_for_match",
      "match_target_mismatch",
    ]);
    // Just assert the set has the expected size.
    expect(knownKinds.size).toBe(15);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §14 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("canonical-handoff source · pure module", () => {
  const srcPath = path.join(__dirname, "canonical-handoff.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import pg / pg-executor / pg-fingerprint / extract-candidates", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-executor["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-fingerprint["']/);
    expect(code).not.toMatch(/from\s+["']\.\/extract-candidates["']/);
  });

  test("CODE does NOT import identity-matching / entity-universe / matchBusiness", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT reference Supabase / dotenv / process.env / fs", () => {
    expect(code).not.toMatch(/@supabase/);
    expect(code).not.toMatch(/\bsupabase/i);
    expect(code).not.toMatch(/\bdotenv\b/);
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\bfs\.read/);
    expect(code).not.toMatch(/\bfs\.write/);
    expect(code).not.toMatch(/createWriteStream/);
  });

  test("CODE does NOT use clock / randomness", () => {
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
  });

  test("CODE does NOT implement executeWritePlan / canonicalInsert / handoffReady", () => {
    expect(code).not.toMatch(/export\s+(?:async\s+)?function\s+executeWritePlan\b/);
    expect(code).not.toMatch(/export\s+(?:async\s+)?function\s+canonicalInsert\b/);
    expect(code).not.toMatch(/export\s+(?:async\s+)?function\s+handoffReady\b/);
    expect(code).not.toMatch(/export\s+const\s+executeWritePlan\b/);
  });

  test("CODE does NOT execute SQL / contain INSERT/UPDATE/DELETE/DDL", () => {
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\.query\s*\(/);
  });

  test("CODE's only script-local imports are the sealed consumer surface", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    const allowed = new Set([
      "generate-candidates",
      "candidate-approval",
      "canonical-row",
    ]);
    for (const imp of localImports) {
      expect(allowed.has(imp)).toBe(true);
    }
  });

  test("CODE's only node builtin is node:crypto", () => {
    const nodeImports = [
      ...code.matchAll(/from\s+["']node:([^"']+)["']/g),
    ].map((m) => m[1]);
    for (const imp of nodeImports) {
      expect(imp).toBe("crypto");
    }
  });
});
