// src/lib/nex-agent/code-engine/capability-git-archaeologist.ts
//
// NEX1 Git Archaeology Capability
//
// A NEX1 code-engine capability providing six read-only git-history
// operations for a tracked file in any local git working tree:
//
//   R-01  history_hashes         · enumerate commits touching a path (or lines)
//   R-02  read_commit            · extract commit metadata + intent signals
//   R-03  changed_file_details   · list changed paths + renames for a commit
//   R-04  blame_authors          · per-line authorship over an optional range
//   R-05  historical_paths       · reconstruct the path's rename chain
//   R-06  summarize_co_changes   · identify frequently co-changed files
//
// AUTHORISATION
//   Founder-authorised 2026-09-19 (X-01 reconstruction authorisation gate).
//
// PROVENANCE (external material studied to define the contract)
//   Recorded and preserved in the NEX audit record. See:
//     docs/doctrine/nex1-x-01-provenance-2026-09-19.md
//   NEX source carries only NEX identity. Runtime execution is self-
//   contained and does not depend on any external repository or service.
//
// SCOPE (strict)
//   R-01..R-06 only. Not in scope:
//     - Project Registry / endpoint / UI / agent registration
//     - Fixtures, test files, verification harnesses
//     - Narrative / LLM interpretation
//     - Human-readable CLI output
//     - Any behaviour outside R-01..R-06
//
// HARD BOUNDARIES (structurally enforced below)
//   - read-only:        no fs writes, no git write commands
//   - offline:          no network calls
//   - no LLM:           no model API, no prompt, no narrative layer
//   - no shell:         execFileSync list-form only
//   - bounded:          per-call timeout (default 30s)
//   - deterministic:    explicit sort keys; contracted formulas
//   - path-constrained: workspace_root + relative + inside-repo check
//
// DESIGN DECISIONS (see audit record for full rationale)
//   DD-01 subprocess pattern     · DD-02 dash-prefixed refusal
//   DD-03 abspath (not realpath) · DD-04 configurable timeout
//   DD-05 UTF-8 replacement      · DD-06 exact classifier vocabulary
//   DD-07 binary-file inherited  · DD-08 line-porcelain state machine
//   DD-09 co-change formula      · DD-10 Result-union failure shape
//
// OPEN GAPS (documented in the audit record; not silently invented)
//   G-02 bare repos   · G-03 shallow      · G-04 detached HEAD
//   G-05 submodules   · G-06 binary files · G-07 git version
//   G-08 autocrlf     · G-09 rename edge  · G-10 ReDoS
//   G-13 Windows edge · G-14 empty log

import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const GIT_ARCHAEOLOGIST_VERSION = "git-archaeologist.v1.2026-09-19";
export const GIT_ARCHAEOLOGIST_CONTRACT = "X-01-v1";

// ── Types ────────────────────────────────────────────────────────────────

export type ArchaeologistReasonCode =
  | "REPOSITORY_PATH_NOT_A_DIRECTORY"
  | "REPOSITORY_PATH_STARTS_WITH_DASH"
  | "NOT_A_GIT_REPOSITORY"
  | "FILE_MUST_BE_INSIDE_REPOSITORY"
  | "FILE_NOT_TRACKED_AT_HEAD"
  | "LINE_RANGE_MALFORMED"
  | "LINE_RANGE_START_EXCEEDS_END"
  | "LINE_RANGE_EXCEEDS_FILE_LENGTH"
  | "NO_COMMITS_FOUND_FOR_PATH"
  | "COMMIT_METADATA_UNPARSEABLE"
  | "GIT_NOT_INSTALLED"
  | "GIT_COMMAND_TIMED_OUT"
  | "GIT_COMMAND_FAILED";

export interface ArchaeologistFailure {
  readonly ok: false;
  readonly reason_code: ArchaeologistReasonCode;
  readonly reason: string;
}

export interface LineRange {
  readonly start: number;   // 1-indexed inclusive
  readonly end: number;     // 1-indexed inclusive · start ≤ end
}

export interface CommonInput {
  /** Absolute or user-relative path to a git working tree. */
  readonly workspace_root: string;
  /** Optional per-call subprocess timeout · defaults to 30_000ms (source parity). */
  readonly timeout_ms?: number;
}

