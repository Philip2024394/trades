// §36-S-1 · WAVE-S1 · 2026-09-14 · engineering-evidence-collector
//
// The engineering-evidence-collector primitive.
//
// Pure function with bounded read-only I/O. Given a scoped request, produces
// a deterministic structured snapshot of engineering evidence: capability
// inventory, test-run summary (from acceptance-report text spans only, not
// re-executed), rollback-proof inventory, grep-marker inventory, governance
// amendment inventory with deterministic cessation-state derivation, and
// baseline SHA-256 verification. Any protected-baseline drift causes a
// whole-run EEC_BASELINE_MISMATCH refusal.
//
// Boundary (verbatim · unamendable):
//   "Wave S1 enables NEX1 to collect and structure static engineering-evidence
//    artefacts already present in the workspace into one deterministic, signed
//    record. It does not permit NEX1 to run tests, judge capability health,
//    cluster failures, recommend improvements, modify any file, read historical
//    signed records under data/nex-storage/, invoke primitives, or expand its
//    authoring vocabulary."
//
// See docs/NEX1/BUILD_GATES/WAVE-S1-ENGINEERING-EVIDENCE-COLLECTOR-PLAN.md (v1.1)
// and docs/NEX1/SECTION_36_S_1_ENGINEERING_EVIDENCE_COLLECTOR_AMENDMENT.md.

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  ACCEPTANCE_REPORT_REGISTRY,
  AMENDMENT_STATE_ACTIVE_RE,
  APPROVED_EVIDENCE_KINDS,
  EEC_APPROVED_EXTENSIONS,
  EEC_DEFAULT_FRESHNESS_HOURS,
  EEC_EXCLUDED_BASENAME_PREFIXES,
  EEC_EXCLUDED_DIR_BASENAMES,
  EEC_EXCLUDED_PATH_PREFIXES,
  EEC_MAX_EVIDENCE_KINDS,
  EEC_MAX_FILES_PER_ROOT,
  EEC_MAX_FRESHNESS_HOURS,
  EEC_MAX_OUTPUT_BYTES,
  EEC_MAX_SCAN_DEPTH,
  EEC_MAX_SCOPE_ARRAY,
  EEC_MAX_WAVE_FILTER_ENTRIES,
  EEC_PROHIBITED_SUBSTRINGS,
  PLAN_ONLY_IESB_GREP_MARKER_RE,
  PLAN_ONLY_WAVE_GREP_MARKER_RE,
  SHA256_BASELINE_LINE_RE,
  TEST_COUNT_SPAN_RE,
  VERDICT_PASS_RE,
  WAVE_GREP_MARKER_RE,
  type BaselineVerificationEntry,
  type CapabilityRecord,
  type EvidenceCollectionFailure,
  type EvidenceCollectionRefusalCode,
  type EvidenceCollectionRequest,
  type EvidenceCollectionResult,
  type EvidenceCollectionSuccess,
  type EvidenceGapNote,
  type EvidenceGapNoteKind,
  type EvidenceKind,
  type GovernanceAmendmentEntry,
  type GrepMarkerEntry,
  type RollbackProofEntry,
  type TestRunSummaryEntry,
} from "./evidence-collector-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: EvidenceCollectionRefusalCode,
  reason: string,
  offendingSource?: string,
): EvidenceCollectionFailure {
  return offendingSource !== undefined
    ? { ok: false, refusal_code: code, reason, offending_source: offendingSource }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function containsProhibited(s: string): boolean {
  for (const bad of EEC_PROHIBITED_SUBSTRINGS) {
    if (s.includes(bad)) return true;
  }
  return false;
}

function pathHasBackslash(p: string): boolean {
  return p.includes("\\");
}

function isAbsoluteLike(p: string): boolean {
  if (p.length === 0) return false;
  if (p.startsWith("/")) return true;
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return true;
  return false;
}

function normaliseRelative(p: string): string {
  return toPosix(path.normalize(p));
}

function isInsideExcludedPrefix(relPosix: string): boolean {
  for (const pfx of EEC_EXCLUDED_PATH_PREFIXES) {
    if (relPosix === pfx || relPosix.startsWith(`${pfx}/`)) return true;
  }
  return false;
}

function hasExcludedBasename(basename: string): boolean {
  for (const pfx of EEC_EXCLUDED_BASENAME_PREFIXES) {
    if (basename === pfx || basename.startsWith(`${pfx}.`) || basename.startsWith(`${pfx}_`)) return true;
    if (pfx === "secrets" && basename.startsWith("secrets")) return true;
  }
  return false;
}

function isApprovedExtension(p: string): boolean {
  const idx = p.lastIndexOf(".");
  if (idx < 0) return false;
  const ext = p.slice(idx).toLowerCase();
  return EEC_APPROVED_EXTENSIONS.includes(ext);
}

/** Validate a scope path. Returns the normalised relative POSIX form or
 *  null if the caller supplied an obviously invalid string. Callers must
 *  still verify the path resolves inside workspace_root. */
function validateScopePath(rawPath: string): { ok: true; rel: string } | { ok: false; reason: string } {
  if (typeof rawPath !== "string" || rawPath.length === 0) return { ok: false, reason: "empty scope path" };
  if (rawPath.includes("\0")) return { ok: false, reason: "null byte in scope path" };
  if (pathHasBackslash(rawPath)) return { ok: false, reason: "backslash in scope path" };
  if (isAbsoluteLike(rawPath)) return { ok: false, reason: "absolute or protocol scope path" };
  if (containsProhibited(rawPath)) return { ok: false, reason: "prohibited substring" };
  const rel = normaliseRelative(rawPath);
  if (rel.includes("..")) return { ok: false, reason: "path traversal in scope path" };
  if (isInsideExcludedPrefix(rel)) return { ok: false, reason: `scope path inside excluded prefix (${rel})` };
  const baseName = rel.split("/").pop() ?? rel;
  if (hasExcludedBasename(baseName)) return { ok: false, reason: `scope path targets excluded basename (${baseName})` };
  return { ok: true, rel };
}

/** Bounded recursive directory listing. Returns absolute file paths that
 *  survive extension filter + excluded-subpath halt + depth/count limits.
 *  Throws when limits are exceeded so caller can convert to refusal. */
class TraversalLimitError extends Error {
  readonly rootRel: string;
  readonly limitKind: "depth" | "count";
  constructor(rootRel: string, limitKind: "depth" | "count") {
    super(`traversal limit '${limitKind}' exceeded under '${rootRel}'`);
    this.rootRel = rootRel;
    this.limitKind = limitKind;
  }
}

function listFilesBounded(
  absRoot: string,
  workspaceRoot: string,
  rootRel: string,
): string[] {
  const results: string[] = [];
  const stack: Array<{ dir: string; depth: number }> = [{ dir: absRoot, depth: 0 }];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    const { dir, depth } = entry;
    if (depth > EEC_MAX_SCAN_DEPTH) {
      throw new TraversalLimitError(rootRel, "depth");
    }
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable → skip (not a failure per plan)
    }
    // Deterministic order · sort by name
    dirents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const d of dirents) {
      const abs = path.join(dir, d.name);
      const rel = toPosix(path.relative(workspaceRoot, abs));
      if (d.isDirectory()) {
        if (EEC_EXCLUDED_DIR_BASENAMES.includes(d.name)) continue;
        if (isInsideExcludedPrefix(rel)) continue;
        if (hasExcludedBasename(d.name)) continue;
        stack.push({ dir: abs, depth: depth + 1 });
        continue;
      }
      if (!d.isFile()) continue;
      if (hasExcludedBasename(d.name)) continue;
      if (isInsideExcludedPrefix(rel)) continue;
      if (!isApprovedExtension(d.name)) continue;
      results.push(abs);
      if (results.length > EEC_MAX_FILES_PER_ROOT) {
        throw new TraversalLimitError(rootRel, "count");
      }
    }
  }
  results.sort();
  return results;
}

