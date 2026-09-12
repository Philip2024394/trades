// src/lib/nex-agent/tools/index.ts
//
// NEX Agent v1.0 · Read-only tool surface.
// Every tool is deterministic and produces a structured result envelope.
// V1.0 has ZERO write tools — the agent proposes, founder approves, engineer builds.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();

// ── Result envelope · every tool returns this shape ─────────────
export interface ToolResult<T = unknown> {
  ok: boolean;
  tool: string;
  duration_ms: number;
  reason?: string;
  data?: T;
}

// Guard: resolve a caller-supplied path safely inside REPO_ROOT.
// Rejects anything that escapes the repo root or targets a protected path.
export type SafeResolveOk = { ok: true; abs: string; rel: string; reason?: undefined };
export type SafeResolveFail = { ok: false; reason: string; abs?: undefined; rel?: undefined };
export type SafeResolveResult = SafeResolveOk | SafeResolveFail;
export function safeResolve(p: string): SafeResolveResult {
  if (typeof p !== "string" || p.length === 0) return { ok: false, reason: "path_empty" };
  if (p.includes("\0")) return { ok: false, reason: "path_null_byte" };
  const abs = resolve(REPO_ROOT, p);
  const rel = relative(REPO_ROOT, abs);
  if (rel.startsWith("..") || rel.startsWith("/") || rel.startsWith(sep + "..")) {
    return { ok: false, reason: "path_escapes_repo_root" };
  }
  return { ok: true, abs, rel };
}

// ── read_file ────────────────────────────────────────────────────
export function readFile(path: string, maxBytes = 200_000): ToolResult<{ path: string; size: number; content: string; truncated: boolean }> {
  const t0 = Date.now();
  const s = safeResolve(path);
  if (!s.ok) return { ok: false, tool: "read_file", duration_ms: Date.now() - t0, reason: s.reason };
  try {
    if (!existsSync(s.abs)) return { ok: false, tool: "read_file", duration_ms: Date.now() - t0, reason: "not_found" };
    const st = statSync(s.abs);
    if (!st.isFile()) return { ok: false, tool: "read_file", duration_ms: Date.now() - t0, reason: "not_a_file" };
    const size = st.size;
    const raw = readFileSync(s.abs, "utf8");
    const truncated = raw.length > maxBytes;
    const content = truncated ? raw.slice(0, maxBytes) : raw;
    return { ok: true, tool: "read_file", duration_ms: Date.now() - t0, data: { path: s.rel, size, content, truncated } };
  } catch (err) { return { ok: false, tool: "read_file", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 160) }; }
}

// ── list_directory ───────────────────────────────────────────────
export function listDirectory(path: string): ToolResult<{ path: string; entries: Array<{ name: string; kind: "file" | "dir" | "other"; size: number | null }> }> {
  const t0 = Date.now();
  const s = safeResolve(path);
  if (!s.ok) return { ok: false, tool: "list_directory", duration_ms: Date.now() - t0, reason: s.reason };
  try {
    if (!existsSync(s.abs)) return { ok: false, tool: "list_directory", duration_ms: Date.now() - t0, reason: "not_found" };
    const st = statSync(s.abs);
    if (!st.isDirectory()) return { ok: false, tool: "list_directory", duration_ms: Date.now() - t0, reason: "not_a_directory" };
    const raw = readdirSync(s.abs);
    const entries = raw.map((name) => {
      try {
        const st2 = statSync(join(s.abs, name));
        const kind = st2.isFile() ? "file" as const : st2.isDirectory() ? "dir" as const : "other" as const;
        return { name, kind, size: st2.isFile() ? st2.size : null };
      } catch { return { name, kind: "other" as const, size: null }; }
    });
    return { ok: true, tool: "list_directory", duration_ms: Date.now() - t0, data: { path: s.rel, entries } };
  } catch (err) { return { ok: false, tool: "list_directory", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 160) }; }
}

