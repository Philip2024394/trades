// §36-D-B · ROUTE-R1B · 2026-09-14 · mission-planner
//
// Tests for the pure-function mission-planner primitive.
// Includes MP-I-1 · the critical integration test that proves
// R1a repo-scan → R1b mission-planner → Route 2b/2c typed_data_contract works end-to-end.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import { planMission, planMissionWithFullMap } from "../mission-planner";
import type {
  MissionPlanDocument,
  MissionPlannerRequest,
  MissionPlanResult,
  MissionPlanFailure,
} from "../mission-planner-types";
import { repoScan } from "../repo-scan";
import { authorTypedDataContract } from "../../programming-mission/typed-data-contract-authoring";
import type {
  TypedDataContractSpec,
  StyleProfile,
} from "../../programming-mission/types";
import type { RepositoryMap } from "../repo-scan-types";

// ── Helpers ────────────────────────────────────────────────────────────

function asSuccess(r: unknown): MissionPlanResult {
  if (!r || typeof r !== "object" || (r as { ok?: boolean }).ok !== true) {
    throw new Error(`expected success, got: ${JSON.stringify(r).slice(0, 500)}`);
  }
  return r as MissionPlanResult;
}
function asFailure(r: unknown): MissionPlanFailure {
  if (!r || typeof r !== "object" || (r as { ok?: boolean }).ok !== false) {
    throw new Error(`expected failure, got: ${JSON.stringify(r).slice(0, 500)}`);
  }
  return r as MissionPlanFailure;
}
function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ── Simple hint · single-file interface capability ─────────────────────

