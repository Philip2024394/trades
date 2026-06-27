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
      "id, listing_id, kind, trade_slug, title, body, country, region, start_date, end_date, crew_size_needed, day_rate_pence, is_sample, status, parent_id, created_at, expires_at"
    )
    .eq("status", "live")
    .eq("country", "UK")
    .is("parent_id", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (opts.kind === "available" || opts.kind === "needed" || opts.kind === "chat")
    q = q.eq("kind", opts.kind);
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
  // Only count top-level posts (parent_id null) so replies in chat
  // threads don't inflate the chat counter.
  const res = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("kind")
    .eq("status", "live")
    .eq("country", "UK")
    .is("parent_id", null)
    .gt("expires_at", new Date().toISOString());
  const rows = (res.data ?? []) as { kind: "available" | "needed" | "chat" }[];
  const available = rows.filter((r) => r.kind === "available").length;
  const needed = rows.filter((r) => r.kind === "needed").length;
  const chat = rows.filter((r) => r.kind === "chat").length;
  return { total: rows.length, available, needed, chat };
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

      {/* HERO — strong pitch on the social-media footprint problem.
          The wedge is privacy, not features: posting "I'm looking for
          work" on Facebook leaves a trail customers can see; The Yard
          is the private alternative inside Xrated's paid membership. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            The Yard &middot; Trades-only &middot; Worldwide &middot; Private
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            The ultimate hangout for tradies,{" "}
            <span style={{ color: XRATED_BRAND.accent }}>anywhere on the planet</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-base font-extrabold leading-snug text-white sm:text-lg">
            Customers want{" "}
            <span style={{ color: XRATED_BRAND.accent }}>&ldquo;I&rsquo;m busy&rdquo;</span>{" "}
            &mdash; not &ldquo;looking for work&rdquo;.
          </p>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-white/80 sm:text-sm">
            Asking for work in a Facebook group is a footprint your
            customers can see. Years of it pushes the wrong image &mdash;
            you look quiet, not busy. We built{" "}
            <span className="font-extrabold" style={{ color: XRATED_BRAND.accent }}>
              The Yard
            </span>{" "}
            so trades have their own private hangout to{" "}
            <span className="font-bold text-white">hire</span>,{" "}
            <span className="font-bold text-white">offer fill-in weeks</span>{" "}
            and{" "}
            <span className="font-bold text-white">talk shop</span>{" "}
            &mdash; no public footprint, no customer eyes, no algorithm.
          </p>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-white/70 sm:text-sm">
            Every post auto-expires after{" "}
            <span className="font-bold text-white">14 days</span>{" "}
            and disappears like it never existed. Every post is from a
            paying Xrated member &mdash; nobody else can read it. Every
            yellow button on every post lands you straight in the
            poster&rsquo;s WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> {counts.total} live posts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> {counts.needed} hiring &middot; {counts.available} available &middot; {counts.chat} chat
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 14-day auto-vanish
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> UK paid members only
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
              Unlock The Yard
            </a>
            <a
              href="#feed"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-5 text-[13px] font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              Peek inside
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

      {/* "How it works" strip — the 3 post kinds. */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div
          className="overflow-hidden rounded-2xl border border-neutral-200 p-5 sm:p-8"
          style={{ background: `${XRATED_BRAND.accent}0A` }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: "#7A5300" }}
          >
            Three things you can post
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Hire &middot; Available &middot; Trade Chat.
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KindCard
              tone="needed"
              title="Hiring"
              body="Need 3 sparks Monday for a fit-out. Need a sub-contract bricklayer for 6 weeks. Apprentice wanted Sept. Post the gap, attach the area, set the duration."
              examples={["Few days", "Few weeks", "Full time", "Apprentice start"]}
            />
            <KindCard
              tone="available"
              title="Available"
              body="Free for a week from the 6th. Slot opening late August. Apprentice looking to start. Post when you're free — other trades hire you direct."
              examples={["Fill-in week", "1-2 weeks", "Long stretch", "Apprentice"]}
            />
            <KindCard
              tone="chat"
              title="Trade Chat"
              body="Best plasterboard supplier in NW England? What's the 2026 day rate for sparks? CDM designer — really needed? Click Yard Chat, post, every UK member sees it."
              examples={["Rates", "Suppliers", "Tickets + tickets", "Anything trade"]}
            />
          </ul>
          <p className="mt-5 text-[13px] leading-relaxed text-neutral-600">
            Every post auto-vanishes after 14 days. Every yellow button on
            every post opens WhatsApp pre-filled with the poster&rsquo;s
            number &mdash; no in-app DMs to moderate, no notifications you
            can&rsquo;t silence. The dashboard pings you when a new post
            lands in your trade or area.
          </p>
        </div>
      </section>

      {/* Privacy promise — the wedge made concrete. */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div
          className="overflow-hidden rounded-2xl border-2 p-5 sm:p-8"
          style={{
            background: "#0A0A0A",
            borderColor: XRATED_BRAND.accent
          }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            The privacy promise
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Nobody outside the membership sees a single post.
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-3 text-[13px] text-white/85 sm:grid-cols-2 sm:text-sm">
            <li className="flex items-start gap-2">
              <Tick /> Not indexed by Google. Not shareable as a link to a non-member.
            </li>
            <li className="flex items-start gap-2">
              <Tick /> No public footprint on your name, your trading name or your van.
            </li>
            <li className="flex items-start gap-2">
              <Tick /> Posts disappear after 14 days &mdash; like they never existed.
            </li>
            <li className="flex items-start gap-2">
              <Tick /> Your customers see &ldquo;Available now&rdquo; on your profile, not &ldquo;looking for work&rdquo;.
            </li>
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

function KindCard({
  tone,
  title,
  body,
  examples
}: {
  tone: "available" | "needed" | "chat";
  title: string;
  body: string;
  examples: string[];
}) {
  const dotColor =
    tone === "available"
      ? "#0F7A3F"
      : tone === "needed"
        ? "#0A0A0A"
        : "#FFB300";
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: dotColor }}
          aria-hidden="true"
        />
        <h3 className="text-[13px] font-extrabold text-neutral-900 sm:text-sm">
          {title}
        </h3>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-600">
        {body}
      </p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {examples.map((e) => (
          <li
            key={e}
            className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-700"
          >
            {e}
          </li>
        ))}
      </ul>
    </li>
  );
}

function Tick() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={XRATED_BRAND.accent}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-1 shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
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
