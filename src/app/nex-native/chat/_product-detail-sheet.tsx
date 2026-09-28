"use client";

// src/app/nex-native/chat/_product-detail-sheet.tsx
//
// Bridge 52 · product / menu-item detail bottom sheet.
// ----------------------------------------------------
// Stacks over the shop grid bottom sheet when a user taps a card.
// Fills 88vh so photo + description + CTAs get room to breathe.
//
// Two CTAs anchor the sheet (chat-native doctrine sealed 2026-09-29):
//   · "Add to cart"      · secondary · writes localStorage using the
//                          same NEX_CART_STORAGE_KEY as landing pages
//   · "Send in chat"     · primary   · adds this item if not present,
//                          then fires sendCartOrderAction for THIS
//                          shop's items into the current peer chat
//                          (no /cart detour). Server redirects back
//                          to the peer chat page with cart_sent=1.
//
// Legacy `inquiryAction` prop retained as fallback for callers that
// haven't wired shopContext + sendCartOrderAction yet · when only
// inquiryAction is present, the old Ask / Want CTAs render instead.

import * as React from "react";
import { createPortal } from "react-dom";
import type { ShopProduct, ShopContext } from "./_shop-grid-modal";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

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
  /** True when the peer is a venue seller · swaps microcopy so this
   *  reads as a menu-item rather than a product. */
  isVenue?: boolean;
  /** Shop identity fields · required with sendCartOrderAction for
   *  the Add-to-cart + Send-in-chat CTAs. */
  shopContext?: ShopContext;
  /** Server Action bound with peerAccountId · posts a cart_order
   *  peer message with this shop's items · redirects back to the
   *  peer chat on success. */
  sendCartOrderAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Legacy inquiry action · used only when the modern chat-native
   *  props (shopContext + sendCartOrderAction) aren't supplied. */
  inquiryAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
}

export function ProductDetailSheet({
  open,
  onClose,
  onBack,
  product,
  peerName,
  isVenue = false,
  shopContext,
  sendCartOrderAction,
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

          {/* Seller hint · reflects the chat-native flow */}
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
            {shopContext && sendCartOrderAction ? (
              <>
                Add to cart to build your order, or send it straight
                into your chat with{" "}
                <span style={{ color: NEX.text, fontWeight: 600 }}>
                  {peerName}
                </span>
                .
              </>
            ) : (
              <>
                Sending a message attaches this {isVenue ? "dish" : "product"}{" "}
                card to your chat with{" "}
                <span style={{ color: NEX.text, fontWeight: 600 }}>
                  {peerName}
                </span>
                . They&apos;ll see the card and can reply here.
              </>
            )}
          </div>
        </div>

        {/* Anchored CTAs · chat-native (Add-to-cart + Send-in-chat)
            when shopContext + sendCartOrderAction are wired · legacy
            Ask / Want otherwise. */}
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
          {shopContext && sendCartOrderAction ? (
            <>
              <AddToCartCtaButton
                product={product}
                shopContext={shopContext}
              />
              <SendInChatCtaButton
                product={product}
                shopContext={shopContext}
                sendAction={sendCartOrderAction}
              />
            </>
          ) : inquiryAction ? (
            <>
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
            </>
          ) : null}
        </div>
      </section>
    </>,
    document.body,
  );
}

/** Reads localStorage, dedupes on (shop_id, item_id, variants), bumps
 *  quantity or appends a new line, writes back + fires the standard
 *  `nex-cart-changed` event so header counters refresh. Mirrors the
 *  AddToCartButton logic used on shop landing pages. */
