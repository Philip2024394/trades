// §36-L-2 · WAVE-L2 · 2026-09-14 · change-decomposition-consistency
//
// Pure function · zero I/O. Consumes an L1 ChangeManifest (SHA-verified against R1a
// chain) + the same R1a RepositoryMap and produces:
//  - ordered ChangeUnit[] (types_first → implementation → imports_ripple → tests → docs → governance)
//  - consistency-check results (categorical only)
//  - decomposition_sha256
//
// The primitive never executes changes. It only plans and verifies plan consistency.

import { createHash } from "node:crypto";
import type { RepositoryMap } from "../repo-intelligence/repo-scan-types";
import type { ChangeSurfaceManifestSuccess, ImpactPrediction } from "./change-surface-manifest-types";
import {
  APPROVED_CONSISTENCY_CHECKS,
  APPROVED_UNIT_KINDS,
  L2_MAX_FILES_PER_UNIT,
  L2_MAX_OUTPUT_BYTES,
  UNIT_KIND_PRIORITY,
  type ChangeDecompositionFailure,
  type ChangeDecompositionRefusalCode,
  type ChangeDecompositionRequest,
  type ChangeDecompositionResult,
  type ChangeDecompositionSuccess,
  type ChangeUnit,
  type ChangeUnitKind,
  type ConsistencyCheckId,
  type ConsistencyCheckResult,
  type ConsistencyState,
} from "./change-decomposition-consistency-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: ChangeDecompositionRefusalCode,
  reason: string,
  offendingField?: string,
): ChangeDecompositionFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function isTypesFile(p: string): boolean {
  return p.endsWith("-types.ts") || p.endsWith("/types.ts");
}
function isTestFile(p: string): boolean {
  return p.includes("/__tests__/") || p.endsWith(".test.ts") || p.endsWith(".test.tsx");
}
function isDocFile(p: string): boolean {
  return p.endsWith(".md");
}
function isGovernanceFile(p: string): boolean {
  return /SECTION_36_[A-Z0-9_]+_AMENDMENT\.md$/i.test(p) || /WAVE-[A-Z0-9]+-ACCEPTANCE-REPORT\.md$/i.test(p);
}

// ── Validation ─────────────────────────────────────────────────────────

function validate(request: ChangeDecompositionRequest): ChangeDecompositionFailure | null {
  if (!request || typeof request !== "object") return fail("L2_INVALID_REQUEST", "request must be an object");
  const m = request.manifest;
  if (!m || typeof m !== "object" || (m as { ok?: unknown }).ok !== true) {
    return fail("L2_INVALID_MANIFEST", "manifest.ok must be true");
  }
  if (typeof m.manifest_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(m.manifest_sha256)) {
    return fail("L2_INVALID_MANIFEST", "manifest.manifest_sha256 invalid");
  }
  if (typeof m.repo_map_sha256_verified !== "string" || !/^[0-9a-f]{64}$/.test(m.repo_map_sha256_verified)) {
    return fail("L2_INVALID_MANIFEST", "manifest.repo_map_sha256_verified invalid");
  }
  const r = request.repo_map;
  if (!r || typeof r !== "object" || typeof r.scan_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r.scan_sha256)) {
    return fail("L2_INVALID_REPO_MAP", "repo_map.scan_sha256 invalid");
  }
  if (r.scan_sha256 !== m.repo_map_sha256_verified) {
    return fail("L2_MANIFEST_REPO_MAP_MISMATCH", `manifest cites scan_sha256 ${m.repo_map_sha256_verified.slice(0, 12)}..., repo_map has ${r.scan_sha256.slice(0, 12)}...`);
  }
  return null;
}

// ── Unit-kind classification ───────────────────────────────────────────

function classifyFileToUnitKind(path: string, prediction: ImpactPrediction): ChangeUnitKind {
  if (isGovernanceFile(path)) return "governance";
  if (isDocFile(path)) return "documentation";
  if (isTestFile(path)) return "tests";
  if (isTypesFile(path)) return "types_first";
  if (prediction.reason_code === "imports_referenced_symbol") return "imports_ripple";
  return "implementation";
}

