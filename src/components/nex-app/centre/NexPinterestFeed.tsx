"use client";

// NexPinterestFeed — the NEX Trade Centre as a Pinterest-style
// masonry discovery surface. Two-column variable-height feed where
// products, suppliers, projects, deals, activity, community and AI
// recommendations are all interwoven into one continuous scroll.
//
// Uses CSS `column-count` masonry (reliable across every browser,
// no JS layout library) with `break-inside: avoid` on each card so
// items never split across columns. Cards themselves are compact
// variants of the NEX Design Language, sized for a ~180px column
// on iPhone 15 Pro (390px width).
//
// Rules (locked):
//   · light off-white base only
//   · orange gradient accent, sparingly
//   · every card = photograph-forward where possible
//   · no repeats — 12 card kinds cycle through the feed
//   · save/heart affordance on image tiles

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, Building2, Clock, Eye,
  Flame, Grid2X2, Heart, LayoutList, MapPin, MessageSquare, ShieldCheck,
  ShoppingBag, SlidersHorizontal, Sparkles, Star, Tag, TrendingUp, Users,
  Wrench, X, Zap
} from "lucide-react";
import { NexCentreFilterSheet } from "./NexCentreFilterSheet";
import { DiagramCard } from "./DiagramCard";
import type { BrainEntry } from "@/lib/nex/knowledge/retrieve";
import { StatusBar } from "../shell/StatusBar";

// ── Palette ────────────────────────────────────────────────────────
// Background pulls from the platform NEX cream variable so the
// Trade Centre blends seamlessly with the rest of the app surface.
const T = {
  bg:           "var(--nex-cream)",
  card:         "#FFFFFF",
  primary:      "#F68A1E",
  secondary:    "#FFB15A",
  lightOrange:  "#FFE6C7",
  text:         "#202124",
  textSoft:     "#6F7280",
  border:       "#ECECEC",
  gradient:     "linear-gradient(135deg, #F68A1E 0%, #FFB15A 100%)",
  gradientSoft: "linear-gradient(135deg, #FFE6C7 0%, #FFF6EB 100%)",
  shadow:       "0 6px 18px -12px rgba(0,0,0,0.15)",
  shadowLift:   "0 12px 30px -14px rgba(246,138,30,0.28), 0 4px 12px -8px rgba(0,0,0,0.06)"
};

// ── Photo bank ────────────────────────────────────────────────────
const P = {
  loft:      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  timber:    "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=800&q=80",
  tools:     "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80",
  drill:     "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80",
  concrete:  "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=800&q=80",
  scaffold:  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80",
  villa:     "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80",
  roofing:   "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80",
  workshop:  "https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=800&q=80",
  excavator: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80",
  handrail:  "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&q=80",
  factory:   "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80",
  van:       "https://images.unsplash.com/photo-1583002347338-92ca57ff0a97?w=800&q=80",
  wood:      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=80",
  paint:     "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&q=80",
  bricks:    "https://images.unsplash.com/photo-1517582828737-9c4b0d0be8ba?w=800&q=80",
  garden:    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
  kitchen:   "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  ladder:    "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80",
  bathroom:  "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80",
  b1:        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80",
  b2:        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&q=80",
  b3:        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80",
  b4:        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&q=80",
  b5:        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=80",
  logo1:     "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=200&q=80",
  logo2:     "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200&q=80"
};

// ═══════════════════════════════════════════════════════════════════
// FEED DATA — 60+ items, mixed types
// ═══════════════════════════════════════════════════════════════════

type FeedItem =
  | { kind: "photo";     id: string; photo: string; label: string; aspect: "3:4" | "4:3" | "1:1" | "4:5"; verified?: boolean }
  | { kind: "product";   id: string; photo: string; title: string; price: number; supplier: string }
  | { kind: "supplier";  id: string; photo: string; name: string; category: string; rating: number; verified: boolean }
  | { kind: "flash";     id: string; photo: string; title: string; price: number; wasPrice: number; endsIn: string }
  | { kind: "project";   id: string; photo: string; name: string; location: string; budget: string; trades: string[] }
  | { kind: "aiRec";     id: string; text: string; sub: string }
  | { kind: "activity";  id: string; avatar: string; actor: string; action: string; item: string; time: string }
  | { kind: "community"; id: string; avatars: string[]; name: string; members: number }
  | { kind: "trending";  id: string; rank: number; name: string; delta: string; photo: string }
  | { kind: "editorial"; id: string; quote: string }
  | { kind: "offer";     id: string; photo: string; title: string; discount: string }
  | { kind: "auction";   id: string; photo: string; item: string; bid: number; endsIn: string };

// Exported types used by the filter sheet
export type FeedKindLabel = "Products" | "Suppliers" | "Services" | "Projects" | "Deals";
export type SortOrder = "relevance" | "nearest" | "newest" | "popular" | "price-asc" | "price-desc";
export type CentreFilters = {
  categories:   Set<FeedKindLabel>;
  maxDistanceKm: number;
  verifiedOnly: boolean;
  minPrice:     number;
  maxPrice:     number | null;
  sort:         SortOrder;
};

// Which feed kinds belong to which chip label
const KIND_TO_LABEL: Record<FeedItem["kind"], FeedKindLabel[]> = {
  product:   ["Products"],
  photo:     ["Products"],                       // photo tiles are treated as visual product cards
  supplier:  ["Suppliers", "Services"],          // suppliers double as services in V1
  flash:     ["Products", "Deals"],
  project:   ["Projects"],
  aiRec:     [],                                 // AI cards bypass category filter
  activity:  [],                                 // live feed bypasses
  community: [],                                 // community bypasses
  trending:  [],                                 // trending bypasses (informational)
  editorial: [],                                 // editorial bypasses
  offer:     ["Deals"],
  auction:   ["Deals"]
};

