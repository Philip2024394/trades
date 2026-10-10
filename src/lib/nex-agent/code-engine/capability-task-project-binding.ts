// src/lib/nex-agent/code-engine/capability-task-project-binding.ts
//
// NEX1 · Task → Project binding · Founder-authorised 2026-09-19
// Ledger B additive · Zero LLM · Deterministic.
//
// FOUNDER ARCHITECTURAL RULE (verbatim)
//   PROJECT
//     ↑
//     │ belongs_to
//     │
//   TASK
//
//   A Task is work performed against a Project.
//   A Task must NOT create, infer, or redefine the Project.
//   The canonical Project registry remains the authority.
//
// DESIGN
//   The binding is stored append-only in a JSONL registry, exactly like
//   the canonical Project registry. This mirrors the founder rule
//   "Do not create a second Project table merely to make a foreign key
//   convenient · The JSONL Project registry is currently the canonical
//   Project store."
//
//   This module is a PURE LINK between two existing identities:
//     · task_id  (from nex_agent.tasks · Postgres · existing)
//     · project_id  (from NEX Project registry · JSONL · existing)
//
//   It does NOT modify the tasks table schema.
//   It does NOT own project identity.
//   It does NOT create tasks.
//   It does NOT create projects.
//
// INVARIANTS
//   1. bindTaskToProject refuses if project_id is not in the Project registry
//   2. Once bound, a task_id cannot be rebound to a different project
//   3. Historical unbound tasks are honoured · getProjectForTask returns null
//   4. Append-only · every write is a receipt
//   5. Anti-fabrication · resolver must return RESOLVED, not merely a matching id

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getProject } from "./capability-nex-project-registry";

export const TASK_PROJECT_BINDING_VERSION = "task-project-binding.v1.2026-09-19";

// ── Types ──────────────────────────────────────────────────────────────

export interface TaskProjectBinding {
  readonly record_type: "NEX_TASK_PROJECT_BINDING";
  readonly task_id: string;
  readonly project_id: string;
  readonly bound_at_iso: string;
  readonly bound_by: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export interface BindTaskInput {
  readonly task_id: string;
  readonly project_id: string;
  readonly bound_by: string;
}

export interface BindFailure {
  readonly ok: false;
  readonly reason_code:
    | "TASK_ID_INVALID"
    | "PROJECT_ID_INVALID"
    | "PROJECT_NOT_IN_REGISTRY"
    | "TASK_ALREADY_BOUND_TO_DIFFERENT_PROJECT";
  readonly reason: string;
}

export type BindResult =
  | { readonly ok: true; readonly binding: TaskProjectBinding }
  | BindFailure;

// ── Options ─────────────────────────────────────────────────────────────

export interface BindingOptions {
  readonly registry_path?: string;
  /** Injected registry lookup · defaults to production getProject. Used by tests. */
  readonly resolveProjectExists?: (project_id: string) => boolean;
}

function defaultRegistryPath(): string {
  return path.resolve(process.cwd(), "data", "nex1-task-bindings", "index.jsonl");
}

// ── Validators ─────────────────────────────────────────────────────────

// task_id is a Postgres UUID (v4 default). Accept standard UUID hyphenated form.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT_ID_RE = /^[a-z0-9]{8,64}$/i;

// ── Public entry: bindTaskToProject ────────────────────────────────────

export function bindTaskToProject(
  input: BindTaskInput,
  opts: BindingOptions = {},
): BindResult {
  if (!UUID_RE.test(input.task_id)) {
    return fail("TASK_ID_INVALID", `task_id must be a UUID · got "${input.task_id}"`);
  }
  if (!PROJECT_ID_RE.test(input.project_id)) {
    return fail("PROJECT_ID_INVALID", `project_id must match /^[a-z0-9]{8,64}$/i · got "${input.project_id}"`);
  }

  // Anti-fabrication: project MUST exist in the canonical registry.
  const projectExists = opts.resolveProjectExists ?? ((pid) => getProject(pid) !== null);
  if (!projectExists(input.project_id)) {
    return fail(
      "PROJECT_NOT_IN_REGISTRY",
      `project_id "${input.project_id}" is not in the canonical NEX Project registry`,
    );
  }

  // Check for existing binding · immutable
  const registryPath = opts.registry_path ?? defaultRegistryPath();
  const existing = readBindingsSilent(registryPath);
  for (const row of existing) {
    if (row.task_id === input.task_id) {
      if (row.project_id === input.project_id) {
        // Idempotent · identical rebind is a no-op success
        return { ok: true, binding: row };
      }
      return fail(
        "TASK_ALREADY_BOUND_TO_DIFFERENT_PROJECT",
        `task "${input.task_id}" is already bound to project "${row.project_id}"`,
      );
    }
  }

  const binding: TaskProjectBinding = {
    record_type: "NEX_TASK_PROJECT_BINDING",
    task_id: input.task_id,
    project_id: input.project_id,
    bound_at_iso: new Date().toISOString(),
    bound_by: input.bound_by,
    zero_llm: true,
    ledger: "B",
    version: TASK_PROJECT_BINDING_VERSION,
  };

  const dir = path.dirname(registryPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(registryPath, JSON.stringify(binding) + "\n");

  return { ok: true, binding };
}

// ── Public entry: getProjectForTask ────────────────────────────────────

export function getProjectForTask(task_id: string, opts: BindingOptions = {}): string | null {
  const rows = readBindingsSilent(opts.registry_path ?? defaultRegistryPath());
  for (const row of rows) {
    if (row.task_id === task_id) return row.project_id;
  }
  return null;
}

// ── Public entry: listBindingsForProject ───────────────────────────────

export function listBindingsForProject(project_id: string, opts: BindingOptions = {}): readonly TaskProjectBinding[] {
  const rows = readBindingsSilent(opts.registry_path ?? defaultRegistryPath());
  return Object.freeze(rows.filter((r) => r.project_id === project_id));
}

// ── Public entry: listAllBindings ──────────────────────────────────────

export function listAllBindings(opts: BindingOptions = {}): readonly TaskProjectBinding[] {
  return readBindingsSilent(opts.registry_path ?? defaultRegistryPath());
}

// ── Private ────────────────────────────────────────────────────────────

function fail(code: BindFailure["reason_code"], reason: string): BindFailure {
  return { ok: false, reason_code: code, reason };
}

function readBindingsSilent(registryPath: string): readonly TaskProjectBinding[] {
  if (!existsSync(registryPath)) return [];
  let text: string;
  try {
    text = readFileSync(registryPath, "utf8");
  } catch {
    return [];
  }
  const rows: TaskProjectBinding[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && parsed.record_type === "NEX_TASK_PROJECT_BINDING") {
        rows.push(parsed as TaskProjectBinding);
      }
    } catch {
      // silently skip corrupted lines · earlier bindings still take precedence
    }
  }
  return rows;
}
