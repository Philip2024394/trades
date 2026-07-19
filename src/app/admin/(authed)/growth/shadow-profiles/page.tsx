// /admin/growth/shadow-profiles — the overview dashboard.
//
// Top-level stats: total scraped, queued, sending, claimed, suppressed,
// released. Funnel percentages. Recent claims. Recent bounces.
//
// Read-only. Links out to /queue and /sequence for deeper views.

import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function loadStats() {
  const statuses = ["scraped", "queued", "sending", "claimed", "suppressed", "released"] as const;
  const [countsRes, eventsRes, recentClaims] = await Promise.all([
    Promise.all(
      statuses.map((s) =>
        supabaseAdmin
          .from("hammerex_shadow_merchants")
          .select("id", { count: "exact", head: true })
          .eq("status", s)
      )
    ),
    supabaseAdmin
      .from("hammerex_shadow_email_events")
      .select("event_type", { count: "exact", head: false })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
    supabaseAdmin
      .from("hammerex_shadow_merchants")
      .select("id, business_name, reserved_slug, claimed_at, city, trade_type")
      .eq("status", "claimed")
      .order("claimed_at", { ascending: false })
      .limit(10)
  ]);

  const counts: Record<string, number> = {};
  statuses.forEach((s, i) => { counts[s] = countsRes[i].count ?? 0; });

  const events7d: Record<string, number> = {};
  for (const row of (eventsRes.data as Array<{ event_type: string }> | null) ?? []) {
    events7d[row.event_type] = (events7d[row.event_type] ?? 0) + 1;
  }

  return { counts, events7d, recentClaims: (recentClaims.data ?? []) as Array<{
    id: string; business_name: string; reserved_slug: string; claimed_at: string; city: string | null; trade_type: string | null;
  }> };
}

export default async function ShadowProfilesOverviewPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login?next=/admin/growth/shadow-profiles");
  }

  const { counts, events7d, recentClaims } = await loadStats();
  const total     = Object.values(counts).reduce((a, b) => a + b, 0);
  const claimRate = total > 0 ? ((counts.claimed / total) * 100).toFixed(1) : "0.0";
  const suppRate  = total > 0 ? ((counts.suppressed / total) * 100).toFixed(1) : "0.0";

  const sent7d       = events7d.sent       ?? 0;
  const open7d       = events7d.open       ?? 0;
  const click7d      = events7d.click      ?? 0;
  const bounce7d     = events7d.bounce     ?? 0;
  const complaint7d  = events7d.complaint  ?? 0;
  const openRate     = sent7d > 0 ? ((open7d / sent7d) * 100).toFixed(1) : "—";
  const clickRate    = sent7d > 0 ? ((click7d / sent7d) * 100).toFixed(1) : "—";
  const bounceRate   = sent7d > 0 ? ((bounce7d / sent7d) * 100).toFixed(1) : "—";

  return (
    <main className="min-h-screen bg-neutral-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Admin · Growth</p>
            <h1 className="mt-1 text-2xl font-black text-neutral-900">Shadow-profile scraper</h1>
          </div>
          <div className="flex gap-2 text-[11px] font-black uppercase tracking-wider">
            <Link href="/admin/growth/shadow-profiles/queue" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100">Queue →</Link>
            <Link href="/admin/growth/shadow-profiles/sequence" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100">Sequence →</Link>
          </div>
        </div>

        {/* Funnel */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <StatCard label="Scraped"    value={counts.scraped}    tone="neutral"/>
          <StatCard label="Queued"     value={counts.queued}     tone="neutral"/>
          <StatCard label="Sending"    value={counts.sending}    tone="amber"/>
          <StatCard label="Claimed"    value={counts.claimed}    tone="green"/>
          <StatCard label="Suppressed" value={counts.suppressed} tone="red"/>
          <StatCard label="Released"   value={counts.released}   tone="neutral"/>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard label="Total in system"  value={total.toLocaleString("en-GB")}/>
          <MetricCard label="Claim rate"       value={`${claimRate}%`}    tone="green"/>
          <MetricCard label="Suppress rate"    value={`${suppRate}%`}     tone="red"/>
        </section>

        {/* Last 7 days deliverability */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Deliverability · last 7 days</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard label="Sent"        value={sent7d.toLocaleString("en-GB")}/>
            <MetricCard label="Open rate"   value={typeof openRate === "string" ? openRate : `${openRate}%`}    subline={`${open7d} opens`}/>
            <MetricCard label="Click rate"  value={typeof clickRate === "string" ? clickRate : `${clickRate}%`} subline={`${click7d} clicks`}/>
            <MetricCard label="Bounce rate" value={typeof bounceRate === "string" ? bounceRate : `${bounceRate}%`} subline={`${bounce7d} bounces`} tone={bounce7d > 0 ? "red" : "neutral"}/>
            <MetricCard label="Complaints"  value={complaint7d.toLocaleString("en-GB")} tone={complaint7d > 0 ? "red" : "neutral"}/>
          </div>
          {(Number(bounceRate) || 0) > 5 && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-800">
              Bounce rate above 5% — pause scraping and review deliverability. High bounce = poor domain reputation → Postmark may throttle.
            </p>
          )}
        </section>

        {/* Recent claims */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Most recent claims</p>
          {recentClaims.length === 0 ? (
            <p className="mt-3 text-[12px] text-neutral-500">No claims yet — cron will populate as merchants convert.</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {recentClaims.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-neutral-900">{c.business_name}</p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {c.trade_type || "—"} · {c.city || "—"} · <Link href={`/${c.reserved_slug}`} className="underline">/{c.reserved_slug}</Link>
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-[10.5px] font-bold text-neutral-500">
                    {new Date(c.claimed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ops notes */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Ops runbook</p>
          <ul className="mt-3 space-y-2 text-[12px] leading-snug text-neutral-700">
            <li><span className="font-black">Env vars required</span>: <code className="rounded bg-neutral-100 px-1">COMPANIES_HOUSE_API_KEY</code>, <code className="rounded bg-neutral-100 px-1">POSTMARK_SERVER_TOKEN</code>, <code className="rounded bg-neutral-100 px-1">POSTMARK_WEBHOOK_SECRET</code>, <code className="rounded bg-neutral-100 px-1">SHADOW_SENDER_EMAIL</code>, <code className="rounded bg-neutral-100 px-1">SHADOW_SENDER_NAME</code>, <code className="rounded bg-neutral-100 px-1">CRON_SECRET</code>.</li>
            <li><span className="font-black">Postmark webhook URL</span>: <code className="rounded bg-neutral-100 px-1">POST https://thenetworkers.app/api/webhooks/postmark?token={"{SECRET}"}</code>. Enable Delivery, Bounce, Open, Click, SpamComplaint, SubscriptionChange.</li>
            <li><span className="font-black">Bounce rate {'>'}5%</span>: pause the scrape cron in Vercel, warm the sending domain, then resume.</li>
            <li><span className="font-black">Compliance</span>: unsubscribe honored on the suppression list forever. B2B corporate emails only. Any complaint → immediate manual review.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "amber" | "green" | "red" }) {
  const bg = { neutral: "bg-white", amber: "bg-amber-50", green: "bg-green-50", red: "bg-red-50" }[tone];
  const fg = { neutral: "text-neutral-900", amber: "text-amber-900", green: "text-green-900", red: "text-red-900" }[tone];
  return (
    <div className={`rounded-xl border border-neutral-200 ${bg} p-4`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-[22px] font-black ${fg}`}>{value.toLocaleString("en-GB")}</p>
    </div>
  );
}

function MetricCard({ label, value, subline, tone }: { label: string; value: string; subline?: string; tone?: "green" | "red" | "neutral" }) {
  const fg = tone === "green" ? "text-green-800" : tone === "red" ? "text-red-800" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-[18px] font-black ${fg}`}>{value}</p>
      {subline && <p className="text-[10px] text-neutral-500">{subline}</p>}
    </div>
  );
}
