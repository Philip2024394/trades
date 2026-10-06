// POST /api/nex-native/custom-intro/toggle
// Phase 1.0 · owner toggles Custom Intro ON/OFF.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { setEnabledForOwner } from "@/lib/nex-native/custom-intro-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: { enabled?: boolean };
  try {
    body = (await req.json()) as { enabled?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "missing_enabled" },
      { status: 400 },
    );
  }
  try {
    const row = await setEnabledForOwner(session.account.id, body.enabled);
    if (!row) {
      return NextResponse.json({ ok: false, error: "not_entitled" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, enabled: row.enabled });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
