// GET /api/cron/nex-backup-daily
// Auth: header 'x-cron-secret' must match CRON_SECRET env.
//
// Runs daily. Full backup on Sundays, incremental other days. Idempotent
// on re-invocation for the same day (dedup by created-today check).

import { NextResponse, type NextRequest } from "next/server";
import { createBackup, getLastCompleteBackup } from "@/lib/nex/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  // Dedup — skip if we already have a completed backup today.
  const last = await getLastCompleteBackup();
  if (last) {
    const lastDay = last.completed_at?.slice(0, 10);
    const today   = new Date().toISOString().slice(0, 10);
    if (lastDay === today && last.kind !== "pre_restore_snapshot") {
      return NextResponse.json({ ok: true, skipped: true, reason: "already_backed_up_today", last });
    }
  }

  const isSunday = new Date().getUTCDay() === 0;
  const kind: "full" | "incremental" = isSunday ? "full" : "incremental";

  const result = await createBackup({ kind, actor: "cron", notes: `Automated ${kind} backup` });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, run: result.run }, { status: 500 });
  return NextResponse.json({
    ok:         true,
    kind,
    run_id:     result.run.id,
    size_bytes: result.run.size_bytes
  });
}
