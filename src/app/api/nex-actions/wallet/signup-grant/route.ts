// src/app/api/nex-actions/wallet/signup-grant/route.ts
//
// Signup Sparks grant · F3.5 (2026-08-25).
//
// POST · body { userId } · grants 200 Sparks · idempotent by user_id.
// Server-authoritative · client cannot set the amount. Uses grantSignupSparks
// which delegates to nex.wallet_grant_sparks with idempotency_key =
// 'signup_grant:<userId>' so retries / re-installs / re-logins can NEVER
// grant twice.

import { NextResponse, type NextRequest } from "next/server";
import { grantSignupSparks, SIGNUP_GRANT_SPARKS } from "@/lib/nex-actions/wallet/signup-grant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const headerUserId = req.headers.get("x-nex-user-id");
  let body: { userId?: string };
  try { body = await req.json(); } catch { body = {}; }
  const userId = headerUserId ?? body.userId;
  if (!userId || typeof userId !== "string" || userId.length < 4) {
    return NextResponse.json({ ok: false, error: "userId required" }, { status: 400 });
  }
  try {
    const balance = await grantSignupSparks(userId);
    return NextResponse.json({
      ok: true,
      userId,
      balance: Number(balance),
      granted: SIGNUP_GRANT_SPARKS,
      note: "Idempotent · retries return current balance without granting again.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
