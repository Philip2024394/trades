// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit
// NEX bounded infrastructure · cockpit-state API endpoint · 2026-09-14
//
// GET /api/nex1/workstation-live/cockpit-state?trace_id=X&preview_target=Y&preview_nonce=N
//
// Returns a derived CockpitStateView built from:
//   - orchestrator trace snapshot (via existing trace lookup)
//   - real git changes (via git status --porcelain=v1)
//   - preview target + nonce passed in by the client
// Never fabricates state. Every uncomposed input surface is labelled
// not_connected in the response.

import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { deriveCockpitState } from "@/lib/nex-agent-runtime/workstation-cockpit/cockpit-state";
import type { DeriveCockpitStateRequest } from "@/lib/nex-agent-runtime/workstation-cockpit/cockpit-state-types";
import { getTrace } from "@/lib/nex1-orchestrator/trace-store";
import type { WorkflowTrace } from "@/lib/nex1-orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CockpitStateResponse {
  readonly ok: boolean;
  readonly view: unknown;
  readonly source_probe: {
    readonly trace_id: string | null;
    readonly trace_present: boolean;
    readonly git_changes_present: boolean;
    readonly git_changes_reason?: string;
  };
  readonly captured_at: string;
}

// ── Real git status probe (read-only shell-out) ─────────────────────────

function readGitChanges(): { changes: readonly { readonly status: string; readonly path: string }[] | null; reason?: string } {
  try {
    const r = spawnSync("git", ["status", "--porcelain=v1"], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    });
    if (r.status !== 0) {
      return { changes: null, reason: `git status exit ${r.status}` };
    }
    const lines = r.stdout.split(/\r?\n/).filter((l) => l.length > 0);
    const changes: { status: string; path: string }[] = [];
    for (const line of lines) {
      if (line.length < 4) continue;
      const status = line.slice(0, 2).trim() || line.slice(0, 2);
      const path = line.slice(3).trim();
      if (path.length === 0) continue;
      changes.push({ status, path });
    }
    return { changes };
  } catch (e) {
    return { changes: null, reason: `git spawn failed: ${(e as Error).message.slice(0, 80)}` };
  }
}

// ── Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse<CockpitStateResponse | { error: string }>> {
  const url = new URL(request.url);
  const traceId = url.searchParams.get("trace_id");
  const previewTarget = url.searchParams.get("preview_target") ?? "/";
  const nonceRaw = url.searchParams.get("preview_nonce");
  const previewNonce = Number.isFinite(Number(nonceRaw)) ? Number(nonceRaw) : 0;

  let trace: WorkflowTrace | null = null;
  if (traceId && traceId.length > 0) {
    try {
      trace = getTrace(traceId) ?? null;
    } catch {
      trace = null;
    }
  }

  const git = readGitChanges();

  // §36-W-2-a UX filter · limit the file-change ledger to real engineering
  // paths. Runtime data dumps (data/nex-storage/**, data/knowledge-acquisition/**,
  // data/master-ai/**, data/nex-lab/**, preservation-staging/**, deploy/**) are
  // excluded because they're not engineering evidence. Founder can override
  // by passing `?ledger_prefixes=` on the URL.
  const DEFAULT_LEDGER_PREFIXES: readonly string[] = Object.freeze([
    "src/",
    "docs/NEX1/",
    "docs/DECISIONS/",
    "scripts/",
    "package.json",
    "vitest.config",
    "tsconfig",
    "next.config",
  ]);
  const rawPrefixParam = url.searchParams.get("ledger_prefixes");
  const ledger_include_prefixes: readonly string[] | null = rawPrefixParam === null
    ? DEFAULT_LEDGER_PREFIXES
    : rawPrefixParam.length === 0
      ? null                                        // empty ⇒ no filter (show everything)
      : rawPrefixParam.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  const req: DeriveCockpitStateRequest = {
    trace: trace
      ? {
          trace_id: trace.trace_id,
          current_stage_id: trace.current_state,
          stages: Object.entries(trace.stage_statuses).map(([stage_id, res]) => ({
            stage_id,
            status: (res as { status?: string } | undefined)?.status ?? "PENDING",
          })),
        }
      : null,
    lifecycle_state: null, // E7 lifecycle is a separate record · not yet stored alongside WorkflowTrace
    specialist_findings: null, // E5 findings are ephemeral · not yet persisted per-trace
    refutation_records: null, // E6 records likewise
    git_changes: git.changes,
    preview_target_url: previewTarget,
    preview_nonce: previewNonce,
    preview_last_updated_at: previewNonce > 0 ? new Date().toISOString() : null,
    ledger_include_prefixes,
  };

  const derived = deriveCockpitState(req);
  if (derived.kind === "FAILURE") {
    return NextResponse.json({ error: derived.refusal_code }, { status: 400 });
  }

  const body: CockpitStateResponse = {
    ok: true,
    view: derived.view,
    source_probe: {
      trace_id: traceId,
      trace_present: trace !== null,
      git_changes_present: git.changes !== null,
      ...(git.reason ? { git_changes_reason: git.reason } : {}),
    },
    captured_at: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
