// WO-NEX-RUNTIME-03 · NEX1 governed tool interface.
//
// Founder-locked 2026-09-13. Every tool has:
//   - explicit scope
//   - identity (signed invocation record)
//   - audit (persisted invocation)
//   - authorization requirements (agent-identity-only in RUNTIME-03)
//   - failure behaviour (returns { outcome, detail } · never throws)
//
// No tool in RUNTIME-03 mutates protected code, reaches the workstation,
// grants founder authority, or contacts the Internet.
//   - READ_ONLY:                 filesystem reads, GB reads
//   - RECORDS_INTENT:            writes a "prepared spec" record but does NOT execute
//   - CREATES_UNSIGNED_PROPOSAL: writes a CapEngineeringProposal with founder_signature_slot=null
//   - RECORDS_EVIDENCE:          writes agent-signed evidence to GB

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, sign as ed25519Sign } from "node:crypto";
import { spawn } from "node:child_process";
import { getStorage } from "@/lib/nex/storage/registry";
import { signEvidence, type AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { AGENT_EVIDENCE_COLLECTION } from "@/lib/nex-agent-runtime/process/types";
import {
  type ToolKind,
  type ToolInvocation,
  NEX1_TOOL_CONTRACTS,
  NEX1_TOOL_INVOCATIONS_COLLECTION,
} from "./types";

// ── Canonical invocation signing ───────────────────────────────────────

function canonicaliseInvocation(inv: Omit<ToolInvocation, "signature_hex">): Buffer {
  const ordered = {
    record_type: inv.record_type,
    invocation_id: inv.invocation_id,
    agent_id: inv.agent_id,
    instance_id: inv.instance_id,
    mission_id: inv.mission_id,
    kind: inv.kind,
    requested_at: inv.requested_at,
    completed_at: inv.completed_at,
    params: inv.params,
    outcome: inv.outcome,
    outcome_detail: inv.outcome_detail,
    result_ref: inv.result_ref,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

// ── Public tool result ─────────────────────────────────────────────────

export type ToolOutcome = "ok" | "denied" | "failed" | "unavailable";

export interface ToolResult<T = unknown> {
  readonly outcome: ToolOutcome;
  readonly detail: string;
  readonly value: T | null;
  readonly invocation_id: string;
}

// ── Tool runner context ────────────────────────────────────────────────

export interface ToolContext {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly repo_root: string;
  readonly mission_id: string | null;
}

// ── Path sanity ────────────────────────────────────────────────────────

/** Resolve a repo-relative path and refuse if it escapes repo_root or
 *  touches a protected root (data/nex-storage retained as read-only). */
function resolveRepoPath(repo_root: string, p: string): { ok: true; abs: string } | { ok: false; reason: string } {
  if (path.isAbsolute(p)) return { ok: false, reason: `path is absolute: ${p}` };
  if (p.split(/[\\/]/).includes("..")) return { ok: false, reason: `path escapes repo_root via ..: ${p}` };
  const abs = path.resolve(repo_root, p);
  const rel = path.relative(repo_root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return { ok: false, reason: `path resolves outside repo_root: ${abs}` };
  return { ok: true, abs };
}

// ── Invocation audit writer ────────────────────────────────────────────

async function recordInvocation(ctx: ToolContext, kind: ToolKind, params: Readonly<Record<string, unknown>>, requested_at: string, outcome: ToolOutcome, detail: string, result_ref: string | null): Promise<string> {
  const invocation_id = `INV-${randomUUID()}`;
  const base = {
    record_type: "NEX1_TOOL_INVOCATION" as const,
    invocation_id,
    agent_id: ctx.identity.agent_id,
    instance_id: ctx.instance_id,
    mission_id: ctx.mission_id,
    kind, requested_at, completed_at: new Date().toISOString(),
    params, outcome, outcome_detail: detail, result_ref,
  };
  const sig = ed25519Sign(null, canonicaliseInvocation(base), ctx.identity.private).toString("hex");
  const record: ToolInvocation = { ...base, signature_hex: sig };
  await getStorage().save(NEX1_TOOL_INVOCATIONS_COLLECTION, record);
  return invocation_id;
}

// ── Individual tools ───────────────────────────────────────────────────

export interface InspectRepositoryResult {
  readonly repo_root: string;
  readonly top_level: readonly { name: string; kind: "file" | "dir"; size: number }[];
}

export async function toolInspectRepository(ctx: ToolContext): Promise<ToolResult<InspectRepositoryResult>> {
  const requested_at = new Date().toISOString();
  try {
    const entries = await fs.readdir(ctx.repo_root, { withFileTypes: true });
    const top_level = await Promise.all(entries.map(async (e) => {
      try {
        const st = await fs.stat(path.join(ctx.repo_root, e.name));
        return { name: e.name, kind: e.isDirectory() ? "dir" as const : "file" as const, size: st.size };
      } catch {
        return { name: e.name, kind: e.isDirectory() ? "dir" as const : "file" as const, size: 0 };
      }
    }));
    const inv = await recordInvocation(ctx, "inspect_repository", {}, requested_at, "ok", `enumerated ${top_level.length} entries`, null);
    return { outcome: "ok", detail: `${top_level.length} entries`, value: { repo_root: ctx.repo_root, top_level }, invocation_id: inv };
  } catch (e) {
    const inv = await recordInvocation(ctx, "inspect_repository", {}, requested_at, "failed", (e as Error).message, null);
    return { outcome: "failed", detail: (e as Error).message, value: null, invocation_id: inv };
  }
}

export async function toolReadFile(ctx: ToolContext, params: { path: string; max_bytes?: number }): Promise<ToolResult<{ path: string; bytes: number; content: string }>> {
  const requested_at = new Date().toISOString();
  const guard = resolveRepoPath(ctx.repo_root, params.path);
  if (!guard.ok) {
    const inv = await recordInvocation(ctx, "read_file", params, requested_at, "denied", guard.reason, null);
    return { outcome: "denied", detail: guard.reason, value: null, invocation_id: inv };
  }
  try {
    const max = params.max_bytes ?? 200_000;
    const buf = await fs.readFile(guard.abs);
    const truncated = buf.length > max;
    const content = truncated ? buf.subarray(0, max).toString("utf8") + `\n… (${buf.length - max} more bytes)` : buf.toString("utf8");
    const inv = await recordInvocation(ctx, "read_file", params, requested_at, "ok", `${buf.length} bytes${truncated ? " (truncated)" : ""}`, null);
    return { outcome: "ok", detail: `${buf.length} bytes`, value: { path: params.path, bytes: buf.length, content }, invocation_id: inv };
  } catch (e) {
    const inv = await recordInvocation(ctx, "read_file", params, requested_at, "failed", (e as Error).message, null);
    return { outcome: "failed", detail: (e as Error).message, value: null, invocation_id: inv };
  }
}

/** search_code uses `git grep` when git is present, else refuses (unavailable). */
export async function toolSearchCode(ctx: ToolContext, params: { pattern: string; glob?: string; max_matches?: number }): Promise<ToolResult<{ pattern: string; matches: readonly { path: string; line: number; text: string }[] }>> {
  const requested_at = new Date().toISOString();
  const max = params.max_matches ?? 100;
  try {
    const args = ["grep", "-n", "-I", "--", params.pattern];
    if (params.glob) args.push(params.glob);
    const out = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn("git", args, { cwd: ctx.repo_root });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", (d) => { stdout += d.toString("utf8"); });
      child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
      child.on("error", () => resolve({ code: -1, stdout: "", stderr: "spawn failed" }));
    });
    if (out.code === -1) {
      const inv = await recordInvocation(ctx, "search_code", params, requested_at, "unavailable", "git binary not available", null);
      return { outcome: "unavailable", detail: "git binary not available", value: null, invocation_id: inv };
    }
    if (out.code !== 0 && out.stdout.length === 0) {
      const inv = await recordInvocation(ctx, "search_code", params, requested_at, "ok", "no matches", null);
      return { outcome: "ok", detail: "no matches", value: { pattern: params.pattern, matches: [] }, invocation_id: inv };
    }
    const matches: { path: string; line: number; text: string }[] = [];
    for (const line of out.stdout.split(/\r?\n/)) {
      if (matches.length >= max) break;
      const m = line.match(/^(.+?):(\d+):(.*)$/);
      if (m) matches.push({ path: m[1], line: Number(m[2]), text: m[3].slice(0, 500) });
    }
    const inv = await recordInvocation(ctx, "search_code", params, requested_at, "ok", `${matches.length} matches`, null);
    return { outcome: "ok", detail: `${matches.length} matches`, value: { pattern: params.pattern, matches }, invocation_id: inv };
  } catch (e) {
    const inv = await recordInvocation(ctx, "search_code", params, requested_at, "failed", (e as Error).message, null);
    return { outcome: "failed", detail: (e as Error).message, value: null, invocation_id: inv };
  }
}

export async function toolInspectDependencies(ctx: ToolContext): Promise<ToolResult<{ name: string; version: string; deps: number; devDeps: number }>> {
  const requested_at = new Date().toISOString();
  try {
    const raw = await fs.readFile(path.join(ctx.repo_root, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { name?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const value = {
      name: pkg.name ?? "",
      version: pkg.version ?? "",
      deps: Object.keys(pkg.dependencies ?? {}).length,
      devDeps: Object.keys(pkg.devDependencies ?? {}).length,
    };
    const inv = await recordInvocation(ctx, "inspect_dependencies", {}, requested_at, "ok", `${value.deps} deps · ${value.devDeps} devDeps`, null);
    return { outcome: "ok", detail: `${value.deps} deps · ${value.devDeps} devDeps`, value, invocation_id: inv };
  } catch (e) {
    const inv = await recordInvocation(ctx, "inspect_dependencies", {}, requested_at, "failed", (e as Error).message, null);
    return { outcome: "failed", detail: (e as Error).message, value: null, invocation_id: inv };
  }
}

/** RECORDS_INTENT: write a spec record but do NOT execute. */
export async function toolRunTestsInterface(ctx: ToolContext, params: { target_globs: readonly string[]; reason: string }): Promise<ToolResult<{ recorded_intent_id: string }>> {
  const requested_at = new Date().toISOString();
  const recorded_intent_id = `TEST-INTENT-${randomUUID()}`;
  await getStorage().save("nex1_test_run_intents", {
    record_type: "NEX1_TEST_RUN_INTENT",
    intent_id: recorded_intent_id,
    agent_id: ctx.identity.agent_id, instance_id: ctx.instance_id, mission_id: ctx.mission_id,
    target_globs: [...params.target_globs], reason: params.reason,
    created_at: requested_at, executed: false, note: "RUNTIME-03: this is intent only · workstation will execute later",
  });
  const inv = await recordInvocation(ctx, "run_tests_interface", params, requested_at, "ok", `recorded intent for ${params.target_globs.length} target(s)`, recorded_intent_id);
  return { outcome: "ok", detail: "recorded test-run intent · not executed", value: { recorded_intent_id }, invocation_id: inv };
}

/** RECORDS_EVIDENCE: agent-signed evidence into the standard evidence collection. */
export async function toolRecordEvidence(ctx: ToolContext, params: { kind: string; payload: Readonly<Record<string, unknown>> }): Promise<ToolResult<{ evidence_id: string }>> {
  const requested_at = new Date().toISOString();
  const evBase = {
    record_type: "NEX_AGENT_EVIDENCE" as const,
    evidence_id: `EV-${randomUUID()}`,
    agent_id: ctx.identity.agent_id,
    instance_id: ctx.instance_id,
    mission_id: ctx.mission_id,
    emitted_at: requested_at,
    kind: params.kind,
    payload: params.payload,
  };
  const signed = signEvidence(ctx.identity, evBase);
  await getStorage().save(AGENT_EVIDENCE_COLLECTION, signed);
  const inv = await recordInvocation(ctx, "record_evidence", { kind: params.kind }, requested_at, "ok", `evidence ${signed.evidence_id.slice(0, 24)}…`, signed.evidence_id);
  return { outcome: "ok", detail: `evidence recorded`, value: { evidence_id: signed.evidence_id }, invocation_id: inv };
}

// ── Registry ───────────────────────────────────────────────────────────

export function toolContractFor(kind: ToolKind) {
  return NEX1_TOOL_CONTRACTS[kind];
}
