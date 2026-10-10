"use client";

// src/app/nex-native/themes/cyber-grid/product/page.tsx
//
// Cyber Grid theme · product detail preview.
// -------------------------------------------------------------------
// Terminal-styled product page matching the chat theme:
//   · monospace throughout
//   · dashed emerald frames + ASCII corner marks around the image
//   · price / stock / variants rendered as `> key: value` lines like
//     a config dump
//   · sticky footer with [add to cart] + [send order in chat] · same
//     two-action shape as the standard product page but tinted to
//     the emerald palette
//
// Reads ?id=<slug> from the query string so the shop slider on the
// chat preview links here with the specific product id. Falls back
// to the HammerPro fixture when no id is passed.
//
// This is a preview / spec page · real Add-to-Cart wiring will land
// when the terminal renderer is wired into the peer-chat runtime
// shell.

import * as React from "react";
import { useSearchParams } from "next/navigation";

// Palette + font intentionally duplicated from the theme preview
// page so this route stays self-contained · both files stay small
// and independently editable.
const PALETTE = {
  bg: "#050b09",
  panelDim: "rgba(94,120,102,0.9)",
  bannerRule: "rgba(60,90,72,0.55)",
  emerald: "#5FED8B",
  amber: "#FF9142",
  timestamp: "#5F7A67",
  chevron: "#3E9F63",
  body: "#E7ECE4",
  cursor: "#4CFF7A",
  glow: "rgba(76,255,122,0.16)",
};

const MONO =
  "'Cascadia Mono', 'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

const WALLPAPER =
  "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/cyber-grid-1790688636327.png";

interface ProductSpec {
  id: string;
  name: string;
  priceLabel: string;
  priceMinor: number;
  currency: string;
  stock: "in_stock" | "low_stock" | "sold_out";
  description: string;
  seller: string;
  dispatch: string;
  variants?: { key: string; values: string[] }[];
}

const PRODUCTS: Record<string, ProductSpec> = {
  "hammerpro-16oz": {
    id: "hammerpro-16oz",
    name: "HammerPro 16oz",
    priceLabel: "Rp 185.000",
    priceMinor: 18500000,
    currency: "IDR",
    stock: "in_stock",
    description:
      "16oz construction hammer with reinforced handle. Balanced head, textured grip, forged from a single steel billet.",
    seller: "Jogja Teknik Nusantara",
    dispatch: "ships same-day if ordered before 14:00 WIB",
    variants: [{ key: "handle", values: ["standard", "extended"] }],
  },
  "trade-belt-pro": {
    id: "trade-belt-pro",
    name: "Trade Belt Pro",
    priceLabel: "Rp 425.000",
    priceMinor: 42500000,
    currency: "IDR",
    stock: "low_stock",
    description:
      "Heavy-duty leather tool belt with multiple tool stations. Fits waists 76-112 cm.",
    seller: "Jogja Teknik Nusantara",
    dispatch: "ships within 2 business days",
    variants: [{ key: "size", values: ["S", "M", "L", "XL"] }],
  },
  "scaffold-station-v2": {
    id: "scaffold-station-v2",
    name: "Scaffold Station V2",
    priceLabel: "Rp 675.000",
    priceMinor: 67500000,
    currency: "IDR",
    stock: "sold_out",
    description:
      "Leather scaffold tool station designed for professional scaffolders. Reinforced hammer loop + double stitching.",
    seller: "Jogja Teknik Nusantara",
    dispatch: "restock ETA · check with owner",
  },
  "safety-harness-lite": {
    id: "safety-harness-lite",
    name: "Safety Harness Lite",
    priceLabel: "Rp 295.000",
    priceMinor: 29500000,
    currency: "IDR",
    stock: "in_stock",
    description:
      "Lightweight fall-arrest harness. Adjustable dorsal + chest attachment points. Compliant with SNI standards.",
    seller: "Jogja Teknik Nusantara",
    dispatch: "ships next business day",
    variants: [{ key: "size", values: ["S/M", "L/XL"] }],
  },
};

