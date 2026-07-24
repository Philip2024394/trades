// GET /api/admin/nex/backup/list
// Returns recent backup runs + restore attempts + summary metrics.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { listBackups, listRestoreAttempts } from "@/lib/nex/backup";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const [backups, restores] = await Promise.all([listBackups(20), listRestoreAttempts(20)]);

  // Latest completed backup summary for the dashboard hero.
  const lastComplete = backups.find((b) => b.status === "complete") ?? null;

  const { count: totalBackups = 0 } = await supabaseAdmin
    .from("hammerex_nex_backup_runs")
    .select("*", { count: "exact", head: true })
    .eq("status", "complete");

  return NextResponse.json({
    ok:              true,
    backups,
    restores,
    last_complete:   lastComplete,
    total_backups:   totalBackups
  });
}
