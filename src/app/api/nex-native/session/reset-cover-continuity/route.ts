// src/app/nex-native/api/nex-native/session/reset-cover-continuity/route.ts
//
// Bridge 99 · Stage 4e · route handler binding.
// -----------------------------------------------------------------------------
// User-facing label: "Start fresh on Covers"
// Internal endpoint:  POST /api/nex-native/session/reset-cover-continuity
//
// This handler is a thin binding over the deterministic core
// `resetCoverContinuityWith(deps)` in
// src/lib/nex-native/first-conversation/reset-cover-continuity.ts.
//
// POST only (never GET) so a bare URL cannot be used as a CSRF vector.
// The action is user-explicit per sealed §7 escape valve: the user's
// invocation is what makes the reset legitimate.
//
// Response is always 200 OK. The body's `reset` boolean and `reason`
// string tell the caller whether an actual server-side revocation
// happened. `none` states are not errors — they still succeed at
// removing any client-side cookie and represent the intended terminal
// state of "the browser now has no valid nex_session."

import { NextResponse } from "next/server";
import {
  nextCookieAdapter,
  loadNexSessionCookieConfigFromEnv,
  loadNexSessionCryptoConfigFromEnv,
} from "@/lib/nex-native/first-conversation/session-cookie";
import { resetCoverContinuityWith } from "@/lib/nex-native/first-conversation/reset-cover-continuity";

export const runtime = "nodejs";

export async function POST() {
  const cookieAdapter = await nextCookieAdapter();
  const cookieCfg = loadNexSessionCookieConfigFromEnv();
  const cryptoCfg = loadNexSessionCryptoConfigFromEnv();

  const result = await resetCoverContinuityWith({
    cookieAdapter,
    cookieCfg,
    cryptoCfg,
  });

  return NextResponse.json(result, { status: 200 });
}
