// src/app/api/nex1/project/export/route.ts
//
// NEX1 · Project-scoped Export · Founder-authorised 2026-09-19
// Ledger B additive · Zero LLM
//
// FLOW
//   active_project_id
//     → resolveActiveProject
//     → project.workspace_root
//     → archiveProject({ dry_run | real })
//     → ArchiveManifest with sha256 + byte count + exclusions
//
// FOUNDER RULES HONOURED
//   · Rule 6 · resolving the Project does NOT create an archive · the
//     explicit action="archive" from the customer is the authorisation
//   · Anti-fabrication · archiver receives workspace_root from the registry,
//     which itself refuses process.cwd() at register time
//   · Path isolation guaranteed by capability-project-archive.ts
//   · No Publish · no Git · no marketplace · no dependency rewriting

import { NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { resolveActiveProject } from "@/lib/nex-agent/code-engine/capability-nex-project-registry";
import { archiveProject, type ArchiveManifest } from "@/lib/nex-agent/code-engine/capability-project-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Action = "plan" | "archive";

interface ExportRequestBody {
  readonly active_project_id?: string | null;
  readonly action?: Action;
  readonly created_by?: string;
}

export type ProjectExportResponse =
  | {
      readonly ok: true;
      readonly action: Action;
      readonly manifest: ArchiveManifest;
      readonly evidence_receipt_path: string;
    }
  | {
      readonly ok: false;
      readonly refused: "NOT_AVAILABLE" | "AMBIGUOUS" | "INVALID" | "ARCHIVE_FAILED" | "SERVER_ERROR";
      readonly reason: string;
      readonly reason_code?: string;
      readonly candidates?: readonly {
        readonly project_id: string;
        readonly project_name: string;
        readonly project_slug: string;
      }[];
    };

function appendExportEvent(event: Record<string, unknown>): string {
  const dir = path.join(process.cwd(), "data", "nex1-project-export-events");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "exports.jsonl");
  appendFileSync(p, JSON.stringify({ at_iso: new Date().toISOString(), ...event }) + "\n");
  return p;
}

export async function POST(req: Request): Promise<NextResponse<ProjectExportResponse>> {
  let body: ExportRequestBody = {};
  try { body = (await req.json()) as ExportRequestBody; } catch { /* falls through */ }
  const rawId = typeof body.active_project_id === "string" ? body.active_project_id.trim() : "";
  const active_project_id = rawId.length > 0 ? rawId : null;
  const action: Action = body.action ?? "plan";
  const created_by = typeof body.created_by === "string" && body.created_by.trim().length > 0
    ? body.created_by.trim().slice(0, 60)
    : "founder";

  // 1. Resolve · same 4-state contract as Save / Run
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

  // 2. RESOLVED · run archiver with Project's workspace_root · never cwd
  const project = outcome.project;
  try {
    const r = await archiveProject({
      project_id: project.project_id,
      project_slug: project.project_slug,
      workspace_root: project.workspace_root,
      created_by,
      dry_run: action === "plan",
    });

    if (!r.ok) {
      appendExportEvent({
        event: "export_failed",
        project_id: project.project_id,
        action,
        reason_code: r.reason_code,
        reason: r.reason,
      });
      return NextResponse.json({
        ok: false,
        refused: "ARCHIVE_FAILED",
        reason: r.reason,
        reason_code: r.reason_code,
      }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }

    const receipt = appendExportEvent({
      event: action === "plan" ? "export_plan" : "export_archived",
      project_id: project.project_id,
      project_slug: project.project_slug,
      workspace_root: project.workspace_root,
      archive_id: r.manifest.archive_id,
      archive_path: r.manifest.archive_path,
      archive_sha256: r.manifest.archive_sha256,
      archive_bytes: r.manifest.archive_bytes,
      files_included: r.manifest.files_included,
      files_excluded: r.manifest.files_excluded,
      total_source_bytes: r.manifest.total_source_bytes,
    });

    return NextResponse.json({
      ok: true,
      action,
      manifest: r.manifest,
      evidence_receipt_path: receipt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "unknown_export_error";
    appendExportEvent({ event: "export_exception", project_id: project.project_id, action, reason });
    return NextResponse.json({
      ok: false,
      refused: "SERVER_ERROR",
      reason,
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
