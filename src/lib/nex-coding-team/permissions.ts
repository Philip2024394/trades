// NEX Coding Team · Role-based file-permission gate
// Every agent runs under a permission profile. Writes outside the profile's
// allowlist are refused before they touch disk. This is enforced at the
// runtime layer — not at the OS level — because agents run in-process.
//
// The profiles below are the SOURCE OF TRUTH. Agent .md definitions reference
// these; runtime.ts consults them; the executor blocks disallowed writes.

import type { AgentId } from "./types";
import * as path from "node:path";

/** Absolute repo root · used for path normalization. */
export const REPO_ROOT = process.cwd();

/**
 * Permission profile for one agent role.
 * `allowed_write_globs` uses simple prefix matching against paths relative to REPO_ROOT.
 * A path matches if it begins with any prefix (after normalising `\` → `/`).
 * `allowed_read_globs` is advisory — reads are less constrained than writes.
 * `denied_write_paths` is an absolute deny list that trumps allow-lists.
 */
export interface PermissionProfile {
  readonly write_root_required: boolean; // if true, all writes MUST be under an allowed prefix
  readonly allowed_write_prefixes: readonly string[]; // repo-relative, forward-slash normalised
  readonly denied_write_paths: readonly string[]; // explicit blocks; always applied
  readonly allowed_read_prefixes: readonly string[]; // "*" means any
  readonly can_run_git_write: boolean; // git commit/push
  readonly can_run_shell: boolean; // subprocess spawn
  readonly can_run_tests: boolean; // vitest/jest/pytest
  readonly can_deploy: boolean; // trigger deployment
}

