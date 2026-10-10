// GET /api/cron/safechat-retention-sweep
//
// Daily sweep · deletes `nex.safechat_classification` rows older than
// `NEX_SAFECHAT_RETENTION_DAYS` (default 30). Idempotent · re-runs
// find nothing to delete past the first sweep of the day.
//
// Honest no-op path · if the SafeChat Phase 1 logging flag is OFF
// (default), no new classifications are being written, so the sweep
// still runs but typically deletes zero rows. The sweep is safe to
// run regardless of flag state.
//
// Gated by `CRON_SECRET` matching a bearer token so this route is only
// callable by the Vercel Cron scheduler. Registered in vercel.json.
//
// See doctrine:
//   docs/doctrine/nex-safechat-privacy-audit-evidence-2026-10-10.md

import { NextResponse } from "next/server";
import { sweepClassificationsOlderThan } from "@/lib/nex-native/safechat/retention-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveRetentionDays(): number {
  const raw = Number(process.env.NEX_SAFECHAT_RETENTION_DAYS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 365) return Math.floor(raw);
  return 30;
}

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
    const retentionDays = resolveRetentionDays();
    const result = await sweepClassificationsOlderThan({ retentionDays });
    console.log("[cron/safechat-retention-sweep] result:", result);
    return NextResponse.json({
      ok: true,
      retentionDays,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/safechat-retention-sweep] threw:", err);
    return NextResponse.json(
      { ok: false, error: "internal", detail: String(err) },
      { status: 500 },
    );
  }
}
