// POST /api/nex-native/security/credentials/rename
//
// Phase 1.0 Security · owner renames one face sign-in credential's
// `device_label` so the Devices page is readable ("MacBook Pro" vs
// the default "Unknown device").
//
// Request body: { credential_id: string, label: string }
// Response: { ok: true, label: string } on success. Server trims and
// truncates the label to 80 chars (matches the DB CHECK).

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { renameCredentialForOwner } from "@/lib/nex-native/webauthn-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: { credential_id?: string; label?: string };
  try {
    body = (await req.json()) as { credential_id?: string; label?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const credentialId =
    typeof body.credential_id === "string" ? body.credential_id.trim() : "";
  const rawLabel = typeof body.label === "string" ? body.label : "";
  const label = rawLabel.trim().slice(0, 80);
  if (!credentialId || label.length === 0) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    );
  }
  try {
    const updated = await renameCredentialForOwner(credentialId, session.account.id, label);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, label });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
