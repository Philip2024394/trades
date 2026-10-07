// GET /api/nex-native/vault/chat/envelope/list?device_id=…
//
// Vault Phase B · Commit B.2 · plaintext-blind list route.
//
// Returns every ACTIVE envelope targeting the given device for the
// authenticated account. The response contains opaque hex-encoded
// ciphertext bytes · the server never decrypts them. Used by the
// client's on-unlock batch unwrap in B.3.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  assertOwnDevice,
  listActiveEnvelopesForDevice,
} from "@/lib/nex-native/vault/conversation-envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  const deviceId = req.nextUrl.searchParams.get("device_id") ?? "";
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json({ ok: false, error: "invalid_device_id" }, { status: 400 });
  }

  // Only the owner can list their own envelopes · the device must
  // belong to this account and not be revoked.
  const device = await assertOwnDevice({
    accountId: session.account.id,
    deviceId,
  });
  if (!device.ok) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const envelopes = await listActiveEnvelopesForDevice({
    accountId: session.account.id,
    deviceId,
  });

  return NextResponse.json({ ok: true, envelopes });
}