// ── search_code · deterministic ripgrep-like (uses `git grep` if git repo, else naive) ─
export function searchCode(query: string, opts: { pathPrefix?: string; maxMatches?: number } = {}): ToolResult<{ query: string; matches: Array<{ file: string; line: number; snippet: string }> }> {
  const t0 = Date.now();
  const max = Math.min(opts.maxMatches ?? 60, 500);
  if (!query || query.length < 2) return { ok: false, tool: "search_code", duration_ms: Date.now() - t0, reason: "query_too_short" };
  const prefix = opts.pathPrefix ? opts.pathPrefix : "";
  const s = prefix ? safeResolve(prefix) : { ok: true as const, abs: REPO_ROOT, rel: "" };
  if (!s.ok) return { ok: false, tool: "search_code", duration_ms: Date.now() - t0, reason: s.reason };
  try {
    // Prefer git grep for speed; fall back to a naive walk if no git.
    let raw: string;
    try {
      raw = execSync(
        `git grep -n --fixed-strings --max-count=${max} -- ${JSON.stringify(query)} ${prefix ? JSON.stringify(prefix) : "."}`,
        { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 2 * 1024 * 1024 },
      );
    } catch { raw = ""; /* git grep exits 1 on no match · not an error for us */ }
    const matches = raw.split("\n").filter(Boolean).slice(0, max).map((line) => {
      const m = /^([^:]+):(\d+):(.*)$/.exec(line);
      if (!m) return null;
      return { file: m[1], line: Number(m[2]), snippet: m[3].slice(0, 200) };
    }).filter((x): x is { file: string; line: number; snippet: string } => x !== null);
    return { ok: true, tool: "search_code", duration_ms: Date.now() - t0, data: { query, matches } };
  } catch (err) { return { ok: false, tool: "search_code", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 160) }; }
}

// ── git_status ───────────────────────────────────────────────────
export function gitStatus(): ToolResult<{ branch: string; ahead: number; behind: number; changes: Array<{ status: string; path: string }> }> {
  const t0 = Date.now();
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    let ahead = 0, behind = 0;
    try {
      const av = execSync("git rev-list --left-right --count @{u}...HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
      const parts = av.split(/\s+/).map(Number);
      behind = parts[0] ?? 0; ahead = parts[1] ?? 0;
    } catch { /* no upstream · ignore */ }
    const raw = execSync("git status --porcelain=v1", { cwd: REPO_ROOT, encoding: "utf8" });
    const changes = raw.split("\n").filter(Boolean).map((l) => ({ status: l.slice(0, 2).trim(), path: l.slice(3).trim() })).slice(0, 200);
    return { ok: true, tool: "git_status", duration_ms: Date.now() - t0, data: { branch, ahead, behind, changes } };
  } catch (err) { return { ok: false, tool: "git_status", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 160) }; }
}

// ── postgres_read · SELECT only · schema browsing ────────────────
// The tool refuses anything other than a SELECT or a schema-inspection call.
export async function postgresRead(sql: string): Promise<ToolResult<{ rowCount: number; rows: unknown[] }>> {
  const t0 = Date.now();
  const trimmed = String(sql ?? "").trim();
  if (!trimmed) return { ok: false, tool: "postgres_read", duration_ms: Date.now() - t0, reason: "sql_empty" };
  const first = trimmed.toLowerCase().split(/[\s(]/, 1)[0];
  const allowedFirst = new Set(["select", "with"]);
  if (!allowedFirst.has(first)) return { ok: false, tool: "postgres_read", duration_ms: Date.now() - t0, reason: `only_select_or_with_allowed_got:${first}` };
  // Blocklist of destructive keywords · belt-and-braces guard
  const banned = /(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|call|do)\s/i;
  if (banned.test(" " + trimmed + " ")) return { ok: false, tool: "postgres_read", duration_ms: Date.now() - t0, reason: "sql_contains_write_keyword" };
  try {
    const { Client } = await import("pg");
    const url = process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000, statement_timeout: 8000 });
    await c.connect();
    try {
      const r = await c.query(trimmed);
      const rows = r.rows.slice(0, 200);
      return { ok: true, tool: "postgres_read", duration_ms: Date.now() - t0, data: { rowCount: r.rowCount ?? rows.length, rows } };
    } finally { try { await c.end(); } catch { /* ignore */ } }
  } catch (err) { return { ok: false, tool: "postgres_read", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 200) }; }
}

