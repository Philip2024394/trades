"use client";

// src/app/nex-native/shop-prototypes/story-reel/_client.tsx
//
// Story-reel shop card · interactive live prototype.
// All state is client-local · no backend wiring.
//
// Gestures implemented:
//   · Tap left third of hero  → previous product (rewind story)
//   · Tap right two-thirds    → next product (advance story)
//   · Swipe UP anywhere       → expand drawer to specs
//   · Swipe DOWN on drawer    → collapse drawer to peek
//   · Drag drawer handle      → snap to nearest state
//   · Tap chat FAB            → alert (would open peer chat in prod)
//
// Snap states for the drawer:
//   · "peek"      · ~160px from bottom · shows title, price, primary
//                    CTA · always available so ordering is one-tap.
//   · "expanded"  · ~75vh · shows full spec block, description,
//                    variants, ingredients, allergens, delivery,
//                    seller info, secondary chat + spec buttons.
//
// Chat FAB migrates: floats at right-bottom when peek, moves to
// drawer header when expanded.

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
  panelSoft: "rgba(11,15,26,0.94)",
  border: "rgba(255,255,255,0.18)",
  borderSoft: "rgba(255,255,255,0.08)",
  cyan: "#00AFFF",
};

// Snap targets in px from viewport bottom. The drawer's `top` is
// `viewportH - snap`. On mobile-typical viewports (700-950px tall)
// peek ≈ 160px, expanded ≈ 640px, so ordering + specs both feel
// reachable.
const SNAP_PEEK = 190;
const SWIPE_TRIGGER = 60;

type Snap = "peek" | "expanded";

