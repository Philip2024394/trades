// /trade-off/following — the viewer's personal Following feed.
//
// Fetches the trades the viewer follows and renders their recent
// posts using the same YardPostCard / YardChatPost components as the
// main Yard. This is the "you get out what you put in" surface —
// follow more trades → richer feed → more reason to open the app.
//
// Auth: URL magic-link (?slug=&token=). Un-authed viewers see a nudge
// to sign in. Empty feed (has auth but no follows) shows a call-to-
// action pointing at The Yard so they can discover trades to follow.
//
// Server component — one query for follows, one for posts, one for
// posters. No client-side fetching for the initial render.

import { createHash } from "node:crypto";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Users, UserPlus, Info } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  HammerexTradeOffYardPost,
  YardReactionKind
} from "@/lib/supabase";
import type { ReactionCounts } from "@/lib/yardReactions";
import { YardPostCard, type YardPoster } from "@/components/xrated/yard/YardPostCard";
import { YardCardFlipShell } from "@/components/xrated/yard/YardCardFlipShell";
import { YardChatPost } from "@/components/xrated/yard/YardChatPost";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  slug?: string | string[];
  token?: string | string[];
}>;

function readParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

async function loadViewerListingId(
  slug: string,
  token: string
): Promise<string | null> {
  if (!slug || !token) return null;
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "live") return null;
  if (!constantTimeEq(data.edit_token, token)) return null;
  return data.id;
}

async function loadFollowedListingIds(
  viewerListingId: string
): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_followers")
    .select("followed_listing_id")
    .eq("follower_listing_id", viewerListingId);
  return (data ?? []).map((r) => r.followed_listing_id);
}

async function loadFollowingFeed(followedIds: string[]) {
  if (followedIds.length === 0) {
    return {
      posts: [] as HammerexTradeOffYardPost[],
      posters: {} as Record<string, YardPoster>,
      reactions: {} as Record<string, ReactionCounts>
    };
  }
  const nowIso = new Date().toISOString();
  const { data: rawPosts } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, listing_id, kind, trade_slug, title, body, country, region, start_date, end_date, crew_size_needed, day_rate_pence, is_sample, status, parent_id, image_urls, attachment_url, attachment_name, attachment_kind, link_url, link_title, product_price_pence, source_product_id, contact_count, is_admin_announcement, is_pinned, moderation_status, moderation_reason, moderated_at, flag_count, metadata, price_currency, condition, warranty_status, stock_qty, delivery_options, delivery_free_over_pence, video_urls, comment_count, is_boosted_until, boost_count, boost_paid_pence, beacon_expires_at, beacon_lat, beacon_lng, beacon_radius_km, beacon_response_count, beacon_winner_response_id, beacon_closed_at, created_at, expires_at"
    )
    .in("listing_id", followedIds)
    .eq("status", "live")
    .is("parent_id", null)
    .gt("expires_at", nowIso)
    .not("moderation_status", "in", '("hidden","spam")')
    // Beacons first (urgent), then boosted, then pinned, then newest.
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);

  const posts = (rawPosts ?? []) as HammerexTradeOffYardPost[];

  // Client-side boost re-sort (partial-index predicates can't use NOW()).
  const nowMs = Date.now();
  const live: HammerexTradeOffYardPost[] = [];
  const rest: HammerexTradeOffYardPost[] = [];
  for (const p of posts) {
    const until = p.is_boosted_until ? Date.parse(p.is_boosted_until) : NaN;
    if (Number.isFinite(until) && until > nowMs) live.push(p);
    else rest.push(p);
  }
  live.sort((a, b) => {
    const aM = Date.parse(a.is_boosted_until ?? "");
    const bM = Date.parse(b.is_boosted_until ?? "");
    return bM - aM;
  });
  const orderedPosts = [...live, ...rest];

  // Batch-load posters
  const ids = Array.from(new Set(orderedPosts.map((p) => p.listing_id)));
  const posters: Record<string, YardPoster> = {};
  if (ids.length > 0) {
    const { data: lres } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, trading_name, city, country, primary_trade, whatsapp, avatar_url, bio, tier, instagram, facebook, tiktok, youtube, photos, follower_count"
      )
      .in("id", ids);
    for (const l of lres ?? []) {
      const photos = Array.isArray(l.photos) ? (l.photos as string[]) : [];
      posters[l.id] = {
        slug: l.slug,
        display_name: l.display_name,
        trading_name: l.trading_name,
        city: l.city,
        country: l.country,
        primary_trade: l.primary_trade,
        whatsapp: l.whatsapp,
        avatar_url: l.avatar_url,
        bio: l.bio ?? null,
        banner_url: photos.length > 0 ? photos[0] : null,
        tier: l.tier ?? null,
        instagram: l.instagram ?? null,
        facebook: l.facebook ?? null,
        tiktok: l.tiktok ?? null,
        youtube: l.youtube ?? null,
        follower_count: l.follower_count ?? 0
      };
    }
  }

  // Batch-load reactions
  const reactions: Record<string, ReactionCounts> = {};
  const postIds = orderedPosts.map((p) => p.id);
  if (postIds.length > 0) {
    const { data: rxRows } = await supabaseAdmin
      .from("hammerex_trade_off_yard_reactions")
      .select("post_id, kind")
      .in("post_id", postIds);
    for (const r of rxRows ?? []) {
      const bucket = reactions[r.post_id] ?? {};
      const kind = r.kind as YardReactionKind;
      bucket[kind] = (bucket[kind] ?? 0) + 1;
      reactions[r.post_id] = bucket;
    }
  }

  return { posts: orderedPosts, posters, reactions };
}

