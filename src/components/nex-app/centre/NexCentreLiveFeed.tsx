"use client";

// NexCentreLiveFeed — the customer-facing NEX Trade Centre.
//
// Phase 7 · Increment 4C. Replaces the demo Pinterest feed. Consumes
// live data from GET /api/nex/centre/feed. Renders a masonry-style
// grid of product cards with skeleton placeholders, infinite scroll,
// keyword search, simple filters, and a warm empty-state fallback.
//
// Design language (locked from the audit):
//   - light off-white base
//   - orange gradient accents used sparingly
//   - photograph-forward cards
//   - never surface loading spinners on empty screens; skeletons only
//
// Card content matches Philip's Increment 4C spec:
//   merchant logo · product image · title · price · merchant name ·
//   location · verified badge · Save · Share · WhatsApp · Email ·
//   View Merchant
//
// Everything else deliberately omitted — the cards stay clean.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronRight,
  DoorOpen,
  Grid3x3,
  LayoutGrid,
  Layers,
  MapPin,
  Megaphone,
  MessageSquare,
  SlidersHorizontal,
  Sparkles,
  Star,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";
import { readCentreFeedCache } from "@/lib/nex/centre-publishing/preloadCache";
import { DiagramCard } from "./DiagramCard";
import {
  listOpenProjects,
  PROJECTS_UPDATED_EVENT,
} from "@/lib/nex/projects/customer-store";
import type { BrainEntry } from "@/lib/nex/knowledge/retrieve";
import { NexBottomSheet } from "./NexBottomSheet";
import { ProductDetailsSheet } from "./ProductDetailsSheet";
import { MerchantProfileSheet } from "./MerchantProfileSheet";
import {
  interleaveInterstitials,
  type AdTile,
  type CategoryTile,
  type Interstitial,
  type TipTile,
} from "./interstitials";

type ApiResponse = {
  ok: boolean;
  items?: CentreFeedItem[];
  count?: number;
  error?: string;
};

type Filters = {
  postcode: string;
  category: string;
  min_price: string; // pounds, converted to pence for API
  max_price: string;
  verified_only: boolean;
  sort: "relevance" | "newest";
};

const PAGE_SIZE = 24;

const EMPTY_FILTERS: Filters = {
  postcode: "",
  category: "",
  min_price: "",
  max_price: "",
  verified_only: false,
  sort: "relevance",
};

function formatPrice(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

/** Build the query string for /api/nex/centre/feed from current UI state. */
function buildQuery(
  query: string,
  filters: Filters,
  offset: number
): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filters.postcode.trim()) params.set("postcode", filters.postcode.trim());
  if (filters.category.trim()) params.set("category", filters.category.trim());
  const minP = Number(filters.min_price);
  if (Number.isFinite(minP) && minP > 0)
    params.set("min_price", String(Math.round(minP * 100)));
  const maxP = Number(filters.max_price);
  if (Number.isFinite(maxP) && maxP > 0)
    params.set("max_price", String(Math.round(maxP * 100)));
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  return params.toString();
}

// ── AskNex chat panel state ───────────────────────────────────────
type AskNexReply = {
  reply: string;
  brain_matches: BrainEntry[];
};

