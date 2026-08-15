// NEX Business Context · session + permission gate (Philip 2026-08-14).
//
// Session sources (in priority order · Phase 13):
//   1. `nex_session` HMAC-signed cookie (production browser)
//   2. `x-nex-session` HMAC-signed header (server-to-server calls)
//   3. `x-nex-session-test` unsigned base64 JSON (TEST HARNESS ONLY · disabled outside NODE_ENV=test)
//   4. no session → role="anonymous"
//
// The signed session is the production path. The unsigned test header is
// only accepted when NODE_ENV="test" (Phase 12 tests set this) — so a
// production request cannot forge sessions by simply sending the header.

import type { NextRequest } from "next/server";
import type { NexRole, NexSession } from "./types";
import { verifySession, SESSION_COOKIE_NAME, ownerCookieName, customerCookieName } from "@/lib/nex/auth";

const SIGNED_HEADER_NAME = "x-nex-session";      // signed cookie value passed as header (server-to-server)
const TEST_HEADER_NAME = "x-nex-session-test";   // unsigned JSON base64 · TEST ONLY

/** Read the caller's session.
 *
 *  Phase 18 · when the route knows a business slug, pass it as `{ slug }`
 *  so scoped cookies (`nex_owner_<slug>`, `nex_customer_<slug>`) are read
 *  in preference to the legacy single `nex_session` cookie. Owner scope
 *  wins over customer scope when both cookies exist for the same slug
 *  (owner is the more-privileged role · the ROUTE still gates on required
 *  role via assertPermission, so this preference is only about *which*
 *  session identity is surfaced).
 *
 *  Backwards compat · when `slug` is not supplied, existing behaviour is
 *  preserved: legacy `nex_session` cookie → signed header → test header.
 */
export function readSession(req: Request | NextRequest, opts: { slug?: string; scope?: "owner" | "customer" } = {}): NexSession {
  const cookies = parseCookieHeader(req.headers.get("cookie") ?? "");

  // 1. Scoped cookies (Phase 18) · route can request a specific scope so the
  //    OWNER cookie is invisible on customer routes and vice versa. Without
  //    a scope hint, owner is preferred over customer for the same slug.
  if (opts.slug) {
    const wantOwner = opts.scope === undefined || opts.scope === "owner";
    const wantCust  = opts.scope === undefined || opts.scope === "customer";
    if (wantOwner) {
      const ownerRaw = cookies[ownerCookieName(opts.slug)];
      if (ownerRaw) {
        const v = verifySession(ownerRaw);
        if (v && v.role === "owner" && v.businessSlug === opts.slug) return normalise(v);
      }
    }
    if (wantCust) {
      const custRaw = cookies[customerCookieName(opts.slug)];
      if (custRaw) {
        const v = verifySession(custRaw);
        if (v && v.role === "customer" && v.businessSlug === opts.slug) return normalise(v);
      }
    }
  }

  // 2. Legacy single-scope cookie (production browser path · backwards compat)
  const legacy = cookies[SESSION_COOKIE_NAME];
  if (legacy) {
    const v = verifySession(legacy);
    if (v) return normalise(v);
  }

  // 3. Signed header (server-to-server calls · same signed value)
  const signedHeader = req.headers.get(SIGNED_HEADER_NAME);
  if (signedHeader) {
    const v = verifySession(signedHeader);
    if (v) return normalise(v);
  }

  // 4. Test-only unsigned header — accepted ONLY when NODE_ENV=test.
  if (process.env.NODE_ENV === "test") {
    const testHeader = req.headers.get(TEST_HEADER_NAME) ?? req.headers.get(SIGNED_HEADER_NAME);
    if (testHeader) {
      const parsed = tryParseUnsigned(testHeader);
      if (parsed) return parsed;
    }
  }
  return { role: "anonymous" };
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function normalise(s: NexSession & { email?: string }): NexSession {
  return {
    role:            s.role,
    businessSlug:    s.businessSlug,
    customerId:      s.customerId,
    ownerAccountId:  s.ownerAccountId
  };
}

function tryParseUnsigned(raw: string): NexSession | null {
  try {
    const json = Buffer.from(decodeURIComponent(raw), "base64").toString("utf8");
    const parsed = JSON.parse(json) as Partial<NexSession>;
    if (!parsed.role || !["customer", "owner", "anonymous"].includes(parsed.role)) return null;
    return {
      role:            parsed.role as NexRole,
      businessSlug:    parsed.businessSlug,
      customerId:      parsed.customerId,
      ownerAccountId:  parsed.ownerAccountId
    };
  } catch {
    return null;
  }
}

/** Encode a session UNSIGNED for tests. Production uses signSession(). */
export function encodeSession(s: NexSession): string {
  return Buffer.from(JSON.stringify(s), "utf8").toString("base64");
}
