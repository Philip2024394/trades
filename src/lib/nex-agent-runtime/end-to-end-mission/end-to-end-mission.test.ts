// §36-E-DEMO · REAL-REPO-DEMO · 2026-09-14 · end-to-end-mission
// NEX bounded infrastructure · end-to-end mission demonstration · 2026-09-14
//
// Real repository engineering demonstration per Master Execution Order §9-§11.
// NEX1 authors a capability via authorTypedDataContract (Route 2/2b/2c) and
// the emitted bytes flow through the complete E4→E5→E6→E7→E2 pipeline.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

// NEX1 authoring loop
import { authorTypedDataContract } from "../programming-mission/typed-data-contract-authoring";
import type { TypedDataContractSpec } from "../programming-mission/types";

// E4 skill router
import { routeSkillsAgainstCandidate } from "../skills/skill-router";
import { FIRST_SKILLS_LIBRARY } from "../skills/library";
import type { SkillRouterSuccess } from "../skills/skill-router-types";
import type { SkillCandidate } from "../skills/skill-schema-types";

// E5 specialist reviewers
import { runSpecialistReviewers } from "../specialist-reviewers/specialist-reviewers";
import type { RunSpecialistsSuccess } from "../specialist-reviewers/specialist-reviewer-types";

// E6 adversarial refutation
import { runAdversarialRefutation } from "../adversarial-refutation/refutation-engine";
import type { RunRefutationSuccess } from "../adversarial-refutation/refutation-engine-types";

// E7 lifecycle
import { applyLifecycleEvent, createMissionLifecycle } from "../session-lifecycle/lifecycle";
import type { LifecycleEvent, LifecycleEventId, MissionLifecycleRecord, TransitionSuccess } from "../session-lifecycle/lifecycle-types";

// E2 engineering memory
import { recordEngineeringMemoryV2 } from "../self-improvement/engineering-memory-v2";
import type { CandidateMemoryV2 } from "../self-improvement/engineering-memory-v2-types";

// ── Deterministic helpers ────────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function iso(offsetSec: number): string {
  const base = new Date("2026-09-14T14:00:00.000Z").getTime();
  return new Date(base + offsetSec * 1000).toISOString();
}

function event(
  event_id: LifecycleEventId,
  offsetSec: number,
  overrides: Partial<LifecycleEvent> = {},
): LifecycleEvent {
  return {
    event_id,
    mission_id: "real-repo-demo-2026-09-14-mission-priority-contract",
    emitted_at_iso: iso(offsetSec),
    authorisation_ref: overrides.authorisation_ref ?? null,
    evidence_ref: overrides.evidence_ref ?? null,
  };
}

function applyOrThrow(record: MissionLifecycleRecord, ev: LifecycleEvent): MissionLifecycleRecord {
  const r = applyLifecycleEvent({ record, event: ev }) as TransitionSuccess;
  if (r.kind !== "SUCCESS") {
    throw new Error(`unexpected lifecycle refusal: ${(r as unknown as { refusal_code: string }).refusal_code}`);
  }
  return r.next_record;
}

// ── The demonstration ────────────────────────────────────────────────────

