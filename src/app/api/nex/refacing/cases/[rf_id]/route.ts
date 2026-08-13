// GET /api/nex/refacing/cases/[rf_id]
//
// Read a Refacing Case by ID. Requires the anonymous_return_token as a
// query param or Authorization header. Returns 404 if token mismatch to
// avoid leaking Case existence.
//
// Also PATCH /api/nex/refacing/cases/[rf_id] for updating the Case state.
// Both write paths run PR-16 + PR-13 + PR-18 validators.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  readCaseWithToken,
  updateCase,
  CaseNotFoundError,
  CaseValidationError,
} from "@/lib/nex/refacing/case-store";
import type { RefacingCase, CaseStatus } from "@/lib/nex/refacing/case-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractToken(req: NextRequest): string | null {
  const q = new URL(req.url).searchParams.get("token");
  if (q) return q;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string }> }
) {
  const { rf_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "token_required" },
      { status: 401 }
    );
  }
  try {
    const c = await readCaseWithToken(rf_id, token);
    return NextResponse.json({ ok: true, case: c });
  } catch (err) {
    if (err instanceof CaseNotFoundError) {
      return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string }> }
) {
  const { rf_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "token_required" },
      { status: 401 }
    );
  }

  let body: {
    patch?: Partial<RefacingCase>;
    next_status?: CaseStatus;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  try {
    // Verify token first (via read) to avoid leaking existence on unauth writes.
    await readCaseWithToken(rf_id, token);

    const updated = await updateCase(
      rf_id,
      (current) => ({ ...current, ...(body.patch ?? {}) }),
      body.next_status
    );
    return NextResponse.json({ ok: true, case: updated });
  } catch (err) {
    if (err instanceof CaseNotFoundError) {
      return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
    }
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
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
