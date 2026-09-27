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
import Link from "next/link";
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
  name: string;
  description: string | null;
  price_pence: number;
  currency: string;
  image_url: string | null;
  tags: string[] | null;
  stock_status: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shopName: string;
  shopHref: string | null;
  products: ShopProduct[];
  /** Peer's display name · used in the product detail sheet copy. */
  peerName: string;
  /** Server Action bound with peerAccountId · fired when user taps
   *  Ask about this / I want this on a product detail. */
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
  peerName,
  inquiryAction,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<
    string | null
  >(null);
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
              Shop
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

        {/* Product grid */}
        <div
          data-nex-shop-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 14,
          }}
        >
          {products.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              This shop has no live products yet.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {products.map((p) => (
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
            Tap-to-chat coming with{" "}
            <span style={{ color: NEX.cyan, fontWeight: 600 }}>Bridge 11</span>
          </div>
          {shopHref && (
            <Link
              href={shopHref}
              onClick={onClose}
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                background:
                  "linear-gradient(180deg, rgba(0,159,239,0.35) 0%, rgba(0,159,239,0.22) 100%)",
                border: `1px solid ${NEX.cyanSoft}`,
                color: NEX.text,
                fontSize: 11,
                fontWeight: 700,
                textDecoration: "none",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Open shop →
            </Link>
          )}
        </div>
      </section>

      {/* Product detail sheet · stacks over the grid on card tap.
          Escape / backdrop tap closes to grid · close button on the
          detail also fires the parent onClose so the whole shop
          collapses. */}
      {inquiryAction && (
        <ProductDetailSheet
          open={!!selectedProduct}
          onClose={() => {
            setSelectedProductId(null);
            onClose();
          }}
          onBack={() => setSelectedProductId(null)}
          product={selectedProduct}
          peerName={peerName}
          inquiryAction={inquiryAction}
        />
      )}
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
