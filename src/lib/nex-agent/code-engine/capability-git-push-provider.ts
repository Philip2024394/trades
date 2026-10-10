// src/lib/nex-agent/code-engine/capability-git-push-provider.ts
//
// NEX1 · Git Push Provider (§11-13, §16-17)
// Ledger B additive · Zero LLM · Real git push via execFile.
//
// SCOPE (honest boundary):
//   This provider uses the user's already-configured git credentials
//   (SSH keys, credential helper, etc). It performs REAL `git push` and
//   verifies remote state by re-reading the remote ref after push.
//
//   OAuth-based repo creation/discovery for GitHub/GitLab/Bitbucket
//   requires registered OAuth apps and is out of scope for this session.
//   However this provider works for any git remote the user has already
//   authenticated to · which covers most real usage.
//
// INVARIANTS
//   · Never claims push_succeeded without observed remote SHA match
//   · Captures real stderr from git for real error surfaces
//   · Records the attempted SHA · caller must remember for verification
//   · Zero LLM · deterministic

import { execFileSync } from "node:child_process";
import type { ProviderFunctions } from "./capability-provider-registry";

export const GIT_PUSH_PROVIDER_VERSION = "git-push-provider.v1.2026-09-19";

// ── Provider-independent git operations ─────────────────────────────────

export interface GitPushInput {
  readonly project_root: string;
  readonly remote_name?: string;       // default "origin"
  readonly branch: string;
  readonly commit_message: string | null;  // null means "don't commit here · caller has already committed"
  readonly files_to_add?: readonly string[];  // default: all changes
}

