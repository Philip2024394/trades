// POST /api/nex-native/vault/rotate
//
// Vault Phase A · Commit A.5 · rotate Vault keys.
//
// Rotation INVALIDATES previously-held VMK material: devices that
// held VMK_old (including revoked devices) lose future authorised
// access, because their PIN envelope is deleted and the recovery
// envelope is replaced. VMK_old is still in those devices' RAM —
// honest design §F.2 limit — but the server-side envelopes no
// longer provide any path to the server's current VMK.
//
// Current-device PIN envelope is UPDATED IN PLACE under the client's
// current pin_salt (same salt + same KEK derivation from same PIN;
// only wrapped_vmk + nonce change). Recovery envelope is similarly
// updated if the account configured recovery.
//
// FILE RE-WRAP (nex_vault_file.wrapped_content_key) is accepted via
// `file_updates: []` for forward compatibility with A.6, but no
// files participate in rotation at A.5 time (all pre-A.1 vault
// files are migration_state='legacy' with wrapped_content_key NULL;
// A.6 populates them · after A.6, rotation re-wraps them here).
//
// CRASH SAFETY (honest limit): supabase-js has no explicit multi-
// statement transaction, so this route executes updates in a
// well-ordered sequence. Order chosen so a mid-sequence crash
// leaves a safely-recoverable state. The vmk_generation bump is
// the LAST operation; readers treat it as the authoritative
// generation marker. For large-scale file re-wrap at A.6, migration
// 143 defining a `nex_vault_rotate()` Postgres function is the
// clean path to atomic rotation; THIS route documents that honest
// limit rather than silently depending on it.
//
// Preconditions:
//   · authenticated session not revoked
//   · fresh vault_unlock + (fresh webauthn OR fresh password)
//   · client-supplied old_generation == setup.vmk_generation
//   · caller's current device is one of the account's non-revoked
//     devices (keeps its PIN envelope · all other PIN envelopes are
//     deleted)
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
  bumpVmkGeneration,
  getActiveRecoveryEnvelope,
  getVaultSetupForAccount,
} from "@/lib/nex-native/vault/envelope-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FileUpdate {
  file_id?: string;
  wrapped_content_key_hex?: string;
  content_nonce_hex?: string;
}

interface Body {
  old_generation?: unknown;
  current_device_id?: unknown;
  pin_wrapped_vmk_hex?: unknown;
  pin_nonce_hex?: unknown;
  recovery_wrapped_vmk_hex?: unknown;
  recovery_nonce_hex?: unknown;
  file_updates?: unknown;
}

