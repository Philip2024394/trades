// scripts/nex-canonical/bulk-approve-runner.test.ts
//
// Pure unit tests for the Bulk-Approval Runner.
// No DB · no network · no filesystem (all I/O-free pure core).

import { describe, expect, test } from "vitest";
import type { Candidate } from "./generate-candidates";
import { reviewCandidates } from "./candidate-reviewer";
import {
  buildReviewPackage,
  decideCandidate,
  parseDecisionLog,
  serializeDecisionLog,
  type DecisionRecord,
  type ReviewPackage,
} from "./candidate-approval";
import type { PendingReviewEntry } from "./durable-approval-queue";
import {
  applicableAnomaliesForCandidate,
  applyBulkApprovals,
  BulkApprovalInputError,
  computeBatchId,
  parseBulkApprovalInput,
  parseCliArgs,
  serializeNewDecisionsForAppend,
  type BulkApprovalInput,
} from "./bulk-approve-runner";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures
// ═════════════════════════════════════════════════════════════════════

const T_PACKAGED = "2026-10-08T12:00:00.000Z";
const T_ENQUEUED = "2026-10-08T12:05:00.000Z";
const T_DECISION = "2026-10-08T15:00:00.000Z";
const T_DECISION_LATER = "2026-10-08T16:00:00.000Z";

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
      generation_run_id: "nex-cand-bulk-test-2026-10-08",
    },
    caveats: [],
  };
  return { ...base, ...overrides } as Candidate;
}

function pkgOf(candidates: readonly Candidate[]): ReviewPackage {
  const report = reviewCandidates(candidates);
  return buildReviewPackage({
    candidates,
    report,
    packagedAt: T_PACKAGED,
  });
}

function pendingEntry(
  pkg: ReviewPackage,
  candidate_id: string,
): PendingReviewEntry {
  return {
    schema_version: "pending-review-v1",
    candidate_id,
    review_package_id: pkg.package_id,
    review_package: pkg,
    enqueued_at: T_ENQUEUED,
  };
}

