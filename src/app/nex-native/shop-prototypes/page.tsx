// src/app/nex-native/shop-prototypes/page.tsx
//
// NEX Shop · 10 swipe-page design prototypes.
// -------------------------------------------
// Founder direction 2026-09-28: shop pages should behave like a
// Tinder-swipe stack · one product per full-screen card · no
// click-through detail page · order button + floating chat FAB always
// visible. This gallery renders 10 distinct visual takes on that
// same UX so the founder can pick a direction before wiring the
// real backend.
//
// Every design uses the same SAMPLE_PRODUCT so visual differences
// are the only variable. None of these are wired to real data ·
// production shop pages still live at /nex-native/[businessSlug].

import * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

// ---------------------------------------------------------------------
// Shared sample product · one item, ten treatments.
// ---------------------------------------------------------------------

const SAMPLE_PRODUCT = {
  name: "Coconut Pandan Cake",
  seller: "Priya's Bakery",
  sellerLocation: "Mumbai",
  priceLabel: "Rp 85,000",
  currency: "IDR",
  imageUrl:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&h=1200&fit=crop",
  imageAlt: "Coconut pandan layer cake",
  description:
    "Three layers of vanilla sponge, pandan cream, and toasted coconut. Baked fresh at 5am · order by noon for same-day pickup.",
  variants: [
    { id: "s", label: `Small · 6"`, price: "Rp 85,000" },
    { id: "m", label: `Medium · 9"`, price: "Rp 145,000" },
    { id: "l", label: `Large · 12"`, price: "Rp 220,000" },
  ],
  stackIndex: 3,
  stackTotal: 12,
  tags: ["🥥 Coconut", "🌿 Pandan", "🌱 Vegetarian"],
  soldToday: 14,
} as const;

const PHONE_W = 390;
const PHONE_H = 812;

// ---------------------------------------------------------------------
// Design catalogue · 10 prototype entries
// ---------------------------------------------------------------------

const DESIGNS: ReadonlyArray<{
  id: string;
  title: string;
  tagline: string;
  render: () => React.JSX.Element;
}> = [
  { id: "01", title: "Classic Tinder", tagline: "Full-bleed image · content overlaid at bottom · orange CTA + chat FAB", render: () => <D01ClassicTinder /> },
  { id: "02", title: "Split Card", tagline: "60/40 image + card · clean typography · no overlay", render: () => <D02SplitCard /> },
  { id: "03", title: "Story Reel", tagline: "Instagram Stories · progress bars top · story-timer feel", render: () => <D03StoryReel /> },
  { id: "04", title: "Cinemagraph", tagline: "Live pulse background · single centred CTA · maximum focus", render: () => <D04Cinemagraph /> },
  { id: "05", title: "Framed Print", tagline: "Bordered card floating over blurred backdrop · gallery feel", render: () => <D05FramedPrint /> },
  { id: "06", title: "Editorial", tagline: "Magazine layout · serif type · image is the accent, not the star", render: () => <D06Editorial /> },
  { id: "07", title: "Neon Popup", tagline: "Dark bg · glowing neon frame · playful loud price tag", render: () => <D07NeonPopup /> },
  { id: "08", title: "Depth Glass", tagline: "Parallax + frosted-glass surfaces · price on floating pill", render: () => <D08DepthGlass /> },
  { id: "09", title: "Museum Poster", tagline: "Art gallery poster · typographic label + edition number", render: () => <D09MuseumPoster /> },
  { id: "10", title: "Zen Minimal", tagline: "Massive whitespace · tiny centred product · huge price · single CTA", render: () => <D10ZenMinimal /> },
];

// ---------------------------------------------------------------------
// Gallery hub
// ---------------------------------------------------------------------

