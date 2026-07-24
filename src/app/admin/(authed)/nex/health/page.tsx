// /admin/nex/health — Knowledge Health dashboard.
// Per-trade coverage. Reveals where Nex is weak.

import Link from "next/link";
import { readHealth } from "@/lib/nex/intelligence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge Health · Admin", robots: { index: false } };

export default async function Page() {
  const rows = await readHealth();
  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Where Nex is weak</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Anything under 80% needs more knowledge. Teach Nex to close the gap.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/review"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Review queue</Link>
          </div>
        </div>

        {rows.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-[13px] text-neutral-500">No knowledge yet. Add some in the Knowledge Studio.</div>
        )}

        <div className="space-y-3">
          {rows.map((r) => {
            const cls = r.health_pct >= 80 ? "bg-green-500" : r.health_pct >= 50 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={r.trade} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[16px] font-black capitalize">{r.trade}</p>
                  <p className="text-[18px] font-black">{r.health_pct}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div className={"h-full transition-all " + cls} style={{ width: `${r.health_pct}%` }}/>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-[11px] text-neutral-600 sm:grid-cols-6">
                  <Stat label="Published"       value={r.published}/>
                  <Stat label="Official"        value={r.official}/>
                  <Stat label="Company"         value={r.company}/>
                  <Stat label="High-confidence" value={r.high_confidence}/>
                  <Stat label="Unsourced"       value={r.unsourced} warn={r.unsourced > 0}/>
                  <Stat label="Outdated"        value={r.outdated}  warn={r.outdated > 0}/>
                </div>
                <p className="mt-2 text-[10px] text-neutral-500">Last updated {new Date(r.last_updated).toLocaleString("en-GB")}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={"mt-0.5 font-black " + (warn ? "text-red-700" : "text-neutral-900")}>{value}</p>
    </div>
  );
}
