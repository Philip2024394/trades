// POST /api/nex-native/vault/unlock/recovery/materials
//
// Vault Phase A · Commit A.5 · fetch opaque recovery unlock material.
//
// Returns the opaque recovery envelope + recovery_salt + recovery_argon_
// params so the client can derive KEK and unwrap VMK locally. Enforces
// the sealed recovery rate limit BEFORE returning any material · 429
// responses do NOT leak envelope or salt (same pattern as
// /vault/unlock-materials for PIN).
//
// No request body needed · caller is authenticated via session cookie.
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  getActiveRecoveryEnvelope,
  getVaultSetupForAccount,
} from "@/lib/nex-native/vault/envelope-service";
import { checkRecoveryRateLimit } from "@/lib/nex-native/vault/pin-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Rate-limit check BEFORE revealing any material.
  const rate = await checkRecoveryRateLimit({ accountId: session.account.id });
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

  const setup = await getVaultSetupForAccount(session.account.id);
  if (!setup) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 404 },
    );
  }
  if (!setup.recovery_configured_at || !setup.recovery_salt || !setup.recovery_argon_params) {
    return NextResponse.json(
      { ok: false, error: "recovery_not_configured" },
      { status: 404 },
    );
  }

  const envelope = await getActiveRecoveryEnvelope(session.account.id);
  if (!envelope) {
    return NextResponse.json(
      { ok: false, error: "recovery_envelope_missing" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    recovery_salt_hex: bytesToHex(setup.recovery_salt),
    recovery_argon_params: setup.recovery_argon_params,
    wrapped_vmk_hex: bytesToHex(envelope.wrapped_vmk),
    nonce_hex: bytesToHex(envelope.nonce),
    algorithm: envelope.algorithm,
    generation: envelope.generation,
  });
}