const DEFAULT_FILTERS: CentreFilters = {
  categories:    new Set<FeedKindLabel>(),
  maxDistanceKm: 50,
  verifiedOnly:  false,
  minPrice:      0,
  maxPrice:      null,
  sort:          "relevance"
};

// Extract a numeric price from any item shape (returns null when N/A)
function itemPrice(i: FeedItem): number | null {
  if (i.kind === "product" || i.kind === "flash") return i.price;
  if (i.kind === "auction") return i.bid;
  return null;
}
function itemVerified(i: FeedItem): boolean | null {
  if (i.kind === "supplier") return i.verified;
  if (i.kind === "photo")    return !!i.verified;
  return null;
}
function applyFilters(all: FeedItem[], q: string, f: CentreFilters): FeedItem[] {
  let list = all;
  const s = q.trim().toLowerCase();
  if (s) list = list.filter((i) => JSON.stringify(i).toLowerCase().includes(s));
  if (f.categories.size > 0) {
    list = list.filter((i) => {
      const labels = KIND_TO_LABEL[i.kind];
      if (labels.length === 0) return false;             // hide informational cards when a category filter is active
      return labels.some((l) => f.categories.has(l));
    });
  }
  if (f.verifiedOnly) {
    list = list.filter((i) => itemVerified(i) === true);
  }
  if (f.minPrice > 0 || f.maxPrice !== null) {
    list = list.filter((i) => {
      const p = itemPrice(i);
      if (p == null) return f.minPrice === 0 && f.maxPrice === null;   // non-priced items only pass when no price filter is active
      if (p < f.minPrice) return false;
      if (f.maxPrice !== null && p > f.maxPrice) return false;
      return true;
    });
  }
  // Sort
  const sorted = [...list];
  if (f.sort === "price-asc" || f.sort === "price-desc") {
    sorted.sort((a, b) => {
      const pa = itemPrice(a) ?? Number.POSITIVE_INFINITY;
      const pb = itemPrice(b) ?? Number.POSITIVE_INFINITY;
      return f.sort === "price-asc" ? pa - pb : pb - pa;
    });
  }
  // Other sorts fall through to source order for V1
  return sorted;
}

