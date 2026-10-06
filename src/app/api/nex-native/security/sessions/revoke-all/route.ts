// POST /api/nex-native/security/sessions/revoke-all
//
// Phase 1.0 Security · "sign out all other sessions" · bumps
// `nex_account.sessions_invalidated_at` so the session resolver rejects
// every session issued before now, AND marks every nex_session row
// (except the current one) as revoked so the Devices page reflects the
// change immediately.
//
// Request body: {}
// Response: { ok: true, revoked_count: number, invalidated_at: ISO }
//
// Authorization: owner-scoped. The current session is identified by the
// sha256 of the current request's access token (same key the session
// resolver writes). We NEVER revoke the current session · the
// user-visible rule is "keep me signed in, log everyone else out."

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  revokeAllOtherSessionsForOwner,
  logSignInEvent,
} from "@/lib/nex-native/security-service";
import {
  currentSessionKey,
  readClientIp,
  readUserAgent,
} from "@/lib/nex-native/app/security-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  const keepSessionKey = currentSessionKey(req);
  try {
    const result = await revokeAllOtherSessionsForOwner(
      session.account.id,
      keepSessionKey,
    );
    // Audit · log one "remote_sign_out" event for the aggregate action.
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "remote_sign_out",
      success: true,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    }).catch(() => {
      /* audit failure must not fail the user-visible action */
    });
    return NextResponse.json({
      ok: true,
      invalidated_at: result.invalidated_at,
      revoked_count: result.revoked_count,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
