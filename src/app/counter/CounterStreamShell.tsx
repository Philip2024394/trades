"use client";

// CounterStreamShell — client-side interactive view for /counter.
// Owns filter state + the composer modal trigger. Renders the same
// SideLanePost data that appears on every canteen's Counter strip.

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { BRAND_YELLOW, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import type { SideLanePost } from "@/lib/canteens";
import { CounterComposerModal } from "@/components/xrated/yard/CounterComposerModal";
import { CounterListingSheet } from "@/components/xrated/yard/CounterListingSheet";

type Filter = "all" | "sale" | "make-offer" | "wanted";

export function CounterStreamShell({ posts }: { posts: SideLanePost[] }) {
  const router          = useRouter();
  const searchParams    = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [composerOpen, setComposerOpen] = useState(false);

  // URL-synced detail sheet — ?id=<postId> opens the slide-out;
  // clearing the param closes it. Browser back button closes it too.
  const activeId  = searchParams?.get("id") ?? null;
  const activePost = useMemo(
    () => activeId ? posts.find((p) => p.id === activeId) ?? null : null,
    [activeId, posts]
  );
  function openListing(id: string) {
    const q = new URLSearchParams(searchParams?.toString() ?? "");
    q.set("id", id);
    router.push(`/counter?${q.toString()}`, { scroll: false });
  }
  function closeListing() {
    const q = new URLSearchParams(searchParams?.toString() ?? "");
    q.delete("id");
    const qs = q.toString();
    router.push(qs ? `/counter?${qs}` : "/counter", { scroll: false });
  }
  useEffect(() => { /* keep effect slot for future analytics on sheet open */ }, [activeId]);

  // Live-only + Phase-1 filter narrowing (kind mapping done at render
  // time so future kinds slot in without a data refetch).
  const live = useMemo(
    () => posts.filter((p) => p.state === "live"),
    [posts]
  );
  const shown = useMemo(() => {
    if (filter === "all") return live;
    // SideLanePost.kind is one of merchant-marketing / trade-center-product /
    // member-listing. Underlying canteen post kind is counter | make-offer.
    // Once the underlying kind is exposed on SideLanePost we split cleanly;
    // for now everything renders under "all" for Phase 1.
    return live;
  }, [live, filter]);

  // Rendered inside Trade Center chrome (the merged Live tab) so this
  // is a section, not a full page — outer layout owns min-h-screen +
  // background. Kept semantic <section> for a11y.
  return (
    <section className="pb-12" style={{ backgroundColor: "#FBF6EC" }}>
      {/* Header */}
      <header className="border-b shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FBF6EC" }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-5 md:px-6">
          <div>
            <div className="inline-flex items-center gap-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">The Counter · Live</p>
            </div>
            <h1 className="mt-1 text-[24px] font-black leading-tight text-neutral-900 md:text-[28px]">
              Trade + supplier listings, right now
            </h1>
            <p className="mt-1 text-[12px] text-neutral-600 md:text-[13px]">
              Every canteen's for-sale, for-hire + surplus signals fanned into one live feed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW, color: "#0A0A0A" }}
          >
            <Plus size={14} strokeWidth={2.6}/>
            Post to Counter
          </button>
        </div>
      </header>

      {/* Filter strip */}
      <div className="border-b" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FBF6EC" }}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-4 py-3 md:px-6">
          <FilterPill label={`All · ${live.length}`}    active={filter === "all"}         onClick={() => setFilter("all")}/>
          <FilterPill label="For sale"                  active={filter === "sale"}        onClick={() => setFilter("sale")}/>
          <FilterPill label="Make me an offer"          active={filter === "make-offer"}  onClick={() => setFilter("make-offer")}/>
          <FilterPill label="Wanted"                    active={filter === "wanted"}      onClick={() => setFilter("wanted")}/>
          <span className="ml-auto text-[10px] text-neutral-400">
            <Link href="/counter/terms" className="hover:text-neutral-700">Rules</Link>
          </span>
        </div>
      </div>

      {/* Feed */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        {shown.length === 0 ? (
          <EmptyState onCompose={() => setComposerOpen(true)}/>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => {
              const isBoosted = Boolean(p.boost?.expiresAt && Date.parse(p.boost.expiresAt) > Date.now());
              const isSold    = p.state === "sold";
              return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => openListing(p.id)}
                  className="group flex w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    borderColor: isBoosted ? BRAND_YELLOW : "rgba(139,69,19,0.10)",
                    borderWidth: isBoosted ? 2 : 1
                  }}
                >
                  <div
                    className="relative aspect-[4/3] w-full flex-shrink-0 bg-neutral-100"
                    style={{
                      backgroundImage: p.imageUrl ? `url('${p.imageUrl}')` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                    aria-hidden
                  >
                    {/* Trade chip — top-left. Only when we resolved a
                        primary trade for the poster. Aids mental
                        filtering on browse. */}
                    {p.posterTradeSlug && (
                      <span
                        className="absolute left-2 top-2 inline-flex items-center rounded-full bg-white/95 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                      >
                        {p.posterTradeSlug.replace(/-/g, " ")}
                      </span>
                    )}
                    {/* State badge — top-right. SOLD / RESERVED
                        prevents wasted taps + disappointment. */}
                    {isSold && (
                      <span
                        className="absolute right-2 top-2 inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-white shadow-sm"
                        style={{ backgroundColor: "#B91C1C" }}
                      >
                        Sold
                      </span>
                    )}
                    {/* Boosted chip — bottom-left, only when a boost is
                        actively paid + hasn't expired. Ring on the
                        card + a small pill for scannable trust signal. */}
                    {isBoosted && !isSold && (
                      <span
                        className="absolute bottom-2 left-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                        style={{ backgroundColor: BRAND_YELLOW }}
                      >
                        Boosted
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[12.5px] font-black text-neutral-900">{p.posterDisplayName}</p>
                      {typeof p.priceGbp === "number" && (
                        <span className="flex-shrink-0 text-[13px] font-black tabular-nums" style={{ color: "#166534" }}>
                          £{p.priceGbp.toLocaleString("en-GB")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-tight text-neutral-600">
                      {p.headline}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                      <span className="tabular-nums">{shortAgo(p.postedAt)}</span>
                      <span className="inline-flex items-center gap-0.5 font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                        Open <ArrowUpRight size={10} strokeWidth={2.6}/>
                      </span>
                    </div>
                  </div>
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      <CounterComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={() => { window.location.reload(); }}
      />
      <CounterListingSheet post={activePost} onClose={closeListing}/>
    </section>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: BRAND_GREEN_DARK, color: "#FFFFFF", borderColor: "transparent" }
          : { backgroundColor: "#E5E7EB",       color: "#4B5563", borderColor: "transparent" }
      }
    >
      {label}
    </button>
  );
}

function EmptyState({ onCompose }: { onCompose: () => void }) {
  return (
    <div
      className="rounded-2xl border-2 border-dashed bg-white p-10 text-center"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      <p className="text-[13px] font-black text-neutral-900">Nothing on The Counter yet</p>
      <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
        The Counter is the live cross-canteen marketplace stream. Every canteen's for-sale and for-hire posts land here.
      </p>
      <button
        type="button"
        onClick={onCompose}
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        <Plus size={14} strokeWidth={2.6}/>
        Post the first listing
      </button>
    </div>
  );
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return "now";
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}
