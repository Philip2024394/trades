// /admin/growth — Growth Engine Centre.
//
// Composes Analytics + Referral engines. Every chart answers
// "what should we do next?" — no vanity metrics.
//
// v1 shows:
//   * Acquisition funnel (this week)
//   * Referral programme performance (mref + affiliate)
//   * Shadow-scrape claim funnel
//   * Signup source breakdown
//   * Activation rate (signup → first meaningful action)
//   * City launch performance

import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Minus, ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countEvents, topAcquisitionChannel } from "@/lib/analytics/track";
import { topReferrers, referralFunnel } from "@/lib/referral/engine";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

function daysAgo(n: number): Date { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }

export default async function AdminGrowthPage() {
  const auth = await assertAdminRole(["admin", "analyst"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/growth");

  const last7Iso  = daysAgo(7).toISOString();
  const last14Iso = daysAgo(14).toISOString();
  const last30Iso = daysAgo(30).toISOString();

  const [
    homeownerSignups7, homeownerSignups14,
    tradeSignups7,     tradeSignups14,
    merchantSignups7,  merchantSignups14,
    firstPost7,        firstReply7,
    topChannel,
    mrefFunnel,        affiliateFunnel,
    mrefTop,           affiliateTop,
    shadowFunnel,
    cityStats
  ] = await Promise.all([
    countEvents("homeowner.signup", last7Iso),
    countEvents("homeowner.signup", last14Iso, last7Iso),
    countEvents("trade.signup",     last7Iso),
    countEvents("trade.signup",     last14Iso, last7Iso),
    countEvents("merchant.signup",  last7Iso),
    countEvents("merchant.signup",  last14Iso, last7Iso),
    countEvents("sitebook.post_created", last7Iso),
    countEvents("sitebook.trade_replied", last7Iso),
    topAcquisitionChannel(last30Iso),
    referralFunnel("mref",      last30Iso),
    referralFunnel("affiliate", last30Iso),
    topReferrers("mref",      last30Iso, 5),
    topReferrers("affiliate", last30Iso, 5),
    loadShadowFunnel(last30Iso),
    loadCityStats(last30Iso)
  ]);

  const totalSignups7  = homeownerSignups7  + tradeSignups7  + merchantSignups7;
  const totalSignups14 = homeownerSignups14 + tradeSignups14 + merchantSignups14;
  const activationRate = totalSignups7 > 0 ? Math.round((firstPost7 / totalSignups7) * 100) : 0;

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
              <ArrowLeft size={11}/> Network Health
            </Link>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>Growth Engine</p>
            <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
              <Rocket size={22}/> What should we do next?
            </h1>
          </div>
        </div>

        {/* Row 1 · Acquisition funnel */}
        <Section title="Acquisition · 7d">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FunnelStep label="Signups"      value={totalSignups7}  delta={delta(totalSignups7, totalSignups14)}/>
            <FunnelStep label="First post"   value={firstPost7}     delta={{ pct: 0, direction: "flat" }}/>
            <FunnelStep label="First reply"  value={firstReply7}    delta={{ pct: 0, direction: "flat" }}/>
            <FunnelStep label="Activation"   value={`${activationRate}%`} delta={{ pct: 0, direction: "flat" }} accent={activationRate >= 40 ? BRAND_GREEN : "#94908A"}/>
          </div>
        </Section>

        {/* Row 2 · Signup breakdown */}
        <Section title="Signup source · 7d">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FunnelStep label="Homeowners" value={homeownerSignups7} delta={delta(homeownerSignups7, homeownerSignups14)}/>
            <FunnelStep label="Trades"     value={tradeSignups7}     delta={delta(tradeSignups7,     tradeSignups14)}/>
            <FunnelStep label="Merchants"  value={merchantSignups7}  delta={delta(merchantSignups7,  merchantSignups14)}/>
          </div>
          <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-[12px] text-neutral-700">
            <span className="font-black uppercase tracking-wider text-[9.5px] text-neutral-500">Top channel · 30d</span>{" "}
            {topChannel ? (
              <>
                <span className="font-black text-neutral-900">{topChannel.channel}</span> · {topChannel.count} signups
              </>
            ) : (
              <span className="text-neutral-500">No attributed signups yet.</span>
            )}
          </div>
        </Section>

        {/* Row 3 · Referral programmes */}
        <Section title="Referral programmes · 30d">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReferralCard title="Merchant → merchant (mref)" funnel={mrefFunnel} topRows={mrefTop}/>
            <ReferralCard title="Affiliate partner"          funnel={affiliateFunnel} topRows={affiliateTop}/>
          </div>
        </Section>

        {/* Row 4 · Shadow-scrape funnel */}
        <Section title="Shadow-scraper claim funnel · 30d">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <FunnelStep label="Scraped"  value={shadowFunnel.scraped}  delta={{ pct: 0, direction: "flat" }}/>
            <FunnelStep label="Sent"     value={shadowFunnel.sent}     delta={{ pct: 0, direction: "flat" }}/>
            <FunnelStep label="Opened"   value={shadowFunnel.opened}   delta={{ pct: 0, direction: "flat" }}/>
            <FunnelStep label="Claimed"  value={shadowFunnel.claimed}  delta={{ pct: 0, direction: "flat" }} accent={BRAND_GREEN}/>
          </div>
          {shadowFunnel.scraped === 0 && (
            <p className="mt-2 text-[11.5px] text-neutral-500">
              Companies-House pipeline hasn&rsquo;t written events yet. Set POSTMARK_SERVER_TOKEN + COMPANIES_HOUSE_API_KEY to activate.
            </p>
          )}
        </Section>

        {/* Row 5 · City launch performance */}
        <Section title="City launch performance · 30d">
          {cityStats.length === 0 ? (
            <p className="text-[12px] text-neutral-500">No city activity yet. First city launch expected in Manchester per roadmap.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <table className="w-full text-[12px]">
                <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left">City</th>
                    <th className="px-3 py-2 text-right">Signups</th>
                    <th className="px-3 py-2 text-right">Posts</th>
                    <th className="px-3 py-2 text-right">Replies</th>
                    <th className="px-3 py-2 text-right">Reply rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                  {cityStats.map((c) => (
                    <tr key={c.city}>
                      <td className="px-3 py-2 font-black text-neutral-900">{c.city}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.signups}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.posts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.replies}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-black" style={{ color: c.replyRate >= 50 ? BRAND_GREEN : c.replyRate >= 30 ? "#B45309" : "#B91C1C" }}>
                        {c.replyRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NavCard href="/admin/coverage"        label="Coverage Map"        note="Where to recruit"/>
          <NavCard href="/admin/revenue"         label="Revenue Centre"       note="MRR + churn"/>
          <NavCard href="/admin/growth/shadow-profiles" label="Shadow pipeline" note="Companies House drip"/>
          <NavCard href="/admin/affiliates"      label="Affiliates"           note="Partner programme"/>
        </div>
      </div>
    </main>
  );
}

// ─── Data loaders ──────────────────────────────────────────────────

async function loadShadowFunnel(fromIso: string): Promise<{ scraped: number; sent: number; opened: number; claimed: number }> {
  try {
    const [scraped, sent, opened, claimed] = await Promise.all([
      countEvents("shadow.merchant_scraped",  fromIso),
      countEvents("shadow.email_sent",         fromIso),
      countEvents("shadow.email_opened",       fromIso),
      countEvents("shadow.merchant_claimed",   fromIso)
    ]);
    return { scraped, sent, opened, claimed };
  } catch { return { scraped: 0, sent: 0, opened: 0, claimed: 0 }; }
}

async function loadCityStats(fromIso: string): Promise<Array<{ city: string; signups: number; posts: number; replies: number; replyRate: number }>> {
  const res = await supabaseAdmin
    .from("hammerex_events")
    .select("city, event_slug")
    .gte("occurred_at", fromIso)
    .not("city", "is", null)
    .in("event_slug", ["homeowner.signup", "trade.signup", "sitebook.post_created", "sitebook.trade_replied"]);
  const rows = (res.data as { city: string | null; event_slug: string }[]) ?? [];
  const map = new Map<string, { signups: number; posts: number; replies: number }>();
  for (const r of rows) {
    if (!r.city) continue;
    const c = map.get(r.city) ?? { signups: 0, posts: 0, replies: 0 };
    if (r.event_slug === "homeowner.signup" || r.event_slug === "trade.signup") c.signups += 1;
    if (r.event_slug === "sitebook.post_created")   c.posts   += 1;
    if (r.event_slug === "sitebook.trade_replied")  c.replies += 1;
    map.set(r.city, c);
  }
  return Array.from(map.entries())
    .map(([city, s]) => ({ city, ...s, replyRate: s.posts > 0 ? Math.round((s.replies / s.posts) * 100) : 0 }))
    .sort((a, b) => b.signups - a.signups)
    .slice(0, 10);
}

// ─── UI ────────────────────────────────────────────────────────────

function delta(now: number, prev: number): { pct: number; direction: "up" | "down" | "flat" } {
  if (prev === 0 && now === 0) return { pct: 0, direction: "flat" };
  if (prev === 0)              return { pct: 100, direction: "up"   };
  const pct = Math.round(((now - prev) / prev) * 100);
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</p>
      {children}
    </div>
  );
}

function FunnelStep({ label, value, delta: d, accent = "#0A0A0A" }: { label: string; value: number | string; delta: { pct: number; direction: "up" | "down" | "flat" }; accent?: string }) {
  const Arrow = d.direction === "up" ? TrendingUp : d.direction === "down" ? TrendingDown : Minus;
  const arrowColor = d.direction === "up" ? "#166534" : d.direction === "down" ? "#B91C1C" : "#94908A";
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <p className="mt-2 text-[24px] font-black leading-none tabular-nums" style={{ color: accent }}>{value}</p>
      <p className="mt-1 flex items-center gap-1 text-[10.5px] font-bold" style={{ color: arrowColor }}>
        <Arrow size={10} strokeWidth={2.5}/>{d.direction === "flat" ? "no change" : `${d.pct}% vs prev`}
      </p>
    </div>
  );
}

function ReferralCard({ title, funnel, topRows }: {
  title: string;
  funnel: { attributed: number; activated: number; paid: number };
  topRows: Array<{ referrerId: string; referrerSlug: string | null; signups: number; activated: number; paidRewards: number }>;
}) {
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <MiniStat label="Signups"   value={funnel.attributed}/>
        <MiniStat label="Activated" value={funnel.activated}/>
        <MiniStat label="Paid"      value={funnel.paid}/>
      </div>
      {topRows.length > 0 && (
        <>
          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-neutral-500">Top referrers</p>
          <ul className="mt-1 space-y-1">
            {topRows.map((r) => (
              <li key={r.referrerId} className="flex items-baseline justify-between text-[11.5px]">
                <span className="truncate font-black text-neutral-800">{r.referrerSlug || r.referrerId.slice(0, 8)}</span>
                <span className="ml-2 shrink-0 tabular-nums text-neutral-600">{r.signups} signup{r.signups === 1 ? "" : "s"} · {r.activated} active</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {topRows.length === 0 && funnel.attributed === 0 && (
        <p className="mt-3 text-[11.5px] text-neutral-500">No attributions yet.</p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-2 py-1.5 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-black tabular-nums text-neutral-900">{value}</p>
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