export interface PathScopedInput extends CommonInput {
  /** Path to a tracked file, relative to workspace_root (or absolute inside it). */
  readonly file_path: string;
  /** Optional line range · inclusive positive integers. */
  readonly line_range?: LineRange | null;
}

// ── R-01 · history_hashes ────────────────────────────────────────────────
// Source contract B-07: git log oldest-first, deduplicated, mode-aware.

export type HistoryHashesResult =
  | {
      readonly ok: true;
      readonly hashes: readonly string[];
      readonly mode: "lines" | "file";
      readonly resolved_workspace: string;
      readonly resolved_relative_path: string;
      readonly version: string;
    }
  | ArchaeologistFailure;

// ── R-02 · commit metadata ──────────────────────────────────────────────
// Source contract B-08 + B-09 + B-10 + B-11 embedded.

export type CommitCategory =
  | "merge"
  | "revert"
  | "hotfix"
  | "refactor"
  | "fix"
  | "feat"
  | "other";

export interface CommitRenameEntry {
  readonly from: string;
  readonly to: string;
}

export interface CommitMetadata {
  readonly hash: string;
  readonly short_hash: string;      // first 12 chars
  readonly author: string;
  readonly email: string;
  readonly date: string;            // ISO-8601 (git %aI)
  readonly subject: string;
  readonly body: string;
  readonly category: CommitCategory;
  readonly changed_files: readonly string[];
  readonly renames: readonly CommitRenameEntry[];
  readonly intent_signal_types: readonly string[];
}

export interface IntentSignal {
  readonly type: string;
  readonly commit: string;
  readonly evidence: string;
  readonly subject: string;
}

export type ReadCommitResult =
  | { readonly ok: true; readonly commit: CommitMetadata; readonly signals: readonly IntentSignal[]; readonly version: string }
  | ArchaeologistFailure;

// ── R-03 · changed files + renames ──────────────────────────────────────

export type ChangedFileDetailsResult =
  | { readonly ok: true; readonly paths: readonly string[]; readonly renames: readonly CommitRenameEntry[]; readonly version: string }
  | ArchaeologistFailure;

// ── R-04 · per-line blame authorship ────────────────────────────────────

export interface BlameAuthorEntry {
  readonly name: string;
  readonly email: string;      // as observed (with case preserved)
  readonly line_count: number;
}

export type BlameAuthorsResult =
  | { readonly ok: true; readonly authors: readonly BlameAuthorEntry[]; readonly version: string }
  | ArchaeologistFailure;

// ── R-05 · historical path / rename-alias reconstruction ────────────────

export interface HistoricalPathsResult {
  readonly aliases: readonly string[]; // sorted · always includes the current path
  readonly version: string;
}

// ── R-06 · co-change analysis ───────────────────────────────────────────

export interface CoChangedFile {
  readonly file: string;
  readonly count: number;
  readonly commit_ratio: number;      // rounded to 3 decimal places
  readonly commits: readonly string[];
}

export interface CoChangeAnalysis {
  readonly threshold: number;
  readonly aliases: readonly string[];
  readonly co_changed: readonly CoChangedFile[];
  readonly version: string;
}

// ── Public entry: input validation + resolution ─────────────────────────

interface ResolvedInputs {
  readonly repo_root: string;         // absolute · verified directory + git top-level
  readonly relative_path: string;     // POSIX-style · verified inside repo + tracked at HEAD
}

