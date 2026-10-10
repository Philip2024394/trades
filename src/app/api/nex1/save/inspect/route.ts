// src/app/api/nex1/save/inspect/route.ts
//
// NEX1 · Workstation Save · Inspect endpoint
// Founder-authorised 2026-09-19 · Ledger B additive · Zero LLM
//
// SEMANTICS
//   State-envelope trigger. Composes assessProjectState + buildSavePushEnvelope.
//   Does NOT commit, push, or publish.
//
// PROJECT BINDING (2026-09-19 · new)
//   Save now REFUSES to inspect anything that is not a resolved NEX Project.
//   The customer must provide `active_project_id`. The endpoint resolves it
//   via `resolveActiveProject()` and inspects ONLY the resolved workspace.
//
//   Save NEVER falls back to process.cwd(). NEX infrastructure is never
//   presented as "the customer's project."
//
// FOUNDER RULES HONOURED
//   · Rule 6 · null/absent id → REFUSED · no silent selection
//   · Anti-fabrication · workspace_root always comes from the registry,
//     which itself refuses process.cwd() at register time
//   · §14/§18 · remote_save_verified only when PUSH_SUCCEEDED

import { NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { assessProjectState } from "@/lib/nex-agent/code-engine/capability-project-state-detector";
import { buildSavePushEnvelope } from "@/lib/nex-agent/code-engine/capability-save-push-envelope";
import { resolveActiveProject } from "@/lib/nex-agent/code-engine/capability-nex-project-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InspectRequestBody {
  readonly active_project_id?: string | null;
}

export type SaveInspectResponse =
  | {
      readonly ok: true;
      readonly project: {
        readonly project_id: string;
        readonly project_name: string;
        readonly project_slug: string;
        readonly workspace_root: string;
      };
      readonly assessment: ReturnType<typeof assessProjectState>;
      readonly envelope: ReturnType<typeof buildSavePushEnvelope>;
      readonly evidence_receipt_path: string;
    }
  | {
      readonly ok: false;
      readonly refused: "NOT_AVAILABLE" | "AMBIGUOUS" | "INVALID" | "SERVER_ERROR";
      readonly reason: string;
      readonly candidates?: readonly {
        readonly project_id: string;
        readonly project_name: string;
        readonly project_slug: string;
      }[];
    };

export async function POST(req: Request): Promise<NextResponse<SaveInspectResponse>> {
  // Parse body; tolerate missing/invalid JSON so we can return a clean refusal.
  let body: InspectRequestBody = {};
  try { body = (await req.json()) as InspectRequestBody; } catch { /* empty · falls through to NOT_AVAILABLE */ }
  const rawId = typeof body.active_project_id === "string" ? body.active_project_id.trim() : "";
  const active_project_id = rawId.length > 0 ? rawId : null;

  // Resolve via the canonical Project registry.
  const outcome = resolveActiveProject({ active_project_id });

  if (outcome.status === "NOT_AVAILABLE") {
    return NextResponse.json({
      ok: false,
      refused: "NOT_AVAILABLE",
      reason: outcome.reason,
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
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
    return NextResponse.json({
      ok: false,
      refused: "INVALID",
      reason: outcome.reason,
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  // RESOLVED · inspect the Project's workspace_root · never cwd.
  const project = outcome.project;
  try {
    const assessment = assessProjectState({ project_root: project.workspace_root });
    const envelope = buildSavePushEnvelope({
      project_state: assessment,
      providers: [], // provider-registry ships zero implementations · empty is honest
      project_display_name: project.project_name,
    });

    // Audit log lives at NEX infra location (not customer content) · this is intentional.
    const events_dir = path.join(process.cwd(), "data", "nex1-save-events");
    if (!existsSync(events_dir)) mkdirSync(events_dir, { recursive: true });
    const receipt_path = path.join(events_dir, "inspections.jsonl");
    const receipt = {
      event: "save_inspect",
      at_iso: new Date().toISOString(),
      project_id: project.project_id,
      project_slug: project.project_slug,
      workspace_root: project.workspace_root,
      close_flow_state: envelope.close_flow_state,
      project_git_state: assessment.state,
      input_digest: envelope.input_digest,
      remote_save_verified: envelope.remote_save_verified,
      version: envelope.version,
    };
    appendFileSync(receipt_path, JSON.stringify(receipt) + "\n");

    return NextResponse.json({
      ok: true,
      project: {
        project_id: project.project_id,
        project_name: project.project_name,
        project_slug: project.project_slug,
        workspace_root: project.workspace_root,
      },
      assessment,
      envelope,
      evidence_receipt_path: receipt_path,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      refused: "SERVER_ERROR",
      reason: err instanceof Error ? err.message.slice(0, 200) : "unknown_error",
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
