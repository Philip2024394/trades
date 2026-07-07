// POST /api/os/homeowner/session/logout — clears the homeowner cookie.
import { NextResponse } from "next/server";
import { HOMEOWNER_COOKIE, HOMEOWNER_COOKIE_OPTIONS } from "@/lib/os/homeownerSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HOMEOWNER_COOKIE, "", {
    ...HOMEOWNER_COOKIE_OPTIONS,
    maxAge: 0
  });
  return res;
}