function simpleHint(contractName: string): TypedDataContractSpec {
  return {
    contract_name: contractName,
    header_comment: "",
    type_only_imports: [],
    declarations: [
      {
        declaration_kind: "interface",
        name: contractName,
        exported: true,
        fields: [
          { name: "value", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
    ],
  };
}

function baseMissionPlan(overrides: Partial<MissionPlanDocument> = {}): MissionPlanDocument {
  return {
    mission_id: "MP_TEST_1",
    objective: "Test mission",
    target_directory: "src/lib/capability-labs/mp-test-lab/",
    files_to_produce: [
      { path: "example.ts", kind: "typed_data_contract", contract_spec_hint: simpleHint("Example") },
    ],
    type_only_import_hints: [],
    runtime_import_hints: [],
    protected_paths_declared: [],
    test_targets: [],
    rollback_strategy: "delete_new_files",
    ...overrides,
  };
}

const EMPTY_MAP_SHA = "0000000000000000000000000000000000000000000000000000000000000000";

function baseRequest(overrides: Partial<MissionPlannerRequest> = {}, mapSha = EMPTY_MAP_SHA): MissionPlannerRequest {
  return {
    mission_plan: baseMissionPlan(),
    repository_map_sha256: mapSha,
    scan_sha256_expected: mapSha,
    constraints: { protected_paths: [], max_files: 32 },
    ...overrides,
  };
}

// ── Group 1 · Positive ─────────────────────────────────────────────────

describe("R1b · mission-planner · positive", () => {
  it("MPP-1 · minimal valid mission produces MissionPlanResult with one PlannedFile", () => {
    const r = asSuccess(planMission({ request: baseRequest() }));
    expect(r.mission_id).toBe("MP_TEST_1");
    expect(r.objective).toBe("Test mission");
    expect(r.files_planned.length).toBe(1);
    expect(r.files_planned[0].kind).toBe("typed_data_contract");
    expect(r.files_planned[0].path).toBe("src/lib/capability-labs/mp-test-lab/example.ts");
    expect(r.files_planned[0].typed_data_contract_spec).toBeDefined();
    expect(r.planner_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("MPP-2 · planned_file spec is exactly the hint (byte-identical)", () => {
    const hint = simpleHint("Example");
    const r = asSuccess(planMission({ request: baseRequest() }));
    expect(r.files_planned[0].typed_data_contract_spec).toEqual(hint);
  });

  it("MPP-3 · test_scaffold kind gets mai_supplies_note (not authored by NEX1)", () => {
    const mp = baseMissionPlan({
      files_to_produce: [
        { path: "example.ts", kind: "typed_data_contract", contract_spec_hint: simpleHint("Example") },
        { path: "__tests__/example.test.ts", kind: "test_scaffold" },
      ],
    });
    const r = asSuccess(planMission({ request: baseRequest({ mission_plan: mp }) }));
    const testFile = r.files_planned.find((f) => f.kind === "test_scaffold");
    expect(testFile).toBeDefined();
    expect(testFile!.mai_supplies_note).toContain("MAI supplies");
    expect(testFile!.typed_data_contract_spec).toBeUndefined();
  });

  it("MPP-4 · governance_doc kind gets mai_supplies_note", () => {
    const mp = baseMissionPlan({
      files_to_produce: [
        { path: "example.ts", kind: "typed_data_contract", contract_spec_hint: simpleHint("Example") },
        { path: "GOVERNANCE.md", kind: "governance_doc" },
      ],
    });
    const r = asSuccess(planMission({ request: baseRequest({ mission_plan: mp }) }));
    const gov = r.files_planned.find((f) => f.kind === "governance_doc");
    expect(gov).toBeDefined();
    expect(gov!.mai_supplies_note).toContain("governance doc");
  });

  it("MPP-5 · target_directory under nex-agent-runtime accepted", () => {
    const mp = baseMissionPlan({ target_directory: "src/lib/nex-agent-runtime/example-cap/" });
    const r = asSuccess(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.files_planned[0].path).toBe("src/lib/nex-agent-runtime/example-cap/example.ts");
  });

  it("MPP-6 · rollback plan includes files_to_delete_on_rollback matching planned files", () => {
    const r = asSuccess(planMission({ request: baseRequest() }));
    expect(r.rollback_plan.strategy).toBe("delete_new_files");
    expect(r.rollback_plan.files_to_delete_on_rollback).toContain("src/lib/capability-labs/mp-test-lab/example.ts");
  });

  it("MPP-7 · dependencies extracted from spec_hint's type_only_imports", () => {
    const hint: TypedDataContractSpec = {
      contract_name: "Consumer",
      header_comment: "",
      type_only_imports: [{ symbol: "Producer", from_specifier: "./producer" }],
      declarations: [
        { declaration_kind: "type_alias", name: "Alias", exported: true, aliased_to: { kind: "reference", to: "Producer" } },
      ],
    };
    const mp = baseMissionPlan({ files_to_produce: [{ path: "consumer.ts", kind: "typed_data_contract", contract_spec_hint: hint }] });
    const r = asSuccess(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.dependencies.length).toBeGreaterThan(0);
    const dep = r.dependencies.find((d) => d.imports_symbol === "Producer");
    expect(dep).toBeDefined();
    expect(dep!.is_type_only).toBe(true);
    expect(dep!.from_specifier).toBe("./producer");
  });

  it("MPP-8 · test_plan categorises groups (positive · negative · regression)", () => {
    const mp = baseMissionPlan({
      test_targets: [
        {
          test_file_path: "__tests__/example.test.ts",
          test_group_names: ["positive · valid input", "negative · rejection", "regression · baseline preserved"],
          expected_test_count_min: 3,
        },
      ],
    });
    const r = asSuccess(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.test_plan.positive_test_targets.length).toBe(1);
    expect(r.test_plan.negative_test_targets.length).toBe(1);
    expect(r.test_plan.regression_targets.length).toBe(1);
    expect(r.test_plan.total_target).toBe(3);
  });
});

// ── Group 2 · Determinism ──────────────────────────────────────────────

describe("R1b · mission-planner · determinism", () => {
  it("MPD-1 · same request twice → byte-identical result", () => {
    const a = asSuccess(planMission({ request: baseRequest() }));
    const b = asSuccess(planMission({ request: baseRequest() }));
    expect(sha(JSON.stringify(a))).toBe(sha(JSON.stringify(b)));
  });

  it("MPD-2 · planner_sha256 stable across runs", () => {
    const a = asSuccess(planMission({ request: baseRequest() }));
    const b = asSuccess(planMission({ request: baseRequest() }));
    expect(a.planner_sha256).toBe(b.planner_sha256);
  });

  it("MPD-3 · different mission_id → different planner_sha256", () => {
    const a = asSuccess(planMission({ request: baseRequest() }));
    const mp2 = baseMissionPlan({ mission_id: "MP_TEST_2" });
    const b = asSuccess(planMission({ request: baseRequest({ mission_plan: mp2 }) }));
    expect(a.planner_sha256).not.toBe(b.planner_sha256);
  });
});

// ── Group 3 · Scan-sha256 guard ────────────────────────────────────────

describe("R1b · mission-planner · scan-sha256 guard", () => {
  it("MPS-1 · scan_sha256_expected mismatch → MP_SCAN_SHA256_MISMATCH", () => {
    const req: MissionPlannerRequest = {
      mission_plan: baseMissionPlan(),
      repository_map_sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scan_sha256_expected: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      constraints: { protected_paths: [], max_files: 32 },
    };
    const r = asFailure(planMission({ request: req }));
    expect(r.refusal_code).toBe("MP_SCAN_SHA256_MISMATCH");
  });

  it("MPS-2 · planMissionWithFullMap checks map's scan_sha256 against request expected", () => {
    const map: RepositoryMap = { root_paths: [], file_count: 0, files: [], symbols: [], imports: [], scan_sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" };
    const req = baseRequest({}, "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd");
    const r = asFailure(planMissionWithFullMap({ request: req, repository_map: map }));
    expect(r.refusal_code).toBe("MP_SCAN_SHA256_MISMATCH");
  });
});

// ── Group 4 · Grammar refusal ──────────────────────────────────────────

describe("R1b · mission-planner · grammar refusal", () => {
  it("MPG-1 · unknown declaration_kind in spec_hint → MP_UNKNOWN_DECLARATION_KIND", () => {
    const badHint = { ...simpleHint("Bad"), declarations: [{ declaration_kind: "arbitrary_code", name: "Bad", exported: true } as unknown as TypedDataContractSpec["declarations"][0]] };
    const mp = baseMissionPlan({ files_to_produce: [{ path: "bad.ts", kind: "typed_data_contract", contract_spec_hint: badHint as TypedDataContractSpec }] });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_UNKNOWN_DECLARATION_KIND");
  });

  it("MPG-2 · missing spec_hint for typed_data_contract → MP_MISSING_SPEC_HINT", () => {
    const mp = baseMissionPlan({ files_to_produce: [{ path: "example.ts", kind: "typed_data_contract" }] });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_MISSING_SPEC_HINT");
  });

  it("MPG-3 · duplicate file path → MP_DUPLICATE_FILE_PATH", () => {
    const mp = baseMissionPlan({
      files_to_produce: [
        { path: "example.ts", kind: "typed_data_contract", contract_spec_hint: simpleHint("A") },
        { path: "example.ts", kind: "typed_data_contract", contract_spec_hint: simpleHint("B") },
      ],
    });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_DUPLICATE_FILE_PATH");
  });

  it("MPG-4 · empty files_to_produce → MP_EMPTY_FILES_TO_PRODUCE", () => {
    const mp = baseMissionPlan({ files_to_produce: [] });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_EMPTY_FILES_TO_PRODUCE");
  });

  it("MPG-5 · unknown file kind → MP_INVALID_FILE_KIND", () => {
    const mp = { ...baseMissionPlan(), files_to_produce: [{ path: "x.ts", kind: "arbitrary" as unknown as "typed_data_contract" }] };
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_FILE_KIND");
  });

  it("MPG-6 · malformed spec_hint (missing contract_name) → MP_INVALID_SPEC_HINT_GRAMMAR", () => {
    const badHint = { header_comment: "", type_only_imports: [], declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }] } as unknown as TypedDataContractSpec;
    const mp = baseMissionPlan({ files_to_produce: [{ path: "x.ts", kind: "typed_data_contract", contract_spec_hint: badHint }] });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_SPEC_HINT_GRAMMAR");
  });

  it("MPG-7 · empty declarations in spec_hint → MP_INVALID_SPEC_HINT_GRAMMAR", () => {
    const badHint: TypedDataContractSpec = { contract_name: "X", header_comment: "", type_only_imports: [], declarations: [] };
    const mp = baseMissionPlan({ files_to_produce: [{ path: "x.ts", kind: "typed_data_contract", contract_spec_hint: badHint }] });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_SPEC_HINT_GRAMMAR");
  });
});

// ── Group 5 · Target-directory refusal ─────────────────────────────────

describe("R1b · mission-planner · target-directory refusal", () => {
  it("MPT-1 · target_directory outside approved prefix → MP_INVALID_TARGET_DIRECTORY", () => {
    const mp = baseMissionPlan({ target_directory: "scripts/hack/" });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_TARGET_DIRECTORY");
  });

  it("MPT-2 · target_directory absolute path → MP_INVALID_TARGET_DIRECTORY", () => {
    const mp = baseMissionPlan({ target_directory: "/etc/passwd/" });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_TARGET_DIRECTORY");
  });

  it("MPT-3 · target_directory with traversal → MP_INVALID_TARGET_DIRECTORY", () => {
    const mp = baseMissionPlan({ target_directory: "src/lib/capability-labs/../../etc/" });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_TARGET_DIRECTORY");
  });

  it("MPT-4 · target_directory with backslash → MP_INVALID_TARGET_DIRECTORY", () => {
    const mp = baseMissionPlan({ target_directory: "src\\lib\\capability-labs\\test\\" });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_TARGET_DIRECTORY");
  });

  it("MPT-5 · target_directory exactly equal to approved prefix (no lab name) → MP_INVALID_TARGET_DIRECTORY", () => {
    const mp = baseMissionPlan({ target_directory: "src/lib/capability-labs/" });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_TARGET_DIRECTORY");
  });
});

// ── Group 6 · Rollback / mission_id / objective validation ─────────────

describe("R1b · mission-planner · other validation", () => {
  it("MPV-1 · empty mission_id → MP_INVALID_MISSION_ID", () => {
    const mp = baseMissionPlan({ mission_id: "" });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_MISSION_ID");
  });

  it("MPV-2 · empty objective → MP_INVALID_OBJECTIVE", () => {
    const mp = baseMissionPlan({ objective: "" });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_OBJECTIVE");
  });

  it("MPV-3 · unknown rollback_strategy → MP_INVALID_ROLLBACK_STRATEGY", () => {
    const mp = { ...baseMissionPlan(), rollback_strategy: "arbitrary_reversal" as unknown as MissionPlanDocument["rollback_strategy"] };
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_ROLLBACK_STRATEGY");
  });

  it("MPV-4 · malformed protected_paths_declared → MP_INVALID_PROTECTED_PATH_LIST", () => {
    const mp = baseMissionPlan({ protected_paths_declared: ["../escape"] });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_INVALID_PROTECTED_PATH_LIST");
  });

  it("MPV-5 · test_targets malformed (non-integer count) → MP_TEST_TARGETS_INVALID", () => {
    const mp = baseMissionPlan({
      test_targets: [{ test_file_path: "x.test.ts", test_group_names: [], expected_test_count_min: 3.14 }],
    });
    const r = asFailure(planMission({ request: baseRequest({ mission_plan: mp }) }));
    expect(r.refusal_code).toBe("MP_TEST_TARGETS_INVALID");
  });
});

// ── Group 7 · Impact analysis · protected_root_conflict detection ─────

describe("R1b · mission-planner · impact analysis", () => {
  it("MPI-1 · files_that_will_be_created contains all planned paths", () => {
    const r = asSuccess(planMission({ request: baseRequest() }));
    expect(r.impact_analysis.files_that_will_be_created).toContain("src/lib/capability-labs/mp-test-lab/example.ts");
  });

  it("MPI-2 · protected_root_conflict_detected true when planned path matches constraint", () => {
    const mp = baseMissionPlan();
    const req = baseRequest({ mission_plan: mp, constraints: { protected_paths: ["src/lib/capability-labs/mp-test-lab/example.ts"], max_files: 32 } });
    const r = asSuccess(planMission({ request: req }));
    expect(r.impact_analysis.protected_root_conflict_detected).toBe(true);
    // Also a risk should be emitted
    const conflictRisks = r.risks.filter((rk) => rk.category === "protected_path_conflict");
    expect(conflictRisks.length).toBeGreaterThan(0);
  });

  it("MPI-3 · protected_root_conflict_detected false when no overlap", () => {
    const r = asSuccess(planMission({ request: baseRequest() }));
    expect(r.impact_analysis.protected_root_conflict_detected).toBe(false);
  });
});

// ── Group 8 · Risk detection · missing test coverage ──────────────────

describe("R1b · mission-planner · risk detection", () => {
  it("MPR-1 · typed_data_contract without paired test_scaffold triggers test_coverage_gap risk", () => {
    const r = asSuccess(planMission({ request: baseRequest() }));
    const gapRisks = r.risks.filter((rk) => rk.category === "test_coverage_gap");
    expect(gapRisks.length).toBeGreaterThan(0);
  });

  it("MPR-2 · typed_data_contract WITH matching test_scaffold has no test_coverage_gap risk for that file", () => {
    const mp = baseMissionPlan({
      files_to_produce: [
        { path: "example.ts", kind: "typed_data_contract", contract_spec_hint: simpleHint("Example") },
        { path: "__tests__/example.test.ts", kind: "test_scaffold" },
      ],
    });
    const r = asSuccess(planMission({ request: baseRequest({ mission_plan: mp }) }));
    const gapRisks = r.risks.filter((rk) => rk.category === "test_coverage_gap" && rk.reference === "example.ts");
    expect(gapRisks.length).toBe(0);
  });
});

// ── Group 9 · MP-I-1 · Integration · R1a → R1b → typed_data_contract ─

describe("R1b · MP-I-1 · Integration · full R1a→R1b→typed_data_contract chain", () => {
  let fixtureRoot: string;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mp-i-1-fixture-"));
    // Create a minimal source layout the planner might reference.
    const codeArea = path.join(fixtureRoot, "src", "lib", "capability-labs", "mp-i-1-lab");
    fs.mkdirSync(codeArea, { recursive: true });
    // No pre-existing files in the lab · this is a fresh mission
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("MP-I-1 · plan → spec → author full chain produces valid TypeScript", () => {
    // Step 1: run repo-scan against the fixture
    const scanResult = repoScan({
      request: {
        read_roots: ["src/lib/capability-labs/"],
        extensions: [".ts"],
        max_files: 100,
        include_symbols: true,
        include_imports: true,
      },
      repo_root: fixtureRoot,
    });
    if (!scanResult.ok) throw new Error(`repo-scan failed: ${scanResult.reason}`);
    const map = scanResult.map;

    // Step 2: construct a mission plan document
    const spec: TypedDataContractSpec = {
      contract_name: "SyntheticShape",
      header_comment: "MP-I-1 · end-to-end integration fixture",
      type_only_imports: [],
      declarations: [
        {
          declaration_kind: "literal_union",
          name: "Mode",
          exported: true,
          literals: ["on", "off", "auto"],
        },
        {
          declaration_kind: "interface",
          name: "SyntheticShape",
          exported: true,
          fields: [
            { name: "id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
            { name: "mode", type: { kind: "reference", to: "Mode" }, optional: false, readonly_modifier: true },
          ],
        },
      ],
    };
    const mission: MissionPlanDocument = {
      mission_id: "MP_I_1",
      objective: "MP-I-1 integration test",
      target_directory: "src/lib/capability-labs/mp-i-1-lab/",
      files_to_produce: [
        { path: "synthetic.ts", kind: "typed_data_contract", contract_spec_hint: spec },
      ],
      type_only_import_hints: [],
      runtime_import_hints: [],
      protected_paths_declared: [],
      test_targets: [],
      rollback_strategy: "delete_new_files",
    };
    const request: MissionPlannerRequest = {
      mission_plan: mission,
      repository_map_sha256: map.scan_sha256,
      scan_sha256_expected: map.scan_sha256,
      constraints: { protected_paths: [], max_files: 32 },
    };

    // Step 3: invoke mission-planner
    const planResult = planMissionWithFullMap({ request, repository_map: map });
    if (!planResult.ok) throw new Error(`mission-planner failed: ${planResult.reason}`);

    // Step 4: extract the produced spec
    const plannedFile = planResult.files_planned[0];
    expect(plannedFile).toBeDefined();
    expect(plannedFile.kind).toBe("typed_data_contract");
    expect(plannedFile.typed_data_contract_spec).toBeDefined();

    // Step 5: feed the produced spec into authorTypedDataContract (Route 2/2b/2c primitive · UNCHANGED)
    const style: StyleProfile = {
      naming_convention: "snake_case",
      export_style: "named",
      semicolons: "yes",
      quote_style: "double",
      test_framework: "vitest",
      detected_from_files: [],
      detection_confidence: "high",
    };
    const authored = authorTypedDataContract({
      spec: plannedFile.typed_data_contract_spec!,
      style,
      target_path: "synthetic.ts",
    });
    expect(authored.ok).toBe(true);
    if (!authored.ok) throw new Error(`authoring failed: ${authored.reason}`);

    // Step 6: verify emitted TypeScript contains expected declarations
    expect(authored.content).toContain("export interface SyntheticShape");
    expect(authored.content).toContain(`readonly id: string`);
    expect(authored.content).toContain(`export type Mode`);
    expect(authored.content).toContain(`"on"`);
    expect(authored.content).toContain(`"off"`);
    expect(authored.content).toContain(`"auto"`);

    // Step 7: SHA-256 of emitted content is deterministic across runs
    const secondAuthored = authorTypedDataContract({
      spec: plannedFile.typed_data_contract_spec!,
      style,
      target_path: "synthetic.ts",
    });
    if (!secondAuthored.ok) throw new Error("second authoring failed");
    expect(sha(authored.content)).toBe(sha(secondAuthored.content));

    // MP-I-1 acceptance: the full chain works. NEX1 (via the primitives) can now:
    //   R1a repo-scan → RepositoryMap → R1b mission-planner → TypedDataContractSpec → Route 2/2b/2c authorTypedDataContract → valid TypeScript
  });
});
