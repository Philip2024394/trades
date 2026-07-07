// /home/sites
//
// All sites the active entity is running. Foreman/owner surface.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  Building2,
  HardHat,
  Plus,
  MapPin,
  Info
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sites · My Notebook" };

const TYPE_LABEL: Record<string, string> = {
  renovation: "Renovation",
  new_build: "New build",
  commercial: "Commercial",
  extension: "Extension",
  maintenance: "Maintenance"
};

export default async function SitesPage() {
  const party = await loadHomeownerSession();
  if (!party) redirect("/home/sign-in?next=/home/sites");

  const active = await loadActiveMembership();
  if (!active) redirect("/home/entity");

  // Load sites + engagement counts + committed spend per site.
  const { data: sites } = await supabaseAdmin
    .from("os_sites")
    .select(
      "id, name, site_type, status, address_line_1, postcode, started_at, estimated_completion_at, created_at"
    )
    .eq("owner_entity_id", active.entity_id)
    .in("status", ["planned", "active", "on_hold"])
    .order("created_at", { ascending: false });

  const siteIds = (sites ?? []).map((s) => s.id);
  const { data: engagements } = siteIds.length
    ? await supabaseAdmin
        .from("os_site_engagements")
        .select("id, site_id, agreed_price_pence, status")
        .in("site_id", siteIds)
    : { data: [] };

  const spendBySite = new Map<string, { count: number; committed: number }>();
  for (const e of engagements ?? []) {
    const cur = spendBySite.get(e.site_id) ?? { count: 0, committed: 0 };
    cur.count += 1;
    if (e.status !== "cancelled" && e.agreed_price_pence) {
      cur.committed += e.agreed_price_pence;
    }
    spendBySite.set(e.site_id, cur);
  }

  const showEmptyState = !sites || sites.length === 0;

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.12) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            My Notebook
          </Link>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            Foreman Mode
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
              <HardHat className="h-3 w-3" aria-hidden />
              {active.entity.display_name}
            </p>
            <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight md:text-[36px]">
              Sites.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-[1.55] text-[#1B1A17]/70">
              A site is where sub-trades work over time. Every hire, every
              price, every deposit &mdash; captured to the site record.
            </p>
          </div>
          <Link
            href="/home/sites/new"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-bold text-neutral-900 hover:bg-amber-300"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New site
          </Link>
        </div>

        {showEmptyState ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#1B1A17]/15 p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-[#1B1A17]/35" aria-hidden />
            <p className="mt-3 text-[14px] text-[#1B1A17]/70">
              No sites yet. Start with your current project — you can add
              sub-trade hires as you go.
            </p>
            <Link
              href="/home/sites/new"
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create your first site
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 md:grid-cols-2">
            {sites.map((s) => {
              const spend = spendBySite.get(s.id) ?? { count: 0, committed: 0 };
              return (
                <li key={s.id}>
                  <Link
                    href={`/home/sites/${s.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-5 transition hover:border-amber-400/40 hover:bg-[#1B1A17]/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-bold text-[#1B1A17] group-hover:text-amber-200">
                          {s.name}
                        </div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-wider text-[#1B1A17]/55">
                          {TYPE_LABEL[s.site_type] ?? s.site_type}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          s.status === "active"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : s.status === "on_hold"
                              ? "bg-amber-400/15 text-amber-200"
                              : "bg-[#1B1A17]/5 text-[#1B1A17]/60"
                        }`}
                      >
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    {s.postcode ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-[12px] text-[#1B1A17]/55">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {s.address_line_1 ? `${s.address_line_1} · ` : ""}
                        {s.postcode}
                      </p>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between border-t border-[#1B1A17]/12 pt-4 text-[12px]">
                      <span className="text-[#1B1A17]/55">
                        {spend.count}{" "}
                        engagement{spend.count === 1 ? "" : "s"}
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        £{(spend.committed / 100).toLocaleString("en-GB")}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-10 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-[13px] text-[#1B1A17]/70">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <p>
            Sites belong to <b className="text-[#1B1A17]">{active.entity.display_name}</b>.
            Switch entity in the top-right to see a different context.
          </p>
        </div>
      </div>
    </main>
  );
}
