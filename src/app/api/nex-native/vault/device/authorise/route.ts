// POST /api/nex-native/vault/device/authorise
//
// Vault Phase A · Commit A.4 · authorise another device for Vault.
//
// The CURRENT device (Device A) has unlocked Vault, derived a shared
// secret with the target device's X25519 public key via nacl.box.before,
// AES-GCM-encrypted VMK under that shared secret, and prepended its
// own public key to the ciphertext. This route stores that opaque
// envelope targeting Device B.
//
// Server never sees: VMK plaintext · shared secret · either device's
// private key.
//
// Request:  { target_device_id, wrapped_vmk_hex, nonce_hex }
// Response: { ok: true, envelope_id } on success · { ok: false, error }
//
// Preconditions enforced:
//   · authenticated NEX session
//   · session not revoked (session resolver's check)
//   · target_device_id belongs to this account
//   · target_device is NOT revoked
//   · target_device is NOT the current session's device (would be no-op)
//   · Vault is currently unlocked for this session (fresh vault_unlock)
//   · fresh WebAuthn OR fresh password step-up (design §H)
//   · no active (unconsumed, unexpired) device envelope for target
//     (partial unique index enforces, but we return a nicer 409)
//   · wrapped_vmk and nonce lengths within migration 142 CHECKs
//
// 24-hour envelope expiry per sealed design §B.1 default.
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
  requireStepUp,
  FRESH_VAULT_UNLOCK_SECONDS,
} from "@/lib/nex-native/vault/step-up-service";
import {
  createEnvelope,
  getActiveDeviceEnvelope,
} from "@/lib/nex-native/vault/envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  target_device_id?: unknown;
  wrapped_vmk_hex?: unknown;
  nonce_hex?: unknown;
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

const DEVICE_ENVELOPE_TTL_HOURS = 24;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  // Resolve the current session's row (needed for step-up check).
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
    return NextResponse.json(
      { ok: false, error: "session_touch_not_yet_landed" },
      { status: 409 },
    );
  }

  // Step-up: Vault unlocked AND (fresh WebAuthn OR fresh password).
  // The matrix (design §H "Authorize NEW trusted device") requires
  // fresh WebAuthn; we accept fresh password as the sealed OR-fallback.
  const unlockVerdict = await requireStepUp(nexSessionId, {
    vault_unlock: "fresh",
  });
  if (!unlockVerdict.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "step_up_required",
        required: ["vault_unlock"],
        freshness_seconds: FRESH_VAULT_UNLOCK_SECONDS,
      },
      { status: 403 },
    );
  }
  const [webauthnVerdict, passwordVerdict] = await Promise.all([
    requireStepUp(nexSessionId, { webauthn: "fresh" }),
    requireStepUp(nexSessionId, { password: "fresh" }),
  ]);
  if (!webauthnVerdict.ok && !passwordVerdict.ok) {
    await logSignInEvent({
      account_id: session.account.id,
      event_type: "step_up_required_blocked",
      success: false,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "step_up_required",
        required: ["webauthn_or_password"],
      },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const targetDeviceId =
    typeof body.target_device_id === "string" ? body.target_device_id : "";
  if (targetDeviceId.length < 8 || targetDeviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_target_device_id" },
      { status: 400 },
    );
  }

  let wrappedVmk: Uint8Array;
  let nonce: Uint8Array;
  try {
    wrappedVmk = hexToBytes(
      typeof body.wrapped_vmk_hex === "string" ? body.wrapped_vmk_hex : "",
    );
    nonce = hexToBytes(typeof body.nonce_hex === "string" ? body.nonce_hex : "");
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_hex_input" },
      { status: 400 },
    );
  }
  if (wrappedVmk.length < 32 || wrappedVmk.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_wrapped_vmk_length" },
      { status: 400 },
    );
  }
  if (nonce.length < 12 || nonce.length > 24) {
    return NextResponse.json(
      { ok: false, error: "invalid_nonce_length" },
      { status: 400 },
    );
  }

  // Owner-scope: target_device belongs to this account.
  const { data: targetDevice, error: deviceErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, revoked_at")
    .eq("account_id", session.account.id)
    .eq("device_id", targetDeviceId)
    .maybeSingle();
  if (deviceErr) {
    return NextResponse.json(
      { ok: false, error: "device_lookup_failed" },
      { status: 500 },
    );
  }
  if (!targetDevice) {
    return NextResponse.json(
      { ok: false, error: "target_device_not_registered" },
      { status: 400 },
    );
  }
  if (targetDevice.revoked_at !== null) {
    return NextResponse.json(
      { ok: false, error: "target_device_revoked" },
      { status: 403 },
    );
  }

  // Reject active pending envelope for same target (nicer than DB 23505).
  const existing = await getActiveDeviceEnvelope({
    accountId: session.account.id,
    targetDeviceId,
  });
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error: "device_envelope_pending",
        detail:
          "An authorisation is already pending for this device. Have " +
          "the other device consume it or wait for it to expire.",
      },
      { status: 409 },
    );
  }

  // Create the envelope.
  const expiresAt = new Date(Date.now() + DEVICE_ENVELOPE_TTL_HOURS * 3600 * 1000);
  const envelope = await createEnvelope({
    accountId: session.account.id,
    kind: "device",
    targetDeviceId,
    wrappedVmk,
    nonce,
    generation: 1,
    expiresAt,
  });

  await logSignInEvent({
    account_id: session.account.id,
    event_type: "device_authorized",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  return NextResponse.json({
    ok: true,
    envelope_id: envelope.id,
    expires_at: envelope.expires_at,
  });
}
