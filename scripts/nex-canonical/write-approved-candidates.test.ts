// scripts/nex-canonical/write-approved-candidates.test.ts
//
// Pure unit tests for the write-approved-candidates runner.
// No DB · no network · no filesystem (pure core only).

import { describe, expect, test } from "vitest";
import type { Candidate } from "./generate-candidates";
import { reviewCandidates } from "./candidate-reviewer";
import {
  buildReviewPackage,
  decideCandidate,
  type DecisionRecord,
  type ReviewPackage,
} from "./candidate-approval";
import type { PendingReviewEntry } from "./durable-approval-queue";
import {
  CliArgError,
  joinApprovedForWrite,
  parseCliArgs,
} from "./write-approved-candidates";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures
// ═════════════════════════════════════════════════════════════════════

const T_PACKAGED = "2026-10-08T12:00:00.000Z";
const T_ENQUEUED = "2026-10-08T12:05:00.000Z";
const T_DECISION = "2026-10-08T15:00:00.000Z";
const T_LATER = "2026-10-08T16:00:00.000Z";

function cand(overrides: Partial<Candidate> & { candidate_id: string }): Candidate {
  const base: Candidate = {
    candidate_id: overrides.candidate_id,
    status: "pending_founder_review",
    entity_type: "food",
    country: "ID",
    identity: {
      name_canonical: `name-${overrides.candidate_id}`,
      aliases: [],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Bandung",
      district: null,
      neighbourhood: null,
      street_line: null,
      address: null,
      coordinates: { lat: -6.9, lng: 107.6 },
    },
    legacy_source: {
      table: "nex.food_business",
      ref: `ref-${overrides.candidate_id}`,
      internal_id: null,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [
      { risk_category: "R1", contribution: 0.5, note: "n" },
    ],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: T_PACKAGED,
      generation_run_id: "nex-cand-write-test-2026-10-09",
    },
    caveats: [],
  };
  return { ...base, ...overrides };
}

function pkgOf(candidates: readonly Candidate[]): ReviewPackage {
  const report = reviewCandidates(candidates);
  return buildReviewPackage({
    candidates,
    report,
    packagedAt: T_PACKAGED,
  });
}

function entryOf(pkg: ReviewPackage, candidate_id: string): PendingReviewEntry {
  return {
    schema_version: "pending-review-v1",
    candidate_id,
    review_package_id: pkg.package_id,
    review_package: pkg,
    enqueued_at: T_ENQUEUED,
  };
}

function approve(
  pkg: ReviewPackage,
  candidate_id: string,
  overrides: {
    readonly founder_note?: string | null;
    readonly decisionTimestamp?: string;
    readonly supersedes?: string | null;
  } = {},
): DecisionRecord {
  return decideCandidate({
    package: pkg,
    candidateId: candidate_id,
    decision: "approve",
    founderId: "test-founder",
    founderNote: overrides.founder_note ?? "approved for test",
    acknowledgedAnomalyRules: [],
    decisionTimestamp: overrides.decisionTimestamp ?? T_DECISION,
    supersedes: overrides.supersedes ?? null,
  });
}

// ═════════════════════════════════════════════════════════════════════
// §1 · joinApprovedForWrite · happy path
// ═════════════════════════════════════════════════════════════════════

