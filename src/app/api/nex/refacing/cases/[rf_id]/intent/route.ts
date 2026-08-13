// POST /api/nex/refacing/cases/[rf_id]/intent
//
// SEE UI · Step 2 · FEEL → INTENT_DEFINED transition.
//
// Called when the customer completes the FEEL screens. Writes
// customer_intent.feelings + intent_entries. Case advances BASE_CONFIRMED
// → INTENT_DEFINED.
//
// Body:
//   {
//     "feelings": ["more-modern", "more-natural"],
//     "must_not_change_items": ["newel", "handrail"]   // optional · from FEEL B-2
//   }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCaseWithToken, updateCase, CaseNotFoundError, CaseValidationError } from "@/lib/nex/refacing/case-store";
import type { FeelingValue, IntentEntry } from "@/lib/nex/refacing/case-schema";
import { FEELING_VALUES } from "@/lib/nex/refacing/case-schema";
import { extractToken, parseJsonBody } from "@/lib/nex/refacing/_route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  feelings?: string[];
  must_not_change_items?: string[];
};

function isFeelingValue(v: unknown): v is FeelingValue {
  return typeof v === "string" && (FEELING_VALUES as readonly string[]).includes(v);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string }> }
) {
  const { rf_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const rawFeelings = Array.isArray(body.feelings) ? body.feelings : [];
  const feelings = rawFeelings.filter(isFeelingValue);
  if (feelings.length === 0) {
    return NextResponse.json(
      { ok: false, error: "feelings_required", detail: "At least one feeling value required" },
      { status: 400 }
    );
  }

  const rawItems = Array.isArray(body.must_not_change_items) ? body.must_not_change_items : [];
  const items = rawItems
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((s) => s.trim().slice(0, 60));

  try {
    const current = await readCaseWithToken(rf_id, token);
    if (current.status !== "BASE_CONFIRMED" && current.status !== "INTENT_DEFINED") {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_status_transition",
          detail: `Case must be BASE_CONFIRMED (or INTENT_DEFINED for re-submission) · current status is ${current.status}`,
        },
        { status: 409 }
      );
    }

    const intent_entries: IntentEntry[] = items.map((item) => ({
      item,
      treatment: "MUST_NOT_CHANGE",
      customer_confirmed: true,
    }));

    const updated = await updateCase(
      rf_id,
      (c) => ({
        ...c,
        customer_intent: {
          ...c.customer_intent,
          feelings,
          intent_entries,
        },
      }),
      "INTENT_DEFINED"
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
