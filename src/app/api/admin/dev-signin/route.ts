// GET /api/admin/dev-signin?next=/admin/payments
//
// [DEV BUTTON] — remove on "remove dev buttons"
//
// Dev-only admin bypass. Mints the signed admin cookie without asking
// for the ADMIN_PASSWORD so we can iterate on admin UI without hitting
// the login gate every reload. Prod (NODE_ENV === "production") returns
// 404 so this can never grant access on the live app.

import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  adminCookieValue,
  devAdminCookieValue
} from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next") ?? "/admin/payments";
  // Whitelist to /admin/* so an open redirect isn't possible.
  const next = nextParam.startsWith("/admin") ? nextParam : "/admin/payments";

  // Prefer a real signed cookie (using ADMIN_COOKIE_SECRET) when it's
  // configured. Fall back to the dev-mode token when the secret is
  // missing — that token is only accepted when NODE_ENV !== "production"
  // (see isDevAdminToken in adminAuth.ts), so this can never grant
  // access on the live app.
  let cookieValue: string;
  try {
    cookieValue = adminCookieValue();
  } catch {
    cookieValue = devAdminCookieValue();
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.set(ADMIN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}
