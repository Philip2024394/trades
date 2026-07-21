"use client";

// Merchant launchpad — the "home" screen for /trade-off/edit/[slug].
//
// Design goals:
//   • Facebook-easy — every platform surface reachable in one tap.
//   • Fast — single API call renders everything.
//   • Monetising — every empty state is a subtle upgrade prompt;
//     tier caps are visible so the merchant naturally hits paywalls
//     that make sense (not because they're annoying).
//   • Honest — real numbers only. Zero fabricated stats. Blank
//     truth beats decorative fabrication.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Bell, TrendingUp, TrendingDown, CheckCircle2, Sparkles, Wand2, Clock, MessageCircle, ShoppingBag, Crown, ArrowRight, Zap, ChevronRight } from "lucide-react";
import { TrustLadderPanel } from "./TrustLadderPanel";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BRAND_GREEN  = "#166534";

type Summary = {
  merchant: {
    slug:         string;
    display_name: string;
    avatar_url:   string | null;
    tier:         string;
    trading_name: string | null;
    whatsapp:     string | null;
    timezone:     string;
  };
  wallet: {
    balance:        number;
    monthly_credit: number;
    replenish_at:   string | null;
    low:            boolean;
  };
  inbox: {
    unread_notifications: number;
    pending_scheduled:    number;
  };
  growth: {
    views_7d:           number;
    whatsapp_clicks_7d: number;
    posts_7d:           number;
    reactions_7d:       number;
    delta_pct_7d:       number;
  };
  checklist: {
    completed: number;
    total:     number;
    next_step: string | null;
  };
  usage: {
    crown_banners:   { used: number; cap: number };
    bg_removal:      { used: number; cap: number };
    scheduled_posts: { used: number; cap: number };
  };
  recent: Array<{ event_type: string; event_payload: unknown; created_at: string }>;
};

const CHECKLIST_LABELS: Record<string, string> = {
  upload_avatar:        "Upload your profile photo",
  add_bio:              "Write your bio (3-4 lines)",
  add_photos:           "Add 3+ portfolio photos",
  connect_whatsapp:     "Connect WhatsApp (get leads)",
  post_first_canteen:   "Post your first Canteen update",
  share_first_link:     "Share your profile link (WhatsApp)",
  invite_first_customer:"Invite a past customer to review"
};

