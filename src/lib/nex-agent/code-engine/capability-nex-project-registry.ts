// src/lib/nex-agent/code-engine/capability-nex-project-registry.ts
//
// NEX1 · Canonical Project Identity Layer · Founder-authorised 2026-09-19
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Bridge the two disconnected worlds discovered in the Project-model
//   inspection:
//     · task-based Workstation (no project concept)
//     · WO-03 orchestrator (ProjectModel + trace-scoped workspaces)
//
//   This module defines the SMALLEST canonical Project record with STABLE
//   identity that survives independently of task_id and trace_id.
//
// FOUNDER PRIMARY QUESTION (verbatim)
//   "Can an NEX Project have a stable identity and stable filesystem
//    workspace that exists independently of a task_id and independently
//    of a trace_id?"
//
// ANSWER (evidence-backed by wo3-pipeline.ts sanctioning code)
//   YES. The sanctioned workspace root is `data/nex-agent-workspaces/**`.
//   Trace-scoping is a documented CONVENTION, not an enforcement. A
//   Project workspace can safely live at `data/nex-agent-workspaces/
//   {project_slug}/` and satisfy the existing WO-03 sanction check.
//
// INVARIANTS
//   1. workspace_root MUST be inside the sanctioned root (or test tmpdir)
//   2. workspace_root MUST NOT equal process.cwd()          (Rule: NEX infra ≠ customer project)
//   3. workspace_root MUST NOT be a strict ancestor of cwd  (defence in depth)
//   4. workspace_root MUST exist on disk at register time
//   5. project_id MUST be non-empty hex (8..64 chars)
//   6. project_slug MUST be a valid URL-safe slug
//   7. Duplicate project_id refuses silently — HARD ERROR
//   8. Two projects MUST NOT point to the same workspace_root
//   9. Registry is APPEND-ONLY JSONL · every write is a receipt
//  10. Rule 6 · resolveActiveProject never silently selects: no hint = NOT_AVAILABLE

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const NEX_PROJECT_REGISTRY_VERSION = "nex-project-registry.v1.2026-09-19";

// ── Types ──────────────────────────────────────────────────────────────

export type ProjectFramework = "next-app-router" | "static-html";
export type ProjectSource = "scaffold" | "external_reconstruction" | "imported_repo";