function resolveInputs(input: PathScopedInput): { ok: true; resolved: ResolvedInputs } | ArchaeologistFailure {
  const timeout = input.timeout_ms ?? 30_000;

  // DD-02 · S-01 mitigation
  const basename = path.basename(input.workspace_root);
  if (basename.startsWith("-") || input.workspace_root.startsWith("-")) {
    return fail(
      "REPOSITORY_PATH_STARTS_WITH_DASH",
      `workspace_root basename may not start with "-" (received "${basename}")`,
    );
  }

  // DD-03 · path.resolve (not realpath) · matches source os.path.abspath
  const repoHint = path.resolve(input.workspace_root);
  if (!existsSync(repoHint)) {
    return fail("REPOSITORY_PATH_NOT_A_DIRECTORY", `repository path is not a directory: ${input.workspace_root}`);
  }
  let hintStat;
  try {
    hintStat = statSync(repoHint);
  } catch (err) {
    return fail("REPOSITORY_PATH_NOT_A_DIRECTORY", `stat failed: ${errMsg(err)}`);
  }
  if (!hintStat.isDirectory()) {
    return fail("REPOSITORY_PATH_NOT_A_DIRECTORY", `repository path is not a directory: ${input.workspace_root}`);
  }

  // Discover git top-level
  const topLevel = runGit(repoHint, ["rev-parse", "--show-toplevel"], { required: false, timeout });
  if (!topLevel.ok) {
    if (topLevel.reason_code === "GIT_NOT_INSTALLED" || topLevel.reason_code === "GIT_COMMAND_TIMED_OUT") return topLevel;
    return fail("NOT_A_GIT_REPOSITORY", `not a git repository: ${input.workspace_root}`);
  }
  const rootTrimmed = topLevel.stdout.trim();
  if (rootTrimmed.length === 0) {
    return fail("NOT_A_GIT_REPOSITORY", `not a git repository: ${input.workspace_root}`);
  }
  const repoRoot = path.resolve(rootTrimmed);

  // Resolve file path · absolute inputs allowed if inside repo
  let candidate: string;
  if (path.isAbsolute(input.file_path)) {
    candidate = path.resolve(input.file_path);
  } else {
    candidate = path.resolve(repoRoot, input.file_path);
  }

  // Inside-repo boundary via path.relative · never leaves repoRoot
  const rel = path.relative(repoRoot, candidate);
  const escapes = rel.length === 0
    ? false // rel="" means candidate === repoRoot (a directory not a file)
    : rel.startsWith("..") || path.isAbsolute(rel);
  if (escapes) {
    return fail("FILE_MUST_BE_INSIDE_REPOSITORY", `file must be inside the repository`);
  }

  // POSIX separator normalisation for git argument
  const relativePosix = rel.split(path.sep).join("/");
  if (relativePosix.length === 0) {
    return fail("FILE_MUST_BE_INSIDE_REPOSITORY", `file path resolves to the repository root · a file is required`);
  }

  // Tracked-at-HEAD check
  const tracked = runGit(repoRoot, ["ls-files", "--error-unmatch", "--", relativePosix], { required: false, timeout });
  if (!tracked.ok) {
    if (tracked.reason_code === "GIT_NOT_INSTALLED" || tracked.reason_code === "GIT_COMMAND_TIMED_OUT") return tracked;
    // ls-files with --error-unmatch returns non-zero for untracked
    return fail("FILE_NOT_TRACKED_AT_HEAD", `file is not tracked at HEAD: ${relativePosix}`);
  }
  if (tracked.stdout.trim().length === 0) {
    return fail("FILE_NOT_TRACKED_AT_HEAD", `file is not tracked at HEAD: ${relativePosix}`);
  }

  return { ok: true, resolved: { repo_root: repoRoot, relative_path: relativePosix } };
}

// ── R-01 · historyHashes ────────────────────────────────────────────────

export function historyHashes(input: PathScopedInput): HistoryHashesResult {
  const timeout = input.timeout_ms ?? 30_000;
  const resolvedRes = resolveInputs(input);
  if (!("ok" in resolvedRes) || !resolvedRes.ok) return resolvedRes as ArchaeologistFailure;
  const { repo_root, relative_path } = resolvedRes.resolved;

  const rangeRes = validateRange(repo_root, relative_path, input.line_range ?? null, timeout);
  if (!rangeRes.ok) return rangeRes;

  const mode: "lines" | "file" = input.line_range ? "lines" : "file";
  const args = input.line_range
    ? ["log", "--format=%H", "--no-patch", "-L", `${input.line_range.start},${input.line_range.end}:${relative_path}`]
    : ["log", "--format=%H", "--no-patch", "--follow", "--", relative_path];

  const logRes = runGit(repo_root, args, { required: true, timeout });
  if (!logRes.ok) return logRes;

  const newestFirst = logRes.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  // Source contract: reverse → oldest-first, then dedupe preserving order
  const seen = new Set<string>();
  const hashes: string[] = [];
  for (let i = newestFirst.length - 1; i >= 0; i--) {
    const h = newestFirst[i];
    if (!seen.has(h)) {
      seen.add(h);
      hashes.push(h);
    }
  }
  if (hashes.length === 0) {
    return fail("NO_COMMITS_FOUND_FOR_PATH", `no commits found for ${relative_path}`);
  }
  return {
    ok: true,
    hashes,
    mode,
    resolved_workspace: repo_root,
    resolved_relative_path: relative_path,
    version: GIT_ARCHAEOLOGIST_VERSION,
  };
}

