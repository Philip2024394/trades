"use client";

// Client shell for /trade-off/search.
//
// Two tabs — Trades (directory) + The Site (masonry wall). Tab
// state syncs to the URL (?tab=) so back/forward + share links work.
//
// The re-searchable input at the top mirrors LandingSearchBar's shape
// (query + optional city) so the mental model stays consistent from
// landing → results. Submitting from either input navigates to the
// same route with updated query.
//
// Inspiration masonry uses CSS columns (not JS-driven) — cheap,
// responsive, and the natural image aspect ratios stay intact.
//
// "3 nearest trades" chip under each Inspiration image resolves the
// image's primary keyword to real canteens via canteensForTradeQuery.
// City sort is a string-match today; real geo (lat/lng/distance) is
// deferred until Trades tab moves to real-DB queries.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Users, Image as ImageIcon, MapPin, ArrowRight, User, MessageSquare, Heart, X, Bookmark, BookmarkCheck, Plus, Loader2, Sparkles, Download, Send, Check } from "lucide-react";
import { BuyImageModal, type BuyImageContext } from "@/components/site/BuyImageModal";
import { PostToSocialModal, type PostToSocialContext } from "@/components/site/PostToSocialModal";
import {
  canteensForTradeQuery,
  canteenCityHint,
  type Canteen
} from "@/lib/canteens";
import { QuickContactForm, type QuickContactContext } from "@/components/forms/QuickContactForm";
import { ShareButton } from "@/components/forms/ShareButton";
import { BeforeAfterCard } from "@/components/forms/BeforeAfterCard";
import { VisualiseModal, type VisualiseContext } from "@/components/forms/VisualiseModal";
import { ReportContentButton } from "@/components/forms/ReportContentButton";
import { watermarkImageUrl } from "@/lib/imageWatermark";
import type { BeforeAfterEntry } from "@/lib/beforeAfterLibrary";

// Shared shape the shell renders for every inspiration image,
// regardless of whether it came from the curated hero library or a
// trade submission via /api/image-library/submit. The `source` field
// lets the card surface the "submitted by trade" credit chip when
// applicable. sourceCanteenSlug + sourcePostReplyCount are enriched
// server-side from the submission's source_canteen_id / source_post_id
// FKs so the credit chip can link to the trade's canteen and the
// "View comments" button can show the true count without a client
// round-trip on first paint.
/** Product tag on a submission. Human-curated only (no AI). */
export type InspirationMaterial = {
  kind:  "hammerex" | "trade_center" | "external";
  ref:   string;
  label: string;
  url:   string;
};

export type InspirationImage = {
  /** Stable ID — hero-library entry.id for curated, submission UUID
   *  for user-submitted, hammerex_feed_tile_library.slug for buyable
   *  Store images. Powers the /trade-off/inspiration/[id] detail page
   *  AND the /api/site/checkout/single request. Kept `string | null`
   *  because older search-result payloads may pre-date this field; the
   *  card falls back to a no-link render when id is missing. */
  id:                   string | null;
  source:               "curated" | "submission";
  imageUrl:             string;
  subject:              string;
  keywords:             string[];
  submitterSlug:        string | null;
  submitterDisplay:     string | null;
  submitterAvatarUrl:   string | null;
  sourceCanteenId:      string | null;
  sourceCanteenSlug:    string | null;
  sourcePostId:         string | null;
  sourcePostReplyCount: number;
  materials:            InspirationMaterial[];
  /** True when the image is in the platform-owned Store pool (ex-/store,
   *  hammerex_feed_tile_library tier 2/3). Only these images render the
   *  Buy button — trade submissions and non-Store hero images aren't
   *  ours to sell. Defaults to false. */
  isBuyable?:           boolean;
  /** Natural pixel dimensions of the source image — passed to
   *  <img width/height/> so the browser reserves the aspect-ratio
   *  box BEFORE the image bytes arrive. Kills the jumping-while-
   *  scrolling masonry reflow. Fallback: 800x1067 (3:4 portrait). */
  widthPx?:             number | null;
  heightPx?:            number | null;
};

// Shape returned by /api/canteens/posts/[id]/replies. Kept small —
// the inspiration comments dropdown shows author + body + timestamp.
type FeedReply = {
  id: string;
  authorSlug: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
};

const CREAM = "#FBF6EC";
const TAN = "#B8860B";
const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";

type Tab = "trades" | "inspiration";

/** Per-image entitlement snapshot passed to a card. `reason` labels
 *  the chip: subscription = "Subscribed", tier-bundled = "Bundled",
 *  purchase = "Owned". Null reason renders no chip. */
export type SiteCardEntitlement = {
  hasClean: boolean;
  reason:   "subscription" | "tier-bundled" | "purchase" | null;
};

