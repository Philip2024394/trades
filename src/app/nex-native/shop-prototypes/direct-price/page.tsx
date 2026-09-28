// src/app/nex-native/shop-prototypes/direct-price/page.tsx
//
// NEX Direct Price · 5 prototype designs.
// ---------------------------------------
// Founder direction 2026-09-28. Replaces the voucher concept
// entirely with a simpler, more automatic system:
//
//   1 · TIER LOYALTY LADDER · discount rises with order count ·
//       every seller sets their own ladder + max cap ≤ 15% for
//       restaurants (still beats GoFood 20-25% commission).
//
//   2 · SHARE-TO-EARN · two badges under the header:
//       · "Share with a friend" · +5% for you + friend · 48hr
//       · "Share with a group"  · +7% for you + group  · 48hr
//
//   3 · "YOU SAVE VS TYPICAL DELIVERY APP" · every product shows
//       the comparison price + saving. Not marketing hype ·
//       just the maths of your 99k/month subscription vs
//       GoFood's 22% per-order commission.
//
// Every design below shows the same Priya's Bakery cake with the
// SAME sample data so visual differences are the only variable.
// All designs use NEX colours · dark navy #020914 · cyan #00AFFF
// · orange #FF7200.

import * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(3,16,29,0.94)",
  panelHi: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "rgba(125,155,192,0.65)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeStrong: "#FF9033",
  green: "#10B981",
  greenSoft: "rgba(16,185,129,0.16)",
};

const PRODUCT = {
  name: "Coconut Pandan Cake",
  seller: "Priya's Bakery",
  location: "Mumbai",
  imageUrl:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&h=1200&fit=crop",
  imageAlt: "Coconut pandan layer cake",
  tagline: "Baked fresh 5am · same-day pickup",
  priceLabel: "Rp 45,000",
  compareLabel: "Rp 60,000",
  compareChannel: "typical delivery app",
  savingLabel: "Rp 15,000",
  savingPct: 25,
  tier: {
    currentOrder: 4,
    currentDiscountPct: 5,
    nextOrder: 7,
    nextDiscountPct: 8,
  },
  capPct: 15,
  share: {
    friend: { sharerBonusPct: 5, receiverBonusPct: 5, expiryHours: 48 },
    group: { sharerBonusPct: 7, receiverBonusPct: 7, expiryHours: 48 },
  },
} as const;

const PHONE_W = 390;
const PHONE_H = 812;

const DESIGNS: ReadonlyArray<{
  id: string;
  title: string;
  tagline: string;
  render: () => React.JSX.Element;
}> = [
  { id: "D1", title: "Story Reel Refined", tagline: "Full-bleed hero · share chips + tier bar overlaid · swipe up to Order", render: () => <D1StoryReelRefined /> },
  { id: "D2", title: "Bottom Info Card", tagline: "Hero top 55% · dark commerce card bottom with everything visible", render: () => <D2BottomCard /> },
  { id: "D3", title: "Glass Chip Overlay", tagline: "Hero + floating frosted-glass chips · tier + share + save + price", render: () => <D3ChipOverlay /> },
  { id: "D4", title: "Vertical Rails", tagline: "Hero → cyan save-strip → share-strip → tier-strip → orange CTA", render: () => <D4VerticalRails /> },
  { id: "D5", title: "Compact HUD", tagline: "Everything on one screen · tier ring · share row · dense but readable", render: () => <D5CompactHUD /> },
  { id: "D6", title: "Swiss NEX", tagline: "Bauhaus grid · dark navy + cyan + orange · numbered tier ladder · typographic value", render: () => <D6SwissNEX /> },
];