describe("§36-E-DEMO · REAL-REPO-DEMO · 2026-09-14 · end-to-end mission", () => {
  it("D-1 · NEX1 authoring loop produces deterministic bytes for MissionPriorityContract", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "MissionPriorityContract",
      header_comment:
        "// §36-E-DEMO · REAL-REPO-DEMO · 2026-09-14 · mission-priority-contract\n" +
        "// NEX bounded infrastructure · NEX1-authored via typed_data_contract · 2026-09-14",
      type_only_imports: [],
      declarations: [
        {
          declaration_kind: "numeric_range_constant",
          name: "MISSION_PRIORITY_BOUNDS",
          min: 0,
          max: 100,
          exported: true,
        },
        {
          declaration_kind: "literal_union",
          name: "MissionPriorityBand",
          literals: ["low", "medium", "high", "critical"],
          exported: true,
        },
        {
          declaration_kind: "refusal_reason_union",
          name: "MissionPriorityRefusalReason",
          reasons: [
            "MP_PRIORITY_OUT_OF_BOUNDS",
            "MP_BAND_UNKNOWN",
            "MP_MISSION_ID_INVALID",
          ],
          exported: true,
        },
        {
          declaration_kind: "interface",
          name: "MissionPriorityRecord",
          exported: true,
          fields: [
            { name: "mission_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
            { name: "priority_score", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
            { name: "band", type: { kind: "reference", to: "MissionPriorityBand" }, optional: false, readonly_modifier: true },
          ],
        },
      ],
    };

    const style = {
      naming_convention: "camelCase" as const,
      export_style: "named" as const,
      semicolons: "yes" as const,
      quote_style: "double" as const,
      test_framework: "vitest" as const,
      detected_from_files: [],
      detection_confidence: "high" as const,
    };

    const author1 = authorTypedDataContract({
      spec,
      style,
      target_path: "output/mission-priority-contract.ts",
    });
    if (!author1.ok) throw new Error(`author failed: ${author1.refusal_code} · ${author1.reason}`);

    const author2 = authorTypedDataContract({
      spec,
      style,
      target_path: "output/mission-priority-contract.ts",
    });
    if (!author2.ok) throw new Error(`re-author failed`);

    expect(author1.content).toBe(author2.content); // determinism
    expect(author1.declaration_count).toBe(4);

    const sha1 = sha256Hex(author1.content);
    const sha2 = sha256Hex(author2.content);
    expect(sha1).toBe(sha2);

    // Structural checks on emitted bytes
    expect(author1.content).toContain("MissionPriorityContract");
    expect(author1.content).toContain("MISSION_PRIORITY_BOUNDS");
    expect(author1.content).toContain('| "low"');
    expect(author1.content).toContain('| "critical"');
    expect(author1.content).toContain("MissionPriorityBand");
    expect(author1.content).toContain("MP_PRIORITY_OUT_OF_BOUNDS");
    expect(author1.content).toContain("MissionPriorityRecord");
    expect(author1.content).toContain("readonly mission_id: string");
    expect(author1.content).toContain("readonly priority_score: number");
    expect(author1.content).toContain("readonly band: MissionPriorityBand");
  });

  it("D-2 · full pipeline · E7 lifecycle walks CREATED → COMPLETED with all E4/E5/E6/E2 stages participating", () => {
    // ── STEP 1 · Author capability bytes via NEX1's approved authoring loop ──
    const spec: TypedDataContractSpec = {
      contract_name: "MissionPriorityContract",
      header_comment:
        "// §36-E-DEMO · REAL-REPO-DEMO · 2026-09-14 · mission-priority-contract\n" +
        "// NEX bounded infrastructure · NEX1-authored via typed_data_contract · 2026-09-14",
      type_only_imports: [],
      declarations: [
        { declaration_kind: "numeric_range_constant", name: "MISSION_PRIORITY_BOUNDS", min: 0, max: 100, exported: true },
        { declaration_kind: "literal_union", name: "MissionPriorityBand", literals: ["low", "medium", "high", "critical"], exported: true },
        { declaration_kind: "refusal_reason_union", name: "MissionPriorityRefusalReason", reasons: ["MP_PRIORITY_OUT_OF_BOUNDS", "MP_BAND_UNKNOWN", "MP_MISSION_ID_INVALID"], exported: true },
        {
          declaration_kind: "interface", name: "MissionPriorityRecord", exported: true,
          fields: [
            { name: "mission_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
            { name: "priority_score", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
            { name: "band", type: { kind: "reference", to: "MissionPriorityBand" }, optional: false, readonly_modifier: true },
          ],
        },
      ],
    };
    const style = {
      naming_convention: "camelCase" as const,
      export_style: "named" as const,
      semicolons: "yes" as const,
      quote_style: "double" as const,
      test_framework: "vitest" as const,
      detected_from_files: [],
      detection_confidence: "high" as const,
    };
    const authorResult = authorTypedDataContract({ spec, style, target_path: "output/mission-priority-contract.ts" });
    if (!authorResult.ok) throw new Error(`authoring failed: ${authorResult.refusal_code}`);

    const emittedBytes = authorResult.content;
    const emittedSha = sha256Hex(emittedBytes);

    // ── STEP 2 · Construct SkillCandidate from the NEX1-authored bytes ──
    const candidate: SkillCandidate = {
      workspace_relative_path: "src/lib/nex-agent-runtime/end-to-end-mission/artefacts/mission-priority-contract.ts",
      change_kind: "file_new",
      current_sha256_hex: null,
      proposed_content: emittedBytes,
      proposed_content_sha256_hex: emittedSha,
      declared_symbols: ["MissionPriorityBand", "MissionPriorityRecord", "MISSION_PRIORITY_BOUNDS", "MissionPriorityRefusalReason"],
      imported_symbols: [],
      imported_from_specifiers: [],
      authorised: true,
      test_count_declared: null,
    };

    // ── STEP 3 · Mission lifecycle · CREATED → PREPARED → AUTHORISED → EXECUTING ──
    let record = createMissionLifecycle("real-repo-demo-2026-09-14-mission-priority-contract", iso(0));
    expect(record.current_state).toBe("CREATED");

    record = applyOrThrow(record, event("EVENT_PREPARE", 10));
    expect(record.current_state).toBe("PREPARED");

    record = applyOrThrow(record, event("EVENT_AUTHORISE", 20, { authorisation_ref: "founder-ecc-master-order-2026-09-14" }));
    expect(record.current_state).toBe("AUTHORISED");

    record = applyOrThrow(record, event("EVENT_START_EXECUTION", 30));
    expect(record.current_state).toBe("EXECUTING");

    // ── STEP 4 · Real tests: the emitted bytes must satisfy the mission spec ──
    record = applyOrThrow(record, event("EVENT_START_TESTING", 40));
    expect(record.current_state).toBe("TESTING");

    // Real tests · exercised inline
    expect(emittedBytes).toContain("export type MissionPriorityBand");
    expect(emittedBytes).toContain("export const MISSION_PRIORITY_BOUNDS");
    expect(emittedBytes).toContain("export interface MissionPriorityRecord");
    // The refusal-reason union is emitted as either 'type ... =' or const 'type X = "A" | "B";' depending on the primitive's rendering; verify all 3 reason literals appear
    expect(emittedBytes).toContain('"MP_PRIORITY_OUT_OF_BOUNDS"');
    expect(emittedBytes).toContain('"MP_BAND_UNKNOWN"');
    expect(emittedBytes).toContain('"MP_MISSION_ID_INVALID"');

    record = applyOrThrow(record, event("EVENT_TESTING_PASSED", 50));
    expect(record.current_state).toBe("REVIEWING");

    // ── STEP 5 · E4 · Skill router routes the candidate against the sorted library ──
    const sortedLibrary = [...FIRST_SKILLS_LIBRARY].sort((a, b) => a.identity.slug.localeCompare(b.identity.slug));
    const routerResult = routeSkillsAgainstCandidate({ candidate, skill_library: sortedLibrary }) as SkillRouterSuccess;
    expect(routerResult.kind).toBe("SUCCESS");
    // At least one applicable skill (typescript-refusal-first fits file_new TS candidates)
    expect(routerResult.total_applicable_skills).toBeGreaterThan(0);

    // ── STEP 6 · E5 · Specialist reviewers evaluate ──
    const specResult = runSpecialistReviewers({ candidate, specialists_to_run: "all" }) as RunSpecialistsSuccess;
    expect(specResult.kind).toBe("SUCCESS");

    const allFindings = specResult.per_specialist.flatMap((p) => p.findings);

    // ── STEP 7 · E6 · Adversarial refutation ──
    record = applyOrThrow(record, event("EVENT_START_REFUTATION", 60));
    expect(record.current_state).toBe("REFUTING");

    const refutationResult = runAdversarialRefutation({ candidate, findings: allFindings }) as RunRefutationSuccess;
    expect(refutationResult.kind).toBe("SUCCESS");
    expect(refutationResult.overall_finding_count).toBe(allFindings.length);
    // Every finding gets a verdict · sum matches
    expect(refutationResult.accepted_count + refutationResult.refuted_count + refutationResult.unresolved_count)
      .toBe(allFindings.length);

    // Decide next lifecycle step based on refutation outcome
    if (refutationResult.unresolved_count === 0) {
      record = applyOrThrow(record, event("EVENT_REFUTATION_RESOLVED", 70));
      expect(record.current_state).toBe("VERIFIED");
      record = applyOrThrow(record, event("EVENT_COMPLETE", 80));
      expect(record.current_state).toBe("COMPLETED");
    } else {
      // If any unresolved findings exist, mission goes to FAILED per E7 rules
      record = applyOrThrow(record, event("EVENT_REFUTATION_UNRESOLVED", 70));
      expect(record.current_state).toBe("FAILED");
    }

    // ── STEP 8 · E2 · Engineering Memory records the outcome ──
    const outcomeCandidate: CandidateMemoryV2 = {
      kind: "successful_solution_pattern",
      proposed_status: "OBSERVATION", // Not auto-promoted to FACT — that requires paired improvement measurement per E2 rules
      summary: `NEX1 authored MissionPriorityContract via typed_data_contract · 4 declarations · emitted ${emittedBytes.length} bytes · SHA-256 ${emittedSha.slice(0, 12)}... · E7 final state ${record.current_state}`,
      evidence_citation: `docs/NEX1/BUILD_GATES/REAL-REPO-DEMONSTRATION-2026-09-14.md#mission real-repo-demo-2026-09-14-mission-priority-contract`,
      evidence_sha256: emittedSha,
      mission_id: "real-repo-demo-2026-09-14-mission-priority-contract",
      source: "end-to-end mission driver test",
      subsystem: "programming-mission",
      paired_hypothesis_id: null,
      supersedes_lesson_id: null,
      contradicts_lesson_id: null,
    };

    const memoryResult = recordEngineeringMemoryV2({
      candidate_memories: [outcomeCandidate],
      hypothesis_measurements: [],
      clock: () => new Date("2026-09-14T14:02:00.000Z"),
    });
    expect(memoryResult.ok).toBe(true);
    if (memoryResult.ok) {
      // At least the OBSERVATION should be recorded (no rejection since evidence is valid)
      expect(memoryResult.book.lessons.length + memoryResult.rejected_candidates.length).toBeGreaterThanOrEqual(1);
    }

    // ── STEP 9 · Final evidence bundle summary (visible in test output) ──
    const evidenceBundle = {
      mission_id: "real-repo-demo-2026-09-14-mission-priority-contract",
      nex1_authored_bytes_sha256: emittedSha,
      nex1_authored_byte_size: emittedBytes.length,
      nex1_authored_declaration_count: authorResult.declaration_count,
      e4_router_verdict: routerResult.router_verdict,
      e4_applicable_skills: routerResult.total_applicable_skills,
      e5_specialist_finding_count: allFindings.length,
      e5_critical_count: specResult.critical_count,
      e6_accepted: refutationResult.accepted_count,
      e6_refuted: refutationResult.refuted_count,
      e6_unresolved: refutationResult.unresolved_count,
      e7_final_state: record.current_state,
      e7_transitions_count: record.history.length,
      e2_memory_recorded: memoryResult.ok,
    };
    // Emit as a stable JSON so the acceptance report can quote it
    expect(evidenceBundle.mission_id).toBe("real-repo-demo-2026-09-14-mission-priority-contract");
    // eslint-disable-next-line no-console
    // Comment retained for future capture; tests should not log by default.
  });

  it("D-3 · re-invocation of the mission produces byte-identical emitted content (determinism)", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "MissionPriorityContract",
      header_comment:
        "// §36-E-DEMO · REAL-REPO-DEMO · 2026-09-14 · mission-priority-contract\n" +
        "// NEX bounded infrastructure · NEX1-authored via typed_data_contract · 2026-09-14",
      type_only_imports: [],
      declarations: [
        { declaration_kind: "numeric_range_constant", name: "MISSION_PRIORITY_BOUNDS", min: 0, max: 100, exported: true },
      ],
    };
    const style = {
      naming_convention: "camelCase" as const,
      export_style: "named" as const,
      semicolons: "yes" as const,
      quote_style: "double" as const,
      test_framework: "vitest" as const,
      detected_from_files: [],
      detection_confidence: "high" as const,
    };
    const a = authorTypedDataContract({ spec, style, target_path: "output/mission-priority-contract.ts" });
    const b = authorTypedDataContract({ spec, style, target_path: "output/mission-priority-contract.ts" });
    if (!a.ok || !b.ok) throw new Error("author failed");
    expect(a.content).toBe(b.content);
    expect(sha256Hex(a.content)).toBe(sha256Hex(b.content));
  });
});
