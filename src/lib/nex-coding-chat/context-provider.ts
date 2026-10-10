// NEX Coding Chat · Repo-context provider
// Auto-assembles the ChatContextSnapshot that accompanies every user message:
// project map · code standards · mentioned files (@path syntax) · active
// coding-team runs · rolling memory window · git HEAD.
//
// This is what makes the chat "fluent" — NEX sees the exact repo state you're
// asking about, not a stale abstract description.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { execSync } from "node:child_process";
import type {
  ChatContextSnapshot,
  CodeStandards,
  ProjectMap,
  ChatMessage,
} from "./types";

const REPO_ROOT = process.cwd();
const CHAT_DIR = path.join(REPO_ROOT, "data", "nex-coding-chat");
const MAX_MENTION_EXCERPT = 2000; // chars per file included
const MAX_MENTIONS_PER_QUERY = 5;
const ROLLING_MEMORY_TURNS = 10;

/** Load or synthesise the CODE_STANDARDS. */
export function loadCodeStandards(): CodeStandards {
  const p = path.join(CHAT_DIR, "CODE_STANDARDS.json");
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as CodeStandards;
    } catch {
      /* fall through to defaults */
    }
  }
  // Defaults derived from repo `CLAUDE.md` + `.agentrules`.
  return {
    primary_language: "TypeScript",
    module_style: "ES modules",
    error_handling: "explicit result objects (no silent catch)",
    type_safety: "strict; zero unjustified any; no @ts-ignore without ticket",
    test_framework: "vitest",
    commit_style: "Conventional Commits with Refs: run_id footer",
    protected_files: [
      "src/lib/nex-v3/",
      "supabase/migrations/20260915180000_nex_visual_structural_lock_architecture.sql",
      "CLAUDE.md",
      ".env",
      ".env.production",
    ],
    anti_bullshit: [
      "no filler prose",
      "no fabricated confidence",
      "four-level truth taxonomy (FACT/DECISION/HYPOTHESIS/PROPOSAL)",
      "REJECTED is a legitimate outcome",
      "cite file:LINE for every claim",
    ],
  };
}

/** Load or synthesise the PROJECT_MAP. */
export function loadProjectMap(): ProjectMap {
  const p = path.join(CHAT_DIR, "PROJECT_MAP.json");
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as ProjectMap;
    } catch {
      /* fall through */
    }
  }
  return {
    project_root: REPO_ROOT,
    key_paths: {
      "src/app": "Next.js app router · routes + pages + API handlers",
      "src/lib": "Shared library code · module-per-domain",
      "src/lib/nex-coding-team": "15-agent coding-team infrastructure",
      "src/lib/nex-coding-chat": "This chat layer",
      "src/lib/nex-hq": "NEX Head-Quarters workforce data + orchestration",
      "src/lib/nex-agent-runtime": "NEX1/NEX-Twin runtime bindings",
      "scripts": "Node/PowerShell utility scripts",
      "supabase/migrations": "DB schema · append-only per Historical Wave Receipt Immutability doctrine",
      "docs/NEX1/BUILD_GATES": "Wave receipts + architectural directives",
      "data/nex-coding-team/runs": "Per-run artefacts (ticket / spec / review / etc.)",
      "data/nex-coding-chat/sessions": "Chat history per session",
      "data/nex-coding-chat/transit": "Inbox/outbox for external engines",
      ".agentrules": "Repo-level operational contract every agent inherits",
      "CLAUDE.md": "Product constitution · immutable · read-only for agents",
    },
    agent_definitions_dir: "src/lib/nex-coding-team/agents",
    runtime_dir: "src/lib/nex-coding-team",
  };
}

/** Extract `@path/to/file.ts` mentions from the user's message. Returns absolute paths. */
export function extractMentionedPaths(query: string): readonly string[] {
  // Support @path/to/file · @src/lib/foo/index.ts · @scripts/nex-hq/... etc.
  const rx = /@([A-Za-z0-9._\-/\\]+\.[A-Za-z0-9]+)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(query)) !== null) {
    if (m[1]) out.add(m[1]);
  }
  return Array.from(out).slice(0, MAX_MENTIONS_PER_QUERY);
}

function safeReadExcerpt(rel_or_abs: string): { path: string; sha256: string; excerpt: string } | null {
  const abs = path.isAbsolute(rel_or_abs) ? rel_or_abs : path.resolve(REPO_ROOT, rel_or_abs);
  const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
  // Prevent path escape.
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  if (!existsSync(abs)) return null;
  let st;
  try {
    st = statSync(abs);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;
  // Refuse very large files inline · UI can request separately.
  if (st.size > 200_000) {
    return {
      path: rel,
      sha256: "",
      excerpt: `[file too large to inline · ${st.size} bytes · read separately]`,
    };
  }
  const buf = readFileSync(abs);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const text = buf.toString("utf8");
  const excerpt = text.length <= MAX_MENTION_EXCERPT ? text : text.slice(0, MAX_MENTION_EXCERPT) + "\n… [truncated]";
  return { path: rel, sha256, excerpt };
}

/** List currently-active coding-team runs (created but not yet completed). */
export function listActiveRuns(): readonly { run_id: string; status: string; current_stage: string | null }[] {
  const runs_dir = path.join(REPO_ROOT, "data", "nex-coding-team", "runs");
  if (!existsSync(runs_dir)) return [];
  const entries = readdirSync(runs_dir);
  const out: { run_id: string; status: string; current_stage: string | null; _mtime: number }[] = [];
  for (const dir of entries) {
    const manifest_path = path.join(runs_dir, dir, "manifest.json");
    if (!existsSync(manifest_path)) continue;
    try {
      const m = JSON.parse(readFileSync(manifest_path, "utf8")) as {
        run_id: string;
        status: string;
        current_stage: string | null;
      };
      const st = statSync(manifest_path);
      out.push({ ...m, _mtime: st.mtimeMs });
    } catch {
      /* skip broken */
    }
  }
  out.sort((a, b) => b._mtime - a._mtime);
  return out
    .filter((r) => r.status !== "completed_merged" && r.status !== "completed_no_merge" && r.status !== "aborted")
    .slice(0, 5)
    .map(({ _mtime, ...r }) => r);
}

function repoHead(): string | null {
  try {
    return execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/** Build the full snapshot. */
export function buildContext(query: string, prior_messages: readonly ChatMessage[]): ChatContextSnapshot {
  const project_map = loadProjectMap();
  const code_standards = loadCodeStandards();

  const mentions = extractMentionedPaths(query);
  const mentioned_files: ChatContextSnapshot["mentioned_files"] = [];
  for (const m of mentions) {
    const r = safeReadExcerpt(m);
    if (r) mentioned_files.push(r);
  }

  const active_runs = listActiveRuns();

  const rolling_memory = prior_messages
    .slice(-ROLLING_MEMORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));

  return {
    project_map,
    code_standards,
    mentioned_files,
    active_runs,
    rolling_memory,
    repo_head_sha: repoHead(),
  };
}