export default async function FollowingFeedPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const slug = readParam(sp.slug);
  const token = readParam(sp.token);
  const viewerId = await loadViewerListingId(slug, token);

  return (
    <main className="bg-[#FBF6EC] pb-24 md:pb-0">
      <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 md:px-8 md:pt-8">
        <header className="mb-5 flex items-baseline justify-between gap-2">
          <div>
            <p
              className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700"
            >
              Your network
            </p>
            <h1 className="mt-1 text-[24px] font-black leading-tight tracking-tight text-[#1B1A17] md:text-[30px]">
              Following
            </h1>
          </div>
          <Users className="h-5 w-5 text-amber-700" aria-hidden />
        </header>

        <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
          <FollowingContent
            viewerId={viewerId}
            slug={slug}
            token={token}
          />
        </Suspense>
      </div>
    </main>
  );
}

async function FollowingContent({
  viewerId,
  slug,
  token
}: {
  viewerId: string | null;
  slug: string;
  token: string;
}) {
  if (!viewerId) {
    return (
      <div className="rounded-2xl border border-amber-400/40 bg-amber-50/60 p-5">
        <div className="flex items-start gap-3">
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            aria-hidden
          />
          <div>
            <p className="text-[14px] font-black text-[#1B1A17]">
              Sign in to see your Following feed.
            </p>
            <p className="mt-1 text-[13px] leading-[1.55] text-[#1B1A17]/70">
              This is a private feed of the trades you follow. Sign in from
              your dashboard to unlock it.
            </p>
            <Link
              href="/home/sign-in"
              className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-black text-neutral-900 hover:bg-amber-300"
            >
              Sign in
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const followedIds = await loadFollowedListingIds(viewerId);

  if (followedIds.length === 0) {
    const tokenQs = `?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
    return (
      <div className="rounded-2xl border border-[#1B1A17]/10 bg-white p-6 text-center">
        <span
          aria-hidden
          className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full text-neutral-900 shadow-sm"
          style={{ background: "#FFB300" }}
        >
          <UserPlus className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-3 text-[16px] font-black text-[#1B1A17]">
          Follow some trades to fill your feed.
        </h2>
        <p className="mt-2 mx-auto max-w-[42ch] text-[13px] leading-[1.55] text-[#1B1A17]/70">
          Tap the flip icon on any Yard card to see who&apos;s posting, then
          hit <span className="font-black">Follow</span>. Every new post from
          them will land here.
        </p>
        <Link
          href={`/trade-off/yard${tokenQs}`}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-black text-neutral-900 hover:bg-amber-300"
        >
          Discover on The Yard
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  const { posts, posters, reactions } = await loadFollowingFeed(followedIds);
  const chatPosts = posts.filter((p) => p.kind === "chat");
  const boardPosts = posts.filter(
    (p) => p.kind !== "chat" && p.kind !== "beacon"
  );
  const beaconPosts = posts.filter((p) => p.kind === "beacon");

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-[#1B1A17]/10 bg-white p-6 text-center">
        <h2 className="text-[15px] font-black text-[#1B1A17]">
          The trades you follow haven&apos;t posted recently.
        </h2>
        <p className="mt-1 mx-auto max-w-[42ch] text-[13px] leading-[1.55] text-[#1B1A17]/70">
          Check back or follow more trades from The Yard to keep this feed
          alive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {beaconPosts.length > 0 && (
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-amber-700">
          Live from your follows
        </p>
      )}

      {boardPosts.length > 0 && (
        <ul className="grid grid-cols-1 gap-3">
          {boardPosts.map((p) => (
            <li key={p.id} className="h-full">
              <YardCardFlipShell poster={posters[p.listing_id] ?? null}>
                <YardPostCard
                  post={p}
                  poster={posters[p.listing_id] ?? null}
                  reactions={reactions[p.id] ?? {}}
                />
              </YardCardFlipShell>
            </li>
          ))}
        </ul>
      )}

      {chatPosts.length > 0 && (
        <div
          className={
            boardPosts.length > 0 ? "mt-8 border-t border-neutral-200 pt-6" : ""
          }
        >
          {boardPosts.length > 0 && (
            <p
              className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#7A5300" }}
            >
              Trade Chat · {chatPosts.length} thread
              {chatPosts.length === 1 ? "" : "s"}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {chatPosts.map((p) => (
              <li key={p.id}>
                <YardChatPost
                  post={p}
                  poster={posters[p.listing_id] ?? null}
                  reactions={reactions[p.id] ?? {}}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
