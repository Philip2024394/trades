// GET /api/cron/family-safety-age-transition
//
// Daily sweep · finds `nex.parent_custody_link` rows past `auto_transfer_at`
// where neither `transferred_at` nor `revoked_at` is set, and performs
// the atomic transfer (child takes custody of their own account) +
// writes the sealed audit entry per row.
//
// Idempotent · re-runs find nothing to transfer. Simulated=TRUE by
// default · see sealed `age-transition-service.sweepPendingTransitions`.
//
// Gated by `CRON_SECRET` matching a bearer token so this route is only
// callable by the Vercel Cron scheduler. Registered in vercel.json.
//
// See doctrine:
//   docs/doctrine/nex-family-safety-age-transition-2026-10-11.md

import { NextResponse } from "next/server";
import { sweepPendingTransitions } from "@/lib/nex-native/family-safety/age-transition-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (secret && bearer !== secret) {
    return NextResponse.json(
      { ok: false, error: "not-authorised" },
      { status: 401 },
    );
  }

  try {
    const result = await sweepPendingTransitions(new Date().toISOString());
    console.log("[cron/family-safety-age-transition] result:", result);
    return NextResponse.json({
      ok: true,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/family-safety-age-transition] threw:", err);
    return NextResponse.json(
      { ok: false, error: "internal", detail: String(err) },
      { status: 500 },
    );
  }
}
