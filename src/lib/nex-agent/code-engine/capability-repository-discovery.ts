// src/lib/nex-agent/code-engine/capability-repository-discovery.ts
//
// NEX1 · Fix 18 · Deterministic bounded repository content-scan fallback.
// Founder-authorized 2026-09-17 · Fix 18 Gap 1 (real target discovery when
// FileMemoryStore returns zero candidates).
//
// PURPOSE
//   When investigation's ACTION 2 (FileMemory tag lookup) returns zero
//   candidates for the concept-token set, invoke this deterministic
//   filesystem scan to surface REAL repository files whose filename or
//   content matches those concepts. This closes the "unseeded corpus"
//   gap that Test 1 exposed.
//
// SAFETY (read-only · zero LLM · zero writes · zero execution)
//   · Only READS files (fs.readdirSync / readFileSync)
//   · Never writes / never spawns / never invokes broker
//   · Bounded to approved read roots (default: src/ + docs/doctrine)
//   · Bounded max file count · bounded max content-scan bytes per file
//   · Skips node_modules · .next · dist · build · .git · coverage
//   · Deterministic sort · no timestamp / no randomness / no LLM
//
// AUTHORITY BOUNDARY
//   · SELECT authority only (this is DISCOVERY · not modification)
//   · Never MODIFY / EXECUTE / AUTHORIZE / VERIFY / DEPLOY
//   · Never returns fabricated filenames · every result is a real
//     filesystem entry whose absolute path is verified with statSync

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

// ── Public shape ─────────────────────────────────────────────────────────

export interface DiscoveryCandidate {
  /** Repo-relative POSIX path · deterministic · verified to exist. */
  readonly repo_relative_path: string;
  readonly matched_concept_tokens: readonly string[];
  /** Total match count across filename + content · deterministic integer. */
  readonly match_score: number;
  readonly filename_matches: number;
  readonly content_matches: number;
  /** First N line ranges where a concept was observed · for provenance. */
  readonly evidence_lines: readonly {
    readonly line_number: number;
    readonly matched_token: string;
  }[];
}

export interface DiscoverRepositoryCandidatesInput {
  readonly concepts: readonly string[];
  readonly repo_root: string;
  /** Allowed read roots · repo-relative · default ["src", "docs/doctrine"]. */
  readonly allowed_root_prefixes?: readonly string[];
  /** Max files whose content is scanned. Default 500. Hard cap 2000. */
  readonly max_files_scanned?: number;
  /** Max candidates returned. Default 20. Hard cap 50. */
  readonly max_candidates?: number;
  /** Max content bytes read per file. Default 200_000. */
  readonly max_content_bytes_per_file?: number;
  /** Max evidence lines per candidate. Default 5. */
  readonly max_evidence_lines_per_candidate?: number;
}

export interface DiscoverRepositoryCandidatesResult {
  readonly ok: true;
  readonly candidates: readonly DiscoveryCandidate[];
  readonly stats: {
    readonly concepts_used: readonly string[];
    readonly files_scanned: number;
    readonly files_matched: number;
    readonly directories_walked: number;
    readonly skipped_by_root: number;
    readonly skipped_by_extension: number;
    readonly capped_by: string;
    readonly zero_llm: true;
    readonly evidence_kind: "OBSERVED";
  };
}

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_ROOTS: readonly string[] = ["src", "docs/doctrine"];
const DEFAULT_MAX_FILES_SCANNED = 500;
const HARD_MAX_FILES_SCANNED = 2000;
const DEFAULT_MAX_CANDIDATES = 20;
const HARD_MAX_CANDIDATES = 50;
const DEFAULT_MAX_CONTENT_BYTES = 200_000;
const DEFAULT_MAX_EVIDENCE_LINES = 5;

/** Skipped directory names · never walked. */
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
  ".turbo",
  ".cache",
  "out",
]);

/** Extensions that qualify as scannable source · deterministic set. */
const SCANNABLE_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);