const FEED: FeedItem[] = [
  // Row 1
  { kind: "photo",    id: "1",  photo: P.villa,     label: "Villa build",  aspect: "3:4", verified: true },
  { kind: "supplier", id: "2",  photo: P.timber,    name: "Salford Timber Co.", category: "Timber", rating: 4.8, verified: true },
  { kind: "flash",    id: "3",  photo: P.drill,     title: "DeWalt XR combo kit", price: 248, wasPrice: 420, endsIn: "2h 14m" },
  { kind: "project",  id: "4",  photo: P.loft,      name: "Salford Loft", location: "Manchester", budget: "£58k", trades: ["Joinery", "Plumbing"] },
  { kind: "photo",    id: "5",  photo: P.workshop,  label: "Workshop",     aspect: "4:5" },
  { kind: "aiRec",    id: "6",  text: "Try North Timber Co. for your next pallet order.", sub: "Matches your last 3 quotes · 12% cheaper" },
  { kind: "product",  id: "7",  photo: P.handrail,  title: "Oak Handrails", price: 185, supplier: "Salford Timber" },
  { kind: "trending", id: "8",  rank: 1, name: "Ready-mix concrete", delta: "+184%", photo: P.concrete },
  { kind: "photo",    id: "9",  photo: P.roofing,   label: "Slate roof",   aspect: "1:1" },
  { kind: "activity", id: "10", avatar: P.b2, actor: "John", action: "purchased", item: "Makita Drill", time: "2s" },
  { kind: "supplier", id: "11", photo: P.tools,     name: "Manchester Tool Depot", category: "Trade tools", rating: 4.7, verified: true },
  { kind: "editorial",id: "12", quote: "The best supplier isn't always the cheapest — it's the one who answers the phone." },
  { kind: "photo",    id: "13", photo: P.kitchen,   label: "Kitchen fit",  aspect: "3:4", verified: true },
  { kind: "offer",    id: "14", photo: P.paint,     title: "Trade paint pallet", discount: "-15%" },
  { kind: "community",id: "15", avatars: [P.b1, P.b2, P.b3, P.b4], name: "Loft Builders UK", members: 4218 },
  { kind: "project",  id: "16", photo: P.villa,     name: "Villa · Ubud", location: "Bali", budget: "Rp 1.4B", trades: ["Electrical", "Roofing", "Concrete"] },
  { kind: "photo",    id: "17", photo: P.wood,      label: "Bespoke oak",  aspect: "4:5" },
  { kind: "auction",  id: "18", photo: P.excavator, item: "20t Cat Excavator", bid: 38500, endsIn: "1d 14h" },
  { kind: "flash",    id: "19", photo: P.tools,     title: "Milwaukee ex-demo bundle", price: 320, wasPrice: 480, endsIn: "5h" },
  { kind: "photo",    id: "20", photo: P.factory,   label: "Factory tour", aspect: "3:4" },
  { kind: "supplier", id: "21", photo: P.van,       name: "Quick Van Deliveries", category: "Same-day logistics", rating: 4.9, verified: true },
  { kind: "activity", id: "22", avatar: P.b5, actor: "Sarah", action: "received", item: "5 quotes", time: "8s" },
  { kind: "product",  id: "23", photo: P.bricks,    title: "Reclaimed London stock brick", price: 68, supplier: "North Timber" },
  { kind: "photo",    id: "24", photo: P.scaffold,  label: "Scaffold up",  aspect: "1:1" },
  { kind: "trending", id: "25", rank: 2, name: "Roof Tiles", delta: "+92%", photo: P.roofing },
  { kind: "aiRec",    id: "26", text: "Manchester Tool Depot has your DeWalt kit in stock today.", sub: "Ships in 20 min · 2.1 mi away" },
  { kind: "photo",    id: "27", photo: P.garden,    label: "Landscape",    aspect: "4:3" },
  { kind: "offer",    id: "28", photo: P.ladder,    title: "Loft ladders", discount: "-20%" },
  { kind: "project",  id: "29", photo: P.factory,   name: "Warehouse retrofit", location: "Leeds", budget: "£420k", trades: ["Structural", "HVAC"] },
  { kind: "activity", id: "30", avatar: P.b3, actor: "Ahmad", action: "listed", item: "20t Excavator", time: "12s" },
  { kind: "photo",    id: "31", photo: P.bathroom,  label: "Bathroom fit", aspect: "3:4", verified: true },
  { kind: "supplier", id: "32", photo: P.concrete,  name: "North Concrete Supplies", category: "Aggregates", rating: 4.6, verified: true },
  { kind: "flash",    id: "33", photo: P.wood,      title: "Oak decking · March delivery", price: 1450, wasPrice: 1780, endsIn: "3d" },
  { kind: "photo",    id: "34", photo: P.paint,     label: "Deep colour",  aspect: "1:1" },
  { kind: "community",id: "35", avatars: [P.b2, P.b5, P.b1], name: "Manchester Trades", members: 1284 },
  { kind: "editorial",id: "36", quote: "Verified isn't a badge. It's the reason your job finishes on time." },
  { kind: "photo",    id: "37", photo: P.loft,      label: "Loft convert", aspect: "4:5", verified: true },
  { kind: "product",  id: "38", photo: P.timber,    title: "Kiln-dried oak beam · 2m", price: 240, supplier: "North Timber" },
  { kind: "trending", id: "39", rank: 3, name: "Excavator hire", delta: "+41%", photo: P.excavator },
  { kind: "activity", id: "40", avatar: P.b4, actor: "Sinta", action: "accepted", item: "Roofing quote", time: "18s" },
  { kind: "auction",  id: "41", photo: P.van,       item: "Ex-fleet Transit", bid: 8250, endsIn: "3h 22m" },
  { kind: "photo",    id: "42", photo: P.concrete,  label: "Concrete pour", aspect: "3:4" },
  { kind: "aiRec",    id: "43", text: "Book Marco for your Salford loft concrete lift.", sub: "Available Fri · 4.9★ from 62 reviews" },
  { kind: "offer",    id: "44", photo: P.tools,     title: "Milwaukee accessory pack", discount: "-25%" },
  { kind: "photo",    id: "45", photo: P.handrail,  label: "Turned baluster", aspect: "4:5" },
  { kind: "supplier", id: "46", photo: P.workshop,  name: "Whitfield Joinery", category: "Bespoke joinery", rating: 4.9, verified: true },
  { kind: "project",  id: "47", photo: P.kitchen,   name: "Show kitchen · Chorlton", location: "Manchester", budget: "£24k", trades: ["Joinery", "Electrical"] },
  { kind: "photo",    id: "48", photo: P.garden,    label: "Deck build",   aspect: "1:1" },
  { kind: "flash",    id: "49", photo: P.bricks,    title: "London brick pallets · clearance", price: 380, wasPrice: 520, endsIn: "8h" },
  { kind: "community",id: "50", avatars: [P.b1, P.b3, P.b4, P.b5], name: "UK Roofers", members: 2916 },
  { kind: "photo",    id: "51", photo: P.factory,   label: "Manufacture",  aspect: "3:4", verified: true },
  { kind: "trending", id: "52", rank: 4, name: "Insulation batts", delta: "+28%", photo: P.workshop },
  { kind: "product",  id: "53", photo: P.roofing,   title: "Welsh slate tile · 20\"", price: 4.2, supplier: "Manchester Roofing" },
  { kind: "editorial",id: "54", quote: "Trade prices, no middlemen, one WhatsApp away." },
  { kind: "photo",    id: "55", photo: P.villa,     label: "Villa reveal", aspect: "4:5" },
  { kind: "activity", id: "56", avatar: P.b1, actor: "James", action: "quoted", item: "Loft rewire", time: "24s" },
  { kind: "supplier", id: "57", photo: P.bathroom,  name: "Prestwich Bathrooms", category: "Bathroom fits", rating: 4.7, verified: false },
  { kind: "offer",    id: "58", photo: P.scaffold,  title: "Scaffold hire · monthly", discount: "-10%" },
  { kind: "photo",    id: "59", photo: P.ladder,    label: "Access kit",   aspect: "1:1" },
  { kind: "aiRec",    id: "60", text: "Your Loft Builders group has 3 new projects this week.", sub: "Tap to view briefs" }
];

// ═══════════════════════════════════════════════════════════════════
// SHELL
// ═══════════════════════════════════════════════════════════════════

