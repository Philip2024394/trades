// TradeCounterRail — persistent left-edge tab + slide-in drawer.
//
// Mirror of NotebookRail. Same pattern:
//   1. Collapsed — narrow black tab on left edge, "TRADE COUNTER"
//      vertical text + handshake icon. Positioned in the lower third
//      of the viewport (Notebook sits in the upper third).
//   2. Expanded — slide-in drawer from left edge with the classifieds
//      browse UI (filter tabs · nearest listings · Post an item CTA).
//
// Three entry points:
//   - The tab itself
//   - `tc:open-trade-counter` window event (fired from any menu)

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Handshake,
  X,
  ChevronRight,
  Search,
  Plus,
  MapPin,
  PoundSterling,
  Gift
} from "lucide-react";
import {
  TRADE_COUNTER_FIXTURES,
  type TradeCounterListingKind
} from "@/apps/tradeCounter/data/listings";
import { findTradeIdentity } from "@/apps/identity/data/tradeIdentities";

const KIND_TABS: Array<{ key: TradeCounterListingKind | "all"; label: string }> = [
  { key: "all",      label: "All"       },
  { key: "for-sale", label: "For Sale"  },
  { key: "offer",    label: "Swap"      },
  { key: "free",     label: "Free"      }
];

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return "just now";
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (60 * 24))}d`;
}

export function TradeCounterRail() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TradeCounterListingKind | "all">("all");
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("tc:open-trade-counter", onOpen);
    return () => window.removeEventListener("tc:open-trade-counter", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <>
      {/* Persistent left-edge tab (lower third of viewport) */}
      <aside
        className="fixed left-0 z-20 -translate-y-1/2"
        style={{ top: "42%" }}
        aria-label="Trade Counter access"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="group flex items-center gap-1 rounded-r-2xl border py-3 pl-1.5 pr-2 shadow-lg backdrop-blur transition-transform hover:translate-x-0.5"
          style={{
            backgroundColor: "#0A0A0A",
            color: "#FFB300",
            borderColor: "rgba(255,179,0,0.3)"
          }}
          title="Open Trade Counter"
        >
          <ChevronRight size={12} className="opacity-60 group-hover:opacity-100"/>
          <div className="flex flex-col items-center gap-2">
            <Handshake size={16} strokeWidth={2.2}/>
            <div
              className="rotate-180 text-[9px] font-black uppercase tracking-[0.14em]"
              style={{ writingMode: "vertical-rl", color: "#FFB300" }}
            >
              Trade Counter
            </div>
          </div>
        </button>
      </aside>

      {/* Expanded drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Trade Counter classifieds"
        >
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
            {/* Header */}
            <header
              className="flex items-center justify-between border-b p-4"
              style={{
                backgroundColor: "#0A0A0A",
                color: "#FFFFFF",
                borderColor: "rgba(255,179,0,0.3)"
              }}
            >
              <div className="flex items-center gap-2">
                <Handshake size={18} style={{ color: "#FFB300" }}/>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: "#FFB300" }}>
                    TC · Trade Counter
                  </div>
                  <div className="text-[13px] font-black">Trade-to-trade classifieds</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                aria-label="Close Trade Counter"
              >
                <X size={16}/>
              </button>
            </header>

            {/* Kind tabs + search */}
            <section className="flex flex-col gap-3 border-b p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
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
                        color: active ? "#FFB300" : "#525252"
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

            {/* Listings */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-neutral-500">
                <span>Nearest listings</span>
                <span>{filtered.length}</span>
              </div>
              {filtered.length === 0 ? (
                <div
                  className="rounded-lg border-2 border-dashed p-6 text-center text-[10.5px] text-neutral-500"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  No listings match your filter.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filtered.map((l) => {
                    const author = findTradeIdentity(l.authorSlug);
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/tc/trade-counter/${l.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-2 rounded-lg border bg-white p-2.5 shadow-sm hover:shadow-md"
                          style={{ borderColor: "rgba(139,69,19,0.15)" }}
                        >
                          {l.kind === "for-sale" && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}>
                              <PoundSterling size={12}/>
                            </div>
                          )}
                          {l.kind === "offer" && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}>
                              <Handshake size={12}/>
                            </div>
                          )}
                          {l.kind === "free" && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#166534", color: "#FFFFFF" }}>
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

            {/* Footer — view all + post */}
            <div className="grid grid-cols-2 gap-2 border-t p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <button
                type="button"
                onClick={() => {
                  router.push("/tc/trade-counter");
                  setOpen(false);
                }}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border bg-white text-[10.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                View all
              </button>
              <Link
                href="/tc/trade-counter/new"
                onClick={() => setOpen(false)}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <Plus size={12}/>
                Post an item
              </Link>
            </div>
          </aside>

          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close Trade Counter"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
