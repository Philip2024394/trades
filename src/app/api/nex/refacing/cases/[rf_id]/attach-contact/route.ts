// POST /api/nex/refacing/cases/[rf_id]/attach-contact
//
// V2 remediation · Stage 1 · C4 LOCKED.
//
// Contact upsert is DEFERRED · no name/phone/email is required to create a
// Case (see /api/nex/refacing/cases · V1). This endpoint is called later
// when the customer requests a professional assessment (CONNECT stage).
//
// The legacy enquiry endpoint (src/app/api/nex/staircase-renovations/enquiry)
// remains as a compatibility surface for the parked bundle · new code paths
// should call this endpoint instead.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCaseWithToken, updateCase, CaseNotFoundError, CaseValidationError } from "@/lib/nex/refacing/case-store";
import type { CustomerContact } from "@/lib/nex/refacing/case-schema";
import { upsertContact } from "@/lib/nex/contacts/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractToken(req: NextRequest): string | null {
  const q = new URL(req.url).searchParams.get("token");
  if (q) return q;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function trimStr(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = trimStr(body.name, 120);
  const phone = trimStr(body.phone, 40);
  const email = trimStr(body.email, 160).toLowerCase();
  const postcode = trimStr(body.postcode, 16).toUpperCase();
  const contact_preference =
    trimStr(body.contact_preference, 24) as CustomerContact["contact_preference"];

  if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  if (!phone && !email) {
    return NextResponse.json(
      { ok: false, error: "phone_or_email_required" },
      { status: 400 }
    );
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "email_format_invalid" }, { status: 400 });
  }

  try {
    // Verify token first (via read).
    await readCaseWithToken(rf_id, token);

    // Upsert into Master Contact Database · dedup by email/phone per existing pattern.
    let contactRefId: string | null = null;
    try {
      const c = await upsertContact({
        email: email || undefined,
        phone: phone || undefined,
        name,
        lifecycle_stage: "lead",
        kind: "lead",
        tags: ["refacing", `case:${rf_id}`],
        source: "refacing-case-connect",
        source_ref: rf_id,
        attributes: {
          postcode: postcode || null,
        },
      });
      contactRefId = c.contact.contact_id;
    } catch {
      // Contact upsert failure MUST NOT fail the Case attach · the Case
      // record is still authoritative.
      contactRefId = null;
    }

    const attachedAt = new Date().toISOString();
    const contact: CustomerContact = {
      name,
      phone,
      email,
      postcode: postcode || undefined,
      contact_preference: contact_preference || undefined,
      attached_at: attachedAt,
    };

    const updated = await updateCase(
      rf_id,
      (current) => ({
        ...current,
        contact,
      }),
      "READY_FOR_ASSESSMENT"
    );

    return NextResponse.json({
      ok: true,
      case: updated,
      contact_ref_id: contactRefId,
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