export function NexPinterestFeed() {
  const [q, setQ]                   = useState("");
  const [filters, setFilters]       = useState<CentreFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode]     = useState<"masonry" | "list">("masonry");
  const [aiReply, setAiReply]         = useState<string | null>(null);
  const [aiBrainMatches, setAiMatches] = useState<BrainEntry[]>([]);
  const [aiLoading, setAiLoading]     = useState(false);

  // Auto-switch to list view the moment the user types a real query
  // (Bloomberg-style scannable rows are easier to compare against).
  // Empty query → masonry discovery.
  const effectiveViewMode = q.trim() ? viewMode : "masonry";

  const items = useMemo(() => applyFilters(FEED, q, filters), [q, filters]);

  function toggleHeroChip(label: FeedKindLabel) {
    setFilters((prev) => {
      const next = new Set(prev.categories);
      if (next.has(label)) next.delete(label); else next.add(label);
      return { ...prev, categories: next };
    });
  }
  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  async function askNex() {
    const query = q.trim();
    if (!query) return;
    setAiLoading(true);
    setAiReply(null);
    setAiMatches([]);
    setViewMode("list");
    try {
      const res = await fetch("/api/nex/centre-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setAiReply(String(data?.reply ?? "I can't reach the AI right now — try the Filters button below."));
      setAiMatches(Array.isArray(data?.brain_matches) ? data.brain_matches : []);
    } catch {
      setAiReply("I can't reach the AI right now — try the Filters button below.");
      setAiMatches([]);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col"
      style={{ background: T.bg, color: T.text, minHeight: "100dvh" }}
    >
      <StatusBar />

      {/* Sticky top strip — minimal now; the big search + chips live
          in the hero container below. */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 pt-3 pb-3"
        style={{
          background: "color-mix(in oklab, var(--nex-cream) 88%, transparent)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: `1px solid ${T.border}`
        }}
      >
        <Link
          href="/nex-app"
          aria-label="Back to home"
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
        >
          <ArrowLeft size={17} strokeWidth={1.75} />
        </Link>
        <h1
          className="text-[11.5px] font-black uppercase tracking-[0.28em]"
          style={{
            background: T.gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}
        >
          NEX Trade Centre
        </h1>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-full"
          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
        >
          <Bell size={16} strokeWidth={1.75} />
          <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
                style={{ background: T.primary, boxShadow: `0 0 0 2.5px rgba(246,138,30,0.20)` }} />
        </button>
      </header>

      {/* ── Hero container ─────────────────────────────────────────
          The backdrop image is pinned to its own fixed-height layer
          so it never rescales when the card moves. The white card
          floats over it in normal flow. Top edge fades into cream
          so the hero feels continuous with the sticky header. */}
      <section className="relative">
        {/* Top fade — cream at the top, transparent below, so the
            hero image visually connects with the sticky header. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10"
          style={{
            height: 64,
            background: "linear-gradient(to bottom, var(--nex-cream) 0%, transparent 100%)"
          }}
        />
        {/* Backdrop layer — fixed 400px, image stays the same size
            no matter what the card does. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: 400,
            backgroundImage: `url("https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2012_12_45%20AM.png")`,
            backgroundSize: "cover",
            backgroundPosition: "left center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "var(--nex-cream)"
          }}
        />

        {/* Cream scrim at the bottom of the backdrop so the card
            reads cleanly against any crop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0"
          style={{
            top: 260,
            height: 160,
            background: "linear-gradient(to top, var(--nex-cream) 25%, transparent 100%)"
          }}
        />

        {/* Floating white card — moved 30px lower than before */}
        <div
          className="relative mx-4 rounded-[22px] px-4 py-4"
          style={{
            marginTop: 250,
            background: T.card,
            border: `1px solid ${T.border}`,
            boxShadow: T.shadowLift
          }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.primary }}>
            NEX Trade Centre
          </div>
          <h2 className="mt-1 text-[22px] font-black leading-[1.08] tracking-tight" style={{ color: T.text }}>
            What are you looking for?
          </h2>

          {/* Search bar with orange NEX AI CTA on the right */}
          <div
            className="mt-3 flex items-center gap-2 rounded-full pl-3.5 pr-1 py-1"
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              boxShadow: "0 2px 8px -4px rgba(0,0,0,0.08)"
            }}
          >
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") askNex(); }}
              placeholder="Type a product, service, supplier or ask NEX AI…"
              aria-label="Search NEX Trade Centre"
              className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none placeholder:opacity-55"
              style={{ color: T.text }}
            />
            <button
              type="button"
              onClick={askNex}
              disabled={aiLoading || !q.trim()}
              aria-label="Ask NEX AI"
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-black text-white transition-transform active:scale-95 disabled:opacity-55"
              style={{
                background: T.gradient,
                boxShadow: "0 6px 16px -4px rgba(246,138,30,0.55)"
              }}
            >
              <Sparkles size={12} strokeWidth={2.5} />
              {aiLoading ? "Thinking…" : "AskNex"}
            </button>
          </div>

          {/* AI reply panel — appears under the search when NEX has spoken */}
          {aiReply && (
            <div
              className="mt-3 rounded-2xl px-3 py-3"
              style={{
                background: T.gradientSoft,
                border: `1px solid ${T.border}`,
                boxShadow: "0 8px 22px -14px rgba(246,138,30,0.35)"
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-white"
                  style={{ background: T.gradient }}
                >
                  <Sparkles size={11} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: T.primary }}>
                    NEX AI
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-[1.5]" style={{ color: T.text }}>
                    {aiReply}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setAiReply(null); setAiMatches([]); }}
                  aria-label="Dismiss"
                  className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full"
                  style={{ background: T.card, color: T.textSoft, border: `1px solid ${T.border}` }}
                >
                  <X size={11} strokeWidth={2} />
                </button>
              </div>

              {/* Educational diagrams from matched Brain entries.
                  Dedupe by URL so multiple entries sharing the same
                  reference diagram don't stack identical cards. */}
              {(() => {
                const seen = new Set<string>();
                return aiBrainMatches
                  .filter((m) => m.diagram && m.diagram.url && !seen.has(m.diagram.url) && (seen.add(m.diagram.url), true))
                  .map((m) => (
                    <DiagramCard key={`diagram-${m.id}`} diagram={m.diagram!} />
                  ));
              })()}
            </div>
          )}

          {/* 5 quick-filter chips with icons — wired to filter state */}
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
            <HeroChip icon={ShoppingBag} label="Products"  active={filters.categories.has("Products")}  onClick={() => toggleHeroChip("Products")} />
            <HeroChip icon={Users}       label="Suppliers" active={filters.categories.has("Suppliers")} onClick={() => toggleHeroChip("Suppliers")} />
            <HeroChip icon={Wrench}      label="Services"  active={filters.categories.has("Services")}  onClick={() => toggleHeroChip("Services")} />
            <HeroChip icon={Building2}   label="Projects"  active={filters.categories.has("Projects")}  onClick={() => toggleHeroChip("Projects")} />
            <HeroChip icon={Tag}         label="Deals"     active={filters.categories.has("Deals")}     onClick={() => toggleHeroChip("Deals")} />
          </div>
        </div>
      </section>

      {/* Filter row — Filters button, count, and view toggle */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          aria-label="Open filters"
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-black text-white transition-transform active:scale-95"
          style={{
            background: T.gradient,
            boxShadow: "0 8px 20px -8px rgba(246,138,30,0.55)"
          }}
        >
          <SlidersHorizontal size={13} strokeWidth={2.25} />
          Filters
          {filters.categories.size + (filters.verifiedOnly ? 1 : 0) + (filters.minPrice > 0 || filters.maxPrice !== null ? 1 : 0) > 0 && (
            <span
              className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black text-[#F68A1E]"
              style={{ background: "#FFFFFF" }}
            >
              {filters.categories.size + (filters.verifiedOnly ? 1 : 0) + (filters.minPrice > 0 || filters.maxPrice !== null ? 1 : 0)}
            </span>
          )}
        </button>

        <span className="ml-auto text-[10.5px] font-bold uppercase tracking-[0.22em]" style={{ color: T.textSoft }}>
          {items.length} results
        </span>

        {/* View toggle — only relevant when a query is active */}
        {q.trim() && (
          <div
            className="flex items-center rounded-full p-0.5"
            style={{ background: T.card, border: `1px solid ${T.border}` }}
          >
            <button type="button"
                    aria-label="Grid view"
                    onClick={() => setViewMode("masonry")}
                    className="grid h-7 w-7 place-items-center rounded-full transition-transform active:scale-95"
                    style={{
                      background: viewMode === "masonry" ? T.gradient : "transparent",
                      color: viewMode === "masonry" ? "#FFFFFF" : T.textSoft
                    }}>
              <Grid2X2 size={11} strokeWidth={2.25} />
            </button>
            <button type="button"
                    aria-label="List view"
                    onClick={() => setViewMode("list")}
                    className="grid h-7 w-7 place-items-center rounded-full transition-transform active:scale-95"
                    style={{
                      background: viewMode === "list" ? T.gradient : "transparent",
                      color: viewMode === "list" ? "#FFFFFF" : T.textSoft
                    }}>
              <LayoutList size={11} strokeWidth={2.25} />
            </button>
          </div>
        )}
      </div>

      {/* Feed — masonry (discovery) or list (results) */}
      {effectiveViewMode === "masonry" ? (
        <div
          className="px-3 pt-3 pb-24"
          style={{ columnCount: 2, columnGap: 10 }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="mb-2.5"
              style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid", pageBreakInside: "avoid" }}
            >
              <FeedCard item={item} />
            </div>
          ))}
          {items.length === 0 && <EmptyState onClearFilters={resetFilters} />}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 pt-3 pb-24">
          {items.map((item) => (
            <ListRow key={item.id} item={item} />
          ))}
          {items.length === 0 && <EmptyState onClearFilters={resetFilters} />}
        </div>
      )}

      {/* Filter sheet */}
      <NexCentreFilterSheet
        open={filterOpen}
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────
function EmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div
      className="col-span-full flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <div className="text-[13px] font-black" style={{ color: T.text }}>
        Nothing matched your filters.
      </div>
      <div className="text-[11px]" style={{ color: T.textSoft }}>
        Try a different query or reset filters to see all results.
      </div>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-1 rounded-full px-3.5 py-1.5 text-[11px] font-black text-white"
        style={{ background: T.gradient }}
      >
        Reset filters
      </button>
    </div>
  );
}

