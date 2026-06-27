// The Yard — public feed page. Server component.
//
// Reads live posts directly from Supabase (no API roundtrip — server
// component can hit supabaseAdmin straight). Renders a hero, a stat
// strip, the YardFilters client island for trade/region/kind, and the
// grid of YardPostCards.
//
// Public to non-members so the page can be promoted on Google + shared
// on socials. Posting requires a paid membership — the bottom CTA links
// to signup.

import type { Metadata } from "next";
import { Suspense } from "react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { YardPostCard, type YardPoster } from "@/components/xrated/yard/YardPostCard";
import { YardFilters } from "@/components/xrated/yard/YardFilters";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "The Yard — UK trades-to-trades job board | Xrated Trades",
  description:
    "Post when you're free or post when you need crew. The Yard is the trades-only job board — paid Xrated members only, every post auto-expires after 14 days. Bricklayers, scaffolders, sparks, joiners — every UK trade.",
  alternates: { canonical: "/trade-off/yard" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "The Yard — UK trades-to-trades board",
    description:
      "Trades-only job board. Post 'I'm free' or 'need crew' — only paying Xrated members see it. 14-day auto-expire.",
    url: absolute("/trade-off/yard")
  }
};

const VALID_TRADE_SLUGS = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

type SearchParams = Promise<{
  kind?: string | string[];
  trade?: string | string[];
  region?: string | string[];
}>;

function readParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

async function loadFeed(opts: { kind: string; trade: string; region: string }) {
  let q = supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, listing_id, kind, trade_slug, title, body, country, region, start_date, end_date, crew_size_needed, day_rate_pence, is_sample, status, created_at, expires_at"
    )
    .eq("status", "live")
    .eq("country", "UK")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (opts.kind === "available" || opts.kind === "needed") q = q.eq("kind", opts.kind);
  if (opts.trade && VALID_TRADE_SLUGS.has(opts.trade)) q = q.eq("trade_slug", opts.trade);
  if (opts.region) q = q.ilike("region", `%${opts.region}%`);

  const res = await q;
  const posts = (res.data ?? []) as HammerexTradeOffYardPost[];

  const ids = Array.from(new Set(posts.map((p) => p.listing_id)));
  const posters: Record<string, YardPoster> = {};
  if (ids.length > 0) {
    const lres = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, trading_name, city, country, primary_trade, whatsapp, avatar_url"
      )
      .in("id", ids);
    for (const l of lres.data ?? []) {
      posters[l.id] = {
        slug: l.slug,
        display_name: l.display_name,
        trading_name: l.trading_name,
        city: l.city,
        country: l.country,
        primary_trade: l.primary_trade,
        whatsapp: l.whatsapp,
        avatar_url: l.avatar_url
      };
    }
  }
  return { posts, posters };
}

async function loadCountsForKind() {
  // Total live counts ignore the current filters so the pill badges
  // tell members how many posts exist of each kind right now.
  const res = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("kind", { count: "exact" })
    .eq("status", "live")
    .eq("country", "UK")
    .gt("expires_at", new Date().toISOString());
  const rows = (res.data ?? []) as { kind: "available" | "needed" }[];
  const available = rows.filter((r) => r.kind === "available").length;
  const needed = rows.filter((r) => r.kind === "needed").length;
  return { total: rows.length, available, needed };
}

export default async function YardFeedPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const kind = readParam(sp.kind);
  const trade = readParam(sp.trade);
  const region = readParam(sp.region);

  const [{ posts, posters }, counts] = await Promise.all([
    loadFeed({ kind, trade, region }),
    loadCountsForKind()
  ]);

  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* HERO */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            The Yard &middot; Trades-only board
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Where UK trades{" "}
            <span style={{ color: XRATED_BRAND.accent }}>crew up</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/80 sm:text-sm">
            Post when you&rsquo;re free for a week. Post when you need 3 sparks
            Monday. Every post is from a paying Xrated member — no DMs from
            ghosts, no Facebook group noise.{" "}
            <span className="font-bold text-white">
              Free to read. Posting is free with paid membership.
            </span>
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> {counts.total} live posts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> {counts.available} available · {counts.needed} crew needed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 14-day auto-expire
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> UK members only
            </span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="/trade-off/signup?next=yard"
              className="inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.97] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 6px 18px ${XRATED_BRAND.accent}55`
              }}
            >
              Post to The Yard
            </a>
            <a
              href="#feed"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-5 text-[13px] font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See the feed
            </a>
          </div>
        </div>
      </section>

      {/* FILTERS + FEED */}
      <section
        id="feed"
        className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14"
      >
        <Suspense fallback={null}>
          <YardFilters counts={counts} />
        </Suspense>

        {posts.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <li key={p.id} className="h-full">
                <YardPostCard
                  post={p}
                  poster={posters[p.listing_id] ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* "How it works" strip */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div
          className="overflow-hidden rounded-2xl border border-neutral-200 p-5 sm:p-8"
          style={{ background: `${XRATED_BRAND.accent}0A` }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: "#7A5300" }}
          >
            How The Yard works
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Two kinds of post. One feed. Zero noise.
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StepCard
              n={1}
              title="You post"
              body='"Plasterer free week of 6 July, Birmingham, 30-mile radius." Done in 60 seconds from your dashboard.'
            />
            <StepCard
              n={2}
              title="UK members read it"
              body="Every post is visible to every paying Xrated member. No customer eyes, no Facebook group strangers."
            />
            <StepCard
              n={3}
              title="WhatsApp handoff"
              body="The yellow Message button opens WhatsApp pre-filled. No in-app DMs, no follow-up nagging — just direct contact."
            />
          </ul>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Free with paid membership
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Post once. Every UK member sees it.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80 sm:text-sm">
            14-day free trial. No card. Your xratedtrade.com URL is live the
            moment you save — and The Yard opens with it.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.97] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Start 14-day trial
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-[13px] font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
      <p
        className="text-[13px] font-bold uppercase tracking-widest"
        style={{ color: "#7A5300" }}
      >
        Nothing yet
      </p>
      <h3 className="mt-2 text-lg font-extrabold text-neutral-900">
        No posts match your filters.
      </h3>
      <p className="mt-2 text-[13px] text-neutral-600">
        Try clearing the trade or area filter — or be the first to post.
      </p>
      <a
        href="/trade-off/signup?next=yard"
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.97]"
        style={{
          background: XRATED_BRAND.accent,
          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
        }}
      >
        Post the first one &rarr;
      </a>
    </div>
  );
}

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-neutral-900"
        style={{ background: XRATED_BRAND.accent }}
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-[13px] font-extrabold text-neutral-900 sm:text-sm">
          {title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
          {body}
        </p>
      </div>
    </li>
  );
}

function Dot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: accent ? XRATED_BRAND.accent : "rgba(255,255,255,0.6)"
      }}
    />
  );
}
