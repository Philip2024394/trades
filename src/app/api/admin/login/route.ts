// POST /api/admin/login
//
// Accepts a form-encoded `password` field, compares (constant-time)
// against ADMIN_PASSWORD, and on success sets the signed
// xrated_admin_session cookie. On failure redirects back to
// /admin/login?error=1 so the form can render an error banner.
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
  adminCookieValue,
  checkAdminPassword
} from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData();
  const password = form.get("password");
  const nextParam = form.get("next");
  const nextUrl =
    typeof nextParam === "string" && nextParam.startsWith("/admin")
      ? nextParam
      : "/admin/payments";

  const ok = checkAdminPassword(
    typeof password === "string" ? password : ""
  );

  const origin = new URL(req.url).origin;
  if (!ok) {
    const url = new URL("/admin/login?error=1", origin);
    if (nextUrl !== "/admin/payments") {
      url.searchParams.set("next", nextUrl);
    }
    return NextResponse.redirect(url, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(nextUrl, origin), { status: 303 });
  res.cookies.set(ADMIN_COOKIE_NAME, adminCookieValue(), ADMIN_COOKIE_OPTIONS);
  return res;
}