export function SearchShell({
  query,
  city,
  initialTab,
  trades,
  inspiration,
  transformations = [],
  browseSeed = 1,
  featuredTradeSlugs = [],
  merchantSignedIn = false,
  siteEntitlement = { hasBlanket: false, blanketReason: null, ownedImageIds: [] }
}: {
  query: string;
  city: string;
  initialTab: Tab;
  trades: Canteen[];
  inspiration: InspirationImage[];
  /** Before/After showcase entries matching the query. Rendered as
   *  a "Transformations" strip above the masonry on The Site tab
   *  so the drag-reveal wow lands first. Passed empty when no
   *  matches — the strip hides entirely. */
  transformations?: BeforeAfterEntry[];
  /** Random seed the server chose for the no-query browse-all
   *  shuffle. Client uses this seed on every /api/inspiration/browse
   *  request so pagination is deterministic across requests within
   *  a single page load. */
  browseSeed?: number;
  /** Trade host slugs that hold an ACTIVE Featured Placement for
   *  this query category. The server has already pulled them to
   *  the front of the trades list; the shell renders a "Featured"
   *  pill on the card so the boost reads as intentional, not
   *  random sort order. */
  featuredTradeSlugs?: string[];
  /** True when the caller has a valid trade-session cookie. Passed
   *  down to BuyImageModal so signed-in merchants skip the email
   *  input — the checkout endpoint reads the session server-side. */
  merchantSignedIn?: boolean;
  /** The viewer's Site entitlement — resolved server-side by
   *  siteEntitlementForViewer over the buyable IDs in the first page.
   *  hasBlanket=true means every buyable image is entitled (sub or
   *  bundling tier); ownedImageIds enumerates individual purchases.
   *  Cards use this to render "Owned"/"Subscribed" chips and swap the
   *  Buy button for a direct Download link. */
  siteEntitlement?: {
    hasBlanket:    boolean;
    blanketReason: "subscription" | "tier-bundled" | null;
    ownedImageIds: string[];
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [inputQuery, setInputQuery] = useState(query);
  const [inputCity, setInputCity] = useState(city);
  // Endless-scroll state — appended pages from /api/inspiration/browse.
  // Starts empty and grows as the IntersectionObserver at the bottom
  // fires. `hasMore` false means we've exhausted the source (query
  // has no more matches AND progressive-broadening has hit single-
  // token; browse-all has walked the whole shuffled window).
  const [scrolled, setScrolled] = useState<InspirationImage[]>([]);
  const [scrollLoading, setScrollLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollOffsetRef = useRef<number>(inspiration.length);
  // Entitlement state — hoisted above loadMoreInspiration because that
  // callback references refreshEntitlementForIds. Reason lookup in
  // entitlementForImage stays cheap (set contains).
  const [ownedIdSet, setOwnedIdSet] = useState<Set<string>>(
    () => new Set(siteEntitlement.ownedImageIds)
  );
  const refreshEntitlementForIds = useCallback(
    async (candidateIds: string[]) => {
      if (siteEntitlement.hasBlanket) return;
      const unknown = candidateIds.filter((id) => id && !ownedIdSet.has(id));
      if (unknown.length === 0) return;
      try {
        const res = await fetch("/api/site/entitlement", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ image_ids: unknown })
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({} as {
          hasBlanket?: boolean; ownedImageIds?: string[];
        }));
        if (data.hasBlanket) {
          setOwnedIdSet((prev) => {
            const next = new Set(prev);
            for (const id of candidateIds) next.add(id);
            for (const id of unknown)      next.add(id);
            return next;
          });
          return;
        }
        const newlyOwned = ((data.ownedImageIds ?? []) as unknown[]).filter(
          (id): id is string => typeof id === "string" && id.length > 0
        );
        if (newlyOwned.length === 0) return;
        setOwnedIdSet((prev) => {
          const next = new Set(prev);
          for (const id of newlyOwned) next.add(id);
          return next;
        });
      } catch {
        // Silent fail — entitlement is best-effort.
      }
    },
    [ownedIdSet, siteEntitlement.hasBlanket]
  );
  // Reset appended pages when query changes (SSR gave us a fresh
  // first page).
  useEffect(() => {
    setScrolled([]);
    scrollOffsetRef.current = inspiration.length;
    setHasMore(true);
  }, [query, inspiration.length]);

  const loadMoreInspiration = useCallback(async () => {
    if (scrollLoading || !hasMore) return;
    setScrollLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("seed", String(browseSeed));
      params.set("offset", String(scrollOffsetRef.current));
      params.set("limit", "24");
      const res = await fetch(`/api/inspiration/browse?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setHasMore(false);
        return;
      }
      const curated = (data.curated ?? []) as Array<{
        id?: string;
        imageUrl: string; subject: string; keywords: string[];
        widthPx?: number | null; heightPx?: number | null;
        isBuyable?: boolean;
      }>;
      const submissions = (data.submissions ?? []) as Array<{
        id?: string;
        imageUrl: string; subject: string; keywords: string[];
        submitterSlug: string | null; submitterDisplay: string | null; submitterAvatarUrl: string | null;
        sourceCanteenId: string | null; sourcePostId: string | null;
      }>;
      const seen = new Set<string>([...inspiration.map((i) => i.imageUrl), ...scrolled.map((i) => i.imageUrl)]);
      const next: InspirationImage[] = [];
      for (const c of curated) {
        if (seen.has(c.imageUrl)) continue;
        seen.add(c.imageUrl);
        next.push({
          id: c.id ?? null,
          source: "curated",
          imageUrl: c.imageUrl,
          subject: c.subject,
          keywords: c.keywords,
          submitterSlug: null, submitterDisplay: null, submitterAvatarUrl: null,
          sourceCanteenId: null, sourceCanteenSlug: null, sourcePostId: null, sourcePostReplyCount: 0,
          materials: [],
          isBuyable: c.isBuyable === true,
          widthPx: c.widthPx ?? null,
          heightPx: c.heightPx ?? null
        });
      }
      for (const s of submissions) {
        if (seen.has(s.imageUrl)) continue;
        seen.add(s.imageUrl);
        next.push({
          id: s.id ?? null,
          source: "submission",
          imageUrl: s.imageUrl,
          subject: s.subject,
          keywords: s.keywords,
          submitterSlug: s.submitterSlug, submitterDisplay: s.submitterDisplay, submitterAvatarUrl: s.submitterAvatarUrl,
          sourceCanteenId: s.sourceCanteenId, sourceCanteenSlug: null, sourcePostId: s.sourcePostId, sourcePostReplyCount: 0,
          materials: [],
          widthPx: null,
          heightPx: null
        });
      }
      if (next.length === 0) {
        setHasMore(false);
      } else {
        setScrolled((prev) => [...prev, ...next]);
        scrollOffsetRef.current += curated.length;
        if (!data.hasMore) setHasMore(false);
        // Fire-and-forget entitlement refresh for the buyable IDs in
        // this page — no await, doesn't block scroll rendering.
        const buyableIds = next
          .filter((e) => e.isBuyable === true && typeof e.id === "string" && e.id.length > 0)
          .map((e) => e.id as string);
        if (buyableIds.length > 0) {
          void refreshEntitlementForIds(buyableIds);
        }
      }
    } catch {
      setHasMore(false);
    } finally {
      setScrollLoading(false);
    }
  }, [browseSeed, hasMore, inspiration, query, refreshEntitlementForIds, scrollLoading, scrolled]);

  // IntersectionObserver sentinel — a hidden div at the bottom of
  // the masonry that triggers loadMoreInspiration when it enters
  // the viewport (with 400px root margin so we start fetching
  // BEFORE the user hits the wall).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (tab !== "inspiration") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadMoreInspiration();
          }
        }
      },
      // 1500px lead-time — the next batch of images is fetched +
      // starts decoding well before the user's scroll reaches the
      // bottom of the current render. Kills the "images appearing
      // just-in-time with a load flash" (Philip 2026-07-17).
      { rootMargin: "1500px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, loadMoreInspiration]);
  // QuickContactForm modal state — lifted to the shell so any
  // inspiration card can trigger it. Null = closed. Set to a
  // QuickContactContext to open the modal against a specific trade
  // + source image. Escape key + backdrop tap both close.
  const [contactContext, setContactContext] = useState<QuickContactContext | null>(null);
  // Site Board save-modal state. Null = closed. Set to an image
  // snapshot to open the "save to which board?" picker. First-time
  // visitors get an auto-created "My First Board" so the flow works
  // without a naming step.
  const [saveTarget, setSaveTarget] = useState<InspirationImage | null>(null);
  // AI Visualiser modal — opens with an InspirationImage as the
  // source. Constitutional expectations screen fires on first-use
  // per feedback_ai_visualiser_expectations_and_no_refunds.md.
  const [visualiseContext, setVisualiseContext] = useState<VisualiseContext | null>(null);
  // Buy modal — opens with a two-choice sheet (£5.99 single vs
  // £14.99/mo unlimited) when the user taps the download icon on a
  // buyable Store-sourced card.
  const [buyContext, setBuyContext] = useState<BuyImageContext | null>(null);
  // Social editor — opens when an entitled viewer taps Share on a
  // buyable card. Posts through /api/site/share which drops a canteen
  // post carrying the image URL. Canteen posts aggregate into the
  // platform-wide Yard so one call feeds both surfaces.
  const [shareContext, setShareContext] = useState<PostToSocialContext | null>(null);
  // Card-level entitlement lookup — reads the hoisted ownedIdSet.
  const entitlementForImage = useCallback(
    (imageId: string | null): SiteCardEntitlement => {
      if (!imageId) return { hasClean: false, reason: null };
      if (siteEntitlement.hasBlanket) {
        return { hasClean: true, reason: siteEntitlement.blanketReason };
      }
      if (ownedIdSet.has(imageId)) {
        return { hasClean: true, reason: "purchase" };
      }
      return { hasClean: false, reason: null };
    },
    [siteEntitlement.hasBlanket, siteEntitlement.blanketReason, ownedIdSet]
  );
  useEffect(() => {
    if (!contactContext) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContactContext(null);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [contactContext]);

  function submitSearch(nextTab?: Tab) {
    const target = nextTab ?? tab;
    const params = new URLSearchParams();
    const q = inputQuery.trim();
    const c = inputCity.trim();
    if (q) params.set("q", q);
    if (c) params.set("city", c);
    if (target !== "trades") params.set("tab", target);
    const qs = params.toString();
    router.push(qs ? `/trade-off/search?${qs}` : "/trade-off/search");
  }

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    // Reflect tab in the URL so refresh/share preserves it. Uses
    // replace (not push) so the back button skips over tab switches.
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (city) params.set("city", city);
    if (next !== "trades") params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `/trade-off/search?${qs}` : "/trade-off/search", { scroll: false });
  }

  return (
    <main className="relative min-h-screen" style={{ backgroundColor: CREAM }}>
      {/* Search header — re-searchable input at the top. */}
      <section className="mx-auto max-w-6xl px-3 pt-6 md:px-6 md:pt-10">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Search
        </div>
        <h1
          className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]"
          style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
        >
          {query ? <>Results for &ldquo;{query}&rdquo;</> : "Search trades or browse The Site"}
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
          className="mt-4 flex flex-col gap-2 rounded-2xl border bg-white p-2 shadow-md md:flex-row md:items-center"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="relative flex-1">
            <Search
              size={14}
              strokeWidth={2.4}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Loft ladders, garden design, kitchen worktop…"
              className="w-full rounded-xl border-0 bg-transparent py-3 pl-9 pr-3 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              autoComplete="off"
              aria-label="Search query"
            />
          </div>
          <div className="relative md:w-56">
            <MapPin
              size={14}
              strokeWidth={2.4}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={inputCity}
              onChange={(e) => setInputCity(e.target.value)}
              placeholder="Near me (e.g. Manchester)"
              className="w-full rounded-xl border-0 bg-transparent py-3 pl-9 pr-3 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              autoComplete="off"
              aria-label="City"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[12.5px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            Search
            <ArrowRight size={13} strokeWidth={2.6}/>
          </button>
        </form>

        {/* Tab bar — two modes. Counts render inline so the merchant
            can see at a glance where the signal is (many trades vs
            lots of inspiration photos). */}
        <div
          role="tablist"
          aria-label="Search mode"
          className="mt-6 flex gap-2 border-b"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <TabButton
            active={tab === "trades"}
            onClick={() => switchTab("trades")}
            icon={<Users size={14} strokeWidth={2.4}/>}
            label="Trades"
            count={trades.length}
          />
          <TabButton
            active={tab === "inspiration"}
            onClick={() => switchTab("inspiration")}
            icon={<ImageIcon size={14} strokeWidth={2.4}/>}
            label="The Site"
            count={inspiration.length + transformations.length}
          />
        </div>
      </section>

      {/* Results body */}
      <section className="mx-auto max-w-6xl px-3 pb-20 pt-4 md:px-6">
        {!query && (
          <EmptyState
            title="Type what you're looking for."
            body="Try a trade (‘plumber’), a category (‘loft ladders’) or a project word (‘garden design’). Every result gives you real trades OR a wall of photos on The Site."
          />
        )}
        {query && tab === "trades" && (
          trades.length > 0
            ? <TradesList trades={trades} city={city} featuredTradeSlugs={featuredTradeSlugs}/>
            : (
              <EmptyState
                title={`No trades match “${query}” yet.`}
                body="Try a broader term, or switch to The Site tab to browse photos."
              />
            )
        )}
        {tab === "inspiration" && (
          inspiration.length > 0 || transformations.length > 0 || scrolled.length > 0
            ? (
              <>
                {/* Subscription banner — one-off Manage entry point for
                    viewers on an active £14.99/mo sub. Bundling-tier
                    subscribers don't see this; their sub is managed
                    on the main pricing/settings page. */}
                {siteEntitlement.hasBlanket && siteEntitlement.blanketReason === "subscription" && (
                  <SiteSubscriptionBanner/>
                )}
                {transformations.length > 0 && (
                  <TransformationsStrip
                    entries={transformations}
                    query={query}
                    city={city}
                    onLikeIt={setContactContext} onSave={setSaveTarget} onVisualise={setVisualiseContext}
                  />
                )}
                {(inspiration.length + scrolled.length) > 0 && (
                  <InspirationMasonry
                    entries={[...inspiration, ...scrolled]}
                    query={query}
                    city={city}
                    onLikeIt={setContactContext} onSave={setSaveTarget} onVisualise={setVisualiseContext}
                    onBuy={setBuyContext}
                    onShare={setShareContext}
                    entitlementForImage={entitlementForImage}
                  />
                )}
                {/* Sentinel — invisible target the observer watches to
                    trigger the next page fetch. Also renders a small
                    inline status line so users know something's
                    loading / that they've hit the end of the wall. */}
                <div ref={sentinelRef} aria-hidden className="h-4"/>
                <div className="mt-4 text-center text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                  {scrollLoading
                    ? "Loading more…"
                    : hasMore
                      ? "Scroll for more"
                      : "That's every match — try a different search."}
                </div>
                <div className="mt-6 text-center text-[10px] text-neutral-400">
                  <Link href="/legal/image-license" className="hover:underline">Image use terms</Link>
                  <span className="mx-2">·</span>
                  Every image watermarked & credited
                </div>
              </>
            )
            : query
              ? (
                <EmptyState
                  title={`Nothing on The Site for “${query}” yet.`}
                  body="Try a broader term (e.g. ‘garden’, ‘kitchen’, ‘bathroom’)."
                />
              )
              : (
                <EmptyState
                  title="Loading The Site…"
                  body="Fetching the wall of construction photos. If nothing appears in a second, try refreshing."
                />
              )
        )}
      </section>

      {/* Site Board save modal */}
      {saveTarget && (
        <SiteBoardPickerModal
          image={saveTarget}
          onClose={() => setSaveTarget(null)}
        />
      )}

      {/* AI Visualiser modal — expectations screen fires first on
          first use per feedback_ai_visualiser_expectations_and_no_refunds.md */}
      {visualiseContext && (
        <VisualiseModal
          context={visualiseContext}
          onClose={() => setVisualiseContext(null)}
        />
      )}

      {/* Buy image modal — £5.99 single vs £14.99/mo unlimited */}
      {buyContext && (
        <BuyImageModal
          context={buyContext}
          merchantSignedIn={merchantSignedIn}
          onClose={() => setBuyContext(null)}
        />
      )}

      {/* Social editor — entitled viewers post the Site image straight
          into their canteen; aggregated Yard picks it up automatically. */}
      {shareContext && (
        <PostToSocialModal
          context={shareContext}
          onClose={() => setShareContext(null)}
        />
      )}

      {/* QuickContactForm modal — full-screen on mobile, centred
          card on desktop. Backdrop tap + escape key close (Escape
          wired via the effect above). Stop propagation on the card
          so clicking inside doesn't dismiss. */}
      {contactContext && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
          style={{ backgroundColor: "rgba(10,10,10,0.75)", backdropFilter: "blur(6px)" }}
          onClick={() => setContactContext(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div
              className="flex items-center justify-between px-5 py-2.5 sm:px-6"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                  aria-hidden
                >
                  <Heart size={12} strokeWidth={2.6}/>
                </span>
                <span className="text-[11px] font-black uppercase tracking-[0.18em]">
                  Get a quote
                </span>
              </div>
              <button
                type="button"
                onClick={() => setContactContext(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10"
              >
                <X size={15} strokeWidth={2.6}/>
              </button>
            </div>
            <div className="p-5 sm:p-6">
              <QuickContactForm
                context={contactContext}
                onCancel={() => setContactContext(null)}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-black uppercase tracking-wider transition"
      style={{
        borderColor: active ? BRAND_BLACK : "transparent",
        color:       active ? BRAND_BLACK : "#737373"
      }}
    >
      {icon}
      {label}
      <span
        className="ml-1 rounded-full px-1.5 py-0.5 text-[9.5px]"
        style={{
          backgroundColor: active ? BRAND_BLACK : "rgba(139,69,19,0.10)",
          color:           active ? BRAND_YELLOW : "#737373"
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="mt-4 rounded-2xl border-2 border-dashed p-8 text-center"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      <div className="text-[14px] font-black text-neutral-900">{title}</div>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}

function TradesList({
  trades,
  city,
  featuredTradeSlugs
}: {
  trades: Canteen[];
  city: string;
  featuredTradeSlugs: string[];
}) {
  const featuredSet = new Set(featuredTradeSlugs);
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {trades.map((c) => {
        const cityHint = canteenCityHint(c);
        const matchesCity = city && cityHint === city.toLowerCase();
        const isFeatured  = featuredSet.has(c.hostSlug);
        return (
          <li key={c.id}>
            <Link
              href={`/trade-off/yard/canteens/${c.slug}`}
              className="flex items-stretch gap-3 rounded-2xl border bg-white p-3 shadow-sm transition hover:shadow-md md:gap-4 md:p-4"
              style={{
                borderColor: isFeatured ? BRAND_YELLOW : "rgba(139,69,19,0.15)",
                boxShadow:   isFeatured ? `0 0 0 2px ${BRAND_YELLOW}44` : undefined
              }}
            >
              {/* Thumbnail */}
              <div
                className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 md:h-24 md:w-24"
                style={
                  c.headerBgUrl
                    ? { backgroundImage: `url('${c.headerBgUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }
                    : {}
                }
                aria-hidden
              />
              {/* Meta */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[15px] font-black text-neutral-900 md:text-[17px]">
                    {c.name}
                  </h3>
                  {isFeatured && (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                      title="This trade is on a paid Featured Placement slot"
                    >
                      <Sparkles size={9} strokeWidth={2.6}/>
                      Featured
                    </span>
                  )}
                  {matchesCity && (
                    <span
                      className="rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                    >
                      Near you
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  {c.tradeLabel}
                  {cityHint && <> · {capitalise(cityHint)}</>}
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-neutral-700">
                  {c.tagline}
                </p>
                <div className="mt-1.5 text-[10.5px] text-neutral-500">
                  Hosted by <span className="font-black text-neutral-800">{c.hostDisplayName}</span> · {c.memberCount} members · {c.postsLast30d} posts / 30d
                </div>
              </div>
              <ArrowRight size={16} className="mt-1 flex-shrink-0 self-center text-neutral-400"/>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function InspirationMasonry({
  entries,
  query,
  city,
  onLikeIt,
  onSave,
  onVisualise,
  onBuy,
  onShare,
  entitlementForImage
}: {
  entries: InspirationImage[];
  query: string;
  city: string;
  onLikeIt: (ctx: QuickContactContext) => void;
  onSave: (image: InspirationImage) => void;
  onVisualise: (ctx: VisualiseContext) => void;
  onBuy: (ctx: BuyImageContext) => void;
  onShare: (ctx: PostToSocialContext) => void;
  entitlementForImage: (imageId: string | null) => SiteCardEntitlement;
}) {
  return (
    <div
      className="mt-4"
      // CSS columns masonry — cheap, natural aspect preservation.
      // Column count widens on larger screens. Break-inside avoid
      // stops a card being split across columns mid-render.
      style={{ columnGap: "12px" }}
    >
      <div
        className="[column-count:2] sm:[column-count:3] lg:[column-count:4]"
        style={{ columnGap: "12px" }}
      >
        {entries.map((entry, idx) => (
          <InspirationCard
            key={`${entry.source}:${entry.imageUrl}`}
            entry={entry}
            index={idx}
            query={query}
            city={city}
            onLikeIt={onLikeIt}
            onSave={onSave}
            onVisualise={onVisualise}
            onBuy={onBuy}
            onShare={onShare}
            entitlement={entitlementForImage(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Turn the library's verbose CLI-style subject line into a short
 *  human-facing card caption. Subjects were written for the image
 *  pipeline ("Working timber yard with stacked cut structural timber,
 *  green log-grabber crane, pine forest backdrop, wet gravel ground")
 *  which reads like conversation, not marketing copy. The first
 *  clause is almost always the essence; we take that, trim, drop any
 *  trailing prepositions, and cap at 80 chars. */
function deriveCardCaption(subject: string): string {
  if (!subject) return "";
  const firstClause = subject.split(/[,;·—]/)[0].trim();
  const trimmed = firstClause.replace(/\s+(with|showing|featuring|and|on|in|of|at)\s*$/i, "");
  const capped = trimmed.length > 80 ? `${trimmed.slice(0, 77).trim()}…` : trimmed;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

function InspirationCard({
  entry,
  index,
  query,
  city,
  onLikeIt,
  onSave,
  onVisualise,
  onBuy,
  onShare,
  entitlement
}: {
  entry: InspirationImage;
  /** Position in the visible list — controls eager/lazy loading. */
  index: number;
  query: string;
  city: string;
  onLikeIt: (ctx: QuickContactContext) => void;
  onSave: (image: InspirationImage) => void;
  onVisualise: (ctx: VisualiseContext) => void;
  onBuy: (ctx: BuyImageContext) => void;
  onShare: (ctx: PostToSocialContext) => void;
  entitlement: SiteCardEntitlement;
}) {
  // Resolve up to 3 real trade canteens for the "nearest to me" chip.
  // Uses the entry's first keyword as the trade query — cheaper than
  // scoring every trade against the whole entry and closer to intent
  // ("loft ladders" search → canteens matching loft ladders).
  const nearestTrades = useMemo(
    () => canteensForTradeQuery(entry.keywords[0] ?? query, city, 3),
    [entry, query, city]
  );
  const isSubmission = entry.source === "submission";

  // Target trade for the "I like it, how much?" quote form. Per Philip
  // 2026-07-16 (ADR-0003): the lead goes to ONE trade, never 3-way
  // broadcast. Priority:
  //   1. Submitter credit-chip trade (submission images) — they get
  //      the reward for uploading the image.
  //   2. Top nearest trade (curated hero library) — the strongest
  //      match from canteensForTradeQuery for this image's category.
  //   3. No target — button hidden. Better to not offer contact than
  //      route a lead to a random trade.
  const targetTrade = useMemo(() => {
    if (isSubmission && entry.submitterDisplay && entry.sourceCanteenSlug) {
      return {
        slug:        `trade-of-${entry.sourceCanteenSlug}`,
        canteenSlug: entry.sourceCanteenSlug,
        displayName: entry.submitterDisplay
      };
    }
    if (nearestTrades.length > 0) {
      const top = nearestTrades[0];
      return {
        slug:        top.hostSlug,
        canteenSlug: top.slug,
        displayName: top.hostDisplayName
      };
    }
    return null;
  }, [isSubmission, entry.submitterDisplay, entry.sourceCanteenSlug, nearestTrades]);
  // Comments dropdown state. Fetch once on first open (lazy) then
  // cache — closing/reopening the panel reuses the cached list.
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<FeedReply[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const toggleComments = useCallback(async () => {
    if (!entry.sourcePostId) return;
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    setCommentsOpen(true);
    if (comments !== null) return; // already cached
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/canteens/posts/${encodeURIComponent(entry.sourcePostId)}/replies`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && Array.isArray(data.replies)) {
        setComments(data.replies as FeedReply[]);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [comments, commentsOpen, entry.sourcePostId]);

  // Credits intentionally hidden on Site Interest cards per Philip
  // 2026-07-16 — visitors want inspiration, not attribution noise.
  // Lead routing still happens via the "trades near you" chip strip
  // below and the "I like it, how much?" button.
  const creditNode = null;

  // Casual-copy prevention. Never bulletproof (screenshots + devtools
  // always work) but raises the bar enough that the OS share menu +
  // watermark are the natural paths. Applied to the image element:
  //   • oncontextmenu → suppresses "Save image as…" right-click
  //   • ondragstart   → suppresses drag-to-desktop / drag-to-message
  //   • draggable     → same, belt-and-braces
  //   • userSelect    → hides selection UI on long-press mobile
  //
  // Watermark source:
  //   • Buyable Site images → /api/site/thumb (sharp burns the mark
  //     into any-CDN bytes). Universal, works regardless of upstream.
  //   • Everything else (curated hero-library, submissions) → the
  //     ImageKit URL-transform mark. Free, no server bytes.
  const watermarked = entry.isBuyable && entry.id
    ? `/api/site/thumb/${encodeURIComponent(entry.id)}?w=800`
    : watermarkImageUrl(entry.imageUrl);
  // Detail page URL — every clickable image points at
  // /trade-off/inspiration/[id] where the buyer sees the big
  // image + 3 nearest WhatsApp-opted trades + "buy this image"
  // CTA. Falls back to a search-URL if id missing (older payload).
  const detailHref = entry.id
    ? `/trade-off/inspiration/${encodeURIComponent(entry.id)}${city ? `?city=${encodeURIComponent(city)}` : ""}`
    : null;
  // Share URL — points at the detail page when we have one, so
  // the share lands on the specific image (not the search page).
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${detailHref ?? `/trade-off/search?q=${encodeURIComponent(entry.keywords[0] ?? query)}&tab=inspiration`}`
    : (detailHref ?? `/trade-off/search?q=${encodeURIComponent(entry.keywords[0] ?? query)}&tab=inspiration`);

  const imgElement = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={watermarked}
      alt={entry.subject}
      // Explicit width + height are the PROPER fix for the
      // scrolling-jumping issue. Modern browsers (Chrome/Safari/
      // Firefox 2020+) use these to compute an aspect-ratio box
      // BEFORE bytes arrive, so the card holds its slot in the
      // column even while lazy-loading. Backfilled by
      // scripts/backfill-image-dims.mjs; fallback 800x1067 (3:4
      // portrait) when a hero-library entry hasn't been probed
      // yet — still reserves a box, just approximate.
      width={entry.widthPx  ?? 800}
      height={entry.heightPx ?? 1067}
      // First 40 images: eager download on page load — covers
      // ~10 rows on a 4-column grid so nothing above the fold
      // + first scroll-screen is lazy. Later images stay lazy
      // (native browser lazy loading kicks in) but the sentinel
      // above pre-fetches the next batch 1500px early, so by
      // the time user reaches them they've already begun.
      loading={index < 40 ? "eager" : "lazy"}
      decoding="async"
      // fetchPriority=high for the top 12 (~3 rows) — browser
      // prioritises them ahead of scripts/other assets.
      fetchPriority={index < 12 ? "high" : "auto"}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="block h-auto w-full select-none"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        contentVisibility: index < 20 ? "visible" : "auto",
        containIntrinsicSize: "300px 400px"
      }}
    />
  );

  return (
    <figure
      className="mb-3 overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.12)", breakInside: "avoid" }}
    >
      <div className="relative">
        {detailHref ? (
          <Link href={detailHref} className="block" aria-label={`View ${entry.subject}`}>
            {imgElement}
          </Link>
        ) : (
          imgElement
        )}
        {/* Entitlement chip — top-left corner on buyable cards when the
            viewer has clean access. Yellow-on-black for the paid
            reasons (subscription, tier-bundled) so it reads as a badge;
            neutral for a one-off purchase. */}
        {entry.isBuyable && entitlement.hasClean && entitlement.reason && (
          <div
            className="pointer-events-none absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow-sm"
            style={
              entitlement.reason === "purchase"
                ? { backgroundColor: "#0A0A0A", color: "#FFB300" }
                : { backgroundColor: "#FFB300", color: "#0A0A0A" }
            }
          >
            {entitlement.reason === "subscription" ? "Subscribed"
              : entitlement.reason === "tier-bundled" ? "Bundled"
              : "Owned"}
          </div>
        )}
      </div>

      {/* Utility action row — Try It pill on the LEFT, Save + Share +
          Report cluster on the right. Try It moved off the image
          per Philip 2026-07-16 — small yellow pill under the frame,
          tight round corners so it reads as a chip not a hero button. */}
      <div className="flex items-center justify-between gap-1.5 border-b px-2.5 py-1.5" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
        <button
          type="button"
          onClick={() =>
            onVisualise({
              sourceImageUrl:  entry.imageUrl,
              sourceImageAlt:  entry.subject,
              sourcePostId:    entry.sourcePostId,
              sourceCanteenId: entry.sourceCanteenId,
              targetTradeSlug: null,
              projectLabel:    entry.keywords[0]
                ? entry.keywords[0]
                  .split(/\s+/)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")
                : undefined
            })
          }
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
          style={{ backgroundColor: "#FFB300" }}
          aria-label="Try it — visualise in my room"
          title="Try it — see this in your room (AI)"
        >
          <Sparkles size={10} strokeWidth={2.6}/>
          Try it
        </button>
        <div className="flex items-center gap-1.5">
          {entry.isBuyable && entry.id && (
            entitlement.hasClean ? (
              <>
                <a
                  href={`/api/site/download/${encodeURIComponent(entry.id)}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:brightness-95"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                  aria-label="Download this image (entitled)"
                  title="Download — you have access"
                >
                  <Download size={13} strokeWidth={2.6}/>
                </a>
                <Link
                  href={`/site/editor?image_id=${encodeURIComponent(entry.id)}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Open in the Site Editor"
                  title="Edit for Instagram / Facebook / TikTok / Snap"
                >
                  <Sparkles size={13} strokeWidth={2.4}/>
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    onShare({
                      imageId:  entry.id!,
                      imageUrl: entry.imageUrl,
                      subject:  deriveCardCaption(entry.subject)
                    })
                  }
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Post to my Canteen (also appears on Yard)"
                  title="Share — post to your Canteen + Yard"
                >
                  <Send size={13} strokeWidth={2.4}/>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onBuy({
                    imageId:  entry.id!,
                    imageUrl: entry.imageUrl,
                    subject:  deriveCardCaption(entry.subject)
                  })
                }
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Get this image — from £5.99"
                title="Get this image — from £5.99"
              >
                <Download size={13} strokeWidth={2.4}/>
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onSave(entry)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Save to Site Board"
            title="Save to Site Board"
          >
            <Bookmark size={13} strokeWidth={2.4}/>
          </button>
          <ShareButton
            shareUrl={shareUrl}
            shareText={`${deriveCardCaption(entry.subject)} · Thenetworkers`}
            variant="ghost"
          />
          <ReportContentButton
            context={{
              targetKind: entry.source === "submission" ? "submission" : "image",
              targetId:   entry.sourcePostId ?? entry.imageUrl,
              targetUrl:  shareUrl,
              targetLabel: deriveCardCaption(entry.subject).slice(0, 60)
            }}
          />
        </div>
      </div>
      <figcaption className="p-2.5">
        {creditNode}
        <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-700">
          {deriveCardCaption(entry.subject)}
        </p>

        {/* "3 nearest trades" chip row — real canteen names, not
            placeholder. Zero trades = hide the chip cluster entirely
            (empty row would read as broken). */}
        {nearestTrades.length > 0 && (
          <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Trades near you
            </div>
            <ul className="mt-1 flex flex-col gap-0.5">
              {nearestTrades.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/trade-off/yard/canteens/${c.slug}`}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-neutral-800 hover:underline"
                    style={{ color: TAN }}
                  >
                    <MapPin size={9} strokeWidth={2.6}/>
                    {c.hostDisplayName}
                    <span className="font-bold text-neutral-500">· {capitalise(canteenCityHint(c) || c.tradeLabel)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* "I like it, how much?" — routes a real quote request to
            the credit-chip trade (submission) or top nearest trade
            (curated). Never broadcasts to 3-nearest. Hidden when no
            target can be resolved rather than pointing the lead at
            a random trade. */}
        {targetTrade && (
          <button
            type="button"
            onClick={() =>
              onLikeIt({
                targetTradeSlug:  targetTrade.slug,
                targetTradeName:  targetTrade.displayName,
                targetCanteenSlug:targetTrade.canteenSlug,
                sourceImageUrl:   entry.imageUrl,
                sourcePostId:     entry.sourcePostId,
                sourceCanteenId:  entry.sourceCanteenId,
                projectLabel:     entry.keywords[0]
                  ? entry.keywords[0]
                    .split(/\s+/)
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")
                  : undefined
              })
            }
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            <Heart size={12} strokeWidth={2.6}/>
            I like it — how much?
          </button>
        )}

        {/* Materials list — only when the trade OR admin has tagged
            products visible in the image. Zero tags = no button
            (silence over wrong per
            feedback_never_suggest_extra_products.md). Never AI-
            inferred. Each tag is a direct link to the seller's
            exact product page. */}
        {entry.materials.length > 0 && (
          <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Get the materials
            </div>
            <ul className="mt-1 flex flex-col gap-0.5">
              {entry.materials.slice(0, 5).map((m) => (
                <li key={`${m.kind}:${m.ref}`}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-black text-neutral-800 hover:underline"
                    style={{ color: TAN }}
                  >
                    <span
                      aria-hidden
                      className="rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: m.kind === "hammerex" ? BRAND_BLACK : "rgba(184,134,11,0.15)", color: m.kind === "hammerex" ? BRAND_YELLOW : TAN }}
                    >
                      {m.kind === "hammerex" ? "Hammerex" : m.kind === "trade_center" ? "Trade Center" : "Buy"}
                    </span>
                    {m.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comments dropdown — only for submissions with an active
            source_post (the post the image originally shipped on).
            Hidden entirely when reply_count is 0 to avoid a dead
            "View comments" button that expands to nothing. Fetches
            /api/canteens/posts/[id]/replies lazily on first open. */}
        {isSubmission && entry.sourcePostId && entry.sourcePostReplyCount > 0 && (
          <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
            <button
              type="button"
              onClick={toggleComments}
              className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider transition hover:opacity-80"
              style={{ color: TAN }}
              aria-expanded={commentsOpen}
            >
              <MessageSquare size={11} strokeWidth={2.6}/>
              {commentsOpen ? "Hide comments" : `View ${entry.sourcePostReplyCount} comment${entry.sourcePostReplyCount === 1 ? "" : "s"}`}
            </button>
            {commentsOpen && (
              <div className="mt-2 rounded-lg bg-neutral-50 p-2">
                {commentsLoading && (
                  <div className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                    Loading…
                  </div>
                )}
                {!commentsLoading && comments && comments.length === 0 && (
                  <div className="text-[11px] text-neutral-500">
                    No comments loaded — the source post may have been rotated.
                  </div>
                )}
                {comments && comments.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {comments.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-md bg-white p-1.5 shadow-sm"
                        style={{ border: "1px solid rgba(139,69,19,0.08)" }}
                      >
                        <div className="flex items-baseline justify-between text-[9.5px] font-black uppercase tracking-wider">
                          <Link href={`/trade/${r.authorSlug}`} className="text-neutral-900 hover:underline">
                            {r.authorDisplayName}
                          </Link>
                          <span className="text-neutral-400">{shortAgo(r.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[11.5px] leading-snug text-neutral-800">
                          {r.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </figcaption>
    </figure>
  );
}

// ─── Transformations strip ────────────────────────────────────
//
// Full-width grid of BeforeAfterCard components rendered above the
// standard inspiration masonry. Uses a proper 2-3-4-column grid
// (not columns-masonry) so the cards land row-first — the drag-
// reveal wow lands in the top row, best-scoring transformations
// first. Every card links into the same quote-form modal via the
// shared onLikeIt callback so the funnel is identical to inspiration.

function TransformationsStrip({
  entries,
  query,
  city,
  onLikeIt,
  onSave: _onSave,
  onVisualise: _onVisualise
}: {
  entries: BeforeAfterEntry[];
  query: string;
  city: string;
  onLikeIt: (ctx: QuickContactContext) => void;
  /** Not yet wired into transformation cards — the BeforeAfterCard's
   *  Share button already exists; save-to-board + visualise on
   *  before/after come in a follow-up. Props accepted for API parity. */
  onSave?: (image: InspirationImage) => void;
  onVisualise?: (ctx: VisualiseContext) => void;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2
          className="text-[18px] font-black leading-tight text-neutral-900 md:text-[22px]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          Transformations
        </h2>
        <span className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
          {entries.length} before / after
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <TransformationCard
            key={entry.id}
            entry={entry}
            query={query}
            city={city}
            onLikeIt={onLikeIt}
          />
        ))}
      </div>
    </section>
  );
}

function TransformationCard({
  entry,
  query,
  city,
  onLikeIt
}: {
  entry: BeforeAfterEntry;
  query: string;
  city: string;
  onLikeIt: (ctx: QuickContactContext) => void;
}) {
  // Reuse the same trade-target resolution as InspirationCard so
  // the "I like it" lead routes to the same trade regardless of
  // which surface it fired from.
  const nearestTrades = useMemo(
    () => canteensForTradeQuery(entry.keywords_strict[0] ?? query, city, 1),
    [entry, query, city]
  );
  const targetTrade = nearestTrades[0]
    ? {
        slug:        nearestTrades[0].hostSlug,
        canteenSlug: nearestTrades[0].slug,
        displayName: nearestTrades[0].hostDisplayName
      }
    : null;
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/trade-off/search?q=${encodeURIComponent(entry.keywords_strict[0] ?? query)}&tab=inspiration`
    : `/trade-off/search?q=${encodeURIComponent(entry.keywords_strict[0] ?? query)}&tab=inspiration`;

  return (
    <BeforeAfterCard
      entry={entry}
      shareUrl={shareUrl}
      actionSlot={
        targetTrade && (
          <button
            type="button"
            onClick={() =>
              onLikeIt({
                targetTradeSlug:  targetTrade.slug,
                targetTradeName:  targetTrade.displayName,
                targetCanteenSlug:targetTrade.canteenSlug,
                sourceImageUrl:   entry.image_url ?? entry.after_url ?? entry.before_url ?? null,
                projectLabel:     entry.keywords_strict[0]
                  ? entry.keywords_strict[0]
                    .split(/\s+/)
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")
                  : undefined
              })
            }
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            <Heart size={12} strokeWidth={2.6}/>
            I like it — how much?
          </button>
        )
      }
    />
  );
}

// ─── Site Board picker modal ─────────────────────────────────
//
// Opens when the visitor taps the bookmark button on any Site
// Interest card. Lists their existing boards (fetched lazily on
// first open) + a "New board" row. Tapping a board POSTs the
// image to /api/site-boards/[id]/items and shows a success state
// before auto-closing. First-time users get a "My First Board"
// created automatically so they never see an empty picker.

type SiteBoardRow = {
  id: string;
  slug: string;
  name: string;
  itemCount: number;
  coverImageUrl: string | null;
};

function SiteBoardPickerModal({
  image,
  onClose
}: {
  image: InspirationImage;
  onClose: () => void;
}) {
  const [boards, setBoards] = useState<SiteBoardRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBoardId, setSavingBoardId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");

  // Escape + backdrop close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Initial fetch — if the caller has zero boards, auto-create
  // "My First Board" so they don't see an empty state. This is a
  // one-time nudge; from then on the list is their real boards.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/site-boards");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = (data.boards ?? []) as SiteBoardRow[];
        if (list.length === 0) {
          const createRes = await fetch("/api/site-boards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "My First Board", isPublic: false })
          });
          const created = await createRes.json().catch(() => ({}));
          if (created.ok && created.board) {
            setBoards([created.board]);
          } else {
            setBoards([]);
          }
        } else {
          setBoards(list);
        }
      } catch {
        if (!cancelled) setBoards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function saveToBoard(boardId: string) {
    if (savingBoardId) return;
    setSavingBoardId(boardId);
    setError(null);
    try {
      const res = await fetch(`/api/site-boards/${encodeURIComponent(boardId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl:   image.imageUrl,
          subject:    image.subject,
          sourceJson: {
            source:            image.source,
            keywords:          image.keywords,
            submitterSlug:     image.submitterSlug,
            submitterDisplay:  image.submitterDisplay,
            sourceCanteenSlug: image.sourceCanteenSlug,
            sourcePostId:      image.sourcePostId
          }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error === "add-failed" ? "Already saved to this board." : "Save failed — try again.");
        return;
      }
      setSaved(true);
      window.setTimeout(onClose, 1400);
    } finally {
      setSavingBoardId(null);
    }
  }

  async function createNewBoard() {
    const name = newName.trim();
    if (name.length < 1) return;
    setSavingBoardId("__new__");
    try {
      const res = await fetch("/api/site-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isPublic: true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.board) {
        setError("Couldn't create board — try again.");
        return;
      }
      setBoards((prev) => [data.board as SiteBoardRow, ...(prev ?? [])]);
      setCreatingNew(false);
      setNewName("");
      // Auto-save the pending image to the newly-created board.
      await saveToBoard(data.board.id);
    } finally {
      setSavingBoardId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ backgroundColor: "rgba(10,10,10,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div
          className="flex items-center justify-between px-5 py-2.5 sm:px-6"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
              aria-hidden
            >
              <Bookmark size={12} strokeWidth={2.6}/>
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.18em]">
              Site Board
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10"
          >
            <X size={15} strokeWidth={2.6}/>
          </button>
        </div>
        <div className="p-5 sm:p-6">

        {saved ? (
          <div className="text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(22,101,52,0.15)" }}
            >
              <BookmarkCheck size={26} strokeWidth={2.6} style={{ color: "#166534" }}/>
            </div>
            <h3 className="mt-3 text-[18px] font-black text-neutral-900">Saved to Site Board.</h3>
            <p className="mt-1 text-[12.5px] text-neutral-600">One tap away next time you open your boards.</p>
          </div>
        ) : (
          <>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Save to Site Board
            </div>
            <h3
              className="mt-1 text-[20px] font-black leading-tight text-neutral-900"
              style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
            >
              {creatingNew ? "New board" : "Pick a board"}
            </h3>

            <div className="mt-3 flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-md object-cover"/>
              <p className="line-clamp-2 text-[12px] leading-snug text-neutral-700">{image.subject}</p>
            </div>

            {loading && (
              <div className="mt-4 flex items-center justify-center gap-2 py-6 text-[12px] font-black text-neutral-500">
                <Loader2 size={13} className="animate-spin"/> Loading your boards…
              </div>
            )}

            {!loading && !creatingNew && (
              <>
                <ul className="mt-4 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                  {(boards ?? []).map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => saveToBoard(b.id)}
                        disabled={savingBoardId !== null}
                        className="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ borderColor: "rgba(139,69,19,0.15)" }}
                      >
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-neutral-100">
                          {b.coverImageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={b.coverImageUrl} alt="" className="h-full w-full object-cover"/>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-black text-neutral-900">{b.name}</div>
                          <div className="text-[10.5px] text-neutral-500">{b.itemCount} saved</div>
                        </div>
                        {savingBoardId === b.id
                          ? <Loader2 size={13} className="animate-spin text-neutral-400"/>
                          : <Plus size={13} strokeWidth={2.4} className="text-neutral-400"/>}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setCreatingNew(true)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <Plus size={13} strokeWidth={2.4}/>
                  Create new board
                </button>
              </>
            )}

            {!loading && creatingNew && (
              <div className="mt-4 flex flex-col gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.slice(0, 120))}
                  placeholder="e.g. Loft conversion inspo"
                  autoFocus
                  className="rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setCreatingNew(false); setNewName(""); }}
                    className="inline-flex flex-1 items-center justify-center rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={createNewBoard}
                    disabled={newName.trim().length < 1 || savingBoardId !== null}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
                    style={{ backgroundColor: BRAND_BLACK }}
                  >
                    {savingBoardId === "__new__" ? <Loader2 size={12} className="animate-spin"/> : "Create + save"}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black text-red-700">
                {error}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

/** Compact "5m", "3h", "2d" formatter for the inspiration comments
 *  dropdown — the card is small, no room for verbose timestamps. */
function shortAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function capitalise(s: string): string {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Yellow "Subscribed · Manage" banner. Manage opens the Stripe
 *  Billing Portal for the caller's Site sub via /api/site/portal.
 *  Bundling-tier subscribers don't render this — their sub belongs
 *  to the merchant listing, managed elsewhere. */
function SiteSubscriptionBanner() {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/site/portal", { method: "POST" });
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not open the billing portal.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
      style={{ borderColor: "rgba(139,69,19,0.12)", backgroundColor: "#0A0A0A", color: "white" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black"
          style={{ backgroundColor: BRAND_YELLOW, color: "#0A0A0A" }}
          aria-hidden
        >
          <Check size={12} strokeWidth={3}/>
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-black uppercase tracking-[0.14em]">
            The Site — Subscribed
          </span>
          <span className="text-[10px] text-neutral-300">
            Unlimited clean downloads · post to Canteen + Yard
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 disabled:opacity-60"
        style={{ backgroundColor: BRAND_YELLOW }}
        aria-label="Manage subscription"
      >
        {busy ? <Loader2 size={11} className="animate-spin"/> : null}
        Manage
      </button>
      {error && (
        <div className="ml-2 rounded-md bg-red-100 px-2 py-1 text-[10px] font-black text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
