// Shared helpers for /api/brain-admin/* endpoints.

import { NextResponse } from "next/server";
import { getBrainAdminFromCookie, nexBrainAdminEnabled } from "@/lib/nex/brains/_admin";

export type AdminGateResult =
  | { ok: true; adminId: string }
  | { ok: false; response: NextResponse };

export async function requireBrainAdmin(): Promise<AdminGateResult> {
  if (!nexBrainAdminEnabled()) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "brain_admin_disabled" },
        { status: 503 }
      )
    };
  }
  const adminId = await getBrainAdminFromCookie();
  if (!adminId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "not_authorized" },
        { status: 401 }
      )
    };
  }
  return { ok: true, adminId };
}

export function jsonError(code: string, detail: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: code, detail }, { status });
}
export function jsonOk(payload: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...(payload as object) }, { status });
}
