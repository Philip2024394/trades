"use client";

// src/app/nex-native/shop-prototypes/story-reel/_client.tsx
//
// Story-reel shop card · interactive live prototype.
// All state is client-local · no backend wiring.
//
// Founder tightening 2026-09-28 (revision):
//   · Footer is JUST a single swipe-up button · no panel · no
//     overlay copy sitting on a card.
//   · Product name + price + tagline are text-overlaid directly on
//     the hero image (no panel behind them).
//   · Swipe up on the button (or tap it) → the drawer expands to
//     FULL-HEIGHT, covering the whole screen · reads as a full
//     spec page, not a bottom sheet.
//   · Drawer collapses back to just the button on drag-down or
//     "Close" tap.
//
// Gestures:
//   · Tap LEFT third of hero    → previous product
//   · Tap RIGHT two-thirds      → next product
//   · Tap the swipe-up button   → full-height spec page
//   · Swipe UP anywhere on hero → full-height spec page
//   · Drag drawer handle DOWN   → collapse back to closed
//   · Tap × close in drawer     → collapse back to closed

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Variant {
  readonly id: string;
  readonly label: string;
  readonly price: string;
}

export interface SampleProduct {
  readonly id: string;
  readonly name: string;
  readonly seller: string;
  readonly sellerLocation: string;
  readonly priceLabel: string;
  readonly imageUrl: string;
  readonly imageAlt: string;
  readonly tagline: string;
  readonly description: string;
  readonly variants: readonly Variant[];
  readonly ingredients: readonly string[];
  readonly allergens: readonly string[];
  readonly deliveryNote: string;
  readonly stockNote: string;
}

const NEX = {
  bg: "#000000",
  orange: "#FF7200",
  orangeStrong: "#FF9033",
  textPrimary: "#F4F7FC",
  textDim: "rgba(255,255,255,0.75)",
  panel: "#0B0F1A",
  panelSoft: "rgba(11,15,26,0.96)",
  border: "rgba(255,255,255,0.18)",
  borderSoft: "rgba(255,255,255,0.08)",
  cyan: "#00AFFF",
};

// Footer button lives at the bottom edge · not a drawer, just a
// button. When the drawer is closed, this is the only thing at the
// bottom. Height + safe-area padding.
const BUTTON_HEIGHT = 60;
const BUTTON_BOTTOM = 20;
const CLOSED_BOTTOM = BUTTON_HEIGHT + BUTTON_BOTTOM + 4; // room for the button

// When open, the drawer top offset · leaves room for the notch and
// a small breathing gap so it reads as a full-height page, not
// literally full-screen.
const OPEN_TOP = 44;

const SWIPE_TRIGGER = 60;

