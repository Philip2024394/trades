// POST /api/nex/refacing/cases
//
// Create a new anonymous DRAFT Refacing Case. This is the V1 remediation
// endpoint — replaces the sr_ ID model at Stage 1 · C2/C5 LOCKED with a
// canonical rf_ Refacing Case identity.
//
// Rules:
//   · No name/phone/email required at this point (per Stage 1 · C4 LOCKED ·
//     no forced registration at entry).
//   · Returns { refacing_case_id, anonymous_return_token }. Client stores
//     both (cookie / localStorage / magic-link) for resume-access.
//   · PR-16 / PR-13 / PR-18 enforced at the case-store level · validation
//     failures return 422 with the specific rule cited.

import { NextResponse } from "next/server";
import { createDraftCase, CaseValidationError } from "@/lib/nex/refacing/case-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { refacing_case_id, anonymous_return_token } = await createDraftCase();
    return NextResponse.json(
      {
        ok: true,
        refacing_case_id,
        anonymous_return_token,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof CaseValidationError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.reason,
          detail: err.detail,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "case_create_failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