// ── R-02 · readCommit ───────────────────────────────────────────────────

// DD-06 · exact classifier vocabulary fixed by the X-01-v1 contract
const CLASSIFIER_PRIORITY: readonly { readonly cat: CommitCategory; readonly rx: RegExp; readonly checkSubjectStartMerge?: boolean }[] = [
  { cat: "merge",    rx: /^$/, checkSubjectStartMerge: true },  // handled specially
  { cat: "revert",   rx: /\brevert(?:ed|s|ing)?\b/i },
  { cat: "hotfix",   rx: /\bhot[ -]?fix\b/i },
  { cat: "refactor", rx: /\b(refactor|cleanup|restructure|rename)\b/i },
  { cat: "fix",      rx: /\b(fix|fixed|fixes|bug|patch)\b/i },
  { cat: "feat",     rx: /\b(feat|feature|add|added|introduce|implement)\b/i },
];

function classifyMessage(subject: string, body: string): CommitCategory {
  // Source contract: subject.lower().startswith("merge ") → merge
  if (subject.toLowerCase().startsWith("merge ")) return "merge";
  const text = `${subject}\n${body}`;
  const lowered = text.toLowerCase();
  for (const entry of CLASSIFIER_PRIORITY) {
    if (entry.checkSubjectStartMerge) continue;
    if (entry.rx.test(lowered)) return entry.cat;
  }
  return "other";
}

