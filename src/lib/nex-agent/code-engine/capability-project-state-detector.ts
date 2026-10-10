// src/lib/nex-agent/code-engine/capability-project-state-detector.ts
//
// NEX1 · Project State Detector · Founder-authorised 2026-09-19 (§10, §18, §19)
// Ledger B additive · Zero LLM · Deterministic · Fresh-subprocess reproducible.
//
// PURPOSE
//   Detect the actual git-committed / remote-pushed state of a user project so
//   the close-workstation flow can distinguish local save from remote push
//   with real evidence — never inferring PUSH_SUCCEEDED from commit success.
//
// FOUNDER PRINCIPLE (§19 verbatim)
//   "Never infer PUSH_SUCCEEDED from commit succeeded. A commit proves local
//    history. It does not prove remote persistence."
//
// INVARIANTS
//   · Zero LLM · pure git-plumbing calls
//   · Every state has a concrete evidence signal
//   · UNKNOWN emitted rather than guessed when signals are ambiguous
//   · Anti-fabrication: PUSH_SUCCEEDED requires observed remote-ref match
//   · Additive · never modifies frozen files
//   · Deterministic given a fixed git state
//
// AUTHORITY BOUNDARY
//   · READ authority only (uses `git status --porcelain` + `git rev-parse` etc.)
//   · Never writes, commits, pushes, or modifies git state
//   · Never invokes network operations (no `git fetch` unless caller opts in)

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const PROJECT_STATE_DETECTOR_VERSION = "project-state-detector.v1.2026-09-19";

// ── 11 evidence-based git states (founder §19) ───────────────────────────

export type ProjectGitState =
  | "NOT_A_REPOSITORY"       // .git absent · new scaffold or non-git project
  | "LOCAL_CLEAN"            // no changes, no untracked, remote up-to-date if remote present
  | "LOCAL_MODIFIED"         // tracked files modified but not staged/committed
  | "LOCAL_UNTRACKED"        // untracked files present
  | "LOCAL_COMMITTED"        // local commits exist beyond last-known remote
  | "REMOTE_BEHIND"          // local HEAD is behind remote (remote has commits we don't)
  | "REMOTE_CURRENT"         // local == remote for tracked branch
  | "PUSH_PENDING"           // local commits ahead of remote (need to push)
  | "PUSH_SUCCEEDED"         // remote_ref matches local HEAD (observed)
  | "PUSH_FAILED"            // last push attempt returned non-zero
  | "REMOTE_CONFLICT";       // diverged history · needs manual resolution

export interface ProjectStateInput {
  readonly project_root: string;
  /** Optional: caller can pass known "last push attempt outcome" evidence. */
  readonly last_push_attempt?: {
    readonly attempted_at_iso: string;
    readonly outcome: "success" | "failed" | "cancelled" | "not_attempted";
    readonly attempted_sha?: string;
    readonly error_reason?: string;
  } | null;
  /** Whether to allow network operation to fetch remote refs. Default false. */
  readonly allow_network_fetch?: boolean;
}