export function HomeLaunchpad({ slug }: { slug: string }) {
  const [data, setData]     = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/merchant/dashboard/summary", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
        if (!cancelled) setData(json as Summary);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <SkeletonBoard/>
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-red-700">Couldn&rsquo;t load your dashboard. {err && `(${err})`}</p>
      </div>
    );
  }

  const { merchant, wallet, inbox, growth, checklist, usage } = data;
  const growthUp = growth.delta_pct_7d >= 0;
  const nextChecklist = checklist.next_step;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">

      {/* ─── Greeting + wallet + inbox strip ─────────────────── */}
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          {merchant.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={merchant.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"/>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-black" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
              {merchant.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Signed in as {merchant.tier.replace(/_/g," ")}</p>
            <p className="truncate text-lg font-black" style={{ color: BRAND_BLACK }}>
              Welcome, {merchant.display_name.split(" ")[0]}
            </p>
          </div>
        </div>
        <StatChip
          icon={<Wallet size={13}/>}
          label={`${wallet.balance} washers`}
          sub={wallet.low ? "Running low" : "Ready to spend"}
          href={`/trade-off/edit/${slug}/washers`}
          accent={wallet.low}
        />
        <StatChip
          icon={<Bell size={13}/>}
          label={inbox.unread_notifications > 0 ? `${inbox.unread_notifications} new` : "All caught up"}
          sub="Notifications"
          href={`/trade-off/edit/${slug}/notifications`}
          accent={inbox.unread_notifications > 0}
        />
        <StatChip
          icon={<Clock size={13}/>}
          label={inbox.pending_scheduled > 0 ? `${inbox.pending_scheduled} queued` : "None queued"}
          sub="Scheduled"
          href={`/trade-off/edit/${slug}/scheduled`}
          accent={false}
        />
      </header>

      {/* ─── Growth + checklist row ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Growth widget */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">Growth · Last 7 days</h2>
            <Link href={`/trade-off/edit/${slug}/insights`} className="text-[10px] font-black uppercase tracking-wider text-neutral-600 hover:text-neutral-900">
              Details →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBlock label="Profile views" value={growth.views_7d}/>
            <MetricBlock label="WhatsApp taps" value={growth.whatsapp_clicks_7d}/>
            <MetricBlock label="Posts shipped" value={growth.posts_7d}/>
            <MetricBlock label="Reactions" value={growth.reactions_7d}/>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md p-2" style={{ backgroundColor: growthUp ? "#F0FDF4" : "#FEF2F2" }}>
            {growthUp ? (
              <TrendingUp size={14} className="text-green-700"/>
            ) : (
              <TrendingDown size={14} className="text-red-700"/>
            )}
            <span className={"text-[12px] font-black " + (growthUp ? "text-green-800" : "text-red-800")}>
              {growth.delta_pct_7d > 0 ? "+" : ""}{growth.delta_pct_7d}% vs previous 7 days
            </span>
          </div>
        </div>

        {/* Onboarding checklist */}
        {nextChecklist ? (
          <div className="rounded-2xl border-2 p-4" style={{ borderColor: BRAND_YELLOW, background: "linear-gradient(135deg, #FFFBEB 0%, #FFF5D6 100%)" }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "#7A5B00" }}>
                <Sparkles size={11} className="mr-1 inline"/> Setup · {checklist.completed}/{checklist.total} done
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                {Math.round((checklist.completed / checklist.total) * 100)}%
              </span>
            </div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/60">
              <div className="h-full" style={{ width: `${Math.round((checklist.completed / checklist.total) * 100)}%`, backgroundColor: BRAND_YELLOW }}/>
            </div>
            <p className="mb-3 text-sm font-black" style={{ color: BRAND_BLACK }}>
              Next: {CHECKLIST_LABELS[nextChecklist] ?? nextChecklist}
            </p>
            <Link
              href={`/trade-off/edit/${slug}/profile`}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-wider hover:brightness-95"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
            >
              Do it now <ArrowRight size={13}/>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-center gap-2 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-700"/>
              <h2 className="text-[13px] font-black text-neutral-800">Setup complete</h2>
            </div>
            <p className="text-[12px] text-neutral-600">
              You&rsquo;ve done the basics. Your profile is live at{" "}
              <Link href={`/${slug}`} className="font-black text-neutral-900 underline">thenetworkers.app/{slug}</Link>
            </p>
          </div>
        )}
      </div>

      {/* ─── Trust ladder panel (ambition driver + monetisation) ─ */}
      <TrustLadderPanel slug={slug}/>

      {/* ─── Primary CTA — Post something (biggest button) ───── */}
      <div className="rounded-2xl border-2 p-4" style={{ borderColor: BRAND_GREEN, backgroundColor: "#F0FDF4" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ backgroundColor: BRAND_GREEN, color: "#fff" }}>
            <MessageCircle size={20}/>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-black uppercase tracking-wider text-green-800">One tap · post to your Canteen</p>
            <p className="text-base font-black text-neutral-900">What&rsquo;s happening on-site today?</p>
          </div>
          <Link
            href="/site/editor"
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-white hover:brightness-95"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            Compose <ArrowRight size={13}/>
          </Link>
        </div>
      </div>

      {/* ─── Quick-launch tiles ─────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Everything you can do
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile href="/site/editor"                                   icon={<Wand2 size={16}/>}      title="Site Editor"       sub="Crown banners · cutouts"/>
          <Tile href={`/trade-off/edit/${slug}/scheduled`}            icon={<Clock size={16}/>}      title="Scheduled posts"    sub={`${inbox.pending_scheduled} pending`}/>
          <Tile href="/site-office/apps/reviews"                      icon={<MessageCircle size={16}/>} title="Reviews inbox"   sub="Reply to customers"/>
          <Tile href={`/trade-off/edit/${slug}/products`}             icon={<ShoppingBag size={16}/>} title="Products & prices" sub="Your storefront"/>
          <Tile href={`/trade-off/edit/${slug}/insights`}             icon={<TrendingUp size={16}/>} title="Insights"           sub="Trust score · rewards"/>
          <Tile href={`/trade-off/edit/${slug}/sharing`}              icon={<Sparkles size={16}/>}   title="Sharing & boosts"  sub="Business card · QR"/>
          <Tile href="/trade-off/verified"                            icon={<Crown size={16}/>}      title="Verification"      sub="Get your badge"/>
          <Tile href="/trade-off/tips"                                icon={<Sparkles size={16}/>}   title="Tips library"      sub="Win more work"/>
        </div>
      </section>

      {/* ─── Feature-usage / upgrade prompt (monetisation) ──── */}
      <UsageBar tier={merchant.tier} usage={usage} slug={slug}/>

      {/* ─── Recent activity strip ──────────────────────────── */}
      {data.recent.length > 0 && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Recent activity
          </h2>
          <ul className="flex flex-col gap-1.5">
            {data.recent.map((e, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px] text-neutral-700">
                <Zap size={11} className="text-neutral-400"/>
                <span className="font-black text-neutral-900">{e.event_type.replace(/_/g, " ")}</span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-500">{new Date(e.created_at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

// ─── Sub components ─────────────────────────────────────────

function StatChip({ icon, label, sub, href, accent }: { icon: React.ReactNode; label: string; sub: string; href: string; accent: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border px-3 py-2 transition hover:bg-neutral-50"
      style={{ borderColor: accent ? BRAND_YELLOW : "rgba(0,0,0,0.10)", backgroundColor: accent ? "#FFFBEB" : "white" }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ backgroundColor: accent ? BRAND_YELLOW : "#F5F5F5", color: BRAND_BLACK }}
      >
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[12.5px] font-black text-neutral-900">{label}</span>
        <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">{sub}</span>
      </span>
    </Link>
  );
}

function MetricBlock({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-black tabular-nums text-neutral-900">{value}</p>
      <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
    </div>
  );
}

function Tile({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-2 rounded-xl border bg-white p-3 shadow-sm transition hover:border-neutral-500 hover:shadow-md"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black leading-tight text-neutral-900">{title}</p>
        <p className="truncate text-[10.5px] leading-tight text-neutral-500">{sub}</p>
      </div>
      <ChevronRight size={14} className="mt-1 flex-none text-neutral-300 transition group-hover:text-neutral-700"/>
    </Link>
  );
}

function UsageBar({ tier, usage, slug }: { tier: string; usage: Summary["usage"]; slug: string }) {
  const isFree = tier === "standard";
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Monthly usage
        </h2>
        {isFree && (
          <Link
            href="/trade-off/pricing"
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider transition hover:brightness-95"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            <Crown size={11}/> Upgrade for more
          </Link>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <UsageMeter label="Crown banners"    used={usage.crown_banners.used}   cap={usage.crown_banners.cap}/>
        <UsageMeter label="Background cutouts" used={usage.bg_removal.used}     cap={usage.bg_removal.cap}/>
        <UsageMeter label="Scheduled posts"  used={usage.scheduled_posts.used} cap={usage.scheduled_posts.cap}/>
      </div>
      <p className="mt-3 text-[10.5px] text-neutral-500">
        Every merchant tier includes a monthly credit. Business + Works get 10× the caps of Free.{" "}
        <Link href="/trade-off/pricing" className="font-black text-neutral-800 underline">See tiers →</Link>
      </p>
    </section>
  );
}

function UsageMeter({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const critical = pct >= 90;
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: critical ? "#B91C1C" : "rgba(0,0,0,0.10)" }}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-black text-neutral-800">{label}</span>
        <span className="tabular-nums text-[10.5px] font-black text-neutral-500">
          {used} / {cap === 10_000 ? "∞" : cap}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full transition-all"
          style={{
            width:           `${pct}%`,
            backgroundColor: critical ? "#B91C1C" : pct >= 70 ? BRAND_YELLOW : BRAND_GREEN
          }}
        />
      </div>
    </div>
  );
}

function SkeletonBoard() {
  return (
    <div className="flex flex-col gap-4 opacity-70">
      <div className="h-20 animate-pulse rounded-2xl bg-neutral-100"/>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-100"/>
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-100"/>
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-neutral-100"/>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-100"/>
        ))}
      </div>
    </div>
  );
}
