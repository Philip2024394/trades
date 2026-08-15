// NEX Auth · POST /api/nex/logout (Philip 2026-08-14).
// Clears the session cookie for both customer and owner sessions.

import { NextResponse } from "next/server";
import { serializeClearCookie } from "@/lib/nex/auth/session-signer";
import { SESSION_COOKIE_NAME } from "@/lib/nex/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", serializeClearCookie(SESSION_COOKIE_NAME));
  return res;
}