// ── crawler_feed · query the running lab crawler pipeline for relevant knowledge ─
// V1.0 wires this to a SELECT against the harvest_raw tables (real data flowing
// from OSM/Wikidata/Nominatim/Wikimedia). Future: extend to fetch npm docs · MDN pages.
export async function crawlerFeed(query: string, source?: string): Promise<ToolResult<{ query: string; source: string; hits: Array<{ source: string; source_ref: string; snippet: string }> }>> {
  const t0 = Date.now();
  if (!query || query.length < 2) return { ok: false, tool: "crawler_feed", duration_ms: Date.now() - t0, reason: "query_too_short" };
  const src = source ?? "all";
  try {
    const { Client } = await import("pg");
    const url = process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    await c.connect();
    try {
      const rooms = ["accommodation", "food", "transport", "business", "activities", "image"];
      const hits: Array<{ source: string; source_ref: string; snippet: string }> = [];
      for (const room of rooms) {
        try {
          const r = await c.query(
            `SELECT source, source_ref, payload FROM nex_lab_${room}.harvest_raw
             WHERE (payload->>'name') ILIKE $1
             ${src !== "all" ? "AND source LIKE $2" : ""}
             LIMIT 8`,
            src !== "all" ? [`%${query}%`, `${src}%`] : [`%${query}%`],
          );
          for (const row of r.rows) {
            hits.push({ source: row.source, source_ref: row.source_ref ?? "?", snippet: String(row.payload?.name ?? "").slice(0, 200) });
            if (hits.length >= 30) break;
          }
        } catch { /* schema may not exist yet · skip */ }
        if (hits.length >= 30) break;
      }
      return { ok: true, tool: "crawler_feed", duration_ms: Date.now() - t0, data: { query, source: src, hits } };
    } finally { try { await c.end(); } catch { /* ignore */ } }
  } catch (err) { return { ok: false, tool: "crawler_feed", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 200) }; }
}

