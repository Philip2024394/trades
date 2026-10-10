// src/lib/nex/marketing/founder/auth.ts
//
// NEX Email Marketing HQ · Founder auth resolver
// Founder-authorised programme.

import type { FounderAuthContext } from "./types";

/** Founder auth · same pattern as existing HQ founder gate
 *  (localhost + admin cookie + HQ dashboard token). Server-side only. */
export function resolveFounderAuth(req: Request): FounderAuthContext {
  const url = new URL(req.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") {
    return { authenticated: true, actor: "founder:localhost", source: "localhost" };
  }
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) {
    return { authenticated: true, actor: "founder:admin", source: "cookie" };
  }
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) {
    return { authenticated: true, actor: "founder:hq-token", source: "bearer" };
  }
  return { authenticated: false, actor: "", source: "unauthenticated" };
}