// ── List row — Bloomberg-style scannable results ────────────────
// Uniform layout: 64px square photo left, title + one meta line +
// action chip right. Same slot per item type so comparing rows is
// eyes-forward not eyes-hunting.
function ListRow({ item }: { item: FeedItem }) {
  const { photo, title, meta, action, actionKind } = listRowContent(item);
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-2"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
    >
      {photo ? (
        <span className="grid h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl" style={{ background: T.lightOrange }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
        </span>
      ) : (
        <span className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-xl text-white"
              style={{ background: T.gradient }}>
          <Sparkles size={18} strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-black leading-tight" style={{ color: T.text }}>
          {title}
        </div>
        <div className="mt-0.5 truncate text-[10.5px]" style={{ color: T.textSoft }}>{meta}</div>
      </div>
      {action && (
        <span
          className="inline-flex flex-shrink-0 items-center gap-0.5 px-2.5 py-1 text-[10px] font-black text-white"
          style={{
            background: actionKind === "message" ? "#166534" : T.gradient,
            borderRadius: 8,
            boxShadow: actionKind === "message"
              ? "0 4px 10px -3px rgba(22,101,52,0.45)"
              : "0 4px 10px -3px rgba(246,138,30,0.5)"
          }}
        >
          {action}
        </span>
      )}
    </div>
  );
}

// Content extractor for the list row — one shape per feed kind
function listRowContent(i: FeedItem): {
  photo: string | null;
  title: string;
  meta:  string;
  action: string | null;
  actionKind: "message" | "primary" | null;
} {
  switch (i.kind) {
    case "photo":     return { photo: i.photo, title: i.label, meta: i.verified ? "Verified" : "Featured", action: "Save", actionKind: "primary" };
    case "product":   return { photo: i.photo, title: i.title, meta: `${i.supplier} · £${i.price.toLocaleString("en-GB")}`, action: "View", actionKind: "primary" };
    case "supplier":  return { photo: i.photo, title: i.name, meta: `${i.category} · ★${i.rating.toFixed(1)}`, action: "Message", actionKind: "message" };
    case "flash":     return { photo: i.photo, title: i.title, meta: `£${i.price} · was £${i.wasPrice} · ${i.endsIn}`, action: "Save", actionKind: "primary" };
    case "project":   return { photo: i.photo, title: i.name, meta: `${i.location} · ${i.budget}`, action: "Apply", actionKind: "primary" };
    case "aiRec":     return { photo: null,    title: i.text, meta: i.sub, action: null, actionKind: null };
    case "activity":  return { photo: i.avatar, title: `${i.actor} ${i.action} ${i.item}`, meta: i.time, action: null, actionKind: null };
    case "community": return { photo: i.avatars[0] ?? null, title: i.name, meta: `${i.members.toLocaleString("en-GB")} members`, action: "Join", actionKind: "primary" };
    case "trending":  return { photo: i.photo, title: `#${i.rank} · ${i.name}`, meta: `${i.delta} searches`, action: null, actionKind: null };
    case "editorial": return { photo: null,    title: i.quote, meta: "— Nex", action: null, actionKind: null };
    case "offer":     return { photo: i.photo, title: i.title, meta: i.discount, action: "Save", actionKind: "primary" };
    case "auction":   return { photo: i.photo, title: i.item, meta: `Bid £${i.bid.toLocaleString("en-GB")} · ${i.endsIn}`, action: "Bid", actionKind: "primary" };
  }
}

// ── Hero chip (inside the hero container) ───────────────────────
function HeroChip({
  icon: Icon, label, active, onClick
}: {
  icon: typeof ShoppingBag;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition-transform active:scale-95"
      style={{
        background: active ? T.gradient : T.card,
        color: active ? "#FFFFFF" : T.text,
        border: active ? "none" : `1px solid ${T.border}`,
        boxShadow: active ? "0 6px 14px -6px rgba(246,138,30,0.5)" : "0 2px 6px -3px rgba(0,0,0,0.06)"
      }}
    >
      <Icon size={12} strokeWidth={1.9} style={{ color: active ? "#FFFFFF" : T.textSoft }} />
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEED CARD ROUTER — renders the right compact card for each kind
// ═══════════════════════════════════════════════════════════════════

function FeedCard({ item }: { item: FeedItem }) {
  switch (item.kind) {
    case "photo":     return <PhotoTile     item={item} />;
    case "product":   return <ProductTile   item={item} />;
    case "supplier":  return <SupplierTile  item={item} />;
    case "flash":     return <FlashTile     item={item} />;
    case "project":   return <ProjectTile   item={item} />;
    case "aiRec":     return <AIRecTile     item={item} />;
    case "activity":  return <ActivityTile  item={item} />;
    case "community": return <CommunityTile item={item} />;
    case "trending":  return <TrendingTile  item={item} />;
    case "editorial": return <EditorialTile item={item} />;
    case "offer":     return <OfferTile     item={item} />;
    case "auction":   return <AuctionTile   item={item} />;
  }
}

// ── Base wrapper ─────────────────────────────────────────────────
function Wrap({
  children, radius = 18, elevated = false, style = {}, className = ""
}: {
  children: React.ReactNode;
  radius?: number;
  elevated?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: elevated ? T.shadowLift : T.shadow,
        ...style
      }}
    >
      {children}
    </div>
  );
}

function aspectPct(a: "3:4" | "4:3" | "1:1" | "4:5") {
  if (a === "3:4") return 133.33; // taller than wide
  if (a === "4:5") return 125;
  if (a === "1:1") return 100;
  return 75;                       // 4:3
}

// ── 1 · Pure photo tile with heart + optional verified pill ─────
function PhotoTile({ item }: { item: Extract<FeedItem, { kind: "photo" }> }) {
  return (
    <Wrap>
      <div className="relative w-full" style={{ paddingBottom: `${aspectPct(item.aspect)}%`, background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
              style={{ color: T.text, backdropFilter: "blur(4px)" }}>
          {item.label}
        </span>
        {item.verified && (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-white"
                style={{ background: T.gradient, boxShadow: "0 4px 10px -3px rgba(246,138,30,0.55)" }}
                aria-label="Verified">
            <BadgeCheck size={12} strokeWidth={2.25} />
          </span>
        )}
        <span className="absolute right-2 bottom-2 grid h-8 w-8 place-items-center rounded-full"
              style={{ background: "rgba(255,255,255,0.94)", color: T.primary, backdropFilter: "blur(4px)", boxShadow: "0 4px 10px -3px rgba(0,0,0,0.15)" }}>
          <Heart size={13} strokeWidth={2.25} />
        </span>
      </div>
    </Wrap>
  );
}

// ── 2 · Product tile: photo + title + price ──────────────────────
function ProductTile({ item }: { item: Extract<FeedItem, { kind: "product" }> }) {
  return (
    <Wrap>
      <div className="relative w-full" style={{ paddingBottom: "75%", background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div className="line-clamp-2 text-[11.5px] font-bold leading-tight" style={{ color: T.text }}>
          {item.title}
        </div>
        <div className="mt-1 truncate text-[10px]" style={{ color: T.textSoft }}>{item.supplier}</div>
        <div className="mt-1 text-[13px] font-black" style={{ color: T.primary }}>
          £{item.price.toLocaleString("en-GB")}
        </div>
      </div>
    </Wrap>
  );
}

// ── 3 · Supplier tile: photo + name + verified + rating ──────────
function SupplierTile({ item }: { item: Extract<FeedItem, { kind: "supplier" }> }) {
  return (
    <Wrap>
      <div className="relative w-full" style={{ paddingBottom: "80%", background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-black"
              style={{ color: T.text, backdropFilter: "blur(4px)" }}>
          <Star size={9} strokeWidth={0} fill={T.primary} style={{ color: T.primary }} />
          {item.rating.toFixed(1)}
        </span>
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div className="flex items-center gap-0.5">
          <div className="truncate text-[11.5px] font-bold" style={{ color: T.text }}>{item.name}</div>
          {item.verified && <BadgeCheck size={11} strokeWidth={2.25} style={{ color: T.primary, flexShrink: 0 }} />}
        </div>
        <div className="mt-0.5 truncate text-[10px]" style={{ color: T.textSoft }}>{item.category}</div>
        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 text-[9.5px] font-black text-white"
             style={{ background: "#166534", borderRadius: 8, boxShadow: "0 3px 8px -3px rgba(22,101,52,0.45)" }}>
          <MessageSquare size={9} strokeWidth={2.25} /> Message
        </div>
      </div>
    </Wrap>
  );
}

// ── 4 · Flash deal: gradient banner + product + price ───────────
function FlashTile({ item }: { item: Extract<FeedItem, { kind: "flash" }> }) {
  return (
    <Wrap>
      <div className="flex items-center justify-between px-2 py-1 text-white text-[9px] font-black uppercase tracking-widest"
           style={{ background: T.gradient }}>
        <span className="flex items-center gap-0.5"><Flame size={9} strokeWidth={2.5} /> Flash</span>
        <span className="flex items-center gap-0.5"><Clock size={9} strokeWidth={2.5} /> {item.endsIn}</span>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "75%", background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div className="line-clamp-2 text-[11.5px] font-bold leading-tight" style={{ color: T.text }}>
          {item.title}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[14px] font-black" style={{ color: T.primary }}>£{item.price}</span>
          <span className="text-[10px] line-through" style={{ color: T.textSoft }}>£{item.wasPrice}</span>
        </div>
      </div>
    </Wrap>
  );
}

// ── 5 · Project tile: photo + name + trades + budget ─────────────
function ProjectTile({ item }: { item: Extract<FeedItem, { kind: "project" }> }) {
  return (
    <Wrap>
      <div className="relative w-full" style={{ paddingBottom: "65%", background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
              style={{ color: T.primary, backdropFilter: "blur(4px)" }}>
          Project
        </span>
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div className="truncate text-[11.5px] font-bold" style={{ color: T.text }}>{item.name}</div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[10px]" style={{ color: T.textSoft }}>
          <MapPin size={9} strokeWidth={1.75} /> {item.location}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.trades.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ background: T.lightOrange, color: T.primary }}>{t}</span>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t pt-1.5" style={{ borderColor: T.border }}>
          <div className="text-[11.5px] font-black" style={{ color: T.text }}>{item.budget}</div>
          <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black text-white"
                style={{ background: T.gradient }}>Apply</span>
        </div>
      </div>
    </Wrap>
  );
}

// ── 6 · AI recommendation: warm gradient background, no photo ──
function AIRecTile({ item }: { item: Extract<FeedItem, { kind: "aiRec" }> }) {
  return (
    <div
      className="relative overflow-hidden rounded-[18px] p-3"
      style={{
        background: T.gradientSoft,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadowLift
      }}
    >
      <div className="flex items-start gap-2">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl text-white"
              style={{ background: T.gradient, boxShadow: "0 6px 14px -3px rgba(246,138,30,0.55)" }}>
          <Sparkles size={14} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[8.5px] font-black uppercase tracking-[0.22em]" style={{ color: T.primary }}>
            NEX picks
          </div>
          <div className="mt-0.5 text-[12px] font-black leading-tight" style={{ color: T.text }}>{item.text}</div>
          <div className="mt-1 text-[10px]" style={{ color: T.textSoft }}>{item.sub}</div>
        </div>
      </div>
    </div>
  );
}

// ── 7 · Activity feed row: avatar + one-line + timestamp ─────────
function ActivityTile({ item }: { item: Extract<FeedItem, { kind: "activity" }> }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[16px] p-2"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
    >
      <span aria-hidden className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,0.20)" }} />
      <span className="grid h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.avatar} alt="" className="h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1 text-[10.5px] leading-tight" style={{ color: T.text }}>
        <span className="font-bold">{item.actor}</span>
        <span style={{ color: T.textSoft }}> {item.action} </span>
        <span className="font-semibold">{item.item}</span>
      </div>
      <span className="text-[9px]" style={{ color: T.textSoft }}>{item.time}</span>
    </div>
  );
}

// ── 8 · Community avatar cluster + join ─────────────────────────
function CommunityTile({ item }: { item: Extract<FeedItem, { kind: "community" }> }) {
  return (
    <Wrap>
      <div className="p-3">
        <div className="flex items-center">
          {item.avatars.slice(0, 4).map((src, i) => (
            <span key={i}
                  className="grid h-8 w-8 overflow-hidden rounded-full"
                  style={{ marginLeft: i === 0 ? 0 : -10, border: `2px solid ${T.card}`, zIndex: 4 - i, background: T.lightOrange }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </div>
        <div className="mt-2 text-[12px] font-black leading-tight" style={{ color: T.text }}>{item.name}</div>
        <div className="mt-0.5 text-[10px]" style={{ color: T.textSoft }}>
          <Users size={9} strokeWidth={1.75} className="inline -mt-0.5 mr-0.5" />
          {item.members.toLocaleString("en-GB")} members
        </div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black text-white"
             style={{ background: T.gradient }}>
          Join <ArrowRight size={10} strokeWidth={2.5} />
        </div>
      </div>
    </Wrap>
  );
}

// ── 9 · Trending: big rank + delta over background photo ─────────
function TrendingTile({ item }: { item: Extract<FeedItem, { kind: "trending" }> }) {
  return (
    <Wrap>
      <div className="relative" style={{ minHeight: 130 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.16 }} loading="lazy" />
        <div className="relative p-3">
          <div className="text-[36px] font-black leading-none tracking-tighter" style={{ color: T.primary }}>
            #{item.rank}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[8.5px] font-black uppercase tracking-[0.22em]"
               style={{ color: T.textSoft }}>
            <TrendingUp size={9} strokeWidth={2.25} style={{ color: T.primary }} /> Trending
          </div>
          <div className="mt-0.5 text-[12.5px] font-black leading-tight" style={{ color: T.text }}>{item.name}</div>
          <div className="mt-0.5 text-[10px] font-bold" style={{ color: "#22C55E" }}>{item.delta} searches</div>
        </div>
      </div>
    </Wrap>
  );
}

// ── 10 · Editorial quote card ────────────────────────────────────
function EditorialTile({ item }: { item: Extract<FeedItem, { kind: "editorial" }> }) {
  return (
    <div
      className="relative overflow-hidden rounded-[18px] p-4"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, minHeight: 150 }}
    >
      <div className="text-[8.5px] font-black uppercase tracking-[0.28em]" style={{ color: T.textSoft }}>Editor</div>
      <p className="mt-1 text-[13px] leading-[1.25] font-black tracking-tight"
         style={{ color: T.text, fontFamily: "Georgia, serif" }}>
        &ldquo;{item.quote}&rdquo;
      </p>
      <div className="mt-2 text-[9.5px]" style={{ color: T.textSoft }}>— Nex</div>
    </div>
  );
}

// ── 11 · Offer tile: photo + big discount + save ─────────────────
function OfferTile({ item }: { item: Extract<FeedItem, { kind: "offer" }> }) {
  return (
    <Wrap>
      <div className="relative w-full" style={{ paddingBottom: "78%", background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9.5px] font-black text-white"
              style={{ background: T.gradient, boxShadow: "0 4px 10px -3px rgba(246,138,30,0.55)" }}>
          {item.discount}
        </span>
      </div>
      <div className="flex items-center justify-between px-2.5 pt-2 pb-2.5">
        <div className="min-w-0 flex-1 truncate text-[11.5px] font-bold" style={{ color: T.text }}>
          {item.title}
        </div>
        <span className="ml-1 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full"
              style={{ background: T.lightOrange, color: T.primary }}>
          <Heart size={11} strokeWidth={2.25} />
        </span>
      </div>
    </Wrap>
  );
}

// ── 12 · Auction: photo + current bid + timer ───────────────────
function AuctionTile({ item }: { item: Extract<FeedItem, { kind: "auction" }> }) {
  return (
    <Wrap>
      <div className="relative w-full" style={{ paddingBottom: "70%", background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-widest text-white"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          Auction
        </span>
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div className="truncate text-[11.5px] font-bold" style={{ color: T.text }}>{item.item}</div>
        <div className="mt-1 flex items-baseline justify-between">
          <div>
            <div className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: T.textSoft }}>Bid</div>
            <div className="text-[13px] font-black" style={{ color: T.text }}>£{item.bid.toLocaleString("en-GB")}</div>
          </div>
          <div className="text-right">
            <div className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: T.textSoft }}>Ends</div>
            <div className="text-[11px] font-black" style={{ color: T.primary }}>{item.endsIn}</div>
          </div>
        </div>
      </div>
    </Wrap>
  );
}
