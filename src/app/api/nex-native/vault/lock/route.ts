// POST /api/nex-native/vault/lock
//
// Vault Phase A · Commit A.3 · explicit lock.
//
// Clears last_vault_unlock_at for the current session only · does NOT
// sign the user out of NEX. Returns 200 even if nothing was unlocked
// (idempotent). The browser side is expected to zeroise its in-memory
// VMK/K_f/KEK references at the moment it fires this POST (fire-
// and-forget hygiene; the server-side clear is the authoritative
// boundary).
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { clearVaultUnlockForSession } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  // Idempotent: when nexSessionId is null the session touch hasn't
  // landed yet (very early request) · nothing to clear.
  if (nexSessionId) {
    await clearVaultUnlockForSession({
      sessionId: nexSessionId,
      accountId: session.account.id,
    });
  }

  // Lock is a user-initiated UI action · not a security event. The
  // sealed nex_sign_in_event.event_type CHECK (migration 141) does not
  // include 'vault_lock'; adding one would require a new migration.
  // No audit row written.

  return NextResponse.json({ ok: true });
}
