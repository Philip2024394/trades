// LeftMenuRail — the single left-edge tab that opens a unified drawer
// containing ALL four category sections stacked with header names:
//   1. NOTEBOOK
//   2. TRADE COUNTER
//   3. SITE PROJECTS
//   4. SITE TRADES
//
// Replaces the 4 separate rails. Cleaner edge — one tab, one drawer,
// everything visible with clear section headers.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronDown,
  Notebook,
  Handshake,
  Briefcase,
  ShieldCheck,
  Search,
  MapPin,
  Plus,
  Star,
  ArrowRight,
  Send,
  Clock,
  PoundSterling,
  Gift
} from "lucide-react";
import { DEMO_NOTEBOOK, NOTEBOOK_OFFERS_FIXTURES } from "@/apps/notebook/data/notebook";
import { TRADE_COUNTER_FIXTURES, type TradeCounterListingKind } from "@/apps/tradeCounter/data/listings";
import { JOB_FIXTURES } from "@/apps/jobs/data/jobs";
import { allTradeProfiles } from "@/apps/trades/data/tradeProfiles";
import { findTradeIdentity, countVerifiedLayers, currentViewerTrade } from "@/apps/identity/data/tradeIdentities";
import { findNearestForNotebookItem } from "@/apps/notebook/lib/findNearestMerchant";
import { CountdownTimer } from "@/apps/notebook/components/CountdownTimer";
import { formatMiles } from "@/apps/marketplace/lib/distance";
import { useIsTrade } from "@/apps/hub/lib/useIsTrade";

const LOCATION_KEY = "tc.notebook.location";
type SectionKey = "notebook" | "trade-counter" | "site-projects" | "site-trades";

