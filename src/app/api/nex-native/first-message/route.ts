// src/app/api/nex-native/first-message/route.ts
//
// Bridge 99 · Stage 7 · POST /api/nex-native/first-message · thin Next.js
// binding over the deterministic core in first-message-http.ts.
//
// The route wires next/headers (cookies, request headers) into the
// core's deps interface. All business logic lives in the core.

import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";

import { resolveNexAppOrProvisionalSession } from "@/lib/nex-native/first-conversation/provisional-session";
import { loadProvisionalFingerprintConfigFromEnv } from "@/lib/nex-native/first-conversation/provisional-fingerprint";
import {
  nextCookieAdapter,
  writeNexSessionCookie,
  loadNexSessionCookieConfigFromEnv,
  loadNexSessionCryptoConfigFromEnv,
} from "@/lib/nex-native/first-conversation/session-cookie";
import { processFirstMessagePayload } from "@/lib/nex-native/first-conversation/first-message-http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "invalid_request", message: "body must be valid JSON", field: "body" },
      { status: 400 },
    );
  }

  let cryptoCfg;
  let fingerprintCfg;
  try {
    cryptoCfg = loadNexSessionCryptoConfigFromEnv();
    fingerprintCfg = loadProvisionalFingerprintConfigFromEnv();
  } catch {
    // Missing critical env config · fail closed.
    return NextResponse.json({ status: "internal_error" }, { status: 500 });
  }

  const result = await processFirstMessagePayload(body, {
    resolveSession: resolveNexAppOrProvisionalSession,
    getConnectionIp: async () => {
      const h = await nextHeaders();
      const xff = h.get("x-forwarded-for");
      if (xff) {
        const first = xff.split(",")[0]?.trim();
        if (first) return first;
      }
      const real = h.get("x-real-ip");
      if (real) return real.trim();
      return "127.0.0.1";
    },
    fingerprintCfg,
    cryptoCfg,
  });

  // Write session cookie post-commit if orchestrator asked for it.
  if (result.set_session_cookie) {
    try {
      const adapter = await nextCookieAdapter();
      const cookieCfg = loadNexSessionCookieConfigFromEnv();
      writeNexSessionCookie(
        adapter,
        result.set_session_cookie.payload,
        cryptoCfg,
        cookieCfg,
      );
    } catch {
      // Cookie-write failures are non-fatal · account and session ARE
      // committed. Next request will treat visitor as unauthenticated
      // per sealed §7 precedence (cookie-missing → new provisional).
    }
  }

  return NextResponse.json(result.body, { status: result.http_status });
}
