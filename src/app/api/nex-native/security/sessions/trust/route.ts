// POST /api/nex-native/security/sessions/trust
//
// Phase 1.0 Security · owner toggles the `trusted` flag on one session.
// Phase 1.0 ships the UI · enforcement (e.g. require 2FA on untrusted)
// lands in Phase 1.1 along with the TOTP work.
//
// Request body: { session_id: string, trusted: boolean }
// Response: { ok: true } on success.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { setSessionTrustedForOwner } from "@/lib/nex-native/security-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: { session_id?: string; trusted?: boolean };
  try {
    body = (await req.json()) as { session_id?: string; trusted?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const trusted = typeof body.trusted === "boolean" ? body.trusted : null;
  if (!sessionId || trusted === null) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    );
  }
  try {
    const updated = await setSessionTrustedForOwner(sessionId, session.account.id, trusted);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
