// src/app/nex-native/shop-prototypes/direct-price/share-banner/page.tsx
//
// Landscape share-banner · 4 prototype designs.
// ---------------------------------------------
// Founder direction 2026-09-29:
//   "the shared banner should be landscape and have image and text of
//    place and maybe text like - This looks great · i thought you might
//    appreciate the discount reward example"
//
// Context · when a user taps "Share with friend" or "Share with group"
// on a product's direct-price card, the message that lands in the
// recipient's NEX chat is a LANDSCAPE banner (roughly 16:10) with:
//   · Product image (left)
//   · Shop identity (name + location)
//   · Product name + price
//   · Personal note from the sharer (editable at compose time)
//   · Discount reward for the RECIPIENT (+5% friend / +7% group · 48hr)
//
// Sharing is NEX-INTERNAL ONLY (peer chats + group chats) · never
// external device share sheet · never sharable to the same contact or
// group twice within 7 days (enforced by nex_product_share_grant table
// in Bridge 49b).
//
// Every banner sits inside a chat-bubble frame so it reads exactly as
// it would in the recipient's actual chat feed. Same sample product
// across all 4 designs.

import * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
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
};

const SHARE = {
  productName: "Coconut Pandan Cake",
  productPrice: "Rp 45,000",
  productImage:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=400&fit=crop",
  shopName: "Priya's Bakery",
  shopLocation: "Mumbai",
  personalNote: "This looks great · thought you might appreciate the reward 🎂",
  senderName: "Aisha",
  senderAvatar:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop",
  discountForReceiver: 5,
  shareType: "friend" as "friend" | "group",
  expiryHours: 48,
} as const;

const PHONE_W = 390;
const BUBBLE_W = 320;

const DESIGNS: ReadonlyArray<{
  id: string;
  title: string;
  tagline: string;
  render: () => React.JSX.Element;
}> = [
  { id: "B1", title: "Image-Left Classic", tagline: "Landscape image left · text stack right · discount as bottom strip", render: () => <B1ImageLeft /> },
  { id: "B2", title: "Photo Card with Note", tagline: "Full-bleed image top · glass note + reward pill bottom overlay", render: () => <B2PhotoCard /> },
  { id: "B3", title: "Editorial Banner", tagline: "Serif title · image right · reward called out as gift chip", render: () => <B3Editorial /> },
  { id: "B4", title: "Swiss NEX Banner", tagline: "Bauhaus discipline · dark navy · typographic reward · numbered", render: () => <B4SwissNEX /> },
];

export default function ShareBannerGallery() {
  return (
    <>
      <style>{`
        html, body { background: #05060B !important; }
        [data-nex-share-root] * { box-sizing: border-box; }
      `}</style>
      <main
        data-nex-share-root
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
              href="/nex-native/shop-prototypes/direct-price"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: NEX.textSecondary,
                textDecoration: "none",
              }}
            >
              ← Back to Direct Price prototypes
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Share Banner · 4 prototypes
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
            When a NEX user taps "Share with friend" or "Share with group"
            on a product's Direct Price card, THIS is what lands in the
            recipient's chat. Landscape banner · product image + shop
            identity + personal note + reward for the receiver. Sharing
            is NEX-only (peer chats + groups) · never external. Same
            contact/group can't be shared to twice in 7 days.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
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
              <ChatFrame>{d.render()}</ChatFrame>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------
// ChatFrame · shows the banner INSIDE a mocked NEX chat feed so the
// founder sees exactly what the recipient sees.
// ---------------------------------------------------------------------

function ChatFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W + 20,
        borderRadius: 32,
        background: NEX.panel,
        padding: 20,
        boxShadow:
          "0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(139,169,209,0.18)",
      }}
    >
      {/* Peer identity strip · mocks the peer chat header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px 14px",
          borderBottom: `1px solid ${NEX.cyanFaint}`,
          marginBottom: 16,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            overflow: "hidden",
            background: NEX.cyanFaint,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SHARE.senderAvatar}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div style={{ lineHeight: 1.15, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: NEX.textPrimary }}>
            {SHARE.senderName}
          </div>
          <div style={{ fontSize: 10, color: NEX.textSecondary }}>NEX peer chat</div>
        </div>
        <span style={{ fontSize: 10, color: NEX.textMute }}>2:04 pm</span>
      </div>

      {/* Incoming bubble · left-aligned · contains the share banner */}
      <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 4px" }}>
        <div
          style={{
            width: BUBBLE_W,
            maxWidth: "100%",
            borderRadius: 16,
            overflow: "hidden",
            background: NEX.panelHi,
            border: `1px solid ${NEX.cyanFaint}`,
            boxShadow: "0 6px 16px rgba(0,0,0,0.45)",
          }}
        >
          {children}
        </div>
      </div>

      {/* Reply prompt · mocks the composer beneath */}
      <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 999, background: NEX.panelHi, border: `1px solid ${NEX.cyanFaint}`, color: NEX.textMute, fontSize: 11 }}>
        Type a reply…
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// B1 · Image-Left Classic
// Landscape · square image left · text stack right · reward strip
// at the bottom.
// ---------------------------------------------------------------------

