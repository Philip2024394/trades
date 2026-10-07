// POST /api/nex-native/vault/chat/envelope/revoke
//
// Vault Phase B · Commit B.2 · plaintext-blind revoke route.
//
// Flips revoked_at = now() on a single envelope row the authenticated
// account owns. Sensitive operation · requires fresh vault_unlock
// AND fresh password step-up (B.6 revoke-sweep posture). Non-owner
// attempts are indistinguishable from "envelope not found" to avoid
// leaking existence.
//
// Request body: { envelope_id: uuid }

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import { revokeEnvelope } from "@/lib/nex-native/vault/conversation-envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  envelope_id?: unknown;
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

  // Revoke is a destructive op · require BOTH vault_unlock and
  // password freshness (sealed B.6 revoke-sweep posture · design §H).
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
  const envelopeId = typeof body.envelope_id === "string" ? body.envelope_id : "";
  if (!envelopeId) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const result = await revokeEnvelope({
    accountId: session.account.id,
    envelopeId,
  });

  if (!result.ok) {
    switch (result.error) {
      case "envelope_not_found":
      case "not_owned":
        // Collapse to 404 so non-owners cannot distinguish existence.
        return NextResponse.json({ ok: false, error: "envelope_not_found" }, { status: 404 });
      case "already_revoked":
        return NextResponse.json({ ok: false, error: "already_revoked" }, { status: 409 });
    }
  }

  return NextResponse.json({
    ok: true,
    envelope_id: result.envelope_id,
    revoked_at: result.revoked_at,
  });
}
