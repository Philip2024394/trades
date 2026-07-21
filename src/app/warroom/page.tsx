// /warroom — the founder's single-page morning glance.
//
// Not another dashboard. One page. 10-second read.
//
// Composes Analytics Engine + Liquidity Engine read helpers. RBAC:
// admin + analyst + finance can see the whole thing. Moderator +
// support see nothing here (redirect back to their queues).
//
// Everything else is drill-down from here.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus, MapPin, Wrench, Radio,
  Users, DollarSign, MessageCircle, ArrowRight, AlertTriangle
} from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import {
  countLiquidityStage,
  sumRevenuePence,
  countByCity,
  countByTradeCategory,
  topAcquisitionChannel
} from "@/lib/analytics/track";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";
const BRAND_RED    = "#B91C1C";

function startOfDay(d: Date): Date { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function daysAgo(n: number): Date { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }
function formatGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(pence / 100);
}

export default async function WarRoomPage() {
  const auth = await assertAdminRole(["admin", "analyst", "finance"]);
  if (!auth.ok) redirect(`/admin/login?next=/warroom`);

  const todayIso     = startOfDay(new Date()).toISOString();
  const yesterdayIso = startOfDay(daysAgo(1)).toISOString();
  const last7Iso     = daysAgo(7).toISOString();

  // Fire every read in parallel — War Room is a hot read path.
  const [
    demandToday,      demandYesterday,
    supplyToday,      supplyYesterday,
    matchesToday,     matchesYesterday,
    revenueToday,     revenueYesterday,
    matchesByCity,    matchesByCat,
    firstRepliesToday, demandForLatency,
    topChannel,       criticalAlerts
  ] = await Promise.all([
    countLiquidityStage("demand_created",  todayIso),
    countLiquidityStage("demand_created",  yesterdayIso, todayIso),
    countLiquidityStage("supply_available",todayIso),
    countLiquidityStage("supply_available",yesterdayIso, todayIso),
    countLiquidityStage("match_created",   todayIso),
    countLiquidityStage("match_created",   yesterdayIso, todayIso),
    sumRevenuePence(todayIso),
    sumRevenuePence(yesterdayIso, todayIso),
    countByCity("sitebook.trade_replied",  last7Iso),
    countByTradeCategory("sitebook.trade_replied", last7Iso),
    countLiquidityStage("supply_responded", todayIso),
    countLiquidityStage("demand_created",   todayIso),
    topAcquisitionChannel(last7Iso),
    loadCriticalAlerts()
  ]);

  // Derived — reply rate today (matched / demanded)
  const replyRate = demandForLatency > 0
    ? Math.round((firstRepliesToday / demandForLatency) * 100)
    : 0;

  // Best / worst city + trade category from last-7-days replies
  const bestCity  = matchesByCity[0] ?? null;
  const worstCity = matchesByCity.length > 1 ? matchesByCity[matchesByCity.length - 1] : null;
  const bestCat   = matchesByCat[0]  ?? null;
  const worstCat  = matchesByCat.length > 1 ? matchesByCat[matchesByCat.length - 1] : null;

  return (
    <main className="min-h-screen bg-white p-6 sm:p-10">
      <div className="mx-auto max-w-6xl">
        {/* Header — brutal minimalism */}
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>War Room</p>
            <h1 className="mt-1 text-[28px] font-black leading-tight text-neutral-900">Is today better than yesterday?</h1>
            <p className="mt-1 text-[12px] text-neutral-500">
              Signed in as <span className="font-black text-neutral-800">{auth.identity.email}</span> · role <span className="font-black text-neutral-800">{auth.identity.role}</span>
            </p>
          </div>
          <Link href="/admin" className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
            Network Health →
          </Link>
        </div>

        {/* Row 1 · the 4 headline numbers */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigTile
            label="Demand today"
            hint="posts + beacons"
            value={demandToday.toString()}
            delta={delta(demandToday, demandYesterday)}
            icon={<MessageCircle size={16}/>}
          />
          <BigTile
            label="Supply today"
            hint="trades active"
            value={supplyToday.toString()}
            delta={delta(supplyToday, supplyYesterday)}
            icon={<Users size={16}/>}
          />
          <BigTile
            label="Matches today"
            hint="hires + accepts"
            value={matchesToday.toString()}
            delta={delta(matchesToday, matchesYesterday)}
            icon={<Radio size={16}/>}
            accent={BRAND_YELLOW}
          />
          <BigTile
            label="Revenue today"
            hint="net GBP"
            value={formatGbp(revenueToday)}
            delta={delta(revenueToday, revenueYesterday)}
            icon={<DollarSign size={16}/>}
            accent={BRAND_GREEN}
          />
        </div>

        {/* Row 2 · reply rate + best/worst */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ReplyRateTile rate={replyRate} count={firstRepliesToday} total={demandForLatency}/>
          <PairTile
            title="City"
            icon={<MapPin size={13}/>}
            best={bestCity  ? { label: bestCity.city,          value: `${bestCity.count} replies` }  : null}
            worst={worstCity ? { label: worstCity.city,         value: `${worstCity.count} replies` } : null}
          />
          <PairTile
            title="Trade category"
            icon={<Wrench size={13}/>}
            best={bestCat  ? { label: bestCat.tradeCategory,   value: `${bestCat.count} replies` }  : null}
            worst={worstCat ? { label: worstCat.tradeCategory,  value: `${worstCat.count} replies` } : null}
          />
        </div>

        {/* Row 3 · top acquisition + critical alerts */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Top acquisition channel · 7d</p>
            {topChannel ? (
              <>
                <p className="mt-2 text-[22px] font-black text-neutral-900">{topChannel.channel}</p>
                <p className="mt-0.5 text-[12px] text-neutral-600">{topChannel.count} signups</p>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-neutral-500">No attributed signups yet.</p>
            )}
          </div>

          <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: criticalAlerts.length > 0 ? BRAND_RED : "rgba(0,0,0,0.08)" }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: criticalAlerts.length > 0 ? BRAND_RED : "#94908A" }}>
                Critical alerts
              </p>
              {criticalAlerts.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-800">
                  <AlertTriangle size={11}/> {criticalAlerts.length}
                </span>
              )}
            </div>
            {criticalAlerts.length === 0 ? (
              <p className="text-[13px] text-neutral-500">All clear.</p>
            ) : (
              <ul className="space-y-1.5">
                {criticalAlerts.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-neutral-800">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BRAND_RED }}/>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Row 4 · drill-down shortcuts */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DrillLink href="/admin"          label="Network Health"/>
          <DrillLink href="/admin/coverage" label="Coverage Map"/>
          <DrillLink href="/admin/growth"   label="Growth Engine"/>
          <DrillLink href="/admin/revenue"  label="Revenue"/>
        </div>

        <p className="mt-6 text-center text-[10.5px] text-neutral-400">
          North star: `first_reply_latency_48h`. If this page reads red for 7 consecutive days, everything else is second priority.
        </p>
      </div>
    </main>
  );
}

// ─── Alerts loader ────────────────────────────────────────────────

async function loadCriticalAlerts(): Promise<string[]> {
  const alerts: string[] = [];

  // 1. Moderation queue depth (Yard flagged + image submissions pending)
  const flaggedRes = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id", { count: "exact", head: true })
    .gt("flag_count", 0)
    .neq("moderation_status", "hidden");
  const flagged = flaggedRes.count ?? 0;
  if (flagged > 10) alerts.push(`${flagged} Yard posts have unreviewed flags`);

  // 2. Support tickets unresolved > 24h (schema-agnostic — silent-fail-safe)
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const supportRes = await supabaseAdmin
      .from("hammerex_support_tickets")
      .select("id", { count: "exact", head: true })
      .lte("created_at", dayAgo)
      .neq("status", "resolved");
    const stuck = supportRes.count ?? 0;
    if (stuck > 0) alerts.push(`${stuck} support tickets unresolved > 24h`);
  } catch { /* table may not exist yet; silent */ }

  // 3. First-reply-latency alarm — no trade replies today when there was demand
  const todayIso = new Date();  todayIso.setHours(0,0,0,0);
  const demand = await countLiquidityStage("demand_created",  todayIso.toISOString());
  const reply  = await countLiquidityStage("supply_responded", todayIso.toISOString());
  if (demand >= 3 && reply === 0) {
    alerts.push(`${demand} posts today, ZERO trade replies — loop broken`);
  }

  return alerts;
}

// ─── Small components ─────────────────────────────────────────────

function delta(today: number, yesterday: number): { pct: number; direction: "up" | "down" | "flat" } {
  if (yesterday === 0 && today === 0) return { pct: 0,   direction: "flat" };
  if (yesterday === 0)                return { pct: 100, direction: "up"   };
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

function BigTile({
  label, hint, value, delta: d, icon, accent = "#94908A"
}: {
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
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-neutral-400" style={{ color: accent }}>{icon}</span>
      </div>
      <p className="mt-2 text-[28px] font-black leading-none text-neutral-900 tabular-nums">{value}</p>
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

function ReplyRateTile({ rate, count, total }: { rate: number; count: number; total: number }) {
  const isRed   = rate < 30 && total > 0;
  const isAmber = rate >= 30 && rate < 50;
  const isGreen = rate >= 50 || total === 0;
  const color   = isRed ? BRAND_RED : isAmber ? "#B45309" : BRAND_GREEN;
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: isRed ? BRAND_RED : "rgba(0,0,0,0.08)" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: isRed ? BRAND_RED : "#94908A" }}>
        First-reply rate · today
      </p>
      <p className="mt-2 text-[28px] font-black leading-none tabular-nums" style={{ color }}>{rate}%</p>
      <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
        {count} replies · {total} posts
      </p>
      {isRed && total > 0 && (
        <p className="mt-2 text-[11px] font-bold text-red-800">Loop is broken — investigate first.</p>
      )}
      {isGreen && total > 0 && (
        <p className="mt-2 text-[11px] font-bold" style={{ color: BRAND_GREEN }}>Loop is healthy.</p>
      )}
    </div>
  );
}

function PairTile({
  title, icon, best, worst
}: {
  title: string; icon: React.ReactNode;
  best:  { label: string; value: string } | null;
  worst: { label: string; value: string } | null;
}) {
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        {icon} {title} · 7d
      </p>
      <div className="space-y-1.5">
        <Row label="Best"  data={best}  positive/>
        <Row label="Worst" data={worst} positive={false}/>
      </div>
    </div>
  );
}

function Row({ label, data, positive }: { label: string; data: { label: string; value: string } | null; positive: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: positive ? BRAND_GREEN : BRAND_RED }}>{label}</span>
      {data ? (
        <span className="min-w-0 flex-1 text-right text-[12.5px] font-black text-neutral-900">
          <span className="truncate">{data.label}</span>
          <span className="ml-1 font-normal text-[10.5px] text-neutral-500">{data.value}</span>
        </span>
      ) : (
        <span className="text-[11px] text-neutral-400">no data yet</span>
      )}
    </div>
  );
}

function DrillLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-between rounded-xl border-2 bg-white px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      {label}
      <ArrowRight size={11} strokeWidth={2.5}/>
    </Link>
  );
}
