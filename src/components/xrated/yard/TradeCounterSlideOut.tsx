// TradeCounterSlideOut — right-edge drawer at 70% viewport width on
// desktop, full-screen on mobile. Shows the running Trade Counter
// classifieds feed (For Sale / Swap / Free) with a live countdown per
// listing. Keeps The Yard visible underneath so the user can pop in
// for 30 seconds without losing their scroll position.
//
// Data source: fixtures from src/apps/tradeCounter/data/listings.ts
// so the drawer works out of the box; swap for a live feed later.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Handshake,
  X,
  PoundSterling,
  Gift,
  MapPin,
  Plus,
  Search
} from "lucide-react";
import { TRADE_COUNTER_FIXTURES, type TradeCounterListingKind } from "@/apps/tradeCounter/data/listings";
import { findTradeIdentity } from "@/apps/identity/data/tradeIdentities";

type Props = {
  open: boolean;
  onClose: () => void;
};

const KIND_TABS: Array<{ key: TradeCounterListingKind | "all"; label: string }> = [
  { key: "all",      label: "All" },
  { key: "for-sale", label: "Sale" },
  { key: "offer",    label: "Swap" },
  { key: "free",     label: "Free" }
];

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return "just now";
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (60 * 24))}d`;
}

export function TradeCounterSlideOut({ open, onClose }: Props) {
  const [kind, setKind] = useState<TradeCounterListingKind | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const filtered = TRADE_COUNTER_FIXTURES.filter((l) => {
    if (kind !== "all" && l.kind !== kind) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.locationCity.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className={`fixed inset-0 z-[70] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close Trade Counter"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition ${open ? "opacity-100" : "opacity-0"}`}
      />

      {/* Drawer — right edge, 70% viewport on desktop, full width on mobile */}
      <aside
        className={`absolute right-0 top-0 flex h-full w-[65vw] max-w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:w-[70vw] md:max-w-[900px] ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Trade Counter classifieds"
      >
        {/* Header — yellow-dot brand pattern with Trade Counter title. */}
        <header
          className="flex shrink-0 items-center gap-2 border-b px-4 py-4 md:px-5"
          style={{ borderColor: "rgba(139,69,19,0.12)" }}
        >
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
            aria-hidden
          />
          <h2 className="text-[18px] font-black leading-tight tracking-tight text-neutral-900 md:text-[20px]">
            Trade Counter
          </h2>
        </header>

        {/* Filters */}
        <section
          className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 md:px-5"
          style={{ borderColor: "rgba(139,69,19,0.08)" }}
        >
          <div
            className="inline-flex items-center gap-1 rounded-full border bg-neutral-50 p-1"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {KIND_TABS.map((t) => {
              const active = t.key === kind;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setKind(t.key)}
                  className="inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full px-2 text-[10.5px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: active ? "#0A0A0A" : "transparent",
                    color:           active ? "#FFB300" : "#525252"
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <label
            className="flex min-h-[40px] items-center gap-2 rounded-md border bg-neutral-50 px-3"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Search size={12} className="text-neutral-500"/>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search listings…"
              className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400"
            />
          </label>
        </section>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
          {filtered.length === 0 ? (
            <div
              className="rounded-lg border-2 border-dashed p-6 text-center text-[11px] text-neutral-500"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              No listings match your filter.
            </div>
          ) : (
            <ul className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3">
              {filtered.map((l) => {
                const author = findTradeIdentity(l.authorSlug);
                return (
                  <li key={l.id}>
                    <Link
                      href={`/tc/trade-counter/${l.slug}`}
                      onClick={onClose}
                      className="flex items-start gap-2 rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    >
                      {l.kind === "for-sale" && (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                        >
                          <PoundSterling size={12}/>
                        </div>
                      )}
                      {l.kind === "offer" && (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                        >
                          <Handshake size={12}/>
                        </div>
                      )}
                      {l.kind === "free" && (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                        >
                          <Gift size={12}/>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[11.5px] font-black leading-tight text-neutral-900">
                          {l.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                          {l.kind === "for-sale" && l.askingGbp !== undefined && (
                            <span className="text-[12.5px] font-black text-neutral-900">£{l.askingGbp}</span>
                          )}
                          {l.kind === "free" && (
                            <span className="text-[11.5px] font-black" style={{ color: "#166534" }}>Free</span>
                          )}
                          {l.kind === "offer" && (
                            <span className="text-[11.5px] font-black" style={{ color: "#B45309" }}>Swap</span>
                          )}
                          <span className="text-[9.5px] text-neutral-500">
                            {author?.displayName ?? l.authorSlug}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-neutral-500">
                          <MapPin size={8}/>
                          {l.locationCity}
                          <span>·</span>
                          {timeAgo(l.postedAtIso)}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer — Close dismisses the slider, Counter Post routes
            to /tc/trade-counter/new so the trade can add or update
            their listing for the live counter feed. */}
        <footer
          className="grid shrink-0 grid-cols-2 gap-2 border-t p-3 md:px-5"
          style={{ borderColor: "rgba(139,69,19,0.08)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border bg-white text-[11.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <X size={13}/>
            Close
          </button>
          <Link
            href="/tc/trade-counter/new"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full text-[11.5px] font-black uppercase tracking-wider shadow-sm hover:brightness-105"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <Plus size={13}/>
            Counter Post
          </Link>
        </footer>
      </aside>
    </div>
  );
}
