"use client";

// src/app/nex-native/themes/pink-dream/_shop-slider-preview.tsx
//
// Bridge 54 · Pink Dream themed shop-grid slider · preview only.
// --------------------------------------------------------------
// Renders the sealed chat-native shop slider (see _shop-grid-modal.tsx)
// with the Pink Dream palette instead of the generic dark-navy shell.
// Two mock content sets are toggleable inside the same slider so the
// founder can see the SAME chrome adapt between product-seller (bag
// glyph, "Shop" label) and food-seller (cutlery glyph, "Menu" label)
// personas.
//
// Nothing here talks to a server · Add-to-cart + Close are the only
// live buttons · everything else is visual only.
//
// Wired from the shop icon in the Pink Dream preview header.

import * as React from "react";
import { createPortal } from "react-dom";

type Mode = "products" | "menu";

interface Item {
  id: string;
  name: string;
  /** 1-3 sentence blurb rendered on the card · line-clamped to 3
   *  lines with ellipsis so cards stay a uniform height. */
  description: string;
  price: string;
  /** Numeric price used for the "Lowest price" sort · unit is
   *  arbitrary for this preview mock. */
  pricePence: number;
  /** Popularity rank · lower number = more popular. Drives the
   *  "Popular" sort. */
  popularityRank: number;
  /** Distance from buyer in km · drives the "Near me" sort. */
  distanceKm: number;
  tags: string[] | null;
  /** Bridge 54j · seller can upload 1..N images per item · detail
   *  view renders a gallery with prev/next arrows + `n/total`
   *  counter when the list has more than 1. Cards show only the
   *  first image. Empty list falls back to the 🌸 emoji tile. */
  imageUrls: string[];
  /** Bridge 60 · one-tap in-stock flag · defaults to true. Seller
   *  toggles this off from their dashboard when a product runs out ·
   *  buyer sees a red "Sold out" badge on the card + a warning in
   *  the detail view. Cuts "kak, ada?" chat volume without adding
   *  seller-side complexity. */
  inStock?: boolean;
  /** Bridge 54k · MVP spec block · every field is optional so both
   *  products and menu items can populate whichever subset applies.
   *  Products typically set condition/colors/sizes/deliveryLabel.
   *  Menu items typically set spiceLevel/dietary/perks/prepTime. */
  condition?: "new" | "used" | "refurbished";
  colors?: { name: string; hex: string; soldOut?: boolean }[];
  sizes?: { label: string; soldOut?: boolean }[];
  /** Category the seller picked · drives which variant labels render.
   *  Sealed 2026-09-29 · doctrine C from the variant brainstorm. */
  variantCategory?:
    | "shoes"
    | "shirt"
    | "pants"
    | "dress"
    | "print"
    | "coffee"
    | "accessory";
  /** Optional link label under the Size grid · e.g. "Size guide". */
  sizeGuideLabel?: string;
  deliveryLabel?: string;
  spiceLevel?: number;
  dietary?: string[];
  perks?: string[];
  prepTime?: string;
}

type FilterMode = "popular" | "cheapest" | "near";

