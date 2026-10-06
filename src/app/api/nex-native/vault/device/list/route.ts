// GET /api/nex-native/vault/device/list
//
// Vault Phase A · Commit A.4 · device-portability list.
//
// Returns the authenticated account's device-keys with Vault status
// for each (has active PIN envelope · has pending device envelope ·
// revoked · is current). The UI uses this to render the "Vault
// devices" surface.
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeviceRow {
  device_id: string;
  public_key: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  // All device-keys for this account (both live and revoked).
  const { data: devices, error: devErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, public_key, created_at, last_seen_at, revoked_at")
    .eq("account_id", session.account.id)
    .order("last_seen_at", { ascending: false });
  if (devErr) {
    return NextResponse.json(
      { ok: false, error: "device_list_failed" },
      { status: 500 },
    );
  }

  // Active envelopes (PIN + device) for this account · lets us tell
  // the UI which devices are authorised vs pending.
  const { data: envelopes, error: envErr } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("kind, target_device_id, consumed_at, expires_at")
    .eq("account_id", session.account.id)
    .in("kind", ["pin", "device"])
    .is("consumed_at", null);
  if (envErr) {
    return NextResponse.json(
      { ok: false, error: "envelope_list_failed" },
      { status: 500 },
    );
  }
  const nowIso = new Date().toISOString();
  const activePinDeviceIds = new Set<string>();
  const pendingDeviceEnvelopeDeviceIds = new Set<string>();
  for (const row of envelopes as Array<{
    kind: string;
    target_device_id: string | null;
    consumed_at: string | null;
    expires_at: string | null;
  }>) {
    if (!row.target_device_id) continue;
    if (row.kind === "pin") {
      activePinDeviceIds.add(row.target_device_id);
    } else if (row.kind === "device") {
      if (row.expires_at && row.expires_at < nowIso) continue;
      pendingDeviceEnvelopeDeviceIds.add(row.target_device_id);
    }
  }

  // Current session's device_id is unknown to the server directly ·
  // the session resolver keys by supabase_session_key, not device_id.
  // We expose the session's session_key (sha256(access_token)) so the
  // UI can decide "this is the current device" based on which device
  // the browser used to upsert, but a simpler and safer convention is
  // to let the client identify itself (ensureDeviceKey() returns the
  // id). The response therefore just includes raw data; the client
  // marks the current row.
  const _ = currentSessionKey(req); // keep import live for future gating
  void _;

  return NextResponse.json({
    ok: true,
    devices: (devices as DeviceRow[]).map((d) => ({
      device_id: d.device_id,
      public_key: d.public_key,
      created_at: d.created_at,
      last_seen_at: d.last_seen_at,
      revoked_at: d.revoked_at,
      vault_status: d.revoked_at
        ? "revoked"
        : activePinDeviceIds.has(d.device_id)
          ? "authorised"
          : pendingDeviceEnvelopeDeviceIds.has(d.device_id)
            ? "pending"
            : "not_authorised",
    })),
  });
}