export function StoryReelLive({ stack }: { stack: readonly SampleProduct[] }) {
  const [productIndex, setProductIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [viewportH, setViewportH] = useState<number>(812);
  const startPointRef = useRef<{ x: number; y: number; onSheet: boolean } | null>(null);
  const dragStartOffsetRef = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = stack[productIndex]!;
  const currentVariant =
    current.variants.find((v) => v.id === selectedVariantId) ?? current.variants[0]!;

  // Reset variant selection whenever we advance to a new product.
  useEffect(() => {
    setSelectedVariantId(null);
  }, [productIndex]);

  // Track viewport height for snap math · handles orientation change.
  useEffect(() => {
    const update = () => {
      const el = rootRef.current;
      setViewportH(el ? el.clientHeight : window.innerHeight);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const snapExpandedTop = Math.max(120, viewportH * 0.25);
  const snapPeekTop = viewportH - SNAP_PEEK;
  const sheetTop =
    dragOffset != null ? dragOffset : snap === "expanded" ? snapExpandedTop : snapPeekTop;

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

  const openSheet = useCallback(() => setSnap("expanded"), []);
  const closeSheet = useCallback(() => setSnap("peek"), []);

  // Pointer handlers on the hero · handles both tap-advance and
  // swipe-up-to-open-drawer.
  const onHeroPointerDown = (e: React.PointerEvent) => {
    startPointRef.current = { x: e.clientX, y: e.clientY, onSheet: false };
  };
  const onHeroPointerUp = (e: React.PointerEvent) => {
    const start = startPointRef.current;
    startPointRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Swipe-up-to-open detection first · a fast upward drag opens
    // the sheet, regardless of tap position.
    if (dy < -SWIPE_TRIGGER && Math.abs(dy) > Math.abs(dx)) {
      openSheet();
      return;
    }
    // Ignore movements that look like intentional pans in other
    // directions (not a tap).
    if (Math.abs(dx) > 16 || Math.abs(dy) > 16) return;
    // Tap zones · left third = prev, right two-thirds = next.
    const width = (e.currentTarget as HTMLElement).clientWidth;
    if (e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left < width / 3) {
      advance(-1);
    } else {
      advance(+1);
    }
  };

  // Sheet-handle drag · lets the user pull the drawer up or down.
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
      snapPeekTop + 40,
      Math.max(snapExpandedTop - 40, dragStartOffsetRef.current + dy),
    );
    setDragOffset(next);
  };
  const onSheetPointerUp = () => {
    const start = startPointRef.current;
    startPointRef.current = null;
    if (!start || !start.onSheet) return;
    const finalOffset = dragOffset ?? sheetTop;
    setDragOffset(null);
    const midpoint = (snapExpandedTop + snapPeekTop) / 2;
    setSnap(finalOffset < midpoint ? "expanded" : "peek");
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
      {/* Hero image + gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
        onPointerDown={onHeroPointerDown}
        onPointerUp={onHeroPointerUp}
      >
        {/* Preload the next image so switching is instant. */}
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
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Progress bars · one per product · IG-style. */}
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
                    ? "linear-gradient(90deg, #fff 100%, rgba(255,255,255,0.35) 0%)" as unknown as string
                    : "rgba(255,255,255,0.30)",
              transition: "background 200ms ease",
            }}
          />
        ))}
      </div>

      {/* Seller identity + close */}
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

      {/* Left-third tap hint (only shown briefly at start of stack).
          The tap zones themselves are on the hero div above; this is
          purely visual guidance. */}
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

      {/* Tagline · sits mid-lower · gives the visitor one line
          before they even see the drawer. */}
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: sheetTop + 18,
          color: "#fff",
          zIndex: 20,
          textAlign: "center",
          pointerEvents: "none",
          textShadow: "0 2px 12px rgba(0,0,0,0.75)",
          transition: dragOffset == null ? "bottom 240ms cubic-bezier(.2,.7,.2,1)" : "none",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 700,
            opacity: 0.9,
          }}
        >
          {current.tagline}
        </div>
      </div>

      {/* Drawer · always in the DOM · animates position via top. */}
      <div
        role="dialog"
        aria-label="Product details"
        style={{
          position: "absolute",
          top: sheetTop,
          left: 0,
          right: 0,
          bottom: 0,
          background: NEX.panelSoft,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: "0 -20px 40px rgba(0,0,0,0.55)",
          transition:
            dragOffset == null ? "top 260ms cubic-bezier(.2,.7,.2,1)" : "none",
          zIndex: 30,
          overflow: "hidden",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          border: `1px solid ${NEX.border}`,
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Draggable handle · captures pointer for pull-to-open / close */}
        <div
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          style={{
            padding: "10px 16px 12px",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.35)",
              margin: "0 auto 10px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: "-0.005em",
                }}
              >
                {current.name}
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 22,
                  fontWeight: 800,
                  color: NEX.orange,
                  letterSpacing: "-0.01em",
                }}
              >
                {currentVariant.price}
              </div>
            </div>
            {snap === "expanded" ? (
              <button
                type="button"
                onClick={() => alert("Chat with " + current.seller + " (prototype · would open peer chat)")}
                aria-label="Chat with seller"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: NEX.orange,
                  color: "#0B0F1A",
                  border: "none",
                  fontSize: 20,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(255,114,0,0.5)",
                }}
              >
                💬
              </button>
            ) : (
              <button
                type="button"
                onClick={openSheet}
                aria-label="Open spec details"
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  border: `1px solid ${NEX.border}`,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                ▲ Spec
              </button>
            )}
          </div>
        </div>

        {/* Peek CTA · always visible below the header. */}
        <div style={{ padding: "0 16px 14px" }}>
          <button
            type="button"
            onClick={() =>
              alert(`Add to cart · ${current.name} · ${currentVariant.label} · ${currentVariant.price}`)
            }
            style={{
              width: "100%",
              minHeight: 52,
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
            🛒 Add to cart · Let's go
          </button>
        </div>

        {/* Expanded body · specs + variants + ingredients + allergens.
            Only meaningfully visible when snap === "expanded". */}
        <div
          style={{
            flex: 1,
            overflowY: snap === "expanded" ? "auto" : "hidden",
            padding: "4px 20px 24px",
            color: NEX.textPrimary,
            opacity: snap === "expanded" ? 1 : 0.35,
            transition: "opacity 200ms ease",
          }}
        >
          <p
            style={{
              margin: "10px 0 16px",
              fontSize: 14,
              lineHeight: 1.5,
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

          <button
            type="button"
            onClick={closeSheet}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 12,
              background: "transparent",
              border: `1px solid ${NEX.borderSoft}`,
              color: NEX.textDim,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            ▼ Close details
          </button>
        </div>
      </div>

      {/* Floating chat FAB · shown only when the sheet is peek so it
          doesn't overlap the sheet header's inline chat button. */}
      {snap === "peek" && (
        <button
          type="button"
          onClick={() =>
            alert("Chat with " + current.seller + " (prototype · would open peer chat)")
          }
          aria-label="Chat with seller"
          style={{
            position: "absolute",
            right: 16,
            bottom: SNAP_PEEK + 16,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: NEX.orange,
            color: "#0B0F1A",
            border: "none",
            fontSize: 24,
            display: "grid",
            placeItems: "center",
            boxShadow:
              "0 12px 26px rgba(255,114,0,0.5), 0 0 0 4px rgba(255,114,0,0.20)",
            cursor: "pointer",
            zIndex: 35,
          }}
        >
          💬
        </button>
      )}
    </div>
  );
}

function SpecGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
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
