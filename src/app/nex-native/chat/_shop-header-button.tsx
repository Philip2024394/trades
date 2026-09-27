"use client";

// src/app/nex-native/chat/_shop-header-button.tsx
//
// Shop icon in the chat header · top-right corner.
// -----------------------------------------------
// Renders only when the peer has a nex_business + at least one live
// product. Owns the modal open state · tapping the button reveals
// the peer's shop grid without leaving the chat surface.
//
// Sealed 2026-09-27 · Founder direction "shop icon in header right
// side · when selected will open the shop page grid".

import * as React from "react";
import { ShopGridModal, type ShopProduct } from "./_shop-grid-modal";

const NEX = {
  text: "#F4F7FC",
  orange: "#FF7800",
};

interface Props {
  shopName: string;
  shopHref: string | null;
  products: ShopProduct[];
}

export function ShopHeaderButton({ shopName, shopHref, products }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Open ${shopName}'s shop`}
        title="Shop"
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 12,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.32)",
          border: "1px solid rgba(255,120,0,0.5)",
          color: NEX.orange,
          padding: 0,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          zIndex: 6,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "background 160ms ease, transform 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,120,0,0.16)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.32)";
        }}
      >
        <ShopIcon />
      </button>

      <ShopGridModal
        open={open}
        onClose={() => setOpen(false)}
        shopName={shopName}
        shopHref={shopHref}
        products={products}
      />
    </>
  );
}

function ShopIcon() {
  return (
    <svg
      width={20}
      height={20}
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