const FALLBACK_ID = "hammerpro-16oz";

export default function CyberGridProductPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id") ?? FALLBACK_ID;
  const product = PRODUCTS[idParam] ?? PRODUCTS[FALLBACK_ID]!;
  const [flash, setFlash] = React.useState<"add" | "send" | null>(null);
  const soldOut = product.stock === "sold_out";

  const stockColor =
    product.stock === "sold_out"
      ? "#FF7373"
      : product.stock === "low_stock"
        ? PALETTE.amber
        : PALETTE.emerald;

  const flashFor = (kind: "add" | "send") => {
    setFlash(kind);
    setTimeout(() => setFlash(null), 320);
  };

  return (
    <>
      <style>{`
        html, body { background: ${PALETTE.bg} !important; margin: 0; }
        [data-cg-product-root] * { box-sizing: border-box; }
      `}</style>

      <main
        data-cg-product-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.body,
          fontFamily: MONO,
          fontSize: 14,
          lineHeight: 1.55,
          overflow: "hidden",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 76px)",
        }}
      >
        {/* Wallpaper + vignette · same as the chat preview so the
            two surfaces feel like the same theme. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage: `url(${WALLPAPER})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.4,
            filter: "saturate(1.1) contrast(1.05)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(80% 60% at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Back-to-chat header · minimal · matches the terminal
            aesthetic (single `< back` link, no full nav cluster). */}
        <header
          style={{
            position: "relative",
            zIndex: 5,
            padding: "calc(env(safe-area-inset-top, 0) + 10px) 14px 10px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background:
              "linear-gradient(180deg, rgba(5,15,10,0.85) 0%, transparent 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: `1px solid rgba(76,255,122,0.18)`,
          }}
        >
          <a
            href="/nex-native/themes/cyber-grid"
            aria-label="Back to chat"
            style={{
              color: PALETTE.emerald,
              textDecoration: "none",
              padding: "4px 10px",
              border: `1px dashed rgba(76,255,122,0.4)`,
              borderRadius: 6,
              fontSize: 12,
              letterSpacing: "0.04em",
            }}
          >
            &lt; back
          </a>
          <span style={{ color: PALETTE.panelDim, fontSize: 12 }}>
            nex-shop v1 · {product.seller}
          </span>
        </header>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 720,
            margin: "0 auto",
            padding: "20px 20px 24px",
            display: "grid",
            gap: 18,
          }}
        >
          {/* Product image · ASCII-frame tile, same styling as the
              slider card image but scaled up. */}
          <div
            style={{
              aspectRatio: "1 / 1",
              maxHeight: 360,
              margin: "0 auto",
              width: "100%",
              maxWidth: 360,
              background: "rgba(76,255,122,0.06)",
              border: `1px dashed rgba(76,255,122,0.4)`,
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              color: PALETTE.chevron,
              fontFamily: MONO,
              fontSize: 32,
              letterSpacing: "0.05em",
              textShadow: `0 0 10px ${PALETTE.glow}`,
              position: "relative",
            }}
          >
            [ img ]
            {/* ASCII corner marks · pure aesthetic · rendered via
                absolutely-positioned spans for CRT flavour. */}
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <span
                key={corner}
                aria-hidden
                style={{
                  position: "absolute",
                  color: PALETTE.cursor,
                  fontSize: 12,
                  textShadow: `0 0 6px ${PALETTE.glow}`,
                  top: corner.startsWith("t") ? 4 : undefined,
                  bottom: corner.startsWith("b") ? 4 : undefined,
                  left: corner.endsWith("l") ? 6 : undefined,
                  right: corner.endsWith("r") ? 6 : undefined,
                }}
              >
                +
              </span>
            ))}
          </div>

          {/* Title · price · stock · rendered as config-dump lines. */}
          <section style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                color: PALETTE.body,
              }}
            >
              {product.name}
            </div>
            <ConfigLine
              keyLabel="price"
              valueColor={PALETTE.emerald}
              value={product.priceLabel}
            />
            <ConfigLine
              keyLabel="stock"
              valueColor={stockColor}
              value={product.stock}
            />
            <ConfigLine
              keyLabel="seller"
              valueColor={PALETTE.amber}
              value={product.seller}
            />
            <ConfigLine
              keyLabel="dispatch"
              valueColor={PALETTE.body}
              value={product.dispatch}
            />
          </section>

          {/* Variants · one row per variant key. */}
          {product.variants && product.variants.length > 0 && (
            <section style={{ display: "grid", gap: 10 }}>
              <div style={{ color: PALETTE.chevron, fontWeight: 700 }}>
                &gt; variants
              </div>
              {product.variants.map((v) => (
                <div key={v.key} style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: PALETTE.panelDim, fontSize: 12 }}>
                    {v.key}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {v.values.map((val) => (
                      <span
                        key={val}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 4,
                          border: `1px dashed rgba(76,255,122,0.42)`,
                          color: PALETTE.body,
                          fontSize: 12,
                          cursor: soldOut ? "default" : "pointer",
                          opacity: soldOut ? 0.5 : 1,
                        }}
                      >
                        {val}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Description · rendered as a `>` prefixed block quote so
              it feels like a terminal echo of the seller's copy. */}
          <section
            style={{
              display: "grid",
              gap: 4,
              paddingTop: 8,
              borderTop: `1px dashed ${PALETTE.bannerRule}`,
            }}
          >
            <div style={{ color: PALETTE.chevron, fontWeight: 700 }}>
              &gt; description
            </div>
            <p
              style={{
                margin: 0,
                color: PALETTE.body,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {product.description}
            </p>
          </section>
        </div>

        {/* Sticky action footer · [add to cart] + [send order in chat]
            · both go bright emerald when tapped (flash 320ms). Same
            two-action shape as the standard product page but tinted
            to the terminal palette. */}
        <footer
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 6,
            padding: "12px 20px calc(env(safe-area-inset-bottom, 0) + 12px)",
            background:
              "linear-gradient(0deg, rgba(5,15,10,0.94) 0%, rgba(5,15,10,0.85) 60%, rgba(5,15,10,0.55) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderTop: `1px dashed ${PALETTE.bannerRule}`,
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              gap: 8,
            }}
          >
            <button
              type="button"
              disabled={soldOut}
              onClick={() => flashFor("add")}
              style={actionButton(
                flash === "add" ? PALETTE.cursor : soldOut ? PALETTE.panelDim : PALETTE.emerald,
                soldOut,
              )}
            >
              [+ add to cart]
            </button>
            <button
              type="button"
              disabled={soldOut}
              onClick={() => flashFor("send")}
              style={actionButton(
                flash === "send" ? PALETTE.cursor : soldOut ? PALETTE.panelDim : PALETTE.amber,
                soldOut,
              )}
            >
              [↵ send order in chat]
            </button>
          </div>
        </footer>
      </main>
    </>
  );
}

function ConfigLine({
  keyLabel,
  value,
  valueColor,
}: {
  keyLabel: string;
  value: string;
  valueColor: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        fontFamily: MONO,
        fontSize: 13,
      }}
    >
      <span style={{ color: PALETTE.chevron, fontWeight: 700 }}>&gt;</span>
      <span style={{ color: PALETTE.panelDim, minWidth: 68 }}>{keyLabel}:</span>
      <span style={{ color: valueColor, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function actionButton(color: string, disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px 12px",
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 600,
    color,
    background: "transparent",
    border: `1px solid ${color}`,
    borderRadius: 6,
    textShadow: `0 0 8px ${PALETTE.glow}`,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
    letterSpacing: "0.02em",
    transition: "color 180ms, border-color 180ms",
  };
}