const MOCK_PRODUCTS: Item[] = [
  {
    id: "prod-1",
    name: "Bunny Sticker Pack · 12 designs",
    price: "Rp 45,000",
    pricePence: 4500000,
    popularityRank: 1,
    distanceKm: 3.2,
    description:
      "Twelve original bunny illustrations printed on premium waterproof matte vinyl · perfect for laptops, water bottles, and journal covers.",
    tags: ["waterproof", "matte"],
    imageUrls: [
      "https://images.unsplash.com/photo-1553481187-be93c21490a9?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800&h=534&fit=crop",
    ],
    condition: "new",
    variantCategory: "print",
    sizes: [{ label: "A6" }, { label: "A5" }],
    deliveryLabel: "Rp 12,000",
  },
  {
    id: "prod-2",
    name: "Sunset Studio Print · A3",
    description:
      "Hand-signed limited edition of 50 · giclée print on 300gsm cotton paper · ships flat in a recycled sleeve.",
    price: "Rp 180,000",
    pricePence: 18000000,
    popularityRank: 4,
    distanceKm: 1.4,
    tags: ["signed", "limited"],
    imageUrls: [
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1495312040802-a929cd14a6ab?w=800&h=534&fit=crop",
    ],
    condition: "new",
    variantCategory: "print",
    sizes: [
      { label: "A4" },
      { label: "A3" },
      { label: "A2", soldOut: true },
    ],
    deliveryLabel: "Free",
  },
  {
    id: "prod-3",
    name: "Pastel Tote Bag",
    description:
      "Sturdy 100% cotton canvas with a screen-printed bunny mascot · fits an A4 laptop plus a sketchbook.",
    price: "Rp 120,000",
    pricePence: 12000000,
    popularityRank: 2,
    distanceKm: 6.8,
    tags: ["cotton"],
    imageUrls: [
      "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&h=534&fit=crop",
    ],
    inStock: false,
    condition: "new",
    variantCategory: "accessory",
    colors: [
      { name: "Blush", hex: "#FFC1DF" },
      { name: "Cream", hex: "#F1E7D9" },
      { name: "Charcoal", hex: "#3A2E3F" },
    ],
    sizes: [{ label: "One size" }],
    deliveryLabel: "Rp 18,000",
  },
  {
    id: "prod-4",
    name: "Illustration Zine · Vol.2",
    description:
      "32 pages of new work · risograph printed in pink and cyan · staple bound · numbered edition.",
    price: "Rp 95,000",
    pricePence: 9500000,
    popularityRank: 3,
    distanceKm: 12.1,
    tags: null,
    imageUrls: [
      "https://images.unsplash.com/photo-1490127252417-7c393f993ee4?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1553481187-be93c21490a9?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=534&fit=crop",
    ],
    condition: "new",
    variantCategory: "print",
    deliveryLabel: "Free",
  },
  {
    id: "prod-5",
    name: "Runner · Trail Sneaker",
    description:
      "Featherweight trail runner with grip sole · breathable mesh upper · reinforced toe cap · unisex sizing.",
    price: "Rp 620,000",
    pricePence: 62000000,
    popularityRank: 5,
    distanceKm: 4.4,
    tags: null,
    imageUrls: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&h=534&fit=crop",
    ],
    condition: "new",
    variantCategory: "shoes",
    colors: [
      { name: "Rose", hex: "#FF77BC" },
      { name: "Slate", hex: "#4A5460" },
      { name: "Bone", hex: "#EFE7DA" },
    ],
    sizes: [
      { label: "EU 40" },
      { label: "EU 41" },
      { label: "EU 42" },
      { label: "EU 43" },
      { label: "EU 44", soldOut: true },
      { label: "EU 45", soldOut: true },
    ],
    sizeGuideLabel: "Size guide",
    deliveryLabel: "Rp 25,000",
  },
  {
    id: "prod-6",
    name: "Everyday Tee · Heavyweight",
    description:
      "240gsm combed cotton · boxy fit · pre-shrunk · double-stitched hem · screen-printed bunny mascot on the chest.",
    price: "Rp 220,000",
    pricePence: 22000000,
    popularityRank: 6,
    distanceKm: 2.1,
    tags: null,
    imageUrls: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&h=534&fit=crop",
    ],
    condition: "new",
    variantCategory: "shirt",
    colors: [
      { name: "Blush", hex: "#FFB6D5" },
      { name: "Off-white", hex: "#F5EFE6" },
      { name: "Ink", hex: "#171227" },
      { name: "Sage", hex: "#B4C7A9", soldOut: true },
    ],
    sizes: [
      { label: "S" },
      { label: "M" },
      { label: "L" },
      { label: "XL" },
      { label: "XXL", soldOut: true },
    ],
    sizeGuideLabel: "Size guide",
    deliveryLabel: "Free",
  },
];