function hexToBytea(hex: string): string {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  return "\\x" + hex;
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

  // Step-up: fresh vault_unlock + fresh webauthn OR password.
  const unlockVerdict = await requireStepUp(nexSessionId, {
    vault_unlock: "fresh",
  });
  if (!unlockVerdict.ok) {
    return NextResponse.json(
      { ok: false, error: "step_up_required", required: ["vault_unlock"] },
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

  // Parse + shape-validate.
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const oldGenRaw = body.old_generation;
  const oldGen = typeof oldGenRaw === "number" ? oldGenRaw : Number(oldGenRaw);
  if (!Number.isInteger(oldGen) || oldGen < 1) {
    return NextResponse.json(
      { ok: false, error: "invalid_old_generation" },
      { status: 400 },
    );
  }
  const currentDeviceId =
    typeof body.current_device_id === "string" ? body.current_device_id : "";
  if (currentDeviceId.length < 8 || currentDeviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_current_device_id" },
      { status: 400 },
    );
  }
  const pinWrappedHex =
    typeof body.pin_wrapped_vmk_hex === "string" ? body.pin_wrapped_vmk_hex : "";
  const pinNonceHex =
    typeof body.pin_nonce_hex === "string" ? body.pin_nonce_hex : "";
  const recoveryWrappedHex =
    typeof body.recovery_wrapped_vmk_hex === "string"
      ? body.recovery_wrapped_vmk_hex
      : null;
  const recoveryNonceHex =
    typeof body.recovery_nonce_hex === "string" ? body.recovery_nonce_hex : null;
  if (
    !/^[0-9a-f]+$/i.test(pinWrappedHex) ||
    pinWrappedHex.length < 64 ||
    pinWrappedHex.length > 256
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_pin_wrapped_vmk" },
      { status: 400 },
    );
  }
  if (
    !/^[0-9a-f]+$/i.test(pinNonceHex) ||
    pinNonceHex.length < 24 ||
    pinNonceHex.length > 48
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_pin_nonce" },
      { status: 400 },
    );
  }
  if ((recoveryWrappedHex === null) !== (recoveryNonceHex === null)) {
    return NextResponse.json(
      { ok: false, error: "invalid_recovery_pair" },
      { status: 400 },
    );
  }
  const fileUpdatesRaw = body.file_updates;
  const fileUpdates: FileUpdate[] = Array.isArray(fileUpdatesRaw)
    ? (fileUpdatesRaw as FileUpdate[])
    : [];
  // Shape-check each (every field hex-valid).
  for (const u of fileUpdates) {
    if (
      typeof u.file_id !== "string" ||
      typeof u.wrapped_content_key_hex !== "string" ||
      typeof u.content_nonce_hex !== "string" ||
      !/^[0-9a-f]+$/i.test(u.wrapped_content_key_hex) ||
      !/^[0-9a-f]+$/i.test(u.content_nonce_hex)
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_file_update_shape" },
        { status: 400 },
      );
    }
  }

  // Setup must exist + old_generation must match.
  const setup = await getVaultSetupForAccount(session.account.id);
  if (!setup) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 404 },
    );
  }
  if (setup.vmk_generation !== oldGen) {
    return NextResponse.json(
      {
        ok: false,
        error: "generation_mismatch",
        current_generation: setup.vmk_generation,
      },
      { status: 409 },
    );
  }
  const newGen = oldGen + 1;

  // Verify caller's device is a non-revoked device of this account.
  const { data: deviceRow, error: devErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, revoked_at")
    .eq("account_id", session.account.id)
    .eq("device_id", currentDeviceId)
    .maybeSingle();
  if (devErr) {
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

  // Recovery was configured? Enforce consistency: if caller provides a
  // recovery pair, we require recovery_configured_at to be set.
  const recoveryWasConfigured = setup.recovery_configured_at !== null;
  if (recoveryWrappedHex !== null && !recoveryWasConfigured) {
    return NextResponse.json(
      { ok: false, error: "recovery_not_configured" },
      { status: 400 },
    );
  }
  if (recoveryWrappedHex === null && recoveryWasConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "recovery_pair_missing",
        detail:
          "This account has a recovery passphrase · rotation must include a new recovery envelope.",
      },
      { status: 400 },
    );
  }

  // Begin rotation sequence. Each statement is individually atomic.
  // Order chosen so a mid-sequence crash leaves the state recoverable:
  //   1 · UPDATE current device's PIN envelope in place (NEW wrapped_vmk).
  //   2 · DELETE other PIN envelopes (other devices lose access).
  //   3 · If recovery · DELETE old recovery envelope + INSERT new.
  //   4 · DELETE all pending device envelopes (invalidated).
  //   5 · UPDATE file rows (none in A.5 scope · forward-compat only).
  //   6 · Finally · bump setup.vmk_generation to newGen.
  //
  // A reader seeing vmk_generation=oldGen trusts the account is at
  // generation=oldGen · the PIN envelope they see is still a
  // consistent one · worst case they fail to unlock and the user
  // can retry rotation.
  const nowIso = new Date().toISOString();

  // 1 · UPDATE current device PIN envelope.
  const { error: pinUpdErr } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .update({
      wrapped_vmk: hexToBytea(pinWrappedHex),
      nonce: hexToBytea(pinNonceHex),
      generation: newGen,
    })
    .eq("account_id", session.account.id)
    .eq("kind", "pin")
    .eq("target_device_id", currentDeviceId)
    .is("consumed_at", null);
  if (pinUpdErr) {
    return NextResponse.json(
      { ok: false, error: "pin_envelope_update_failed", detail: pinUpdErr.message },
      { status: 500 },
    );
  }

  // 2 · DELETE other devices' PIN envelopes.
  const { error: otherDelErr } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .delete()
    .eq("account_id", session.account.id)
    .eq("kind", "pin")
    .is("consumed_at", null)
    .neq("target_device_id", currentDeviceId);
  if (otherDelErr) {
    return NextResponse.json(
      { ok: false, error: "other_pin_envelope_delete_failed" },
      { status: 500 },
    );
  }

  // 3 · Recovery envelope · delete old, insert new (if configured).
  if (recoveryWrappedHex !== null && recoveryNonceHex !== null) {
    const { error: recDelErr } = await nexSupabaseAdmin
      .from("nex_vault_key_envelope")
      .delete()
      .eq("account_id", session.account.id)
      .eq("kind", "recovery")
      .is("consumed_at", null);
    if (recDelErr) {
      return NextResponse.json(
        { ok: false, error: "recovery_envelope_delete_failed" },
        { status: 500 },
      );
    }
    const { error: recInsErr } = await nexSupabaseAdmin
      .from("nex_vault_key_envelope")
      .insert({
        account_id: session.account.id,
        kind: "recovery",
        target_device_id: null,
        credential_id: null,
        wrapped_vmk: hexToBytea(recoveryWrappedHex),
        nonce: hexToBytea(recoveryNonceHex),
        algorithm: "aes-256-gcm/v1",
        generation: newGen,
      });
    if (recInsErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "recovery_envelope_insert_failed",
          detail: recInsErr.message,
        },
        { status: 500 },
      );
    }
  }

  // 4 · Delete pending device envelopes.
  const { error: devDelErr } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .delete()
    .eq("account_id", session.account.id)
    .eq("kind", "device")
    .is("consumed_at", null);
  if (devDelErr) {
    return NextResponse.json(
      { ok: false, error: "device_envelope_delete_failed" },
      { status: 500 },
    );
  }

  // 5 · File content-key re-wraps (none in A.5 scope · empty array
  // means nothing to do here).
  if (fileUpdates.length > 0) {
    for (const u of fileUpdates) {
      const { error: fileUpdErr } = await nexSupabaseAdmin
        .from("nex_vault_file")
        .update({
          wrapped_content_key: hexToBytea(u.wrapped_content_key_hex!),
          content_nonce: hexToBytea(u.content_nonce_hex!),
          rotation_generation: newGen,
        })
        .eq("account_id", session.account.id)
        .eq("id", u.file_id!);
      if (fileUpdErr) {
        return NextResponse.json(
          {
            ok: false,
            error: "file_rewrap_failed",
            file_id: u.file_id,
            detail: fileUpdErr.message,
          },
          { status: 500 },
        );
      }
    }
  }

  // 6 · Bump setup.vmk_generation LAST · readers trust this value.
  try {
    await bumpVmkGeneration(session.account.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: "generation_bump_failed",
        detail: msg,
      },
      { status: 500 },
    );
  }

  // Audit · 'vault_rotated'. The current session is still unlocked
  // under the new VMK the client installed before this POST.
  void nowIso;
  await logSignInEvent({
    account_id: session.account.id,
    event_type: "vault_rotated",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  // Also confirm recovery envelope matches new generation (sanity).
  const recoveryAfter = await getActiveRecoveryEnvelope(session.account.id);
  const generationCheck = recoveryWasConfigured && recoveryAfter?.generation !== newGen;
  if (generationCheck) {
    // Soft warning · log but do not fail the user; A.6 reconciliation
    // can detect generation mismatch and offer retry.
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "step_up_required_blocked",
      success: false,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    });
  }

  return NextResponse.json({ ok: true, new_generation: newGen });
}
