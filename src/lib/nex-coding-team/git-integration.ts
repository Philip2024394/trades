// NEX Coding Team · Git integration adapter
// ONLY the Integrator agent may invoke write operations here. Everything else
// (git-log · git-blame · git-diff) is read-only and safe for Forensics.
//
// Never uses `--no-verify`. Never force-pushes. Never amends shared commits.
// Composes Conventional Commits messages including run-id provenance.

import { spawn } from "node:child_process";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

export interface GitOpResult {
  readonly ok: boolean;
  readonly exit_code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly command: string;
}

async function run(cmd: string, args: readonly string[], timeout_ms: number = 60_000): Promise<GitOpResult> {
  return new Promise<GitOpResult>((resolve) => {
    const child = spawn(cmd, args, { cwd: REPO_ROOT, windowsHide: true, shell: true });
    const so: string[] = [];
    const se: string[] = [];
    child.stdout.on("data", (b: Buffer) => so.push(b.toString("utf8")));
    child.stderr.on("data", (b: Buffer) => se.push(b.toString("utf8")));
    const t = setTimeout(() => child.kill("SIGKILL"), timeout_ms);
    child.on("exit", (code) => {
      clearTimeout(t);
      resolve({
        ok: code === 0,
        exit_code: code,
        stdout: so.join(""),
        stderr: se.join(""),
        command: [cmd, ...args].join(" "),
      });
    });
    child.on("error", (err) => {
      clearTimeout(t);
      resolve({
        ok: false,
        exit_code: -1,
        stdout: "",
        stderr: String(err),
        command: [cmd, ...args].join(" "),
      });
    });
  });
}

// --- READ-ONLY (any agent may call these via runtime; permissions gate write ops separately) ---

export async function currentHead(): Promise<GitOpResult> {
  return run("git", ["rev-parse", "HEAD"]);
}
export async function currentBranch(): Promise<GitOpResult> {
  return run("git", ["branch", "--show-current"]);
}
export async function statusPorcelain(): Promise<GitOpResult> {
  return run("git", ["status", "--porcelain"]);
}
export async function logForFile(file_rel: string, count: number = 20): Promise<GitOpResult> {
  return run("git", ["log", "--follow", `-n${count}`, "--pretty=%h %ad %s", "--date=short", "--", file_rel]);
}
export async function blame(file_rel: string): Promise<GitOpResult> {
  return run("git", ["blame", "--line-porcelain", file_rel]);
}
export async function diffAgainstHead(file_rel?: string): Promise<GitOpResult> {
  const args = ["diff", "HEAD"];
  if (file_rel) args.push("--", file_rel);
  return run("git", args);
}

// --- WRITE (Integrator-only · runtime enforces the gate) ---

export interface CommitRequest {
  readonly run_id: string;
  readonly ticket_title: string;
  readonly conventional_type: "feat" | "fix" | "refactor" | "docs" | "test" | "chore" | "perf" | "build" | "ci" | "style";
  readonly scope: string;
  readonly one_line_summary: string;
  readonly body: string; // WHY not what
  readonly file_paths: readonly string[]; // repo-relative — MUST match Builder+Tester scope
  readonly breaking_change_note?: string; // triggers "BREAKING CHANGE:" footer
}

/**
 * Compose Conventional Commits message and stage exactly the listed files.
 * Explicitly does NOT use `git add -A` — scope must be enumerated.
 */
export async function stageAndCommit(req: CommitRequest): Promise<GitOpResult> {
  // Stage files exactly.
  for (const p of req.file_paths) {
    const add = await run("git", ["add", "--", p]);
    if (!add.ok) return add;
  }
  // Compose message.
  const header = `${req.conventional_type}(${req.scope}): ${req.one_line_summary}`.slice(0, 100);
  const footerLines = [
    "",
    "Body:",
    req.body,
    "",
    `Refs: run_id=${req.run_id}, ticket=${req.ticket_title}`,
  ];
  if (req.breaking_change_note && req.breaking_change_note.trim().length > 0) {
    footerLines.push("", `BREAKING CHANGE: ${req.breaking_change_note}`);
  }
  const message = [header, "", ...footerLines].join("\n");

  // Commit WITHOUT `--no-verify`. If hooks fail, the caller sees the failure.
  return run("git", ["commit", "-m", message]);
}

/** Non-force push to a target branch. Never used against `main` without explicit spec authority. */
export async function pushBranch(branch: string, remote: string = "origin"): Promise<GitOpResult> {
  if (branch === "main" || branch === "master") {
    return {
      ok: false,
      exit_code: -1,
      stdout: "",
      stderr: `refusing to push to protected branch ${branch}`,
      command: `git push ${remote} ${branch}`,
    };
  }
  return run("git", ["push", remote, branch]);
}

/** Emit a one-line rollback command the Integrator records in integration.md. */
export function rollbackCommand(commit_sha: string): string {
  return `git revert --no-edit ${commit_sha}`;
}