describe("joinApprovedForWrite · happy path", () => {
  test("produces a ready outcome for each allowlisted candidate_id with a current approve", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkg = pkgOf([a]);
    const pkg2 = pkgOf([b]);
    const decA = approve(pkg, "cand-a");
    const decB = approve(pkg2, "cand-b");
    const result = joinApprovedForWrite({
      allowlist: ["cand-a", "cand-b"],
      decisions: [decA, decB],
      pending: [entryOf(pkg, "cand-a"), entryOf(pkg2, "cand-b")],
    });
    expect(result.outcomes.map((o) => o.outcome)).toEqual(["ready", "ready"]);
    expect(result.approved_outside_allowlist).toEqual([]);
    const r0 = result.outcomes[0];
    if (r0.outcome === "ready") {
      expect(r0.handoff.schema_version).toBe("handoff-v1");
      expect(r0.handoff.decision_record.decision).toBe("approve");
      expect(r0.handoff.candidate.candidate_id).toBe("cand-a");
      expect(r0.handoff.review_package.package_id).toBe(pkg.package_id);
      expect(r0.handoff.previous_decisions).toHaveLength(2);
    } else {
      throw new Error("expected ready outcome");
    }
  });

  test("preserves allowlist order in outcomes", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkgA = pkgOf([a]);
    const pkgB = pkgOf([b]);
    const result = joinApprovedForWrite({
      allowlist: ["cand-b", "cand-a"],
      decisions: [approve(pkgA, "cand-a"), approve(pkgB, "cand-b")],
      pending: [entryOf(pkgA, "cand-a"), entryOf(pkgB, "cand-b")],
    });
    expect(result.outcomes.map((o) => o.candidate_id)).toEqual([
      "cand-b",
      "cand-a",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · joinApprovedForWrite · negative cases
// ═════════════════════════════════════════════════════════════════════

describe("joinApprovedForWrite · negative", () => {
  test("no_decision_in_log for a candidate_id not present in the decision log", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);
    const result = joinApprovedForWrite({
      allowlist: ["cand-a"],
      decisions: [],
      pending: [entryOf(pkg, "cand-a")],
    });
    expect(result.outcomes[0].outcome).toBe("no_decision_in_log");
  });

  test("not_approve_in_log when the current decision is reject", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);
    const rejection = decideCandidate({
      package: pkg,
      candidateId: "cand-a",
      decision: "reject",
      founderId: "test-founder",
      founderNote: "rejected",
      acknowledgedAnomalyRules: [],
      decisionTimestamp: T_DECISION,
      supersedes: null,
    });
    const result = joinApprovedForWrite({
      allowlist: ["cand-a"],
      decisions: [rejection],
      pending: [entryOf(pkg, "cand-a")],
    });
    const o = result.outcomes[0];
    expect(o.outcome).toBe("not_approve_in_log");
    if (o.outcome === "not_approve_in_log") {
      expect(o.observed_decision).toBe("reject");
    }
  });

  test("no_matching_queue_entry when the decision references a package not in the pending queue", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);
    const dec = approve(pkg, "cand-a");
    const result = joinApprovedForWrite({
      allowlist: ["cand-a"],
      decisions: [dec],
      pending: [], // queue is empty
    });
    const o = result.outcomes[0];
    expect(o.outcome).toBe("no_matching_queue_entry");
    if (o.outcome === "no_matching_queue_entry") {
      expect(o.expected_review_package_id).toBe(dec.review_package_id);
    }
  });

  test("candidate_not_in_review_package when the matched entry's package does not contain the id", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkg = pkgOf([a]); // package only contains cand-a
    const dec = approve(pkg, "cand-a");
    // Craft a corrupt pending entry that claims cand-b is inside the
    // cand-a package. This models queue tampering · join refuses it.
    const corrupted: PendingReviewEntry = {
      schema_version: "pending-review-v1",
      candidate_id: "cand-b",
      review_package_id: pkg.package_id,
      review_package: pkg,
      enqueued_at: T_ENQUEUED,
    };
    const decB: DecisionRecord = {
      ...dec,
      candidate_id: "cand-b",
    } as DecisionRecord; // the sealed hash on `dec` is wrong for cand-b; the join doesn't recompute hashes · it just does the structural match. precheckHandoff would catch the mismatch downstream, but we're testing join only.
    void b; // used only via the id string
    const result = joinApprovedForWrite({
      allowlist: ["cand-b"],
      decisions: [decB],
      pending: [corrupted],
    });
    expect(result.outcomes[0].outcome).toBe(
      "candidate_not_in_review_package",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · joinApprovedForWrite · supersession + visibility
// ═════════════════════════════════════════════════════════════════════

describe("joinApprovedForWrite · supersession + visibility", () => {
  test("latest non-superseded decision wins when multiple exist for the same candidate", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);
    const first = decideCandidate({
      package: pkg,
      candidateId: "cand-a",
      decision: "defer",
      founderId: "test-founder",
      founderNote: "wait",
      acknowledgedAnomalyRules: [],
      decisionTimestamp: T_DECISION,
      supersedes: null,
    });
    const second = decideCandidate({
      package: pkg,
      candidateId: "cand-a",
      decision: "approve",
      founderId: "test-founder",
      founderNote: "approved later",
      acknowledgedAnomalyRules: [],
      decisionTimestamp: T_LATER,
      supersedes: first.decision_record_id,
    });
    const result = joinApprovedForWrite({
      allowlist: ["cand-a"],
      decisions: [first, second],
      pending: [entryOf(pkg, "cand-a")],
    });
    const o = result.outcomes[0];
    expect(o.outcome).toBe("ready");
    if (o.outcome === "ready") {
      expect(o.handoff.decision_record.decision_record_id).toBe(
        second.decision_record_id,
      );
    }
  });

  test("surfaces approvals that are outside the allowlist (visibility · never written)", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkgA = pkgOf([a]);
    const pkgB = pkgOf([b]);
    const result = joinApprovedForWrite({
      allowlist: ["cand-a"],
      decisions: [approve(pkgA, "cand-a"), approve(pkgB, "cand-b")],
      pending: [entryOf(pkgA, "cand-a"), entryOf(pkgB, "cand-b")],
    });
    expect(result.outcomes.map((o) => o.outcome)).toEqual(["ready"]);
    expect(result.approved_outside_allowlist).toEqual(["cand-b"]);
  });

  test("does NOT surface outside approvals when the allowlist already covers them", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);
    const result = joinApprovedForWrite({
      allowlist: ["cand-a"],
      decisions: [approve(pkg, "cand-a")],
      pending: [entryOf(pkg, "cand-a")],
    });
    expect(result.approved_outside_allowlist).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · CLI arg parsing · fail-closed
// ═════════════════════════════════════════════════════════════════════

describe("parseCliArgs", () => {
  test("accepts a full allowlist + both paths", () => {
    const parsed = parseCliArgs([
      "/node",
      "/write-approved-candidates.ts",
      "--allowlist=cand-a,cand-b,cand-c",
      "--pending-queue=/tmp/queue.jsonl",
      "--decision-log=/tmp/log.jsonl",
    ]);
    expect(parsed.allowlist).toEqual(["cand-a", "cand-b", "cand-c"]);
    expect(parsed.pendingQueuePath).toBe("/tmp/queue.jsonl");
    expect(parsed.decisionLogPath).toBe("/tmp/log.jsonl");
  });

  test("trims whitespace around allowlist entries", () => {
    const parsed = parseCliArgs([
      "/node",
      "/write-approved-candidates.ts",
      "--allowlist= cand-a , cand-b ",
      "--pending-queue=/tmp/queue.jsonl",
      "--decision-log=/tmp/log.jsonl",
    ]);
    expect(parsed.allowlist).toEqual(["cand-a", "cand-b"]);
  });

  test("fails closed on missing --allowlist", () => {
    expect(() =>
      parseCliArgs([
        "/node",
        "/write-approved-candidates.ts",
        "--pending-queue=/tmp/queue.jsonl",
        "--decision-log=/tmp/log.jsonl",
      ]),
    ).toThrow(CliArgError);
  });

  test("fails closed on empty --allowlist", () => {
    expect(() =>
      parseCliArgs([
        "/node",
        "/write-approved-candidates.ts",
        "--allowlist=",
        "--pending-queue=/tmp/queue.jsonl",
        "--decision-log=/tmp/log.jsonl",
      ]),
    ).toThrow(CliArgError);
  });

  test("fails closed on missing --pending-queue", () => {
    expect(() =>
      parseCliArgs([
        "/node",
        "/write-approved-candidates.ts",
        "--allowlist=cand-a",
        "--decision-log=/tmp/log.jsonl",
      ]),
    ).toThrow(CliArgError);
  });

  test("fails closed on missing --decision-log", () => {
    expect(() =>
      parseCliArgs([
        "/node",
        "/write-approved-candidates.ts",
        "--allowlist=cand-a",
        "--pending-queue=/tmp/queue.jsonl",
      ]),
    ).toThrow(CliArgError);
  });
});