export default function DirectPriceGallery() {
  return (
    <>
      <style>{`
        html, body { background: #05060B !important; }
        [data-nex-dp-root] * { box-sizing: border-box; }
      `}</style>
      <main
        data-nex-dp-root
        style={{
          minHeight: "100dvh",
          background: "#05060B",
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 20px 80px",
        }}
      >
        <header style={{ maxWidth: 1080, margin: "0 auto 32px" }}>
          <div style={{ marginBottom: 8 }}>
            <Link
              href="/nex-native/shop-prototypes"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: NEX.textSecondary,
                textDecoration: "none",
              }}
            >
              ← Back to shop prototypes
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
            NEX Direct Price · 5 prototypes
          </h1>
          <p
            style={{
              marginTop: 8,
              maxWidth: 660,
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textSecondary,
            }}
          >
            Vouchers retired. New pattern: (1) tier discount that grows
            with order count · (2) share-to-earn (+5% friend / +7%
            group, 48hr) · (3) "you save vs typical delivery app"
            ticker · seller-set cap (max 15% total on restaurants
            still beats GoFood's 22% commission). Every design shows
            the same sample product so visual differences are the only
            variable. All use NEX colours.
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
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ alignSelf: "stretch", padding: "0 8px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: NEX.textSecondary,
                    fontWeight: 700,
                  }}
                >
                  {d.id} · {d.title}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMute, lineHeight: 1.4 }}>
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

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W + 20,
        height: PHONE_H + 20,
        borderRadius: 42,
        background: NEX.panel,
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
          background: NEX.bg,
        }}
      >
        {children}
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
            background: NEX.panel,
            zIndex: 50,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Shared micro-components used across designs
// ---------------------------------------------------------------------

function SellerPill({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const bg = tone === "dark" ? "rgba(0,0,0,0.42)" : "rgba(255,255,255,0.14)";
  const fg = "#fff";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px 4px 4px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${NEX.cyanFaint}`,
        backdropFilter: "blur(10px)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${NEX.orangeStrong}, ${NEX.orange})`,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
        }}
      >
        🛍
      </span>
      <div style={{ lineHeight: 1.1, color: fg }}>
        <div style={{ fontSize: 11, fontWeight: 700 }}>{PRODUCT.seller}</div>
        <div style={{ fontSize: 9, opacity: 0.85 }}>📍 {PRODUCT.location}</div>
      </div>
    </div>
  );
}

function ShareChip({
  kind,
  bonusPct,
  compact = false,
}: {
  kind: "friend" | "group";
  bonusPct: number;
  compact?: boolean;
}) {
  const label = kind === "friend" ? "Share" : "Group";
  const icon = kind === "friend" ? "👤" : "👥";
  return (
    <button
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? "4px 8px" : "6px 10px",
        borderRadius: 999,
        background: "rgba(0,175,255,0.14)",
        border: `1px solid ${NEX.cyan}`,
        color: NEX.cyan,
        fontSize: compact ? 10 : 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        backdropFilter: "blur(10px)",
      }}
    >
      <span aria-hidden style={{ fontSize: compact ? 12 : 14 }}>{icon}</span>
      <span>{label} −{bonusPct}%</span>
    </button>
  );
}

function SavingsTicker({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <span style={{ fontSize: 11, color: NEX.green, fontWeight: 700, letterSpacing: "0.04em" }}>
        You save {PRODUCT.savingLabel} · {PRODUCT.savingPct}% off vs {PRODUCT.compareChannel}
      </span>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: NEX.greenSoft,
        border: `1px solid ${NEX.green}55`,
        color: NEX.green,
      }}
    >
      <span aria-hidden style={{ fontSize: 12 }}>💸</span>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em" }}>
          You save {PRODUCT.savingLabel} · {PRODUCT.savingPct}%
        </div>
        <div style={{ fontSize: 9, opacity: 0.85 }}>
          vs {PRODUCT.compareChannel} at {PRODUCT.compareLabel}
        </div>
      </div>
    </div>
  );
}

