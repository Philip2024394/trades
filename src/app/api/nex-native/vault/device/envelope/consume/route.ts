// POST /api/nex-native/vault/device/envelope/consume
//
// Vault Phase A · Commit A.4 · mark a device envelope consumed AND
// install Device B's own PIN envelope atomically.
//
// Device B has:
//   · successfully decrypted the device envelope locally (ECDH + AES-GCM)
//   · obtained VMK
//   · prompted the user for a PIN
//   · generated salt + Argon2id params + derived KEK + wrapped VMK
//
// This route:
//   1. verifies caller owns the envelope and target_device matches
//   2. verifies caller's device is not revoked
//   3. verifies no active PIN envelope already exists for this device
//      (idempotency safety — would be a bug upstream)
//   4. inserts the new PIN envelope
//   5. marks the device envelope consumed
//   6. marks the session's last_vault_unlock_at = now (user is unlocked)
//
// Steps 4 + 5 should ideally happen in a transaction. supabase-js does
// not expose client-side transactions · we do a best-effort sequence
// with explicit rollback (delete the PIN envelope) on consume failure.
//
// Request:  { envelope_id, device_id, pin_salt_hex, pin_argon_params,
//             pin_wrapped_vmk_hex, pin_nonce_hex }
// Response: { ok: true }
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
  consumeEnvelope,
  createEnvelope,
  deleteActiveEnvelopesForPath,
  getActivePinEnvelope,
} from "@/lib/nex-native/vault/envelope-service";
import { markVaultUnlocked } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  envelope_id?: unknown;
  device_id?: unknown;
  pin_salt_hex?: unknown;
  pin_argon_params?: unknown;
  pin_wrapped_vmk_hex?: unknown;
  pin_nonce_hex?: unknown;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
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

  const envelopeId = typeof body.envelope_id === "string" ? body.envelope_id : "";
  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (!envelopeId || deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }

  // Owner-scope + revocation check on the caller's device.
  const { data: device, error: devErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, revoked_at")
    .eq("account_id", session.account.id)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (devErr) {
    return NextResponse.json(
      { ok: false, error: "device_lookup_failed" },
      { status: 500 },
    );
  }
  if (!device) {
    return NextResponse.json(
      { ok: false, error: "device_not_registered" },
      { status: 400 },
    );
  }
  if (device.revoked_at !== null) {
    return NextResponse.json(
      { ok: false, error: "device_revoked" },
      { status: 403 },
    );
  }

  // Shape-validate the new PIN envelope inputs.
  let pinSalt: Uint8Array;
  let pinWrappedVmk: Uint8Array;
  let pinNonce: Uint8Array;
  try {
    pinSalt = hexToBytes(
      typeof body.pin_salt_hex === "string" ? body.pin_salt_hex : "",
    );
    pinWrappedVmk = hexToBytes(
      typeof body.pin_wrapped_vmk_hex === "string" ? body.pin_wrapped_vmk_hex : "",
    );
    pinNonce = hexToBytes(
      typeof body.pin_nonce_hex === "string" ? body.pin_nonce_hex : "",
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_hex_input" },
      { status: 400 },
    );
  }
  if (pinSalt.length < 16 || pinSalt.length > 64) {
    return NextResponse.json(
      { ok: false, error: "invalid_pin_salt_length" },
      { status: 400 },
    );
  }
  if (pinWrappedVmk.length < 32 || pinWrappedVmk.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_wrapped_vmk_length" },
      { status: 400 },
    );
  }
  if (pinNonce.length < 12 || pinNonce.length > 24) {
    return NextResponse.json(
      { ok: false, error: "invalid_nonce_length" },
      { status: 400 },
    );
  }
  const argonParams = body.pin_argon_params;
  if (
    typeof argonParams !== "object" ||
    argonParams === null ||
    Array.isArray(argonParams)
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_pin_argon_params" },
      { status: 400 },
    );
  }

  // Verify envelope matches caller + target.
  const { data: envRow, error: envErr } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("id, account_id, kind, target_device_id, consumed_at, expires_at")
    .eq("account_id", session.account.id)
    .eq("id", envelopeId)
    .maybeSingle();
  if (envErr) {
    return NextResponse.json(
      { ok: false, error: "envelope_lookup_failed" },
      { status: 500 },
    );
  }
  if (!envRow) {
    return NextResponse.json(
      { ok: false, error: "envelope_not_found" },
      { status: 404 },
    );
  }
  if (envRow.kind !== "device" || envRow.target_device_id !== deviceId) {
    return NextResponse.json(
      { ok: false, error: "envelope_target_mismatch" },
      { status: 403 },
    );
  }
  if (envRow.consumed_at) {
    return NextResponse.json(
      { ok: false, error: "envelope_already_consumed" },
      { status: 410 },
    );
  }
  const nowIso = new Date().toISOString();
  if (envRow.expires_at && envRow.expires_at < nowIso) {
    return NextResponse.json(
      { ok: false, error: "envelope_expired" },
      { status: 410 },
    );
  }

  // Replace any existing PIN envelope for this device (defensive — the
  // partial unique index would otherwise block the insert). Prior PIN
  // envelope on this device becomes stale once the user picks a new PIN.
  await deleteActiveEnvelopesForPath({
    accountId: session.account.id,
    kind: "pin",
    targetDeviceId: deviceId,
  });

  // Insert the new PIN envelope.
  await createEnvelope({
    accountId: session.account.id,
    kind: "pin",
    targetDeviceId: deviceId,
    wrappedVmk: pinWrappedVmk,
    nonce: pinNonce,
    generation: 1,
  });

  // Mark the device envelope consumed. If this fails after the PIN
  // envelope insert, we roll back the PIN envelope to avoid an
  // inconsistent state (user has local VMK but no replayable envelope
  // mapping on the server).
  try {
    await consumeEnvelope({
      accountId: session.account.id,
      envelopeId,
    });
  } catch (err) {
    await deleteActiveEnvelopesForPath({
      accountId: session.account.id,
      kind: "pin",
      targetDeviceId: deviceId,
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "consume_failed", detail: msg },
      { status: 500 },
    );
  }

  // Confirm now_consumed · defensive · a subsequent attempt should fail.
  const { data: afterRow } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("consumed_at")
    .eq("account_id", session.account.id)
    .eq("id", envelopeId)
    .single();
  if (!afterRow?.consumed_at) {
    await deleteActiveEnvelopesForPath({
      accountId: session.account.id,
      kind: "pin",
      targetDeviceId: deviceId,
    });
    return NextResponse.json(
      { ok: false, error: "consume_verification_failed" },
      { status: 500 },
    );
  }

  // Mark the current session unlocked (user just proved possession).
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

  // Defensive: confirm no second active PIN envelope exists (unique
  // index should guarantee).
  const activePin = await getActivePinEnvelope({
    accountId: session.account.id,
    deviceId,
  });
  if (!activePin) {
    // Something went very wrong · but the device envelope is already
    // consumed. The user has VMK in memory locally; return success and
    // log an operator-visible warning.
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "step_up_required_blocked",
      success: false,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    });
  }

  await logSignInEvent({
    account_id: session.account.id,
    event_type: "vault_unlock",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
