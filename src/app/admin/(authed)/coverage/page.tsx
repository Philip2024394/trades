// /admin/coverage — Coverage Map + City Launch table.
//
// Founder view: "where do I have liquidity, where do I need to recruit next?"
// Reads: hammerex_city_launches + hammerex_events (via loadCoverageStats).

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin, TrendingUp, Users } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { loadCityLaunches, loadCoverageStats } from "@/lib/cityLaunch/engine";
import { CityLaunchComposer } from "./CityLaunchComposer";
import { CityStatusPill } from "./CityStatusPill";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

export default async function CoveragePage() {
  const auth = await assertAdminRole(["admin", "analyst"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/coverage");

  const [launches, coverage] = await Promise.all([
    loadCityLaunches(),
    loadCoverageStats(30)
  ]);

  const totalDemand   = coverage.reduce((s, r) => s + r.demandCount,  0);
  const totalSupply   = coverage.reduce((s, r) => s + r.supplyCount,  0);
  const totalMatches  = coverage.reduce((s, r) => s + r.matchCount,   0);
  const tracked       = new Set(launches.map(l => l.city_slug.toLowerCase()));
  const untrackedHot  = coverage.filter(c => c.demandCount > 0 && !tracked.has(c.city.toLowerCase())).slice(0, 8);

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={11}/> Network Health
        </Link>
        <div className="mt-3 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>City Launch Engine</p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
            <MapPin size={22}/> Coverage Map
          </h1>
          <p className="mt-1 text-[12px] text-neutral-600">
            Where you have liquidity, where you need to recruit. 30-day window.
          </p>
        </div>

        {/* Row 1 · Headline */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeadlineTile label="Cities in ladder"   value={launches.length}/>
          <HeadlineTile label="Demand · 30d"       value={totalDemand}/>
          <HeadlineTile label="Supply signals · 30d" value={totalSupply}/>
          <HeadlineTile label="Matches · 30d"      value={totalMatches}/>
        </div>

        {/* Row 2 · City ladder */}
        <section className="mt-6 rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">City ladder</p>
            <span className="text-[10.5px] text-neutral-500">Founder-tracked launches</span>
          </div>
          {launches.length === 0 ? (
            <p className="rounded-lg bg-neutral-50 p-3 text-[11.5px] text-neutral-600">No cities in the ladder yet. Add one below to start tracking.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    <th className="pb-2 pr-3">City</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3 text-right">Target trades</th>
                    <th className="pb-2 pr-3 text-right">Demand 30d</th>
                    <th className="pb-2 pr-3 text-right">Matches 30d</th>
                    <th className="pb-2 pr-3">Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {launches.map((l) => {
                    const stats = coverage.find(c => c.city.toLowerCase() === l.city_slug.toLowerCase());
                    return (
                      <tr key={l.id} className="border-t border-neutral-100">
                        <td className="py-2 pr-3 font-black text-neutral-900">{l.city_display}</td>
                        <td className="py-2 pr-3"><CityStatusPill citySlug={l.city_slug} status={l.status}/></td>
                        <td className="py-2 pr-3 text-right tabular-nums text-neutral-800">{l.target_trades_total ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-neutral-800">{stats?.demandCount ?? 0}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-neutral-800">{stats?.matchCount ?? 0}</td>
                        <td className="py-2 pr-3 text-neutral-700">{l.next_step ?? <span className="text-neutral-400">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Row 3 · Untracked demand — recruit-list generator */}
        <section className="mt-6 rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="mb-3 flex items-baseline gap-2">
            <TrendingUp size={14} className="text-neutral-500"/>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">Untracked demand · candidates</p>
          </div>
          {untrackedHot.length === 0 ? (
            <p className="rounded-lg bg-neutral-50 p-3 text-[11.5px] text-neutral-600">
              All cities with demand are in your ladder. Nothing to add.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {untrackedHot.map(c => (
                <li key={c.city} className="flex items-center justify-between rounded-lg border border-neutral-100 p-2.5">
                  <div>
                    <p className="text-[12.5px] font-black text-neutral-900">{c.city}</p>
                    <p className="text-[10.5px] text-neutral-500">
                      {c.demandCount} demand · {c.supplyCount} supply · {c.matchCount} matches
                    </p>
                  </div>
                  <a
                    href={`#composer-${c.city}`}
                    className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                  >Add to ladder →</a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Row 4 · Composer */}
        <section className="mt-6 rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="mb-3 flex items-baseline gap-2">
            <Users size={14} className="text-neutral-500"/>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">Add / update city launch</p>
          </div>
          <CityLaunchComposer/>
        </section>
      </div>
    </main>
  );
}

function HeadlineTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-neutral-500">{label}</p>
      <p className="mt-1 text-[22px] font-black tabular-nums text-neutral-900">{value.toLocaleString("en-GB")}</p>
    </div>
  );
}
