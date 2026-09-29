"use client";

// src/app/nex-native/chat/_header-right-cluster.tsx
//
// Standard chat-header right-cluster · sealed 2026-09-29 · Bridge 53.
// -------------------------------------------------------------------
// Three fixed-position circle buttons in the top-right of any chat
// surface using PortraitBloomShell:
//
//   [ Home ]  [ Shop / Menu (conditional) ]  [ Cart ]
//
// · Home  · always visible · links to /nex-native/home
// · Shop  · only when the peer owns a business · opens the in-chat
//           slider (products + menu items) via ShopGridModal · the
//           glyph swaps between shop-bag (products) and cutlery
//           (venue sellers) based on isVenue
// · Cart  · always visible · links to /nex-native/cart · shows a
//           pink badge with the total item count from localStorage
//           (updates live via the `nex-cart-changed` event)
//
// One shared cluster, one shared visual language across every chat
// surface (peer chat, business chat, NEX official). Per-theme
// coloring can be layered in later via the accentColor prop — for
// now every chat uses NEX orange to match the current PortraitBloom
// treatment. Founder direction 2026-09-29: this is THE standard.

import * as React from "react";
import Link from "next/link";
import { ShopGridModal, type ShopProduct } from "./_shop-grid-modal";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";

const NEX = {
  text: "#F4F7FC",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.5)",
  pink: "#FF3F9F",
  pinkGlow: "rgba(255,63,159,0.55)",
};

interface Props {
  /** Peer's display name · surfaces in the shop slider header. */
  peerName: string;
  /** Shop identity fields when the peer owns a nex_business.
   *  When null, the shop/menu button is not rendered — only Home
   *  and Cart show. Home + Cart always render. */
  shop: {
    name: string;
    href: string | null;
    products: ShopProduct[];
    isVenue: boolean;
    context?: {
      shop_id: string;
      shop_slug: string | null;
      shop_owner_account_id: string;
      shop_display_name: string;
    };
  } | null;
  /** Server Action (bound with peerAccountId) that posts a
   *  cart_order chat message · used by the detail sheet's
   *  Send-in-chat CTA. */
  sendCartOrderAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Legacy inquiry action fallback. */
  inquiryAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
}

/** Read the total quantity of items currently in the localStorage
 *  cart. Returns 0 in SSR / private-browsing / parse-error cases. */
function readCartCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
    return arr.reduce(
      (n, x) =>
        n +
        (x && typeof x === "object" && typeof (x as NexCartItem).quantity === "number"
          ? Math.max(0, Math.floor((x as NexCartItem).quantity))
          : 0),
      0,
    );
  } catch {
    return 0;
  }
}

export function HeaderRightCluster({
  peerName,
  shop,
  sendCartOrderAction,
  inquiryAction,
}: Props) {
  const [shopOpen, setShopOpen] = React.useState(false);
  const [cartCount, setCartCount] = React.useState(0);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setCartCount(readCartCount());
    setHydrated(true);
    const onChange = () => setCartCount(readCartCount());
    window.addEventListener("nex-cart-changed", onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === NEX_CART_STORAGE_KEY) setCartCount(readCartCount());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nex-cart-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Bridge 55 · Phase 1 launch · commerce hidden by default.
  // Cart + Shop icons only render when NEX_COMMERCE_ENABLED is on.
  const showCart = NEX_COMMERCE_ENABLED;
  const showShop = NEX_COMMERCE_ENABLED && !!shop;
  const hasShopProducts = !!shop && shop.products.length > 0;
  const shopAriaLabel = shop
    ? shop.isVenue
      ? `Open ${shop.name}'s menu`
      : `Open ${shop.name}'s shop`
    : "Shop";
  const shopTitle = shop ? (shop.isVenue ? "Menu" : "Shop") : "";

  return (
    <>
      <div
        data-nex-header-cluster
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
          zIndex: 6,
        }}
      >
        <ClusterLinkButton
          href="/nex-native/home"
          ariaLabel="Home"
          title="Home"
        >
          <HomeIcon />
        </ClusterLinkButton>

        {showCart && (
        <ClusterLinkButton
          href="/nex-native/cart"
          ariaLabel={
            cartCount > 0
              ? `Open cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`
              : "Open cart"
          }
          title="Cart"
        >
          <CartIcon />
          {hydrated && cartCount > 0 && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "linear-gradient(180deg, #FF77BC, #FF3F9F)",
                color: "#0B0F1A",
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #050f1e",
                boxShadow: `0 4px 10px ${NEX.pinkGlow}`,
                fontFamily:
                  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </ClusterLinkButton>
        )}

        {showShop && (
          hasShopProducts ? (
            <ClusterActionButton
              onClick={() => setShopOpen(true)}
              ariaLabel={shopAriaLabel}
              title={shopTitle}
            >
              {shop.isVenue ? <CutleryIcon /> : <ShopBagIcon />}
            </ClusterActionButton>
          ) : (
            <ClusterLinkButton
              href={shop.href ?? "#"}
              ariaLabel={shopAriaLabel}
              title={shopTitle}
            >
              {shop.isVenue ? <CutleryIcon /> : <ShopBagIcon />}
            </ClusterLinkButton>
          )
        )}
      </div>

      {shop && (
        <ShopGridModal
          open={shopOpen}
          onClose={() => setShopOpen(false)}
          shopName={shop.name}
          shopHref={shop.href}
          products={shop.products}
          peerName={peerName}
          isVenue={shop.isVenue}
          shopContext={shop.context}
          sendCartOrderAction={sendCartOrderAction}
          inquiryAction={inquiryAction}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------- *
 * Button primitives · same 40px circle · orange NEX treatment    *
 * -------------------------------------------------------------- */

const CIRCLE: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 0,
  background: "transparent",
  border: "none",
  color: NEX.orange,
  padding: 6,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  transition: "opacity 160ms ease, transform 120ms ease",
  textDecoration: "none",
  position: "relative",
  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
};

function ClusterLinkButton({
  href,
  ariaLabel,
  title,
  children,
}: {
  href: string;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      style={CIRCLE}
    >
      {children}
    </Link>
  );
}

function ClusterActionButton({
  onClick,
  ariaLabel,
  title,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      style={CIRCLE}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.7";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- *
 * Glyphs · 18px stroked SVGs                                      *
 * -------------------------------------------------------------- */

function HomeIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

function ShopBagIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function CutleryIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 2v7a2 2 0 002 2v11" />
      <path d="M5 2v6" />
      <path d="M9 2v6" />
      <path d="M17 2c-2 0-3 2-3 5v5a2 2 0 002 2v8" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="21" r="1.5" />
      <circle cx="18" cy="21" r="1.5" />
      <path d="M3 3h2l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );
}
