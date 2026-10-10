// §36-L-1 · WAVE-L1 · 2026-09-14 · change-surface-manifest
//
// The change-surface-manifest primitive.
//
// Pure function · zero I/O. Consumes an R1a RepositoryMap + an EngineeringObjectiveDescriptor
// and produces a deterministic, evidence-cited ChangeManifest with:
//   - expected_change_set (files that must or likely change)
//   - protected_set (files that must NOT change)
//   - impact_predictions per candidate file (categorical only · no numeric scores)
//   - manifest_sha256
//
// The primitive never modifies files, never invokes primitives, never executes
// the change it analyses.
//
// Boundary (verbatim · unamendable):
//   "Wave L1 enables NEX1 to interpret an engineering-objective description +
//    R1a repo-scan output into a deterministic, evidence-cited change manifest
//    containing candidate change-surface files, categorical impact predictions,
//    and a locked protected-set. It does not permit NEX1 to modify any file,
//    invoke primitives, execute changes, expand authoring vocabulary, produce
//    numeric impact scores, or grant itself authority to execute the analysed
//    change."

import { createHash } from "node:crypto";
import type { RepositoryMap } from "../repo-intelligence/repo-scan-types";
import {
  APPROVED_CHANGE_KINDS,
  APPROVED_SCOPE_HINTS,
  L1_MAX_ASSERTED_MUST_CHANGE,
  L1_MAX_ASSERTED_MUST_NOT_CHANGE,
  L1_MAX_OUTPUT_BYTES,
  L1_MAX_REFERENCED_SYMBOLS,
  L1_MAX_SLUG_LENGTH,
  L1_PROHIBITED_SUBSTRINGS,
  type ChangeSurfaceManifestFailure,
  type ChangeSurfaceManifestRefusalCode,
  type ChangeSurfaceManifestRequest,
  type ChangeSurfaceManifestResult,
  type ChangeSurfaceManifestSuccess,
  type EngineeringObjectiveDescriptor,
  type ImpactPrediction,
  type ImpactReasonCode,
  type ImpactState,
} from "./change-surface-manifest-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: ChangeSurfaceManifestRefusalCode,
  reason: string,
  offendingField?: string,
): ChangeSurfaceManifestFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function containsProhibited(s: string): boolean {
  for (const bad of L1_PROHIBITED_SUBSTRINGS) if (s.includes(bad)) return true;
  return false;
}

/** Recomputes the R1a scan_sha256 for chain-integrity verification. Must
 *  mirror repo-scan's canonicalisation exactly. */
function canonicalRepoMapForHash(m: RepositoryMap): string {
  return JSON.stringify({
    root_paths: m.root_paths,
    file_count: m.file_count,
    files: m.files,
    symbols: m.symbols,
    imports: m.imports,
  });
}

/** Deterministic module derivation from a file path.
 *  "src/lib/nex-agent-runtime/programming-mission/types.ts" → "src/lib/nex-agent-runtime/programming-mission" */
function moduleOf(pathStr: string): string {
  const idx = pathStr.lastIndexOf("/");
  return idx < 0 ? "" : pathStr.slice(0, idx);
}

function isTestFile(pathStr: string): boolean {
  return pathStr.includes("/__tests__/") || pathStr.endsWith(".test.ts") || pathStr.endsWith(".test.tsx");
}

// ── Validation ─────────────────────────────────────────────────────────

