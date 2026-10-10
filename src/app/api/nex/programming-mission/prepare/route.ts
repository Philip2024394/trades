// POST /api/nex/programming-mission/prepare
//
// Founder-locked 2026-09-14. PHASE 1 of the two-phase Send-to-NEX1
// button. Runs NEX1 inspection + code authoring and persists a draft
// mission. Returns a "Draft ready for founder authorization" record
// with a preview of the authored bytes. This endpoint has NO ability
// to execute · NO ability to mutate files outside the workspace ·
// NO ability to grant authority. It draft, and only draft.
//
// Founder rule (locked): Review ≠ Authorization ≠ Verification.

import { NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createOrLoadIdentity } from "@/lib/nex-agent-runtime/process/identity";
import {
  prepareProgrammingMissionDraft,
  type PrepareDraftInput,
} from "@/lib/nex-agent-runtime/programming-mission/draft";
import type { FunctionSpec } from "@/lib/nex-agent-runtime/programming-mission/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PrepareBody {
  readonly title?: string;
  readonly workspace_root?: string;
  readonly target_files_to_inspect?: readonly string[];
  /** Single-file (M-01) shape · one impl + one test */
  readonly implementation_path?: string;
  readonly test_path?: string;
  readonly function_spec?: FunctionSpec;
  /** Multi-file (M-02+) shape · N proposed files each with own spec */
  readonly proposed_files?: readonly {
    readonly path: string;
    readonly kind: "implementation" | "test";
    readonly function_spec: FunctionSpec;
  }[];
  readonly test_runner_relative_path?: string;
  readonly requirements_summary?: string;
}

const HQ_NEX1_AGENT_ID = "nex1-hq-server" as const;

// Workspace root must sit inside data/nex-agent-workspaces/ · absolutely no
// other path is acceptable. This is enforced BEFORE any read/author runs.
function workspaceAcceptable(workspace_root: string): { ok: true } | { ok: false; reason: string } {
  const repoRoot = process.cwd().replace(/\\/g, "/");
  const abs = path.resolve(workspace_root).replace(/\\/g, "/");
  const sanctioned = path.join(repoRoot, "data/nex-agent-workspaces").replace(/\\/g, "/");
  if (!abs.startsWith(sanctioned + "/") && abs !== sanctioned) {
    return { ok: false, reason: `workspace_root must be under ${sanctioned} · got ${abs}` };
  }
  return { ok: true };
}

// Deliberately-boring first-mission gates · accepts both M-01 shape
// (implementation_path/test_path/function_spec) and M-02 multi-file shape
// (proposed_files array).
function briefAcceptable(body: PrepareBody): { ok: true } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid JSON body" };
  if (!body.title || typeof body.title !== "string" || body.title.length < 4) return { ok: false, reason: "title required (min 4 chars)" };
  if (!body.workspace_root || typeof body.workspace_root !== "string") return { ok: false, reason: "workspace_root required" };
  if (!Array.isArray(body.target_files_to_inspect) || body.target_files_to_inspect.length === 0) return { ok: false, reason: "target_files_to_inspect required (non-empty)" };

  // §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract infrastructure.
  // `typed_data_contract` added to supported kinds so C1 lab authoring can
  // pass the /prepare gate. Spec validation is delegated to typed-data-
  // contract-authoring.ts (deterministic refusal for out-of-grammar specs).
  const supportedKinds = new Set(["truncate_words", "short_report", "text_stats", "describe_text", "fibonacci_memoised", "unguided", "typed_data_contract"]);
  const pathsToValidate: string[] = [...body.target_files_to_inspect];

  if (Array.isArray(body.proposed_files) && body.proposed_files.length > 0) {
    // Multi-file (M-02+) shape
    if (body.proposed_files.length < 2) return { ok: false, reason: "proposed_files must contain at least 1 implementation + 1 test" };
    const impls = body.proposed_files.filter((f) => f.kind === "implementation");
    const tests = body.proposed_files.filter((f) => f.kind === "test");
    if (impls.length === 0 || tests.length === 0) return { ok: false, reason: "proposed_files must contain both implementation and test kinds" };
    for (const f of body.proposed_files) {
      if (typeof f.path !== "string" || f.path.length === 0) return { ok: false, reason: "proposed_files entry missing path" };
      if (!f.function_spec || typeof f.function_spec !== "object") return { ok: false, reason: `proposed_files entry at ${f.path} missing function_spec` };
      if (!supportedKinds.has(f.function_spec.algorithm_kind)) return { ok: false, reason: `unsupported algorithm_kind '${f.function_spec.algorithm_kind}' at ${f.path}` };
      pathsToValidate.push(f.path);
    }
    if (!body.test_runner_relative_path) return { ok: false, reason: "test_runner_relative_path required for multi-file missions" };
    pathsToValidate.push(body.test_runner_relative_path);
  } else {
    // Single-file (M-01) shape
    if (!body.implementation_path || typeof body.implementation_path !== "string") return { ok: false, reason: "implementation_path required" };
    if (!body.test_path || typeof body.test_path !== "string") return { ok: false, reason: "test_path required" };
    if (!body.function_spec || typeof body.function_spec !== "object") return { ok: false, reason: "function_spec required" };
    if (!supportedKinds.has(body.function_spec.algorithm_kind)) return { ok: false, reason: `unsupported algorithm_kind · got ${body.function_spec.algorithm_kind}` };
    if (!Array.isArray(body.function_spec.edge_cases) || body.function_spec.edge_cases.length < 3) return { ok: false, reason: "function_spec.edge_cases required (at least 3)" };
    pathsToValidate.push(body.implementation_path, body.test_path);
  }

  // Path safety — no absolute paths · no ..
  for (const p of pathsToValidate) {
    if (typeof p !== "string" || p.length === 0) return { ok: false, reason: "empty path in brief" };
    if (path.isAbsolute(p) || p.includes("..")) return { ok: false, reason: `path ${p} must be workspace-relative and free of '..'` };
  }
  return { ok: true };
}