function TierProgress({
  variant = "bar",
}: {
  variant?: "bar" | "ring" | "pill";
}) {
  const t = PRODUCT.tier;
  const pct = (t.currentOrder / t.nextOrder) * 100;
  if (variant === "pill") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          borderRadius: 999,
          background: "rgba(255,114,0,0.12)",
          border: `1px solid ${NEX.orange}55`,
          color: NEX.orangeStrong,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden>🏆</span>
        <span>
          Order {t.currentOrder} · −{t.currentDiscountPct}% · next −{t.nextDiscountPct}% at {t.nextOrder}
        </span>
      </div>
    );
  }
  if (variant === "ring") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `conic-gradient(${NEX.orange} ${pct * 3.6}deg, rgba(255,114,0,0.14) ${pct * 3.6}deg)`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: NEX.panel, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: NEX.orangeStrong }}>
            −{t.currentDiscountPct}%
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, color: NEX.orange }}>
            Loyalty tier
          </div>
          <div style={{ fontSize: 11, color: NEX.textSecondary }}>
            Order {t.currentOrder} of {t.nextOrder} → −{t.nextDiscountPct}%
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: NEX.orange,
          marginBottom: 4,
        }}
      >
        <span>Tier · Order {t.currentOrder} · −{t.currentDiscountPct}%</span>
        <span style={{ color: NEX.textSecondary }}>Next −{t.nextDiscountPct}% at {t.nextOrder}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(255,114,0,0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${NEX.orangeStrong}, ${NEX.orange})`,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function CapNote({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const c = tone === "dark" ? NEX.textMute : "rgba(255,255,255,0.7)";
  return (
    <div style={{ fontSize: 9, letterSpacing: "0.08em", color: c }}>
      Max stack {PRODUCT.capPct}% · seller-set
    </div>
  );
}

// ---------------------------------------------------------------------
// D1 · Story Reel Refined · full-bleed hero + share chips + tier bar
// ---------------------------------------------------------------------

function D1StoryReelRefined() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: NEX.bg, color: "#fff" }}>
      <img
        src={PRODUCT.imageUrl}
        alt={PRODUCT.imageAlt}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0.55) 0%, rgba(2,9,20,0) 22%, rgba(2,9,20,0) 45%, rgba(2,9,20,0.85) 100%)",
        }}
      />
      {/* Top row · seller pill + × close */}
      <div style={{ position: "absolute", top: 44, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 20 }}>
        <SellerPill />
        <button type="button" aria-label="Close" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: 16, cursor: "pointer" }}>×</button>
      </div>
      {/* Share chips row · sits under the seller pill */}
      <div style={{ position: "absolute", top: 92, left: 12, right: 12, display: "flex", gap: 8, zIndex: 20 }}>
        <ShareChip kind="friend" bonusPct={PRODUCT.share.friend.sharerBonusPct} />
        <ShareChip kind="group" bonusPct={PRODUCT.share.group.sharerBonusPct} />
      </div>
      {/* Bottom overlay stack */}
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 96, zIndex: 20 }}>
        <SavingsTicker />
        <h1 style={{ margin: "10px 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 3px 16px rgba(0,0,0,0.85)" }}>
          {PRODUCT.name}
        </h1>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
          {PRODUCT.tagline}
        </div>
        <div style={{ marginTop: 10 }}>
          <TierProgress variant="bar" />
        </div>
        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <CapNote tone="light" />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: NEX.textMute, textDecoration: "line-through" }}>{PRODUCT.compareLabel}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: NEX.orange, letterSpacing: "-0.01em", textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}>
              {PRODUCT.priceLabel}
            </div>
          </div>
        </div>
      </div>
      {/* Swipe-up CTA */}
      <button type="button" style={{ position: "absolute", left: 12, right: 12, bottom: 20, height: 46, borderRadius: 10, background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`, color: "#0B0F1A", border: "none", fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", boxShadow: `0 12px 30px rgba(255,114,0,0.5)`, zIndex: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        ▲ Swipe up · Order
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// D2 · Bottom Info Card · hero top 55% · dark card bottom
// ---------------------------------------------------------------------