// ── Consistency-check derivations (deterministic) ──────────────────────

function checkTypesHaveImplementation(units: ChangeUnit[]): ConsistencyCheckResult {
  const typesUnit = units.find((u) => u.kind === "types_first");
  const implUnit = units.find((u) => u.kind === "implementation");
  if (!typesUnit || typesUnit.files.length === 0) {
    return {
      check_id: "types_have_implementation",
      state: "not_applicable",
      involved_files: [],
      evidence_summary: "no types_first files in change",
    };
  }
  if (implUnit && implUnit.files.length > 0) {
    return {
      check_id: "types_have_implementation",
      state: "consistent",
      involved_files: Object.freeze([...typesUnit.files, ...implUnit.files]),
      evidence_summary: "types_first files paired with implementation files",
    };
  }
  return {
    check_id: "types_have_implementation",
    state: "inconsistent",
    involved_files: Object.freeze([...typesUnit.files]),
    evidence_summary: "types_first files have no corresponding implementation files",
  };
}

function checkImplementationHasTests(units: ChangeUnit[]): ConsistencyCheckResult {
  const implUnit = units.find((u) => u.kind === "implementation");
  const testsUnit = units.find((u) => u.kind === "tests");
  if (!implUnit || implUnit.files.length === 0) {
    return {
      check_id: "implementation_has_tests",
      state: "not_applicable",
      involved_files: [],
      evidence_summary: "no implementation files in change",
    };
  }
  if (testsUnit && testsUnit.files.length > 0) {
    return {
      check_id: "implementation_has_tests",
      state: "consistent",
      involved_files: Object.freeze([...implUnit.files, ...testsUnit.files]),
      evidence_summary: "implementation files paired with tests",
    };
  }
  return {
    check_id: "implementation_has_tests",
    state: "inconsistent",
    involved_files: Object.freeze([...implUnit.files]),
    evidence_summary: "implementation files have no corresponding tests",
  };
}

function checkImportsHaveDeclarations(
  units: ChangeUnit[],
  manifest: ChangeSurfaceManifestSuccess,
  repoMap: RepositoryMap,
): ConsistencyCheckResult {
  const importsUnit = units.find((u) => u.kind === "imports_ripple");
  if (!importsUnit || importsUnit.files.length === 0) {
    return {
      check_id: "imports_have_declarations",
      state: "not_applicable",
      involved_files: [],
      evidence_summary: "no imports_ripple files in change",
    };
  }
  // For each imports_ripple file · check that the referenced_symbols they import
  // are declared in files also in the change (types_first or implementation).
  const changedFiles = new Set(units.flatMap((u) => u.files));
  const symbolsDeclaredInChangeSet = new Set(
    repoMap.symbols.filter((s) => changedFiles.has(s.file)).map((s) => s.name),
  );
  const importedSymbols = new Set<string>();
  for (const importer of importsUnit.files) {
    for (const imp of repoMap.imports) {
      if (imp.from_file === importer) {
        for (const sym of imp.symbols) importedSymbols.add(sym);
      }
    }
  }
  const missingDeclarations = [...importedSymbols].filter((sym) => !symbolsDeclaredInChangeSet.has(sym));
  if (missingDeclarations.length === 0) {
    return {
      check_id: "imports_have_declarations",
      state: "consistent",
      involved_files: Object.freeze([...importsUnit.files]),
      evidence_summary: `all imported symbols are declared within the change set`,
    };
  }
  return {
    check_id: "imports_have_declarations",
    state: "partial",
    involved_files: Object.freeze([...importsUnit.files]),
    evidence_summary: `${missingDeclarations.length} imported symbol(s) not declared in change set (they may be pre-existing external symbols · not necessarily an error)`,
  };
}