// DD-06 · exact source regex patterns
const ISSUE_RE = /(?<![\w/])(?:#[0-9]+|(?:pr|issue|gh)[\s:#-]*[0-9]+)/gi;
const INTENT_PATTERNS: readonly { readonly type: string; readonly rx: RegExp }[] = [
  { type: "revert",     rx: /\brevert(?:ed|s|ing)?\b/i },
  { type: "workaround", rx: /\bwork[ -]?around\b/i },
  { type: "temporary",  rx: /\b(?:temporary|temporarily|temp)\b/i },
  { type: "todo",       rx: /\bTODO\b/i },
];

function intentSignals(commitHash: string, subject: string, body: string): IntentSignal[] {
  const text = `${subject}\n${body}`;
  const signals: IntentSignal[] = [];
  const issueMatches = text.matchAll(ISSUE_RE);
  for (const m of issueMatches) {
    signals.push({ type: "issue_reference", commit: commitHash, evidence: m[0], subject });
  }
  for (const p of INTENT_PATTERNS) {
    const m = p.rx.exec(text);
    if (m) {
      signals.push({ type: p.type, commit: commitHash, evidence: m[0], subject });
    }
  }
  return signals;
}

export function readCommit(input: CommonInput & { readonly commit_hash: string }): ReadCommitResult {
  const timeout = input.timeout_ms ?? 30_000;

  // Repo path validation only (no file scope for readCommit)
  const basename = path.basename(input.workspace_root);
  if (basename.startsWith("-") || input.workspace_root.startsWith("-")) {
    return fail("REPOSITORY_PATH_STARTS_WITH_DASH", `workspace_root basename may not start with "-"`);
  }
  const repoHint = path.resolve(input.workspace_root);
  if (!existsSync(repoHint)) return fail("REPOSITORY_PATH_NOT_A_DIRECTORY", `repository path is not a directory: ${input.workspace_root}`);
  let st;
  try { st = statSync(repoHint); } catch (err) { return fail("REPOSITORY_PATH_NOT_A_DIRECTORY", `stat failed: ${errMsg(err)}`); }
  if (!st.isDirectory()) return fail("REPOSITORY_PATH_NOT_A_DIRECTORY", `not a directory`);
  const topLevel = runGit(repoHint, ["rev-parse", "--show-toplevel"], { required: false, timeout });
  if (!topLevel.ok) {
    if (topLevel.reason_code === "GIT_NOT_INSTALLED" || topLevel.reason_code === "GIT_COMMAND_TIMED_OUT") return topLevel;
    return fail("NOT_A_GIT_REPOSITORY", `not a git repository`);
  }
  const repoRoot = path.resolve(topLevel.stdout.trim());

  // Source contract: %H\x00%an\x00%ae\x00%aI\x00%s\x00%b · split into exactly 6 parts
  const format = "%H%x00%an%x00%ae%x00%aI%x00%s%x00%b";
  const showRes = runGit(repoRoot, ["show", "-s", `--format=${format}`, input.commit_hash], { required: true, timeout });
  if (!showRes.ok) return showRes;
  const raw = showRes.stdout.replace(/\n+$/, "");
  const parts = raw.split("\x00");
  // Source contract: `raw.split("\x00", 5)` in Python yields up to 6 parts.
  // In JS split without limit yields all parts; we require ≥6 and treat any
  // additional parts (unlikely; would only occur if a null appears inside %b)
  // as part of the body via re-joining. This preserves source-observable
  // "exactly 6 fields expected" semantics.
  if (parts.length < 6) {
    return fail("COMMIT_METADATA_UNPARSEABLE", `could not parse commit metadata for ${input.commit_hash}`);
  }
  const [hashField, author, email, date, subject, ...bodyParts] = parts;
  const body = bodyParts.join("\x00");

  const signals = intentSignals(hashField, subject, body);
  const cf = changedFileDetailsInternal(repoRoot, hashField, timeout);
  if (!cf.ok) return cf;

  const commit: CommitMetadata = {
    hash: hashField,
    short_hash: hashField.slice(0, 12),
    author,
    email,
    date,
    subject,
    body: body.trim(),
    category: classifyMessage(subject, body),
    changed_files: cf.paths,
    renames: cf.renames,
    intent_signal_types: signals.map((s) => s.type),
  };
  return { ok: true, commit, signals, version: GIT_ARCHAEOLOGIST_VERSION };
}

// ── R-03 · changedFileDetails ───────────────────────────────────────────

export function changedFileDetails(input: CommonInput & { readonly commit_hash: string }): ChangedFileDetailsResult {
  const timeout = input.timeout_ms ?? 30_000;
  const basename = path.basename(input.workspace_root);
  if (basename.startsWith("-") || input.workspace_root.startsWith("-")) {
    return fail("REPOSITORY_PATH_STARTS_WITH_DASH", `workspace_root basename may not start with "-"`);
  }
  const repoHint = path.resolve(input.workspace_root);
  if (!existsSync(repoHint)) return fail("REPOSITORY_PATH_NOT_A_DIRECTORY", `not a directory`);
  const topLevel = runGit(repoHint, ["rev-parse", "--show-toplevel"], { required: false, timeout });
  if (!topLevel.ok) {
    if (topLevel.reason_code === "GIT_NOT_INSTALLED" || topLevel.reason_code === "GIT_COMMAND_TIMED_OUT") return topLevel;
    return fail("NOT_A_GIT_REPOSITORY", `not a git repository`);
  }
  const repoRoot = path.resolve(topLevel.stdout.trim());
  return changedFileDetailsInternal(repoRoot, input.commit_hash, timeout);
}

function changedFileDetailsInternal(repoRoot: string, commitHash: string, timeout: number): ChangedFileDetailsResult {
  // Source contract B-11 · exact args:
  //   git diff-tree --root --no-commit-id --name-status -r -M <hash> --
  const args = ["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-M", commitHash, "--"];
  const res = runGit(repoRoot, args, { required: true, timeout });
  if (!res.ok) return res;
  const paths = new Set<string>();
  const renames: CommitRenameEntry[] = [];
  for (const line of res.stdout.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const fields = line.split("\t");
    if (fields.length >= 3 && fields[0].startsWith("R")) {
      const oldPath = fields[1];
      const newPath = fields[2];
      paths.add(oldPath);
      paths.add(newPath);
      renames.push({ from: oldPath, to: newPath });
    } else if (fields.length >= 2) {
      // Source contract: paths.add(fields[-1])
      paths.add(fields[fields.length - 1]);
    }
  }
  return {
    ok: true,
    paths: Object.freeze([...paths].sort()),
    renames: Object.freeze(renames),
    version: GIT_ARCHAEOLOGIST_VERSION,
  };
}

// ── R-04 · blameAuthors ─────────────────────────────────────────────────

export function blameAuthors(input: PathScopedInput): BlameAuthorsResult {
  const timeout = input.timeout_ms ?? 30_000;
  const resolvedRes = resolveInputs(input);
  if (!("ok" in resolvedRes) || !resolvedRes.ok) return resolvedRes as ArchaeologistFailure;
  const { repo_root, relative_path } = resolvedRes.resolved;

  // Source contract B-12: git blame --line-porcelain [-L a,b] HEAD -- <path>
  const args: string[] = ["blame", "--line-porcelain"];
  if (input.line_range) {
    args.push("-L", `${input.line_range.start},${input.line_range.end}`);
  }
  args.push("HEAD", "--", relative_path);

  const res = runGit(repo_root, args, { required: false, timeout });
  if (!res.ok) {
    if (res.reason_code === "GIT_NOT_INSTALLED" || res.reason_code === "GIT_COMMAND_TIMED_OUT") return res;
    // Source contract: required=False → empty counters
    return { ok: true, authors: [], version: GIT_ARCHAEOLOGIST_VERSION };
  }

  // DD-08 · state machine over --line-porcelain
  const counts = new Map<string, number>();
  const names = new Map<string, { name: string; email: string }>();
  let currentName = "";
  let currentEmail = "";
  for (const line of res.stdout.split(/\r?\n/)) {
    if (line.startsWith("author ")) {
      currentName = line.slice(7);
    } else if (line.startsWith("author-mail ")) {
      currentEmail = line.slice(12).replace(/^</, "").replace(/>$/, "").trim();
    } else if (line.startsWith("\t")) {
      // \t-prefixed line is the content-line marker · attribute to current author
      if (currentEmail.length > 0) {
        const key = currentEmail.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (!names.has(key)) names.set(key, { name: currentName, email: currentEmail });
      }
      currentName = "";
      currentEmail = "";
    }
  }
  const authors: BlameAuthorEntry[] = [];
  for (const [key, count] of counts.entries()) {
    const n = names.get(key)!;
    authors.push({ name: n.name, email: n.email, line_count: count });
  }
  // Deterministic sort · descending line_count then name (case-insensitive) then email (case-insensitive)
  authors.sort((a, b) => {
    if (a.line_count !== b.line_count) return b.line_count - a.line_count;
    const an = a.name.toLowerCase(); const bn = b.name.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    const ae = a.email.toLowerCase(); const be = b.email.toLowerCase();
    if (ae !== be) return ae < be ? -1 : 1;
    return 0;
  });
  return { ok: true, authors: Object.freeze(authors), version: GIT_ARCHAEOLOGIST_VERSION };
}

// ── R-05 · historicalPaths ──────────────────────────────────────────────

export function historicalPaths(input: {
  readonly current_path: string;
  readonly timeline: readonly Pick<CommitMetadata, "renames">[];
}): HistoricalPathsResult {
  // Source contract B-14: walk renames reversed(timeline) newest→oldest;
  // for each rename in the entry, if `to` is in the alias set, add `from`.
  const aliases = new Set<string>([input.current_path]);
  for (let i = input.timeline.length - 1; i >= 0; i--) {
    const entry = input.timeline[i];
    for (const r of entry.renames) {
      if (aliases.has(r.to)) aliases.add(r.from);
    }
  }
  return {
    aliases: Object.freeze([...aliases].sort()),
    version: GIT_ARCHAEOLOGIST_VERSION,
  };
}

// ── R-06 · summarizeCoChanges ───────────────────────────────────────────

export function summarizeCoChanges(input: {
  readonly current_path: string;
  readonly timeline: readonly Pick<CommitMetadata, "hash" | "changed_files" | "renames">[];
}): CoChangeAnalysis {
  // DD-09 · source formula: max(2, (n + 2) // 3)
  const n = input.timeline.length;
  const threshold = Math.max(2, Math.floor((n + 2) / 3));

  // Alias set (delegates to R-05 behaviour without double-work)
  const aliases = new Set<string>([input.current_path]);
  for (let i = input.timeline.length - 1; i >= 0; i--) {
    for (const r of input.timeline[i].renames) {
      if (aliases.has(r.to)) aliases.add(r.from);
    }
  }

  // Source contract B-15: group commits per non-alias file
  const commitsByFile = new Map<string, string[]>();
  for (const entry of input.timeline) {
    for (const changed of entry.changed_files) {
      if (aliases.has(changed)) continue;
      let arr = commitsByFile.get(changed);
      if (!arr) { arr = []; commitsByFile.set(changed, arr); }
      arr.push(entry.hash);
    }
  }
  const co: CoChangedFile[] = [];
  for (const [file, commits] of commitsByFile.entries()) {
    if (commits.length >= threshold) {
      co.push({
        file,
        count: commits.length,
        commit_ratio: n > 0 ? Math.round((commits.length / n) * 1000) / 1000 : 0,
        commits: Object.freeze([...commits]),
      });
    }
  }
  // Source contract sort: (-count, file)
  co.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  });
  return {
    threshold,
    aliases: Object.freeze([...aliases].sort()),
    co_changed: Object.freeze(co),
    version: GIT_ARCHAEOLOGIST_VERSION,
  };
}

