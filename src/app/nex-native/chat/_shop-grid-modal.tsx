"use client";

// src/app/nex-native/chat/_shop-grid-modal.tsx
//
// Peer shop grid modal · sealed 2026-09-27.
// -----------------------------------------
// Renders the peer's product catalogue as a 2-column grid inside a
// glass modal. Opened from the shop icon in the chat header (top-
// right corner · only visible when the peer owns a nex_business).
//
// Doctrine · products live INSIDE chat, not on separate pages. This
// modal is the first step toward Bridge 11 (product-in-chat) · users
// can already browse the peer's inventory without leaving the chat
// context. Bridge 11 will add "Send to chat" per card so a product
// card can attach directly to the composer as its own message type.

import * as React from "react";
import { createPortal } from "react-dom";
import { ProductDetailSheet } from "./_product-detail-sheet";

const NEX = {
  panel: "rgba(3,16,29,0.96)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  cyanBorder: "rgba(0,159,239,0.35)",
  orange: "#FF7800",
};

export interface ShopProduct {
  id: string;
  /** Bridge 52 · discriminator so the in-chat cart send knows which
   *  server-side lookup to run (products refresh authoritative price
   *  from nex_product · menu items keep client-supplied price). */
  kind: "product" | "menu_item";
  name: string;
  description: string | null;
  price_pence: number;
  currency: string;
  image_url: string | null;
  tags: string[] | null;
  stock_status: string | null;
  /** Category Tabs sealed 2026-09-30 · FK to nex_product_section (for
   *  kind='product') or nex_menu_section (for kind='menu_item'). NULL =
   *  uncategorised · visible only under the "All" tab. */
  section_id?: string | null;
}

/** Category Tabs · sealed 2026-09-30. Passed through from the peer's
 *  nex_product_section (or nex_menu_section for venue shops). Hard cap
 *  of 3 enforced at the seller UX layer; this list may be empty. */
export interface ShopSection {
  id: string;
  name: string;
  sort_order?: number;
}

const SHOP_ALL_TAB_ID = "__all__";

export interface ShopContext {
  shop_id: string;
  shop_slug: string | null;
  shop_owner_account_id: string;
  shop_display_name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shopName: string;
  shopHref: string | null;
  products: ShopProduct[];
  /** Category Tabs sealed 2026-09-30 · optional list of the peer's
   *  one-word sections. Doctrine: 0-1 sections hides the tab bar
   *  entirely; 2-3 shows tabs + "All" first; 4+ shows first 3 by
   *  sort_order. Callers that haven't wired sections yet pass nothing
   *  and the modal behaves exactly as before. */
  sections?: ShopSection[];
  /** Peer's display name · used in the product detail sheet copy. */
  peerName: string;
  /** True when the peer is a venue seller · swaps the eyebrow label
   *  ("Menu" vs "Shop") + CTA ("Open menu →" vs "Open shop →") +
   *  passes through to the detail sheet for consistent copy. */
  isVenue?: boolean;
  /** Shop identity fields for the in-chat cart send · required
   *  alongside sendCartOrderAction for the Order-in-chat CTA. */
  shopContext?: ShopContext;
  /** Server Action bound with peerAccountId · fired when user taps
   *  Send-in-chat on a product detail. */
  sendCartOrderAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Server Action bound with peerAccountId · fired when user taps
   *  Ask about this / I want this on a product detail. Kept for
   *  backward compat · superseded by Add-to-cart + Send-in-chat. */
  inquiryAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
}

