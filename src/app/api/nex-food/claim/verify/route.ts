// POST /api/nex-food/claim/verify
// Body: { ref: "#FL-YYYY-XXXXX", code: "123456" }
// Response 200: { ok: true, businessName, publicListingRef, promotedFields }
// Response 400/404/410: { ok: false, error }
//
// Delegates to shared claim-service (used by both admin CLI and self-service
// register/claim flows). On success: consumes the code, flips claim_status
// to 'claimed' + owner_status to 'verified', AND promotes any owner-supplied
// fields captured at code-request time to owner_verified provenance.

import { NextResponse } from "next/server";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { slugToRef } from "@/lib/nex-food/claim-codes";
import { verifyClaimCode } from "@/lib/nex-food/claim-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { ref?: string; code?: string } | null;
  if (!body) return bad(400, "Malformed JSON body");
  const rawRef = body.ref?.trim();
  const code = body.code?.trim();
  if (!rawRef || !code) return bad(400, "ref and code required");

  const ref = rawRef.startsWith("#FL-") ? rawRef : slugToRef(rawRef);
  if (!/^#FL-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/.test(ref)) return bad(400, "invalid ref format");

  const pool = getFoodDbPool();
  try {
    const result = await verifyClaimCode({ pool, businessRef: ref, code });
    return NextResponse.json({
      ok: true,
      businessName: result.businessName,
      publicListingRef: result.publicListingRef,
      promotedFields: result.promotedFields,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/expired/i.test(message)) return bad(410, message);
    if (/Too many attempts/i.test(message)) return bad(410, message);
    if (/No active claim code/i.test(message)) return bad(404, message);
    if (/invalid code format|Code incorrect|invalid ref/i.test(message)) return bad(400, message);
    console.error("[/api/nex-food/claim/verify] internal error:", err);
    return bad(500, "internal error");
  }
}