// Every agent's profile.
export const PERMISSIONS: Readonly<Record<AgentId, PermissionProfile>> = {
  pm: {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // ticket.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  architect: {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // spec.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  builder: {
    write_root_required: true,
    allowed_write_prefixes: [
      "src/",
      "scripts/",
      "supabase/",
      "public/",
      "data/nex-coding-team/runs/", // build-notes.md
    ],
    // Builder CANNOT touch tests.
    denied_write_paths: [
      "src/**/__tests__/",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
      "tests/",
    ],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false, // only runtime executor runs tests
    can_deploy: false,
  },
  tester: {
    write_root_required: true,
    // Tester may write test files under any src/**/__tests__/ folder, any
    // *.test.{ts,tsx,spec.ts,spec.tsx} file under src/, files under tests/,
    // and run-artefacts under data/nex-coding-team/runs/. That is the FULL
    // scope — the allowlist already excludes application code, so a broad
    // denylist is redundant and (as the previous form proved) can produce
    // false positives against legitimate test-file writes.
    allowed_write_prefixes: [
      "src/**/__tests__/",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
      "tests/",
      "data/nex-coding-team/runs/",
    ],
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  debugger: {
    write_root_required: true,
    allowed_write_prefixes: [
      "src/", // patches
      "scripts/",
      "data/nex-coding-team/runs/", // debug-notes.md
    ],
    // Debugger, like Builder, MUST NOT touch tests.
    denied_write_paths: [
      "src/**/__tests__/",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
      "tests/",
    ],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  reviewer: {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // review.md only
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  forensics: {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // forensics.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false, // read-only git via runtime
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  secops: {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // secops.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  integrator: {
    write_root_required: true,
    allowed_write_prefixes: [
      "data/nex-coding-team/runs/", // integration.md
    ],
    // Integrator NEVER modifies application source directly — only orchestrates.
    denied_write_paths: [
      "src/",
      "scripts/",
      "supabase/migrations/",
      ".env.local", // only touched under explicit spec authority; runtime asserts this
    ],
    allowed_read_prefixes: ["*"],
    can_run_git_write: true, // ONLY the Integrator commits and pushes
    can_run_shell: true,
    can_run_tests: true,
    can_deploy: true,
  },
  "technical-writer": {
    write_root_required: true,
    allowed_write_prefixes: [
      "docs/",
      "README.md",
      "CHANGELOG.md",
      "src/lib/**/README.md",
      "src/apps/**/README.md",
      "data/nex-coding-team/runs/", // docs-notes.md
    ],
    denied_write_paths: [
      "src/lib/", // source under lib is off-limits; only nested README.md via allow
      "src/app/",
      "src/components/",
      "src/apps/",
      "scripts/",
      "supabase/",
    ],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false, // Integrator will commit doc changes
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  telemetry: {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // telemetry.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false, // observability only
    can_run_tests: false,
    can_deploy: false,
  },
  "types-guard": {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // types.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: true, // tsc --noEmit is permitted
    can_run_tests: false,
    can_deploy: false,
  },
  "migration-reviewer": {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // migration-review.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  "accessibility-reviewer": {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // a11y-review.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
  "contract-reviewer": {
    write_root_required: true,
    allowed_write_prefixes: ["data/nex-coding-team/runs/"], // contract-review.md
    denied_write_paths: [],
    allowed_read_prefixes: ["*"],
    can_run_git_write: false,
    can_run_shell: false,
    can_run_tests: false,
    can_deploy: false,
  },
};

/** Universal protected files no agent may ever modify. Checked before any per-role allow. */
export const UNIVERSAL_DENY: readonly string[] = [
  ".env",
  ".env.production",
  ".env.local.backup-pre-cutover-2026-09-10",
  "supabase/migrations/20260915180000_nex_visual_structural_lock_architecture.sql", // M-1 frozen
  "CLAUDE.md", // product constitution
  "src/lib/nex-v3/", // V3_ENGINE_REGISTRY frozen tree
];

/** Historical wave receipts under nex-visual-proving remain intact — never mutated. */
export const HISTORICAL_RECEIPTS_PREFIX = "data/nex-visual-proving/";

export interface PermissionCheck {
  readonly allowed: boolean;
  readonly reason: string | null; // present when denied
}

/**
 * Check whether an agent may WRITE to a target path.
 * Path is normalised to forward slashes and made repo-relative before matching.
 */
export function canWrite(agent: AgentId, target_path: string): PermissionCheck {
  const rel = normaliseRel(target_path);

  // Universal deny always wins.
  for (const p of UNIVERSAL_DENY) {
    const denyRel = normaliseRel(p);
    if (rel === denyRel || rel.startsWith(denyRel + "/")) {
      return { allowed: false, reason: `universal deny: ${denyRel}` };
    }
  }

  // Historical receipts cannot be mutated — but new files under the tree are permitted
  // only for the runtime itself (not for agents).
  if (rel.startsWith(HISTORICAL_RECEIPTS_PREFIX)) {
    return {
      allowed: false,
      reason: `historical receipt tree is append-only via runtime, not per-agent writes: ${rel}`,
    };
  }

  const profile = PERMISSIONS[agent];

  // Per-agent explicit deny.
  for (const denyPattern of profile.denied_write_paths) {
    if (globPrefixMatch(rel, denyPattern)) {
      return { allowed: false, reason: `agent-${agent} deny: ${denyPattern}` };
    }
  }

  // Per-agent allow list.
  if (profile.write_root_required) {
    const ok = profile.allowed_write_prefixes.some((prefix) => globPrefixMatch(rel, prefix));
    if (!ok) {
      return {
        allowed: false,
        reason: `agent-${agent} may not write outside its allowlist: ${profile.allowed_write_prefixes.join(" | ")}`,
      };
    }
  }

  return { allowed: true, reason: null };
}

/** Read gate is permissive by default; here for symmetry and future audit hooks. */
export function canRead(agent: AgentId, _target_path: string): PermissionCheck {
  const profile = PERMISSIONS[agent];
  if (profile.allowed_read_prefixes.includes("*")) return { allowed: true, reason: null };
  // Future: restrict reads per-agent.
  return { allowed: true, reason: null };
}

// --- helpers ---
function normaliseRel(p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
  const rel = path.relative(REPO_ROOT, abs);
  return rel.replace(/\\/g, "/");
}

/**
 * Glob-prefix matcher · handles `**`, `*`, `?`, and a trailing `/`
 * meaning "this directory or anything under it".
 *
 * Semantics (minimatch-lite):
 *   `**\/` → any number of intermediate path segments (including zero)
 *   `**`   → any characters (including `/`)
 *   `*`    → any characters except `/`
 *   `?`    → any single character except `/`
 *
 * A pattern ending in `/` is a directory prefix — matches the directory
 * itself or any descendant. Without a trailing `/`, matches only exact.
 */
function globPrefixMatch(rel: string, pattern: string): boolean {
  const normalisedInput = pattern.replace(/\\/g, "/");
  const hadTrailingSlash = /\/$/.test(normalisedInput);
  const normPattern = normalisedInput.replace(/\/+$/, "");

  // Plain prefix · no wildcards.
  if (!normPattern.includes("*") && !normPattern.includes("?")) {
    return rel === normPattern || rel.startsWith(normPattern + "/");
  }

  const body = globToRegexBody(normPattern);
  const anchored = hadTrailingSlash ? `^${body}(?:/.*)?$` : `^${body}$`;
  return new RegExp(anchored).test(rel);
}

/** Convert a glob pattern body (no trailing slash) to a regex fragment. */
function globToRegexBody(pattern: string): string {
  const specials = new Set([".", "+", "^", "$", "(", ")", "|", "[", "]", "{", "}", "\\"]);
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 3;
        } else {
          out += ".*";
          i += 2;
        }
      } else {
        out += "[^/]*";
        i += 1;
      }
    } else if (c === "?") {
      out += "[^/]";
      i += 1;
    } else if (c !== undefined && specials.has(c)) {
      out += "\\" + c;
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}
