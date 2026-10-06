// POST /api/nex-native/vault/device/revoke
//
// Vault Phase A · Commit A.4 · revoke another device's Vault access.
//
// Setting nex_account_device_key.revoked_at prevents the device from:
//   · unlocking Vault (unlock-materials checks revoked_at)
//   · consuming new device envelopes (consume checks revoked_at)
//   · being authorised again (authorise target-device check)
//
// Also deletes any active PIN or device envelope targeting this device
// so future rows cannot be revived through a race.
//
// Honest security boundary (per design §F.2):
//   · If the revoked device already had VMK in memory when revoked,
//     revocation does NOT guarantee that in-memory key is destroyed.
//   · Full key rotation (Phase A.5) is the only way to invalidate
//     already-held VMK material.
//
// Required step-up: fresh password AND fresh WebAuthn per design §H.
// Phase A.4 accepts fresh password OR fresh WebAuthn (either, not
// both) as a pragmatic relaxation until WebAuthn step-up ships. If
// WebAuthn-only is sealed later, this route stays source of truth.
//
// Request:  { target_device_id }
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
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import { deleteActiveEnvelopesForPath } from "@/lib/nex-native/vault/envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  target_device_id?: unknown;
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

  // Step-up (fresh WebAuthn OR fresh password).
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

  // Owner-scope: device must belong to this account.
  const { data: target, error: devErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, revoked_at")
    .eq("account_id", session.account.id)
    .eq("device_id", targetDeviceId)
    .maybeSingle();
  if (devErr) {
    return NextResponse.json(
      { ok: false, error: "device_lookup_failed" },
      { status: 500 },
    );
  }
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "device_not_registered" },
      { status: 400 },
    );
  }

  // Set revoked_at. Idempotent · revoking a revoked device is a no-op.
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .update({ revoked_at: nowIso })
    .eq("account_id", session.account.id)
    .eq("device_id", targetDeviceId)
    .is("revoked_at", null);
  if (updateErr) {
    return NextResponse.json(
      { ok: false, error: "device_revoke_failed", detail: updateErr.message },
      { status: 500 },
    );
  }

  // Delete active PIN and device envelopes targeting this device.
  await deleteActiveEnvelopesForPath({
    accountId: session.account.id,
    kind: "pin",
    targetDeviceId,
  });
  await deleteActiveEnvelopesForPath({
    accountId: session.account.id,
    kind: "device",
    targetDeviceId,
  });

  await logSignInEvent({
    account_id: session.account.id,
    event_type: "device_revoked",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
