// src/app/api/nex1/project/run/route.ts
//
// NEX1 · Project-bound Preview/Run · Founder-authorised 2026-09-19
// Ledger B additive · Zero LLM
//
// PURPOSE
//   Bridge between the canonical Project registry and the existing
//   capability-dev-server-orchestrator. The endpoint refuses to run
//   anything that isn't a resolved Project. It never falls back to
//   process.cwd(). It never derives a Project from a URL or a task.
//
// FLOW
//   active_project_id
//     → resolveActiveProject
//     → project.workspace_root
//     → startSession({ project_root: project.workspace_root, ... })
//     → SessionState with project_id binding
//
// FOUNDER RULES HONOURED
//   · Rule 6 · every action is explicit · "plan" is inspection only,
//     "start" requires the customer to pass action="start"
//   · Anti-fabrication · workspace_root always comes from the registry,
//     the registry refuses process.cwd() at register time
//   · The existing dev-server-orchestrator is reused wholesale · no new
//     process/lifecycle/port-allocation code is written here.

import { NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  resolveActiveProject,
  type NexProjectRecord,
} from "@/lib/nex-agent/code-engine/capability-nex-project-registry";
import {
  startSession,
  stopSession,
  getSession,
  deriveSessionId,
  type SessionState,
} from "@/lib/nex-agent/code-engine/capability-dev-server-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "plan" | "start" | "stop" | "status";

interface RunRequestBody {
  readonly active_project_id?: string | null;
  readonly action?: Action;
}

interface RunPlan {
  readonly project_id: string;
  readonly project_name: string;
  readonly project_slug: string;
  readonly workspace_root: string;
  readonly framework: NexProjectRecord["framework"];
  readonly session_id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly port_preferred: number;
}

export type ProjectRunResponse =
  | {
      readonly ok: true;
      readonly action: Action;
      readonly plan: RunPlan;
      readonly session: SessionState | null;
      readonly preview_url: string | null;
      readonly evidence_receipt_path: string | null;
    }
  | {
      readonly ok: false;
      readonly refused: "NOT_AVAILABLE" | "AMBIGUOUS" | "INVALID" | "SERVER_ERROR" | "UNSUPPORTED_FRAMEWORK";
      readonly reason: string;
      readonly candidates?: readonly {
        readonly project_id: string;
        readonly project_name: string;
        readonly project_slug: string;
      }[];
    };

// ── Deterministic framework → command/args/port mapping ─────────────────
//
// Mirrors capability-project-scaffolder templates. No new runtime semantics.

interface RuntimePlan {
  readonly command: string;
  readonly args: readonly string[];
  readonly port_preferred: number;
  readonly startup_markers: readonly RegExp[];
}

function planFor(framework: NexProjectRecord["framework"], port: number): RuntimePlan | null {
  if (framework === "next-app-router") {
    return {
      command: "npx",
      args: ["next", "dev", "-p", String(port)],
      port_preferred: port,
      startup_markers: [/Ready in/i, /- Local:/i, /Local:.*http/i],
    };
  }
  if (framework === "static-html") {
    return {
      command: "npx",
      args: ["serve", ".", "-l", String(port)],
      port_preferred: port,
      startup_markers: [/Accepting connections/i, /Local:/i, /- Local:/i],
    };
  }
  return null;
}

function appendRunEvent(event: Record<string, unknown>): string {
  const dir = path.join(process.cwd(), "data", "nex1-project-run-events");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "runs.jsonl");
  appendFileSync(p, JSON.stringify({ at_iso: new Date().toISOString(), ...event }) + "\n");
  return p;
}

