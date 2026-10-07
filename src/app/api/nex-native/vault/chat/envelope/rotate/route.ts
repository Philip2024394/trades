// POST /api/nex-native/vault/chat/envelope/rotate
//
// Vault Phase B · Commit B.2 · plaintext-blind atomic rotation route.
//
// Atomic operation: revoke every active envelope for (account,
// conversation), compute the next generation, mint fresh envelopes for
// every supplied device at the new generation. Caller must supply
// envelopes for every device that should retain access · devices
// omitted lose access on next unlock (their revoked envelopes can no
// longer be used).
//
// Sensitive · requires fresh vault_unlock AND fresh password.
//
// Request body: {
//   conversation_id: uuid,
//   envelopes: [
//     { target_device_id, wrapped_k_c_hex, nonce_hex },
//     ...
//   ],
// }
// algorithm is pinned server-side to "aes-256-gcm/v1" · generation is
// computed server-side (no client-supplied generation value).

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import { rotateEnvelopes } from "@/lib/nex-native/vault/conversation-envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingEnvelope {
  target_device_id?: unknown;
  wrapped_k_c_hex?: unknown;
  nonce_hex?: unknown;
}

interface Body {
  conversation_id?: unknown;
  envelopes?: unknown;
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

  const verdict = await requireStepUp(nexSessionId, {
    vault_unlock: "fresh",
    password: "fresh",
  });
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: "step_up_required", required: verdict.missing },
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
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  if (!Array.isArray(body.envelopes) || body.envelopes.length === 0) {
    return NextResponse.json({ ok: false, error: "no_envelopes_supplied" }, { status: 400 });
  }
  const envelopes: Array<{
    targetDeviceId: string;
    wrappedKCHex: string;
    nonceHex: string;
  }> = [];
  for (const e of body.envelopes as IncomingEnvelope[]) {
    if (
      typeof e.target_device_id !== "string" ||
      typeof e.wrapped_k_c_hex !== "string" ||
      typeof e.nonce_hex !== "string"
    ) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }
    envelopes.push({
      targetDeviceId: e.target_device_id,
      wrappedKCHex: e.wrapped_k_c_hex,
      nonceHex: e.nonce_hex,
    });
  }

  const result = await rotateEnvelopes({
    accountId: session.account.id,
    conversationId,
    envelopes,
  });

  if (!result.ok) {
    switch (result.error) {
      case "conversation_not_found":
      case "not_a_participant":
      case "device_not_owned":
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      case "no_envelopes_supplied":
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      default:
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  }

  return NextResponse.json({
    ok: true,
    generation: result.generation,
    revoked: result.revoked,
    minted: result.minted,
  });
}