export interface NexProjectRecord {
  readonly record_type: "NEX_PROJECT";
  readonly project_id: string;
  readonly project_name: string;
  readonly project_slug: string;
  readonly workspace_root: string;          // absolute · under sanctioned root
  readonly framework: ProjectFramework;
  readonly source: ProjectSource;
  readonly created_at_iso: string;
  readonly created_by: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export interface RegisterProjectInput {
  readonly project_id: string;
  readonly project_name: string;
  readonly project_slug: string;
  readonly workspace_root: string;
  readonly framework: ProjectFramework;
  readonly source: ProjectSource;
  readonly created_by: string;
}

export interface RegisterProjectFailure {
  readonly ok: false;
  readonly reason_code:
    | "PROJECT_ID_INVALID"
    | "PROJECT_SLUG_INVALID"
    | "PROJECT_NAME_EMPTY"
    | "WORKSPACE_OUTSIDE_SANCTIONED_ROOT"
    | "WORKSPACE_IS_NEX_INFRASTRUCTURE"
    | "WORKSPACE_DOES_NOT_EXIST"
    | "DUPLICATE_PROJECT_ID_DIFFERENT_WORKSPACE"
    | "DUPLICATE_WORKSPACE_ROOT";
  readonly reason: string;
}

export type RegisterProjectResult =
  | { readonly ok: true; readonly record: NexProjectRecord }
  | RegisterProjectFailure;

export type ProjectResolutionOutcome =
  | { readonly status: "RESOLVED"; readonly project: NexProjectRecord; readonly evidence: readonly string[] }
  | { readonly status: "AMBIGUOUS"; readonly candidates: readonly NexProjectRecord[]; readonly reason: string }
  | { readonly status: "NOT_AVAILABLE"; readonly reason: string }
  | { readonly status: "INVALID"; readonly project_id: string; readonly reason: string };

export interface ResolveActiveProjectInput {
  readonly active_project_id: string | null;
  /** Optional case-sensitive prefix match against project_slug. Used only
   *  when active_project_id is null. Reaches AMBIGUOUS when >1 match. */
  readonly by_slug_prefix?: string;
}

// ── Configuration ──────────────────────────────────────────────────────

export interface RegistryOptions {
  /** Override default registry JSONL location · used only by tests. */
  readonly registry_path?: string;
  /** Override default sanctioned workspace root · used only by tests. */
  readonly sanctioned_root?: string;
  /** Override cwd used for infra checks · used only by tests. */
  readonly nex_infra_root?: string;
}

function defaultRegistryPath(): string {
  return path.resolve(process.cwd(), "data", "nex1-projects", "index.jsonl");
}
function defaultSanctionedRoot(): string {
  return path.resolve(process.cwd(), "data", "nex-agent-workspaces");
}
function defaultNexInfraRoot(): string {
  return path.resolve(process.cwd());
}

// ── Public entry: registerProject ──────────────────────────────────────

const PROJECT_ID_RE = /^[a-z0-9]{8,64}$/i;
const PROJECT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function registerProject(
  input: RegisterProjectInput,
  opts: RegistryOptions = {},
): RegisterProjectResult {
  const registryPath = opts.registry_path ?? defaultRegistryPath();
  const sanctionedRoot = opts.sanctioned_root ?? defaultSanctionedRoot();
  const infraRoot = opts.nex_infra_root ?? defaultNexInfraRoot();

  // 1. Validate identity fields
  if (!PROJECT_ID_RE.test(input.project_id)) {
    return fail("PROJECT_ID_INVALID", `project_id must match /^[a-z0-9]{8,64}$/i · got "${input.project_id}"`);
  }
  if (!PROJECT_SLUG_RE.test(input.project_slug)) {
    return fail("PROJECT_SLUG_INVALID", `project_slug must be a URL-safe slug (1..63 chars, [a-z0-9-]) · got "${input.project_slug}"`);
  }
  if (input.project_name.trim().length === 0) {
    return fail("PROJECT_NAME_EMPTY", "project_name is required");
  }

  // 2. Resolve workspace_root and enforce boundaries
  const resolved = path.resolve(input.workspace_root);
  const normalisedResolved = normalise(resolved);
  const normalisedSanctioned = normalise(sanctionedRoot);
  const normalisedInfra = normalise(infraRoot);

  if (normalisedResolved === normalisedInfra || normalisedInfra.startsWith(normalisedResolved + "/") || normalisedInfra === normalisedResolved) {
    // workspace_root is either the NEX infra root or a strict ancestor of it
    return fail(
      "WORKSPACE_IS_NEX_INFRASTRUCTURE",
      `workspace_root "${resolved}" resolves to NEX infrastructure · customer projects must live under the sanctioned root`,
    );
  }
  if (!isUnderSanctionedRoot(normalisedResolved, normalisedSanctioned)) {
    return fail(
      "WORKSPACE_OUTSIDE_SANCTIONED_ROOT",
      `workspace_root "${resolved}" is not under the sanctioned root "${sanctionedRoot}"`,
    );
  }
  if (!existsSync(resolved)) {
    return fail("WORKSPACE_DOES_NOT_EXIST", `workspace_root "${resolved}" does not exist on disk`);
  }
  try {
    const s = statSync(resolved);
    if (!s.isDirectory()) {
      return fail("WORKSPACE_DOES_NOT_EXIST", `workspace_root "${resolved}" exists but is not a directory`);
    }
  } catch (err) {
    return fail("WORKSPACE_DOES_NOT_EXIST", `workspace_root "${resolved}" stat failed: ${errMsg(err)}`);
  }

  // 3. Load existing registry and check uniqueness
  const existing = readRegistrySilent(registryPath);
  for (const row of existing) {
    if (row.project_id === input.project_id && normalise(row.workspace_root) !== normalisedResolved) {
      return fail(
        "DUPLICATE_PROJECT_ID_DIFFERENT_WORKSPACE",
        `project_id "${input.project_id}" is already registered against workspace "${row.workspace_root}"`,
      );
    }
    if (normalise(row.workspace_root) === normalisedResolved && row.project_id !== input.project_id) {
      return fail(
        "DUPLICATE_WORKSPACE_ROOT",
        `workspace_root "${resolved}" is already registered to project_id "${row.project_id}"`,
      );
    }
    if (row.project_id === input.project_id && normalise(row.workspace_root) === normalisedResolved) {
      // Idempotent re-register: identical registration is a no-op success
      return { ok: true, record: row };
    }
  }

  // 4. Compose record and append
  const record: NexProjectRecord = {
    record_type: "NEX_PROJECT",
    project_id: input.project_id,
    project_name: input.project_name,
    project_slug: input.project_slug,
    workspace_root: resolved,
    framework: input.framework,
    source: input.source,
    created_at_iso: new Date().toISOString(),
    created_by: input.created_by,
    zero_llm: true,
    ledger: "B",
    version: NEX_PROJECT_REGISTRY_VERSION,
  };

  const dir = path.dirname(registryPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(registryPath, JSON.stringify(record) + "\n");

  return { ok: true, record };
}

// ── Public entry: getProject ───────────────────────────────────────────

export function getProject(project_id: string, opts: RegistryOptions = {}): NexProjectRecord | null {
  const registryPath = opts.registry_path ?? defaultRegistryPath();
  const rows = readRegistrySilent(registryPath);
  for (const row of rows) {
    if (row.project_id === project_id) return row;
  }
  return null;
}

// ── Public entry: listProjects ─────────────────────────────────────────

export function listProjects(opts: RegistryOptions = {}): readonly NexProjectRecord[] {
  const registryPath = opts.registry_path ?? defaultRegistryPath();
  return readRegistrySilent(registryPath);
}

// ── Public entry: resolveActiveProject ─────────────────────────────────

export function resolveActiveProject(
  input: ResolveActiveProjectInput,
  opts: RegistryOptions = {},
): ProjectResolutionOutcome {
  const evidence: string[] = [];
  const rows = readRegistrySilent(opts.registry_path ?? defaultRegistryPath());

  if (input.active_project_id && input.active_project_id.trim().length > 0) {
    const id = input.active_project_id;
    evidence.push(`hint=active_project_id:${id}`);
    const found = rows.find((r) => r.project_id === id);
    if (!found) {
      return { status: "NOT_AVAILABLE", reason: `active_project_id "${id}" is not registered` };
    }
    if (!existsSync(found.workspace_root)) {
      return {
        status: "INVALID",
        project_id: id,
        reason: `registered workspace_root "${found.workspace_root}" no longer exists on disk`,
      };
    }
    evidence.push(`workspace_verified=${found.workspace_root}`);
    return { status: "RESOLVED", project: found, evidence };
  }

  if (input.by_slug_prefix && input.by_slug_prefix.length > 0) {
    const prefix = input.by_slug_prefix;
    evidence.push(`hint=by_slug_prefix:${prefix}`);
    const matches = rows.filter((r) => r.project_slug.startsWith(prefix));
    if (matches.length === 0) {
      return { status: "NOT_AVAILABLE", reason: `no project matches slug prefix "${prefix}"` };
    }
    if (matches.length > 1) {
      return {
        status: "AMBIGUOUS",
        candidates: matches,
        reason: `slug prefix "${prefix}" matches ${matches.length} projects · customer must choose`,
      };
    }
    const single = matches[0];
    if (!existsSync(single.workspace_root)) {
      return {
        status: "INVALID",
        project_id: single.project_id,
        reason: `registered workspace_root "${single.workspace_root}" no longer exists on disk`,
      };
    }
    evidence.push(`workspace_verified=${single.workspace_root}`);
    return { status: "RESOLVED", project: single, evidence };
  }

  return { status: "NOT_AVAILABLE", reason: "no active_project_id provided · Rule 6 · NEX does not silently select a project" };
}

// ── Private helpers ────────────────────────────────────────────────────

function fail(code: RegisterProjectFailure["reason_code"], reason: string): RegisterProjectFailure {
  return { ok: false, reason_code: code, reason };
}

function normalise(p: string): string {
  return path.resolve(p).replace(/\\/g, "/");
}

function isUnderSanctionedRoot(normalisedResolved: string, normalisedSanctioned: string): boolean {
  if (normalisedResolved === normalisedSanctioned) return true;
  if (normalisedResolved.startsWith(normalisedSanctioned + "/")) return true;
  return false;
}

function readRegistrySilent(registryPath: string): readonly NexProjectRecord[] {
  if (!existsSync(registryPath)) return [];
  let text: string;
  try {
    text = readFileSync(registryPath, "utf8");
  } catch {
    return [];
  }
  const rows: NexProjectRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && parsed.record_type === "NEX_PROJECT") {
        rows.push(parsed as NexProjectRecord);
      }
    } catch {
      // silently skip corrupted lines · registry is append-only, older lines take precedence
    }
  }
  return rows;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 120);
  return String(e).slice(0, 120);
}

// ── Deterministic project_id derivation helper (optional) ──────────────
//
// If a caller wants a deterministic project_id from stable inputs (rather
// than one that includes a timestamp like ScaffoldOutcome), this helper
// produces a 16-char sha256 slice of `${slug}|${framework}|${source}`.
// Callers that already have a project_id (e.g. from scaffoldProject())
// should reuse it, not re-derive.

export function deriveStableProjectId(input: { project_slug: string; framework: ProjectFramework; source: ProjectSource }): string {
  return createHash("sha256")
    .update(`${input.project_slug}|${input.framework}|${input.source}`)
    .digest("hex")
    .slice(0, 16);
}