// ── Request validation ─────────────────────────────────────────────────

function validateRequest(request: EvidenceCollectionRequest): EvidenceCollectionFailure | null {
  if (!request || typeof request !== "object") return fail("EEC_INVALID_REQUEST", "request must be an object");
  if (typeof request.workspace_root !== "string" || request.workspace_root.length === 0) {
    return fail("EEC_INVALID_WORKSPACE", "workspace_root missing or empty");
  }
  if (!Array.isArray(request.evidence_kinds) || request.evidence_kinds.length === 0) {
    return fail("EEC_UNKNOWN_EVIDENCE_KIND", "evidence_kinds must be non-empty array");
  }
  if (request.evidence_kinds.length > EEC_MAX_EVIDENCE_KINDS) {
    return fail("EEC_UNKNOWN_EVIDENCE_KIND", `evidence_kinds count > ${EEC_MAX_EVIDENCE_KINDS}`);
  }
  for (const k of request.evidence_kinds) {
    if (!APPROVED_EVIDENCE_KINDS.includes(k)) {
      return fail("EEC_UNKNOWN_EVIDENCE_KIND", `unknown evidence kind: ${String(k)}`);
    }
  }
  if (!request.path_scan_scope || typeof request.path_scan_scope !== "object") {
    return fail("EEC_INVALID_REQUEST", "path_scan_scope required");
  }
  const scope = request.path_scan_scope;
  const arrays: Array<[string, readonly string[] | undefined]> = [
    ["source_roots", scope.source_roots],
    ["doc_roots", scope.doc_roots],
    ["rollback_proof_roots", scope.rollback_proof_roots],
  ];
  for (const [name, arr] of arrays) {
    if (!Array.isArray(arr)) return fail("EEC_INVALID_REQUEST", `path_scan_scope.${name} must be array`);
    if (arr.length > EEC_MAX_SCOPE_ARRAY) return fail("EEC_INVALID_REQUEST", `path_scan_scope.${name} exceeds ${EEC_MAX_SCOPE_ARRAY}`);
    for (const p of arr) {
      const v = validateScopePath(p);
      if (!v.ok) return fail("EEC_INVALID_PATH", `${name}: ${v.reason}`, p);
    }
  }
  if (request.wave_filter !== undefined) {
    if (!Array.isArray(request.wave_filter)) return fail("EEC_INVALID_REQUEST", "wave_filter must be array");
    if (request.wave_filter.length > EEC_MAX_WAVE_FILTER_ENTRIES) return fail("EEC_INVALID_REQUEST", "wave_filter exceeds cap");
    for (const s of request.wave_filter) {
      if (typeof s !== "string" || s.length === 0) return fail("EEC_INVALID_REQUEST", "wave_filter entry not a non-empty string");
      if (containsProhibited(s)) return fail("EEC_PROHIBITED_STRING_CONTENT", "wave_filter contains prohibited substring");
    }
  }
  const fh = request.freshness_threshold_hours ?? EEC_DEFAULT_FRESHNESS_HOURS;
  if (!Number.isInteger(fh) || fh <= 0 || fh > EEC_MAX_FRESHNESS_HOURS) {
    return fail("EEC_INVALID_REQUEST", `freshness_threshold_hours out of range: ${fh}`);
  }
  return null;
}