export function LeftMenuRail() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<SectionKey>("notebook");
  const [location, setLocation] = useState("Manchester M20");
  const router = useRouter();
  // Constitutional gate — DIY viewers never see Trade Counter or Site
  // Projects sections. See feedback_trade_features_trade_only.md.
  const isTrade = useIsTrade();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const notebookRef = useRef<HTMLDivElement | null>(null);
  const tradeCounterRef = useRef<HTMLDivElement | null>(null);
  const siteProjectsRef = useRef<HTMLDivElement | null>(null);
  const siteTradesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LOCATION_KEY);
    if (saved) setLocation(saved);
  }, []);

  useEffect(() => {
    function openTo(key: SectionKey) {
      setOpen(true);
      setExpanded(key);
      // Scroll after render
      setTimeout(() => {
        const ref =
          key === "notebook" ? notebookRef.current :
          key === "trade-counter" ? tradeCounterRef.current :
          key === "site-projects" ? siteProjectsRef.current :
          siteTradesRef.current;
        ref?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
    function onNotebook() { openTo("notebook"); }
    function onTradeCounter() { openTo("trade-counter"); }
    function onSiteProjects() { openTo("site-projects"); }
    function onSiteTrades() { openTo("site-trades"); }
    window.addEventListener("tc:open-notebook", onNotebook);
    window.addEventListener("tc:open-trade-counter", onTradeCounter);
    window.addEventListener("tc:open-site-projects", onSiteProjects);
    window.addEventListener("tc:open-site-trades", onSiteTrades);
    return () => {
      window.removeEventListener("tc:open-notebook", onNotebook);
      window.removeEventListener("tc:open-trade-counter", onTradeCounter);
      window.removeEventListener("tc:open-site-projects", onSiteProjects);
      window.removeEventListener("tc:open-site-trades", onSiteTrades);
    };
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

  return (
    <>
      {/* Single left-edge tab */}
      <aside
        className="fixed left-0 top-1/2 z-20 -translate-y-1/2"
        aria-label="Trade Center menu"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="group flex items-center gap-1 rounded-r-2xl border py-4 pl-1.5 pr-2 shadow-lg backdrop-blur transition-transform hover:translate-x-0.5"
          style={{
            backgroundColor: "#0A0A0A",
            color: "#FFB300",
            borderColor: "rgba(255,179,0,0.3)"
          }}
          title="Open Trade Center menu"
        >
          <ChevronRight size={12} className="opacity-60 group-hover:opacity-100"/>
          <div className="flex flex-col items-center gap-2">
            <Notebook size={17} strokeWidth={2.2}/>
            <div
              className="rotate-180 text-[9px] font-black uppercase tracking-[0.16em]"
              style={{ writingMode: "vertical-rl", color: "#FFB300" }}
            >
              Notebook
            </div>
          </div>
        </button>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Trade Center menu">
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            {/* Sticky header */}
            <header
              className="flex items-center justify-between border-b p-4"
              style={{ backgroundColor: "#0A0A0A", color: "#FFFFFF", borderColor: "rgba(255,179,0,0.3)" }}
            >
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: "#FFB300" }}>
                  TC · Notebook
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-bold text-white/85">
                  <MapPin size={11}/>
                  {location}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X size={16}/>
              </button>
            </header>

            {/* Scrollable stacked sections */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div ref={notebookRef}>
                <NotebookSection
                  isExpanded={expanded === "notebook"}
                  onToggle={() => setExpanded(expanded === "notebook" ? "trade-counter" : "notebook")}
                  onClose={() => setOpen(false)}
                />
              </div>
              {isTrade && (
                <div ref={tradeCounterRef}>
                  <TradeCounterSection
                    isExpanded={expanded === "trade-counter"}
                    onToggle={() => setExpanded(expanded === "trade-counter" ? "site-projects" : "trade-counter")}
                    onClose={() => setOpen(false)}
                  />
                </div>
              )}
              {isTrade && (
                <div ref={siteProjectsRef}>
                  <SiteProjectsSection
                    isExpanded={expanded === "site-projects"}
                    onToggle={() => setExpanded(expanded === "site-projects" ? "site-trades" : "site-projects")}
                    onClose={() => setOpen(false)}
                  />
                </div>
              )}
              <div ref={siteTradesRef}>
                <SiteTradesSection
                  isExpanded={expanded === "site-trades"}
                  onToggle={() => setExpanded(expanded === "site-trades" ? "notebook" : "site-trades")}
                  onClose={() => setOpen(false)}
                />
              </div>
            </div>
          </aside>

          <button
            type="button"
            aria-label="Close menu"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}

    </>
  );
}

// ─── Section: Notebook ──────────────────────────────────────────────

function NotebookSection({
  isExpanded,
  onToggle,
  onClose
}: {
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const trade = currentViewerTrade();
  return (
    <section className="border-b" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-neutral-50"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <Notebook size={15} strokeWidth={2.2}/>
          </div>
          <div>
            <div className="text-[13px] font-black uppercase tracking-[0.14em] text-neutral-900">
              Notebook
            </div>
            <div className="text-[10px] text-neutral-500">
              {DEMO_NOTEBOOK.items.length} items · {NOTEBOOK_OFFERS_FIXTURES.length} offers
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronDown size={14} className="text-neutral-500"/> : <ChevronRight size={14} className="text-neutral-500"/>}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          <section
            className="mb-3 rounded-lg border p-3 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFDF8" }}
          >
            <div className="flex items-center gap-2">
              <Send size={12} style={{ color: "#B45309" }}/>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
                Quote Me
              </div>
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-neutral-700">
              Pick items → nearest merchants price whole basket → one delivery.
            </p>
            <Link
              href="/tc/notebook?section=regulars&quoteme=1"
              onClick={onClose}
              className="mt-2 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              Build quote request →
            </Link>
          </section>

          <ul className="flex flex-col gap-1">
            {DEMO_NOTEBOOK.items.slice(0, 3).map((item) => {
              const match = findNearestForNotebookItem(item, trade.homeCity);
              return (
                <li key={item.id}>
                  <Link
                    href={`/tc/notebook?section=regulars`}
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[10.5px] hover:bg-neutral-50"
                  >
                    <span className="min-w-0 flex-1 truncate font-bold text-neutral-800">{item.productName}</span>
                    {match && (
                      <span className="text-neutral-500">£{match.product.priceGbp}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href="/tc/notebook"
            onClick={onClose}
            className="mt-2 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full border bg-white text-[10.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Open Notebook <ArrowRight size={11}/>
          </Link>
        </div>
      )}
    </section>
  );
}

// ─── Section: Trade Counter ─────────────────────────────────────────

function TradeCounterSection({
  isExpanded,
  onToggle,
  onClose
}: {
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<TradeCounterListingKind | "all">("all");
  const filtered = TRADE_COUNTER_FIXTURES.filter((l) => kind === "all" || l.kind === kind).slice(0, 3);
  const [clearance, setClearance] = useState<Array<{
    productId: string;
    productSlug: string;
    productName: string;
    imageUrl: string | null;
    priceGbp: number;
    comparePriceGbp: number | null;
    savingPct: number;
    merchantSlug: string;
    merchantName: string;
    expiresAtIso: string;
  }>>([]);

  useEffect(() => {
    if (!isExpanded) return;
    fetch("/api/apps/notebook/clearance/nearby", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json) => setClearance(json.items ?? []))
      .catch(() => setClearance([]));
  }, [isExpanded]);

  const KIND_TABS: Array<{ key: TradeCounterListingKind | "all"; label: string }> = [
    { key: "all",      label: "All" },
    { key: "for-sale", label: "Sale" },
    { key: "offer",    label: "Swap" },
    { key: "free",     label: "Free" }
  ];

  return (
    <section className="border-b" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-neutral-50"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <Handshake size={15} strokeWidth={2.2}/>
          </div>
          <div>
            <div className="text-[13px] font-black uppercase tracking-[0.14em] text-neutral-900">
              Trade Counter
            </div>
            <div className="text-[10px] text-neutral-500">
              {TRADE_COUNTER_FIXTURES.length} listings from trades near you
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronDown size={14} className="text-neutral-500"/> : <ChevronRight size={14} className="text-neutral-500"/>}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Trade Clearance strip — merchant end-of-line offers with 5-day countdown */}
          {clearance.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: "#B45309" }}>
                <span>Trade Clearance</span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-500">5-day offers · counts down live</span>
              </div>
              <ul className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {clearance.map((c) => (
                  <li key={c.productId} className="w-[132px] flex-shrink-0">
                    <Link
                      href={`/tc/trade-center/product/${c.productSlug}`}
                      onClick={onClose}
                      className="flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm hover:shadow-md"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    >
                      <div className="relative aspect-square w-full overflow-hidden" style={{ backgroundColor: "#F5F0E4" }}>
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt="" className="h-full w-full object-contain"/>
                        ) : null}
                        <span
                          className="absolute left-1.5 top-1.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm"
                          style={{ backgroundColor: "#B45309", color: "#FFFFFF" }}
                        >
                          −{Math.round(c.savingPct)}%
                        </span>
                        <div className="absolute right-1.5 top-1.5">
                          <CountdownTimer expiresAtIso={c.expiresAtIso}/>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 p-1.5">
                        <div className="line-clamp-1 text-[10.5px] font-black text-neutral-900">{c.productName}</div>
                        <div className="line-clamp-1 text-[9px] text-neutral-500">{c.merchantName}</div>
                        <div className="flex items-baseline gap-1 pt-0.5">
                          {c.comparePriceGbp !== null && (
                            <span className="text-[9px] text-neutral-400 line-through">£{c.comparePriceGbp}</span>
                          )}
                          <span className="text-[11px] font-black text-neutral-900">£{c.priceGbp}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            className="mb-3 inline-flex items-center gap-1 rounded-full border bg-neutral-50 p-1"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {KIND_TABS.map((t) => {
              const active = t.key === kind;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setKind(t.key)}
                  className="inline-flex min-h-[28px] items-center rounded-full px-2.5 text-[9.5px] font-black uppercase tracking-wider"
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
          <ul className="flex flex-col gap-2">
            {filtered.map((l) => {
              const author = findTradeIdentity(l.authorSlug);
              return (
                <li key={l.id}>
                  <Link
                    href={`/tc/trade-counter/${l.slug}`}
                    onClick={onClose}
                    className="flex items-start gap-2 rounded-lg border bg-white p-2.5 shadow-sm hover:shadow-md"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: l.kind === "free" ? "#166534" : l.kind === "offer" ? "#FFB300" : "#0A0A0A",
                        color: l.kind === "offer" ? "#0A0A0A" : l.kind === "free" ? "#FFFFFF" : "#FFB300"
                      }}
                    >
                      {l.kind === "for-sale" && <PoundSterling size={12}/>}
                      {l.kind === "offer" && <Handshake size={12}/>}
                      {l.kind === "free" && <Gift size={12}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[11px] font-black leading-tight text-neutral-900">{l.title}</div>
                      <div className="mt-0.5 text-[9.5px] text-neutral-500">{author?.displayName}</div>
                    </div>
                    {l.kind === "for-sale" && l.askingGbp !== undefined && (
                      <span className="flex-shrink-0 text-[11px] font-black text-neutral-900">£{l.askingGbp}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/tc/trade-counter"
              onClick={onClose}
              className="flex min-h-[36px] items-center justify-center rounded-full border bg-white text-[10.5px] font-black uppercase tracking-wider text-neutral-800"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              View all
            </Link>
            <Link
              href="/tc/trade-counter/new"
              onClick={onClose}
              className="flex min-h-[36px] items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              <Plus size={11}/>
              Post
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Section: Site Projects ─────────────────────────────────────────

function SiteProjectsSection({
  isExpanded,
  onToggle,
  onClose
}: {
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const trade = currentViewerTrade();
  const jobs = JOB_FIXTURES.filter((j) => j.ownerTradeSlug === trade.slug).slice(0, 3);
  return (
    <section className="border-b" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-neutral-50"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <Briefcase size={15} strokeWidth={2.2}/>
          </div>
          <div>
            <div className="text-[13px] font-black uppercase tracking-[0.14em] text-neutral-900">
              Site Projects
            </div>
            <div className="text-[10px] text-neutral-500">
              {JOB_FIXTURES.filter((j) => j.ownerTradeSlug === trade.slug).length} projects on the go
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronDown size={14} className="text-neutral-500"/> : <ChevronRight size={14} className="text-neutral-500"/>}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          <ul className="flex flex-col gap-2">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/tc/jobs/${j.slug}`}
                  onClick={onClose}
                  className="flex items-start gap-2 rounded-lg border bg-white p-2.5 shadow-sm hover:shadow-md"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <Clock size={14} className="mt-0.5 flex-shrink-0 text-amber-700"/>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[11px] font-black leading-tight text-neutral-900">{j.title}</div>
                    <div className="mt-0.5 text-[9.5px] text-neutral-500">
                      {j.customerName} · £{j.quoteGbp.toLocaleString()}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/tc/jobs"
            onClick={onClose}
            className="mt-3 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            Open Site Projects <ArrowRight size={11}/>
          </Link>
        </div>
      )}
    </section>
  );
}

// ─── Section: Site Trades ───────────────────────────────────────────

function SiteTradesSection({
  isExpanded,
  onToggle,
  onClose
}: {
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const profiles = allTradeProfiles().slice(0, 3);
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-neutral-50"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <ShieldCheck size={15} strokeWidth={2.2}/>
          </div>
          <div>
            <div className="text-[13px] font-black uppercase tracking-[0.14em] text-neutral-900">
              Site Trades
            </div>
            <div className="text-[10px] text-neutral-500">
              {allTradeProfiles().length} verified trades near you
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronDown size={14} className="text-neutral-500"/> : <ChevronRight size={14} className="text-neutral-500"/>}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          <ul className="flex flex-col gap-2">
            {profiles.map((p) => {
              const identity = findTradeIdentity(p.ownerTradeSlug);
              if (!identity) return null;
              const verified = countVerifiedLayers(identity);
              const reviewCount = p.testimonials.length;
              const avg = reviewCount === 0 ? 0 : p.testimonials.reduce((s, t) => s + t.starRating, 0) / reviewCount;
              return (
                <li key={p.ownerTradeSlug}>
                  <Link
                    href={`/tc/trade/${identity.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-lg border bg-white p-2.5 shadow-sm hover:shadow-md"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                      style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                    >
                      {identity.headshotInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black text-neutral-900">{identity.displayName}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[9.5px] text-neutral-500">
                        <span className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[8px] font-black uppercase" style={{ backgroundColor: "#166534", color: "#FFFFFF" }}>
                          {verified}/8
                        </span>
                        {reviewCount > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star size={7} className="text-amber-500" fill="currentColor"/>
                            {avg.toFixed(1)}
                          </span>
                        )}
                        <span>{identity.homeCity}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/tc/trades"
            onClick={onClose}
            className="mt-3 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            Open Site Trades <ArrowRight size={11}/>
          </Link>
        </div>
      )}
    </section>
  );
}
