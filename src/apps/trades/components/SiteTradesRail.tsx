// SiteTradesRail — left-edge tab + drawer for verified trades directory
// (renamed from "Find a verified trade" to "Site Trades").
// Mirror of other left-edge rails.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  X,
  ChevronRight,
  Search,
  MapPin,
  Star,
  ArrowRight,
  Users
} from "lucide-react";
import { allTradeProfiles } from "@/apps/trades/data/tradeProfiles";
import { findTradeIdentity, countVerifiedLayers } from "@/apps/identity/data/tradeIdentities";

export function SiteTradesRail() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("tc:open-site-trades", onOpen);
    return () => window.removeEventListener("tc:open-site-trades", onOpen);
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

  const profiles = allTradeProfiles().filter((p) => {
    if (!query.trim()) return true;
    const identity = findTradeIdentity(p.ownerTradeSlug);
    if (!identity) return false;
    const q = query.toLowerCase();
    return (
      identity.displayName.toLowerCase().includes(q) ||
      identity.tradeType.toLowerCase().includes(q) ||
      p.disciplines.some((d) => d.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <aside
        className="fixed left-0 z-20 -translate-y-1/2"
        style={{ top: "84%" }}
        aria-label="Site Trades access"
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
          title="Open Site Trades"
        >
          <ChevronRight size={12} className="opacity-60 group-hover:opacity-100"/>
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck size={16} strokeWidth={2.2}/>
            <div
              className="rotate-180 text-[9px] font-black uppercase tracking-[0.14em]"
              style={{ writingMode: "vertical-rl", color: "#FFB300" }}
            >
              Site Trades
            </div>
          </div>
        </button>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Site Trades"
        >
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
            <header
              className="flex items-center justify-between border-b p-4"
              style={{ backgroundColor: "#0A0A0A", color: "#FFFFFF", borderColor: "rgba(255,179,0,0.3)" }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} style={{ color: "#FFB300" }}/>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: "#FFB300" }}>
                    TC · Site Trades
                  </div>
                  <div className="text-[13px] font-black">Verified trades directory</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                <X size={16}/>
              </button>
            </header>

            <section className="border-b p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <label
                className="flex min-h-[40px] items-center gap-2 rounded-md border bg-neutral-50 px-3"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <Search size={12} className="text-neutral-500"/>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or trade…"
                  className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400"
                />
              </label>
            </section>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-neutral-500">
                <span>Verified trades</span>
                <span>{profiles.length}</span>
              </div>
              {profiles.length === 0 ? (
                <div
                  className="rounded-lg border-2 border-dashed p-6 text-center text-[10.5px] text-neutral-500"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  No trades match.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {profiles.map((p) => {
                    const identity = findTradeIdentity(p.ownerTradeSlug);
                    if (!identity) return null;
                    const verified = countVerifiedLayers(identity);
                    const reviewCount = p.testimonials.length;
                    const avg = reviewCount === 0
                      ? 0
                      : p.testimonials.reduce((s, t) => s + t.starRating, 0) / reviewCount;
                    return (
                      <li key={p.ownerTradeSlug}>
                        <Link
                          href={`/tc/trade/${identity.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-2 rounded-lg border bg-white p-2.5 shadow-sm hover:shadow-md"
                          style={{ borderColor: "rgba(139,69,19,0.15)" }}
                        >
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                          >
                            {identity.headshotInitials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <div className="line-clamp-1 text-[11.5px] font-black text-neutral-900">
                                {identity.displayName}
                              </div>
                              <span
                                className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[8px] font-black uppercase tracking-wider"
                                style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                              >
                                {verified}/8
                              </span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-neutral-500">
                              {identity.tradeType}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[9.5px] text-neutral-500">
                              {reviewCount > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Star size={8} className="text-amber-500" fill="currentColor"/>
                                  {avg.toFixed(1)} ({reviewCount})
                                </span>
                              )}
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin size={8}/>
                                {identity.homeCity}
                              </span>
                            </div>
                          </div>
                          <ArrowRight size={12} className="mt-1 flex-shrink-0 text-neutral-400"/>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <button
                type="button"
                onClick={() => { router.push("/tc/trades"); setOpen(false); }}
                className="flex min-h-[40px] w-full items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <Users size={12}/>
                View full directory
              </button>
            </div>
          </aside>

          <button
            type="button"
            aria-label="Close"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
