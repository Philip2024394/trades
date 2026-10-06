// POST /api/nex-native/vault/unlock-attempt
//
// Vault Phase A · Commit A.3 · record an unlock attempt (success or
// failure) and, on success, mark the session unlocked server-side.
//
// Honest security semantics (per founder sealed 2026-10-06):
//
// The server CANNOT prove the client successfully unwrapped VMK merely
// from an HTTP 200 · the actual cryptographic verification happens
// client-side when AES-GCM-decrypt either succeeds (tag verifies) or
// throws (tag mismatch = wrong PIN). This route therefore records
// what the authenticated client CLAIMS, and the trust comes from:
//
//   · the session is authenticated (JWT-verified, non-revoked)
//   · the device_id is owned and non-revoked
//   · the rate-limit tracks the claim · a dishonest client that
//     claims success without unwrapping still incurs no benefit
//     (it has no VMK · cannot wrap future K_f · cannot read Vault)
//   · a dishonest client that claims failure incurs a legitimate
//     rate-limit cost on itself
//
// On success:
//   · markVaultUnlocked writes last_vault_unlock_at
//   · nex_vault_pin_attempt row with success=true
//   · nex_sign_in_event 'vault_unlock' (success=true)
//
// On failure:
//   · nex_vault_pin_attempt row with success=false
//   · nex_sign_in_event 'vault_unlock_failed' (success=false)
//   · returns refreshed rate-limit verdict so the UI can display
//     the correct "wrong PIN" or "too many attempts" message
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  currentSessionKey,
  readClientIp,
  readUserAgent,
} from "@/lib/nex-native/app/security-request";
import { logSignInEvent } from "@/lib/nex-native/security-service";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import {
  checkPinRateLimit,
  recordPinAttempt,
} from "@/lib/nex-native/vault/pin-rate-limit";
import { markVaultUnlocked } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UnlockAttemptBody {
  device_id?: unknown;
  success?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: UnlockAttemptBody;
  try {
    body = (await req.json()) as UnlockAttemptBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  const success = body.success === true;
  if (deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_device_id" },
      { status: 400 },
    );
  }
  if (typeof body.success !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "missing_success_flag" },
      { status: 400 },
    );
  }

  // Owner-scope: device must belong to this account and be live.
  const { data: deviceRow, error: deviceErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, revoked_at")
    .eq("account_id", session.account.id)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (deviceErr) {
    return NextResponse.json(
      { ok: false, error: "device_lookup_failed" },
      { status: 500 },
    );
  }
  if (!deviceRow) {
    return NextResponse.json(
      { ok: false, error: "device_not_registered" },
      { status: 400 },
    );
  }
  if (deviceRow.revoked_at !== null) {
    return NextResponse.json(
      { ok: false, error: "device_revoked" },
      { status: 403 },
    );
  }

  // Record the claim · ALWAYS, before any other side effect.
  await recordPinAttempt({
    accountId: session.account.id,
    deviceId,
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

  // Failure path · log the event + return refreshed rate-limit verdict.
  await logSignInEvent({
    account_id: session.account.id,
    event_type: "vault_unlock_failed",
    success: false,
    ip_address: ip,
    user_agent: ua,
  });
  const rate = await checkPinRateLimit({
    accountId: session.account.id,
    deviceId,
  });
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