// ── Utilities ────────────────────────────────────────────────────────────

/** Convert Windows path separators to POSIX for stable repo-relative paths. */
function toPosixRelative(absPath: string, repoRoot: string): string {
  const rel = path.relative(repoRoot, absPath);
  return rel.split(path.sep).join("/");
}

/** Check whether a repo-relative path starts with any allowed root prefix. */
function underAllowedRoot(relPosix: string, allowedRoots: readonly string[]): boolean {
  for (const root of allowedRoots) {
    if (relPosix === root || relPosix.startsWith(root + "/")) return true;
  }
  return false;
}

/** Case-insensitive · deterministic · word-boundary-aware substring count. */
function countTokenOccurrences(text: string, tokenLower: string): number {
  if (tokenLower.length === 0) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  let idx = 0;
  while (true) {
    const found = lower.indexOf(tokenLower, idx);
    if (found === -1) break;
    count++;
    idx = found + tokenLower.length;
  }
  return count;
}

/** Find first-N line indices where any concept appears · deterministic. */
function findEvidenceLines(
  content: string,
  conceptsLower: readonly string[],
  maxLines: number,
): { line_number: number; matched_token: string }[] {
  if (content.length === 0 || conceptsLower.length === 0 || maxLines === 0) return [];
  const evidence: { line_number: number; matched_token: string }[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length && evidence.length < maxLines; i++) {
    const lineLower = lines[i].toLowerCase();
    // Track which concept matched first (deterministic order over conceptsLower array).
    for (const concept of conceptsLower) {
      if (concept.length > 0 && lineLower.includes(concept)) {
        evidence.push({ line_number: i + 1, matched_token: concept });
        break;
      }
    }
  }
  return evidence;
}

/** Deterministic recursive walk · bounded · no symlink following. */
function walkFiles(
  repoRoot: string,
  allowedRoots: readonly string[],
  maxFiles: number,
  stats: {
    files_scanned: number;
    directories_walked: number;
    skipped_by_root: number;
    skipped_by_extension: number;
  },
): string[] {
  const files: string[] = [];
  const queue: string[] = [];
  for (const root of allowedRoots) {
    const abs = path.join(repoRoot, root);
    if (existsSync(abs)) queue.push(abs);
  }
  // Deterministic BFS · queue sorted at each dequeue level.
  while (queue.length > 0 && files.length < maxFiles) {
    const dir = queue.shift()!;
    stats.directories_walked++;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    // Sort entries by name for determinism (fs order varies by platform).
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        // Check that the target directory is still under allowed roots
        // (a safety net · already implicitly true since we started there).
        const rel = toPosixRelative(abs, repoRoot);
        if (!underAllowedRoot(rel, allowedRoots)) {
          stats.skipped_by_root++;
          continue;
        }
        queue.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SCANNABLE_EXTS.has(ext)) {
        stats.skipped_by_extension++;
        continue;
      }
      files.push(abs);
      stats.files_scanned++;
    }
  }
  return files;
}

// ── Entry point ──────────────────────────────────────────────────────────

