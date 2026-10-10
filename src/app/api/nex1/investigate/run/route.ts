// POST /api/nex1/investigate/run
//
// NEX1 · Fix 17 · Reporting consumer for Q8 investigation output.
// Founder-authorized 2026-09-17 · scope α (reporting) + γ-2 (persistence).
//
// Invokes the existing runNativeInvestigation() pipeline · returns the real
// InvestigationEvidencePacket · optionally persists Q8 conclusions to
// data/nex1-investigation-conclusions/entries.jsonl.
//
// SAFETY BOUNDARY (per Fix 17 authorization · Q8 policy V1 §2.20):
//   Q8 SELECT authority only. This endpoint MUST NOT:
//     · modify any source file
//     · execute any process (no spawn / exec / child_process)
//     · call broker / WO-04 / Ed25519 / G15 / trust-anchor
//     · verify anything (evidence_kind stays INFERRED)
//     · deploy anything
//     · use external LLM
//     · trigger re-investigation (β NOT authorized)
//     · alter Fix 15/16 output
//
// Response returns the InvestigationEvidencePacket verbatim so the caller
// sees the actual Q8 result including honest-uncertainty states
// (TIE / NO_SELECTION / INSUFFICIENT_EVIDENCE / UNRESOLVED /
//  REQUIRE_MORE_INVESTIGATION). No SelectionState is translated into a
// stronger conclusion (§5 of authorization).

import { NextResponse, type NextRequest } from "next/server";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import { appendInvestigationConclusions } from "@/lib/nex-agent/code-engine/investigation-conclusion-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pipeline may traverse many files · allow reasonable maxDuration.
export const maxDuration = 300;

interface RequestBody {
  problem_statement?: string;
  repo_root?: string;
  mission_id?: string | null;
  max_actions?: number;
  skip_observer_walk?: boolean;
  max_candidates_per_tag?: number;
  /** Default true · set false to skip persistence for a probe-only run. */
  persist?: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    // empty body
  }

  const problem = String(body.problem_statement ?? "").trim();
  if (problem.length === 0) {
    return NextResponse.json(
      { ok: false, error: "problem_statement required" },
      { status: 400 },
    );
  }
  if (problem.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "problem_statement exceeds 4000 chars" },
      { status: 400 },
    );
  }

  // Invoke the REAL runNativeInvestigation() pipeline · zero duplication of
  // any Fix 12/13/14/15/16 capability. This closes the Fix 16 audit's
  // D · TEST/PROOF GAP by executing the full pipeline end-to-end.
  let packet;
  try {
    packet = await runNativeInvestigation({
      problem_statement: problem,
      repo_root: body.repo_root,
      mission_id: body.mission_id ?? null,
      max_actions: body.max_actions,
      skip_observer_walk: body.skip_observer_walk,
      max_candidates_per_tag: body.max_candidates_per_tag,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "investigation_failed",
        detail: (e as Error).message,
        // Deliberately: no fabricated result · no default Q8 state · §14
      },
      { status: 500 },
    );
  }

  // Optionally persist Q8 selections to parallel JSONL. Default: true.
  // Persistence failure is reported HONESTLY (§9) · never converted to
  // silent success · never triggers execution / modification / authority.
  const shouldPersist = body.persist !== false;
  let persistence: {
    ok: boolean;
    path: string;
    appended_entry_ids: readonly string[];
    errors: readonly string[];
    skipped: boolean;
  } = {
    ok: true,
    path: "",
    appended_entry_ids: [],
    errors: [],
    skipped: true,
  };

  if (shouldPersist && packet.candidate_selection.length > 0) {
    const result = appendInvestigationConclusions({
      selections: packet.candidate_selection,
      repo_root: body.repo_root,
    });
    persistence = {
      ok: result.ok,
      path: result.path,
      appended_entry_ids: result.appended_entry_ids,
      errors: result.errors,
      skipped: false,
    };
  }

  // Read-only response · return the packet verbatim (no field renamed ·
  // no SelectionState translated · no confidence recomputed). Preserves
  // provenance chain end-to-end.
  return NextResponse.json(
    {
      ok: true,
      packet,
      persistence,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