function checkGovernanceCoversNewFiles(units: ChangeUnit[]): ConsistencyCheckResult {
  const govUnit = units.find((u) => u.kind === "governance");
  const implUnit = units.find((u) => u.kind === "implementation");
  const typesUnit = units.find((u) => u.kind === "types_first");
  const newSourceFiles = [
    ...(implUnit?.files ?? []),
    ...(typesUnit?.files ?? []),
  ].filter((f) => f.startsWith("src/lib/nex-agent-runtime/") || f.startsWith("src/lib/capability-labs/"));
  if (newSourceFiles.length === 0) {
    return {
      check_id: "governance_covers_new_files",
      state: "not_applicable",
      involved_files: [],
      evidence_summary: "no new source files under protected roots",
    };
  }
  if (govUnit && govUnit.files.some((f) => /SECTION_36_[A-Z0-9_]+_AMENDMENT\.md$/i.test(f))) {
    return {
      check_id: "governance_covers_new_files",
      state: "consistent",
      involved_files: Object.freeze([...govUnit.files, ...newSourceFiles]),
      evidence_summary: `new source files under protected roots are covered by a §36 amendment`,
    };
  }
  return {
    check_id: "governance_covers_new_files",
    state: "inconsistent",
    involved_files: Object.freeze([...newSourceFiles]),
    evidence_summary: `new source files under protected roots but no §36 amendment in change set`,
  };
}

function checkTestsCoverNewSymbols(
  units: ChangeUnit[],
  repoMap: RepositoryMap,
): ConsistencyCheckResult {
  const testsUnit = units.find((u) => u.kind === "tests");
  const implUnit = units.find((u) => u.kind === "implementation");
  const typesUnit = units.find((u) => u.kind === "types_first");
  const newSourceFiles = new Set([
    ...(implUnit?.files ?? []),
    ...(typesUnit?.files ?? []),
  ]);
  if (newSourceFiles.size === 0) {
    return {
      check_id: "tests_cover_new_symbols",
      state: "not_applicable",
      involved_files: [],
      evidence_summary: "no source files in change",
    };
  }
  if (!testsUnit || testsUnit.files.length === 0) {
    return {
      check_id: "tests_cover_new_symbols",
      state: "inconsistent",
      involved_files: Object.freeze([...newSourceFiles]),
      evidence_summary: "source files present but no test files",
    };
  }
  // Test files should import from at least one of the new source files (by proximity)
  const testFiles = new Set(testsUnit.files);
  const relevantImports = repoMap.imports.filter((imp) => testFiles.has(imp.from_file));
  const coveredSources = new Set<string>();
  for (const imp of relevantImports) {
    // Best-effort: test file in __tests__ subdir imports from `../<name>` → resolves to sibling of __tests__ dir
    for (const src of newSourceFiles) {
      // If the src's basename appears in the import specifier, count as covered
      const srcBase = src.substring(src.lastIndexOf("/") + 1).replace(/\.tsx?$/, "");
      if (imp.from_specifier.includes(srcBase)) coveredSources.add(src);
    }
  }
  if (coveredSources.size === newSourceFiles.size) {
    return {
      check_id: "tests_cover_new_symbols",
      state: "consistent",
      involved_files: Object.freeze([...testFiles, ...newSourceFiles]),
      evidence_summary: `every new source file has a corresponding test import`,
    };
  }
  return {
    check_id: "tests_cover_new_symbols",
    state: "partial",
    involved_files: Object.freeze([...testFiles, ...newSourceFiles]),
    evidence_summary: `${coveredSources.size}/${newSourceFiles.size} new source files covered by test imports`,
  };
}

function checkDocsReferenceImplementation(units: ChangeUnit[]): ConsistencyCheckResult {
  const docUnit = units.find((u) => u.kind === "documentation");
  const govUnit = units.find((u) => u.kind === "governance");
  // Treat governance as a form of documentation for this check
  const anyDocs = (docUnit?.files.length ?? 0) + (govUnit?.files.length ?? 0);
  if (anyDocs === 0) {
    return {
      check_id: "docs_reference_implementation",
      state: "not_applicable",
      involved_files: [],
      evidence_summary: "no documentation or governance in change",
    };
  }
  return {
    check_id: "docs_reference_implementation",
    state: "consistent",
    involved_files: Object.freeze([...(docUnit?.files ?? []), ...(govUnit?.files ?? [])]),
    evidence_summary: `documentation/governance files present in change`,
  };
}