export async function POST(req: Request): Promise<Response> {
  let body: PrepareBody;
  try { body = (await req.json()) as PrepareBody; }
  catch { return NextResponse.json({ error: "invalid_json_body" }, { status: 400 }); }

  const briefCheck = briefAcceptable(body);
  if (!briefCheck.ok) return NextResponse.json({ error: "invalid_brief", reason: briefCheck.reason }, { status: 400 });
  const wsCheck = workspaceAcceptable(body.workspace_root!);
  if (!wsCheck.ok) return NextResponse.json({ error: "workspace_root_unsafe", reason: wsCheck.reason }, { status: 400 });

  // Load-or-create the persistent NEX1 server identity. This identity
  // signs inspection evidence · it is NOT a founder key · it cannot
  // grant execution authority.
  const idResult = await createOrLoadIdentity({ repoRoot: process.cwd(), agent_id: HQ_NEX1_AGENT_ID, createIfMissing: true });
  if (!idResult.ok) return NextResponse.json({ error: "nex1_identity_unavailable", reason: idResult.reason }, { status: 500 });

  // Multi-file (M-02+) uses proposed_files. Single-file (M-01) uses the
  // implementation_path/test_path/function_spec shape.
  const proposedFiles = Array.isArray(body.proposed_files) && body.proposed_files.length > 0
    ? body.proposed_files
    : [
        { path: body.implementation_path!, kind: "implementation" as const, function_spec: body.function_spec! },
        { path: body.test_path!,           kind: "test"           as const, function_spec: body.function_spec! },
      ];
  const testRunner = body.test_runner_relative_path
    ?? proposedFiles.find((f) => f.kind === "test")?.path
    ?? body.test_path!;
  const input: PrepareDraftInput = {
    mission_id: `MSN-${randomUUID()}`,
    title: body.title!,
    workspace_root: body.workspace_root!,
    target_files_to_inspect: body.target_files_to_inspect!,
    proposed_new_files: proposedFiles,
    requirements_summary: body.requirements_summary ?? "",
    requester_identity: idResult.identity,
    requester_instance_id: `hq-${randomUUID().slice(0, 12)}`,
    test_runner_relative_path: testRunner,
  };

  const result = await prepareProgrammingMissionDraft(input);
  const d = result.draft;

  // Response deliberately does NOT expose:
  //   - full authored bytes (available via /api/nex/programming-mission/draft/[id])
  //   - anything that grants authority
  return NextResponse.json({
    ok: true,
    verdict: d.verdict,
    refusal_reason: d.refusal_reason,
    draft_id: d.draft_id,
    mission_id: d.mission_id,
    title: d.title,
    workspace_root: d.workspace_root,
    target_files_read: d.target_files_to_inspect,
    style_detected: d.style_detected,
    dependency_graph: d.dependency_graph
      ? {
          cross_file_edge_count: d.dependency_graph.cross_file_edge_count,
          edges: d.dependency_graph.edges,
          files: d.dependency_graph.files,
        }
      : null,
    algorithm_selection_evidence: d.algorithm_selection_evidence,
    pair_selection_evidence: d.pair_selection_evidence,
    authored_files: d.authored_files.map((f) => ({
      path: f.path, kind: f.kind, bytes: f.bytes, sha256_hex: f.sha256_hex,
      extension: f.extension, content_preview: f.content_preview,
    })),
    nex1_inspection_evidence_id: d.nex1_inspection_evidence_id,
    drafted_at: d.drafted_at,
    delegate_agent_id: HQ_NEX1_AGENT_ID,
    delegate_public_key_der_hex: idResult.identity.public_key_der_hex,
    doctrine_note:
      "Draft ready for founder authorization. Review ≠ Authorization ≠ Verification. " +
      "This endpoint has NOT executed any code, NOT mutated any file, NOT granted any authority. " +
      "To execute this drafted mission, the founder must sign a delegation OFFLINE using " +
      "scripts/nex-founder-sign-delegation.mjs, then POST the signed delegation + draft_id to " +
      "/api/nex/programming-mission/execute. Every downstream gate (NEX2 · NEX3 · Security · " +
      "Orchestrator · Workstation · WO-04 · build · test · verify) is still enforced.",
  }, { status: 200 });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({
    error: "method_not_allowed",
    note: "POST a programming.small_change mission brief to prepare a draft.",
    accepted_body_shape: {
      title: "string, min 4 chars",
      workspace_root: "absolute path under data/nex-agent-workspaces/",
      target_files_to_inspect: ["workspace-relative paths"],
      implementation_path: "workspace-relative path (.mjs)",
      test_path: "workspace-relative path (.mjs)",
      function_spec: {
        function_name: "string",
        parameters: [{ name: "string", type: "string|number|boolean" }],
        return_type: "string|number|boolean",
        algorithm_kind: "truncate_words",
        edge_cases: [{ when: "string", input: ["..."], expect: "..." }],
      },
      requirements_summary: "string",
    },
  }, { status: 405 });
}
