// POST /api/nex-native/security/sessions/revoke
//
// Phase 1.0 Security · owner revokes ONE specific nex_session row
// (not the global "sign out all other sessions" · see /revoke-all).
//
// Request body: { session_id: string }
// Response: { ok: true } on success · { ok: false, error } otherwise.
//
// Authorization: the session resolver establishes the owner identity ·
// the service layer enforces that the session_id belongs to this
// account before touching the row (owner-scoped UPDATE in SQL).

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { revokeSessionForOwner, logSignInEvent } from "@/lib/nex-native/security-service";
import { readClientIp, readUserAgent } from "@/lib/nex-native/app/security-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: { session_id?: string };
  try {
    body = (await req.json()) as { session_id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "missing_session_id" },
      { status: 400 },
    );
  }
  try {
    const revoked = await revokeSessionForOwner(sessionId, session.account.id);
    if (!revoked) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    // Audit · successful remote sign-out.
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "remote_sign_out",
      success: true,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    }).catch(() => {
      /* audit failure must not fail the user-visible action */
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