export function ShopGridModal({
  open,
  onClose,
  shopName,
  shopHref,
  products,
  sections = [],
  peerName,
  isVenue = false,
  shopContext,
  sendCartOrderAction,
  inquiryAction,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<
    string | null
  >(null);
  const [activeSectionId, setActiveSectionId] =
    React.useState<string>(SHOP_ALL_TAB_ID);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedProductId) setSelectedProductId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, selectedProductId]);

  const selectedProduct = selectedProductId
    ? products.find((p) => p.id === selectedProductId) ?? null
    : null;

  // Category Tabs · sealed 2026-09-30. Filter products by the active tab
  // when it's not the sentinel "All". Uncategorised (section_id === null)
  // remain visible only under All.
  const visibleProducts =
    activeSectionId === SHOP_ALL_TAB_ID
      ? products
      : products.filter((p) => p.section_id === activeSectionId);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes nex-shop-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nex-shop-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        [data-nex-shop-scroll] { scrollbar-width: none; }
        [data-nex-shop-scroll]::-webkit-scrollbar {
          display: none; width: 0; height: 0;
        }
      `}</style>

      {/* Dim backdrop over the chat surface · tap to close. Sits
          only over the message zone so the header identity chip
          stays legible above and the composer stays reachable. */}
      <div
        role="button"
        aria-label="Close shop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.42)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 1000,
          animation: "nex-shop-fade 200ms ease-out both",
        }}
      />

      {/* Bottom sheet · slides up from the bottom of the chat page.
          Founder direction 2026-09-27 · "shop cards open on the chat
          page not container" · this is a chat-anchored panel, not a
          floating modal. */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${shopName} products`}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "78vh",
          background:
            "linear-gradient(180deg, rgba(6,15,28,0.96) 0%, rgba(3,10,20,0.98) 100%)",
          borderTop: `1px solid ${NEX.cyanSoft}`,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow:
            "0 -20px 60px rgba(0,0,0,0.7), 0 0 60px rgba(0,159,239,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
          zIndex: 1001,
          color: NEX.text,
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          animation: "nex-shop-slide-up 320ms cubic-bezier(.2,.7,.2,1) both",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        {/* Drag handle · visual affordance that this is a bottom sheet */}
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.28)",
            margin: "8px auto 0",
            flexShrink: 0,
          }}
        />
        {/* Header */}
        <div
          style={{
            padding: "18px 18px 12px",
            borderBottom: "1px solid rgba(0,159,239,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              {isVenue ? "Menu" : "Shop"}
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
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.42)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: NEX.text,
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Category Tabs · sealed 2026-09-30 · appears above the grid
            when the seller has 2+ sections. */}
        <ShopCategoryTabs
          sections={sections}
          activeId={activeSectionId}
          onSelect={setActiveSectionId}
        />

        {/* Product grid */}
        <div
          data-nex-shop-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 14,
          }}
        >
          {visibleProducts.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {isVenue
                ? "This kitchen has no live menu items yet."
                : "This shop has no live products yet."}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {visibleProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onOpen={() => setSelectedProductId(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer · Bridge 11 hint + open shop link */}
        <div
          style={{
            padding: "10px 14px 12px",
            borderTop: "1px solid rgba(0,159,239,0.14)",
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
              color: NEX.textMute,
              lineHeight: 1.4,
            }}
          >
            Tap a {isVenue ? "dish" : "product"} to add it to your cart
            and send the order right here in chat.
          </div>
          {/* Chat-native doctrine sealed 2026-09-29 · the slider stays
              inside the conversation · footer Close returns the buyer
              to the chat surface without leaving the peer's message
              stream. The public landing page is reachable from NEX
              Search, not from here. */}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: NEX.text,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Close
          </button>
        </div>
      </section>

      {/* Product detail sheet · stacks over the grid on card tap.
          Escape / backdrop tap closes to grid · close button on the
          detail also fires the parent onClose so the whole shop
          collapses. Bridge 52 · always mount when we have a product
          (Add-to-cart + Send-in-chat live inside · inquiryAction is
          the legacy fallback only). */}
      <ProductDetailSheet
        open={!!selectedProduct}
        onClose={() => {
          setSelectedProductId(null);
          onClose();
        }}
        onBack={() => setSelectedProductId(null)}
        product={selectedProduct}
        peerName={peerName}
        isVenue={isVenue}
        shopContext={shopContext}
        sendCartOrderAction={sendCartOrderAction}
        inquiryAction={inquiryAction}
      />
    </>,
    document.body,
  );
}

function ProductCard({
  product,
  onOpen,
}: {
  product: ShopProduct;
  onOpen: () => void;
}) {
  const price = formatPrice(product.price_pence, product.currency);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${product.name}`}
      style={{
        borderRadius: 14,
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        padding: 0,
        color: "inherit",
        fontFamily: "inherit",
        textAlign: "left",
        transition: "transform 140ms ease, border-color 140ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,159,239,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Image · fixed 4:3 aspect · falls back to a neutral tile
          if the product has no image_url yet. */}
      <div
        style={{
          aspectRatio: "4 / 3",
          background: "#0a1a30",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {product.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.image_url}
            alt={product.name}
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
              color: NEX.textMute,
              fontSize: 22,
            }}
          >
            🛍️
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: "8px 10px 10px" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 2,
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.orange,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          {price}
        </div>
      </div>
    </button>
  );
}

/** Format a minor-unit price (e.g. IDR pence) into a display string.
 *  For IDR we render the major amount without decimals · millions
 *  read as "Rp 2,850,000" which matches how vintage-market listings
 *  are quoted locally. GBP and other 2-decimal currencies would need
 *  a slightly different formatter · not needed for the seed data. */
function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
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

/** Category Tabs · sealed 2026-09-30 · updated 2026-09-30 (no-All).
 *  Chat-flavored equivalent of <CoverCategoryTabs> using the NEX palette
 *  rather than CSS vars. Founder direction: no "All" tab · nothing
 *  selected shows every product · only the highlighted tab carries a
 *  line beneath it. Tap active tab again to clear the filter. */
function ShopCategoryTabs({
  sections,
  activeId,
  onSelect,
}: {
  sections: ShopSection[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (sections.length <= 1) return null;

  const ordered = [...sections].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const visible = ordered.slice(0, 3);
  const tabs = visible.map((s) => ({ id: s.id, label: s.name }));

  return (
    <div
      role="tablist"
      aria-label="Shop category tabs"
      style={{
        display: "flex",
        gap: 4,
        padding: "0 14px",
        overflow: "hidden",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(isActive ? SHOP_ALL_TAB_ID : tab.id)}
            type="button"
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: "10px 12px 12px",
              margin: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: "0.02em",
              color: isActive ? NEX.cyan : NEX.textDim,
              borderBottom: isActive
                ? `2px solid ${NEX.cyan}`
                : "none",
              transition: "color 160ms ease, border-color 160ms ease",
              whiteSpace: "nowrap",
              textTransform: "capitalize",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
