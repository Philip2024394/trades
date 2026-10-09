// scripts/nex-canonical/rule-5m-proof-6-abstention-safety.test.ts
//
// Rule 5m · Proof 6 · Abstention safety at the write boundary.
//
// SEALED CLAIM:
//   Zero AMBIGUOUS resolver verdict reaches the canonical write path.
//   precheckHandoff refuses any verdict with kind === "AMBIGUOUS" before
//   producing any plan.
//
// EVIDENCE BINDING:
//   See `docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md` · Proof 6.
//   Underlying guard: `scripts/nex-canonical/canonical-handoff.ts §9.8`
//   ("AMBIGUOUS always blocks · never any plan").
//
// SCOPE:
//   This proof pins the sealed Rule 5l / §10 invariant ("Ambiguous identity
//   means unresolved identity") at the exact code point where it matters:
//   the write-plan boundary. A regression here would be the most dangerous
//   kind of bug · a false MATCH on an AMBIGUOUS case.

import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import type {
  ApprovedCandidateHandoff,
  ResolverVerdict,
  SourceRegistryRow,
} from "./canonical-handoff";
import {
  HANDOFF_SCHEMA_VERSION,
  precheckHandoff,
} from "./canonical-handoff";
import type { Candidate } from "./generate-candidates";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures reproducing a minimal valid handoff shape
// ═════════════════════════════════════════════════════════════════════

function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") return JSON.stringify(obj);
  if (typeof obj === "boolean" || typeof obj === "string")
    return JSON.stringify(obj);
  if (Array.isArray(obj))
    return "[" + obj.map((e) => stableStringify(e)).join(",") + "]";
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            stableStringify((obj as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  }
  throw new Error("stableStringify: unsupported type");
}

const CANDIDATE: Candidate = {
  candidate_id: "amb-fixture-001",
  status: "pending_founder_review",
  entity_type: "food",
  country: "ID",
  identity: {
    name_canonical: "Ambiguous Fixture",
    aliases: [],
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
    ref: "amb-fixture-001-ref",
    internal_id: null,
  },
  risk_categories: ["R4"],
  selection_score: 0.5,
  selection_rationale: [
    { risk_category: "R4", contribution: 0.5, note: "forced ambiguous" },
  ],
  generation_source: {
    generator: "scripts/nex-canonical/generate-candidates.ts",
    generated_at: "2026-10-09T00:00:00.000Z",
    generation_run_id: "rule-5m-proof-6-run",
  },
  caveats: [],
};

const CANDIDATE_HASH = createHash("sha256")
  .update(stableStringify(CANDIDATE), "utf8")
  .digest("hex");

const REVIEW_PACKAGE = {
  schema_version: "review-package-v1" as const,
  packaged_at: "2026-10-09T00:00:00.000Z",
  candidates: [CANDIDATE],
  report: {},
  package_id: "placeholder",
};
REVIEW_PACKAGE.package_id = createHash("sha256")
  .update(
    stableStringify({
      schema_version: REVIEW_PACKAGE.schema_version,
      packaged_at: REVIEW_PACKAGE.packaged_at,
      candidates: REVIEW_PACKAGE.candidates,
      report: REVIEW_PACKAGE.report,
    }),
    "utf8",
  )
  .digest("hex");

const DECISION_RECORD_ID = createHash("sha256")
  .update("rule-5m-proof-6-decision", "utf8")
  .digest("hex");

const HANDOFF: ApprovedCandidateHandoff = {
  schema_version: HANDOFF_SCHEMA_VERSION,
  decision_record: {
    schema_version: "approval-v1",
    decision_record_id: DECISION_RECORD_ID,
    candidate_id: CANDIDATE.candidate_id,
    candidate_integrity_hash: CANDIDATE_HASH,
    review_package_id: REVIEW_PACKAGE.package_id,
    decision: "approve",
    decision_timestamp: "2026-10-09T00:00:00.000Z",
    founder_id: "test-founder",
    note: "Rule 5m proof 6 fixture",
    supersedes: null,
  } as never,
  candidate: CANDIDATE,
  review_package: REVIEW_PACKAGE as never,
};

const SOURCE_REGISTRY_ROW: SourceRegistryRow = {
  source_id: "nex_food_business_legacy",
  source_type: "directory_import",
  display_name: "NEX Food Business (legacy table)",
  can_collect: true,
  can_store: true,
  can_display: false,
  can_derive: true,
  can_redistribute: false,
  attribution_required: true,
};

// ═════════════════════════════════════════════════════════════════════
// §1 · AMBIGUOUS always blocks
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 6 · AMBIGUOUS verdict refuses to produce a plan", () => {
  test("single-competing AMBIGUOUS → ok=false, reason=resolver_ambiguous", () => {
    const verdict: ResolverVerdict = {
      kind: "AMBIGUOUS",
      competing: [
        { canonical_business_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", score: 0.72 },
        { canonical_business_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", score: 0.70 },
      ],
      best_score: 0.72,
    };
    const result = precheckHandoff({
      handoff: HANDOFF,
      resolver_verdict: verdict,
      source_registry_row: SOURCE_REGISTRY_ROW,
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("resolver_ambiguous");
    }
  });

  test("many-competing AMBIGUOUS → ok=false regardless of top-score magnitude", () => {
    const verdict: ResolverVerdict = {
      kind: "AMBIGUOUS",
      competing: Array.from({ length: 5 }, (_, i) => ({
        canonical_business_id: `${i}${i}${i}${i}${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}`,
        score: 0.99 - i * 0.001,
      })),
      best_score: 0.99,
    };
    const result = precheckHandoff({
      handoff: HANDOFF,
      resolver_verdict: verdict,
      source_registry_row: SOURCE_REGISTRY_ROW,
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("resolver_ambiguous");
    }
  });

  test("AMBIGUOUS blocks even when source_registry.can_derive=true", () => {
    // Guard: permission grants must NOT override §10 ambiguity safety.
    const permissiveSource: SourceRegistryRow = {
      ...SOURCE_REGISTRY_ROW,
      can_derive: true,
      can_display: true,
      can_redistribute: true,
    };
    const verdict: ResolverVerdict = {
      kind: "AMBIGUOUS",
      competing: [
        { canonical_business_id: "cccccccc-cccc-cccc-cccc-cccccccccccc", score: 0.8 },
        { canonical_business_id: "dddddddd-dddd-dddd-dddd-dddddddddddd", score: 0.79 },
      ],
      best_score: 0.8,
    };
    const result = precheckHandoff({
      handoff: HANDOFF,
      resolver_verdict: verdict,
      source_registry_row: permissiveSource,
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe("resolver_ambiguous");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · AMBIGUOUS never produces any kind of plan
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 6 · AMBIGUOUS never produces insert_new or merge_match", () => {
  test("result object has no `plan` field on AMBIGUOUS block", () => {
    const verdict: ResolverVerdict = {
      kind: "AMBIGUOUS",
      competing: [
        { canonical_business_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", score: 0.75 },
        { canonical_business_id: "ffffffff-ffff-ffff-ffff-ffffffffffff", score: 0.74 },
      ],
      best_score: 0.75,
    };
    const result = precheckHandoff({
      handoff: HANDOFF,
      resolver_verdict: verdict,
      source_registry_row: SOURCE_REGISTRY_ROW,
      current_canonical_row_if_match: null,
      existing_osm_collision_if_any: null,
    });
    expect(result.ok).toBe(false);
    expect((result as { plan?: unknown }).plan).toBeUndefined();
  });
});
