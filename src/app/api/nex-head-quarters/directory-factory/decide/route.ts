// POST /api/nex-head-quarters/directory-factory/decide
//
// Phase 2 · Human decision endpoint for CATEGORY_CANDIDATE.
//
// Body: {
//   candidate_id: string (uuid),
//   decision: "approved" | "rejected" | "duplicate" | "superseded",
//   reviewed_by: string (non-empty),
//   notes?: string,
//   duplicate_of_registry_id?: string,  // required when decision="duplicate"
//   superseded_by_candidate_id?: string, // required when decision="superseded"
// }
//
// Behaviour:
//   · Delegates persistence to decideCategoryCandidate() in db.ts.
//   · Writes ONLY to nex.category_candidate.
//   · Never touches nex.category_registry (Registry activation is Phase 3).
//   · Never writes to any Walker table, any route file, any component.
//
// Boundary tests in src/lib/nex/category-registry.db.test.ts prove:
//   · No SQL in this route or the mutator touches category_registry.
//   · Only one admin_decision transition per row (WHERE guard).
//   · Approving does NOT create a Registry row.

import { NextResponse, type NextRequest } from "next/server";
import {
  decideCategoryCandidate,
  type CandidateDecision,
} from "@/lib/nex/category-registry.db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: Set<CandidateDecision> = new Set([
  "approved",
  "rejected",
  "duplicate",
  "superseded",
]);

type Body = {
  candidate_id?: unknown;
  decision?: unknown;
  reviewed_by?: unknown;
  notes?: unknown;
  duplicate_of_registry_id?: unknown;
  superseded_by_candidate_id?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const candidateId = typeof body.candidate_id === "string" ? body.candidate_id.trim() : "";
  const decision = typeof body.decision === "string" ? (body.decision as CandidateDecision) : ("" as CandidateDecision);
  const reviewedBy = typeof body.reviewed_by === "string" ? body.reviewed_by.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const duplicateOfRegistryId = typeof body.duplicate_of_registry_id === "string" && body.duplicate_of_registry_id.trim().length > 0
    ? body.duplicate_of_registry_id.trim()
    : undefined;
  const supersededByCandidateId = typeof body.superseded_by_candidate_id === "string" && body.superseded_by_candidate_id.trim().length > 0
    ? body.superseded_by_candidate_id.trim()
    : undefined;

  if (!candidateId) {
    return NextResponse.json(
      { ok: false, error: "candidate_id_required" },
      { status: 400 },
    );
  }
  if (!ALLOWED.has(decision)) {
    return NextResponse.json(
      { ok: false, error: "invalid_decision", allowed: [...ALLOWED] },
      { status: 400 },
    );
  }
  if (!reviewedBy) {
    return NextResponse.json(
      { ok: false, error: "reviewed_by_required" },
      { status: 400 },
    );
  }

  const result = await decideCategoryCandidate(candidateId, decision, reviewedBy, {
    notes,
    duplicateOfRegistryId,
    supersededByCandidateId,
  });

  if (!result.ok) {
    const status = result.reason === "candidate-not-found-or-already-decided"
      ? 409
      : result.reason === "no-db"
        ? 503
        : 400;
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status },
    );
  }

  return NextResponse.json(
    { ok: true, candidate: result.candidate },
    { status: 200 },
  );
}