function validateWorkspace(workspaceRoot: string): { ok: true; absolute: string } | EvidenceCollectionFailure {
  let abs: string;
  try {
    abs = path.resolve(workspaceRoot);
  } catch {
    return fail("EEC_INVALID_WORKSPACE", "workspace_root could not be resolved");
  }
  let st: fs.Stats;
  try {
    st = fs.statSync(abs);
  } catch {
    return fail("EEC_INVALID_WORKSPACE", `workspace_root not accessible: ${abs}`);
  }
  if (!st.isDirectory()) return fail("EEC_INVALID_WORKSPACE", `workspace_root is not a directory: ${abs}`);
  return { ok: true, absolute: abs };
}

// ── Locked pattern extractors ──────────────────────────────────────────

function extractTestCountSpan(fileText: string): { count: number; span: string; line: number } | null {
  const lines = fileText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TEST_COUNT_SPAN_RE);
    if (m) {
      const num = parseInt(m[1], 10);
      const denom = parseInt(m[2], 10);
      // Only emit when denom > 0 · numerator taken as the declared count.
      if (Number.isFinite(num) && Number.isFinite(denom) && denom > 0) {
        return { count: num, span: `line ${i + 1}: '${m[0]}'`, line: i + 1 };
      }
    }
  }
  return null;
}