export default function ShopPrototypesGallery() {
  return (
    <>
      <style>{`
        html, body { background: #05060B !important; }
        [data-nex-shop-proto-root] * { box-sizing: border-box; }
      `}</style>
      <main
        data-nex-shop-proto-root
        style={{
          minHeight: "100dvh",
          background: "#05060B",
          color: "#F4F7FC",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 20px 80px",
        }}
      >
        <header style={{ maxWidth: 1080, margin: "0 auto 32px" }}>
          <div style={{ marginBottom: 8 }}>
            <Link
              href="/nex-native/home"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#7D9BC0",
                textDecoration: "none",
              }}
            >
              ← Back to NEX
            </Link>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Shop swipe-page · 10 prototypes
          </h1>
          <p
            style={{
              marginTop: 8,
              maxWidth: 620,
              fontSize: 13,
              lineHeight: 1.55,
              color: "#8BA9D1",
            }}
          >
            One product · one full-screen card · no click-through detail
            page · order button + floating chat FAB always in reach.
            Every design below shows the same {SAMPLE_PRODUCT.name} so
            visual differences are the only variable. Pick a direction,
            then we wire it to the real backend on
            /nex-native/[businessSlug].
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(410px, 1fr))",
            gap: 32,
            maxWidth: 1400,
            margin: "0 auto",
          }}
        >
          {DESIGNS.map((d) => (
            <section
              key={d.id}
              id={`design-${d.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  padding: "0 8px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#7D9BC0",
                    fontWeight: 700,
                  }}
                >
                  {d.id} · {d.title}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "#8BA9D1",
                    lineHeight: 1.4,
                  }}
                >
                  {d.tagline}
                </div>
              </div>
              <PhoneFrame>{d.render()}</PhoneFrame>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------
// Phone frame · 390 × 812 device shell with subtle bezel + notch.
// Every design renders inside this so proportions stay honest.
// ---------------------------------------------------------------------

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W + 20,
        height: PHONE_H + 20,
        borderRadius: 42,
        background: "#0B0F1A",
        padding: 10,
        boxShadow:
          "0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(139,169,209,0.18)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: PHONE_W,
          height: PHONE_H,
          borderRadius: 32,
          overflow: "hidden",
          position: "relative",
          background: "#000",
        }}
      >
        {children}
        {/* Notch */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 26,
            borderRadius: "0 0 14px 14px",
            background: "#0B0F1A",
            zIndex: 50,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Shared micro-components used across multiple designs
// ---------------------------------------------------------------------

function StackDots({ index, total, color = "rgba(255,255,255,0.5)", activeColor = "#FFFFFF" }: {
  index: number;
  total: number;
  color?: string;
  activeColor?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: i === index ? 18 : 4,
            height: 4,
            borderRadius: 999,
            background: i === index ? activeColor : color,
            transition: "width 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

function ChatFab({ color = "#FF7200", ring = "rgba(255,114,0,0.25)" }: { color?: string; ring?: string }) {
  return (
    <button
      type="button"
      aria-label="Chat with seller"
      style={{
        position: "absolute",
        right: 16,
        bottom: 100,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: color,
        color: "#0B0F1A",
        border: "none",
        fontSize: 24,
        display: "grid",
        placeItems: "center",
        boxShadow: `0 12px 26px ${ring}, 0 0 0 4px ${ring}`,
        cursor: "pointer",
        zIndex: 40,
      }}
    >
      💬
    </button>
  );
}

function StatusBar({ tint = "rgba(255,255,255,0.85)" }: { tint?: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        padding: "12px 24px 0",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        fontSize: 12,
        fontWeight: 600,
        color: tint,
        zIndex: 45,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 10 }}>
        <span>●●●</span>
        <span>WiFi</span>
        <span>100%</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------
// 01 · Classic Tinder
// Full-bleed product · content overlaid on bottom half · orange CTA
// + chat FAB. The "obvious" swipe design against which everything else
// is judged.
// ---------------------------------------------------------------------

function D01ClassicTinder() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}>
      <StatusBar />
      <img
        src={p.imageUrl}
        alt={p.imageAlt}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Top row · stack dots + shop */}
      <div
        style={{
          position: "absolute",
          top: 54,
          left: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.35)",
              backdropFilter: "blur(10px)",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
            }}
          >
            🛍
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
              {p.seller}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em" }}>
              📍 {p.sellerLocation}
            </div>
          </div>
        </div>
        <StackDots index={p.stackIndex} total={p.stackTotal} />
      </div>

      {/* Bottom content stack */}
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 90,
          zIndex: 20,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {p.tags.map((t) => (
            <span
              key={t}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                borderRadius: 999,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.20)",
                color: "#fff",
                backdropFilter: "blur(6px)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            textShadow: "0 2px 12px rgba(0,0,0,0.55)",
          }}
        >
          {p.name}
        </h2>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "#FF7200", textShadow: "0 2px 12px rgba(0,0,0,0.55)" }}>
          {p.priceLabel}
        </div>
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 1px 6px rgba(0,0,0,0.55)",
          }}
        >
          {p.description}
        </p>
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 22,
          zIndex: 20,
        }}
      >
        <button
          type="button"
          style={{
            width: "100%",
            minHeight: 56,
            borderRadius: 14,
            background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
            color: "#0B0F1A",
            border: "none",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 12px 28px rgba(255,114,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          🛒 Add to cart · {p.priceLabel}
        </button>
      </div>

      <ChatFab />
    </div>
  );
}

// ---------------------------------------------------------------------
// 02 · Split Card · 60/40 image top · white card bottom with
// structured typography · no overlay · reads as a curated product page
// ---------------------------------------------------------------------

function D02SplitCard() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#F4F0EA" }}>
      <StatusBar tint="rgba(60,60,60,0.85)" />
      <div style={{ position: "relative", height: "58%", overflow: "hidden" }}>
        <img
          src={p.imageUrl}
          alt={p.imageAlt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            top: 54,
            left: 16,
            right: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.85)",
              color: "#0B0F1A",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              backdropFilter: "blur(8px)",
            }}
          >
            🛍 {p.seller}
          </span>
          <StackDots index={p.stackIndex} total={p.stackTotal} color="rgba(255,255,255,0.6)" activeColor="#FFF" />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "54%",
          bottom: 0,
          background: "#F4F0EA",
          padding: "24px 24px 24px",
          color: "#1a1a1a",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
            }}
          >
            {p.name}
          </h2>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{p.priceLabel}</span>
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8b7355",
            fontWeight: 700,
          }}
        >
          {p.seller} · {p.sellerLocation}
        </div>
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#3a3a3a",
            flex: 1,
          }}
        >
          {p.description}
        </p>

        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {p.variants.map((v, i) => (
            <span
              key={v.id}
              style={{
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 8,
                background: i === 0 ? "#1a1a1a" : "transparent",
                color: i === 0 ? "#F4F0EA" : "#3a3a3a",
                border: `1px solid ${i === 0 ? "#1a1a1a" : "rgba(58,58,58,0.35)"}`,
              }}
            >
              {v.label}
            </span>
          ))}
        </div>

        <button
          type="button"
          style={{
            marginTop: 14,
            width: "100%",
            minHeight: 52,
            borderRadius: 10,
            background: "#1a1a1a",
            color: "#F4F0EA",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          🛒 Add to cart
        </button>
      </div>

      <ChatFab color="#1a1a1a" ring="rgba(26,26,26,0.20)" />
    </div>
  );
}

// ---------------------------------------------------------------------
// 03 · Story Reel · Instagram Stories layout · progress bars pinned
// at top · minimal text · tap-forward feel
// ---------------------------------------------------------------------

function D03StoryReel() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}>
      <img
        src={p.imageUrl}
        alt={p.imageAlt}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* IG-style progress bars */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 48,
          left: 12,
          right: 12,
          display: "flex",
          gap: 3,
          zIndex: 30,
        }}
      >
        {Array.from({ length: p.stackTotal }).map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 2,
              borderRadius: 999,
              background: i < p.stackIndex ? "#fff" : i === p.stackIndex ? "linear-gradient(90deg, #fff 45%, rgba(255,255,255,0.35) 45%)" as unknown as string : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 20,
          color: "#fff",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(45deg, #FF7200, #FF9033)",
            padding: 2,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "#000",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
            }}
          >
            🛍
          </div>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}>{p.seller}</div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>2h ago · {p.soldToday} sold today</div>
        </div>
      </div>

      {/* Product label bottom */}
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 90,
          zIndex: 20,
          color: "#fff",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            textShadow: "0 2px 12px rgba(0,0,0,0.7)",
          }}
        >
          {p.name}
        </h2>
        <div style={{ marginTop: 4, fontSize: 32, fontWeight: 900, color: "#FF7200", textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}>
          {p.priceLabel}
        </div>
      </div>

      {/* Swipe-up dock */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 22,
          padding: "0 12px",
          zIndex: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.35)",
            backdropFilter: "blur(20px) saturate(1.4)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          <span aria-hidden>↑</span>
          Swipe up · order now
        </div>
      </div>

      <ChatFab />
    </div>
  );
}

// ---------------------------------------------------------------------
// 04 · Cinemagraph · single centred call to action · everything
// else recedes · assumes a video-loop background (still image here
// with a subtle pulse animation)
// ---------------------------------------------------------------------

function D04Cinemagraph() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0B0F1A", overflow: "hidden" }}>
      <style>{`
        @keyframes nex-cinema-pulse {
          0%, 100% { transform: scale(1.02); }
          50%      { transform: scale(1.08); }
        }
      `}</style>
      <img
        src={p.imageUrl}
        alt={p.imageAlt}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          animation: "nex-cinema-pulse 9s ease-in-out infinite",
          filter: "saturate(1.1) contrast(1.05)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(60% 45% at 50% 55%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)",
        }}
      />
      <StatusBar />

      {/* Ultra-minimal shop chip */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#fff",
          zIndex: 20,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 700, textTransform: "uppercase" }}>
          {p.seller}
        </div>
        <div style={{ fontSize: 10, opacity: 0.8 }}>{p.stackIndex + 1} / {p.stackTotal}</div>
      </div>

      {/* Centered CTA */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          textAlign: "center",
          padding: "0 32px",
          zIndex: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.05,
            textShadow: "0 4px 24px rgba(0,0,0,0.75)",
          }}
        >
          {p.name}
        </h2>
        <div
          style={{
            marginTop: 8,
            fontSize: 42,
            fontWeight: 900,
            color: "#FF7200",
            letterSpacing: "-0.02em",
            textShadow: "0 4px 24px rgba(0,0,0,0.85)",
          }}
        >
          {p.priceLabel}
        </div>
        <button
          type="button"
          style={{
            marginTop: 30,
            padding: "18px 44px",
            borderRadius: 999,
            background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
            color: "#0B0F1A",
            border: "none",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            boxShadow: "0 16px 40px rgba(255,114,0,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
          }}
        >
          🛒 Order now
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 20,
          right: 20,
          zIndex: 20,
          textAlign: "center",
          fontSize: 11,
          color: "rgba(255,255,255,0.75)",
          textShadow: "0 1px 6px rgba(0,0,0,0.65)",
        }}
      >
        Swipe to see the next dish · {p.stackTotal - p.stackIndex - 1} more
      </div>

      <ChatFab />
    </div>
  );
}

// ---------------------------------------------------------------------
// 05 · Framed Print · image lives inside a bordered card floating
// over a soft-blurred version of itself · gallery / editorial feel
// ---------------------------------------------------------------------

function D05FramedPrint() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0B0F1A", overflow: "hidden" }}>
      {/* Blurred backdrop */}
      <img
        src={p.imageUrl}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(50px) saturate(1.4)",
          transform: "scale(1.4)",
        }}
      />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(11,15,26,0.55)" }} />
      <StatusBar />

      {/* Top chrome */}
      <div
        style={{
          position: "absolute",
          top: 54,
          left: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#fff",
          zIndex: 20,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {p.seller}
        </div>
        <StackDots index={p.stackIndex} total={p.stackTotal} />
      </div>

      {/* Framed image card */}
      <div
        style={{
          position: "absolute",
          left: 26,
          right: 26,
          top: 100,
          bottom: 240,
          background: "#F4EFE8",
          padding: 16,
          borderRadius: 20,
          boxShadow: "0 30px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.15)",
          zIndex: 20,
        }}
      >
        <img
          src={p.imageUrl}
          alt={p.imageAlt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 10,
          }}
        />
      </div>

      {/* Info panel */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 90,
          padding: "0 26px",
          color: "#fff",
          zIndex: 20,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)",
            fontWeight: 700,
          }}
        >
          Edition {p.stackIndex + 1} / {p.stackTotal}
        </div>
        <h2
          style={{
            margin: "6px 0 2px",
            fontSize: 22,
            fontWeight: 600,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            letterSpacing: "-0.005em",
          }}
        >
          {p.name}
        </h2>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#FF9033" }}>{p.priceLabel}</div>
      </div>

      {/* CTA */}
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 22, zIndex: 20 }}>
        <button
          type="button"
          style={{
            width: "100%",
            minHeight: 52,
            borderRadius: 12,
            background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
            color: "#0B0F1A",
            border: "none",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          Acquire · {p.priceLabel}
        </button>
      </div>

      <ChatFab />
    </div>
  );
}

// ---------------------------------------------------------------------
// 06 · Editorial · magazine layout · serif type · image sits inside
// a text-forward column · feels like a Kinfolk or Cereal spread
// ---------------------------------------------------------------------

function D06Editorial() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#F7F3EC", color: "#1a1a1a" }}>
      <StatusBar tint="rgba(30,30,30,0.85)" />

      {/* Small top row */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 24,
          right: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
          Issue 03 · Bakery
        </div>
        <div style={{ fontSize: 11, color: "#7a6a55" }}>{p.stackIndex + 1} / {p.stackTotal}</div>
      </div>

      {/* Big serif headline */}
      <div style={{ position: "absolute", top: 100, left: 24, right: 24 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#a08966",
          }}
        >
          Featured · {p.seller}
        </div>
        <h2
          style={{
            margin: "10px 0 8px",
            fontSize: 34,
            fontWeight: 500,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            lineHeight: 1.05,
            letterSpacing: "-0.005em",
          }}
        >
          {p.name}
        </h2>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#a08966",
            fontWeight: 700,
          }}
        >
          · Fresh baked · same-day pickup ·
        </div>
      </div>

      {/* Image + text column */}
      <div
        style={{
          position: "absolute",
          top: 260,
          left: 24,
          right: 24,
          bottom: 130,
        }}
      >
        <img
          src={p.imageUrl}
          alt={p.imageAlt}
          style={{
            width: "62%",
            aspectRatio: "3/4",
            objectFit: "cover",
            float: "right",
            marginLeft: 14,
            borderRadius: 4,
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: "#3a2f24",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 500,
          }}
        >
          {p.description}
        </p>
      </div>

      {/* Price + CTA */}
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingBottom: 12,
            borderTop: "1px solid rgba(58,47,36,0.25)",
            paddingTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
            }}
          >
            {p.priceLabel}
          </div>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7a6a55", fontWeight: 700 }}>
            📍 {p.sellerLocation}
          </div>
        </div>
        <button
          type="button"
          style={{
            width: "100%",
            minHeight: 48,
            borderRadius: 4,
            background: "#1a1a1a",
            color: "#F7F3EC",
            border: "none",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
          }}
        >
          Order
        </button>
      </div>

      <ChatFab color="#1a1a1a" ring="rgba(26,26,26,0.15)" />
    </div>
  );
}

// ---------------------------------------------------------------------
// 07 · Neon Popup · dark bg · playful neon glow around product · huge
// crayon-tag price · feels like a night-market poster
// ---------------------------------------------------------------------

function D07NeonPopup() {
  const p = SAMPLE_PRODUCT;
  const neonPink = "#FF3F9F";
  const neonCyan = "#00E5FF";
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0B0316", overflow: "hidden" }}>
      <style>{`
        @keyframes nex-neon-flicker {
          0%, 92%, 100% { opacity: 1; filter: drop-shadow(0 0 8px ${neonPink}) drop-shadow(0 0 20px ${neonPink}); }
          94%           { opacity: 0.6; filter: drop-shadow(0 0 3px ${neonPink}); }
          96%           { opacity: 1;   filter: drop-shadow(0 0 8px ${neonPink}) drop-shadow(0 0 20px ${neonPink}); }
        }
      `}</style>
      {/* Grid backdrop */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(80% 60% at 50% 30%, rgba(255,63,159,0.15), transparent 60%), linear-gradient(180deg, #0B0316 0%, #1a0729 100%)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <StatusBar tint={neonCyan} />

      <div
        style={{
          position: "absolute",
          top: 56,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: neonCyan,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 800,
          zIndex: 20,
        }}
      >
        <span style={{ animation: "nex-neon-flicker 5s infinite" }}>{p.seller}</span>
        <StackDots index={p.stackIndex} total={p.stackTotal} color="rgba(0,229,255,0.35)" activeColor={neonCyan} />
      </div>

      {/* Framed product */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 30,
          right: 30,
          bottom: 260,
          border: `3px solid ${neonPink}`,
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: `0 0 24px ${neonPink}88, inset 0 0 24px ${neonPink}55`,
          zIndex: 20,
        }}
      >
        <img
          src={p.imageUrl}
          alt={p.imageAlt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Big price tag rotated · plastered on product */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 138,
          right: 8,
          transform: "rotate(8deg)",
          padding: "8px 14px",
          background: "#FFD400",
          color: "#0B0316",
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          borderRadius: 4,
          boxShadow: "0 8px 24px rgba(255,212,0,0.55)",
          fontFamily: "'Cormorant Garamond', 'Impact', sans-serif",
          zIndex: 25,
        }}
      >
        {p.priceLabel}
      </div>

      {/* Product name huge */}
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 130,
          color: "#fff",
          zIndex: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: "#fff",
            textShadow: `0 0 12px ${neonCyan}, 0 0 22px ${neonCyan}88`,
          }}
        >
          {p.name.toUpperCase()}
        </h2>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {p.tags.map((t) => (
            <span
              key={t}
              style={{
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                borderRadius: 4,
                background: "rgba(255,255,255,0.08)",
                border: `1px solid ${neonPink}88`,
                color: "#fff",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", left: 12, right: 12, bottom: 22, zIndex: 20 }}>
        <button
          type="button"
          style={{
            width: "100%",
            minHeight: 56,
            borderRadius: 12,
            background: neonPink,
            color: "#0B0316",
            border: "none",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            boxShadow: `0 0 24px ${neonPink}, 0 12px 32px ${neonPink}66`,
          }}
        >
          🛒 GRAB IT
        </button>
      </div>

      <ChatFab color={neonCyan} ring="rgba(0,229,255,0.35)" />
    </div>
  );
}

// ---------------------------------------------------------------------
// 08 · Depth Glass · parallax product on frosted glass surfaces ·
// prices float in isolated pills · Apple-store feel
// ---------------------------------------------------------------------

function D08DepthGlass() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0E1420" }}>
      <img
        src={p.imageUrl}
        alt={p.imageAlt}
        style={{
          position: "absolute",
          top: -20,
          left: -20,
          right: -20,
          bottom: -20,
          width: "calc(100% + 40px)",
          height: "calc(100% + 40px)",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.9)",
        }}
      />
      <StatusBar />

      {/* Top chrome · frosted */}
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 12,
          right: 12,
          padding: "10px 14px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#fff",
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ fontSize: 14 }}>🛍</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{p.seller}</span>
        </div>
        <StackDots index={p.stackIndex} total={p.stackTotal} />
      </div>

      {/* Product floats mid-canvas */}
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 40,
          right: 40,
          bottom: 320,
          zIndex: 20,
        }}
      >
        <img
          src={p.imageUrl}
          alt=""
          aria-hidden
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 20,
            boxShadow: "0 40px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.10) inset",
            transform: "perspective(1000px) rotateY(-6deg) rotateX(3deg)",
          }}
        />
      </div>

      {/* Floating price pill */}
      <div
        style={{
          position: "absolute",
          top: 350,
          right: 12,
          padding: "10px 16px",
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)",
          border: "1px solid rgba(255,255,255,0.35)",
          backdropFilter: "blur(20px) saturate(1.6)",
          color: "#fff",
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          zIndex: 25,
        }}
      >
        {p.priceLabel}
      </div>

      {/* Info glass panel */}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 100,
          padding: 16,
          borderRadius: 20,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(24px) saturate(1.6)",
          color: "#fff",
          zIndex: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {p.name}
        </h2>
        <p style={{ margin: "6px 0 10px", fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.85)" }}>
          {p.description}
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {p.variants.map((v, i) => (
            <button
              key={v.id}
              type="button"
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 10,
                background: i === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.10)",
                color: i === 0 ? "#0B0F1A" : "#fff",
                border: `1px solid ${i === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.20)"}`,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", left: 12, right: 12, bottom: 22, zIndex: 20 }}>
        <button
          type="button"
          style={{
            width: "100%",
            minHeight: 56,
            borderRadius: 14,
            background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
            color: "#0B0F1A",
            border: "none",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            boxShadow: "0 12px 28px rgba(255,114,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          🛒 Add to cart
        </button>
      </div>

      <ChatFab />
    </div>
  );
}

// ---------------------------------------------------------------------
// 09 · Museum Poster · art gallery poster style · typographic label
// at the bottom · edition number treatment · deliberately quiet
// ---------------------------------------------------------------------

function D09MuseumPoster() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#EFECE6" }}>
      <StatusBar tint="rgba(50,50,50,0.85)" />
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#1a1a1a",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
          {p.seller}
        </div>
        <div style={{ fontSize: 10, letterSpacing: "0.10em", color: "#7a6a55" }}>
          {p.stackIndex + 1} / {p.stackTotal}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 88,
          left: 20,
          right: 20,
          bottom: 220,
          background: "#fff",
          padding: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
      >
        <img
          src={p.imageUrl}
          alt={p.imageAlt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Museum label */}
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 100,
          padding: "16px 18px",
          background: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 500,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                letterSpacing: "-0.005em",
              }}
            >
              {p.name}
            </h2>
            <div
              style={{
                marginTop: 2,
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "#7a6a55",
              }}
            >
              {p.seller}, {p.sellerLocation}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: "#3a2f24",
                fontStyle: "italic",
              }}
            >
              Pandan cream · toasted coconut · vanilla sponge
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{p.priceLabel}</div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 20, right: 20, bottom: 22 }}>
        <button
          type="button"
          style={{
            width: "100%",
            minHeight: 52,
            borderRadius: 0,
            background: "#1a1a1a",
            color: "#EFECE6",
            border: "none",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
          }}
        >
          Acquire
        </button>
      </div>

      <ChatFab color="#1a1a1a" ring="rgba(26,26,26,0.15)" />
    </div>
  );
}