function validate(request: ChangeSurfaceManifestRequest): ChangeSurfaceManifestFailure | null {
  if (!request || typeof request !== "object") return fail("L1_INVALID_REQUEST", "request must be an object");
  const m = request.repo_map;
  if (!m || typeof m !== "object") return fail("L1_INVALID_REPO_MAP", "repo_map required");
  if (!Array.isArray(m.root_paths) || !Array.isArray(m.files) || !Array.isArray(m.symbols) || !Array.isArray(m.imports)) {
    return fail("L1_INVALID_REPO_MAP", "repo_map missing required arrays");
  }
  if (typeof m.scan_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(m.scan_sha256)) {
    return fail("L1_INVALID_REPO_MAP", "repo_map.scan_sha256 invalid");
  }
  // Verify chain integrity: recompute scan_sha256 from the payload
  const recomputed = sha256Hex(canonicalRepoMapForHash(m));
  if (recomputed !== m.scan_sha256) {
    return fail("L1_INVALID_REPO_MAP", `repo_map.scan_sha256 mismatch (recomputed ${recomputed.slice(0, 12)}... vs claimed ${m.scan_sha256.slice(0, 12)}...)`);
  }
  const obj = request.objective;
  if (!obj || typeof obj !== "object") return fail("L1_INVALID_OBJECTIVE", "objective required");
  if (typeof obj.slug !== "string" || obj.slug.length === 0 || obj.slug.length > L1_MAX_SLUG_LENGTH) {
    return fail("L1_INVALID_OBJECTIVE", "objective.slug invalid");
  }
  if (!/^[a-z0-9\-]+$/.test(obj.slug)) return fail("L1_INVALID_OBJECTIVE", `objective.slug must be kebab-case: ${obj.slug}`);
  if (!Array.isArray(obj.scope_hints)) return fail("L1_INVALID_OBJECTIVE", "objective.scope_hints must be array");
  for (const h of obj.scope_hints) {
    if (!APPROVED_SCOPE_HINTS.includes(h)) return fail("L1_UNKNOWN_SCOPE_HINT", `unknown scope hint: ${String(h)}`);
  }
  if (!APPROVED_CHANGE_KINDS.includes(obj.change_kind_hint)) {
    return fail("L1_UNKNOWN_CHANGE_KIND", `unknown change_kind_hint: ${String(obj.change_kind_hint)}`);
  }
  if (!Array.isArray(obj.asserted_must_change) || obj.asserted_must_change.length > L1_MAX_ASSERTED_MUST_CHANGE) {
    return fail("L1_INVALID_OBJECTIVE", `asserted_must_change invalid or too long`);
  }
  if (!Array.isArray(obj.asserted_must_not_change) || obj.asserted_must_not_change.length > L1_MAX_ASSERTED_MUST_NOT_CHANGE) {
    return fail("L1_INVALID_OBJECTIVE", `asserted_must_not_change invalid or too long`);
  }
  if (!Array.isArray(obj.referenced_symbols) || obj.referenced_symbols.length > L1_MAX_REFERENCED_SYMBOLS) {
    return fail("L1_INVALID_OBJECTIVE", `referenced_symbols invalid or too long`);
  }
  for (const s of [...obj.asserted_must_change, ...obj.asserted_must_not_change]) {
    if (typeof s !== "string" || s.length === 0) return fail("L1_INVALID_OBJECTIVE", "assert path must be non-empty string");
    if (containsProhibited(s)) return fail("L1_INVALID_OBJECTIVE", `prohibited substring in path: ${s}`);
  }
  for (const sym of obj.referenced_symbols) {
    if (typeof sym !== "string" || sym.length === 0) return fail("L1_INVALID_OBJECTIVE", "referenced symbol must be non-empty string");
    if (containsProhibited(sym)) return fail("L1_INVALID_OBJECTIVE", `prohibited substring in symbol: ${sym}`);
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(sym)) return fail("L1_INVALID_OBJECTIVE", `symbol not a valid identifier: ${sym}`);
  }
  return null;
}

// ── Deterministic impact derivation ────────────────────────────────────

function deriveImpact(
  filePath: string,
  obj: EngineeringObjectiveDescriptor,
  m: RepositoryMap,
  impactedFiles: Set<string>,
  impactedModules: Set<string>,
): ImpactPrediction {
  // Rule 1: caller-asserted must_change → must_change
  if (obj.asserted_must_change.includes(filePath)) {
    return {
      path: filePath,
      impact_state: "must_change",
      reason_code: "asserted_by_caller_must_change",
      evidence_summary: `objective '${obj.slug}' asserted this path in asserted_must_change`,
    };
  }
  // Rule 2: caller-asserted must_not_change → must_not_change
  if (obj.asserted_must_not_change.includes(filePath)) {
    return {
      path: filePath,
      impact_state: "must_not_change",
      reason_code: "asserted_by_caller_must_not_change",
      evidence_summary: `objective '${obj.slug}' asserted this path in asserted_must_not_change`,
    };
  }
  // Rule 3: file declares a referenced_symbol → must_change (definition site)
  const declaresRefSym = m.symbols.some((sym) => sym.file === filePath && obj.referenced_symbols.includes(sym.name));
  if (declaresRefSym) {
    return {
      path: filePath,
      impact_state: "must_change",
      reason_code: "declares_referenced_symbol",
      evidence_summary: `file declares one or more referenced symbols`,
    };
  }
  // Rule 4: file imports a referenced_symbol → likely_change (import ripple)
  const importsRefSym = m.imports.some((imp) => imp.from_file === filePath && imp.symbols.some((s) => obj.referenced_symbols.includes(s)));
  if (importsRefSym && obj.scope_hints.includes("imports_ripple")) {
    return {
      path: filePath,
      impact_state: "likely_change",
      reason_code: "imports_referenced_symbol",
      evidence_summary: `file imports one or more referenced symbols · scope_hints includes imports_ripple`,
    };
  }
  // Rule 5: file is a test of an impacted file (same-directory pattern or naming)
  if (isTestFile(filePath) && obj.scope_hints.includes("implementation_and_tests")) {
    const dir = moduleOf(filePath);
    // Test relates to impacted file if the test's parent dir matches an impacted module
    const parentModule = dir.replace(/\/__tests__$/, "");
    if (impactedModules.has(parentModule)) {
      return {
        path: filePath,
        impact_state: "likely_change",
        reason_code: "is_test_of_impacted_file",
        evidence_summary: `test file in module of impacted file`,
      };
    }
  }
  // Rule 6: file in same module as an impacted file · categorical `likely_change` if cross_module hint
  const mod = moduleOf(filePath);
  if (impactedModules.has(mod) && obj.scope_hints.includes("cross_module")) {
    return {
      path: filePath,
      impact_state: "likely_change",
      reason_code: "in_module_of_impacted_file",
      evidence_summary: `same module as impacted file · scope_hints includes cross_module`,
    };
  }
  // Rule 7: outside all scope hints → must_not_change (default protection)
  return {
    path: filePath,
    impact_state: "must_not_change",
    reason_code: "outside_scope_hints",
    evidence_summary: `no scope-hint rule matched · default protection applies`,
  };
}