function extractGrepMarkers(fileText: string): string[] {
  const found = new Set<string>();
  const all: RegExp[] = [
    new RegExp(WAVE_GREP_MARKER_RE.source, "g"),
    new RegExp(PLAN_ONLY_WAVE_GREP_MARKER_RE.source, "g"),
    new RegExp(PLAN_ONLY_IESB_GREP_MARKER_RE.source, "g"),
  ];
  for (const re of all) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(fileText)) !== null) {
      found.add(m[0]);
    }
  }
  return [...found];
}

function extractFirstWaveGrepMarker(fileText: string): string | null {
  const m = fileText.match(WAVE_GREP_MARKER_RE);
  return m ? m[0] : null;
}

// ── Baseline hash file parser ──────────────────────────────────────────

interface ParsedBaselineLine {
  readonly sha: string;
  readonly relPath: string;
}

function parseBaselineFile(text: string): { ok: true; lines: readonly ParsedBaselineLine[] } | { ok: false; reason: string } {
  const rawLines = text.split(/\r?\n/);
  const out: ParsedBaselineLine[] = [];
  let anyContent = false;
  for (const raw of rawLines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    anyContent = true;
    const m = line.match(SHA256_BASELINE_LINE_RE);
    if (!m) return { ok: false, reason: `malformed baseline line: ${line.slice(0, 80)}` };
    out.push({ sha: m[1], relPath: m[2] });
  }
  if (!anyContent) return { ok: false, reason: "baseline hash file is empty" };
  return { ok: true, lines: out };
}

// ── Deterministic sorting keys ─────────────────────────────────────────

function byField<T, K extends string>(getter: (t: T) => string): (a: T, b: T) => number {
  return (a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  };
}

// ── Main entry point ───────────────────────────────────────────────────