export function NexCentreLiveFeed() {
  const [items, setItems] = useState<CentreFeedItem[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true); // first-load skeleton
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [emptyFallback, setEmptyFallback] = useState<CentreFeedItem[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // AskNex chat panel state
  const [askQuery, setAskQuery] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askReply, setAskReply] = useState<AskNexReply | null>(null);

  // Bottom-sheet stack. The last element is the top-most (visible)
  // sheet. Push to open, pop to close.
  type SheetEntry =
    | { kind: "product"; item: CentreFeedItem }
    | { kind: "merchant"; seed: CentreFeedItem };
  const [sheetStack, setSheetStack] = useState<SheetEntry[]>([]);
  const openProduct = useCallback((item: CentreFeedItem) => {
    setSheetStack((prev) => [...prev, { kind: "product", item }]);
  }, []);
  const openMerchant = useCallback((seed: CentreFeedItem) => {
    setSheetStack((prev) => [...prev, { kind: "merchant", seed }]);
  }, []);
  const popSheet = useCallback(() => {
    setSheetStack((prev) => prev.slice(0, -1));
  }, []);

  const askNex = useCallback(async () => {
    const q = askQuery.trim();
    if (!q || askLoading) return;
    setAskLoading(true);
    try {
      const res = await fetch("/api/nex/centre-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          postcode: filters.postcode.trim() || undefined,
        }),
      });
      const data = await res.json();
      setAskReply({
        reply: data?.reply ?? "NEX couldn't find anything for that.",
        brain_matches: Array.isArray(data?.brain_matches)
          ? (data.brain_matches as BrainEntry[])
          : [],
      });
      // Also drop the same query into the feed filter so cards below match
      setQuery(q);
    } catch {
      setAskReply({
        reply: "NEX is temporarily unavailable — please try again.",
        brain_matches: [],
      });
    } finally {
      setAskLoading(false);
    }
  }, [askQuery, askLoading, filters.postcode]);

  const toggleHeroChip = useCallback((label: string) => {
    setFilters((f) => ({
      ...f,
      category: f.category === label ? "" : label,
    }));
  }, []);

  // Debounce the search query (300ms) so keystrokes don't hammer the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const setSpinner = offset === 0 ? setLoading : setLoadingMore;
      setSpinner(true);
      setError(null);
      try {
        const qs = buildQuery(debouncedQuery, filters, offset);
        const res = await fetch(`/api/nex/centre/feed?${qs}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "feed_failed");
        }
        let fresh = data.items ?? [];

        // Client-side filters that the API doesn't handle server-side yet
        if (filters.verified_only) {
          fresh = fresh.filter(
            (i) =>
              i.merchant_verification_level === "verified" ||
              i.merchant_verification_level === "partner"
          );
        }
        if (filters.sort === "newest") {
          fresh = [...fresh].sort((a, b) =>
            (b.published_at ?? "").localeCompare(a.published_at ?? "")
          );
        }

        setItems((prev) => (append ? [...prev, ...fresh] : fresh));
        setHasMore(fresh.length >= PAGE_SIZE);

        // If the very first page came back empty AND the user is filtering,
        // fetch a fallback (unfiltered) page for the empty-state suggestions
        if (offset === 0 && fresh.length === 0 && (debouncedQuery || filters.category)) {
          const fbRes = await fetch(
            `/api/nex/centre/feed?limit=${PAGE_SIZE}`,
            { cache: "no-store" }
          );
          const fbData = (await fbRes.json()) as ApiResponse;
          setEmptyFallback(fbData.items ?? []);
        } else if (offset === 0) {
          setEmptyFallback([]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[NexCentreLiveFeed] fetch error", err);
        setError("NEX couldn't load the feed just now. Please try again.");
      } finally {
        setSpinner(false);
      }
    },
    [debouncedQuery, filters]
  );

  // Preserve flow between filter states — do NOT blank items on filter
  // change (Philip 2026-08-05). Old items dim while the new fetch is
  // in flight, then swap in place. Cold mount is the one exception:
  // check the preload cache first so entry from Home lands instantly.
  const hasRunFirstEffectRef = useRef(false);
  useEffect(() => {
    setHasMore(true);
    if (!hasRunFirstEffectRef.current) {
      hasRunFirstEffectRef.current = true;
      const url = `/api/nex/centre/feed?${buildQuery(debouncedQuery, filters, 0)}`;
      const cached = readCentreFeedCache(url);
      if (cached) {
        setItems(cached.items);
        setLoading(false);
        setHasMore(cached.items.length >= PAGE_SIZE);
        return;
      }
    }
    void fetchPage(0, false);
  }, [debouncedQuery, filters, fetchPage]);

  // IntersectionObserver-driven infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (
            e.isIntersecting &&
            !loading &&
            !loadingMore &&
            hasMore &&
            items.length > 0
          ) {
            void fetchPage(items.length, true);
          }
        }
      },
      { rootMargin: "600px" } // pre-fetch before the user hits bottom
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage, items.length, loading, loadingMore, hasMore]);

  const toggleSaved = useCallback((offerId: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.postcode.trim()) n++;
    if (filters.category.trim()) n++;
    if (filters.min_price || filters.max_price) n++;
    if (filters.verified_only) n++;
    if (filters.sort !== "relevance") n++;
    return n;
  }, [filters]);

  // Philip 2026-08-02 · Project Object v2 (Supabase-backed · async).
  // Watches the server-backed project store so the header can surface a
  // "My Projects · N" chip whenever the user has any open project. Hidden
  // entirely when N === 0 so the chip never adds noise for first-time
  // visitors. Refreshes on the same-tab custom event + on window focus
  // (cheap cross-tab approximation until Realtime lands in v2.5).
  const [openProjectCount, setOpenProjectCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const open = await listOpenProjects();
        if (!cancelled) setOpenProjectCount(open.length);
      } catch (err) {
        console.error("[centre-header][openProjects]", err);
      }
    };
    void refresh();
    const handler = () => { void refresh(); };
    window.addEventListener(PROJECTS_UPDATED_EVENT, handler);
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECTS_UPDATED_EVENT, handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[#faf7f2]">
      {/* ═════════════════════════════════════════════════════════════
          FLOATING HEADER — sits ON TOP of the hero image so it's
          always accessible AND the image is the visual hero. Bg is
          translucent cream + backdrop-blur so the image reads through
          when scrolled to the top.
          ═════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#faf7f2]/85 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold tracking-tight text-black">
              NEX Centre
            </div>
            <div className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Live
            </div>
            <div className="flex-1" />
            {openProjectCount > 0 && (
              // Philip 2026-08-02 · Continue chip (was "My Projects").
              // "People rarely want to start something new — they usually want
              // to continue something they've already begun." Home shortcut
              // uses this framing; the list page itself is titled "Projects".
              <Link
                href="/nex-app/projects"
                className="inline-flex flex-col items-center rounded-2xl border border-orange-300 bg-white px-3 py-1 text-orange-800 hover:bg-orange-50"
              >
                <span className="text-[11px] font-semibold leading-tight">Continue</span>
                <span className="text-[9px] leading-tight text-orange-700/80">
                  {openProjectCount} active {openProjectCount === 1 ? "project" : "projects"}
                </span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Filters"
              className={`relative flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                activeFilterCount > 0
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-black/10 bg-white text-black/70 hover:bg-black/5"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          {showFilters && (
            <div className="mt-2 rounded-2xl border border-black/10 bg-white p-3">
              <FilterPanel
                filters={filters}
                setFilters={setFilters}
                activeFilterCount={activeFilterCount}
                onClear={clearFilters}
              />
            </div>
          )}
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════
          HERO — image FIRST, floats under the translucent header.
          Card sits over the lower portion of the image.
          ═════════════════════════════════════════════════════════════ */}
      <section className="relative -mt-[52px] pt-[52px]" style={{ minHeight: 500 }}>
        {/* Real <img> for reliability (previous background-image sometimes
            flaked on cold caches) */}
        <img
          src="https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2012_12_45%20AM.png"
          alt="NEX Trade Centre"
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] w-full object-cover object-[left_center]"
          loading="eager"
          onError={(e) => {
            // Graceful fallback if the CDN is unreachable — solid
            // gradient replaces the missing image, keeps the hero
            // legible so nothing goes black.
            const el = e.currentTarget;
            el.style.display = "none";
            const fallback = el.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.opacity = "1";
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-br from-orange-200 via-amber-100 to-neutral-100 opacity-0 transition-opacity"
        />
        {/* Bottom cream scrim so card reads over any crop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0"
          style={{
            top: 280,
            height: 200,
            background:
              "linear-gradient(to top, #faf7f2 25%, transparent 100%)",
          }}
        />
        <div
          className="relative mx-4 max-w-4xl rounded-[22px] border border-black/10 bg-white px-4 py-4 shadow-lg md:mx-auto"
          style={{ marginTop: 280 }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
            NEX Trade Centre
          </div>
          <h2 className="mt-1 text-[22px] font-black leading-[1.08] tracking-tight text-black">
            What are you looking for?
          </h2>

          {/* Ask NEX search bar */}
          <div className="mt-3 flex items-center gap-2 rounded-full border border-black/10 bg-white pl-3.5 pr-1 py-1 shadow-sm">
            <input
              type="text"
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void askNex();
              }}
              placeholder="Type a product, service, supplier or ask NEX…"
              aria-label="Ask NEX"
              className="min-w-0 flex-1 bg-transparent py-2 text-[12px] text-black placeholder:text-black/45 outline-none"
            />
            <button
              type="button"
              onClick={() => void askNex()}
              disabled={askLoading || !askQuery.trim()}
              aria-label="Ask NEX"
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-2 text-[11px] font-black text-white transition-transform active:scale-95 disabled:opacity-55"
              style={{ boxShadow: "0 6px 16px -4px rgba(246,138,30,0.55)" }}
            >
              <Sparkles size={12} strokeWidth={2.5} />
              {askLoading ? "Thinking…" : "AskNex"}
            </button>
          </div>

          {/* NEX reply panel */}
          {askReply && (
            <div
              className="mt-3 rounded-2xl border border-black/10 bg-gradient-to-br from-orange-50 to-white px-3 py-3"
              style={{
                boxShadow: "0 8px 22px -14px rgba(246,138,30,0.35)",
              }}
            >
              <div className="flex items-start gap-2">
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                  <Sparkles size={11} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-600">
                    NEX
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-[1.5] text-black">
                    {askReply.reply}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAskReply(null)}
                  aria-label="Dismiss"
                  className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/50"
                >
                  <X size={11} strokeWidth={2} />
                </button>
              </div>
              {(() => {
                const seen = new Set<string>();
                return askReply.brain_matches
                  .filter(
                    (m) =>
                      m.diagram &&
                      m.diagram.url &&
                      !seen.has(m.diagram.url) &&
                      (seen.add(m.diagram.url), true)
                  )
                  .map((m) => (
                    <DiagramCard key={`diagram-${m.id}`} diagram={m.diagram!} />
                  ));
              })()}
            </div>
          )}

          {/* Trade-domain chips — Philip 2026-08-05. Reframed from entity types
              (Products/Suppliers/Services/Projects/Deals) to trade domains
              (Staircase/Kitchen/Doors/Flooring) so the filter composes with
              the Brain architecture: each chip corresponds to a NEX Brain.
              "All" leads the row so first-time visitors immediately see it
              as the default (mixed trades) and can explicitly return to it
              from any active filter. */}
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
            <HeroChip
              icon={LayoutGrid}
              label="All"
              active={filters.category === ""}
              onClick={() =>
                setFilters((f) => ({ ...f, category: "" }))
              }
            />
            <HeroChip
              icon={Layers}
              label="Staircase"
              active={filters.category === "Staircase"}
              onClick={() => toggleHeroChip("Staircase")}
            />
            <HeroChip
              icon={UtensilsCrossed}
              label="Kitchen"
              active={filters.category === "Kitchen"}
              onClick={() => toggleHeroChip("Kitchen")}
            />
            <HeroChip
              icon={DoorOpen}
              label="Doors"
              active={filters.category === "Doors"}
              onClick={() => toggleHeroChip("Doors")}
            />
            <HeroChip
              icon={Grid3x3}
              label="Flooring"
              active={filters.category === "Flooring"}
              onClick={() => toggleHeroChip("Flooring")}
            />
          </div>
        </div>
      </section>

      {/* Feed */}
      <main className="mx-auto max-w-4xl px-3 py-4">
        {error && (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <MasonrySkeleton />
        ) : items.length > 0 ? (
          <div
            className="transition-opacity duration-200"
            style={{ opacity: loading ? 0.45 : 1 }}
            aria-busy={loading || undefined}
          >
          <Masonry>
            {interleaveInterstitials(items, 5).map((tile) => {
              // Product tile
              if ("offer_id" in tile) {
                return (
                  <ProductCard
                    key={`p-${tile.offer_id}`}
                    item={tile}
                    onViewDetails={() => openMerchant(tile)}
                  />
                );
              }
              // Interstitial tile (category / tip / ad)
              const inter = tile as Interstitial;
              if (inter.kind === "category") {
                return (
                  <CategoryChipCard
                    key={`c-${inter.id}`}
                    tile={inter}
                    onSelect={() =>
                      setFilters((f) => ({ ...f, category: inter.label }))
                    }
                  />
                );
              }
              if (inter.kind === "tip") {
                return <NexTipCard key={`t-${inter.id}`} tile={inter} />;
              }
              return <AdCard key={`a-${inter.id}`} tile={inter} />;
            })}
          </Masonry>
          </div>
        ) : (
          <EmptyState
            query={debouncedQuery}
            category={filters.category}
            fallback={emptyFallback}
            onOpen={openMerchant}
          />
        )}

        {/* Infinite-scroll sentinel */}
        {items.length > 0 && (
          <div ref={sentinelRef} className="h-16 py-4">
            {loadingMore && (
              <div className="text-center text-xs text-black/40">
                Loading more…
              </div>
            )}
            {!loadingMore && !hasMore && (
              <div className="text-center text-xs text-black/40">
                That's everything for now.
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═════════════════════════════════════════════════════════════
          BOTTOM SHEET STACK — one reusable NexBottomSheet, arbitrarily
          many layered on top. Product opens the ProductDetailsSheet;
          tapping the merchant strip inside pushes a MerchantProfileSheet
          on top. Tap-out or Escape closes the top-most one.
          ═════════════════════════════════════════════════════════════ */}
      {sheetStack.map((entry, i) => {
        const isTop = i === sheetStack.length - 1;
        const zIndex = 50 + i * 10;
        if (entry.kind === "product") {
          return (
            <NexBottomSheet
              key={`prod-${i}`}
              open
              onClose={popSheet}
              eyebrow="Product"
              zIndex={zIndex}
            >
              {isTop && (
                <ProductDetailsSheet
                  item={entry.item}
                  saved={saved.has(entry.item.offer_id)}
                  onSaveToggle={() => toggleSaved(entry.item.offer_id)}
                  onOpenMerchant={() => openMerchant(entry.item)}
                  onSelectProduct={(p) => {
                    // Swap the top-most product for the newly-selected
                    // one, in-sheet — no extra layer, no navigation
                    setSheetStack((prev) => {
                      const next = [...prev];
                      next[next.length - 1] = { kind: "product", item: p };
                      return next;
                    });
                  }}
                />
              )}
            </NexBottomSheet>
          );
        }
        return (
          <NexBottomSheet
            key={`merch-${i}`}
            open
            onClose={popSheet}
            eyebrow="Merchant"
            zIndex={zIndex}
          >
            {isTop && (
              <MerchantProfileSheet
                seed={entry.seed}
                onSelectProduct={(p) => {
                  openProduct(p);
                }}
              />
            )}
          </NexBottomSheet>
        );
      })}
    </div>
  );
}

// ── Card + supporting UI ─────────────────────────────────────────

function Masonry({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ columnGap: "0.75rem" }}
      className="columns-2 sm:columns-3 md:columns-4"
    >
      {children}
    </div>
  );
}

