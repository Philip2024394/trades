// src/components/nexapp/NexWorkspaceProducts.tsx · Philip 2026-09-05
//
// VISUAL CORRECTION (Philip 2026-09-05 · post-first-render feedback):
// Redesigned to respect the NEX inner-display geometry. The chassis owns
// the outside · the transparent inner display owns this component ·
// therefore every child must live inside the parent width, never the
// browser viewport. Rules baked in below:
//
//   · Every layer: box-sizing: border-box · width: 100% · min-width: 0
//   · Card height FIXED at 140px (not content-driven)
//   · Text column always uses min-width: 0 inside flex row · truncates
//     to a single line via -webkit-line-clamp · never pushes the card
//     wider than the workspace
//   · Image: fixed 108×108 · flex-shrink: 0 · never determines card size
//   · Compact header · compact Add Product · compact Ask/Buy buttons
//   · Reduced orange density · reserved for genuine action affordances
//     (back arrow · price · Add-Product CTA · Ask · active filter · fav)
//   · overflow-x is NEVER used to hide dimensional mistakes · the actual
//     dimensions must fit · overflow: hidden appears only on text-clamp
//     for typography, and only overflow-y: auto on the scroll region
//
// UX:
//   · + Add Product at TOP (Philip 2026-09-05 correction)
//   · Filters row · client-side state only (non-All = empty state)
//   · Product cards: image · PRODUCT label · name · price · attributes
//     · availability · Ask + Buy · matches supplied visual reference
//
// Data policy (unchanged from prior slice):
//   · MOCK_PRODUCTS isolated · replace with real API when the model exists
//   · Every button logs a UI-stub note · zero fake persistence · zero
//     fake success states · zero fetch calls · zero DB / env / workforce
//     / C12 contact

"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft, SlidersHorizontal, Plus, Heart,
  MessageCircle, ShoppingBag, Camera, Image as ImageIcon, PenLine, Wrench,
} from "lucide-react";

// ── Live strip · item shape from /api/nex-live/tonight ─────────────────
// We only consume the fields we render · never fabricate defaults.
interface LiveStripItem {
  media_id: string;
  entity_name: string | null;
  title: string | null;
  poster_url: string | null;
  live_status: "LIVE_NOW" | "STARTING_SOON" | "TONIGHT" | "UPCOMING" | "ENDED" | "STALE" | "UNKNOWN";
  status_label: string;
  is_mock_fixture: boolean;
  started_at_iso: string | null;
}

// ── Owner-scoped mock Live placeholders ────────────────────────────────
// When the live endpoint returns nothing for this owner's products /
// hotel / gym, we render clearly-marked MOCK cards so the pattern is
// visible during the pre-launch demo. Every card carries
// is_mock_fixture=true so the "Mock" chip surfaces at the card corner ·
// §17 mock content clearly marked · never confused with real content.
const MOCK_OWNER_LIVE_PLACEHOLDERS: LiveStripItem[] = [
  {
    media_id: "mock-owner-kitchen",
    entity_name: "Your Kitchen",
    title: "Prep · behind the counter",
    poster_url: null,
    live_status: "LIVE_NOW",
    status_label: "LIVE",
    is_mock_fixture: true,
    started_at_iso: null,
  },
  {
    media_id: "mock-owner-boxing",
    entity_name: "Your Gym",
    title: "Boxing class",
    poster_url: null,
    live_status: "LIVE_NOW",
    status_label: "LIVE",
    is_mock_fixture: true,
    started_at_iso: null,
  },
  {
    media_id: "mock-owner-room-tour",
    entity_name: "Your Hotel",
    title: "Room tour · deluxe",
    poster_url: null,
    live_status: "STARTING_SOON",
    status_label: "STARTING SOON",
    is_mock_fixture: true,
    started_at_iso: null,
  },
  {
    media_id: "mock-owner-product-demo",
    entity_name: "Your Product",
    title: "Live demo · Q&A",
    poster_url: null,
    live_status: "STARTING_SOON",
    status_label: "STARTING SOON",
    is_mock_fixture: true,
    started_at_iso: null,
  },
  {
    media_id: "mock-owner-rooftop",
    entity_name: "Your Venue",
    title: "Rooftop · sundown",
    poster_url: null,
    live_status: "TONIGHT",
    status_label: "TONIGHT",
    is_mock_fixture: true,
    started_at_iso: null,
  },
  {
    media_id: "mock-owner-workshop",
    entity_name: "Your Studio",
    title: "Workshop · evening",
    poster_url: null,
    live_status: "TONIGHT",
    status_label: "TONIGHT",
    is_mock_fixture: true,
    started_at_iso: null,
  },
];

