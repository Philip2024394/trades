// POST /api/nex-native/vault/chat/envelope/mint
//
// Vault Phase B · Commit B.2 · plaintext-blind mint route.
//
// Inserts ONE opaque per-device wrapped-K_c envelope row into
// nex_vault_conversation_envelope (migration 143). The server receives
// hex-encoded ciphertext bytes · it does NOT decrypt, it does NOT
// hash the plaintext, it does NOT touch VMK · all crypto is already
// finalised client-side under the sealed Phase A key hierarchy.
//
// Request body: {
//   conversation_id: uuid of canonical nex_peer_conversation,
//   target_device_id: 8..128 chars,
//   wrapped_k_c_hex: 120 hex chars = 60 bytes,
//   nonce_hex: 24 hex chars = 12 bytes (= first 12 bytes of wrapped_k_c),
//   algorithm: "aes-256-gcm/v1",
//   generation: int >= 1,
// }
//
// Gate: session + fresh vault_unlock step-up (same posture as A.6
// migration routes · the user must have VMK in memory to have produced
// the wrapped_k_c in the first place).

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import { mintEnvelope } from "@/lib/nex-native/vault/conversation-envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  conversation_id?: unknown;
  target_device_id?: unknown;
  wrapped_k_c_hex?: unknown;
  nonce_hex?: unknown;
  algorithm?: unknown;
  generation?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  const sessionKey = currentSessionKey(req);
  if (!sessionKey) {
    return NextResponse.json({ ok: false, error: "no_session_token" }, { status: 401 });
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

  const unlock = await requireStepUp(nexSessionId, { vault_unlock: "fresh" });
  if (!unlock.ok) {
    return NextResponse.json(
      { ok: false, error: "step_up_required", required: ["vault_unlock"] },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const targetDeviceId = typeof body.target_device_id === "string" ? body.target_device_id : "";
  const wrappedKCHex = typeof body.wrapped_k_c_hex === "string" ? body.wrapped_k_c_hex : "";
  const nonceHex = typeof body.nonce_hex === "string" ? body.nonce_hex : "";
  const algorithm = typeof body.algorithm === "string" ? body.algorithm : "";
  const generation = typeof body.generation === "number" ? body.generation : NaN;

  if (
    !conversationId ||
    !targetDeviceId ||
    !wrappedKCHex ||
    !nonceHex ||
    !algorithm ||
    !Number.isInteger(generation)
  ) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const result = await mintEnvelope({
    accountId: session.account.id,
    conversationId,
    targetDeviceId,
    wrappedKCHex,
    nonceHex,
    algorithm,
    generation,
  });

  if (!result.ok) {
    // Map authorisation failures to 403 · structural failures to 400 ·
    // uniqueness collision to 409. Owner-not-participant looks the
    // same to an attacker as "conversation does not exist" to avoid
    // leaking existence of other users' conversations.
    switch (result.error) {
      case "conversation_not_found":
      case "not_a_participant":
      case "device_not_owned":
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      case "duplicate_active_envelope":
        return NextResponse.json(
          { ok: false, error: "duplicate_active_envelope" },
          { status: 409 },
        );
      default:
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: 400 },
        );
    }
  }

  return NextResponse.json({
    ok: true,
    envelope_id: result.envelope_id,
    generation: result.generation,
  });
}
