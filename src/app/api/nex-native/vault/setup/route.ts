// POST /api/nex-native/vault/setup
//
// Vault Phase A · Commit A.3 · vault setup route.
//
// The authenticated client has already generated VMK, chosen a mode
// (pin|passphrase), derived a KEK from PIN/passphrase + salt, wrapped
// VMK under that KEK, and now sends ONLY opaque ciphertext + non-
// secret parameters to the server. The server stores nex_vault_setup
// + the first nex_vault_key_envelope atomically.
//
// INVIOLABLE SECURITY RULE
// -----------------------
// This route accepts:
//   · pin_mode  (string literal)
//   · pin_salt  (hex bytes · non-secret)
//   · pin_argon_params (JSON · non-secret)
//   · prf_salt  (16 bytes · non-secret)
//   · device_id (string · from caller's own device-key record)
//   · wrapped_vmk (hex bytes · OPAQUE CIPHERTEXT)
//   · nonce (hex bytes · 12 bytes GCM IV)
//
// This route NEVER accepts and NEVER produces:
//   · plaintext PIN · plaintext passphrase · plaintext VMK · KEK ·
//     PRF output · device private key.
//
// On successful insert the server marks the current session unlocked
// (step-up-service · markVaultUnlocked) so the client does not need
// a second round-trip. Logs 'vault_unlock' event (success=true,
// subtype context='setup' via the user-agent trail is implicit).
//
// Zero commercial code · no bisnis / tier / plan / subscription /
// entitlement / quota / allowance references.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  currentSessionKey,
  readClientIp,
  readUserAgent,
} from "@/lib/nex-native/app/security-request";
import { logSignInEvent } from "@/lib/nex-native/security-service";
import {
  isVaultConfigured,
  lookupNexSessionId,
} from "@/lib/nex-native/vault/vault-status-service";
import {
  createEnvelope,
  createVaultSetup,
  type VaultPinMode,
} from "@/lib/nex-native/vault/envelope-service";
import { markVaultUnlocked } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SetupRequestBody {
  pin_mode?: unknown;
  pin_salt_hex?: unknown;
  pin_argon_params?: unknown;
  prf_salt_hex?: unknown;
  device_id?: unknown;
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: SetupRequestBody;
  try {
    body = (await req.json()) as SetupRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Validate shape · reject anything that would violate migration 142
  // CHECK constraints before touching the DB.
  const mode = typeof body.pin_mode === "string" ? body.pin_mode : "";
  if (mode !== "pin" && mode !== "passphrase") {
    return NextResponse.json(
      { ok: false, error: "invalid_pin_mode" },
      { status: 400 },
    );
  }
  const pinMode = mode as VaultPinMode;

  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_device_id" },
      { status: 400 },
    );
  }

  let pinSalt: Uint8Array;
  let prfSalt: Uint8Array;
  let wrappedVmk: Uint8Array;
  let nonce: Uint8Array;
  try {
    pinSalt = hexToBytes(
      typeof body.pin_salt_hex === "string" ? body.pin_salt_hex : "",
    );
    prfSalt = hexToBytes(
      typeof body.prf_salt_hex === "string" ? body.prf_salt_hex : "",
    );
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
  if (pinSalt.length < 16 || pinSalt.length > 64) {
    return NextResponse.json(
      { ok: false, error: "invalid_pin_salt_length" },
      { status: 400 },
    );
  }
  if (prfSalt.length !== 16) {
    return NextResponse.json(
      { ok: false, error: "invalid_prf_salt_length" },
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

  // Owner-scope: verify the device_id belongs to this account. The
  // nex_account_device_key table is populated when the browser first
  // calls ensureDeviceKey() · the row must exist and must not be revoked.
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

  // One-shot setup · reject if already configured. Future PIN changes
  // land with Phase A.5 as a separate route · setup is not idempotent.
  if (await isVaultConfigured(session.account.id)) {
    return NextResponse.json(
      { ok: false, error: "already_configured" },
      { status: 409 },
    );
  }

  // Create setup row + first PIN envelope atomically. If envelope
  // insert fails after setup inserts, the next call will see
  // isVaultConfigured=true and refuse · the client would then need
  // to go through PIN-change (Phase A.5) to recover. For A.3 we treat
  // this as a hard-fail; the UI tells the user to retry setup after
  // an operator cleanup. The failure window is tiny.
  try {
    await createVaultSetup({
      accountId: session.account.id,
      pinMode,
      pinSalt,
      pinArgonParams: argonParams as Record<string, unknown>,
      prfSalt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "setup_insert_failed", detail: msg },
      { status: 500 },
    );
  }

  try {
    await createEnvelope({
      accountId: session.account.id,
      kind: "pin",
      targetDeviceId: deviceId,
      wrappedVmk,
      nonce,
      generation: 1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "envelope_insert_failed", detail: msg },
      { status: 500 },
    );
  }

  // Mark the current session unlocked so the client has an immediately
  // valid vault_unlock timestamp without a second round-trip.
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

  // Audit · 'vault_unlock' success event. We reuse the existing event
  // type (migration 141 adds 'vault_unlock' + 'vault_unlock_failed'
  // etc. to the CHECK). Setup is semantically a first unlock.
  await logSignInEvent({
    account_id: session.account.id,
    event_type: "vault_unlock",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
