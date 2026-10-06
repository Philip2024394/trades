// POST /api/nex-native/vault/recovery/setup
//
// Vault Phase A · Commit A.5 · recovery passphrase setup.
//
// Client has:
//   · Vault unlocked (VMK in tab memory)
//   · generated recovery_salt + chosen Argon2id params
//   · derived KEK from a user-chosen passphrase · WRAPPED VMK under
//     that KEK · and now sends ONLY the opaque wrapped VMK envelope
//     plus non-secret parameters
//
// The passphrase itself is NEVER transmitted. The server stores:
//   · nex_vault_setup.recovery_salt + recovery_argon_params
//   · nex_vault_setup.recovery_configured_at = now()
//   · a kind='recovery' row in nex_vault_key_envelope
//
// Replaces any existing recovery envelope · one active recovery
// envelope per account (migration 142 partial unique index enforces).
//
// Preconditions:
//   · authenticated NEX session
//   · session not revoked
//   · Vault IS configured
//   · fresh vault_unlock (user demonstrates possession of VMK)
//   · fresh WebAuthn OR fresh password step-up (design §H)
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
  requireStepUp,
} from "@/lib/nex-native/vault/step-up-service";
import {
  createEnvelope,
  deleteActiveEnvelopesForPath,
  getVaultSetupForAccount,
  setVaultRecoveryConfig,
} from "@/lib/nex-native/vault/envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  recovery_salt_hex?: unknown;
  recovery_argon_params?: unknown;
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

  // Step-up: unlocked + (webauthn OR password fresh).
  const unlockVerdict = await requireStepUp(nexSessionId, {
    vault_unlock: "fresh",
  });
  if (!unlockVerdict.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "step_up_required",
        required: ["vault_unlock"],
      },
      { status: 403 },
    );
  }
  const [webauthnVerdict, passwordVerdict] = await Promise.all([
    requireStepUp(nexSessionId, { webauthn: "fresh" }),
    requireStepUp(nexSessionId, { password: "fresh" }),
  ]);
  if (!webauthnVerdict.ok && !passwordVerdict.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "step_up_required",
        required: ["webauthn_or_password"],
      },
      { status: 403 },
    );
  }

  // Setup must exist (one-shot per account; recovery is an add-on).
  const setup = await getVaultSetupForAccount(session.account.id);
  if (!setup) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 404 },
    );
  }

  // Shape-validate the body.
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  let recoverySalt: Uint8Array;
  let wrappedVmk: Uint8Array;
  let nonce: Uint8Array;
  try {
    recoverySalt = hexToBytes(
      typeof body.recovery_salt_hex === "string" ? body.recovery_salt_hex : "",
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
  if (recoverySalt.length < 16 || recoverySalt.length > 64) {
    return NextResponse.json(
      { ok: false, error: "invalid_recovery_salt_length" },
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
  const argonParams = body.recovery_argon_params;
  if (
    typeof argonParams !== "object" ||
    argonParams === null ||
    Array.isArray(argonParams)
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_recovery_argon_params" },
      { status: 400 },
    );
  }

  // Store recovery config + envelope. Delete any existing recovery
  // envelope first (partial unique index enforces one active, and the
  // user may be rotating their recovery passphrase).
  await deleteActiveEnvelopesForPath({
    accountId: session.account.id,
    kind: "recovery",
  });

  try {
    await setVaultRecoveryConfig({
      accountId: session.account.id,
      recoverySalt,
      recoveryArgonParams: argonParams as Record<string, unknown>,
    });
    await createEnvelope({
      accountId: session.account.id,
      kind: "recovery",
      wrappedVmk,
      nonce,
      generation: setup.vmk_generation,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "recovery_setup_failed", detail: msg },
      { status: 500 },
    );
  }

  await logSignInEvent({
    account_id: session.account.id,
    event_type: "recovery_configured",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
