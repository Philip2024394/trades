// §36-D-B · ROUTE-R1B · 2026-09-14 · mission-planner
//
// Pure-function mission planner. Given a structured MissionPlanDocument +
// a RepositoryMap (from R1a) + constraints, produces a MissionPlanResult
// with ready-to-invoke TypedDataContractSpec objects + dependencies + risks
// + tests + impact analysis + rollback plan. Or a structured refusal.
//
// Boundary (verbatim · unamendable):
//   "Route R1b enables NEX1 to plan safely from structured input; it does
//    not permit NEX1 to invoke any primitive, write any file, or expand
//    its authoring vocabulary."
//
// No I/O · no LLM · no natural-language parsing · deterministic templates only.
// See docs/NEX1/SECTION_36_D_B_ROUTE_R1B_MISSION_PLANNER_AMENDMENT.md.

import { createHash } from "node:crypto";
import type { RepositoryMap } from "./repo-scan-types";
import type {
  TypedDataContractSpec,
  TDCRuntimeImport,
  TDCTypeOnlyImport,
} from "../programming-mission/types";
import {
  APPROVED_FILE_KINDS,
  APPROVED_ROLLBACK_STRATEGIES,
  APPROVED_TARGET_DIRECTORY_PREFIXES,
  LOCKED_DECLARATION_KINDS,
  MP_MAX_FILES_PER_MISSION,
  MP_MAX_IDENTIFIER_LENGTH,
  MP_MAX_OBJECTIVE_LENGTH,
  MP_MAX_OUTPUT_BYTES,
  type DependencyEdge,
  type FileToProduce,
  type ImpactAnalysis,
  type MissionPlanDocument,
  type MissionPlanFailure,
  type MissionPlanResult,
  type MissionPlannerRefusalCode,
  type MissionPlannerRequest,
  type MissionPlannerResult,
  type PlannedFile,
  type RiskEntry,
  type RollbackPlan,
  type TestPlan,
} from "./mission-planner-types";

// ── Helpers ────────────────────────────────────────────────────────────

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isValidIdentifier(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= MP_MAX_IDENTIFIER_LENGTH && IDENTIFIER_RE.test(s);
}

function fail(code: MissionPlannerRefusalCode, reason: string, offendingField?: string): MissionPlanFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function pathViolates(p: string): boolean {
  if (typeof p !== "string" || p.length === 0) return true;
  if (p.includes("\0")) return true;
  if (p.includes("\\")) return true;
  if (p.includes("..")) return true;
  if (p.startsWith("/")) return true;
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  if (/^[a-z]+:/.test(p)) return true;
  return false;
}

function normaliseSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

function joinTargetPath(targetDir: string, filePath: string): string {
  const dir = targetDir.endsWith("/") ? targetDir : targetDir + "/";
  return normaliseSlashes(dir + filePath);
}

// ── Spec-hint validation (mirrors Route 2/2b/2c grammar) ───────────────

/** Validates a TypedDataContractSpecHint against the locked grammar. Does NOT
 *  duplicate the full typed-data-contract-authoring validation — it enforces
 *  the STRUCTURAL grammar (declaration_kind allow-list · declaration presence)
 *  and lets the downstream `authorTypedDataContract` do full byte-level checks.
 *
 *  The planner surfaces `MP_UNKNOWN_DECLARATION_KIND` for anything outside the
 *  8 locked kinds · `MP_INVALID_SPEC_HINT_GRAMMAR` for missing required fields. */
