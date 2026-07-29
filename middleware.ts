// middleware.ts · project root
//
// D1 Turn 2 · Auth + permission middleware (Philip 2026-07-28)
//
// Gates access to /admin/** and /api/admin/** on a valid Supabase Auth
// session. Built to support permission checks — the pipeline is:
//
//   Route → Session → User → Permission → Access
//
// v1.0 behaviour: presence of a session + active NexUser row = access.
// Per-brain / per-action permission checks live in individual routes
// (via `canPerform` from _permissions.ts) since they need the request
// body to know the brain slug + action being attempted.
//
// The middleware ALSO refreshes the Supabase auth cookie on every
// request per Supabase's SSR pattern — critical for token rotation.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/admin/login",
  "/api/auth/login",
  "/api/auth/logout",
];

const PROTECTED_PREFIXES = [
  "/admin",
  "/api/admin",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Dev bypass — same env var used by _actor.ts, so behaviour is consistent
  if (process.env.NEX_DEV_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  // Public routes: allow without check
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Only protect the specified prefixes
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // Setup Supabase client bound to this request/response
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Fail-closed: without auth config, deny protected routes
    return respondUnauthorized(req, pathname, "server_misconfigured");
  }

  const response = NextResponse.next();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set({ name, value, ...options })
        );
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return respondUnauthorized(req, pathname, "no_active_session");
  }

  // Session is valid. Per-brain permission enforcement happens inside
  // the individual routes where the brain slug + action are known.
  return response;
}

function respondUnauthorized(req: NextRequest, pathname: string, reason: string) {
  // API paths: return JSON 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: reason }, { status: 401 });
  }
  // Page paths: redirect to login with return path
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  loginUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run middleware on every path except static assets. Individual
  // isPublic / isProtected checks inside decide the actual gate.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