export interface GitPushOutcome {
  readonly ok: boolean;
  readonly attempted_sha: string | null;
  readonly remote_head_before: string | null;
  readonly remote_head_after: string | null;
  readonly push_verified: boolean;      // TRUE only when observed remote HEAD matches attempted SHA
  readonly stderr_tail: string;
  readonly error_reason: string | null;
  readonly evidence_signals: readonly string[];
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Public entry ─────────────────────────────────────────────────────────

export async function performGitPush(input: GitPushInput): Promise<GitPushOutcome> {
  const remote = input.remote_name ?? "origin";
  const signals: string[] = [`remote=${remote}`, `branch=${input.branch}`];
  let attempted_sha: string | null = null;
  let remote_head_before: string | null = null;
  let remote_head_after: string | null = null;
  let stderr_tail = "";
  let error_reason: string | null = null;

  try {
    // Snapshot remote HEAD before push (network-required · captures reason on failure)
    try {
      const before = execFileSync("git", ["ls-remote", remote, input.branch], {
        cwd: input.project_root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      remote_head_before = before ? before.split(/\s+/)[0] : null;
      signals.push(`remote_head_before=${remote_head_before ?? "none"}`);
    } catch (err) {
      signals.push(`remote_head_before_read_failed:${errMsg(err)}`);
    }

    // Commit if the caller requested it and there are changes
    if (input.commit_message !== null) {
      try {
        if (input.files_to_add && input.files_to_add.length > 0) {
          execFileSync("git", ["add", ...input.files_to_add], {
            cwd: input.project_root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
          });
        } else {
          execFileSync("git", ["add", "-A"], {
            cwd: input.project_root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
          });
        }
        // -m via array to avoid shell escaping
        execFileSync("git", ["commit", "-m", input.commit_message], {
          cwd: input.project_root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err) {
        // If nothing to commit, that's not fatal · we can still push existing commits
        const msg = errMsg(err);
        if (!/nothing to commit/i.test(msg)) {
          error_reason = `commit_failed:${msg}`;
        }
      }
    }

    // Read local HEAD as attempted SHA
    try {
      attempted_sha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: input.project_root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      signals.push(`attempted_sha=${attempted_sha}`);
    } catch (err) {
      error_reason = `head_read_failed:${errMsg(err)}`;
      return finalise(false, attempted_sha, remote_head_before, null, false, stderr_tail, error_reason, signals);
    }

    if (error_reason !== null) {
      return finalise(false, attempted_sha, remote_head_before, null, false, stderr_tail, error_reason, signals);
    }

    // Push
    try {
      execFileSync("git", ["push", remote, input.branch], {
        cwd: input.project_root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
      signals.push("push_exit_code=0");
    } catch (err) {
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? errMsg(err);
      stderr_tail = stderr.slice(-1000);
      error_reason = classifyPushError(stderr);
      signals.push(`push_error_class=${error_reason}`);
      return finalise(false, attempted_sha, remote_head_before, null, false, stderr_tail, error_reason, signals);
    }

    // Verify remote state
    try {
      const after = execFileSync("git", ["ls-remote", remote, input.branch], {
        cwd: input.project_root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      remote_head_after = after ? after.split(/\s+/)[0] : null;
      signals.push(`remote_head_after=${remote_head_after ?? "none"}`);
    } catch (err) {
      signals.push(`remote_head_after_read_failed:${errMsg(err)}`);
    }

    const push_verified = remote_head_after !== null && attempted_sha !== null && remote_head_after === attempted_sha;
    signals.push(`push_verified=${push_verified}`);
    if (!push_verified && !error_reason) {
      error_reason = "push_verification_failed:remote_head_does_not_match_attempted_sha";
    }

    return finalise(push_verified, attempted_sha, remote_head_before, remote_head_after, push_verified, stderr_tail, error_reason, signals);
  } catch (err) {
    return finalise(false, attempted_sha, remote_head_before, remote_head_after, false, stderr_tail, `unexpected_error:${errMsg(err)}`, signals);
  }
}

function finalise(
  ok: boolean,
  attempted_sha: string | null,
  remote_head_before: string | null,
  remote_head_after: string | null,
  push_verified: boolean,
  stderr_tail: string,
  error_reason: string | null,
  signals: readonly string[],
): GitPushOutcome {
  return {
    ok,
    attempted_sha,
    remote_head_before,
    remote_head_after,
    push_verified,
    stderr_tail,
    error_reason,
    evidence_signals: signals,
    zero_llm: true,
    ledger: "B",
    version: GIT_PUSH_PROVIDER_VERSION,
  };
}

function classifyPushError(stderr: string): string {
  if (/authentication/i.test(stderr)) return "authentication_failure";
  if (/permission denied/i.test(stderr)) return "permission_denied";
  if (/does not exist|not found/i.test(stderr)) return "repository_not_found";
  if (/rejected/i.test(stderr)) return "push_rejected";
  if (/conflict|non-fast-forward/i.test(stderr)) return "branch_conflict";
  if (/timed out|timeout/i.test(stderr)) return "network_timeout";
  if (/could not resolve|network is unreachable/i.test(stderr)) return "network_unreachable";
  return `push_failed:${stderr.slice(0, 200).replace(/\s+/g, " ").trim()}`;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 200);
  return String(e).slice(0, 200);
}

// ── Registry-compatible provider factory ─────────────────────────────────
//
// Builds a ProviderFunctions object suitable for registerProvider() from
// capability-provider-registry.ts. The probe checks that `git` binary is
// available; not that any specific remote is configured (that's per-project).

export function createGitProviderFunctions(): ProviderFunctions {
  return {
    probeConnection: async () => {
      try {
        execFileSync("git", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return { connected: true, authenticated: true, reason: null };
      } catch (err) {
        return { connected: false, authenticated: false, reason: `git_binary_missing:${errMsg(err)}` };
      }
    },
    getRemoteState: async (repo_url: string) => {
      try {
        const out = execFileSync("git", ["ls-remote", "--heads", repo_url], {
          encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        }).trim();
        const first = out.split(/\r?\n/)[0];
        if (!first) return { reachable: true, head_sha: null, branch: null, reason: "no_refs" };
        const [sha, ref] = first.split(/\s+/);
        return {
          reachable: true,
          head_sha: sha,
          branch: ref ? ref.replace(/^refs\/heads\//, "") : null,
          reason: null,
        };
      } catch (err) {
        return { reachable: false, head_sha: null, branch: null, reason: `ls_remote_failed:${errMsg(err)}` };
      }
    },
    checkPushStatus: async (repo_url: string, expected_sha: string) => {
      try {
        const out = execFileSync("git", ["ls-remote", repo_url], {
          encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        }).trim();
        const shas = out.split(/\r?\n/).map((line) => line.split(/\s+/)[0]);
        return {
          matched: shas.includes(expected_sha),
          actual_sha: shas[0] ?? null,
          reason: null,
        };
      } catch (err) {
        return { matched: false, actual_sha: null, reason: `ls_remote_failed:${errMsg(err)}` };
      }
    },
  };
}