function B1ImageLeft() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", height: 140 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SHARE.productImage}
          alt=""
          style={{ width: 140, height: 140, objectFit: "cover", flexShrink: 0 }}
        />
        <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, color: NEX.cyan }}>
              🛍 {SHARE.shopName}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: NEX.textPrimary, marginTop: 4, lineHeight: 1.15 }}>
              {SHARE.productName}
            </div>
            <div style={{ fontSize: 10, color: NEX.textSecondary, marginTop: 2 }}>
              📍 {SHARE.shopLocation}
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: NEX.orange, letterSpacing: "-0.01em" }}>
            {SHARE.productPrice}
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 12px", background: NEX.panel, borderTop: `1px solid ${NEX.cyanFaint}`, fontSize: 12, color: NEX.textPrimary, fontStyle: "italic", lineHeight: 1.4 }}>
        "{SHARE.personalNote}"
      </div>
      <div style={{ padding: "8px 12px", background: "linear-gradient(90deg, rgba(255,114,0,0.20), rgba(255,114,0,0.10))", borderTop: `1px solid rgba(255,114,0,0.35)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: NEX.orange, fontWeight: 800 }}>
          🎁 Your reward · −{SHARE.discountForReceiver}% off
        </div>
        <div style={{ fontSize: 9, color: NEX.textMute, letterSpacing: "0.06em" }}>
          {SHARE.expiryHours}hr window
        </div>
      </div>
      <button type="button" style={{ padding: "10px 12px", background: NEX.orange, color: "#0B0F1A", border: "none", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", textAlign: "center" }}>
        Open product →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// B2 · Photo Card with Note
// Full-bleed image top · glass note + reward pill overlaid on bottom.
// Feels more social / Instagram-ish.
// ---------------------------------------------------------------------

function B2PhotoCard() {
  return (
    <div>
      <div style={{ position: "relative", height: 200 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SHARE.productImage}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)" }} />
        {/* Top pill · shop identity */}
        <div style={{ position: "absolute", top: 10, left: 10, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(0,0,0,0.55)", border: `1px solid ${NEX.cyanFaint}`, backdropFilter: "blur(10px)" }}>
          <span aria-hidden style={{ fontSize: 12 }}>🛍</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
            {SHARE.shopName} · {SHARE.shopLocation}
          </span>
        </div>
        {/* Bottom text · overlaid */}
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.85)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            {SHARE.productName}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: NEX.orange, letterSpacing: "-0.01em", marginTop: 2 }}>
            {SHARE.productPrice}
          </div>
        </div>
      </div>
      <div style={{ padding: 12, background: NEX.panelHi, borderTop: `1px solid ${NEX.cyanFaint}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 12, color: NEX.textPrimary, fontStyle: "italic", lineHeight: 1.4, flex: 1 }}>
            "{SHARE.personalNote}"
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "rgba(255,114,0,0.14)", border: `1px solid rgba(255,114,0,0.45)` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: NEX.orange, letterSpacing: "0.06em" }}>
            🎁 You get −{SHARE.discountForReceiver}% off · {SHARE.expiryHours}hr
          </div>
          <span style={{ fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: NEX.textMute, fontWeight: 700 }}>
            Direct Price
          </span>
        </div>
        <button type="button" style={{ marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 8, background: NEX.orange, color: "#0B0F1A", border: "none", fontSize: 12, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer" }}>
          🛒 Open · claim reward
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// B3 · Editorial Banner
// Serif title on the left · image right · reward as a gift chip.
// Reads more like a curated recommendation card.
// ---------------------------------------------------------------------

function B3Editorial() {
  return (
    <div>
      <div style={{ display: "flex", background: "#F5EFE4", color: "#1F1912", height: 150 }}>
        <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 700, color: "#7A6A55" }}>
              A recommendation
            </div>
            <div style={{ marginTop: 4, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 500, lineHeight: 1.05, letterSpacing: "-0.005em" }}>
              {SHARE.productName}
            </div>
            <div style={{ marginTop: 3, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: "#7A2B1F" }}>
              {SHARE.shopName} · {SHARE.shopLocation}
            </div>
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", color: "#1F1912" }}>
            {SHARE.productPrice}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SHARE.productImage}
          alt=""
          style={{ width: 140, height: 150, objectFit: "cover", flexShrink: 0 }}
        />
      </div>
      <div style={{ padding: "12px 14px", background: NEX.panelHi }}>
        <p style={{ margin: 0, fontSize: 12, color: NEX.textPrimary, fontStyle: "italic", lineHeight: 1.5, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          "{SHARE.personalNote}"
        </p>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, background: "rgba(255,114,0,0.12)", border: `1px solid rgba(255,114,0,0.35)` }}>
          <span aria-hidden style={{ fontSize: 20 }}>🎁</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: NEX.orange, letterSpacing: "0.04em" }}>
              A gift from {SHARE.senderName}
            </div>
            <div style={{ fontSize: 10, color: NEX.textSecondary }}>
              −{SHARE.discountForReceiver}% off if you order in {SHARE.expiryHours} hours
            </div>
          </div>
        </div>
        <button type="button" style={{ marginTop: 10, width: "100%", padding: "10px 12px", background: "#1F1912", color: "#F5EFE4", border: "none", fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer" }}>
          Open product
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// B4 · Swiss NEX Banner
// Bauhaus discipline · numbered · dark navy · cyan + orange · aligns
// with the D6 Swiss NEX product page. Same visual family.
// ---------------------------------------------------------------------

function B4SwissNEX() {
  return (
    <div style={{ background: NEX.bg }}>
      <div style={{ display: "flex", height: 130 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SHARE.productImage}
          alt=""
          style={{ width: 130, height: 130, objectFit: "cover", flexShrink: 0 }}
        />
        <div style={{ flex: 1, padding: "10px 12px", borderLeft: `2px solid ${NEX.cyan}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 900, color: NEX.cyan }}>
              🛍 {SHARE.shopName}
            </div>
            <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1.05, color: NEX.textPrimary }}>
              {SHARE.productName}
            </div>
            <div style={{ marginTop: 2, fontSize: 9, color: NEX.textSecondary, letterSpacing: "0.06em" }}>
              📍 {SHARE.shopLocation}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: NEX.orange, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {SHARE.productPrice}
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 12px", borderTop: `1px solid ${NEX.cyanFaint}` }}>
        <div style={{ fontSize: 12, color: NEX.textPrimary, fontStyle: "italic", lineHeight: 1.4 }}>
          "{SHARE.personalNote}"
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, padding: "10px 12px", borderTop: `2px solid ${NEX.orange}`, alignItems: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", color: NEX.orange, lineHeight: 1 }}>
          −{SHARE.discountForReceiver}%
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 900, color: NEX.orange }}>
            Your reward
          </div>
          <div style={{ fontSize: 10, color: NEX.textSecondary, letterSpacing: "0.02em" }}>
            Order within {SHARE.expiryHours}hr · sent by {SHARE.senderName}
          </div>
        </div>
      </div>
      <button type="button" style={{ width: "100%", padding: "12px", background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`, color: "#0B0F1A", border: "none", fontSize: 11, fontWeight: 900, letterSpacing: "0.20em", textTransform: "uppercase", cursor: "pointer" }}>
        Open · claim reward
      </button>
    </div>
  );
}