function input(
  decisions: readonly BulkApprovalInput["decisions"][number][],
  overrides: Partial<Omit<BulkApprovalInput, "decisions">> = {},
): BulkApprovalInput {
  return {
    batch_name: overrides.batch_name ?? "pilot-1",
    founder_id: overrides.founder_id ?? "philip-bulk-pilot",
    decision_timestamp: overrides.decision_timestamp ?? T_DECISION,
    decisions,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Happy path · all decided
// ═════════════════════════════════════════════════════════════════════

describe("applyBulkApprovals · happy path", () => {
  test("decides every candidate when all are in queue and none prior-decided", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const c = cand({ candidate_id: "cand-c" });
    const pkg = pkgOf([a, b, c]);

    const { result, newDecisions } = applyBulkApprovals({
      input: input([
        { candidate_id: "cand-a", decision: "approve", founder_note: "yes" },
        { candidate_id: "cand-b", decision: "reject", founder_note: "no" },
        { candidate_id: "cand-c", decision: "approve", founder_note: "yes" },
      ]),
      pendingQueue: [
        pendingEntry(pkg, "cand-a"),
        pendingEntry(pkg, "cand-b"),
        pendingEntry(pkg, "cand-c"),
      ],
      priorDecisions: [],
    });

    expect(result.summary).toEqual({
      total: 3,
      decided: 3,
      skipped_not_in_queue: 0,
      skipped_already_decided: 0,
      skipped_validation_failed: 0,
    });
    expect(newDecisions).toHaveLength(3);
    expect(result.outcomes.every((o) => o.outcome === "decided")).toBe(true);
    // Each new DecisionRecord has a 64-hex content hash
    for (const r of newDecisions) {
      expect(/^[a-f0-9]{64}$/.test(r.decision_record_id)).toBe(true);
      expect(r.schema_version).toBe("decision-v1");
      expect(r.founder_id).toBe("philip-bulk-pilot");
      expect(r.decision_timestamp).toBe(T_DECISION);
    }
    const bRecord = newDecisions.find((r) => r.candidate_id === "cand-b");
    expect(bRecord?.decision).toBe("reject");
  });

  test("preserves the batch order in newDecisions", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkg = pkgOf([a, b]);

    const { newDecisions } = applyBulkApprovals({
      input: input([
        { candidate_id: "cand-b", decision: "approve", founder_note: "b first" },
        { candidate_id: "cand-a", decision: "approve", founder_note: "a second" },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a"), pendingEntry(pkg, "cand-b")],
      priorDecisions: [],
    });

    expect(newDecisions.map((r) => r.candidate_id)).toEqual([
      "cand-b",
      "cand-a",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Skips · not in queue · already decided
// ═════════════════════════════════════════════════════════════════════

describe("applyBulkApprovals · skips", () => {
  test("skips candidate_id that is not in the pending queue", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);
    const { result, newDecisions } = applyBulkApprovals({
      input: input([
        { candidate_id: "cand-missing", decision: "approve", founder_note: "x" },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a")],
      priorDecisions: [],
    });
    expect(newDecisions).toHaveLength(0);
    expect(result.summary.decided).toBe(0);
    expect(result.summary.skipped_not_in_queue).toBe(1);
    expect(result.outcomes[0].outcome).toBe("not_in_queue");
    expect(result.outcomes[0].reason).toMatch(/not present in the pending-review queue/);
  });

  test("skips candidate that already has a current DecisionRecord", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);

    // Produce a prior DecisionRecord via the sealed path (so its hash
    // is valid and findDecisionForCandidate accepts it).
    const prior = decideCandidate({
      package: pkg,
      candidateId: "cand-a",
      decision: "defer",
      founderId: "philip-prior",
      founderNote: "earlier deferral",
      acknowledgedAnomalyRules: applicableAnomaliesForCandidate(
        pkg,
        "cand-a",
      ).map((x) => x.rule),
      decisionTimestamp: T_DECISION,
      supersedes: null,
    });

    const { result, newDecisions } = applyBulkApprovals({
      input: input(
        [
          { candidate_id: "cand-a", decision: "approve", founder_note: "override" },
        ],
        { decision_timestamp: T_DECISION_LATER },
      ),
      pendingQueue: [pendingEntry(pkg, "cand-a")],
      priorDecisions: [prior],
    });

    expect(newDecisions).toHaveLength(0);
    expect(result.summary.skipped_already_decided).toBe(1);
    const o = result.outcomes[0];
    expect(o.outcome).toBe("already_decided");
    if (o.outcome === "already_decided") {
      expect(o.decision_record_id).toBe(prior.decision_record_id);
      expect(o.reason).toMatch(/non-superseded\) DecisionRecord already exists/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Mixed batch · idempotence
// ═════════════════════════════════════════════════════════════════════

describe("applyBulkApprovals · mixed and idempotent", () => {
  test("handles a mixed batch with decided + not_in_queue + already_decided", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkg = pkgOf([a, b]);
    const prior = decideCandidate({
      package: pkg,
      candidateId: "cand-b",
      decision: "defer",
      founderId: "philip-prior",
      founderNote: "earlier",
      acknowledgedAnomalyRules: applicableAnomaliesForCandidate(pkg, "cand-b").map((x) => x.rule),
      decisionTimestamp: T_DECISION,
      supersedes: null,
    });

    const { result, newDecisions } = applyBulkApprovals({
      input: input([
        { candidate_id: "cand-a", decision: "approve", founder_note: "yes" },
        { candidate_id: "cand-b", decision: "approve", founder_note: "retry" },
        { candidate_id: "cand-missing", decision: "approve", founder_note: "x" },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a"), pendingEntry(pkg, "cand-b")],
      priorDecisions: [prior],
    });

    expect(newDecisions).toHaveLength(1);
    expect(newDecisions[0].candidate_id).toBe("cand-a");
    expect(result.summary).toEqual({
      total: 3,
      decided: 1,
      skipped_not_in_queue: 1,
      skipped_already_decided: 1,
      skipped_validation_failed: 0,
    });
  });

  test("is idempotent across replay · second run returns all already_decided", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkg = pkgOf([a, b]);

    const batch = input([
      { candidate_id: "cand-a", decision: "approve", founder_note: "yes" },
      { candidate_id: "cand-b", decision: "approve", founder_note: "yes" },
    ]);

    const first = applyBulkApprovals({
      input: batch,
      pendingQueue: [pendingEntry(pkg, "cand-a"), pendingEntry(pkg, "cand-b")],
      priorDecisions: [],
    });
    expect(first.result.summary.decided).toBe(2);

    const second = applyBulkApprovals({
      input: batch,
      pendingQueue: [pendingEntry(pkg, "cand-a"), pendingEntry(pkg, "cand-b")],
      priorDecisions: first.newDecisions,
    });
    expect(second.newDecisions).toHaveLength(0);
    expect(second.result.summary).toEqual({
      total: 2,
      decided: 0,
      skipped_not_in_queue: 0,
      skipped_already_decided: 2,
      skipped_validation_failed: 0,
    });
    // The IDs reported for the "already_decided" outcomes point at the
    // records produced in the first run · operator can audit chain.
    const firstA = first.newDecisions.find((r) => r.candidate_id === "cand-a");
    const secondA = second.result.outcomes.find((o) => o.candidate_id === "cand-a");
    expect(secondA?.outcome).toBe("already_decided");
    if (secondA?.outcome === "already_decided") {
      expect(secondA.decision_record_id).toBe(firstA?.decision_record_id);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Validation failure path · thrown error from decideCandidate
// ═════════════════════════════════════════════════════════════════════

describe("applyBulkApprovals · validation failure", () => {
  test("records validation_failed when the sealed decideCandidate rejects a note", () => {
    const a = cand({ candidate_id: "cand-a" });
    const pkg = pkgOf([a]);
    const { result, newDecisions } = applyBulkApprovals({
      input: input([
        {
          candidate_id: "cand-a",
          decision: "approve",
          // Password-like token in the note · sealed decideCandidate's
          // credential scanner refuses it (NoteSecretsLeakError).
          founder_note: 'reviewed · password="superlongsecretpass123"',
        },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a")],
      priorDecisions: [],
    });
    expect(newDecisions).toHaveLength(0);
    expect(result.summary.skipped_validation_failed).toBe(1);
    expect(result.outcomes[0].outcome).toBe("validation_failed");
  });

  test("continues processing after a validation failure in the middle of the batch", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkg = pkgOf([a, b]);
    const { result, newDecisions } = applyBulkApprovals({
      input: input([
        { candidate_id: "cand-a", decision: "approve", founder_note: "ok" },
        {
          candidate_id: "cand-b",
          decision: "approve",
          founder_note: 'reviewed · password="superlongsecretpass123"',
        },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a"), pendingEntry(pkg, "cand-b")],
      priorDecisions: [],
    });
    expect(newDecisions).toHaveLength(1);
    expect(newDecisions[0].candidate_id).toBe("cand-a");
    expect(result.outcomes.map((o) => o.outcome)).toEqual([
      "decided",
      "validation_failed",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Anomaly acknowledgment is captured in the outcome + record
// ═════════════════════════════════════════════════════════════════════

describe("applyBulkApprovals · anomaly acknowledgment", () => {
  test("auto-acknowledged rules match what is persisted in the DecisionRecord", () => {
    // selection_score == 1 triggers the sealed `score_boundary`
    // anomaly (severity "flag" · approvable with acknowledgment).
    // We use `score_boundary` rather than a bug_suspected rule
    // because the sealed `decideCandidate` refuses to APPROVE
    // candidates carrying a bug_suspected anomaly — the correct
    // sealed workflow for bug_suspected is "fix the generator and
    // re-run", not acknowledge-and-approve. This test asserts that
    // for `flag`-class applicable anomalies, the runner's
    // auto-acknowledgment matches what the sealed DecisionRecord
    // persists.
    const a = cand({ candidate_id: "cand-a", selection_score: 1 });
    const pkg = pkgOf([a]);
    const applicable = applicableAnomaliesForCandidate(pkg, "cand-a");
    expect(applicable.length).toBeGreaterThan(0);
    const expectedRules = applicable.map((x) => x.rule);
    expect(expectedRules).toContain("score_boundary");

    const { newDecisions, result } = applyBulkApprovals({
      input: input([
        {
          candidate_id: "cand-a",
          decision: "approve",
          founder_note: "boundary score · reviewed · intentional",
        },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a")],
      priorDecisions: [],
    });

    expect(newDecisions).toHaveLength(1);
    expect([...newDecisions[0].acknowledged_anomaly_rules].sort()).toEqual(
      [...expectedRules].sort(),
    );
    const outcome = result.outcomes[0];
    if (outcome.outcome === "decided") {
      expect([...outcome.acknowledged_anomaly_rules].sort()).toEqual(
        [...expectedRules].sort(),
      );
    } else {
      throw new Error(`expected decided outcome · got ${outcome.outcome}`);
    }
  });

  test("bug_suspected anomalies cannot be approved via bulk-approve · outcome is validation_failed", () => {
    // The sealed `decideCandidate` refuses approve on any
    // bug_suspected applicable anomaly. The runner surfaces this
    // as outcome `validation_failed` with the sealed error name in
    // the reason · the operator must fix the generator and
    // re-queue, not force the approval through this runner. This
    // test pins that contract.
    const a = cand({ candidate_id: "cand-a", risk_categories: [] });
    const pkg = pkgOf([a]);
    // zero_risk_categories is bug_suspected
    const applicable = applicableAnomaliesForCandidate(pkg, "cand-a");
    expect(applicable.some((x) => x.rule === "zero_risk_categories")).toBe(true);

    const { newDecisions, result } = applyBulkApprovals({
      input: input([
        {
          candidate_id: "cand-a",
          decision: "approve",
          founder_note: "ok",
        },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a")],
      priorDecisions: [],
    });
    expect(newDecisions).toHaveLength(0);
    expect(result.summary.skipped_validation_failed).toBe(1);
    if (result.outcomes[0].outcome !== "validation_failed") {
      throw new Error(
        `expected validation_failed · got ${result.outcomes[0].outcome}`,
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · serializeNewDecisionsForAppend is parse-stable
// ═════════════════════════════════════════════════════════════════════

describe("serializeNewDecisionsForAppend", () => {
  test("round-trips through parseDecisionLog", () => {
    const a = cand({ candidate_id: "cand-a" });
    const b = cand({ candidate_id: "cand-b" });
    const pkg = pkgOf([a, b]);
    const { newDecisions } = applyBulkApprovals({
      input: input([
        { candidate_id: "cand-a", decision: "approve", founder_note: "ok" },
        { candidate_id: "cand-b", decision: "reject", founder_note: "no" },
      ]),
      pendingQueue: [pendingEntry(pkg, "cand-a"), pendingEntry(pkg, "cand-b")],
      priorDecisions: [],
    });
    const tail = serializeNewDecisionsForAppend(newDecisions);
    const roundTripped = parseDecisionLog(tail);
    expect(roundTripped.length).toBe(2);
    const ids1 = new Set(newDecisions.map((r) => r.decision_record_id));
    const ids2 = new Set(roundTripped.map((r) => r.decision_record_id));
    expect(ids2).toEqual(ids1);
    // Serializing then re-serializing the parsed records is byte-identical.
    expect(serializeDecisionLog(roundTripped)).toBe(tail);
  });

  test("empty newDecisions produces empty string", () => {
    expect(serializeNewDecisionsForAppend([])).toBe("");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Input parsing · fail-closed
// ═════════════════════════════════════════════════════════════════════

describe("parseBulkApprovalInput", () => {
  test("accepts a well-formed minimal batch", () => {
    const parsed = parseBulkApprovalInput(
      JSON.stringify({
        batch_name: "pilot-1",
        founder_id: "philip",
        decision_timestamp: T_DECISION,
        decisions: [
          { candidate_id: "cand-a", decision: "approve", founder_note: "yes" },
        ],
      }),
    );
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.decisions[0].decision).toBe("approve");
  });

  test("rejects unknown top-level fields", () => {
    expect(() =>
      parseBulkApprovalInput(
        JSON.stringify({
          batch_name: "pilot-1",
          founder_id: "philip",
          decision_timestamp: T_DECISION,
          decisions: [],
          extra: 1,
        }),
      ),
    ).toThrow(BulkApprovalInputError);
  });

  test("rejects unknown per-decision fields", () => {
    expect(() =>
      parseBulkApprovalInput(
        JSON.stringify({
          batch_name: "pilot-1",
          founder_id: "philip",
          decision_timestamp: T_DECISION,
          decisions: [
            {
              candidate_id: "cand-a",
              decision: "approve",
              founder_note: null,
              typo_field: true,
            },
          ],
        }),
      ),
    ).toThrow(BulkApprovalInputError);
  });

  test("rejects decision value outside the sealed enum", () => {
    expect(() =>
      parseBulkApprovalInput(
        JSON.stringify({
          batch_name: "pilot-1",
          founder_id: "philip",
          decision_timestamp: T_DECISION,
          decisions: [
            { candidate_id: "cand-a", decision: "accept", founder_note: null },
          ],
        }),
      ),
    ).toThrow(/approve.*reject.*defer/);
  });

  test("rejects malformed JSON", () => {
    expect(() => parseBulkApprovalInput("{not-json")).toThrow(BulkApprovalInputError);
  });

  test("accepts null founder_note", () => {
    const parsed = parseBulkApprovalInput(
      JSON.stringify({
        batch_name: "pilot-1",
        founder_id: "philip",
        decision_timestamp: T_DECISION,
        decisions: [
          { candidate_id: "cand-a", decision: "approve", founder_note: null },
        ],
      }),
    );
    expect(parsed.decisions[0].founder_note).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · CLI arg parsing + batch id
// ═════════════════════════════════════════════════════════════════════

describe("parseCliArgs", () => {
  test("accepts exactly three positional paths after node + script", () => {
    const parsed = parseCliArgs([
      "/node",
      "/scripts/.../bulk-approve-runner.ts",
      "/tmp/batch.json",
      "/tmp/queue.jsonl",
      "/tmp/log.jsonl",
    ]);
    expect(parsed.batchInputPath).toBe("/tmp/batch.json");
    expect(parsed.pendingQueuePath).toBe("/tmp/queue.jsonl");
    expect(parsed.decisionLogPath).toBe("/tmp/log.jsonl");
  });

  test("fails closed on missing args", () => {
    expect(() => parseCliArgs(["/node", "/script"])).toThrow(/usage/);
    expect(() =>
      parseCliArgs(["/node", "/script", "a.json", "b.jsonl"]),
    ).toThrow(/usage/);
  });
});

describe("computeBatchId", () => {
  test("is content-addressed and stable across identical inputs", () => {
    const batch = input([
      { candidate_id: "cand-a", decision: "approve", founder_note: "ok" },
    ]);
    const batchDup = input([
      { candidate_id: "cand-a", decision: "approve", founder_note: "ok" },
    ]);
    const id1 = computeBatchId(batch);
    const id2 = computeBatchId(batchDup);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-f0-9]{16}$/);
  });

  test("changes when any field changes", () => {
    const a = computeBatchId(
      input([{ candidate_id: "cand-a", decision: "approve", founder_note: "x" }]),
    );
    const b = computeBatchId(
      input([{ candidate_id: "cand-a", decision: "reject", founder_note: "x" }]),
    );
    expect(a).not.toBe(b);
  });
});
