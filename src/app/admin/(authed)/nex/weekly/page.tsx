// /admin/nex/weekly — the Monday-morning briefing.
// Reads the most recent hammerex_nex_weekly_reports row.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly Report · Admin", robots: { index: false } };

export default async function Page() {
  const { data: rows } = await supabaseAdmin
    .from("hammerex_nex_weekly_reports")
    .select("*")
    .order("week_starting", { ascending: false })
    .limit(8);

  const latest = rows?.[0];

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Weekly report</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Monday-morning summary. Cron writes rows; nothing here is emailed yet.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/review"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Review</Link>
            <Link href="/admin/nex/health"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Health</Link>
          </div>
        </div>

        {!latest && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-[13px] text-neutral-500">
            No weekly report yet. The cron writes one every Monday. Trigger it via <span className="font-mono">GET /api/cron/nex-weekly-report</span>.
          </div>
        )}

        {latest && (
          <div className="rounded-2xl border border-neutral-900 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Week starting {latest.week_starting}</p>
            {latest.greeting_md && <pre className="mt-3 whitespace-pre-wrap font-sans text-[13px] text-neutral-800">{latest.greeting_md}</pre>}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Pending"  value={latest.pending_reviews}       highlight={latest.pending_reviews > 0 ? "amber" : "grey"}/>
              <Stat label="Approved" value={latest.approved_this_week}    highlight="green"/>
              <Stat label="Rejected" value={latest.rejected_this_week}    highlight={latest.rejected_this_week > 0 ? "red" : "grey"}/>
              <Stat label="New entries" value={latest.new_entries_this_week} highlight="black"/>
            </div>
            {latest.pending_reviews > 0 && (
              <Link href="/admin/nex/review" className="mt-4 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-4 py-2 text-[12px] font-black text-white">
                Review {latest.pending_reviews} pending →
              </Link>
            )}
          </div>
        )}

        {rows && rows.length > 1 && (
          <>
            <p className="mt-6 mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">Previous weeks</p>
            <div className="space-y-2">
              {rows.slice(1).map((r) => (
                <div key={r.week_starting} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-[12px]">
                  <p className="w-24 font-black">{r.week_starting}</p>
                  <p className="flex-1 text-neutral-600">
                    {r.new_entries_this_week} new · {r.approved_this_week} approved · {r.rejected_this_week} rejected
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">{r.pending_reviews} pending</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight: "black" | "green" | "amber" | "red" | "grey" }) {
  const cls =
    highlight === "black" ? "bg-neutral-900 text-white" :
    highlight === "green" ? "bg-green-100 text-green-800" :
    highlight === "amber" ? "bg-amber-100 text-amber-800" :
    highlight === "red"   ? "bg-red-100 text-red-800" :
                             "bg-neutral-100 text-neutral-700";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={"mt-1 inline-block rounded-full px-3 py-0.5 text-[16px] font-black " + cls}>{value}</p>
    </div>
  );
}