// ── Types ──────────────────────────────────────────────────────────────

interface DemoProduct {
  id: string;
  name: string;
  priceLabel: string;
  attributes: string[];
  inStock: boolean;
  imageAccent: string;
  imageGlyph: string;
  imageIndex: number;
  imageTotal: number;
}

// Filter pills (All / My Products / Collections / Drafts / Sold) were
// removed 2026-09-06 per Founder direction — the Products workspace now
// always renders the owner's roster without chip taxonomy. Add back only
// when a genuine per-status persisted view ships.

// ── Mock demo data · REPLACE WITH REAL API WHEN AVAILABLE ─────────────

const MOCK_PRODUCTS: DemoProduct[] = [
  {
    id: "demo-street-runner-pro",
    name: "Street Runner Pro",
    priceLabel: "Rp850.000",
    attributes: ["Black", "Size 42", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #1a1a1a 0%, #2d2d2d 55%, #3a3a3a 100%)",
    imageGlyph: "👟",
    imageIndex: 1,
    imageTotal: 5,
  },
  {
    id: "demo-nex-sound-x7",
    name: "NEX Sound X7",
    priceLabel: "Rp1.250.000",
    attributes: ["Wireless", "Black", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #0e0e10 0%, #232326 55%, #2d2d33 100%)",
    imageGlyph: "🎧",
    imageIndex: 1,
    imageTotal: 4,
  },
  {
    id: "demo-chrono-max-watch",
    name: "Chrono Max Watch",
    priceLabel: "Rp2.950.000",
    attributes: ["Steel", "Water Resistant", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #131518 0%, #1e2126 55%, #2a2f36 100%)",
    imageGlyph: "⌚",
    imageIndex: 1,
    imageTotal: 6,
  },
  {
    id: "demo-nex-tech-jacket",
    name: "NEX Tech Jacket",
    priceLabel: "Rp675.000",
    attributes: ["Black", "Waterproof", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #101012 0%, #1c1c20 55%, #26262c 100%)",
    imageGlyph: "🧥",
    imageIndex: 1,
    imageTotal: 3,
  },
];

// ── Design tokens · NEX inner-display palette ──────────────────────────
// Restrained orange · orange = action affordance only · not decoration.
const T = {
  bg:         "#050506",
  surface:    "rgba(20, 20, 24, 0.72)",
  surfaceHi:  "rgba(28, 28, 34, 0.88)",
  border:     "rgba(255, 255, 255, 0.06)",
  borderMed:  "rgba(255, 255, 255, 0.10)",
  borderHi:   "rgba(255, 255, 255, 0.16)",
  textPri:    "rgba(245, 245, 246, 0.98)",
  textSec:    "rgba(178, 178, 184, 0.88)",
  textDim:    "rgba(130, 130, 138, 0.75)",
  textMute:   "rgba(100, 100, 108, 0.65)",
  orange:     "#f97316",
  orangeSoft: "rgba(249, 115, 22, 0.10)",
  orangeMid:  "rgba(249, 115, 22, 0.35)",
  green:      "#22c55e",
  greenSoft:  "rgba(34, 197, 94, 0.10)",
  greenMid:   "rgba(34, 197, 94, 0.35)",
};

// Geometry constants · derived from Philip's reference (820×1392 inner
// display · card ≈ 140px · header ≈ 82px · add-product ≈ 76px). These
// are relative sizes · no absolute pixel width is imposed on the workspace.
const G = {
  hPad:      16,   // internal horizontal padding of workspace children
  cardH:     140,  // FIXED card height (Philip 2026-09-05 · consistency required)
  // Philip 2026-09-05 · SECOND refinement pass: image reduced 108→90 so the
  // text column has meaningful width for real product names. Product name
  // now gets 2-line clamp (was 1-line ellipsis truncating to "Stre..."
  // etc.) so the most important information is never sacrificed.
  imgSize:   90,   // reduced from 108
  cardPad:   8,
  cardGap:   8,
  radius:    14,
  radiusS:   10,
  btnH:      34,   // Ask/Buy button height (down 2 for compactness)
  headerH:   82,
  // Add Product reduced 76→66 · feels like a primary action row, not a
  // large content card.
  addH:      66,
};

// ── Props ──────────────────────────────────────────────────────────────

export interface NexWorkspaceProductsProps {
  onBack?: () => void;
  /**
   * P0.1 (Philip 2026-09-05): tapping the Add Product tile navigates to the
   * Product Creator workspace. NexAppShell wires this to
   * setArtifact("product-creator"). When omitted the tile falls back to a
   * console stub (preserves prior behaviour for callers not yet wired).
   */
  onAddProduct?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────

export function NexWorkspaceProducts({ onBack, onAddProduct }: NexWorkspaceProductsProps) {
  const [favorited, setFavorited] = useState<Record<string, boolean>>({});

  // Live strip · replaces the previous "Add Product" tile at the top of
  // the Products workspace. Renders the same city Live fixtures the
  // /nex-app/live surface uses · never fabricates.
  const [liveItems, setLiveItems] = useState<LiveStripItem[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("city", "yogyakarta");
        params.set("status", "LIVE_NOW,STARTING_SOON,TONIGHT");
        params.set("limit", "8");
        const r = await fetch(`/api/nex-live/tonight?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        setLiveItems(Array.isArray(j?.items) ? j.items as LiveStripItem[] : []);
      } catch {
        if (!cancelled) setLiveItems([]);
      } finally {
        if (!cancelled) setLiveLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const products = MOCK_PRODUCTS;

  const toggleFavorite = (id: string) => {
    setFavorited((prev) => ({ ...prev, [id]: !prev[id] }));
    console.log(`[NexWorkspaceProducts] favorite toggled · id=${id} · UI stub`);
  };
  const uiStub = (label: string, id?: string) => {
    console.log(`[NexWorkspaceProducts] ${label}${id ? ` · id=${id}` : ""} · UI stub · no backend`);
  };

  return (
    <section
      aria-label="NEX Products workspace"
      // Inside-out layout: this section is the OWNER of the inner-display
      // area given to it by NexAppShell. It never queries window sizes.
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        boxSizing: "border-box",
        color: T.textPri,
        background: T.bg,
        // Explicit overflow control: horizontal NEVER · vertical is the
        // list scroll region's job.
        overflow: "hidden",
        // Positioned so the floating Add-Product action button below
        // scopes to the workspace, not the browser viewport.
        position: "relative",
      }}
    >
      {/* ─── Header · compact · Philip target ~82px ─────────────────── */}
      <header
        style={{
          flex: `0 0 ${G.headerH}px`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: `0 ${G.hPad}px`,
          borderBottom: `1px solid ${T.border}`,
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={() => { onBack?.(); }}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            padding: 0,
            width: 40,
            height: 40,
            borderRadius: 10,
            color: T.orange,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.01,
              lineHeight: 1.15,
              color: T.textPri,
            }}
          >
            Products
          </div>
          <div
            style={{
              fontSize: 12,
              color: T.textDim,
              lineHeight: 1.2,
              letterSpacing: 0.05,
              marginTop: 2,
            }}
          >
            Share in chat
          </div>
        </div>

        {/* Search icon removed 2026-09-06 per Founder direction. */}
        <button
          type="button"
          aria-label="Filter and sort"
          onClick={() => uiStub("filter panel opened")}
          style={iconBtn({ variant: "accent" })}
        >
          <SlidersHorizontal size={16} strokeWidth={2} />
        </button>
      </header>

      {/* ─── Live strip · replaces the old Add-Product tile ─────────────
          Small tall cards · horizontal scroll · runtime label + entity
          name. Data comes straight from /api/nex-live/tonight so the
          Products workspace surfaces the same LIVE state as /nex-app/live.
          Add Product moved to a bottom-right floating action button. */}
      <div
        style={{
          flex: "0 0 auto",
          padding: `10px ${G.hPad}px 0`,
          boxSizing: "border-box",
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <ProductsLiveStrip items={liveItems} loaded={liveLoaded} />
      </div>

      {/* ─── "Products" section label · sits over the card grid ─────── */}
      <div
        style={{
          flex: "0 0 auto",
          padding: `14px ${G.hPad}px 4px`,
          boxSizing: "border-box",
          minWidth: 0,
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.18,
            textTransform: "uppercase",
            color: T.textDim,
          }}
        >
          Products
        </div>
      </div>

      {/* ─── Product list · the ONLY scroll region ─────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",       // safety only · card geometry is correct
          padding: `10px ${G.hPad}px 18px`,
          display: "flex",
          flexDirection: "column",
          gap: G.cardGap,
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {products.length === 0 ? (
          <div
            style={{
              padding: "30px 20px",
              textAlign: "center",
              color: T.textDim,
              fontSize: 13,
              fontStyle: "italic",
            }}
          >
            No products in this view yet.
          </div>
        ) : (
          products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              favorited={!!favorited[p.id]}
              onToggleFavorite={() => toggleFavorite(p.id)}
              onAsk={() => uiStub("Ask tapped", p.id)}
              onBuy={() => uiStub("Buy tapped", p.id)}
            />
          ))
        )}
      </div>

      {/* ─── Floating Add Product · bottom-right ────────────────────────
          Standard mobile FAB · scoped inside the workspace via the
          section's position:relative, so it never leaks over other
          NEX-app surfaces. */}
      <button
        type="button"
        aria-label="Add a new product"
        title="Add Product · create and share with friends"
        onClick={() => {
          if (onAddProduct) onAddProduct();
          else uiStub("Add Product tapped · onAddProduct not wired · staying on Products");
        }}
        style={{
          position: "absolute",
          right: 18,
          bottom: 18,
          width: 56,
          height: 56,
          borderRadius: 999,
          border: "none",
          background: T.orange,
          color: "#ffffff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(249,115,22,0.35), 0 2px 6px rgba(0,0,0,0.35)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
          zIndex: 20,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>
    </section>
  );
}

// ── Products Live strip · small tall cards · left→right carousel ──────
// Renders city Live fixtures as compact tall-format cards. Runtime label
// (LIVE / STARTING SOON / TONIGHT) sits on the poster. Entity name sits
// below. Zero-fabrication: honest empty state when the tonight endpoint
// returns nothing.

// Live strip layout constants · four cards fit exactly to the workspace
// width, then scroll-snap advances the next four into view. Each card is
// always fully visible — the strip never cuts a card mid-scroll.
const STRIP_GAP = 8;                    // horizontal gap between cards
const STRIP_CARDS_PER_VIEW = 4;         // 4 cards fit the visible strip
const STRIP_CARD_HEIGHT = 132;          // tall card · height stays fixed

function ProductsLiveStrip({ items, loaded }: { items: LiveStripItem[]; loaded: boolean }) {
  const skeleton = !loaded;
  // When real Live data is empty, fall back to owner-scoped MOCK cards
  // so the pattern is always visible. Every fallback card has
  // is_mock_fixture=true · the "Mock" chip surfaces so nobody mistakes
  // it for real live content.
  const source: LiveStripItem[] = !skeleton && items.length === 0
    ? MOCK_OWNER_LIVE_PLACEHOLDERS
    : items;
  const cards: (LiveStripItem | null)[] = skeleton ? Array.from({ length: 6 }, () => null) : source;

  return (
    <div
      data-testid="products-live-strip"
      role="list"
      aria-label="Live around you"
      style={{
        display: "flex",
        gap: STRIP_GAP,
        overflowX: "auto",
        overflowY: "hidden",
        paddingBottom: 4,
        // Whole-card paging · every card snaps to the container's left
        // edge so the viewport can never show a partially clipped card.
        scrollSnapType: "x mandatory",
        scrollBehavior: "smooth",
        // Hide native scrollbar · gesture drives the strip
        scrollbarWidth: "none",
        // iOS Safari momentum scroll
        WebkitOverflowScrolling: "touch",
      }}
    >
      {cards.map((c, i) => (
        <LiveStripCard key={c?.media_id ?? `sk-${i}`} card={c} />
      ))}
    </div>
  );
}

function LiveStripCard({ card }: { card: LiveStripItem | null }) {
  const isLive = card?.live_status === "LIVE_NOW";
  const isStarting = card?.live_status === "STARTING_SOON";
  const label = card?.status_label ?? "";
  const name = card?.entity_name ?? card?.title ?? "";
  const poster = card?.poster_url ?? null;

  return (
    <div
      role="listitem"
      style={{
        // Width = (container - total gaps) / cards-per-view · fits 4
        // cards to the strip and never grows or shrinks.
        flex: `0 0 calc((100% - ${STRIP_GAP * (STRIP_CARDS_PER_VIEW - 1)}px) / ${STRIP_CARDS_PER_VIEW})`,
        minWidth: 0,
        height: STRIP_CARD_HEIGHT,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        background: T.surfaceHi,
        border: `1px solid ${T.borderMed}`,
        // Snap to the strip's left edge · guarantees whole-card view.
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
      }}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(160deg, #1a1a1f 0%, #26262d 55%, #33333c 100%)",
            display: "grid",
            placeItems: "center",
            color: T.textMute,
            fontSize: 22,
          }}
        >
          ▶
        </div>
      )}

      {/* Runtime pill · top-left · never fabricated */}
      {card && (isLive || isStarting) && (
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            color: isLive ? "#f87171" : "rgba(255,255,255,0.85)",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 0.05,
            textTransform: "uppercase",
          }}
        >
          {isLive && (
            <span
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "#ef4444",
                boxShadow: "0 0 6px rgba(239,68,68,0.9)",
              }}
            />
          )}
          {label}
        </div>
      )}

      {/* Mock chip · never hidden · §17 */}
      {card?.is_mock_fixture && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            padding: "1px 5px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            color: "#fbbf24",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: 0.05,
            textTransform: "uppercase",
          }}
        >
          Mock
        </div>
      )}

      {/* Bottom gradient + name */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "16px 6px 6px",
          background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%)",
          color: "#fff",
          fontSize: 10,
          lineHeight: 1.2,
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name || (card === null ? " " : "")}
      </div>
    </div>
  );
}

// ── Product card · FIXED height · min-width:0 discipline ───────────────

function ProductCard({
  product, favorited, onToggleFavorite, onAsk, onBuy,
}: {
  product: DemoProduct;
  favorited: boolean;
  onToggleFavorite: () => void;
  onAsk: () => void;
  onBuy: () => void;
}) {
  return (
    <article
      aria-label={`Product · ${product.name}`}
      style={{
        // Fixed geometry · all cards identical height · width fills parent
        // without pushing past it. min-width:0 lets the flex row shrink
        // instead of ballooning when text is long.
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height: G.cardH,
        boxSizing: "border-box",
        display: "flex",
        gap: 12,
        padding: G.cardPad,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: G.radius,
        alignItems: "stretch",
        overflow: "hidden",       // internal text-clamp only · not a page band-aid
      }}
    >
      {/* Image tile · fixed 108×108 · never determines card size ── */}
      <div
        style={{
          position: "relative",
          flex: `0 0 ${G.imgSize}px`,
          width: G.imgSize,
          height: G.imgSize,
          borderRadius: G.radiusS,
          background: product.imageAccent,
          border: `1px solid ${T.borderMed}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          alignSelf: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 34,
            opacity: 0.72,
            lineHeight: 1,
            filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.45))",
          }}
        >
          {product.imageGlyph}
        </span>
        <span
          aria-label={`Image ${product.imageIndex} of ${product.imageTotal}`}
          style={{
            position: "absolute",
            top: 5,
            left: 5,
            padding: "2px 6px",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: T.textPri,
            background: "rgba(0, 0, 0, 0.55)",
            border: `1px solid ${T.borderMed}`,
            borderRadius: 999,
          }}
        >
          {product.imageIndex}/{product.imageTotal}
        </span>
      </div>

      {/* Text column · MUST have min-width:0 to allow shrink ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        {/* Top block: label + name + favorite */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.6,
                color: T.textMute,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              Product
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.textPri,
                marginTop: 3,
                lineHeight: 1.18,
                letterSpacing: -0.005,
                // Philip 2026-09-05 · 2-line clamp · product name is the
                // most important piece of information · never sacrifice it
                // to a 3-character ellipsis truncation.
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {product.name}
            </div>
          </div>

          <button
            type="button"
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            onClick={onToggleFavorite}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: 0,
              width: 24,
              height: 24,
              cursor: "pointer",
              color: favorited ? T.orange : T.textMute,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Heart size={16} strokeWidth={2} fill={favorited ? T.orange : "none"} />
          </button>
        </div>

        {/* Middle block: price + attributes */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: T.orange,
              lineHeight: 1.15,
              letterSpacing: -0.005,
            }}
          >
            {product.priceLabel}
          </div>
          <div
            style={{
              fontSize: 12,
              color: T.textSec,
              marginTop: 3,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {product.attributes.map((a, i) => (
              <React.Fragment key={a}>
                {i > 0 && <span style={{ color: T.textMute, margin: "0 6px" }}>·</span>}
                {a}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Bottom block: availability + Ask/Buy · compact */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          {product.inStock ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: T.green,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: T.green,
                }}
              />
              In Stock
            </span>
          ) : (
            <span style={{ fontSize: 11, color: T.textDim, fontWeight: 600, flexShrink: 0 }}>
              Sold out
            </span>
          )}

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              aria-label={`Ask about ${product.name}`}
              onClick={onAsk}
              style={compactBtn({ variant: "orange" })}
            >
              <MessageCircle size={13} strokeWidth={2.2} />
              Ask
            </button>
            <button
              type="button"
              aria-label={`Buy ${product.name}`}
              onClick={onBuy}
              style={compactBtn({ variant: "green" })}
            >
              <ShoppingBag size={13} strokeWidth={2.2} />
              Buy
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────

function iconBtn({ variant }: { variant: "quiet" | "accent" }): React.CSSProperties {
  const isAccent = variant === "accent";
  return {
    appearance: "none",
    width: 40,
    height: 40,
    borderRadius: 999,
    background: isAccent ? T.orangeSoft : "transparent",
    border: `1px solid ${isAccent ? T.orangeMid : T.borderMed}`,
    color: isAccent ? T.orange : T.textSec,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxSizing: "border-box",
  };
}

function compactBtn({ variant }: { variant: "orange" | "green" }): React.CSSProperties {
  const isOrange = variant === "orange";
  return {
    appearance: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: G.btnH,
    padding: "0 12px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.15,
    background: isOrange ? T.orangeSoft : T.greenSoft,
    border: `1px solid ${isOrange ? T.orangeMid : T.greenMid}`,
    color: isOrange ? T.orange : T.green,
    cursor: "pointer",
    boxSizing: "border-box",
    flexShrink: 0,
  };
}