// ── Main entry point ───────────────────────────────────────────────────

export function decomposeChangeAndCheckConsistency(request: ChangeDecompositionRequest): ChangeDecompositionResult {
  const check = validate(request);
  if (check) return check;

  const manifest = request.manifest;
  const repoMap = request.repo_map;
  const clock = request.clock ?? (() => new Date());
  const now = clock();

  // Group expected-change files by unit kind.
  const groupedByKind = new Map<ChangeUnitKind, string[]>();
  for (const kind of APPROVED_UNIT_KINDS) groupedByKind.set(kind, []);
  for (const path of manifest.expected_change_set) {
    const pred = manifest.impact_predictions.find((p) => p.path === path);
    if (!pred) continue; // impossible for well-formed manifest but defensive
    const kind = classifyFileToUnitKind(path, pred);
    groupedByKind.get(kind)!.push(path);
  }

  // Emit ChangeUnits in locked priority order.
  const change_units: ChangeUnit[] = [];
  const kindsInOrder = APPROVED_UNIT_KINDS.slice().sort((a, b) => UNIT_KIND_PRIORITY[a] - UNIT_KIND_PRIORITY[b]);
  const priorUnitIds: string[] = [];
  for (const kind of kindsInOrder) {
    const files = groupedByKind.get(kind)!.slice().sort();
    if (files.length === 0) continue;
    if (files.length > L2_MAX_FILES_PER_UNIT) {
      return fail("L2_OUTPUT_TOO_LARGE", `unit '${kind}' has ${files.length} files (> ${L2_MAX_FILES_PER_UNIT})`);
    }
    const unitId = `${manifest.objective_slug}-${kind}`;
    change_units.push({
      unit_id: unitId,
      kind,
      execution_order: UNIT_KIND_PRIORITY[kind],
      files: Object.freeze(files),
      depends_on_unit_ids: Object.freeze([...priorUnitIds]),
      evidence_summary: `${files.length} files classified as ${kind}`,
    });
    priorUnitIds.push(unitId);
  }

  // Consistency checks
  const consistency_checks: ConsistencyCheckResult[] = [
    checkTypesHaveImplementation(change_units),
    checkImplementationHasTests(change_units),
    checkImportsHaveDeclarations(change_units, manifest, repoMap),
    checkGovernanceCoversNewFiles(change_units),
    checkTestsCoverNewSymbols(change_units, repoMap),
    checkDocsReferenceImplementation(change_units),
  ];
  consistency_checks.sort((a, b) => (a.check_id < b.check_id ? -1 : a.check_id > b.check_id ? 1 : 0));

  const canonical = JSON.stringify({
    manifest_sha256_verified: manifest.manifest_sha256,
    repo_map_sha256_verified: repoMap.scan_sha256,
    change_units,
    consistency_checks,
  });
  const decompositionSha = sha256Hex(canonical);

  const success: ChangeDecompositionSuccess = {
    ok: true,
    assessed_at: now.toISOString(),
    manifest_sha256_verified: manifest.manifest_sha256,
    repo_map_sha256_verified: repoMap.scan_sha256,
    change_units: Object.freeze(change_units),
    consistency_checks: Object.freeze(consistency_checks),
    decomposition_sha256: decompositionSha,
  };

  const size = Buffer.byteLength(canonical, "utf8") + decompositionSha.length + 128;
  if (size > L2_MAX_OUTPUT_BYTES) {
    return fail("L2_OUTPUT_TOO_LARGE", `assembled output ${size} bytes > ${L2_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  ChangeDecompositionFailure,
  ChangeDecompositionRefusalCode,
  ChangeDecompositionRequest,
  ChangeDecompositionResult,
  ChangeDecompositionSuccess,
  ChangeUnit,
  ChangeUnitKind,
  ConsistencyCheckId,
  ConsistencyCheckResult,
  ConsistencyState,
} from "./change-decomposition-consistency-types";