export function StoryReelLive({ stack }: { stack: readonly SampleProduct[] }) {
  const [productIndex, setProductIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [viewportH, setViewportH] = useState<number>(812);
  const startPointRef = useRef<{ x: number; y: number; onSheet: boolean } | null>(null);
  const dragStartOffsetRef = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = stack[productIndex]!;
  const currentVariant =
    current.variants.find((v) => v.id === selectedVariantId) ?? current.variants[0]!;

  useEffect(() => {
    setSelectedVariantId(null);
  }, [productIndex]);

  useEffect(() => {
    const update = () => {
      const el = rootRef.current;
      setViewportH(el ? el.clientHeight : window.innerHeight);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const closedTop = viewportH; // drawer completely below viewport when closed
  const openTop = OPEN_TOP;
  const sheetTop = dragOffset != null ? dragOffset : open ? openTop : closedTop;

  const advance = useCallback(
    (delta: number) => {
      setProductIndex((prev) => {
        const next = prev + delta;
        if (next < 0) return 0;
        if (next >= stack.length) return stack.length - 1;
        return next;
      });
    },
    [stack.length],
  );

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);

  const onHeroPointerDown = (e: React.PointerEvent) => {
    startPointRef.current = { x: e.clientX, y: e.clientY, onSheet: false };
  };
  const onHeroPointerUp = (e: React.PointerEvent) => {
    const start = startPointRef.current;
    startPointRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dy < -SWIPE_TRIGGER && Math.abs(dy) > Math.abs(dx)) {
      openDrawer();
      return;
    }
    if (Math.abs(dx) > 16 || Math.abs(dy) > 16) return;
    const width = (e.currentTarget as HTMLElement).clientWidth;
    if (
      e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left <
      width / 3
    ) {
      advance(-1);
    } else {
      advance(+1);
    }
  };

  const onSheetPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startPointRef.current = { x: e.clientX, y: e.clientY, onSheet: true };
    dragStartOffsetRef.current = sheetTop;
    setDragOffset(sheetTop);
  };
  const onSheetPointerMove = (e: React.PointerEvent) => {
    const start = startPointRef.current;
    if (!start || !start.onSheet) return;
    const dy = e.clientY - start.y;
    const next = Math.min(
      closedTop,
      Math.max(openTop - 20, dragStartOffsetRef.current + dy),
    );
    setDragOffset(next);
  };
  const onSheetPointerUp = () => {
    const start = startPointRef.current;
    startPointRef.current = null;
    if (!start || !start.onSheet) return;
    const finalOffset = dragOffset ?? sheetTop;
    setDragOffset(null);
    const midpoint = (openTop + closedTop) / 2;
    setOpen(finalOffset < midpoint);
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
      }}
      data-nex-story-reel-root
    >
      {/* Hero image + gradient · full-viewport */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
        onPointerDown={onHeroPointerDown}
        onPointerUp={onHeroPointerUp}
      >
        {stack.map((p, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={p.id}
            src={p.imageUrl}
            alt={p.imageAlt}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: i === productIndex ? 1 : 0,
              transition: "opacity 240ms ease",
              pointerEvents: "none",
            }}
          />
        ))}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.78) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Progress bars · one per product · IG-style */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          gap: 4,
          zIndex: 25,
          pointerEvents: "none",
        }}
      >
        {stack.map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background:
                i < productIndex
                  ? "#fff"
                  : i === productIndex
                    ? "#fff"
                    : "rgba(255,255,255,0.30)",
              transition: "background 200ms ease",
            }}
          />
        ))}
      </div>

      {/* Seller identity + close · top row */}
      <div
        style={{
          position: "absolute",
          top: 26,
          left: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#fff",
          zIndex: 25,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px 4px 4px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(10px) saturate(1.4)",
            WebkitBackdropFilter: "blur(10px) saturate(1.4)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #FF9033, #FF7200)",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
            }}
          >
            🛍
          </span>
          <div style={{ minWidth: 0, lineHeight: 1.15 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{current.seller}</div>
            <div style={{ fontSize: 10, opacity: 0.85 }}>📍 {current.sellerLocation}</div>
          </div>
        </div>
        <Link
          href="/nex-native/shop-prototypes"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.45)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            textDecoration: "none",
            fontSize: 18,
            fontWeight: 600,
            pointerEvents: "auto",
          }}
          aria-label="Back to prototypes"
        >
          ×
        </Link>
      </div>

      {/* First-time tap hint · fades after user advances */}
      {productIndex === 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "38%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            padding: "0 26px",
            color: "rgba(255,255,255,0.55)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            zIndex: 15,
            pointerEvents: "none",
          }}
        >
          <span>← tap</span>
          <span>tap →</span>
        </div>
      )}

      {/* Product identity · text-overlay on hero · no panel. Name +
          price + tagline. Positioned above the swipe-up button.
          Fades away as the drawer opens so it doesn't compete. */}
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: CLOSED_BOTTOM + 22,
          color: "#fff",
          zIndex: 20,
          textAlign: "left",
          pointerEvents: "none",
          opacity: open ? 0 : 1,
          transition: "opacity 200ms ease",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            textShadow: "0 3px 16px rgba(0,0,0,0.85)",
          }}
        >
          {current.name}
        </h1>
        <div
          style={{
            marginTop: 6,
            fontSize: 24,
            fontWeight: 800,
            color: NEX.orange,
            letterSpacing: "-0.01em",
            textShadow: "0 2px 14px rgba(0,0,0,0.85)",
          }}
        >
          {current.priceLabel}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 1px 8px rgba(0,0,0,0.75)",
          }}
        >
          {current.tagline}
        </div>
      </div>

      {/* Swipe-up button · JUST a button · no panel around it · lives
          on the bottom edge · fades out when the drawer opens. Also
          works as a tap target. */}
      <button
        type="button"
        onClick={openDrawer}
        onPointerDown={(e) => {
          startPointRef.current = { x: e.clientX, y: e.clientY, onSheet: false };
        }}
        onPointerUp={(e) => {
          const start = startPointRef.current;
          startPointRef.current = null;
          if (!start) return;
          const dy = e.clientY - start.y;
          if (dy < -SWIPE_TRIGGER) openDrawer();
        }}
        aria-label="Open product details"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: BUTTON_BOTTOM,
          height: BUTTON_HEIGHT,
          borderRadius: 999,
          background: `linear-gradient(180deg, ${NEX.orangeStrong} 0%, ${NEX.orange} 100%)`,
          color: "#0B0F1A",
          border: "none",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          boxShadow:
            "0 12px 30px rgba(255,114,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
          cursor: "pointer",
          zIndex: 22,
          opacity: open ? 0 : 1,
          transform: open ? "translateY(20px)" : "translateY(0)",
          transition: "opacity 220ms ease, transform 220ms ease",
          pointerEvents: open ? "none" : "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            fontSize: 14,
          }}
        >
          ▲
        </span>
        <span>Swipe up · order + details</span>
      </button>

      {/* Chat FAB · floats above the button when drawer is closed ·
          hidden when open (drawer has its own inline chat). */}
      {!open && (
        <button
          type="button"
          onClick={() =>
            alert("Chat with " + current.seller + " (prototype · would open peer chat)")
          }
          aria-label="Chat with seller"
          style={{
            position: "absolute",
            right: 16,
            bottom: CLOSED_BOTTOM + 18,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.25)",
            fontSize: 22,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            cursor: "pointer",
            zIndex: 26,
          }}
        >
          💬
        </button>
      )}

      {/* Drawer · slides from below to full-height spec page. Only
          hittable when open. */}
      <div
        role="dialog"
        aria-label="Product details"
        aria-hidden={!open}
        style={{
          position: "absolute",
          top: sheetTop,
          left: 0,
          right: 0,
          bottom: 0,
          background: NEX.panelSoft,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          boxShadow: "0 -24px 60px rgba(0,0,0,0.65)",
          transition:
            dragOffset == null ? "top 300ms cubic-bezier(.2,.7,.2,1)" : "none",
          zIndex: 30,
          overflow: "hidden",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          border: `1px solid ${NEX.border}`,
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
          pointerEvents: open || dragOffset != null ? "auto" : "none",
        }}
      >
        {/* Draggable handle · pull-to-close */}
        <div
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          style={{
            padding: "12px 16px 8px",
            cursor: "grab",
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ width: 36, height: 36 }} aria-hidden />
          <div
            aria-hidden
            style={{
              width: 44,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.35)",
            }}
          />
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close product details"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              color: "#fff",
              border: `1px solid ${NEX.border}`,
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body · full-height spec page */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "6px 22px 130px",
            color: NEX.textPrimary,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.005em",
              }}
            >
              {current.name}
            </h2>
            <div
              style={{
                flexShrink: 0,
                fontSize: 22,
                fontWeight: 800,
                color: NEX.orange,
                letterSpacing: "-0.01em",
              }}
            >
              {currentVariant.price}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 20,
            }}
          >
            {current.seller} · {current.sellerLocation}
          </div>

          <p
            style={{
              margin: "0 0 22px",
              fontSize: 14,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            {current.description}
          </p>

          <SpecGroup label="Choose size">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {current.variants.map((v) => {
                const selected =
                  (selectedVariantId ?? current.variants[0]!.id) === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: selected ? "#fff" : "rgba(255,255,255,0.08)",
                      color: selected ? "#0B0F1A" : "#fff",
                      border: selected ? "1px solid #fff" : `1px solid ${NEX.border}`,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {v.label}
                    <span
                      style={{
                        display: "block",
                        marginTop: 2,
                        fontSize: 10,
                        opacity: 0.75,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {v.price}
                    </span>
                  </button>
                );
              })}
            </div>
          </SpecGroup>

          <SpecGroup label="Ingredients">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {current.ingredients.map((i) => (
                <span
                  key={i}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${NEX.borderSoft}`,
                    fontSize: 11,
                    color: NEX.textDim,
                  }}
                >
                  {i}
                </span>
              ))}
            </div>
          </SpecGroup>

          <SpecGroup label="Contains">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {current.allergens.map((a) => (
                <span
                  key={a}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,114,0,0.10)",
                    border: "1px solid rgba(255,114,0,0.35)",
                    fontSize: 11,
                    color: "#FFB989",
                    fontWeight: 600,
                  }}
                >
                  ⚠ {a}
                </span>
              ))}
            </div>
          </SpecGroup>

          <SpecGroup label="Delivery + stock">
            <div style={{ fontSize: 12, lineHeight: 1.5, color: NEX.textDim }}>
              🚚 {current.deliveryNote}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: "#8FE0B4" }}>
              ✓ {current.stockNote}
            </div>
          </SpecGroup>

          <SpecGroup label="Seller">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${NEX.borderSoft}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #FF9033, #FF7200)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 16,
                }}
              >
                🛍
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {current.seller}
                </div>
                <div style={{ fontSize: 11, color: NEX.textDim }}>
                  📍 {current.sellerLocation} · verified NEX seller ✓
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  alert("Chat with " + current.seller + " (prototype)")
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                💬 Ask
              </button>
            </div>
          </SpecGroup>
        </div>

        {/* Sticky bottom CTA + chat inside the full-height drawer.
            Order + chat both reachable without scrolling to the top. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "12px 16px 22px",
            background:
              "linear-gradient(180deg, rgba(11,15,26,0) 0%, rgba(11,15,26,0.90) 30%, rgba(11,15,26,0.96) 100%)",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() =>
              alert(
                `Add to cart · ${current.name} · ${currentVariant.label} · ${currentVariant.price}`,
              )
            }
            style={{
              flex: 1,
              minHeight: 54,
              borderRadius: 14,
              background: `linear-gradient(180deg, ${NEX.orangeStrong} 0%, ${NEX.orange} 100%)`,
              color: "#0B0F1A",
              border: "none",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              boxShadow:
                "0 10px 24px rgba(255,114,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
              cursor: "pointer",
            }}
          >
            🛒 Let's go · {currentVariant.price}
          </button>
          <button
            type="button"
            onClick={() =>
              alert("Chat with " + current.seller + " (prototype)")
            }
            aria-label="Chat with seller"
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              border: `1px solid ${NEX.border}`,
              color: "#fff",
              fontSize: 22,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            💬
          </button>
        </div>
      </div>
    </div>
  );
}

function SpecGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
