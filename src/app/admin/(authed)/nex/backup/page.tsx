// /admin/nex/backup — Backup & Restore dashboard.
// Shows last backup, history, restore attempts, and the buttons to
// run/download/restore.

import Link from "next/link";
import { listBackups, listRestoreAttempts } from "@/lib/nex/backup";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BackupDashboard } from "@/components/admin/nex/BackupDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nex Backup · Admin", robots: { index: false } };

export default async function Page() {
  const [backups, restores] = await Promise.all([listBackups(20), listRestoreAttempts(10)]);
  const lastComplete = backups.find((b) => b.status === "complete") ?? null;

  const { count: totalBackups = 0 } = await supabaseAdmin
    .from("hammerex_nex_backup_runs")
    .select("*", { count: "exact", head: true })
    .eq("status", "complete");

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Backup and restore</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Enterprise disaster recovery for the Nex brain. Nothing here overwrites production without a pre-snapshot + confirmation.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/health"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Health</Link>
          </div>
        </div>

        <BackupDashboard
          lastComplete={lastComplete}
          totalBackups={totalBackups ?? 0}
          backups={backups}
          restores={restores}
        />
      </div>
    </div>
  );
}