function MasonrySkeleton() {
  return (
    <Masonry>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="mb-3 break-inside-avoid rounded-2xl border border-black/5 bg-white p-2 shadow-sm"
        >
          <div
            className="mb-2 w-full animate-pulse rounded-xl bg-black/5"
            style={{ height: `${140 + ((i * 37) % 100)}px` }}
          />
          <div className="mb-1 h-3 w-3/4 animate-pulse rounded bg-black/5" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-black/5" />
        </div>
      ))}
    </Masonry>
  );
}

function FilterPanel({
  filters,
  setFilters,
  activeFilterCount,
  onClear,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  activeFilterCount: number;
  onClear: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-black/60">Category</span>
          <input
            type="text"
            value={filters.category}
            onChange={(e) =>
              setFilters((f) => ({ ...f, category: e.target.value }))
            }
            placeholder="e.g. staircase, tiles"
            className="rounded-lg border border-black/10 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-black/60">Your postcode</span>
          <input
            type="text"
            value={filters.postcode}
            onChange={(e) =>
              setFilters((f) => ({ ...f, postcode: e.target.value }))
            }
            placeholder="e.g. M20"
            className="rounded-lg border border-black/10 px-2 py-1.5 uppercase"
            maxLength={12}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-black/60">Min price (£)</span>
          <input
            type="number"
            inputMode="decimal"
            value={filters.min_price}
            onChange={(e) =>
              setFilters((f) => ({ ...f, min_price: e.target.value }))
            }
            className="rounded-lg border border-black/10 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-black/60">Max price (£)</span>
          <input
            type="number"
            inputMode="decimal"
            value={filters.max_price}
            onChange={(e) =>
              setFilters((f) => ({ ...f, max_price: e.target.value }))
            }
            className="rounded-lg border border-black/10 px-2 py-1.5"
          />
        </label>
        <label className="col-span-2 mt-1 flex items-center justify-between gap-2">
          <span className="text-black/70">Verified merchants only</span>
          <input
            type="checkbox"
            checked={filters.verified_only}
            onChange={(e) =>
              setFilters((f) => ({ ...f, verified_only: e.target.checked }))
            }
            className="h-4 w-4"
          />
        </label>
        <label className="col-span-2 flex items-center justify-between gap-2">
          <span className="text-black/70">Sort</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                sort: e.target.value as Filters["sort"],
              }))
            }
            className="rounded-lg border border-black/10 px-2 py-1"
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 w-full rounded-full border border-black/10 py-1.5 text-xs text-black/60 hover:bg-black/5"
        >
          Clear all
        </button>
      )}
    </>
  );
}

