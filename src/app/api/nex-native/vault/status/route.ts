// GET /api/nex-native/vault/status
//
// Vault Phase A · Commit A.3 · state resolver.
//
// Returns the per-session Vault state so the UI can render the right
// surface (setup wizard · locked PIN screen · unlocked home). Read-
// only · no side effects.
//
// Response:
//   {
//     ok: true,
//     configured: boolean,
//     unlocked: boolean,
//     unlocked_age_seconds: number | null,
//     unlock_window_seconds: number,
//     mode: 'pin' | 'passphrase' | null,
//   }
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import {
  lookupNexSessionId,
  resolveVaultStateForSession,
} from "@/lib/nex-native/vault/vault-status-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  const sessionKey = currentSessionKey(req);
  if (!sessionKey) {
    return NextResponse.json(
      { ok: false, error: "no_session_token" },
      { status: 401 },
    );
  }
  const nexSessionId = await lookupNexSessionId({
    accountId: session.account.id,
    supabaseSessionKey: sessionKey,
  });
  if (!nexSessionId) {
    // The session resolver's write-through touch has not yet landed
    // (first request after sign-in). Treat as "not unlocked" rather
    // than erroring · the UI will prompt a reload or the next request
    // will succeed.
    return NextResponse.json({
      ok: true,
      configured: false,
      unlocked: false,
      unlocked_age_seconds: null,
      unlock_window_seconds: 300,
      mode: null,
    });
  }

  const state = await resolveVaultStateForSession({
    accountId: session.account.id,
    sessionId: nexSessionId,
  });

  return NextResponse.json({
    ok: true,
    configured: state.configured,
    unlocked: state.unlocked,
    unlocked_age_seconds: state.unlockedAgeSeconds,
    unlock_window_seconds: state.unlockWindowSeconds,
    mode: state.mode,
  });
}
