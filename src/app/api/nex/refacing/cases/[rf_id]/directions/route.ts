// GET /api/nex/refacing/cases/[rf_id]/directions
//
// SEE UI · Step 3 · Retrieve design directions for the SEE stage.
//
// Reads the Case, builds a SeeQuery from customer_intent (via feeling-map),
// calls retrieveSeeDirections against the images_v3[] library, returns
// 2-4 SeeDirection records.
//
// Case status side-effect: BASE_CONFIRMED or INTENT_DEFINED → CONCEPT_READY
// (once the customer has actually seen the directions, the Case is at a
// state where a professional could be shown "customer has been offered
// directions").
//
// PR-18 guarantee: every returned direction carries reference_image_ids[]
// tracing to real images_v3[] entries. Empty results = honest empty state
// (customer will see "we don't have that direction available yet" copy).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCaseWithToken, updateCase, CaseNotFoundError, CaseValidationError } from "@/lib/nex/refacing/case-store";
import { loadImagesV3 } from "@/lib/nex/refacing/manifest";
import { retrieveSeeDirections, type SeeQuery, type SeeDirection } from "@/lib/nex/refacing/retrieval";
import { mapFeelingsToStyles, mapFeelingsToMoods, inferMaterialFamilyHint, componentRoleFromItem } from "@/lib/nex/refacing/feeling-map";
import type { ComponentRole } from "@/lib/nex/refacing/image-schema";
import { extractToken } from "@/lib/nex/refacing/_route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string }> }
) {
  const { rf_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 401 });
  }

  try {
    const current = await readCaseWithToken(rf_id, token);
    if (current.status !== "INTENT_DEFINED" && current.status !== "CONCEPT_READY") {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_status_transition",
          detail: `Case must have completed FEEL (INTENT_DEFINED) · current status is ${current.status}`,
        },
        { status: 409 }
      );
    }

    // Build the query from customer intent.
    const query: SeeQuery = {
      feelings: current.customer_intent.feelings,
      style_preferences: mapFeelingsToStyles(current.customer_intent.feelings),
      mood_preferences: mapFeelingsToMoods(current.customer_intent.feelings),
      must_not_change_component_roles: current.customer_intent.intent_entries
        .filter((e) => e.treatment === "MUST_NOT_CHANGE")
        .map((e) => componentRoleFromItem(e.item))
        .filter((r): r is ComponentRole => r !== null),
      material_family_hint: inferMaterialFamilyHint(current.customer_intent.feelings),
    };

    const library = await loadImagesV3();
    const directions: SeeDirection[] = retrieveSeeDirections(library, query);

    // Advance status to CONCEPT_READY on first fetch. Subsequent fetches
    // (customer re-opens SEE) are idempotent · no re-write if already CONCEPT_READY.
    if (current.status === "INTENT_DEFINED") {
      await updateCase(rf_id, (c) => c, "CONCEPT_READY");
    }

    return NextResponse.json({
      ok: true,
      directions,
      // Empty directions is a legitimate "we don't have that direction
      // available yet" state · UI handles it per SEE-UI-SPEC.md §H.2.a.
      empty: directions.length === 0,
    });
  } catch (err) {
    if (err instanceof CaseNotFoundError) {
      return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
    }
    if (err instanceof CaseValidationError) {
      return NextResponse.json(
        { ok: false, error: err.reason, detail: err.detail },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
