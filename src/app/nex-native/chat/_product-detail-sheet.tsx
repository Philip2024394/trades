"use client";

// src/app/nex-native/chat/_product-detail-sheet.tsx
//
// Bridge 11 · product detail bottom sheet.
// ----------------------------------------
// Stacks over the shop grid bottom sheet when a user taps a product
// card. Fills more of the viewport (88vh) so the product's photo +
// description + intent CTAs get room to breathe.
//
// Two intent buttons anchor the sheet at the bottom:
//   · "Ask about this"  · secondary · default body "Is the <name> still available?"
//   · "I want this"     · primary   · default body "I'd like to buy the <name> · what's next?"
//
// Both submit sendProductInquiryAction bound to peerAccountId · the
// server builds the product snapshot + sends the peer message with
// attachment_type='product'. Sheet closes via Next's redirect chain.

import * as React from "react";
import { createPortal } from "react-dom";
import type { ShopProduct } from "./_shop-grid-modal";

const NEX = {
  panel: "rgba(3,16,29,0.98)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  cyanBorder: "rgba(0,159,239,0.35)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.5)",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  product: ShopProduct | null;
  peerName: string;
  /** Server Action bound with peerAccountId · takes product_id +
   *  intent + optional custom body. Redirects to the peer chat. */
  inquiryAction: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
}

export function ProductDetailSheet({
  open,
  onClose,
  onBack,
  product,
  peerName,
  inquiryAction,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted || !product) return null;

  const price = formatPrice(product.price_pence, product.currency);

  return createPortal(
    <>
      <style>{`
        @keyframes nex-product-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nex-product-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        [data-nex-product-scroll] { scrollbar-width: none; }
        [data-nex-product-scroll]::-webkit-scrollbar {
          display: none; width: 0; height: 0;
        }
      `}</style>

      <div
        role="button"
        aria-label="Close product"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 1010,
          animation: "nex-product-fade 200ms ease-out both",
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "88vh",
          background:
            "linear-gradient(180deg, rgba(6,15,28,0.98) 0%, rgba(3,10,20,0.99) 100%)",
          borderTop: `1px solid ${NEX.cyanSoft}`,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow:
            "0 -24px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)",
          zIndex: 1011,
          color: NEX.text,
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          animation: "nex-product-slide-up 320ms cubic-bezier(.2,.7,.2,1) both",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        {/* Drag handle */}
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

        {/* Nav strip · back to grid + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px 6px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to shop grid"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              color: NEX.textDim,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: "pointer",
              padding: "6px 4px",
              fontFamily: "inherit",
            }}
          >
            <BackIcon />
            <span>Back to shop</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
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

        {/* Scrollable body · image + meta */}
        <div
          data-nex-product-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 16px 16px",
          }}
        >
          {/* Hero image */}
          <div
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              borderRadius: 16,
              background: "#0a1a30",
              overflow: "hidden",
              marginBottom: 16,
              position: "relative",
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
                  fontSize: 48,
                }}
              >
                🛍️
              </div>
            )}
          </div>

          {/* Name + price */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                lineHeight: 1.15,
              }}
            >
              {product.name}
            </h2>
            <div
              style={{
                flexShrink: 0,
                fontSize: 16,
                fontWeight: 700,
                color: NEX.orange,
                letterSpacing: "0.02em",
              }}
            >
              {price}
            </div>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 14,
              }}
            >
              {product.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "rgba(0,159,239,0.14)",
                    border: "1px solid rgba(0,159,239,0.3)",
                    color: NEX.cyan,
                    fontSize: 10,
                    letterSpacing: "0.04em",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 14,
                lineHeight: 1.55,
                color: NEX.text,
                opacity: 0.9,
              }}
            >
              {product.description}
            </p>
          )}

          {/* Seller hint */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 11,
              color: NEX.textDim,
              lineHeight: 1.5,
              marginBottom: 4,
            }}
          >
            Sending a message attaches this product card to your chat
            with{" "}
            <span style={{ color: NEX.text, fontWeight: 600 }}>
              {peerName}
            </span>
            . They&apos;ll see the card and can reply here.
          </div>
        </div>

        {/* Anchored intent CTAs · always visible */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: "12px 14px 14px",
            borderTop: "1px solid rgba(0,159,239,0.14)",
            flexShrink: 0,
            background:
              "linear-gradient(180deg, rgba(3,10,20,0) 0%, rgba(3,10,20,0.4) 100%)",
          }}
        >
          <IntentForm
            action={inquiryAction}
            productId={product.id}
            intent="ask"
            label="Ask about this"
            variant="secondary"
          />
          <IntentForm
            action={inquiryAction}
            productId={product.id}
            intent="want"
            label="I want this"
            variant="primary"
          />
        </div>
      </section>
    </>,
    document.body,
  );
}

function IntentForm({
  action,
  productId,
  intent,
  label,
  variant,
}: {
  action: (formData: FormData) => Promise<never> | void | Promise<void>;
  productId: string;
  intent: "ask" | "want";
  label: string;
  variant: "primary" | "secondary";
}) {
  const style: React.CSSProperties =
    variant === "primary"
      ? {
          width: "100%",
          padding: "13px 14px",
          borderRadius: 12,
          background:
            "linear-gradient(180deg, rgba(255,120,0,0.94) 0%, rgba(255,120,0,0.82) 100%)",
          border: `1px solid ${NEX.orangeSoft}`,
          color: "#0B0F1A",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: "0 6px 18px rgba(255,120,0,0.35)",
        }
      : {
          width: "100%",
          padding: "13px 14px",
          borderRadius: 12,
          background:
            "linear-gradient(180deg, rgba(0,159,239,0.24) 0%, rgba(0,159,239,0.16) 100%)",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.text,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: "pointer",
          fontFamily: "inherit",
        };
  return (
    <form action={action}>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" style={style}>
        {label}
      </button>
    </form>
  );
}

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

function BackIcon() {
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
