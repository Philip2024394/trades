// POST /api/nex/refacing/cases/[rf_id]/confirm-base
//
// SEE UI · Step 1 · SHOW → BASE_CONFIRMED transition.
//
// Called when the customer taps "Looks right" on the Photo Understanding panel
// OR completes the correction UI. Advances Case status from BASE_UPLOADED to
// BASE_CONFIRMED. May also carry optional customer-asserted corrections to
// existing_staircase.visible_components[] / visible_geometry.
//
// Body (all optional):
//   {
//     "visible_components_override": [ { component_role, count, notes } ],
//     "visible_geometry_override":   { configuration, flights, overall_shape },
//   }
//
// If neither override is present, this is a pure "Looks right" confirmation.
//
// PR-16 · when an override is written, customer_asserted marker set so the
// Case truthfulness contract remains intact.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCaseWithToken, updateCase, CaseNotFoundError, CaseValidationError } from "@/lib/nex/refacing/case-store";
import type { VisibleComponent, ExistingStaircase } from "@/lib/nex/refacing/case-schema";
import type { Geometry } from "@/lib/nex/refacing/image-schema";
import { extractToken, parseJsonBody } from "@/lib/nex/refacing/_route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  visible_components_override?: VisibleComponent[];
  visible_geometry_override?: Geometry;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string }> }
) {
  const { rf_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 401 });
  }

  // Body may be absent (pure "Looks right" confirm) OR present with overrides.
  let body: Body = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().startsWith("application/json")) {
    const parsed = await parseJsonBody<Body>(req);
    if (!parsed.ok) return parsed.response;
    body = parsed.body ?? {};
  }

  try {
    const current = await readCaseWithToken(rf_id, token);

    if (current.status !== "BASE_UPLOADED") {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_status_transition",
          detail: `Case must be BASE_UPLOADED to confirm-base · current status is ${current.status}`,
        },
        { status: 409 }
      );
    }

    const updated = await updateCase(
      rf_id,
      (c) => {
        const nextExisting: ExistingStaircase = {
          ...c.existing_staircase,
          customer_confirmed: true,
        };
        if (body.visible_components_override) {
          nextExisting.visible_components = body.visible_components_override;
        }
        if (body.visible_geometry_override) {
          nextExisting.visible_geometry = body.visible_geometry_override;
        }
        return {
          ...c,
          existing_staircase: nextExisting,
        };
      },
      "BASE_CONFIRMED"
    );

    return NextResponse.json({ ok: true, case: updated });
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