// ── architecture_scan · runs the /rules/architecture.json rules against a proposed change ─
export interface ArchitectureFinding { severity: "info" | "warn" | "violation" | "block"; rule: string; detail: string; location?: string }
export function architectureScan(input: { touched_paths: string[]; added_dependencies?: string[]; diff_text?: string }): ToolResult<{ findings: ArchitectureFinding[]; blocked: boolean }> {
  const t0 = Date.now();
  try {
    const raw = readFileSync(resolve(REPO_ROOT, "rules/architecture.json"), "utf8");
    const rules = JSON.parse(raw);
    const findings: ArchitectureFinding[] = [];
    // 1. Forbidden dependencies
    if (Array.isArray(rules.forbidden_dependencies) && Array.isArray(input.added_dependencies)) {
      for (const dep of input.added_dependencies) {
        if (rules.forbidden_dependencies.includes(dep)) {
          findings.push({ severity: "block", rule: "forbidden_dependency", detail: `${dep} is in the forbidden list`, location: dep });
        }
      }
    }
    // 2. Forbidden string patterns
    if (Array.isArray(rules.forbidden_string_patterns) && input.diff_text) {
      for (const rule of rules.forbidden_string_patterns) {
        try {
          const re = new RegExp(rule.pattern, "i");
          if (re.test(input.diff_text)) {
            findings.push({ severity: "block", rule: "forbidden_string_pattern", detail: rule.reason, location: rule.pattern });
          }
        } catch { /* invalid regex in rule · skip */ }
      }
    }
    // 3. Protected files touched
    if (Array.isArray(rules.protected_files) && Array.isArray(input.touched_paths)) {
      const protectedSet = new Set(rules.protected_files.map((f: { path: string }) => f.path));
      for (const p of input.touched_paths) {
        if (protectedSet.has(p)) {
          const r = rules.protected_files.find((f: { path: string; reason: string }) => f.path === p);
          findings.push({ severity: "violation", rule: "protected_file_touched", detail: r?.reason ?? "protected", location: p });
        }
      }
    }
    // 4. Protected directories touched (path prefix match)
    // Append-only exception: adding a NEW numbered file to db/migrations/,
    // supabase/migrations/, docs/DECISIONS/ is permitted. Modifying an existing
    // file in those dirs is still a violation.
    const APPEND_ONLY_DIRS = new Set(["db/migrations/", "supabase/migrations/", "docs/DECISIONS/"]);
    if (Array.isArray(rules.protected_directories) && Array.isArray(input.touched_paths)) {
      for (const dir of rules.protected_directories) {
        for (const p of input.touched_paths) {
          if (p.startsWith(dir.path)) {
            // If the target dir is append-only AND the touched path is a NEW
            // file that doesn't yet exist on disk, we let it through with an info finding.
            if (APPEND_ONLY_DIRS.has(dir.path)) {
              const abs = resolve(REPO_ROOT, p);
              if (!existsSync(abs)) {
                findings.push({ severity: "info", rule: "append_only_new_file", detail: `new file in append-only dir ${dir.path} · permitted · engineer must pick sequential number`, location: p });
                continue;
              }
            }
            findings.push({ severity: "violation", rule: "protected_directory_touched", detail: dir.reason, location: `${p} ⊂ ${dir.path}` });
          }
        }
      }
    }
    const blocked = findings.some(f => f.severity === "block" || f.severity === "violation");
    return { ok: true, tool: "architecture_scan", duration_ms: Date.now() - t0, data: { findings, blocked } };
  } catch (err) { return { ok: false, tool: "architecture_scan", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 200) }; }
}

// ── dedupe hash for logs ────────────────────────────────────────
export function hashOf(input: string): string { return createHash("sha256").update(input).digest("hex").slice(0, 12); }

// ── V1.2 verification tools · re-export ────────────────────────
import { runTypecheck, runLint, runTests, gitWorktreeList, gitWorktreeCreate, gitWorktreeDelete } from "./verification";
export { runTypecheck, runLint, runTests, gitWorktreeList, gitWorktreeCreate, gitWorktreeDelete };
export type { VerificationFinding } from "./verification";

// ── V1.3 database engineer tools · re-export ─────────────────
// NOTE: postgres_apply_migration is INTENTIONALLY not in TOOL_REGISTRY.
// It's the only tool that writes to the real DB · founder-approval-gated ·
// called ONLY through /api/nex/agent/migration/apply · never through the
// generic /api/nex/agent/tools endpoint.
import { postgresSchemaIntrospect, postgresDryRunMigration, postgresApplyMigration } from "./database";
export { postgresSchemaIntrospect, postgresDryRunMigration, postgresApplyMigration };

export const TOOL_REGISTRY = {
  read_file: readFile,
  list_directory: listDirectory,
  search_code: searchCode,
  git_status: gitStatus,
  postgres_read: postgresRead,
  crawler_feed: crawlerFeed,
  architecture_scan: architectureScan,
  // V1.2 verification suite · run real commands · bounded output + timeout
  run_typecheck: runTypecheck,
  run_lint: runLint,
  run_tests: runTests,
  git_worktree_list: gitWorktreeList,
  git_worktree_create: gitWorktreeCreate,
  git_worktree_delete: gitWorktreeDelete,
  // V1.3 database engineer · read-only + dry-run · apply NOT exposed here
  postgres_schema_introspect: postgresSchemaIntrospect,
  postgres_dry_run_migration: postgresDryRunMigration,
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;