// ---------------------------------------------------------------------
// 10 · Zen Minimal · massive whitespace · tiny centred product ·
// huge price · single CTA · confidence
// ---------------------------------------------------------------------

function D10ZenMinimal() {
  const p = SAMPLE_PRODUCT;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#FDFBF7", color: "#0B0F1A" }}>
      <StatusBar tint="rgba(50,50,50,0.85)" />
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#0B0F1A",
          }}
        >
          {p.seller}
        </span>
        <StackDots index={p.stackIndex} total={p.stackTotal} color="rgba(11,15,26,0.15)" activeColor="#0B0F1A" />
      </div>

      {/* Tiny centred image */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 180,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <img
          src={p.imageUrl}
          alt={p.imageAlt}
          style={{
            width: 200,
            height: 200,
            objectFit: "cover",
            borderRadius: "50%",
            boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
          }}
        />
      </div>

      {/* Product name */}
      <div
        style={{
          position: "absolute",
          top: 410,
          left: 20,
          right: 20,
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: "-0.005em",
          }}
        >
          {p.name}
        </h2>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#7a6a55",
          }}
        >
          {p.sellerLocation}
        </div>
      </div>

      {/* Big price */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 500,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 300,
            letterSpacing: "-0.03em",
            color: "#0B0F1A",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}
        >
          {p.priceLabel}
        </div>
      </div>

      <div style={{ position: "absolute", left: 24, right: 24, bottom: 24 }}>
        <button
          type="button"
          style={{
            width: "100%",
            minHeight: 60,
            borderRadius: 999,
            background: "#0B0F1A",
            color: "#FDFBF7",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
          }}
        >
          Order
        </button>
      </div>

      <ChatFab color="#0B0F1A" ring="rgba(11,15,26,0.15)" />
    </div>
  );
}
