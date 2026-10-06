// POST /api/nex-native/vault/unlock-materials
//
// Vault Phase A · Commit A.3 · fetch opaque unlock materials.
//
// The authenticated client POSTs { device_id } · the server:
//   1. authenticates the NEX session
//   2. enforces the sealed PIN rate limit (design §H)
//   3. verifies the device_id belongs to this account AND is not revoked
//   4. returns the opaque wrapped envelope + non-secret derivation
//      parameters (salt, Argon2id params, mode) so the client can
//      derive the KEK and attempt unwrap locally.
//
// The server NEVER derives the KEK. The server NEVER unwraps VMK. The
// response contains ONLY ciphertext + non-secret parameters.
//
// Rate-limit short-circuit: when PIN attempts for this (account,
// device) have hit the sealed threshold, this route returns 429
// WITHOUT revealing the envelope. The client cannot attempt even
// offline derivation of the KEK without the salt · 429 denies both
// the salt and the envelope.
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  getActivePinEnvelope,
  getVaultSetupForAccount,
} from "@/lib/nex-native/vault/envelope-service";
import { checkPinRateLimit } from "@/lib/nex-native/vault/pin-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UnlockMaterialsBody {
  device_id?: unknown;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: UnlockMaterialsBody;
  try {
    body = (await req.json()) as UnlockMaterialsBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_device_id" },
      { status: 400 },
    );
  }

  // Owner-scope: device must belong to this account and not be revoked.
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

  // Rate limit · ALWAYS check BEFORE returning any secret material.
  const rate = await checkPinRateLimit({
    accountId: session.account.id,
    deviceId,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        reason: rate.reason,
        retry_after_seconds: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  // Resolve setup + envelope. Both must exist for a configured Vault.
  const setup = await getVaultSetupForAccount(session.account.id);
  if (!setup) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 404 },
    );
  }
  const envelope = await getActivePinEnvelope({
    accountId: session.account.id,
    deviceId,
  });
  if (!envelope) {
    // Setup row exists but no PIN envelope for THIS device · the user
    // set Vault up on a different device and this one has not been
    // authorised yet. Device envelope / cross-device onboarding is
    // Phase A.4.
    return NextResponse.json(
      {
        ok: false,
        error: "device_not_authorised_for_vault",
        detail:
          "This device is not yet authorised for Vault. Device " +
          "onboarding ships with Phase A.4.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: setup.pin_mode,
    pin_salt_hex: bytesToHex(setup.pin_salt),
    pin_argon_params: setup.pin_argon_params,
    wrapped_vmk_hex: bytesToHex(envelope.wrapped_vmk),
    nonce_hex: bytesToHex(envelope.nonce),
    algorithm: envelope.algorithm,
    generation: envelope.generation,
  });
}