export function collectEngineeringEvidence(request: EvidenceCollectionRequest): EvidenceCollectionResult {
  const reqFail = validateRequest(request);
  if (reqFail) return reqFail;

  const wsCheck = validateWorkspace(request.workspace_root);
  if ("ok" in wsCheck && wsCheck.ok !== true) return wsCheck;
  const workspaceAbs = (wsCheck as { ok: true; absolute: string }).absolute;

  const clock = request.clock ?? (() => new Date());
  const freshnessHours = request.freshness_threshold_hours ?? EEC_DEFAULT_FRESHNESS_HOURS;
  const now = clock();
  const nowMs = now.getTime();
  const kinds = new Set<EvidenceKind>(request.evidence_kinds);
  const waveFilter = request.wave_filter;
  const gapNotes: EvidenceGapNote[] = [];

  // Resolve each scope root to an absolute path (canonicalise + verify inside workspace).
  const scope = request.path_scan_scope;
  const resolveRoot = (rel: string): string => path.resolve(workspaceAbs, rel);
  const scopeRels = [...scope.source_roots, ...scope.doc_roots, ...scope.rollback_proof_roots];
  for (const rel of scopeRels) {
    const abs = resolveRoot(rel);
    const relBack = toPosix(path.relative(workspaceAbs, abs));
    if (relBack.startsWith("..") || path.isAbsolute(relBack)) {
      return fail("EEC_INVALID_PATH", `scope path resolves outside workspace: ${rel}`, rel);
    }
    if (isInsideExcludedPrefix(relBack)) {
      return fail("EEC_INVALID_PATH", `scope path resolves inside excluded prefix: ${relBack}`, rel);
    }
    // Existence check
    try {
      fs.statSync(abs);
    } catch {
      return fail("EEC_INVALID_PATH", `scope root does not exist: ${rel}`, rel);
    }
  }

  // Bounded traversal · union of all listed roots.
  const allSourceFiles: string[] = [];
  const allDocFiles: string[] = [];
  const allRollbackFiles: string[] = [];
  try {
    for (const rel of scope.source_roots) allSourceFiles.push(...listFilesBounded(resolveRoot(rel), workspaceAbs, rel));
    for (const rel of scope.doc_roots) allDocFiles.push(...listFilesBounded(resolveRoot(rel), workspaceAbs, rel));
    for (const rel of scope.rollback_proof_roots) allRollbackFiles.push(...listFilesBounded(resolveRoot(rel), workspaceAbs, rel));
  } catch (e) {
    if (e instanceof TraversalLimitError) {
      return fail("EEC_INVALID_REQUEST", `traversal ${e.limitKind} limit exceeded under '${e.rootRel}'`, e.rootRel);
    }
    throw e;
  }

  // Read file bytes helpers (memoised inside this run).
  const fileBytesCache = new Map<string, Buffer>();
  const readFileBytes = (abs: string): Buffer => {
    const cached = fileBytesCache.get(abs);
    if (cached) return cached;
    const b = fs.readFileSync(abs);
    fileBytesCache.set(abs, b);
    return b;
  };
  const readFileText = (abs: string): string => readFileBytes(abs).toString("utf8");
  const shaOfFile = (abs: string): string => sha256Hex(readFileBytes(abs));

  // Freshness check on all rollback proof files.
  for (const abs of allRollbackFiles) {
    const st = fs.statSync(abs);
    const ageHours = (nowMs - st.mtimeMs) / (1000 * 60 * 60);
    if (ageHours > freshnessHours) {
      return fail(
        "EEC_EVIDENCE_STALE",
        `rollback proof file older than freshness threshold (age ${ageHours.toFixed(2)}h > ${freshnessHours}h)`,
        toPosix(path.relative(workspaceAbs, abs)),
      );
    }
  }

  // ── Rollback proof inventory (needed before baseline verification) ──
  const rollbackProofInventory: RollbackProofEntry[] = [];
  const declaredBaselines = new Map<string, Array<{ sha: string; sourceFile: string; mtimeMs: number }>>();

  if (kinds.has("rollback_proof_inventory") || kinds.has("baseline_sha_verification")) {
    for (const abs of allRollbackFiles) {
      const relPath = toPosix(path.relative(workspaceAbs, abs));
      const base = path.basename(abs);
      // Only .txt files matching baseline-hashes pattern qualify as rollback baseline files.
      if (!base.endsWith(".txt")) continue;
      if (!/baseline/i.test(base) && !/hashes/i.test(base)) continue;
      const text = readFileText(abs);
      const parsed = parseBaselineFile(text);
      if (!parsed.ok) {
        return fail("EEC_EVIDENCE_MISSING", `${parsed.reason}`, relPath);
      }
      // Derive wave_slug from parent directory basename.
      const parentDir = path.basename(path.dirname(abs));
      const waveSlug = parentDir.replace(/-rollback-proof$/, "").replace(/^wave-/, "");
      if (waveFilter && waveFilter.length > 0 && !waveFilter.includes(waveSlug)) continue;
      const stMs = fs.statSync(abs).mtimeMs;
      const declaredPaths = parsed.lines.map((l) => l.relPath);
      rollbackProofInventory.push({
        wave_slug: waveSlug,
        baseline_hashes_path: relPath,
        baseline_hashes_sha256: sha256Hex(readFileBytes(abs)),
        protected_paths_declared: Object.freeze(declaredPaths.slice().sort()),
      });
      for (const line of parsed.lines) {
        const arr = declaredBaselines.get(line.relPath) ?? [];
        arr.push({ sha: line.sha, sourceFile: relPath, mtimeMs: stMs });
        declaredBaselines.set(line.relPath, arr);
      }
    }
    rollbackProofInventory.sort(byField((e) => e.baseline_hashes_path));
  }

  // ── Baseline SHA verification (whole-run refusal on mismatch) ──
  //
  // Multi-wave history rule (plan v1.1 §14 §E-5 · doctrinal):
  //
  // Files legitimately evolve across waves; each wave captures a baseline
  // representing the current expected state AT WAVE TIME. When multiple
  // rollback-proof files declare a path, the MOST RECENT capture (by
  // mtime of its rollback-proof file) is treated as authoritative for
  // verification. Older, disagreeing declarations become informational
  // `capability_promotion_status_ambiguous` gap notes: they record the
  // historical divergence but do NOT trigger a refusal.
  //
  // If the most-recent baseline SHA differs from the observed SHA of the
  // protected file → whole-run EEC_BASELINE_MISMATCH.
  //
  // This preserves the load-bearing "any drift refuses the run" discipline
  // while acknowledging that historical baselines are, correctly, snapshots
  // of past state, not authoritative claims about present state.
  const baselineVerification: BaselineVerificationEntry[] = [];
  if (kinds.has("baseline_sha_verification")) {
    for (const [rp, entries] of declaredBaselines.entries()) {
      // Determine authoritative baseline: most recent rollback-proof mtime.
      const sorted = [...entries].sort((a, b) => {
        if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
        // Tie-break deterministically by sourceFile path
        return a.sourceFile < b.sourceFile ? -1 : a.sourceFile > b.sourceFile ? 1 : 0;
      });
      const authoritative = sorted[0];
      const uniqueShas = new Set(entries.map((e) => e.sha));
      if (uniqueShas.size > 1) {
        // Informational gap note · not a refusal.
        gapNotes.push({
          kind: "capability_promotion_status_ambiguous",
          wave_slug: null,
          evidence_kind: "baseline_sha_verification",
          path_ref: rp,
          description: `Multiple rollback-proof files declare different SHA-256 for '${rp}': ${[...uniqueShas].sort().join(", ")}. Verification proceeds against the most-recent capture (${authoritative.sourceFile}).`,
        });
      }
      const absProtected = path.resolve(workspaceAbs, rp);
      const relBack = toPosix(path.relative(workspaceAbs, absProtected));
      if (relBack.startsWith("..") || path.isAbsolute(relBack)) {
        return fail("EEC_INVALID_PATH", `baseline-declared path escapes workspace: ${rp}`, rp);
      }
      let currentSha: string;
      try {
        currentSha = shaOfFile(absProtected);
      } catch {
        return fail("EEC_EVIDENCE_MISSING", `baseline-declared file missing: ${rp}`, rp);
      }
      const match = currentSha === authoritative.sha;
      baselineVerification.push({
        protected_path: rp,
        baseline_sha256_declared: authoritative.sha,
        current_sha256_observed: currentSha,
        match,
        source_of_baseline: authoritative.sourceFile,
      });
      if (!match) {
        return fail(
          "EEC_BASELINE_MISMATCH",
          `protected file SHA-256 mismatch: '${rp}' declared ${authoritative.sha.slice(0, 16)}..., observed ${currentSha.slice(0, 16)}... (authoritative baseline: ${authoritative.sourceFile})`,
          rp,
        );
      }
    }
    baselineVerification.sort(byField((e) => e.protected_path));
  }

  // ── Grep-marker inventory ──
  const grepMarkerInventory: GrepMarkerEntry[] = [];
  if (kinds.has("grep_marker_inventory")) {
    const markerToPaths = new Map<string, Set<string>>();
    const allTextFiles = [...allDocFiles, ...allSourceFiles].filter((abs) => {
      const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase();
      return ext === ".md" || ext === ".ts" || ext === ".tsx" || ext === ".txt";
    });
    for (const abs of allTextFiles) {
      const text = readFileText(abs);
      const markers = extractGrepMarkers(text);
      const rel = toPosix(path.relative(workspaceAbs, abs));
      for (const m of markers) {
        const set = markerToPaths.get(m) ?? new Set<string>();
        set.add(rel);
        markerToPaths.set(m, set);
      }
    }
    for (const [marker, pathSet] of markerToPaths.entries()) {
      const paths = [...pathSet].sort();
      grepMarkerInventory.push({ marker, paths: Object.freeze(paths) });
    }
    grepMarkerInventory.sort(byField((e) => e.marker));
  }

  // ── Governance amendment inventory ──
  const governanceAmendmentInventory: GovernanceAmendmentEntry[] = [];
  if (kinds.has("governance_amendment_inventory")) {
    // Amendment files match basename pattern SECTION_36_*_AMENDMENT.md
    const amendmentFiles = allDocFiles.filter((abs) => /^SECTION_36_[A-Z0-9_]+_AMENDMENT\.md$/i.test(path.basename(abs)));
    // Also collect acceptance-report text for cessation cross-reference.
    const acceptanceReportTexts: Array<{ path: string; text: string }> = [];
    for (const abs of [...allDocFiles, ...allRollbackFiles]) {
      const base = path.basename(abs);
      if (!base.endsWith(".md")) continue;
      if (!/ACCEPTANCE|PASS/i.test(base)) continue;
      const rel = toPosix(path.relative(workspaceAbs, abs));
      acceptanceReportTexts.push({ path: rel, text: readFileText(abs) });
    }
    for (const abs of amendmentFiles) {
      const rel = toPosix(path.relative(workspaceAbs, abs));
      const text = readFileText(abs);
      const marker = extractFirstWaveGrepMarker(text);
      if (marker === null) {
        gapNotes.push({
          kind: "grep_marker_missing_in_expected_path",
          wave_slug: null,
          evidence_kind: "governance_amendment_inventory",
          path_ref: rel,
          description: `Amendment file has no WAVE_GREP_MARKER match: ${rel}`,
        });
        continue;
      }
      // Cessation-state derivation per plan v1.1 §12.4
      let cessationState: GovernanceAmendmentEntry["cessation_state"] = "unknown";
      let matched = false;
      for (const rep of acceptanceReportTexts) {
        if (rep.text.includes(marker) && VERDICT_PASS_RE.test(rep.text)) {
          cessationState = "ceased";
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (AMENDMENT_STATE_ACTIVE_RE.test(text)) {
          cessationState = "active";
        } else {
          cessationState = "unknown";
          gapNotes.push({
            kind: "governance_amendment_state_unknown",
            wave_slug: null,
            evidence_kind: "governance_amendment_inventory",
            path_ref: rel,
            description: `No acceptance report with VERDICT_PASS references marker '${marker}' and no explicit CESSATION_STATE: active`,
          });
        }
      }
      governanceAmendmentInventory.push({
        marker,
        amendment_path: rel,
        cessation_state: cessationState,
      });
    }
    governanceAmendmentInventory.sort(byField((e) => e.amendment_path));
  }

  // ── Capability inventory (from registry §12.2) ──
  const capabilityInventory: CapabilityRecord[] = [];
  if (kinds.has("capability_inventory")) {
    for (const reg of ACCEPTANCE_REPORT_REGISTRY) {
      if (waveFilter && waveFilter.length > 0 && !waveFilter.includes(reg.wave_slug)) continue;
      const absReport = path.resolve(workspaceAbs, reg.authoritative_path);
      let reportSha: string | null = null;
      let promotionStatus: CapabilityRecord["promotion_status"] = "plan_only";
      let acceptancePathReported: string | null = null;
      try {
        reportSha = shaOfFile(absReport);
        acceptancePathReported = reg.authoritative_path;
        promotionStatus = reg.wave_slug === "c1" ? "promoted" : "infrastructure_only";
        if (reg.wave_slug === "c1") promotionStatus = "promoted";
      } catch {
        gapNotes.push({
          kind: "acceptance_report_referenced_but_missing",
          wave_slug: reg.wave_slug,
          evidence_kind: "capability_inventory",
          path_ref: reg.authoritative_path,
          description: `Registry-declared acceptance report not found: ${reg.authoritative_path}`,
        });
      }
      // Promoted-paths field intentionally empty for infrastructure primitives
      // (no promotion of primitive source outside its authored folder). For
      // C1 (the only currently-promoted capability), list the C1 source files.
      const promotedPaths: string[] = [];
      if (reg.wave_slug === "c1") {
        promotedPaths.push(
          "src/lib/nex-agent-runtime/c1-nex-facial-state-model/facial-state.ts",
          "src/lib/nex-agent-runtime/c1-nex-facial-state-model/ranges.ts",
          "src/lib/nex-agent-runtime/c1-nex-facial-state-model/refusal.ts",
          "src/lib/nex-agent-runtime/c1-nex-facial-state-model/serialiser.ts",
          "src/lib/nex-agent-runtime/c1-nex-facial-state-model/validator.ts",
        );
      }
      capabilityInventory.push({
        wave_slug: reg.wave_slug,
        promotion_status: promotionStatus,
        promoted_paths: Object.freeze(promotedPaths.slice().sort()),
        acceptance_report_path: acceptancePathReported,
        acceptance_report_sha256: reportSha,
      });
    }
    // Detect wave_filter slugs that were requested but did not match any registry entry
    if (waveFilter) {
      const registrySlugs = new Set(ACCEPTANCE_REPORT_REGISTRY.map((r) => r.wave_slug));
      for (const slug of waveFilter) {
        if (!registrySlugs.has(slug)) {
          gapNotes.push({
            kind: "wave_filter_slug_not_matched",
            wave_slug: slug,
            evidence_kind: "capability_inventory",
            path_ref: null,
            description: `wave_filter slug '${slug}' matches no registry entry`,
          });
        }
      }
    }
    capabilityInventory.sort(byField((e) => e.wave_slug));
  }

  // ── Test-run summary (from acceptance-report text spans) ──
  const testRunSummary: TestRunSummaryEntry[] = [];
  if (kinds.has("test_run_summary")) {
    for (const reg of ACCEPTANCE_REPORT_REGISTRY) {
      if (waveFilter && waveFilter.length > 0 && !waveFilter.includes(reg.wave_slug)) continue;
      const absReport = path.resolve(workspaceAbs, reg.authoritative_path);
      let text: string;
      try {
        text = readFileText(absReport);
      } catch {
        // Gap note already emitted by capability_inventory path if collected.
        continue;
      }
      const span = extractTestCountSpan(text);
      if (span === null) {
        gapNotes.push({
          kind: "test_count_source_span_not_locatable",
          wave_slug: reg.wave_slug,
          evidence_kind: "test_run_summary",
          path_ref: reg.authoritative_path,
          description: `No TEST_COUNT_SPAN pattern match in ${reg.authoritative_path}`,
        });
        continue;
      }
      testRunSummary.push({
        source: "acceptance_report",
        wave_slug: reg.wave_slug,
        test_count_declared: span.count,
        test_count_declared_source_span: `${reg.authoritative_path}:${span.span}`,
        note: "declared_by_report_not_re_executed",
      });
    }
    testRunSummary.sort(byField((e) => e.wave_slug));
  }

  // Deterministically sort gap notes
  gapNotes.sort((a, b) => {
    const ka = `${a.kind}|${a.wave_slug ?? ""}|${a.evidence_kind ?? ""}|${a.path_ref ?? ""}|${a.description}`;
    const kb = `${b.kind}|${b.wave_slug ?? ""}|${b.evidence_kind ?? ""}|${b.path_ref ?? ""}|${b.description}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  // Assemble output
  const collectedAt = now.toISOString();
  const workspaceRootSha = sha256Hex(toPosix(workspaceAbs));
  const evidenceKindsCollected = APPROVED_EVIDENCE_KINDS.filter((k) => kinds.has(k));

  const record: EvidenceCollectionSuccess = {
    ok: true,
    collected_at: collectedAt,
    workspace_root_sha256: workspaceRootSha,
    evidence_kinds_collected: Object.freeze(evidenceKindsCollected),
    capability_inventory: Object.freeze(capabilityInventory),
    test_run_summary: Object.freeze(testRunSummary),
    rollback_proof_inventory: Object.freeze(rollbackProofInventory),
    grep_marker_inventory: Object.freeze(grepMarkerInventory),
    governance_amendment_inventory: Object.freeze(governanceAmendmentInventory),
    baseline_sha_verification: Object.freeze(baselineVerification),
    gap_notes: Object.freeze(gapNotes),
    evidence_sha256: "", // placeholder · computed next
  };

  const canonicalForHash = JSON.stringify({
    workspace_root_sha256: record.workspace_root_sha256,
    evidence_kinds_collected: record.evidence_kinds_collected,
    capability_inventory: record.capability_inventory,
    test_run_summary: record.test_run_summary,
    rollback_proof_inventory: record.rollback_proof_inventory,
    grep_marker_inventory: record.grep_marker_inventory,
    governance_amendment_inventory: record.governance_amendment_inventory,
    baseline_sha_verification: record.baseline_sha_verification,
    gap_notes: record.gap_notes,
  });
  const evidenceSha = sha256Hex(canonicalForHash);

  const finalRecord: EvidenceCollectionSuccess = { ...record, evidence_sha256: evidenceSha };

  // Bounded output check (measured by canonical serialisation + evidence hash length)
  const outputSize = Buffer.byteLength(canonicalForHash, "utf8") + evidenceSha.length + 128;
  if (outputSize > EEC_MAX_OUTPUT_BYTES) {
    return fail("EEC_OUTPUT_TOO_LARGE", `assembled evidence ${outputSize} bytes > ${EEC_MAX_OUTPUT_BYTES}`);
  }

  return finalRecord;
}

// Explicit re-exports for tests that import types from the primitive itself
export type {
  EvidenceCollectionFailure,
  EvidenceCollectionRefusalCode,
  EvidenceCollectionRequest,
  EvidenceCollectionResult,
  EvidenceCollectionSuccess,
  EvidenceGapNote,
  EvidenceGapNoteKind,
  EvidenceKind,
} from "./evidence-collector-types";