function HeroChip({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-transform active:scale-95 ${
        active
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-black/10 bg-white text-black/70 hover:bg-black/5"
      }`}
    >
      <Icon size={12} strokeWidth={2.5} />
      {label}
    </button>
  );
}

// Deterministic size bucket for masonry variety.
//
// Philip 2026-08-02 · Trade Center v2 · tier + promotion drive card size.
// Business intent: the image aspect ratio IS a commercial lever.
// PAID-TIER merchants (starter / professional / business / works) OR
// legacy `is_promoted` records get the full-height featured card (3/5).
// FREE-TIER merchants deterministically hash into (70% short · 25% medium ·
// 5% tall) so free members still get regular visibility and an occasional
// surprise slot — the feed doesn't feel like only paid members exist.
const PAID_TIERS = new Set([
  "starter", "professional", "business", "works",
  // Legacy hammerex_trade_off_listings tier values that also represent paid state
  "app_trial", "app_paid", "app_verified", "verified", "verified_plus",
]);
function isPaidTier(item: CentreFeedItem): boolean {
  return (item.merchant_tier != null && PAID_TIERS.has(item.merchant_tier)) || item.is_promoted;
}
function cardAspect(item: CentreFeedItem): string {
  if (isPaidTier(item)) return "3 / 5"; // tallest — paid featured slot
  let h = 0;
  for (let i = 0; i < item.offer_id.length; i++) {
    h = ((h << 5) - h) + item.offer_id.charCodeAt(i);
    h |= 0;
  }
  const bucket = Math.abs(h) % 100;
  if (bucket < 70) return "3 / 4"; // 70% short  — free tier baseline
  if (bucket < 95) return "4 / 5"; // 25% medium — free tier occasional
  return "2 / 3"; // 5% tall — free tier surprise
}

// Compact star-rating row · only rendered when a rating value exists
// (no fabricated 5-star badges on merchants we don't have data for).
function StarRating({
  rating, count,
}: {
  rating: number | null;
  count: number | null;
}) {
  if (rating == null) return null;
  const rounded = Math.round(rating * 10) / 10;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-black/70">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={0} />
      {rounded.toFixed(1)}
      {count != null && count > 0 && (
        <span className="text-black/40">({count})</span>
      )}
    </span>
  );
}

// Philip 2026-08-02 · Trade Centre v3 · aspect-aware ImageKit crop.
// The feed picks staircase imagery per merchant (matcher + interim
// placeholder), but the server-side crop bakes ar-3-4 into every URL.
// Cards render at DIFFERENT aspects (paid=3/5 · free hash-based 3/4 ·
// 4/5 · 2/3) so a single baked crop over-stretches on the taller slots.
// This helper rewrites the ImageKit `tr=ar-X-Y` param to match the
// card's actual aspect so the staircase always fits cleanly — no
// letterboxing, no double-cropping via object-cover. No-op for
// non-ImageKit URLs.
function cropForAspect(url: string | null, aspect: string): string | null {
  if (!url) return null;
  if (!url.includes("ik.imagekit.io")) return url;
  const arParam = "ar-" + aspect.replace(/\s+/g, "").replace("/", "-");
  // If URL already has tr=..., replace the ar-X-Y segment. If ar param
  // isn't present in the tr= string, append it. Preserves other tr= flags
  // (w-, fo-, q-) that the server-side crop baked in.
  if (url.includes("tr=")) {
    if (/ar-\d+-\d+/.test(url)) {
      return url.replace(/ar-\d+-\d+/, arParam);
    }
    return url.replace(/tr=/, `tr=${arParam},`);
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}tr=w-800,${arParam},fo-auto,q-90`;
}

// Small gray verification pill — subtle by design. Trust level is
// signalled by the dot colour, not a loud coloured background.
function VerifiedPip({
  level,
}: {
  level: CentreFeedItem["merchant_verification_level"];
}) {
  if (level === "listed") return null;
  const dot =
    level === "partner"
      ? "bg-amber-500"
      : level === "verified"
      ? "bg-emerald-500"
      : "bg-blue-500";
  const label =
    level === "partner" ? "Partner" : level === "verified" ? "Verified" : "Claimed";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function ProductCard({
  item,
  onViewDetails,
}: {
  item: CentreFeedItem;
  onViewDetails: () => void;
}) {
  const price = formatPrice(item.price_pence);
  const location =
    item.merchant_city ?? item.merchant_postcode_prefix ?? "UK";
  const aspect = cardAspect(item);
  const topCategory = item.category_path[0];
  // Philip 2026-08-02 · Trade Centre v3 · users tapping an image ask
  // "who built that?" — route to the merchant profile, not the product
  // sheet. The product sheet is still reachable from the merchant profile.
  const merchantName = item.merchant_display_name ?? item.brand_name;
  // Rewrite the ImageKit crop to match THIS card's aspect so the staircase
  // photo fits cleanly · no letterboxing · no browser-side stretching.
  const heroImageUrl = cropForAspect(item.hero_image_url, aspect);

  return (
    <article className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Whole image is clickable — image tap opens the MERCHANT profile
          (Trade Centre v3 · Philip 2026-08-02). "Who built that?" wins over
          "show me product details". */}
      <button
        type="button"
        onClick={onViewDetails}
        aria-label={`View ${merchantName}`}
        className="relative block w-full overflow-hidden"
        style={{ aspectRatio: aspect }}
      >
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
        )}

        {/* Orange "Promoted" pill — the only splash of colour, only
            appears on paid slots. Keeps the "some orange badges"
            aesthetic loud enough to be an aspirational upsell but
            rare enough not to feel spammy. */}
        {item.is_promoted && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
            Promoted
          </span>
        )}

        {/* Admin ref badge — copyable NEX-D-XXX identifier for
            directory-seed curation. Sits top-right so it doesn't
            clash with the Promoted pill. Hidden until curation is
            done (remove the badge or gate on ?admin=1 later). */}
        {item.admin_ref && <AdminRefBadge refCode={item.admin_ref} />}
      </button>

      <div className="p-3">
        {/* Title · also routes to merchant profile (Trade Centre v3). */}
        <button
          type="button"
          onClick={onViewDetails}
          className="block w-full text-left text-sm font-semibold leading-tight text-black line-clamp-2 hover:underline"
        >
          {item.name}
        </button>

        {/* Price — hidden for directory listings (price_pence = 0). */}
        {item.price_pence > 0 ? (
          <div className="mt-1 text-base font-semibold text-black">{price}</div>
        ) : (
          <div className="mt-1 text-[11px] font-medium text-black/50">
            Directory listing
          </div>
        )}

        {/* Merchant name — hide when same as product name (directory
            listings, where name = brand = merchant). */}
        {(item.merchant_display_name ?? item.brand_name) !== item.name && (
          <div className="mt-1.5 truncate text-[11px] text-black/70">
            {item.merchant_display_name ?? item.brand_name}
          </div>
        )}

        {/* Star rating · only rendered when merchant has one (no fabricated data). */}
        {item.merchant_google_rating != null && (
          <div className="mt-1.5">
            <StarRating
              rating={item.merchant_google_rating}
              count={item.merchant_google_review_count}
            />
          </div>
        )}

        {/* Meta pills — all small gray, uniform weight */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <VerifiedPip level={item.merchant_verification_level} />
          {topCategory && (
            <span className="inline-flex items-center rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
              {topCategory}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
            <MapPin className="h-2 w-2" />
            {location}
          </span>
        </div>

        {/* Philip 2026-08-02 · Trade Center v2 · orange "View Details" primary CTA.
            Every card (free + paid) gets this button — the slide-up panel is the
            same for both, only the card sizing above changes. */}
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-orange-500 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-orange-600"
        >
          <MessageSquare className="h-3 w-3" strokeWidth={2.5} />
          View Details
        </button>
      </div>
    </article>
  );
}

// ── Admin ref badge (curation aid) ───────────────────────────────

function AdminRefBadge({ refCode }: { refCode: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      });
    }
  };
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCopy(e as unknown as React.MouseEvent);
      }}
      className="absolute right-2 top-2 z-10 inline-flex cursor-pointer items-center gap-1 rounded-md border border-black/20 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/85"
      title="Click to copy"
    >
      {copied ? "copied!" : refCode}
    </span>
  );
}