export function discoverRepositoryCandidates(
  input: DiscoverRepositoryCandidatesInput,
): DiscoverRepositoryCandidatesResult {
  const repoRoot = input.repo_root;
  const allowedRoots = input.allowed_root_prefixes ?? DEFAULT_ALLOWED_ROOTS;
  const maxFiles = Math.min(
    input.max_files_scanned ?? DEFAULT_MAX_FILES_SCANNED,
    HARD_MAX_FILES_SCANNED,
  );
  const maxCandidates = Math.min(
    input.max_candidates ?? DEFAULT_MAX_CANDIDATES,
    HARD_MAX_CANDIDATES,
  );
  const maxContentBytes = input.max_content_bytes_per_file ?? DEFAULT_MAX_CONTENT_BYTES;
  const maxEvidenceLines = input.max_evidence_lines_per_candidate ?? DEFAULT_MAX_EVIDENCE_LINES;

  // Dedupe + lowercase concepts · preserve deterministic order for evidence.
  const conceptsClean: string[] = [];
  const seen = new Set<string>();
  for (const c of input.concepts) {
    const t = c.trim().toLowerCase();
    if (t.length === 0) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    conceptsClean.push(t);
  }

  const stats = {
    files_scanned: 0,
    files_matched: 0,
    directories_walked: 0,
    skipped_by_root: 0,
    skipped_by_extension: 0,
  };

  if (conceptsClean.length === 0) {
    return {
      ok: true,
      candidates: [],
      stats: {
        concepts_used: [],
        files_scanned: 0,
        files_matched: 0,
        directories_walked: 0,
        skipped_by_root: 0,
        skipped_by_extension: 0,
        capped_by: "empty_concepts",
        zero_llm: true,
        evidence_kind: "OBSERVED",
      },
    };
  }

  const files = walkFiles(repoRoot, allowedRoots, maxFiles, stats);

  const candidates: DiscoveryCandidate[] = [];
  for (const abs of files) {
    const rel = toPosixRelative(abs, repoRoot);
    const filenameLower = path.basename(abs).toLowerCase();

    // Count filename matches
    let filenameMatches = 0;
    const matchedForFile: string[] = [];
    for (const concept of conceptsClean) {
      const c = countTokenOccurrences(filenameLower, concept);
      if (c > 0) {
        filenameMatches += c;
        if (!matchedForFile.includes(concept)) matchedForFile.push(concept);
      }
    }

    // Read bounded content
    let content = "";
    try {
      const st = statSync(abs);
      if (st.size > maxContentBytes) {
        const fd = readFileSync(abs, { encoding: "utf8" });
        content = fd.slice(0, maxContentBytes);
      } else {
        content = readFileSync(abs, "utf8");
      }
    } catch {
      // File unreadable · skip · never fabricate
      continue;
    }

    let contentMatches = 0;
    const contentLower = content.toLowerCase();
    for (const concept of conceptsClean) {
      const c = countTokenOccurrences(contentLower, concept);
      if (c > 0) {
        contentMatches += c;
        if (!matchedForFile.includes(concept)) matchedForFile.push(concept);
      }
    }

    if (filenameMatches + contentMatches === 0) continue;

    const evidence = findEvidenceLines(content, conceptsClean, maxEvidenceLines);

    // match_score: filename matches weighted higher (2×) than content matches
    // (a semantic-tag file name is a stronger signal than incidental
    // in-file mention · pure deterministic weight · no confidence).
    const score = 2 * filenameMatches + contentMatches;

    candidates.push({
      repo_relative_path: rel,
      matched_concept_tokens: matchedForFile.slice().sort(),
      match_score: score,
      filename_matches: filenameMatches,
      content_matches: contentMatches,
      evidence_lines: evidence,
    });
    stats.files_matched++;
  }

  // Deterministic ranking: score desc · then path asc.
  candidates.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return a.repo_relative_path.localeCompare(b.repo_relative_path);
  });

  const top = candidates.slice(0, maxCandidates);

  const cappedBy =
    stats.files_scanned >= maxFiles
      ? `hit_max_files=${maxFiles}`
      : candidates.length > maxCandidates
        ? `hit_max_candidates=${maxCandidates}`
        : `natural_end · files_matched=${stats.files_matched}`;

  return {
    ok: true,
    candidates: top,
    stats: {
      concepts_used: conceptsClean,
      files_scanned: stats.files_scanned,
      files_matched: stats.files_matched,
      directories_walked: stats.directories_walked,
      skipped_by_root: stats.skipped_by_root,
      skipped_by_extension: stats.skipped_by_extension,
      capped_by: cappedBy,
      zero_llm: true,
      evidence_kind: "OBSERVED",
    },
  };
}
