// POST /api/nex-native/security/credentials/revoke
//
// Phase 1.0 Security · owner revokes one face sign-in credential.
// Deletes the row from `nex_webauthn_credential`. If this was the
// account's last credential, the next sign-in requires email+password
// (the account itself is never destroyed by this action).
//
// Request body: { credential_id: string }
// Response: { ok: true } on success.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { revokeCredentialForOwner } from "@/lib/nex-native/webauthn-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: { credential_id?: string };
  try {
    body = (await req.json()) as { credential_id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const credentialId =
    typeof body.credential_id === "string" ? body.credential_id.trim() : "";
  if (!credentialId) {
    return NextResponse.json(
      { ok: false, error: "missing_credential_id" },
      { status: 400 },
    );
  }
  try {
    const revoked = await revokeCredentialForOwner(credentialId, session.account.id);
    if (!revoked) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