// ── Public entry ────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse<ProjectRunResponse>> {
  let body: RunRequestBody = {};
  try { body = (await req.json()) as RunRequestBody; } catch { /* falls through */ }
  const rawId = typeof body.active_project_id === "string" ? body.active_project_id.trim() : "";
  const active_project_id = rawId.length > 0 ? rawId : null;
  const action: Action = body.action ?? "plan";

  // 1. Resolve · same 4-state contract as Save
  const outcome = resolveActiveProject({ active_project_id });
  if (outcome.status === "NOT_AVAILABLE") {
    return NextResponse.json({ ok: false, refused: "NOT_AVAILABLE", reason: outcome.reason }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  if (outcome.status === "AMBIGUOUS") {
    return NextResponse.json({
      ok: false,
      refused: "AMBIGUOUS",
      reason: outcome.reason,
      candidates: outcome.candidates.map((c) => ({
        project_id: c.project_id,
        project_name: c.project_name,
        project_slug: c.project_slug,
      })),
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  if (outcome.status === "INVALID") {
    return NextResponse.json({ ok: false, refused: "INVALID", reason: outcome.reason }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  // 2. RESOLVED · derive runtime plan from framework · never invent
  const project = outcome.project;
  const port_preferred = 3100; // NEX Workstation prefers 3100+ to avoid collision with the trades dev server (3008) and default 3000
  const rt = planFor(project.framework, port_preferred);
  if (!rt) {
    return NextResponse.json({
      ok: false,
      refused: "UNSUPPORTED_FRAMEWORK",
      reason: `no runtime plan for framework "${project.framework}"`,
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  const session_id = deriveSessionId(project.workspace_root);
  const plan: RunPlan = {
    project_id: project.project_id,
    project_name: project.project_name,
    project_slug: project.project_slug,
    workspace_root: project.workspace_root,
    framework: project.framework,
    session_id,
    command: rt.command,
    args: rt.args,
    port_preferred: rt.port_preferred,
  };

  // 3. Dispatch action · all actions share the same Project binding.
  //    Rule 6: "plan" is inspection-only. "start" requires explicit
  //    action="start" from the customer.

  if (action === "plan") {
    const existing = getSession(session_id);
    const preview_url = existing?.port ? `http://localhost:${existing.port}` : null;
    const receipt = appendRunEvent({
      event: "run_plan",
      project_id: project.project_id,
      session_id,
      workspace_root: project.workspace_root,
      framework: project.framework,
    });
    return NextResponse.json({
      ok: true,
      action,
      plan,
      session: existing,
      preview_url,
      evidence_receipt_path: receipt,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "status") {
    const existing = getSession(session_id);
    const preview_url = existing?.port ? `http://localhost:${existing.port}` : null;
    return NextResponse.json({
      ok: true,
      action,
      plan,
      session: existing,
      preview_url,
      evidence_receipt_path: null,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "start") {
    // Explicit customer action. Idempotent: if a session is already running, return it.
    const existing = getSession(session_id);
    if (existing && (existing.lifecycle === "starting" || existing.lifecycle === "started" || existing.lifecycle === "server_listening" || existing.lifecycle === "responding")) {
      const receipt = appendRunEvent({
        event: "run_start_idempotent",
        project_id: project.project_id,
        session_id,
        lifecycle: existing.lifecycle,
      });
      return NextResponse.json({
        ok: true,
        action,
        plan,
        session: existing,
        preview_url: existing.port ? `http://localhost:${existing.port}` : null,
        evidence_receipt_path: receipt,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    try {
      const started = await startSession({
        session_id,
        project_root: project.workspace_root,
        command: rt.command,
        args: [...rt.args],
        port_preferred: rt.port_preferred,
        startup_markers: rt.startup_markers,
      });
      const receipt = appendRunEvent({
        event: "run_start",
        project_id: project.project_id,
        session_id,
        port: started.port,
        lifecycle: started.lifecycle,
      });
      return NextResponse.json({
        ok: true,
        action,
        plan,
        session: started,
        preview_url: started.port ? `http://localhost:${started.port}` : null,
        evidence_receipt_path: receipt,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 200) : "unknown_start_error";
      appendRunEvent({ event: "run_start_failed", project_id: project.project_id, session_id, reason });
      return NextResponse.json({
        ok: false,
        refused: "SERVER_ERROR",
        reason,
      }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (action === "stop") {
    const existing = getSession(session_id);
    if (!existing) {
      return NextResponse.json({
        ok: true,
        action,
        plan,
        session: null,
        preview_url: null,
        evidence_receipt_path: null,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    try {
      const stopped = await stopSession(session_id);
      const receipt = appendRunEvent({
        event: "run_stop",
        project_id: project.project_id,
        session_id,
        lifecycle: stopped.lifecycle,
      });
      return NextResponse.json({
        ok: true,
        action,
        plan,
        session: stopped,
        preview_url: null,
        evidence_receipt_path: receipt,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 200) : "unknown_stop_error";
      return NextResponse.json({
        ok: false,
        refused: "SERVER_ERROR",
        reason,
      }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
  }

  return NextResponse.json({
    ok: false,
    refused: "SERVER_ERROR",
    reason: `unknown_action:${action}`,
  }, { status: 400, headers: { "Cache-Control": "no-store" } });
}
