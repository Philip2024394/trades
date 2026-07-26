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

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BadgeCheck,
  Building2,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";
import { DiagramCard } from "./DiagramCard";
import type { BrainEntry } from "@/lib/nex/knowledge/retrieve";

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

  // Reset + fetch page 0 whenever query or filters change
  useEffect(() => {
    setItems([]);
    setHasMore(true);
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

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      {/* Sticky mini-header — always shows the tight search + filters */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#faf7f2]/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold tracking-tight text-black">
              NEX Centre
            </div>
            <div className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Live
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search oak treads, glass balustrade, joiners…"
                className="w-full rounded-full border border-black/10 bg-white pl-9 pr-3 py-2 text-sm focus:border-black/30 focus:outline-none"
                aria-label="Search NEX Centre"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-black/40 hover:bg-black/5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Filters"
              className={`relative flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-medium ${
                activeFilterCount > 0
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-black/10 bg-white text-black/70 hover:bg-black/5"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
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
                      setFilters((f) => ({
                        ...f,
                        verified_only: e.target.checked,
                      }))
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
                  onClick={clearFilters}
                  className="mt-3 w-full rounded-full border border-black/10 py-1.5 text-xs text-black/60 hover:bg-black/5"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Hero container — big image backdrop + ask NEX + quick chips */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{
            height: 64,
            background:
              "linear-gradient(to bottom, #faf7f2 0%, transparent 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: 400,
            backgroundImage:
              'url("https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2012_12_45%20AM.png")',
            backgroundSize: "cover",
            backgroundPosition: "left center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "#faf7f2",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0"
          style={{
            top: 260,
            height: 160,
            background:
              "linear-gradient(to top, #faf7f2 25%, transparent 100%)",
          }}
        />
        <div
          className="relative mx-4 max-w-4xl rounded-[22px] border border-black/10 bg-white px-4 py-4 shadow-lg md:mx-auto"
          style={{ marginTop: 250 }}
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

              {/* Educational diagrams from matched Brain entries */}
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

          {/* Quick-filter chips */}
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
            <HeroChip
              icon={ShoppingBag}
              label="Products"
              active={filters.category === "Products"}
              onClick={() => toggleHeroChip("Products")}
            />
            <HeroChip
              icon={Users}
              label="Suppliers"
              active={filters.category === "Suppliers"}
              onClick={() => toggleHeroChip("Suppliers")}
            />
            <HeroChip
              icon={Wrench}
              label="Services"
              active={filters.category === "Services"}
              onClick={() => toggleHeroChip("Services")}
            />
            <HeroChip
              icon={Building2}
              label="Projects"
              active={filters.category === "Projects"}
              onClick={() => toggleHeroChip("Projects")}
            />
            <HeroChip
              icon={Tag}
              label="Deals"
              active={filters.category === "Deals"}
              onClick={() => toggleHeroChip("Deals")}
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
          <Masonry>
            {items.map((item) => (
              <ProductCard
                key={item.offer_id}
                item={item}
                saved={saved.has(item.offer_id)}
                onSaveToggle={() => toggleSaved(item.offer_id)}
              />
            ))}
          </Masonry>
        ) : (
          <EmptyState
            query={debouncedQuery}
            fallback={emptyFallback}
            saved={saved}
            onSaveToggle={toggleSaved}
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

function VerifiedBadge({
  level,
}: {
  level: CentreFeedItem["merchant_verification_level"];
}) {
  if (level === "listed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-medium text-black/60">
        Listed
      </span>
    );
  }
  const label =
    level === "partner" ? "NEX Partner" : level === "verified" ? "Verified" : "Claimed";
  const colour =
    level === "partner"
      ? "bg-amber-100 text-amber-700"
      : level === "verified"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${colour}`}
    >
      <BadgeCheck className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function ProductCard({
  item,
  saved,
  onSaveToggle,
}: {
  item: CentreFeedItem;
  saved: boolean;
  onSaveToggle: () => void;
}) {
  const price = formatPrice(item.price_pence);
  const location =
    item.merchant_city ??
    item.merchant_postcode_prefix ??
    "UK";
  const distance =
    item.distance_km != null ? ` · ${Math.round(item.distance_km)}km` : "";

  const whatsappUrl = item.merchant_whatsapp
    ? `https://wa.me/${item.merchant_whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi, I saw your ${item.name} on NEX Centre.`
      )}`
    : null;

  const mailtoUrl = item.merchant_email
    ? `mailto:${item.merchant_email}?subject=${encodeURIComponent(
        `NEX Centre enquiry: ${item.name}`
      )}`
    : null;

  const handleShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/nex-app/centre#${item.offer_id}`
        : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: item.name, text: item.brand_name, url });
      } catch {
        // user cancelled — ignore
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
    }
  };

  return (
    <article className="mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      {/* Product image */}
      {item.hero_image_url ? (
        <img
          src={item.hero_image_url}
          alt={item.name}
          loading="lazy"
          className="w-full object-cover"
          style={{ aspectRatio: "3 / 4" }}
        />
      ) : (
        <div
          className="w-full bg-gradient-to-br from-neutral-100 to-neutral-200"
          style={{ aspectRatio: "3 / 4" }}
        />
      )}

      <div className="p-3">
        {/* Merchant strip: logo + name + verified */}
        <div className="mb-2 flex items-center gap-2">
          {item.merchant_avatar_url ? (
            <img
              src={item.merchant_avatar_url}
              alt=""
              loading="lazy"
              className="h-5 w-5 flex-none rounded-full object-cover"
            />
          ) : (
            <div className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-orange-100">
              <Store className="h-2.5 w-2.5 text-orange-700" />
            </div>
          )}
          <div className="min-w-0 flex-1 truncate text-[11px] text-black/60">
            {item.merchant_display_name ?? item.brand_name}
          </div>
          <VerifiedBadge level={item.merchant_verification_level} />
        </div>

        {/* Product title */}
        <div className="text-sm font-semibold leading-tight text-black">
          {item.name}
        </div>

        {/* Price + location */}
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <div className="text-base font-semibold text-black">{price}</div>
          <div className="flex items-center gap-0.5 text-[10px] text-black/50">
            <MapPin className="h-2.5 w-2.5" />
            {location}
            {distance}
          </div>
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={onSaveToggle}
            aria-label={saved ? "Unsave" : "Save"}
            className={`flex h-8 flex-1 items-center justify-center rounded-full border ${
              saved
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-black/10 text-black/60 hover:bg-black/5"
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex h-8 flex-1 items-center justify-center rounded-full border border-black/10 text-black/60 hover:bg-black/5"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp merchant"
              className="flex h-8 flex-1 items-center justify-center rounded-full bg-[#25D366] text-white hover:opacity-90"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          {mailtoUrl && (
            <a
              href={mailtoUrl}
              aria-label="Email merchant"
              className="flex h-8 flex-1 items-center justify-center rounded-full border border-black/10 text-black/60 hover:bg-black/5"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* View merchant link */}
        {item.merchant_slug && (
          <Link
            href={`/trade/${item.merchant_slug}`}
            className="mt-2 block w-full rounded-full bg-black py-1.5 text-center text-[11px] font-medium text-white hover:bg-black/85"
          >
            View merchant
          </Link>
        )}
      </div>
    </article>
  );
}

function EmptyState({
  query,
  fallback,
  saved,
  onSaveToggle,
}: {
  query: string;
  fallback: CentreFeedItem[];
  saved: Set<string>;
  onSaveToggle: (id: string) => void;
}) {
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
              saved={saved.has(item.offer_id)}
              onSaveToggle={() => onSaveToggle(item.offer_id)}
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