// ── Line-range parsing + validation ─────────────────────────────────────

const LINE_RANGE_RE = /^([1-9][0-9]*)-([1-9][0-9]*)$/;

/**
 * Parse a positive `A-B` line range string, matching source contract B-05.
 * Returns null if input is null/undefined. Returns a failure on malformed input.
 */
export function parseLineRange(value: string | null | undefined):
  | { readonly ok: true; readonly range: LineRange | null }
  | ArchaeologistFailure {
  if (value === null || value === undefined) return { ok: true, range: null };
  const m = LINE_RANGE_RE.exec(value);
  if (!m) return fail("LINE_RANGE_MALFORMED", `line range must use positive A-B form, such as 40-72`);
  const start = Number.parseInt(m[1], 10);
  const end = Number.parseInt(m[2], 10);
  if (start > end) return fail("LINE_RANGE_START_EXCEEDS_END", `line range start must not exceed its end`);
  return { ok: true, range: { start, end } };
}

// Source contract B-06 · validate line range against HEAD file length
function validateRange(repoRoot: string, relativePath: string, range: LineRange | null, timeout: number): { ok: true } | ArchaeologistFailure {
  if (range === null) return { ok: true };
  const showRes = runGit(repoRoot, ["show", `HEAD:${relativePath}`], { required: true, timeout });
  if (!showRes.ok) return showRes;
  // DD-07 · binary handling: inherit source behaviour (split by newline · works for text)
  const lineCount = showRes.stdout.split("\n").length;
  if (range.end > lineCount) {
    return fail(
      "LINE_RANGE_EXCEEDS_FILE_LENGTH",
      `line range ends at ${range.end}, but ${relativePath} has ${lineCount} lines at HEAD`,
    );
  }
  return { ok: true };
}