function validateSpecHint(
  hint: unknown,
  filePath: string,
): MissionPlanFailure | null {
  if (!hint || typeof hint !== "object") {
    return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} must be an object`, filePath);
  }
  const h = hint as Partial<TypedDataContractSpec>;
  if (typeof h.contract_name !== "string" || h.contract_name.length === 0) {
    return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} missing contract_name`, filePath);
  }
  if (typeof h.header_comment !== "string") {
    return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} missing header_comment`, filePath);
  }
  if (!Array.isArray(h.type_only_imports)) {
    return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} missing type_only_imports array`, filePath);
  }
  if (!Array.isArray(h.declarations) || h.declarations.length === 0) {
    return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} missing/empty declarations`, filePath);
  }
  for (let i = 0; i < h.declarations.length; i++) {
    const d = h.declarations[i] as { declaration_kind?: unknown; name?: unknown };
    if (!d || typeof d !== "object") {
      return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} declaration[${i}] not object`, filePath);
    }
    if (typeof d.declaration_kind !== "string" || !LOCKED_DECLARATION_KINDS.includes(d.declaration_kind)) {
      return fail("MP_UNKNOWN_DECLARATION_KIND", `spec_hint for ${filePath} declaration[${i}] kind '${String(d.declaration_kind)}' not in locked grammar`, `${filePath}#declarations[${i}].declaration_kind`);
    }
    if (!isValidIdentifier(d.name)) {
      return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} declaration[${i}] name invalid`, `${filePath}#declarations[${i}].name`);
    }
  }
  // Optional runtime_imports allowed (Route 2b/2c). Not deeply validated here — passed through.
  if (h.runtime_imports !== undefined && !Array.isArray(h.runtime_imports)) {
    return fail("MP_INVALID_SPEC_HINT_GRAMMAR", `spec_hint for ${filePath} runtime_imports must be array if present`, filePath);
  }
  return null;
}

// ── Dependency detection + resolution ──────────────────────────────────

function collectDependenciesForSpec(
  spec: TypedDataContractSpec,
  targetFileAbsolute: string,
): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const imp of spec.type_only_imports) {
    edges.push({
      from_file: targetFileAbsolute,
      imports_symbol: imp.symbol,
      from_specifier: imp.from_specifier,
      is_type_only: true,
    });
  }
  if (Array.isArray(spec.runtime_imports)) {
    for (const rimp of spec.runtime_imports) {
      // literal_union runtime imports have TWO emitted symbols: <name> and <name>_MEMBERS
      // We record ONE edge for the primary name (planner-level view · not emission-level)
      edges.push({
        from_file: targetFileAbsolute,
        imports_symbol: rimp.name,
        from_specifier: rimp.from_specifier,
        is_type_only: false,
      });
    }
  }
  return edges;
}

/** Attempt to resolve `from_specifier` (relative to `from_file`) against:
 *  (1) other files_to_produce in this mission
 *  (2) files present in the RepositoryMap
 *  Returns workspace-relative path or undefined. */
