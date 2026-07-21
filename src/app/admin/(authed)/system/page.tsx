// /admin/system — System Health monitor.
//
// Every cron wraps its work in cronRun() from src/lib/cron/heartbeat.ts,
// which writes to hammerex_cron_runs. This page shows the last-run + 24h
// error tally for every job and flags jobs stale beyond their expected
// cadence (CRON_EXPECTED_CADENCE map).

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Activity, AlertOctagon, CheckCircle2 } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { loadCronHealth } from "@/lib/cron/heartbeat";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

export default async function SystemHealthPage() {
  const auth = await assertAdminRole(["admin", "analyst"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/system");

  const jobs = await loadCronHealth();
  const staleCount = jobs.filter(j => j.isStale).length;
  const errorJobs  = jobs.filter(j => j.totalErrors24h > 0).length;
  const healthy    = jobs.length - staleCount - errorJobs;

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={11}/> Network Health
        </Link>
        <div className="mt-3 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>System Health</p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
            <Activity size={22}/> Cron + jobs
          </h1>
          <p className="mt-1 text-[12px] text-neutral-600">
            Every cron run heartbeats hammerex_cron_runs. Stale = past expected cadence. Wrap new crons with cronRun() to appear here.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatChip label="Stale"    value={staleCount} colour="#B91C1C" icon={<AlertOctagon size={11}/>}/>
          <StatChip label="Errors 24h" value={errorJobs} colour="#F59E0B" icon={<AlertOctagon size={11}/>}/>
          <StatChip label="Healthy"  value={healthy}    colour="#166534" icon={<CheckCircle2 size={11}/>}/>
        </div>

        <section className="rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {jobs.length === 0 ? (
            <p className="rounded-lg bg-neutral-50 p-3 text-[11.5px] text-neutral-600">
              No cron heartbeats yet. Existing crons need wrapping in cronRun() to appear.
            </p>
          ) : (
            <ul className="space-y-2">
              {jobs.map(j => (
                <li key={j.jobName} className="rounded-lg border border-neutral-100 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[12.5px] font-black text-neutral-900">{j.jobName}</p>
                    <div className="flex items-center gap-2">
                      {j.isStale && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Stale</span>
                      )}
                      {j.lastStatus && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                          style={{ backgroundColor: statusColour(j.lastStatus) }}
                        >{j.lastStatus}</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[10.5px] text-neutral-500 tabular-nums">
                    Last run: {j.lastRunAt ? new Date(j.lastRunAt).toLocaleString("en-GB") : "never"}
                    {j.lastDurationMs !== null && <> · {j.lastDurationMs.toLocaleString("en-GB")}ms</>}
                    {j.expectedCadenceS !== null && <> · expected every {formatCadence(j.expectedCadenceS)}</>}
                    {j.totalErrors24h > 0 && <> · <span className="font-black text-red-700">{j.totalErrors24h} errors last 24h</span></>}
                  </p>
                  {j.lastSummary && <p className="mt-1 text-[11px] text-neutral-700">"{j.lastSummary}"</p>}
                  {j.lastError    && <p className="mt-1 rounded-lg bg-red-50 p-2 text-[11px] italic text-red-800">{j.lastError}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function statusColour(s: string): string {
  if (s === "success") return "#166534";
  if (s === "error")   return "#B91C1C";
  if (s === "running") return "#F59E0B";
  return "#6B7280";
}

function formatCadence(s: number): string {
  if (s % 86400 === 0) return `${s / 86400}d`;
  if (s % 3600  === 0) return `${s / 3600}h`;
  return `${s}s`;
}

function StatChip({ label, value, colour, icon }: { label: string; value: number; colour: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 bg-white p-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: colour }}>
        {icon} {label}
      </p>
      <p className="mt-0.5 text-[16px] font-black tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}
