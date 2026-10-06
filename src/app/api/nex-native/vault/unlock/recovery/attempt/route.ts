// POST /api/nex-native/vault/unlock/recovery/attempt
//
// Vault Phase A · Commit A.5 · record a recovery unlock attempt.
//
// Honest security semantics (same as the PIN unlock-attempt route):
// the server cannot verify client-side unwrap succeeded merely from
// an HTTP 200. It records the authenticated client's CLAIM. Trust
// comes from the authenticated session + rate-limit on failure
// claims + the fact that a false-success claim grants no useful VMK
// (the server-side envelope stays unchanged).
//
// On success:
//   · nex_vault_recovery_attempt row with success=true
//   · nex_sign_in_event 'vault_unlock' (success=true · subtype
//     implicit via recovery route)
//   · markVaultUnlocked on current session
//
// On failure:
//   · nex_vault_recovery_attempt row with success=false
//   · nex_sign_in_event 'vault_unlock_failed'
//   · returns refreshed rate-limit verdict
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  currentSessionKey,
  readClientIp,
  readUserAgent,
} from "@/lib/nex-native/app/security-request";
import { logSignInEvent } from "@/lib/nex-native/security-service";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import {
  checkRecoveryRateLimit,
  recordRecoveryAttempt,
} from "@/lib/nex-native/vault/pin-rate-limit";
import { markVaultUnlocked } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  success?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.success !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "missing_success_flag" },
      { status: 400 },
    );
  }
  const success = body.success === true;

  await recordRecoveryAttempt({
    accountId: session.account.id,
    success,
  });

  const ip = readClientIp(req);
  const ua = readUserAgent(req);

  if (success) {
    const sessionKey = currentSessionKey(req);
    if (sessionKey) {
      const nexSessionId = await lookupNexSessionId({
        accountId: session.account.id,
        supabaseSessionKey: sessionKey,
      });
      if (nexSessionId) {
        await markVaultUnlocked({
          sessionId: nexSessionId,
          accountId: session.account.id,
        });
      }
    }
    await logSignInEvent({
      account_id: session.account.id,
      event_type: "vault_unlock",
      success: true,
      ip_address: ip,
      user_agent: ua,
    });
    return NextResponse.json({ ok: true, unlocked: true });
  }

  await logSignInEvent({
    account_id: session.account.id,
    event_type: "vault_unlock_failed",
    success: false,
    ip_address: ip,
    user_agent: ua,
  });
  const rate = await checkRecoveryRateLimit({ accountId: session.account.id });
  return NextResponse.json({
    ok: true,
    unlocked: false,
    rate: {
      allowed: rate.allowed,
      reason: rate.reason,
      retry_after_seconds: rate.retryAfterSeconds,
    },
  });
}