function resolveSpecifier(
  fromFile: string,
  specifier: string,
  plannedPaths: readonly string[],
  repoMap: RepositoryMap,
): string | undefined {
  // Only relative specifiers "./x" or "../x" are resolved by the planner
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return undefined;
  // Resolve relative to from_file's directory
  const parts = fromFile.split("/");
  parts.pop(); // drop filename
  const specParts = specifier.split("/");
  for (const seg of specParts) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  const base = parts.join("/");
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}/index.ts`];
  // Check planned files first
  for (const candidate of candidates) {
    if (plannedPaths.includes(candidate)) return candidate;
  }
  // Check RepositoryMap
  const mapPaths = new Set(repoMap.files.map((f) => f.path));
  for (const candidate of candidates) {
    if (mapPaths.has(candidate)) return candidate;
  }
  return undefined;
}

// ── Risk detection templates (deterministic) ───────────────────────────

function detectRisks(input: {
  readonly dependencies: readonly DependencyEdge[];
  readonly mission_plan: MissionPlanDocument;
  readonly constraints: readonly string[];
  readonly planned_paths: readonly string[];
  readonly repository_map: RepositoryMap;
}): readonly RiskEntry[] {
  const risks: RiskEntry[] = [];

  // 1. Unresolved dependencies
  for (const dep of input.dependencies) {
    if (dep.resolved_target === undefined && (dep.from_specifier.startsWith("./") || dep.from_specifier.startsWith("../"))) {
      risks.push({
        severity: "high",
        category: "unresolved_dependency",
        description: `Dependency ${dep.imports_symbol} imports from ${dep.from_specifier} but that specifier could not be resolved against the RepositoryMap or planned files`,
        reference: `${dep.from_file}:${dep.imports_symbol}`,
      });
    }
  }

  // 2. Protected-path conflict
  const allProtected = new Set<string>([
    ...input.constraints,
    ...input.mission_plan.protected_paths_declared.map(normaliseSlashes),
  ]);
  for (const p of input.planned_paths) {
    for (const prot of allProtected) {
      if (p === prot || p.startsWith(prot + "/") || (prot.endsWith("/") && p.startsWith(prot))) {
        risks.push({
          severity: "high",
          category: "protected_path_conflict",
          description: `Planned file ${p} overlaps with declared protected path ${prot}`,
          reference: p,
        });
      }
    }
  }

  // 3. Cross-file ordering / cycle detection (bounded · scan pairs)
  // Build a graph: for each planned file, which planned files does it import?
  const graph = new Map<string, Set<string>>();
  for (const p of input.planned_paths) graph.set(p, new Set<string>());
  for (const dep of input.dependencies) {
    if (dep.resolved_target && input.planned_paths.includes(dep.resolved_target)) {
      graph.get(dep.from_file)?.add(dep.resolved_target);
    }
  }
  // Cycle detection · DFS
  const visited = new Set<string>();
  const stack = new Set<string>();
  function detectCycle(node: string, path: string[]): string[] | null {
    if (stack.has(node)) return [...path, node];
    if (visited.has(node)) return null;
    visited.add(node);
    stack.add(node);
    const outs = graph.get(node);
    if (outs) {
      for (const n of outs) {
        const cycle = detectCycle(n, [...path, node]);
        if (cycle) return cycle;
      }
    }
    stack.delete(node);
    return null;
  }
  for (const node of input.planned_paths) {
    if (visited.has(node)) continue;
    const cycle = detectCycle(node, []);
    if (cycle) {
      risks.push({
        severity: "high",
        category: "cross_file_ordering",
        description: `Import cycle detected among planned files: ${cycle.join(" → ")}`,
        reference: cycle.join(","),
      });
      break;  // one cycle is enough to flag
    }
  }

  // 4. Test coverage gap · flag if a typed_data_contract file has no matching test_scaffold
  const testPaths = new Set<string>();
  for (const f of input.mission_plan.files_to_produce) {
    if (f.kind === "test_scaffold") testPaths.add(f.path);
  }
  for (const f of input.mission_plan.files_to_produce) {
    if (f.kind === "typed_data_contract") {
      // Look for any test scaffold whose path references this file's stem
      const stem = f.path.replace(/\.ts$/, "").replace(/^__tests__\//, "");
      let hasPairedTest = false;
      for (const tp of testPaths) {
        if (tp.includes(stem)) { hasPairedTest = true; break; }
      }
      if (!hasPairedTest) {
        risks.push({
          severity: "medium",
          category: "test_coverage_gap",
          description: `typed_data_contract file ${f.path} has no paired test_scaffold entry in files_to_produce`,
          reference: f.path,
        });
      }
    }
  }

  // Deterministic ordering: by severity (high > medium > low) then category then reference
  const sevRank = (s: "low" | "medium" | "high") => s === "high" ? 0 : s === "medium" ? 1 : 2;
  risks.sort((a, b) => {
    const sa = sevRank(a.severity);
    const sb = sevRank(b.severity);
    if (sa !== sb) return sa - sb;
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return a.reference < b.reference ? -1 : a.reference > b.reference ? 1 : 0;
  });
  return risks;
}

// ── Impact analysis ────────────────────────────────────────────────────

function computeImpact(input: {
  readonly planned_paths: readonly string[];
  readonly constraints: readonly string[];
  readonly mission_plan: MissionPlanDocument;
  readonly repository_map: RepositoryMap;
}): ImpactAnalysis {
  const filesCreated = [...input.planned_paths].sort();
  const mustNotChange = new Set<string>([
    ...input.constraints,
    ...input.mission_plan.protected_paths_declared.map(normaliseSlashes),
  ]);
  const mustNotChangeList = [...mustNotChange].sort();
  // Downstream symbols potentially affected: symbols in RepositoryMap that
  // import from any of the planned target paths. Since planned files are new,
  // this is typically empty for greenfield labs · non-empty when a mission
  // re-authors an existing capability under promotion.
  const downstream: string[] = [];
  const plannedSet = new Set(input.planned_paths);
  for (const imp of input.repository_map.imports) {
    // Resolve imp.from_specifier relative to imp.from_file
    const resolved = resolveSpecifier(imp.from_file, imp.from_specifier, [], input.repository_map);
    if (resolved && plannedSet.has(resolved)) {
      for (const sym of imp.symbols) downstream.push(`${imp.from_file}:${sym}`);
    }
  }
  // Detect overlap conflict
  let protectedConflict = false;
  for (const p of filesCreated) {
    for (const prot of mustNotChange) {
      if (p === prot || p.startsWith(prot + "/") || (prot.endsWith("/") && p.startsWith(prot))) {
        protectedConflict = true;
        break;
      }
    }
    if (protectedConflict) break;
  }
  return {
    files_that_will_be_created: filesCreated,
    files_that_must_not_change: mustNotChangeList,
    downstream_symbols_potentially_affected: [...new Set(downstream)].sort(),
    protected_root_conflict_detected: protectedConflict,
  };
}

// ── Rollback plan ──────────────────────────────────────────────────────

function computeRollback(
  strategy: MissionPlanDocument["rollback_strategy"],
  plannedPaths: readonly string[],
  missionId: string,
): RollbackPlan {
  return {
    strategy,
    files_to_delete_on_rollback: [...plannedPaths].sort(),
    baseline_sha256_manifest_reference: `data/mission-planner-baseline/${missionId}/baseline-hashes.txt`,
  };
}

// ── Test plan ──────────────────────────────────────────────────────────

function computeTestPlan(mission: MissionPlanDocument): TestPlan {
  const positive: string[] = [];
  const negative: string[] = [];
  const regression: string[] = [];
  let totalMin = 0;
  for (const target of mission.test_targets) {
    for (const group of target.test_group_names) {
      const gLower = group.toLowerCase();
      if (gLower.includes("positive") || gLower.includes("valid") || gLower.includes("happy")) {
        positive.push(`${target.test_file_path}:${group}`);
      } else if (gLower.includes("negative") || gLower.includes("invalid") || gLower.includes("refusal") || gLower.includes("reject")) {
        negative.push(`${target.test_file_path}:${group}`);
      } else if (gLower.includes("regression") || gLower.includes("baseline") || gLower.includes("preserve")) {
        regression.push(`${target.test_file_path}:${group}`);
      } else {
        // Uncategorised · counted toward positive by convention
        positive.push(`${target.test_file_path}:${group}`);
      }
    }
    if (typeof target.expected_test_count_min === "number" && target.expected_test_count_min > 0) {
      totalMin += target.expected_test_count_min;
    }
  }
  return {
    positive_test_targets: positive.sort(),
    negative_test_targets: negative.sort(),
    regression_targets: regression.sort(),
    total_target: totalMin,
  };
}

// ── Main entry point ───────────────────────────────────────────────────

export function planMission(input: { readonly request: MissionPlannerRequest }): MissionPlannerResult {
  const { request } = input;

  // ── Request-shape validation ──────────────────────────────────────
  if (!request || typeof request !== "object") {
    return fail("MP_INVALID_REQUEST", "request must be an object");
  }
  if (!request.mission_plan || typeof request.mission_plan !== "object") {
    return fail("MP_INVALID_REQUEST", "mission_plan required");
  }
  if (typeof request.repository_map_sha256 !== "string" || request.repository_map_sha256.length === 0) {
    return fail("MP_INVALID_REQUEST", "repository_map_sha256 required");
  }
  if (typeof request.scan_sha256_expected !== "string") {
    return fail("MP_INVALID_REQUEST", "scan_sha256_expected required");
  }
  if (!request.constraints || typeof request.constraints !== "object") {
    return fail("MP_INVALID_REQUEST", "constraints required");
  }

  // ── Scan-sha256 guard (stale-map protection) ──────────────────────
  if (request.scan_sha256_expected !== request.repository_map_sha256) {
    return fail("MP_SCAN_SHA256_MISMATCH", "repository_map_sha256 does not match scan_sha256_expected");
  }

  const mp = request.mission_plan;

  // ── mission_id validation ─────────────────────────────────────────
  if (typeof mp.mission_id !== "string" || mp.mission_id.length === 0 || mp.mission_id.length > MP_MAX_IDENTIFIER_LENGTH) {
    return fail("MP_INVALID_MISSION_ID", "mission_id must be non-empty string ≤ 128 chars");
  }

  // ── objective validation ──────────────────────────────────────────
  if (typeof mp.objective !== "string" || mp.objective.length === 0 || mp.objective.length > MP_MAX_OBJECTIVE_LENGTH) {
    return fail("MP_INVALID_OBJECTIVE", `objective must be non-empty string ≤ ${MP_MAX_OBJECTIVE_LENGTH} chars`);
  }

  // ── target_directory validation ───────────────────────────────────
  if (typeof mp.target_directory !== "string") {
    return fail("MP_INVALID_TARGET_DIRECTORY", "target_directory required");
  }
  // Check path violations BEFORE normalising · so backslashes / null bytes / etc are refused
  if (pathViolates(mp.target_directory)) {
    return fail("MP_INVALID_TARGET_DIRECTORY", `target_directory invalid: ${mp.target_directory}`, mp.target_directory);
  }
  const targetDir = normaliseSlashes(mp.target_directory);
  let dirApproved = false;
  for (const prefix of APPROVED_TARGET_DIRECTORY_PREFIXES) {
    if (targetDir.startsWith(prefix) && targetDir.length > prefix.length) { dirApproved = true; break; }
  }
  if (!dirApproved) {
    return fail("MP_INVALID_TARGET_DIRECTORY", `target_directory not under approved prefix: ${targetDir}`, targetDir);
  }

  // ── files_to_produce validation ───────────────────────────────────
  if (!Array.isArray(mp.files_to_produce) || mp.files_to_produce.length === 0) {
    return fail("MP_EMPTY_FILES_TO_PRODUCE", "files_to_produce must be non-empty array");
  }
  if (mp.files_to_produce.length > MP_MAX_FILES_PER_MISSION) {
    return fail("MP_EMPTY_FILES_TO_PRODUCE", `files_to_produce exceeds ${MP_MAX_FILES_PER_MISSION} cap`);
  }
  const seenPaths = new Set<string>();
  for (let i = 0; i < mp.files_to_produce.length; i++) {
    const f = mp.files_to_produce[i];
    if (!f || typeof f !== "object") {
      return fail("MP_INVALID_FILE_KIND", `files_to_produce[${i}] must be object`, `files_to_produce[${i}]`);
    }
    if (typeof f.path !== "string" || pathViolates(f.path)) {
      return fail("MP_INVALID_FILE_KIND", `files_to_produce[${i}] invalid path`, `files_to_produce[${i}].path`);
    }
    if (!APPROVED_FILE_KINDS.includes(f.kind)) {
      return fail("MP_INVALID_FILE_KIND", `files_to_produce[${i}] unknown kind: ${String(f.kind)}`, `files_to_produce[${i}].kind`);
    }
    if (seenPaths.has(f.path)) {
      return fail("MP_DUPLICATE_FILE_PATH", `duplicate path in files_to_produce: ${f.path}`, `files_to_produce[${i}].path`);
    }
    seenPaths.add(f.path);
    if (f.kind === "typed_data_contract") {
      if (!f.contract_spec_hint) {
        return fail("MP_MISSING_SPEC_HINT", `files_to_produce[${i}] kind=typed_data_contract requires contract_spec_hint`, `files_to_produce[${i}].contract_spec_hint`);
      }
      const specFail = validateSpecHint(f.contract_spec_hint, f.path);
      if (specFail) return specFail;
    }
  }

  // ── protected_paths_declared validation ───────────────────────────
  if (!Array.isArray(mp.protected_paths_declared)) {
    return fail("MP_INVALID_PROTECTED_PATH_LIST", "protected_paths_declared must be array");
  }
  for (const p of mp.protected_paths_declared) {
    if (typeof p !== "string" || pathViolates(p)) {
      return fail("MP_INVALID_PROTECTED_PATH_LIST", `protected_paths_declared invalid: ${String(p)}`);
    }
  }

  // ── rollback_strategy validation ──────────────────────────────────
  if (!APPROVED_ROLLBACK_STRATEGIES.includes(mp.rollback_strategy)) {
    return fail("MP_INVALID_ROLLBACK_STRATEGY", `unknown rollback_strategy: ${String(mp.rollback_strategy)}`);
  }

  // ── test_targets validation ───────────────────────────────────────
  if (!Array.isArray(mp.test_targets)) {
    return fail("MP_TEST_TARGETS_INVALID", "test_targets must be array");
  }
  for (const t of mp.test_targets) {
    if (!t || typeof t !== "object") {
      return fail("MP_TEST_TARGETS_INVALID", "test_targets entry must be object");
    }
    if (typeof t.test_file_path !== "string" || pathViolates(t.test_file_path)) {
      return fail("MP_TEST_TARGETS_INVALID", `test_targets entry invalid path: ${String(t.test_file_path)}`);
    }
    if (!Array.isArray(t.test_group_names)) {
      return fail("MP_TEST_TARGETS_INVALID", "test_targets entry missing test_group_names array");
    }
    if (typeof t.expected_test_count_min !== "number" || t.expected_test_count_min < 0 || !Number.isInteger(t.expected_test_count_min)) {
      return fail("MP_TEST_TARGETS_INVALID", "test_targets entry expected_test_count_min must be non-negative integer");
    }
  }

  // ── Build planned files ───────────────────────────────────────────
  const plannedFiles: PlannedFile[] = [];
  const plannedPaths: string[] = [];
  for (const f of mp.files_to_produce) {
    const absPath = joinTargetPath(targetDir, f.path);
    plannedPaths.push(absPath);
    if (f.kind === "typed_data_contract") {
      // Pass the hint through as the spec (typed_data_contract-authoring will do full byte validation on invocation)
      plannedFiles.push({
        path: absPath,
        kind: "typed_data_contract",
        typed_data_contract_spec: f.contract_spec_hint,
      });
    } else if (f.kind === "test_scaffold") {
      plannedFiles.push({
        path: absPath,
        kind: "test_scaffold",
        mai_supplies_note: "MAI supplies test scaffold per Capability Lab doctrine §12. Not authored by NEX1.",
      });
    } else {
      plannedFiles.push({
        path: absPath,
        kind: "governance_doc",
        mai_supplies_note: "MAI supplies governance doc. Not authored by NEX1.",
      });
    }
  }

  // ── Detect dependencies ───────────────────────────────────────────
  const dependencies: DependencyEdge[] = [];
  for (const planned of plannedFiles) {
    if (planned.kind === "typed_data_contract" && planned.typed_data_contract_spec) {
      const edges = collectDependenciesForSpec(planned.typed_data_contract_spec, planned.path);
      for (const edge of edges) {
        const resolved = resolveSpecifier(edge.from_file, edge.from_specifier, plannedPaths, request.constraints ? { files: [], symbols: [], imports: [], root_paths: [], file_count: 0, scan_sha256: request.repository_map_sha256 } as RepositoryMap : { files: [], symbols: [], imports: [], root_paths: [], file_count: 0, scan_sha256: request.repository_map_sha256 } as RepositoryMap);
        dependencies.push({ ...edge, ...(resolved !== undefined ? { resolved_target: resolved } : {}) });
      }
    }
  }

  // Deterministic sort of dependencies
  dependencies.sort((a, b) => {
    if (a.from_file !== b.from_file) return a.from_file < b.from_file ? -1 : 1;
    if (a.imports_symbol !== b.imports_symbol) return a.imports_symbol < b.imports_symbol ? -1 : 1;
    return 0;
  });

  // ── Detect risks · impact · rollback · test plan ────────────────
  const repoMapPlaceholder: RepositoryMap = {
    root_paths: [],
    file_count: 0,
    files: [],
    symbols: [],
    imports: [],
    scan_sha256: request.repository_map_sha256,
  };
  // For unresolved-dependency risk detection, we need the *actual* RepositoryMap.
  // In this pure-function design the map is not passed separately; it must be reconstructed.
  // For MVP · caller passes a full RepositoryMap via a separate optional field; but per our
  // request interface we only carry repository_map_sha256. The design correctly identifies
  // MP-I-1 will surface this: the planner CANNOT resolve dependencies without the actual
  // RepositoryMap. This is a genuine plan-vs-implementation gap — surfaced here honestly.
  //
  // Rather than silently invent a full RepositoryMap, we run risk detection with a placeholder
  // empty map. Downstream MP-I-1 test will pass a full map via a separate field (see below).
  const risks = detectRisks({
    dependencies,
    mission_plan: mp,
    constraints: request.constraints.protected_paths,
    planned_paths: plannedPaths,
    repository_map: repoMapPlaceholder,
  });
  const impact = computeImpact({
    planned_paths: plannedPaths,
    constraints: request.constraints.protected_paths,
    mission_plan: mp,
    repository_map: repoMapPlaceholder,
  });
  const rollback = computeRollback(mp.rollback_strategy, plannedPaths, mp.mission_id);
  const testPlan = computeTestPlan(mp);

  // ── Assemble result (compute planner_sha256 last) ────────────────
  const resultWithoutSha = {
    ok: true as const,
    mission_id: mp.mission_id,
    objective: mp.objective,
    files_planned: plannedFiles,
    dependencies,
    risks,
    test_plan: testPlan,
    impact_analysis: impact,
    rollback_plan: rollback,
  };
  const serialisedForHash = JSON.stringify(resultWithoutSha);
  const plannerSha = createHash("sha256").update(serialisedForHash, "utf8").digest("hex");
  const finalResult: MissionPlanResult = { ...resultWithoutSha, planner_sha256: plannerSha };
  const serialisedFinal = JSON.stringify(finalResult);
  if (serialisedFinal.length > MP_MAX_OUTPUT_BYTES) {
    return fail("MP_OUTPUT_TOO_LARGE", `serialised result ${serialisedFinal.length} bytes > ${MP_MAX_OUTPUT_BYTES}`);
  }
  return finalResult;
}

// ── Variant entry point that accepts the full RepositoryMap ────────────
//
// The primary `planMission` entry above only accepts `repository_map_sha256`
// to keep the request lean. But dependency resolution + downstream-symbol
// impact analysis need the FULL RepositoryMap. This second entry point takes
// the full map explicitly. Used by integration tests (MP-I-1) and callers
// that already have the map in hand from an R1a scan.

export function planMissionWithFullMap(input: {
  readonly request: MissionPlannerRequest;
  readonly repository_map: RepositoryMap;
}): MissionPlannerResult {
  const { request, repository_map } = input;

  // Basic request-shape checks first (delegated to planMission for consistency)
  if (!request || typeof request !== "object") return fail("MP_INVALID_REQUEST", "request must be an object");
  if (!repository_map || typeof repository_map !== "object") return fail("MP_INVALID_REQUEST", "repository_map required for planMissionWithFullMap");

  // scan_sha256 guard against the full map
  if (repository_map.scan_sha256 !== request.scan_sha256_expected) {
    return fail("MP_SCAN_SHA256_MISMATCH", "repository_map.scan_sha256 does not match scan_sha256_expected");
  }
  if (request.repository_map_sha256 !== repository_map.scan_sha256) {
    return fail("MP_SCAN_SHA256_MISMATCH", "request.repository_map_sha256 does not match repository_map.scan_sha256");
  }

  // Delegate the shape / grammar validation to planMission by passing a stub request.
  // But we need to override the risk / impact / dependency resolution with the real map.
  // Since planMission uses a placeholder empty map internally · we recompute here.
  const initial = planMission({ request });
  if (!initial.ok) return initial;

  // Re-resolve dependencies against the full map
  const plannedPaths = initial.files_planned.map((p) => p.path);
  const dependencies: DependencyEdge[] = [];
  for (const planned of initial.files_planned) {
    if (planned.kind === "typed_data_contract" && planned.typed_data_contract_spec) {
      const edges = collectDependenciesForSpec(planned.typed_data_contract_spec, planned.path);
      for (const edge of edges) {
        const resolved = resolveSpecifier(edge.from_file, edge.from_specifier, plannedPaths, repository_map);
        dependencies.push({ ...edge, ...(resolved !== undefined ? { resolved_target: resolved } : {}) });
      }
    }
  }
  dependencies.sort((a, b) => {
    if (a.from_file !== b.from_file) return a.from_file < b.from_file ? -1 : 1;
    if (a.imports_symbol !== b.imports_symbol) return a.imports_symbol < b.imports_symbol ? -1 : 1;
    return 0;
  });

  const risks = detectRisks({
    dependencies,
    mission_plan: request.mission_plan,
    constraints: request.constraints.protected_paths,
    planned_paths: plannedPaths,
    repository_map,
  });
  const impact = computeImpact({
    planned_paths: plannedPaths,
    constraints: request.constraints.protected_paths,
    mission_plan: request.mission_plan,
    repository_map,
  });

  const resultWithoutSha = {
    ok: true as const,
    mission_id: initial.mission_id,
    objective: initial.objective,
    files_planned: initial.files_planned,
    dependencies,
    risks,
    test_plan: initial.test_plan,
    impact_analysis: impact,
    rollback_plan: initial.rollback_plan,
  };
  const serialisedForHash = JSON.stringify(resultWithoutSha);
  const plannerSha = createHash("sha256").update(serialisedForHash, "utf8").digest("hex");
  const finalResult: MissionPlanResult = { ...resultWithoutSha, planner_sha256: plannerSha };
  const serialisedFinal = JSON.stringify(finalResult);
  if (serialisedFinal.length > MP_MAX_OUTPUT_BYTES) {
    return fail("MP_OUTPUT_TOO_LARGE", `serialised result ${serialisedFinal.length} bytes > ${MP_MAX_OUTPUT_BYTES}`);
  }
  return finalResult;
}
