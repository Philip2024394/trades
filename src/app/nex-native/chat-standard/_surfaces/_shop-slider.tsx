"use client";

// src/app/nex-native/chat-standard/_surfaces/_shop-slider.tsx
//
// Phase 2A.0 · Standard shop + product-card surface.
//
// Horizontal slider of product cards. Treatment comes from the engine:
// Ocean gets driftwood-board cards with "current" scroll + buoy
// framing; Cakes gets glass cards with momentum; Joker gets ticket
// style; etc.
//
// Pure presentation. Caller supplies products; cards never read
// theme.id or hex colours directly.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

export interface StandardShopProduct {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  tagline?: string;
}

export interface StandardShopSliderProps {
  engine: ResolvedEngine;
  products: StandardShopProduct[];
  onProductTap?: (productId: string) => void;
}

export function StandardShopSlider({
  engine,
  products,
  onProductTap,
}: StandardShopSliderProps): React.JSX.Element {
  const t = engine.shopTreatment();
  return (
    <div
      data-nex-se-shop-slider
      style={t.containerStyle}
    >
      {products.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onProductTap?.(p.id)}
          data-nex-se-product-card={p.id}
          style={{
            ...t.cardStyle,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            textAlign: "left",
          }}
        >
          <div
            style={{
              aspectRatio: "1 / 1",
              borderRadius: t.productFraming === "buoy" ? "50%" : 10,
              overflow: "hidden",
              background: p.imageUrl
                ? `center/cover url(${p.imageUrl})`
                : `linear-gradient(135deg, ${engine.colours.secondary}, ${engine.colours.deep})`,
              border: `1px solid ${engine.colours.primary}55`,
              marginBottom: 4,
            }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "inherit",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.name}
          </div>
          {p.tagline && (
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.3,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {p.tagline}
            </div>
          )}
          <div
            style={{
              marginTop: "auto",
              fontSize: 13,
              fontWeight: 800,
              ...t.cardAccentStyle,
            }}
          >
            {p.price}
          </div>
        </button>
      ))}
    </div>
  );
}