// ── Subprocess wrapper ──────────────────────────────────────────────────

interface RunGitOptions {
  readonly required: boolean;
  readonly timeout: number;
}

type RunGitResult =
  | { readonly ok: true; readonly stdout: string; readonly stderr: string }
  | ArchaeologistFailure;

function runGit(cwd: string, args: readonly string[], opts: RunGitOptions): RunGitResult {
  // DD-01 · execFileSync list-form · no shell · S-08 protected
  const execOpts: ExecFileSyncOptionsWithStringEncoding = {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
    timeout: opts.timeout,
    windowsHide: true,
  };
  try {
    const stdout = execFileSync("git", ["-C", cwd, ...args], execOpts);
    return { ok: true, stdout, stderr: "" };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { status?: number | null; stdout?: string; stderr?: string; signal?: string };
    if (e.code === "ENOENT") {
      return fail("GIT_NOT_INSTALLED", `git is not installed or is not on PATH`);
    }
    if (e.signal === "SIGTERM" || e.code === "ETIMEDOUT" || (e.message && /timed out/i.test(e.message))) {
      return fail("GIT_COMMAND_TIMED_OUT", `git command timed out after ${opts.timeout}ms`);
    }
    // Non-zero exit
    const stderr = typeof e.stderr === "string" ? e.stderr : "";
    const stdout = typeof e.stdout === "string" ? e.stdout : "";
    if (!opts.required) {
      return { ok: true, stdout: "", stderr: stderr.trim() };
    }
    const detail = stderr.trim() || stdout.trim() || "git command failed";
    return fail("GIT_COMMAND_FAILED", detail.slice(0, 400));
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function fail(code: ArchaeologistReasonCode, reason: string): ArchaeologistFailure {
  return { ok: false, reason_code: code, reason };
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 200);
  return String(e).slice(0, 200);
}
