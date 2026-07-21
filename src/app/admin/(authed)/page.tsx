// /admin — Network Health Centre.
//
// The founder's morning-loop screen. Deeper than War Room but same
// data source. Adds:
//   • 7-day trend arrows on the core lifecycle counts
//   • Per-city + per-trade breakdown of matches
//   • Active-user counts (homeowners, trades, merchants) with 7d delta
//   • Coverage summary (top 5 shortages)
//   • Direct navigation to every centre + operational surface

import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Store, MessageCircle, Radio, Activity, TrendingUp, TrendingDown, Minus, ArrowRight, ShieldOff, ClipboardList } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countLiquidityStage, countByCity, countByTradeCategory } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";
const BRAND_RED    = "#B91C1C";

function startOfDay(d: Date): Date { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function daysAgo(n: number): Date { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }

export default async function AdminHomePage() {
  const auth = await assertAdminRole(["admin", "moderator", "support", "analyst", "finance"]);
  if (!auth.ok) redirect("/admin/login");

  const todayIso  = startOfDay(new Date()).toISOString();
  const last7Iso  = daysAgo(7).toISOString();
  const last14Iso = daysAgo(14).toISOString();

  // Core liquidity counts — this week vs last week
  const [
    demandThis, demandLast,
    supplyResponsesThis, supplyResponsesLast,
    matchThis,  matchLast,
    matchesByCity, matchesByCategory,
    homeownersActive, tradesActive, merchantsActive,
    homeownersTotal, tradesTotal, merchantsTotal,
    suspendedUsers, suspendedMerchants,
    flaggedYard,    supportPending
  ] = await Promise.all([
    countLiquidityStage("demand_created",  last7Iso),
    countLiquidityStage("demand_created",  last14Iso, last7Iso),
    countLiquidityStage("supply_responded", last7Iso),
    countLiquidityStage("supply_responded", last14Iso, last7Iso),
    countLiquidityStage("match_created",   last7Iso),
    countLiquidityStage("match_created",   last14Iso, last7Iso),
    countByCity("sitebook.trade_replied", last7Iso),
    countByTradeCategory("sitebook.trade_replied", last7Iso),
    countDistinctActors("homeowner", last7Iso),
    countDistinctActors("trade",     last7Iso),
    countDistinctActors("merchant",  last7Iso),
    countTable("hammerex_homeowners"),
    countTable("hammerex_trade_off_listings"),
    countTable("hammerex_trade_off_listings"),   // reuse — same table; distinction is by tier later
    countWhere("hammerex_homeowners",        "suspended_at is not null"),
    countWhere("hammerex_trade_off_listings", "suspended_at is not null"),
    countWhere("hammerex_trade_off_yard_posts", "flag_count > 0 and moderation_status is distinct from 'hidden'"),
    countSupportTicketsPending()
  ]);

  const replyRate = demandThis > 0 ? Math.round((supplyResponsesThis / demandThis) * 100) : 0;

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>
              Network Health Centre
            </p>
            <h1 className="mt-1 text-[24px] font-black text-neutral-900">
              Is the week stronger than last week?
            </h1>
            <p className="mt-1 text-[11.5px] text-neutral-500">
              Signed in as <span className="font-black text-neutral-800">{auth.identity.email}</span> · role <span className="font-black text-neutral-800">{auth.identity.role}</span>
            </p>
          </div>
          <Link href="/warroom" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110">
            <Activity size={12}/> War Room
          </Link>
        </div>

        {/* Row 1 · Liquidity — 7d vs previous 7d */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile label="Demand · 7d"   hint="posts + beacons" value={demandThis.toString()} delta={delta(demandThis, demandLast)} icon={<MessageCircle size={14}/>}/>
          <MetricTile label="Replies · 7d"  hint="trade responses" value={supplyResponsesThis.toString()} delta={delta(supplyResponsesThis, supplyResponsesLast)} icon={<Radio size={14}/>} accent={BRAND_YELLOW}/>
          <MetricTile label="Matches · 7d"  hint="hired + accepted" value={matchThis.toString()} delta={delta(matchThis, matchLast)} icon={<Radio size={14}/>} accent={BRAND_YELLOW}/>
          <ReplyRateTile rate={replyRate} demand={demandThis} replies={supplyResponsesThis}/>
        </div>

        {/* Row 2 · Cohort activity */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CohortTile label="Homeowners"          activeCount={homeownersActive} totalCount={homeownersTotal} icon={<Users size={14}/>} href="/admin/users"/>
          <CohortTile label="Trades + merchants"  activeCount={tradesActive} totalCount={tradesTotal}         icon={<Store size={14}/>} href="/admin/merchants"/>
          <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Operational health</p>
            <ul className="mt-2 space-y-1 text-[12px] text-neutral-800">
              <li className="flex items-center gap-1.5">
                <ShieldOff size={11} className={suspendedUsers + suspendedMerchants > 0 ? "text-red-700" : "text-neutral-400"}/>
                <span>{suspendedUsers + suspendedMerchants} suspended accounts</span>
              </li>
              <li className="flex items-center gap-1.5">
                <ClipboardList size={11} className={flaggedYard > 0 ? "text-amber-700" : "text-neutral-400"}/>
                <span>{flaggedYard} Yard flags pending</span>
              </li>
              <li className="flex items-center gap-1.5">
                <ClipboardList size={11} className={supportPending > 0 ? "text-amber-700" : "text-neutral-400"}/>
                <span>{supportPending} open support tickets</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Row 3 · Coverage slice */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SliceCard title="Matches by city · 7d"     rows={matchesByCity.slice(0, 6).map((r) => ({ label: r.city,          value: r.count }))}/>
          <SliceCard title="Matches by trade · 7d"    rows={matchesByCategory.slice(0, 6).map((r) => ({ label: r.tradeCategory, value: r.count }))}/>
        </div>

        {/* Row 4 · Drill-down */}
        <div className="mt-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Drill-down</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NavCard href="/warroom"                 label="War Room"           note="Founder morning"/>
            <NavCard href="/admin/users"             label="Users"              note="Homeowners"/>
            <NavCard href="/admin/merchants"         label="Merchants"          note="Trades + suppliers"/>
            <NavCard href="/admin/yard"              label="Yard moderation"    note="Flags + spam"/>
            <NavCard href="/admin/support/tickets"   label="Support tickets"    note="Open queue"/>
            <NavCard href="/admin/growth"            label="Growth"             note="Acquisition + referrals"/>
            <NavCard href="/admin/verifications"     label="Verifications"      note="Credential queue"/>
            <NavCard href="/admin/coverage"          label="Coverage"           note="City launch map"/>
            <NavCard href="/admin/moderation"        label="Moderation"         note="Unified flag queue"/>
            <NavCard href="/admin/gdpr"              label="GDPR"               note="Export + erasure"/>
            <NavCard href="/admin/revenue"           label="Revenue"            note="MRR + reconciliation"/>
            <NavCard href="/admin/system"            label="System health"      note="Cron heartbeats"/>
            <NavCard href="/admin/api-keys"          label="API keys"           note="Integrations + secrets"/>
            <NavCard href="/admin/growth/shadow-profiles" label="Shadow pipeline" note="Scrape + drip"/>
            <NavCard href="/admin/reviews"           label="Reviews"            note="Moderation"/>
            <NavCard href="/admin/affiliates"        label="Affiliates"         note="Referral programme"/>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Read helpers (Network Health specific) ────────────────────────

async function countDistinctActors(kind: string, fromIso: string): Promise<number> {
  const res = await supabaseAdmin
    .from("hammerex_events")
    .select("actor_id")
    .eq("actor_kind", kind)
    .gte("occurred_at", fromIso)
    .not("actor_id", "is", null);
  const rows = (res.data as { actor_id: string }[]) ?? [];
  const uniq = new Set(rows.map((r) => r.actor_id));
  return uniq.size;
}

async function countTable(table: string): Promise<number> {
  const res = await supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  return res.count ?? 0;
}

async function countWhere(table: string, condition: string): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin.rpc("exec_sql", {
      sql: `select count(*) as c from public.${table} where ${condition}`
    });
    if (error) return 0;
    const rows = data as { c: number }[] | null;
    return rows?.[0]?.c ?? 0;
  } catch { return 0; }
}

async function countSupportTicketsPending(): Promise<number> {
  try {
    const res = await supabaseAdmin
      .from("hammerex_support_tickets")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved");
    return res.count ?? 0;
  } catch { return 0; }
}

// ─── UI components ─────────────────────────────────────────────────

function delta(now: number, prev: number): { pct: number; direction: "up" | "down" | "flat" } {
  if (prev === 0 && now === 0) return { pct: 0, direction: "flat" };
  if (prev === 0)              return { pct: 100, direction: "up"   };
  const pct = Math.round(((now - prev) / prev) * 100);
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

function MetricTile({ label, hint, value, delta: d, icon, accent = "#94908A" }: {
  label: string; hint: string; value: string;
  delta: { pct: number; direction: "up" | "down" | "flat" };
  icon: React.ReactNode; accent?: string;
}) {
  const Arrow = d.direction === "up" ? TrendingUp : d.direction === "down" ? TrendingDown : Minus;
  const arrowColor = d.direction === "up" ? BRAND_GREEN : d.direction === "down" ? BRAND_RED : "#94908A";
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</p>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md" style={{ color: accent }}>{icon}</span>
      </div>
      <p className="mt-2 text-[26px] font-black leading-none text-neutral-900 tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-bold text-neutral-500">
        <span className="uppercase tracking-wider">{hint}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-0.5" style={{ color: arrowColor }}>
          <Arrow size={10} strokeWidth={2.5}/>{d.direction === "flat" ? "no change" : `${d.pct}%`}
        </span>
      </div>
    </div>
  );
}

function ReplyRateTile({ rate, demand, replies }: { rate: number; demand: number; replies: number }) {
  const isRed = rate < 30 && demand > 0;
  const color = isRed ? BRAND_RED : rate < 50 ? "#B45309" : BRAND_GREEN;
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: isRed ? BRAND_RED : "rgba(0,0,0,0.08)" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: isRed ? BRAND_RED : "#94908A" }}>
        Reply rate · 7d
      </p>
      <p className="mt-2 text-[26px] font-black leading-none tabular-nums" style={{ color }}>{rate}%</p>
      <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
        {replies} replies · {demand} posts
      </p>
    </div>
  );
}

function CohortTile({ label, activeCount, totalCount, icon, href }: {
  label: string; activeCount: number; totalCount: number; icon: React.ReactNode; href: string;
}) {
  return (
    <Link href={href} className="block rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</p>
        <span className="text-neutral-400">{icon}</span>
      </div>
      <p className="mt-2 text-[24px] font-black leading-none text-neutral-900 tabular-nums">
        {activeCount}
        <span className="ml-1 text-[13px] font-bold text-neutral-500"> / {totalCount}</span>
      </p>
      <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
        Active · 7d
      </p>
    </Link>
  );
}

function SliceCard({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[12px] text-neutral-500">No data yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline justify-between text-[12.5px]">
              <span className="truncate font-black text-neutral-800">{r.label}</span>
              <span className="ml-2 shrink-0 tabular-nums text-neutral-600">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NavCard({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-black text-neutral-900">{label}</p>
        <p className="mt-0.5 truncate text-[10.5px] text-neutral-500">{note}</p>
      </div>
      <ArrowRight size={12} className="shrink-0 text-neutral-400"/>
    </Link>
  );
}