export interface ProjectStateAssessment {
  readonly state: ProjectGitState;
  readonly rationale: string;
  readonly evidence_signals: readonly string[];
  readonly ambiguity_flags: readonly string[];
  readonly counts: {
    readonly modified: number;
    readonly untracked: number;
    readonly staged: number;
    readonly deleted: number;
    readonly local_commits_ahead: number;
    readonly remote_commits_ahead: number;
  };
  readonly refs: {
    readonly local_head_sha: string | null;
    readonly remote_head_sha: string | null;
    readonly branch: string | null;
    readonly remote_tracking_branch: string | null;
  };
  readonly caller_should_prompt: boolean;   // true when user attention warranted
  readonly caller_may_close_silently: boolean;  // true only when state is clearly safe
  readonly input_digest: string;
  readonly assessed_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Public entry ─────────────────────────────────────────────────────────

export function assessProjectState(input: ProjectStateInput): ProjectStateAssessment {
  const project_root = path.resolve(input.project_root);
  const signals: string[] = [];
  const ambiguity: string[] = [];

  if (!existsSync(project_root)) {
    return earlyReturn("NOT_A_REPOSITORY", `project_root does not exist: ${project_root}`, input, signals, ambiguity);
  }

  const git_dir = path.join(project_root, ".git");
  if (!existsSync(git_dir)) {
    return earlyReturn("NOT_A_REPOSITORY", "no .git directory found", input, signals, ambiguity);
  }
  signals.push("git_dir_present");

  // ── Read git state deterministically via plumbing ──────────────────────
  let porcelain = "";
  let branch: string | null = null;
  let localHead: string | null = null;
  let remoteTracking: string | null = null;
  let aheadBehind: { ahead: number; behind: number } | null = null;

  try {
    porcelain = execGit(project_root, ["status", "--porcelain=v1"]);
  } catch (err) {
    ambiguity.push(`git_status_failed:${errMsg(err)}`);
  }
  try {
    branch = execGit(project_root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim() || null;
    if (branch === "HEAD") branch = null;  // detached HEAD
  } catch (err) {
    ambiguity.push(`git_branch_failed:${errMsg(err)}`);
  }
  try {
    localHead = execGit(project_root, ["rev-parse", "HEAD"]).trim() || null;
  } catch (err) {
    // If HEAD doesn't resolve, repo has no commits yet
    ambiguity.push("no_commits_yet");
  }
  if (branch !== null) {
    try {
      remoteTracking =
        execGit(project_root, ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`]).trim() || null;
    } catch {
      // no upstream configured
      remoteTracking = null;
    }
  }
  let remoteHead: string | null = null;
  if (remoteTracking !== null) {
    try {
      remoteHead = execGit(project_root, ["rev-parse", remoteTracking]).trim() || null;
    } catch (err) {
      ambiguity.push(`remote_ref_read_failed:${errMsg(err)}`);
    }
    try {
      const ab = execGit(project_root, ["rev-list", "--left-right", "--count", `HEAD...${remoteTracking}`]).trim();
      const [aheadStr, behindStr] = ab.split(/\s+/);
      aheadBehind = { ahead: Number(aheadStr) || 0, behind: Number(behindStr) || 0 };
    } catch (err) {
      ambiguity.push(`ahead_behind_failed:${errMsg(err)}`);
    }
  }

  // ── Count porcelain markers ──────────────────────────────────────────
  let modified = 0, untracked = 0, staged = 0, deleted = 0;
  for (const line of porcelain.split(/\r?\n/)) {
    if (line.length < 2) continue;
    const x = line[0], y = line[1];
    if (x === "?" && y === "?") { untracked += 1; continue; }
    if (x === "D" || y === "D") deleted += 1;
    if (x === "M" || y === "M") modified += 1;
    if (x !== " " && x !== "?") staged += 1;
  }
  signals.push(`porcelain_lines=${porcelain.split(/\r?\n/).filter(Boolean).length}`);
  signals.push(`modified=${modified}`);
  signals.push(`untracked=${untracked}`);
  signals.push(`staged=${staged}`);
  if (aheadBehind) signals.push(`ahead=${aheadBehind.ahead}·behind=${aheadBehind.behind}`);
  if (input.last_push_attempt) signals.push(`last_push_attempt=${input.last_push_attempt.outcome}`);

  // ── Ordered state predicates (deterministic) ──────────────────────────
  // 1. Recent push_failed evidence trumps other signals for this session
  // 2. REMOTE_CONFLICT: diverged history
  // 3. REMOTE_BEHIND: remote has commits we don't
  // 4. Working-tree dirty: LOCAL_MODIFIED or LOCAL_UNTRACKED
  // 5. Local ahead of remote → PUSH_PENDING
  // 6. Local HEAD == remote HEAD → REMOTE_CURRENT (and honour PUSH_SUCCEEDED
  //    only if a successful push attempt is on record AND remote matches)
  // 7. No remote configured but has commits → LOCAL_COMMITTED
  // 8. Otherwise LOCAL_CLEAN

  let state: ProjectGitState;
  let rationale: string;

  if (input.last_push_attempt?.outcome === "failed") {
    state = "PUSH_FAILED";
    rationale = `last recorded push attempt outcome was FAILED · reason=${input.last_push_attempt.error_reason ?? "unspecified"}`;
  } else if (aheadBehind && aheadBehind.ahead > 0 && aheadBehind.behind > 0) {
    state = "REMOTE_CONFLICT";
    rationale = `local and remote have diverged · ahead=${aheadBehind.ahead} behind=${aheadBehind.behind}`;
  } else if (aheadBehind && aheadBehind.behind > 0 && aheadBehind.ahead === 0) {
    state = "REMOTE_BEHIND";
    rationale = `local is behind remote · behind=${aheadBehind.behind}`;
  } else if (modified > 0 && untracked > 0) {
    state = "LOCAL_MODIFIED";
    rationale = `working tree has ${modified} modified and ${untracked} untracked files`;
    ambiguity.push("both_modified_and_untracked");
  } else if (modified > 0 || staged > 0 || deleted > 0) {
    state = "LOCAL_MODIFIED";
    rationale = `working tree has ${modified} modified · ${staged} staged · ${deleted} deleted`;
  } else if (untracked > 0) {
    state = "LOCAL_UNTRACKED";
    rationale = `${untracked} untracked file(s) present`;
  } else if (aheadBehind && aheadBehind.ahead > 0) {
    state = "PUSH_PENDING";
    rationale = `local is ahead of remote by ${aheadBehind.ahead} commit(s) · not yet pushed`;
  } else if (
    input.last_push_attempt?.outcome === "success" &&
    input.last_push_attempt.attempted_sha &&
    localHead &&
    remoteHead &&
    localHead === remoteHead &&
    input.last_push_attempt.attempted_sha === localHead
  ) {
    // ONLY declare PUSH_SUCCEEDED when we have: (a) explicit success record,
    // (b) that record's SHA matches current local HEAD, (c) remote ref
    // observably equals local HEAD. Anything less is downgraded.
    state = "PUSH_SUCCEEDED";
    rationale = `push attempt for ${input.last_push_attempt.attempted_sha.slice(0, 8)} succeeded · remote ref matches local HEAD`;
  } else if (remoteHead && localHead && localHead === remoteHead) {
    state = "REMOTE_CURRENT";
    rationale = "local HEAD matches remote tracking ref";
  } else if (localHead && remoteTracking === null) {
    state = "LOCAL_COMMITTED";
    rationale = "commits present but no upstream configured";
  } else if (localHead) {
    state = "LOCAL_CLEAN";
    rationale = "no working-tree changes · remote state indeterminate";
    ambiguity.push("no_remote_evidence");
  } else {
    state = "LOCAL_CLEAN";
    rationale = "no working-tree changes and no commits";
    ambiguity.push("no_commits_yet");
  }

  // ── Derive caller-side flags ─────────────────────────────────────────
  const caller_should_prompt =
    state === "LOCAL_MODIFIED" ||
    state === "LOCAL_UNTRACKED" ||
    state === "LOCAL_COMMITTED" ||
    state === "PUSH_PENDING" ||
    state === "PUSH_FAILED" ||
    state === "REMOTE_CONFLICT" ||
    state === "REMOTE_BEHIND";

  const caller_may_close_silently =
    state === "PUSH_SUCCEEDED" ||
    state === "REMOTE_CURRENT" ||
    (state === "LOCAL_CLEAN" && !remoteTracking);  // no remote configured · nothing to warn about

  const input_digest = createHash("sha256")
    .update(JSON.stringify({
      project_root,
      last_push_attempt: input.last_push_attempt ?? null,
      version: PROJECT_STATE_DETECTOR_VERSION,
    }))
    .digest("hex")
    .slice(0, 16);

  return {
    state,
    rationale,
    evidence_signals: signals,
    ambiguity_flags: ambiguity,
    counts: {
      modified,
      untracked,
      staged,
      deleted,
      local_commits_ahead: aheadBehind?.ahead ?? 0,
      remote_commits_ahead: aheadBehind?.behind ?? 0,
    },
    refs: {
      local_head_sha: localHead,
      remote_head_sha: remoteHead,
      branch,
      remote_tracking_branch: remoteTracking,
    },
    caller_should_prompt,
    caller_may_close_silently,
    input_digest,
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: PROJECT_STATE_DETECTOR_VERSION,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function earlyReturn(
  state: ProjectGitState,
  rationale: string,
  input: ProjectStateInput,
  signals: readonly string[],
  ambiguity: readonly string[],
): ProjectStateAssessment {
  return {
    state,
    rationale,
    evidence_signals: signals,
    ambiguity_flags: ambiguity,
    counts: {
      modified: 0, untracked: 0, staged: 0, deleted: 0,
      local_commits_ahead: 0, remote_commits_ahead: 0,
    },
    refs: {
      local_head_sha: null,
      remote_head_sha: null,
      branch: null,
      remote_tracking_branch: null,
    },
    caller_should_prompt: false,
    caller_may_close_silently: true,
    input_digest: createHash("sha256").update(input.project_root).digest("hex").slice(0, 16),
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: PROJECT_STATE_DETECTOR_VERSION,
  };
}

function execGit(cwd: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 120);
  return String(e).slice(0, 120);
}