// ── Main entry point ───────────────────────────────────────────────────

export function computeChangeSurfaceManifest(request: ChangeSurfaceManifestRequest): ChangeSurfaceManifestResult {
  const check = validate(request);
  if (check) return check;

  const m = request.repo_map;
  const obj = request.objective;
  const clock = request.clock ?? (() => new Date());
  const now = clock();

  // First pass · identify all files that are DIRECTLY impacted (rules 1-4).
  const directlyImpacted = new Set<string>();
  const impactedModules = new Set<string>();
  for (const asserted of obj.asserted_must_change) {
    directlyImpacted.add(asserted);
    impactedModules.add(moduleOf(asserted));
  }
  for (const sym of m.symbols) {
    if (obj.referenced_symbols.includes(sym.name)) {
      directlyImpacted.add(sym.file);
      impactedModules.add(moduleOf(sym.file));
    }
  }

  // Second pass · derive impact for every file in the repo map.
  const impact_predictions: ImpactPrediction[] = [];
  for (const f of m.files) {
    const pred = deriveImpact(f.path, obj, m, directlyImpacted, impactedModules);
    impact_predictions.push(pred);
  }
  // Also include asserted_must_change / asserted_must_not_change paths even if they don't appear in the map.
  const knownPaths = new Set(m.files.map((f) => f.path));
  for (const p of obj.asserted_must_change) {
    if (!knownPaths.has(p)) {
      impact_predictions.push({
        path: p,
        impact_state: "must_change",
        reason_code: "asserted_by_caller_must_change",
        evidence_summary: `caller-asserted must_change path not in repo_map (candidate for file_new)`,
      });
    }
  }
  for (const p of obj.asserted_must_not_change) {
    if (!knownPaths.has(p)) {
      impact_predictions.push({
        path: p,
        impact_state: "must_not_change",
        reason_code: "asserted_by_caller_must_not_change",
        evidence_summary: `caller-asserted must_not_change path not in repo_map`,
      });
    }
  }

  // Sort predictions deterministically by path.
  impact_predictions.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const expected_change_set = impact_predictions
    .filter((p) => p.impact_state === "must_change" || p.impact_state === "likely_change")
    .map((p) => p.path)
    .sort();
  const protected_set = impact_predictions
    .filter((p) => p.impact_state === "must_not_change")
    .map((p) => p.path)
    .sort();

  const canonical = JSON.stringify({
    repo_map_sha256_verified: m.scan_sha256,
    objective_slug: obj.slug,
    expected_change_set,
    protected_set,
    impact_predictions,
  });
  const manifestSha = sha256Hex(canonical);

  const success: ChangeSurfaceManifestSuccess = {
    ok: true,
    assessed_at: now.toISOString(),
    repo_map_sha256_verified: m.scan_sha256,
    objective_slug: obj.slug,
    expected_change_set: Object.freeze(expected_change_set),
    protected_set: Object.freeze(protected_set),
    impact_predictions: Object.freeze(impact_predictions),
    manifest_sha256: manifestSha,
  };

  const size = Buffer.byteLength(canonical, "utf8") + manifestSha.length + 128;
  if (size > L1_MAX_OUTPUT_BYTES) {
    return fail("L1_OUTPUT_TOO_LARGE", `assembled output ${size} bytes > ${L1_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  ChangeKind,
  ChangeSurfaceManifestFailure,
  ChangeSurfaceManifestRefusalCode,
  ChangeSurfaceManifestRequest,
  ChangeSurfaceManifestResult,
  ChangeSurfaceManifestSuccess,
  EngineeringObjectiveDescriptor,
  ImpactPrediction,
  ImpactReasonCode,
  ImpactState,
  ScopeHint,
} from "./change-surface-manifest-types";
