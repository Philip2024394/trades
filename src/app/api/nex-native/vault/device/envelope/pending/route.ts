// POST /api/nex-native/vault/device/envelope/pending
//
// Vault Phase A · Commit A.4 · retrieve a pending device envelope for
// the caller's current device.
//
// Returns the opaque wrapped VMK + nonce if an active (unconsumed,
// unexpired) device envelope targets this device. The CURRENT device
// then performs ECDH + AES-GCM decrypt locally to recover VMK.
//
// Request:  { device_id }
// Response: { ok: true, envelope: { id, wrapped_vmk_hex, nonce_hex,
//            algorithm, generation, expires_at } } · or
//           { ok: true, envelope: null } if nothing pending.
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { getActiveDeviceEnvelope } from "@/lib/nex-native/vault/envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
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

  // Owner-scope + revocation check.
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

  const envelope = await getActiveDeviceEnvelope({
    accountId: session.account.id,
    targetDeviceId: deviceId,
  });
  if (!envelope) {
    return NextResponse.json({ ok: true, envelope: null });
  }

  return NextResponse.json({
    ok: true,
    envelope: {
      id: envelope.id,
      wrapped_vmk_hex: bytesToHex(envelope.wrapped_vmk),
      nonce_hex: bytesToHex(envelope.nonce),
      algorithm: envelope.algorithm,
      generation: envelope.generation,
      expires_at: envelope.expires_at,
    },
  });
}