const MOCK_MENU: Item[] = [
  {
    id: "menu-1",
    name: "Strawberry Cloud Latte",
    description:
      "Espresso, oat milk, house-made strawberry syrup, topped with a whipped strawberry cloud and freeze-dried berries.",
    price: "Rp 38,000",
    pricePence: 3800000,
    popularityRank: 1,
    distanceKm: 0.6,
    tags: ["dairy-free"],
    imageUrls: [
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=534&fit=crop",
    ],
    spiceLevel: 0,
    dietary: ["Dairy-free", "Vegan"],
    prepTime: "~4 min",
  },
  {
    id: "menu-2",
    name: "Sakura Cupcake · pink swirl",
    description:
      "Vanilla sponge with cherry-blossom jam center · piped rose-water buttercream · topped with a sugared petal.",
    price: "Rp 32,000",
    pricePence: 3200000,
    popularityRank: 3,
    distanceKm: 0.6,
    tags: ["vegetarian"],
    imageUrls: [
      "https://images.unsplash.com/photo-1519869325930-281384150729?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1587668178277-295251f900ce?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800&h=534&fit=crop",
    ],
    spiceLevel: 0,
    dietary: ["Vegetarian", "Contains gluten"],
    perks: ["BOGO on Wednesdays"],
    prepTime: "~6 min",
  },
  {
    id: "menu-3",
    name: "Cotton-Candy Waffle",
    description:
      "Buttermilk waffle draped in fresh cotton candy that melts on impact · served with warm strawberry compote.",
    price: "Rp 48,000",
    pricePence: 4800000,
    popularityRank: 2,
    distanceKm: 0.6,
    tags: null,
    imageUrls: [
      "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&h=534&fit=crop",
    ],
    inStock: false,
    spiceLevel: 0,
    dietary: ["Vegetarian"],
    perks: ["Free drink with order"],
    prepTime: "~8 min",
  },
  {
    id: "menu-4",
    name: "Rose Petal Iced Tea",
    description:
      "Cold-brewed rose petals and hibiscus over ice · lightly sweetened with agave · finished with a lemon wheel.",
    price: "Rp 28,000",
    pricePence: 2800000,
    popularityRank: 4,
    distanceKm: 0.6,
    tags: ["cold"],
    imageUrls: [
      "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=534&fit=crop",
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=534&fit=crop",
    ],
    spiceLevel: 0,
    dietary: ["Vegan", "Sugar-free option"],
    prepTime: "~3 min",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultMode?: Mode;
}

export function PinkDreamShopSliderPreview({
  open,
  onClose,
  defaultMode = "products",
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>(defaultMode);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterMode>("popular");
  const [filterOpen, setFilterOpen] = React.useState(false);
  /** Bridge 54g · id of the item whose detail view is open · null
   *  means "show the grid". Back arrow in the detail view clears
   *  this back to null. */
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setQuery("");
      setFilter("popular");
      setFilterOpen(false);
      setSelectedId(null);
    }
  }, [open, defaultMode]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (filterOpen) setFilterOpen(false);
        else if (selectedId) setSelectedId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, filterOpen, selectedId]);

  if (!open || !mounted) return null;

  const source = mode === "products" ? MOCK_PRODUCTS : MOCK_MENU;
  const q = query.trim().toLowerCase();
  const filtered =
    q.length > 0
      ? source.filter((it) => it.name.toLowerCase().includes(q))
      : source;
  const sorted = [...filtered].sort((a, b) => {
    if (filter === "cheapest") return a.pricePence - b.pricePence;
    if (filter === "near") return a.distanceKm - b.distanceKm;
    return a.popularityRank - b.popularityRank;
  });
  const items = sorted;
  const eyebrow = mode === "products" ? "Shop" : "Menu";
  const shopName =
    mode === "products" ? "Bunny's Studio" : "Bunny's Sweet Treats";
  const filterLabel =
    filter === "cheapest"
      ? "Lowest price"
      : filter === "near"
        ? "Near me"
        : "Popular";
  const selectedItem = selectedId
    ? source.find((it) => it.id === selectedId) ?? null
    : null;

  return createPortal(
    <>
      <style>{`
        @keyframes pd-shop-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pd-shop-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        /* Bridge 54f · pink vertical scrollbar · thin bar with a hot
           pink gradient thumb + faint pink track so it reads as part
           of the Pink Dream theme rather than a browser default. */
        [data-pd-shop-scroll] {
          scrollbar-width: thin;
          scrollbar-color: #FF3F9F rgba(255,138,197,0.10);
        }
        [data-pd-shop-scroll]::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        [data-pd-shop-scroll]::-webkit-scrollbar-track {
          background: rgba(255,138,197,0.10);
          border-radius: 999px;
        }
        [data-pd-shop-scroll]::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #FF8AC5, #FF3F9F);
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(255,79,163,0.45);
        }
        [data-pd-shop-scroll]::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #FF9BD1, #FF4FA3);
        }
      `}</style>

      {/* Dim backdrop · deep purple/pink tint */}
      <div
        role="button"
        aria-label="Close shop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(23,18,31,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 1000,
          animation: "pd-shop-fade 200ms ease-out both",
        }}
      />

      {/* Bottom sheet · Pink Dream palette */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${shopName} · ${eyebrow}`}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "78vh",
          background:
            "linear-gradient(180deg, rgba(50,27,61,0.98) 0%, rgba(35,20,44,0.99) 100%)",
          borderTop: "1px solid rgba(255,138,197,0.55)",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow:
            "0 -20px 60px rgba(0,0,0,0.7), 0 0 60px rgba(255,79,163,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
          zIndex: 1001,
          color: "#FFF5FA",
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          animation: "pd-shop-slide-up 320ms cubic-bezier(.2,.7,.2,1) both",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        {/* Pink drag handle */}
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,138,197,0.55)",
            margin: "8px auto 0",
            flexShrink: 0,
          }}
        />

        {/* Header · list mode = eyebrow + shop name + filter pill ·
           detail mode = item name (left) + Stock chip (right) ·
           Founder direction 2026-09-29 revised. */}
        <div
          style={{
            padding: "16px 18px 10px",
            borderBottom: "1px solid rgba(255,138,197,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {selectedItem ? (
            <>
              <h2
                style={{
                  margin: 0,
                  minWidth: 0,
                  flex: 1,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#FFF5FA",
                  lineHeight: 1.2,
                  letterSpacing: "-0.005em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {selectedItem.name}
              </h2>
              <div
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(34,227,122,0.14)",
                  border: "1px solid rgba(34,227,122,0.4)",
                  color: "#22E37A",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22E37A",
                    boxShadow: "0 0 6px rgba(34,227,122,0.75)",
                  }}
                />
                <span>Stock 345</span>
              </div>
            </>
          ) : (
            <>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#FF8BC5",
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {shopName}
            </div>
          </div>
          {/* Bridge 54b · pink filter pill replaces the round X ·
             opens a small filter menu (Popular · Lowest price ·
             Near me). Bottom footer Close remains the exit. */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              aria-label={`Sort by ${filterLabel}`}
              onClick={() => setFilterOpen((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px 6px 12px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #FF8AC5, #FF3F9F)",
                border: "1px solid rgba(255,205,230,0.75)",
                color: "#FFF5FA",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                boxShadow: "0 3px 10px rgba(255,79,163,0.35)",
              }}
            >
              <FilterIcon />
              <span>{filterLabel}</span>
              <Chevron open={filterOpen} />
            </button>
            {filterOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  minWidth: 160,
                  padding: 6,
                  borderRadius: 12,
                  background:
                    "linear-gradient(180deg, rgba(50,27,61,0.98), rgba(35,20,44,0.99))",
                  border: "1px solid rgba(255,138,197,0.45)",
                  boxShadow:
                    "0 12px 28px rgba(0,0,0,0.55), 0 0 24px rgba(255,79,163,0.28)",
                  zIndex: 1002,
                }}
              >
                <FilterOption
                  active={filter === "popular"}
                  label="Popular"
                  onClick={() => {
                    setFilter("popular");
                    setFilterOpen(false);
                  }}
                />
                <FilterOption
                  active={filter === "cheapest"}
                  label="Lowest price"
                  onClick={() => {
                    setFilter("cheapest");
                    setFilterOpen(false);
                  }}
                />
                <FilterOption
                  active={filter === "near"}
                  label="Near me"
                  onClick={() => {
                    setFilter("near");
                    setFilterOpen(false);
                  }}
                />
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {selectedItem ? (
          <ItemDetailBody item={selectedItem} />
        ) : (
          <>
        {/* Bridge 54b · search bar · products/menu items filter live
           by name · sits above the mode toggle so it reads as the
           primary way to narrow a large catalogue. */}
        <div style={{ padding: "10px 18px 0" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(255,138,197,0.08)",
              border: "1px solid rgba(255,138,197,0.28)",
            }}
          >
            <SearchIcon />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "products"
                  ? "Search products…"
                  : "Search menu…"
              }
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#FFF5FA",
                fontFamily: "inherit",
                fontSize: 13,
                lineHeight: 1.3,
              }}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  border: "none",
                  color: "#FFF5FA",
                  cursor: "pointer",
                  padding: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </label>
        </div>

        {/* Bridge 54c · mode toggle relocated to the Pink Dream page
           hero as a dev-only overlay · slider opens in whichever
           mode the preview picker was on. */}

        {/* Grid */}
        <div
          data-pd-shop-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 14,
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#D8C6D3",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              No {mode === "products" ? "products" : "menu items"} match{" "}
              <span style={{ color: "#FFF5FA", fontWeight: 600 }}>
                &ldquo;{query}&rdquo;
              </span>
              .
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
              }}
            >
              {items.map((it) => (
                <PinkCard
                  key={it.id}
                  item={it}
                  onView={() => setSelectedId(it.id)}
                />
              ))}
            </div>
          )}
        </div>
          </>
        )}

        {/* Footer · doctrine hint + Close */}
        <div
          style={{
            padding: "10px 14px 12px",
            borderTop: "1px solid rgba(255,138,197,0.22)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 10,
              letterSpacing: "0.04em",
              color: "#D8C6D3",
              lineHeight: 1.4,
            }}
          >
            Tap a card to add it to your cart and send the order right
            here in chat.
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #FF8AC5, #FF3F9F)",
              border: "1px solid rgba(255,205,230,0.75)",
              color: "#FFF5FA",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 3px 10px rgba(255,79,163,0.35)",
            }}
          >
            Close
          </button>
        </div>
      </section>
    </>,
    document.body,
  );
}

function PillTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: "none",
        background: active
          ? "linear-gradient(135deg, #FF8AC5, #FF3F9F)"
          : "transparent",
        color: active ? "#FFF5FA" : "#D8C6D3",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: active ? "0 3px 10px rgba(255,79,163,0.35)" : "none",
        transition: "background 160ms ease, color 160ms ease",
      }}
    >
      {label}
    </button>
  );
}

function PinkCard({ item, onView }: { item: Item; onView: () => void }) {
  return (
    <div
      style={{
        borderRadius: 14,
        background: "rgba(255,138,197,0.08)",
        border: "1px solid rgba(255,138,197,0.28)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        boxShadow: "0 4px 14px rgba(20,10,28,0.35)",
      }}
    >
      {/* Image · square 108px on the left · fixed width so the text
         column has predictable room. View pill overlaid at the
         bottom of the image (Founder direction 2026-09-29). */}
      <div
        style={{
          width: 108,
          flexShrink: 0,
          background: "#24162D",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {item.imageUrls.length > 0 ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.imageUrls[0]}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: "100%",
              height: "100%",
              color: "#D8C6D3",
              fontSize: 22,
            }}
          >
            🌸
          </div>
        )}
        {/* Bridge 60 · Sold-out badge · top-right of the image ·
           only renders when seller has toggled inStock=false from
           their dashboard. Grey overlay dims the image so the whole
           card reads as unavailable at a glance. */}
        {item.inStock === false && (
          <>
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(23,18,31,0.55)",
                backdropFilter: "grayscale(0.35)",
                WebkitBackdropFilter: "grayscale(0.35)",
              }}
            />
            <span
              aria-label="Sold out"
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                padding: "3px 8px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #FF5A6C, #E11D48)",
                color: "#FFF5FA",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                boxShadow: "0 3px 10px rgba(225,29,72,0.5)",
              }}
            >
              Sold out
            </span>
          </>
        )}
        {/* Bridge 54e · pink View pill sits over the lower edge of
           the image · gradient scrim behind it keeps the text
           legible over bright photos. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 42,
            background:
              "linear-gradient(180deg, rgba(23,18,31,0) 0%, rgba(23,18,31,0.72) 100%)",
          }}
        />
        <button
          type="button"
          onClick={onView}
          aria-label={`View ${item.name}`}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 8,
            transform: "translateX(-50%)",
            padding: "3px 14px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #FF8AC5, #FF3F9F)",
            border: "1px solid rgba(255,205,230,0.75)",
            color: "#FFF5FA",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(255,79,163,0.45)",
            whiteSpace: "nowrap",
            lineHeight: 1.4,
          }}
        >
          View
        </button>
      </div>

      {/* Content column · name (bold) on top · 3-line description
         clamped · price sits at the bottom, right-aligned. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "10px 12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#FFF5FA",
            lineHeight: 1.25,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.name}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#D8C6D3",
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            flex: 1,
          }}
        >
          {item.description}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#FF3F9F",
              fontWeight: 800,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              textShadow: "0 1px 4px rgba(255,63,159,0.35)",
            }}
          >
            {item.price}
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Bridge 54j · multi-image gallery for the detail view hero.
 *  When a seller uploads more than one image, left + right arrow
 *  buttons overlay the image and a `n / total` counter sits in the
 *  bottom-right corner. Single-image items render a plain hero
 *  with no controls. Index wraps around at both ends. Index resets
 *  to 0 when the images prop changes (i.e., a new item selected). */
function ImageGallery({ images }: { images: string[] }) {
  const [index, setIndex] = React.useState(0);
  const total = images.length;
  React.useEffect(() => {
    setIndex(0);
  }, [images]);
  const current = total > 0 ? images[index % total] : null;
  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);
  const hasMany = total > 1;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "3 / 2",
        borderRadius: 16,
        background: "#24162D",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 6px 20px rgba(20,10,28,0.55)",
        marginBottom: 14,
      }}
    >
      {current ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={current}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            display: "grid",
            placeItems: "center",
            width: "100%",
            height: "100%",
            color: "#D8C6D3",
            fontSize: 48,
          }}
        >
          🌸
        </div>
      )}

      {hasMany && (
        <>
          <GalleryArrow direction="prev" onClick={goPrev} />
          <GalleryArrow direction="next" onClick={goNext} />
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(23,18,31,0.72)",
              border: "1px solid rgba(255,138,197,0.4)",
              color: "#FFF5FA",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              lineHeight: 1.3,
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {index + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
}

function GalleryArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? "Previous image" : "Next image"}
      style={{
        position: "absolute",
        top: "50%",
        [isPrev ? "left" : "right"]: 10,
        transform: "translateY(-50%)",
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "rgba(23,18,31,0.72)",
        border: "1px solid rgba(255,138,197,0.4)",
        color: "#FFF5FA",
        cursor: "pointer",
        padding: 0,
        display: "grid",
        placeItems: "center",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
      }}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {isPrev ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}

/** Bridge 54g · in-slider product/menu detail view · replaces the
 *  grid when a card's View pill is tapped. Renders hero image, name,
 *  full description, tags, price, and two CTAs that mirror the real
 *  chat-native detail sheet ([Add to cart] + [Send in chat]). All
 *  buttons are preview only in this mock. */
function ItemDetailBody({ item }: { item: Item }) {
  return (
    <div
      data-pd-shop-scroll
      style={{
        // Bridge 54h · minHeight:0 is the flex-shrink hint so this
        // scrollable child actually shrinks inside the section's
        // maxHeight:78vh · without it the container grows to fit
        // the content and the image gets clipped at the top.
        flex: "1 1 auto",
        minHeight: 0,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "14px 18px 18px",
        display: "block",
      }}
    >
      <ImageGallery images={item.imageUrls} />


      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: "#FFF5FA",
            lineHeight: 1.15,
            letterSpacing: "-0.005em",
          }}
        >
          {item.name}
        </h2>
        <div
          style={{
            flexShrink: 0,
            fontSize: 16,
            fontWeight: 800,
            color: "#FF3F9F",
            letterSpacing: "0.02em",
            textShadow: "0 1px 4px rgba(255,63,159,0.35)",
          }}
        >
          {item.price}
        </div>
      </div>

      <p
        style={{
          margin: "0 0 18px",
          fontSize: 14,
          lineHeight: 1.55,
          color: "#FFF5FA",
          opacity: 0.9,
        }}
      >
        {item.description}
      </p>

      {/* Bridge 61 · variants block · sizes first, then colors · only
         renders what the seller has stocked (Founder direction
         2026-09-29 · display stocked-only, no sold-out state on this
         row · sold-out is item-level via inStock flag). */}
      <VariantsBlock item={item} />

      {/* Bridge 59/60 · single info line above the CTAs · either the
         universal green "free collection · delivery in chat" pill or
         a red sold-out warning when the seller has toggled the item
         off. Both are one-liner status pills · no variant matrix. */}
      {item.inStock === false ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            marginBottom: 18,
            borderRadius: 12,
            background: "rgba(225,29,72,0.10)",
            border: "1px solid rgba(255,90,108,0.45)",
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>🚫</span>
          <div
            style={{
              fontSize: 12,
              color: "#FFF5FA",
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            <span style={{ color: "#FF5A6C", fontWeight: 800 }}>
              Sold out
            </span>
            <span style={{ opacity: 0.7 }}> · </span>
            <span>message the seller to check when it&apos;s back</span>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            marginBottom: 18,
            borderRadius: 12,
            background: "rgba(34,227,122,0.08)",
            border: "1px solid rgba(34,227,122,0.35)",
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>🚚</span>
          <div
            style={{
              fontSize: 12,
              color: "#FFF5FA",
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            <span style={{ color: "#22E37A", fontWeight: 800 }}>
              Free collection
            </span>
            <span style={{ opacity: 0.7 }}> · </span>
            <span>delivery quoted in chat</span>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px 1fr 1fr",
          gap: 8,
          marginTop: 8,
        }}
      >
        <button
          type="button"
          aria-label="Chat with seller"
          title="Chat with seller"
          style={{
            padding: 0,
            height: 46,
            borderRadius: 12,
            background: "rgba(255,138,197,0.14)",
            border: "1px solid rgba(255,138,197,0.35)",
            color: "#FF8BC5",
            cursor: "pointer",
            fontFamily: "inherit",
            display: "grid",
            placeItems: "center",
          }}
        >
          <ChatBubbleIcon />
        </button>
        <button
          type="button"
          style={{
            padding: "13px 14px",
            borderRadius: 12,
            background: "rgba(255,138,197,0.14)",
            border: "1px solid rgba(255,138,197,0.35)",
            color: "#FFF5FA",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Add to cart
        </button>
        <button
          type="button"
          style={{
            padding: "13px 14px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #FF8AC5, #FF3F9F)",
            border: "1px solid rgba(255,205,230,0.75)",
            color: "#FFF5FA",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 6px 18px rgba(255,79,163,0.45)",
          }}
        >
          Send in chat
        </button>
      </div>
    </div>
  );
}


/** Bridge 61 · Variants block · sizes then colors · stocked-only ·
 *  lightweight interactive picker. Sits between description and
 *  the delivery pill on the detail view. Renders nothing when the
 *  item has neither sizes nor colors (accessories, single-SKU
 *  products, menu items). Selection carries into the Send-in-chat
 *  message body so the seller sees exactly what the buyer picked. */
function VariantsBlock({ item }: { item: Item }) {
  const [size, setSize] = React.useState<string | null>(null);
  const [color, setColor] = React.useState<string | null>(null);
  React.useEffect(() => {
    setSize(null);
    setColor(null);
  }, [item.id]);

  const sizes = item.sizes ?? [];
  const colors = item.colors ?? [];
  if (sizes.length === 0 && colors.length === 0) return null;

  const summary: string[] = [];
  if (size) summary.push(size);
  if (color) summary.push(color);

  return (
    <div style={{ marginBottom: 20 }}>
      {sizes.length > 0 && (
        <section style={{ marginBottom: colors.length > 0 ? 16 : 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#FF8BC5",
              fontWeight: 800,
              marginBottom: 10,
            }}
          >
            Sizes available
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sizes.map((s) => {
              const active = size === s.label;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSize(active ? null : s.label)}
                  aria-pressed={active}
                  style={{
                    minWidth: 52,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: active
                      ? "linear-gradient(135deg, #FF8AC5, #FF3F9F)"
                      : "rgba(255,138,197,0.06)",
                    border: active
                      ? "1px solid rgba(255,205,230,0.85)"
                      : "1px solid rgba(255,138,197,0.28)",
                    color: "#FFF5FA",
                    fontSize: 13,
                    fontWeight: active ? 800 : 700,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: active
                      ? "0 6px 14px rgba(255,79,163,0.45), inset 0 1px 0 rgba(255,255,255,0.25)"
                      : "inset 0 1px 0 rgba(255,255,255,0.03)",
                    transition:
                      "background 160ms ease, box-shadow 160ms ease",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {colors.length > 0 && (
        <section>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#FF8BC5",
              fontWeight: 800,
              marginBottom: 10,
            }}
          >
            Colours
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {colors.map((c) => {
              const active = color === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(active ? null : c.name)}
                  aria-pressed={active}
                  title={c.name}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: c.hex,
                    border: active
                      ? "2px solid #FFF5FA"
                      : "1.5px solid rgba(255,255,255,0.3)",
                    boxShadow: active
                      ? "0 0 0 3px #FF3F9F, 0 6px 14px rgba(255,79,163,0.5)"
                      : "0 2px 6px rgba(0,0,0,0.4)",
                    cursor: "pointer",
                    padding: 0,
                    transition: "box-shadow 160ms ease",
                  }}
                />
              );
            })}
          </div>
        </section>
      )}

      {summary.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,138,197,0.18)",
            fontSize: 12,
            color: "#FFF5FA",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          <span
            style={{
              color: "#FF8BC5",
              marginRight: 6,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            Your pick
          </span>
          {summary.join(" · ")}
        </div>
      )}
    </div>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF8BC5"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 160ms ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FilterOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 8,
        border: "none",
        background: active ? "rgba(255,138,197,0.16)" : "transparent",
        color: active ? "#FFF5FA" : "#D8C6D3",
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        letterSpacing: "0.02em",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
      }}
    >
      <span>{label}</span>
      {active && (
        <span style={{ color: "#FF3F9F", fontSize: 13, lineHeight: 1 }}>
          ✓
        </span>
      )}
    </button>
  );
}