function writeItemToCart(
  product: ShopProduct,
  shopContext: ShopContext,
): NexCartItem[] {
  const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
  const arr: NexCartItem[] = raw ? JSON.parse(raw) : [];
  const dedupeKey = `${shopContext.shop_id}::${product.id}::`;
  const idx = arr.findIndex(
    (x) =>
      x &&
      `${x.shop_id}::${x.id}::${(x.variants ?? []).slice().sort().join("|")}` ===
        dedupeKey,
  );
  if (idx >= 0) {
    arr[idx] = {
      ...arr[idx]!,
      quantity: (arr[idx]!.quantity || 1) + 1,
    };
  } else {
    arr.push({
      key:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${dedupeKey}::${Date.now()}`,
      kind: product.kind === "menu_item" ? "menu_item" : "product",
      id: product.id,
      shop_id: shopContext.shop_id,
      shop_slug: shopContext.shop_slug ?? "",
      shop_owner_account_id: shopContext.shop_owner_account_id,
      shop_display_name: shopContext.shop_display_name,
      shop_lat: null,
      shop_lng: null,
      name: product.name,
      price_pence: product.price_pence,
      currency: product.currency,
      image_url: product.image_url,
      quantity: 1,
      variants: [],
      perks: [],
      perks_note: null,
      note: null,
      added_at: Date.now(),
    });
  }
  window.localStorage.setItem(NEX_CART_STORAGE_KEY, JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent("nex-cart-changed"));
  return arr;
}

function AddToCartCtaButton({
  product,
  shopContext,
}: {
  product: ShopProduct;
  shopContext: ShopContext;
}) {
  const [added, setAdded] = React.useState(false);
  function onClick() {
    try {
      writeItemToCart(product, shopContext);
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
    } catch {
      // localStorage may be disabled · silently no-op.
    }
  }
  const style: React.CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    background: added
      ? "linear-gradient(180deg, #22E37A 0%, #16D66B 100%)"
      : "linear-gradient(180deg, rgba(0,159,239,0.24) 0%, rgba(0,159,239,0.16) 100%)",
    border: added
      ? "1px solid rgba(22,214,107,0.55)"
      : `1px solid ${NEX.cyanSoft}`,
    color: added ? "#0B0F1A" : NEX.text,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.02em",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 160ms ease, border-color 160ms ease",
  };
  return (
    <button type="button" onClick={onClick} style={style}>
      {added ? "✓ Added" : "Add to cart"}
    </button>
  );
}

function SendInChatCtaButton({
  product,
  shopContext,
  sendAction,
}: {
  product: ShopProduct;
  shopContext: ShopContext;
  sendAction: (formData: FormData) => Promise<never> | void | Promise<void>;
}) {
  const [pending, startTransition] = React.useTransition();
  function onClick() {
    if (pending) return;
    let arr: NexCartItem[];
    try {
      arr = writeItemToCart(product, shopContext);
    } catch {
      return;
    }
    // Filter to THIS shop only · sendCartOrderAction posts one
    // cart_order per shop. Other shops' items stay in the cart.
    const shopItems = arr.filter((x) => x.shop_id === shopContext.shop_id);
    const cartPayload = {
      peer_account_id: shopContext.shop_owner_account_id,
      shop_id: shopContext.shop_id,
      shop_slug: shopContext.shop_slug ?? "",
      shop_display_name: shopContext.shop_display_name,
      currency: product.currency,
      buyer_notes: "",
      items: shopItems.map((x) => ({
        kind: x.kind,
        id: x.id,
        name: x.name,
        price_pence: x.price_pence,
        currency: x.currency,
        quantity: x.quantity,
        variants: x.variants ?? [],
        perks: x.perks ?? [],
        perks_note: x.perks_note ?? null,
        note: x.note ?? null,
        image_url: x.image_url ?? null,
      })),
      delivery_address: null,
    };
    const fd = new FormData();
    fd.append("cart_payload", JSON.stringify(cartPayload));
    startTransition(() => {
      void sendAction(fd);
    });
  }
  const style: React.CSSProperties = {
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
    cursor: pending ? "wait" : "pointer",
    fontFamily: "inherit",
    boxShadow: "0 6px 18px rgba(255,120,0,0.35)",
    opacity: pending ? 0.7 : 1,
  };
  return (
    <button type="button" onClick={onClick} style={style} disabled={pending}>
      {pending ? "Sending…" : "Send in chat"}
    </button>
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
