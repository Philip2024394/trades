// src/app/api/nex/account-gate/exists/route.ts
//
// NEX Settings Header · Account-Gate · session-exists probe.
// -----------------------------------------------------------------------
// Sealed 2026-10-10.
//
// GET /api/nex/account-gate/exists
//
// Lightweight read-only probe used by the SettingsHeaderSlot client
// component to determine whether to render the UNLOCKED gear
// (navigates to /nex-native/settings) or the LOCKED 3D-padlock
// (opens the CreateAccountPrompt modal).
//
// Response (always 200, never leaks resolver internals):
//   { "accountExists": boolean, "signedInWithoutAccount": boolean }
//
// Doctrine:
//   · The LOCK is the gate · if the resolver throws, we return the
//     safe default (both false) so the UI stays locked.
//   · This route NEVER returns the account id, email, or any session
//     material. The slot only needs the two booleans.
//   · No caching · auth state can change per-request.

import { NextResponse } from "next/server";
import { readAccountExists } from "@/lib/nex-native/account-gate/account-exists-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const snap = await readAccountExists();
  return NextResponse.json(snap, {
    status: 200,
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