function D2BottomCard() {
  const t = PRODUCT.tier;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: NEX.bg, color: NEX.textPrimary }}>
      <div style={{ position: "relative", height: "52%" }}>
        <img src={PRODUCT.imageUrl} alt={PRODUCT.imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(2,9,20,0.45) 0%, rgba(2,9,20,0) 30%, rgba(2,9,20,0) 55%, rgba(2,9,20,1) 100%)" }} />
        <div style={{ position: "absolute", top: 44, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <SellerPill />
          <button type="button" aria-label="Close" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: "48%", bottom: 0, background: NEX.bg, padding: "0 18px 24px", display: "flex", flexDirection: "column" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.005em" }}>{PRODUCT.name}</h1>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textSecondary }}>{PRODUCT.tagline}</div>

        {/* Two-column price + comparison */}
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: NEX.panel, border: `1px solid ${NEX.cyanFaint}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: NEX.green, fontWeight: 800 }}>NEX Direct</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: NEX.orange, letterSpacing: "-0.02em", lineHeight: 1 }}>{PRODUCT.priceLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.textSecondary }}>{PRODUCT.compareChannel}</div>
            <div style={{ fontSize: 16, color: NEX.textSecondary, textDecoration: "line-through", letterSpacing: "-0.01em" }}>{PRODUCT.compareLabel}</div>
            <div style={{ fontSize: 10, color: NEX.green, fontWeight: 800, letterSpacing: "0.06em" }}>−{PRODUCT.savingLabel} · −{PRODUCT.savingPct}%</div>
          </div>
        </div>

        {/* Share badges · 2 cards */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["friend", "group"] as const).map((k) => {
            const bonus = k === "friend" ? PRODUCT.share.friend.sharerBonusPct : PRODUCT.share.group.sharerBonusPct;
            const label = k === "friend" ? "Share · friend" : "Share · group";
            const icon = k === "friend" ? "👤" : "👥";
            return (
              <button key={k} type="button" style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(0,175,255,0.10)", border: `1px solid ${NEX.cyan}`, color: NEX.cyan, textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 16 }}>{icon}</div>
                <div style={{ marginTop: 2, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 800 }}>{label}</div>
                <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: NEX.cyan, letterSpacing: "-0.01em" }}>−{bonus}%</div>
                <div style={{ marginTop: 1, fontSize: 9, color: NEX.textSecondary }}>you + they get −{bonus}% · 48hr</div>
              </button>
            );
          })}
        </div>

        {/* Tier progress bar */}
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: NEX.panel, border: `1px solid ${NEX.orange}44` }}>
          <TierProgress variant="bar" />
        </div>

        <div style={{ marginTop: "auto", paddingTop: 12 }}>
          <button type="button" style={{ width: "100%", minHeight: 52, borderRadius: 12, background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`, color: "#0B0F1A", border: "none", fontSize: 14, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer", boxShadow: `0 12px 26px rgba(255,114,0,0.45)` }}>
            🛒 Add to cart · {PRODUCT.priceLabel}
          </button>
          <div style={{ marginTop: 6, textAlign: "center", fontSize: 9, color: NEX.textMute, letterSpacing: "0.08em" }}>
            Max stack {PRODUCT.capPct}% · seller-set · applies at checkout
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// D3 · Glass Chip Overlay · hero + floating frosted-glass chips
// ---------------------------------------------------------------------

function D3ChipOverlay() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: NEX.bg, color: "#fff" }}>
      <img src={PRODUCT.imageUrl} alt={PRODUCT.imageAlt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(2,9,20,0.45) 0%, rgba(2,9,20,0) 25%, rgba(2,9,20,0) 40%, rgba(2,9,20,0.90) 100%)" }} />

      {/* Top row */}
      <div style={{ position: "absolute", top: 44, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 20 }}>
        <SellerPill />
        <button type="button" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: 16 }}>×</button>
      </div>

      {/* Mid-lower stack of glass chips */}
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 96, zIndex: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Save chip */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 12, background: "rgba(16,185,129,0.20)", border: `1px solid ${NEX.green}`, backdropFilter: "blur(14px) saturate(1.4)", alignSelf: "flex-start" }}>
          <span aria-hidden style={{ fontSize: 14 }}>💸</span>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: NEX.green, letterSpacing: "0.04em" }}>NEX Direct · save {PRODUCT.savingLabel}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.8)" }}>{PRODUCT.compareChannel} shows {PRODUCT.compareLabel} · −{PRODUCT.savingPct}%</div>
          </div>
        </div>

        {/* Share chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ShareChip kind="friend" bonusPct={PRODUCT.share.friend.sharerBonusPct} />
          <ShareChip kind="group" bonusPct={PRODUCT.share.group.sharerBonusPct} />
        </div>

        {/* Tier chip */}
        <div style={{ padding: "8px 12px", borderRadius: 12, background: "rgba(255,114,0,0.14)", border: `1px solid ${NEX.orange}88`, backdropFilter: "blur(12px)" }}>
          <TierProgress variant="bar" />
        </div>

        {/* Name + price row */}
        <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.55)", border: `1px solid ${NEX.cyanFaint}`, backdropFilter: "blur(14px)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.005em", color: "#fff" }}>{PRODUCT.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>{PRODUCT.tagline}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, textDecoration: "line-through", color: "rgba(255,255,255,0.55)" }}>{PRODUCT.compareLabel}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: NEX.orange, letterSpacing: "-0.01em" }}>{PRODUCT.priceLabel}</div>
          </div>
        </div>
      </div>

      <button type="button" style={{ position: "absolute", left: 12, right: 12, bottom: 20, height: 48, borderRadius: 12, background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`, color: "#0B0F1A", border: "none", fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: `0 12px 30px rgba(255,114,0,0.5)`, zIndex: 22 }}>
        🛒 Add to cart · Let's go
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// D4 · Vertical Rails · hero → colored strips → CTA
// ---------------------------------------------------------------------

function D4VerticalRails() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: NEX.bg, color: NEX.textPrimary, display: "flex", flexDirection: "column" }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 260, flexShrink: 0 }}>
        <img src={PRODUCT.imageUrl} alt={PRODUCT.imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(2,9,20,0.55) 0%, rgba(2,9,20,0) 40%, rgba(2,9,20,0.55) 100%)" }} />
        <div style={{ position: "absolute", top: 44, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <SellerPill />
          <button type="button" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: 16 }}>×</button>
        </div>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.85)" }}>{PRODUCT.name}</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>{PRODUCT.tagline}</div>
        </div>
      </div>

      {/* Save strip · green */}
      <div style={{ padding: "10px 18px", background: NEX.greenSoft, borderBottom: `1px solid ${NEX.green}55`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.green, fontWeight: 800 }}>NEX Direct Price</div>
          <div style={{ fontSize: 12, color: NEX.textPrimary }}>You save {PRODUCT.savingLabel} vs {PRODUCT.compareChannel}</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: NEX.green, letterSpacing: "-0.02em" }}>−{PRODUCT.savingPct}%</div>
      </div>

      {/* Share strip · cyan */}
      <div style={{ padding: "10px 18px", background: "rgba(0,175,255,0.08)", borderBottom: `1px solid ${NEX.cyan}44` }}>
        <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.cyan, fontWeight: 800, marginBottom: 8 }}>Share → save more</div>
        <div style={{ display: "flex", gap: 8 }}>
          <ShareChip kind="friend" bonusPct={PRODUCT.share.friend.sharerBonusPct} />
          <ShareChip kind="group" bonusPct={PRODUCT.share.group.sharerBonusPct} />
        </div>
      </div>

      {/* Tier strip · orange */}
      <div style={{ padding: "12px 18px", background: "rgba(255,114,0,0.08)", borderBottom: `1px solid ${NEX.orange}44` }}>
        <TierProgress variant="bar" />
      </div>

      {/* Price + CTA · pushes to bottom */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.textSecondary, fontWeight: 700 }}>{PRODUCT.compareChannel}</div>
            <div style={{ fontSize: 16, color: NEX.textSecondary, textDecoration: "line-through" }}>{PRODUCT.compareLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.green, fontWeight: 800 }}>NEX Direct</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: NEX.orange, letterSpacing: "-0.02em", lineHeight: 1 }}>{PRODUCT.priceLabel}</div>
          </div>
        </div>
        <button type="button" style={{ width: "100%", minHeight: 52, borderRadius: 12, background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`, color: "#0B0F1A", border: "none", fontSize: 14, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", boxShadow: `0 12px 26px rgba(255,114,0,0.45)` }}>
          🛒 Add to cart
        </button>
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <CapNote />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// D5 · Compact HUD · everything visible at once · dense but readable
// ---------------------------------------------------------------------

function D5CompactHUD() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: NEX.bg, color: NEX.textPrimary, display: "flex", flexDirection: "column" }}>
      {/* Hero smaller · leaves room for everything below */}
      <div style={{ position: "relative", height: 200, flexShrink: 0 }}>
        <img src={PRODUCT.imageUrl} alt={PRODUCT.imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(2,9,20,0.55) 0%, rgba(2,9,20,0) 40%, rgba(2,9,20,0.65) 100%)" }} />
        <div style={{ position: "absolute", top: 44, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <SellerPill />
          <button type="button" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: 16 }}>×</button>
        </div>
        <div style={{ position: "absolute", left: 16, bottom: 12, right: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.85)" }}>{PRODUCT.name}</h1>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>{PRODUCT.tagline}</div>
          </div>
        </div>
      </div>

      {/* Dense info panel · scrollable if needed */}
      <div style={{ flex: 1, padding: "12px 14px 14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Price + save · one row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.green, fontWeight: 800 }}>NEX Direct</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: NEX.orange, letterSpacing: "-0.02em", lineHeight: 1 }}>{PRODUCT.priceLabel}</div>
            </div>
            <div style={{ paddingBottom: 3 }}>
              <div style={{ fontSize: 12, color: NEX.textSecondary, textDecoration: "line-through" }}>{PRODUCT.compareLabel}</div>
              <div style={{ fontSize: 10, color: NEX.green, fontWeight: 800 }}>−{PRODUCT.savingPct}% · save {PRODUCT.savingLabel}</div>
            </div>
          </div>
          <TierProgress variant="ring" />
        </div>

        {/* Share row · 2 cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(["friend", "group"] as const).map((k) => {
            const bonus = k === "friend" ? PRODUCT.share.friend.sharerBonusPct : PRODUCT.share.group.sharerBonusPct;
            return (
              <button key={k} type="button" style={{ padding: "10px 12px", borderRadius: 10, background: NEX.panel, border: `1px solid ${NEX.cyan}88`, color: NEX.cyan, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,175,255,0.18)", display: "grid", placeItems: "center", fontSize: 16 }}>
                  {k === "friend" ? "👤" : "👥"}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 800 }}>Share · {k}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.01em", color: NEX.cyan }}>
                    +{bonus}% for you
                  </div>
                  <div style={{ fontSize: 9, color: NEX.textMute }}>+{bonus}% for them · 48hr</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cap note */}
        <div style={{ padding: "8px 12px", borderRadius: 10, background: NEX.panel, border: `1px solid ${NEX.cyanFaint}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: NEX.textSecondary, letterSpacing: "0.06em" }}>
            Tier + share stack up to <strong style={{ color: NEX.orange, fontSize: 13 }}>{PRODUCT.capPct}% off</strong>
          </div>
          <div style={{ fontSize: 9, color: NEX.textMute, letterSpacing: "0.06em" }}>
            seller-set · beats delivery apps
          </div>
        </div>

        {/* CTA row */}
        <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
          <button type="button" style={{ flex: 1, minHeight: 50, borderRadius: 12, background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`, color: "#0B0F1A", border: "none", fontSize: 13, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", boxShadow: `0 10px 24px rgba(255,114,0,0.45)` }}>
            🛒 Order · {PRODUCT.priceLabel}
          </button>
          <button type="button" aria-label="Chat" style={{ width: 50, height: 50, borderRadius: 12, background: NEX.panel, border: `1px solid ${NEX.cyan}`, color: NEX.cyan, fontSize: 20 }}>💬</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// D6 · Swiss NEX · Bauhaus discipline in NEX colours
// ---------------------------------------------------------------------
// Founder picked V16 (voucher-pages · Swiss Grid) as the visual
// language they want. This design applies that grammar to the
// direct-price system in NEX colours: dark navy bg, cyan +
// orange accents replacing V16's ivory + red, numbered tier
// ladder as the hero, hairline dividers between blocks, huge
// typographic value at the price row.
function D6SwissNEX() {
  const TIERS = [
    { order: 1, label: "New here", discount: "Normal" },
    { order: 2, label: "Getting to know us", discount: "−3%" },
    { order: 4, label: "Regular", discount: "−5%" },
    { order: 7, label: "We know your order", discount: "−8%" },
    { order: 12, label: "Member for life", discount: `−${PRODUCT.capPct}%` },
  ];
  const currentTierIndex = TIERS.findIndex((t) => t.order === PRODUCT.tier.currentOrder);
  const nextTierIndex = TIERS.findIndex((t) => t.order === PRODUCT.tier.nextOrder);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: NEX.bg, color: NEX.textPrimary, display: "flex", flexDirection: "column" }}>
      {/* Top strip · seller pill + × close · thick cyan rule beneath */}
      <div style={{ padding: "44px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${NEX.cyan}` }}>
        <SellerPill />
        <button type="button" aria-label="Close" style={{ width: 32, height: 32, borderRadius: "50%", background: NEX.panel, color: NEX.textPrimary, border: `1px solid ${NEX.cyanSoft}`, fontSize: 16, cursor: "pointer" }}>×</button>
      </div>

      {/* Bauhaus product headline · giant caps · tiny cyan supra-title */}
      <div style={{ padding: "16px 18px 12px" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 800, color: NEX.cyan }}>
          Vol. 06 / 26 · {PRODUCT.seller}
        </div>
        <h1 style={{ margin: "6px 0 4px", fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 0.95, textTransform: "uppercase", color: NEX.textPrimary }}>
          {PRODUCT.name}
        </h1>
        <div style={{ fontSize: 11, color: NEX.textSecondary, letterSpacing: "0.06em" }}>
          {PRODUCT.tagline}
        </div>
      </div>

      {/* Share row · disciplined 2-column boxed section */}
      <div style={{ margin: "0 18px", borderTop: `1px solid ${NEX.cyanFaint}`, borderBottom: `1px solid ${NEX.cyanFaint}`, padding: "10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {(["friend", "group"] as const).map((k) => {
          const bonus = k === "friend" ? PRODUCT.share.friend.sharerBonusPct : PRODUCT.share.group.sharerBonusPct;
          return (
            <button key={k} type="button" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: `1px solid ${NEX.cyan}`, color: NEX.cyan, cursor: "pointer", textAlign: "left" }}>
              <span aria-hidden style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em", color: NEX.cyan, lineHeight: 1, minWidth: 32, textAlign: "center" }}>
                −{bonus}%
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, color: NEX.cyan }}>Share · {k}</div>
                <div style={{ fontSize: 9, color: NEX.textSecondary, letterSpacing: "0.02em" }}>you + they · 48hr</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Loyalty ladder · numbered rows · hero of the page */}
      <div style={{ padding: "14px 18px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 6, borderBottom: `2px solid ${NEX.orange}`, marginBottom: 6 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 900, color: NEX.orange }}>
            Loyalty ladder
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: NEX.textSecondary, fontWeight: 700 }}>
            Max {PRODUCT.capPct}% · seller-set
          </div>
        </div>
        {TIERS.map((t, i) => {
          const isCurrent = i === currentTierIndex;
          const isNext = i === nextTierIndex;
          const isPast = i < currentTierIndex;
          const isLocked = i > currentTierIndex;
          const accent = isCurrent ? NEX.orange : isNext ? NEX.cyan : isPast ? NEX.textSecondary : NEX.textMute;
          return (
            <div key={t.order} style={{ display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i === TIERS.length - 1 ? "none" : `1px solid ${NEX.cyanFaint}`, opacity: isLocked && !isNext ? 0.5 : 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: accent, lineHeight: 1, textAlign: "left" }}>
                {String(t.order).padStart(2, "0")}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-0.005em", textTransform: "uppercase", color: isCurrent ? NEX.textPrimary : NEX.textSecondary }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.textMute, fontWeight: 700 }}>
                  {isCurrent ? "★ you are here" : isNext ? "next unlock" : isPast ? "done" : "locked"}
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em", color: accent }}>
                {t.discount}
              </div>
            </div>
          );
        })}
      </div>

      {/* Savings + price row · huge typographic value · Bauhaus rules */}
      <div style={{ marginTop: "auto", padding: "12px 18px 12px", borderTop: `1px solid ${NEX.cyan}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: NEX.textSecondary, fontWeight: 700 }}>
              {PRODUCT.compareChannel}
            </div>
            <div style={{ fontSize: 15, color: NEX.textSecondary, textDecoration: "line-through", letterSpacing: "-0.01em" }}>
              {PRODUCT.compareLabel}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: NEX.green, letterSpacing: "0.10em", textTransform: "uppercase", marginTop: 2 }}>
              −{PRODUCT.savingLabel} · −{PRODUCT.savingPct}%
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: NEX.orange, fontWeight: 900 }}>
              NEX Direct
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: NEX.orange, letterSpacing: "-0.03em", lineHeight: 0.95 }}>
              {PRODUCT.priceLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Square-edged CTA + chat · Bauhaus discipline */}
      <div style={{ padding: "0 18px 20px", display: "flex", gap: 8 }}>
        <button type="button" style={{ flex: 1, minHeight: 52, background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`, color: "#0B0F1A", border: "none", fontSize: 13, fontWeight: 900, letterSpacing: "0.20em", textTransform: "uppercase", cursor: "pointer", boxShadow: `0 10px 26px rgba(255,114,0,0.45)` }}>
          🛒 Order · {PRODUCT.priceLabel}
        </button>
        <button type="button" aria-label="Chat" style={{ width: 52, height: 52, background: NEX.panel, color: NEX.cyan, border: `1px solid ${NEX.cyan}`, fontSize: 20, cursor: "pointer" }}>
          💬
        </button>
      </div>
    </div>
  );
}