// ── Interstitial tiles ───────────────────────────────────────────

function CategoryChipCard({
  tile,
  onSelect,
}: {
  tile: CategoryTile;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group mb-3 flex w-full break-inside-avoid items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2.5 text-left shadow-sm hover:bg-black/[0.02]"
    >
      <span className="flex min-w-0 items-center gap-2">
        {tile.emoji && (
          <span className="text-base leading-none" aria-hidden>
            {tile.emoji}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold text-black">
            {tile.label}
          </span>
          <span className="block text-[10px] text-black/50">
            {tile.count} items
          </span>
        </span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 flex-none text-black/40 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function NexTipCard({ tile }: { tile: TipTile }) {
  return (
    <div className="mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <Sparkles className="h-2 w-2" strokeWidth={2.5} />
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-600">
          NEX Advice
        </span>
      </div>
      <div className="mt-1.5 text-[11.5px] font-semibold leading-snug text-black">
        {tile.headline}
      </div>
      <div className="mt-1 text-[10.5px] leading-relaxed text-black/65">
        {tile.body}
      </div>
    </div>
  );
}

function AdCard({ tile }: { tile: AdTile }) {
  const accent = tile.accent ?? "bg-neutral-50";
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className={`mb-3 block break-inside-avoid overflow-hidden rounded-2xl border border-black/5 ${accent} p-3 shadow-sm transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-black/50">
          <Megaphone className="h-2 w-2" />
          Sponsored
        </span>
        <span className="text-[9px] font-medium text-black/40">Ad</span>
      </div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-black/50">
        {tile.brand}
      </div>
      <div className="mt-0.5 text-[12.5px] font-bold leading-tight text-black">
        {tile.headline}
      </div>
      <div className="mt-1 text-[10.5px] leading-relaxed text-black/60">
        {tile.sub}
      </div>
      <div className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-black">
        {tile.cta}
        <ChevronRight className="h-3 w-3" />
      </div>
    </a>
  );
}

function EmptyState({
  query,
  category,
  fallback,
  onOpen,
}: {
  query: string;
  category: string;
  fallback: CentreFeedItem[];
  onOpen: (item: CentreFeedItem) => void;
}) {
  // Philip 2026-08-05 · D1-a principle: a capability may exist before it
  // has content, but the interface must never pretend it has content.
  // When the user has filtered to a trade domain that has no merchants
  // yet (Doors, Flooring, etc.), do NOT surface random fallback items —
  // that would read as "we found something" when we haven't. Show the
  // truthful empty state and redirect the user to Ask NEX, which knows
  // the domain even without merchants.
  if (category && fallback.length > 0) {
    return (
      <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-black/5 bg-white p-6 text-center">
        <Sparkles className="mx-auto h-7 w-7 text-orange-500" />
        <div className="mt-3 text-base font-semibold text-black">
          No {category} merchants in NEX yet.
        </div>
        <div className="mt-1 text-xs leading-relaxed text-black/60">
          Ask NEX about {category.toLowerCase()} above — we know the domain
          even where we don't yet have merchants.
        </div>
      </div>
    );
  }
  if (fallback.length > 0) {
    return (
      <div>
        <div className="mx-auto mb-4 max-w-md rounded-2xl border border-black/5 bg-white p-4 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-orange-500" />
          <div className="mt-2 text-sm font-medium text-black">
            NEX couldn't find exactly {query ? `"${query}"` : "that"}.
          </div>
          <div className="mt-1 text-xs text-black/60">
            Try one of these instead.
          </div>
        </div>
        <Masonry>
          {fallback.map((item) => (
            <ProductCard
              key={item.offer_id}
              item={item}
              onViewDetails={() => onOpen(item)}
            />
          ))}
        </Masonry>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-black/5 bg-white p-6 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-orange-500" />
      <div className="mt-3 text-base font-semibold text-black">
        Nothing published yet.
      </div>
      <div className="mt-1 text-xs text-black/60">
        NEX will fill this page as merchants publish products.
      </div>
    </div>
  );
}
