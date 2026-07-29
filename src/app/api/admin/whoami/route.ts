// GET /api/admin/whoami
//
// D1 Turn 3 · Return the current logged-in user for the UI badge
// (Philip 2026-07-28). Uses the centralised guard.

import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/nex/brains/_route_guards";
import { mfaRequiredForAction } from "@/lib/nex/brains/_permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    return NextResponse.json({
      ok: true,
      email: user.email,
      display_name: user.nex_user.display_name,
      role: user.nex_user.role,
      mfa_used: user.session_used_mfa,
      // For UI display: does this user's role hit any MFA-gated action?
      mfa_required_for_privileged: mfaRequiredForAction("publish"),
      organisation: user.nex_user.organisation,
      verified_at: user.nex_user.verified_at,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
