// src/app/nex-native/shop-prototypes/voucher-pages/page.tsx
//
// Voucher-page · 6 design prototypes.
// -----------------------------------
// Founder direction 2026-09-28: the seller identity badge at the top
// of every product / menu swipe-page should be tappable · the tap
// destination is a shop-scoped VOUCHERS page showing coupons the
// buyer can redeem against orders.
//
// Every prototype below renders the same seller (Priya's Bakery)
// with the same 6 sample vouchers, so visual differences are the
// only variable. Phone frames match the main /shop-prototypes
// gallery aesthetic.

import * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

const SHOP = {
  name: "Priya's Bakery",
  location: "Mumbai",
} as const;

interface Voucher {
  readonly id: string;
  readonly title: string;
  readonly value: string;
  readonly code: string;
  readonly note: string;
  readonly expiresLabel: string;
  readonly status: "available" | "expiring" | "locked" | "used";
  /** For locked vouchers · optional progress bar */
  readonly progress?: { readonly current: number; readonly total: number };
}

const VOUCHERS: readonly Voucher[] = [
  {
    id: "first15",
    title: "First-order 15% off",
    value: "-15%",
    code: "FIRST15",
    note: "Applies to your first order · any product",
    expiresLabel: "Expires 30 Nov · 42 days left",
    status: "available",
  },
  {
    id: "cake10",
    title: "Rp 10k off any cake",
    value: "-10k",
    code: "CAKE10",
    note: "Coconut · truffle · sponge · birthday cakes",
    expiresLabel: "Expires 15 Oct · 3 days left",
    status: "expiring",
  },
  {
    id: "sat20",
    title: "Weekend special · 20% off",
    value: "-20%",
    code: "SAT20",
    note: "Saturday orders only · minimum Rp 50k",
    expiresLabel: "Every weekend · ongoing",
    status: "available",
  },
  {
    id: "loyal5",
    title: "Free small croissant",
    value: "FREE",
    code: "LOYAL5",
    note: "After 5 orders from this shop · we're keeping count",
    expiresLabel: "Progress · 3 of 5 orders",
    status: "locked",
    progress: { current: 3, total: 5 },
  },
  {
    id: "b2g1",
    title: "Buy 2 loaves · get 1 free",
    value: "B2G1",
    code: "B2G1",
    note: "Sourdough · country · seeded · mix and match",
    expiresLabel: "Expires 20 Nov · 32 days left",
    status: "available",
  },
  {
    id: "bday25",
    title: "Birthday 25% off",
    value: "-25%",
    code: "BDAY25",
    note: "Add your birthday to unlock",
    expiresLabel: "Locked · add birthday in profile",
    status: "locked",
  },
];

const PHONE_W = 390;
const PHONE_H = 812;

const DESIGNS: ReadonlyArray<{
  id: string;
  title: string;
  tagline: string;
  render: () => React.JSX.Element;
}> = [
  { id: "V1", title: "Ticket Stack", tagline: "Perforated coupon aesthetic · stacked tickets · playful", render: () => <V1TicketStack /> },
  { id: "V2", title: "Wallet Cards", tagline: "Apple Wallet-style pass stack · premium · easy to scan", render: () => <V2WalletCards /> },
  { id: "V3", title: "Scratch to Reveal", tagline: "Cards hide the discount until tapped · gamified reveal", render: () => <V3ScratchReveal /> },
  { id: "V4", title: "Neon Stamp", tagline: "Dark bg + neon-outlined vouchers · night-market energy", render: () => <V4NeonStamp /> },
  { id: "V5", title: "Editorial Coupon Book", tagline: "Kinfolk serif · minimal ivory paper · curated collection", render: () => <V5Editorial /> },
  { id: "V6", title: "Progress Ladder", tagline: "Tiered rewards · unlock more as you spend · gamification", render: () => <V6ProgressLadder /> },
  // 12 more · professional slant · added in the same gallery.
  { id: "V7", title: "Concierge Folio", tagline: "Hotel folio · dark navy + gold · serif titles · quiet luxury", render: () => <V7Concierge /> },
  { id: "V8", title: "Bank Statement", tagline: "Fintech clean · monospaced serials · ledger rows · Mercury/Revolut", render: () => <V8BankStatement /> },
  { id: "V9", title: "Boarding Pass", tagline: "Airline pass · perforated stub · GATE/FLIGHT/SEAT labels", render: () => <V9BoardingPass /> },
  { id: "V10", title: "Corporate Perks", tagline: "Enterprise HR grid · icons + status pills · Workday/Rippling", render: () => <V10CorporatePerks /> },
  { id: "V11", title: "Black Card", tagline: "Luxury membership · brushed metal + gold · member numbers", render: () => <V11BlackCard /> },
  { id: "V12", title: "Terminal", tagline: "Bloomberg density · mono · amber-on-black · dense tabular", render: () => <V12Terminal /> },
  { id: "V13", title: "Editorial Digest", tagline: "Serif newsletter · drop-cap numbers · hairline dividers", render: () => <V13EditorialDigest /> },
  { id: "V14", title: "Muji Neutral", tagline: "Japanese minimal · warm gray on ivory · quiet + spacious", render: () => <V14Muji /> },
  { id: "V15", title: "iOS Grouped", tagline: "System grouped rows · SF · chevrons · segmented top filter", render: () => <V15IOSGrouped /> },
  { id: "V16", title: "Swiss Grid", tagline: "Bauhaus · red accent · grid + geometric · typographic value", render: () => <V16SwissGrid /> },
  { id: "V17", title: "Notion Database", tagline: "Table-view rows · tag chips · productivity tool aesthetic", render: () => <V17Notion /> },
  { id: "V18", title: "Aesop Apothecary", tagline: "Product labels · numbered No. 01 · beige + serif · luxe", render: () => <V18Aesop /> },
];

export default function VoucherPagesGallery() {
  return (
    <>
      <style>{`
        html, body { background: #05060B !important; }
        [data-nex-voucher-proto-root] * { box-sizing: border-box; }
      `}</style>
      <main
        data-nex-voucher-proto-root
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
              href="/nex-native/shop-prototypes"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#7D9BC0",
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
            Voucher page · 6 prototypes
          </h1>
          <p
            style={{
              marginTop: 8,
              maxWidth: 640,
              fontSize: 13,
              lineHeight: 1.55,
              color: "#8BA9D1",
            }}
          >
            Tap the seller identity pill on any product swipe-page →
            open shop-scoped vouchers. Every design below shows the
            same 6 sample vouchers from Priya's Bakery (available ·
            expiring · locked · progress) so visual differences are
            the only variable. Pick a direction, then we wire it to
            the real backend.
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
// Shared header · shop identity + back button. Every design uses this
// so the seller anchor stays consistent.
// ---------------------------------------------------------------------

function ShopHeader({
  tint = "#F4F7FC",
  accent = "#FF7200",
  subtle = "rgba(255,255,255,0.65)",
  bg = "transparent",
}: {
  tint?: string;
  accent?: string;
  subtle?: string;
  bg?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: 16,
        right: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 20,
        background: bg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
            display: "grid",
            placeItems: "center",
            fontSize: 20,
          }}
        >
          🛍
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.15,
              color: tint,
            }}
          >
            {SHOP.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: subtle,
              letterSpacing: "0.06em",
            }}
          >
            📍 {SHOP.location} · Vouchers
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close vouchers"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.30)",
          color: tint,
          border: `1px solid ${subtle}55`,
          fontSize: 18,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// V1 · Ticket Stack · perforated paper coupons · nostalgic
// ---------------------------------------------------------------------

function V1TicketStack() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(180deg, #F3E9D8 0%, #EADBBC 100%)",
        position: "relative",
        overflow: "hidden",
        color: "#2A1F12",
      }}
    >
      <ShopHeader tint="#2A1F12" accent="#B7481B" subtle="#5B4A34" />
      <div
        style={{
          position: "absolute",
          top: 104,
          left: 16,
          right: 16,
          bottom: 20,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 20,
        }}
      >
        {VOUCHERS.map((v) => (
          <Ticket key={v.id} v={v} />
        ))}
      </div>
    </div>
  );
}

function Ticket({ v }: { v: Voucher }) {
  const isDim = v.status === "used" || v.status === "locked";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        borderRadius: 12,
        background: "#FDF7E6",
        boxShadow:
          "0 4px 14px rgba(150,110,60,0.20), 0 0 0 1px rgba(120,80,20,0.18)",
        opacity: isDim ? 0.55 : 1,
        minHeight: 84,
      }}
    >
      <div
        style={{
          width: 78,
          flexShrink: 0,
          background: v.status === "expiring" ? "#B7481B" : "#3B2A18",
          color: "#FDF7E6",
          display: "grid",
          placeItems: "center",
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
          padding: "8px 4px",
          textAlign: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
            }}
          >
            {v.value}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 8,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {v.status === "expiring" ? "3 days" : "voucher"}
          </div>
        </div>
      </div>
      {/* Perforation */}
      <div
        aria-hidden
        style={{
          width: 12,
          background:
            "repeating-linear-gradient(180deg, transparent 0 4px, #F3E9D8 4px 8px)",
          borderLeft: "1px dashed rgba(58,42,24,0.35)",
          borderRight: "1px dashed rgba(58,42,24,0.35)",
        }}
      />
      <div style={{ flex: 1, padding: "10px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.005em" }}>
          {v.title}
        </div>
        <div style={{ marginTop: 3, fontSize: 10.5, color: "#5B4A34", lineHeight: 1.35 }}>
          {v.note}
        </div>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: v.status === "expiring" ? "#B7481B" : "#5B4A34",
              fontWeight: 700,
            }}
          >
            {v.expiresLabel}
          </span>
          {v.status === "available" || v.status === "expiring" ? (
            <button
              type="button"
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                background: "#B7481B",
                color: "#FDF7E6",
                border: "none",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Apply →
            </button>
          ) : (
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#5B4A34",
                fontWeight: 700,
              }}
            >
              {v.status === "locked" ? "🔒 Locked" : "Used"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V2 · Wallet Cards · Apple Wallet-style pass stack
// ---------------------------------------------------------------------

function V2WalletCards() {
  const palettes = [
    { bg: "linear-gradient(135deg, #4A0F0F, #B7481B)", accent: "#FFC97C" },
    { bg: "linear-gradient(135deg, #12283A, #0B4F6C)", accent: "#00E5FF" },
    { bg: "linear-gradient(135deg, #2A0E44, #A02CB6)", accent: "#FF69B4" },
    { bg: "linear-gradient(135deg, #1B1B1B, #4C4C4C)", accent: "#F5D742" },
    { bg: "linear-gradient(135deg, #0D3D1A, #189A44)", accent: "#B7FFC0" },
    { bg: "linear-gradient(135deg, #3A1F00, #A05E20)", accent: "#FFE082" },
  ];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#050810",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
      }}
    >
      <ShopHeader />
      <div
        style={{
          position: "absolute",
          top: 104,
          left: 12,
          right: 12,
          bottom: 20,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingBottom: 20,
        }}
      >
        {VOUCHERS.map((v, i) => (
          <WalletCard key={v.id} v={v} palette={palettes[i % palettes.length]!} />
        ))}
      </div>
    </div>
  );
}

function WalletCard({ v, palette }: { v: Voucher; palette: { bg: string; accent: string } }) {
  const isDim = v.status === "used" || v.status === "locked";
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        padding: "16px 18px",
        background: palette.bg,
        color: "#fff",
        boxShadow:
          "0 10px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
        opacity: isDim ? 0.55 : 1,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `${palette.accent}22`,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: palette.accent,
              opacity: 0.9,
            }}
          >
            {SHOP.name}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.005em",
            }}
          >
            {v.title}
          </div>
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: palette.accent,
            textShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        >
          {v.value}
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.4,
        }}
      >
        {v.note}
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <span style={{ opacity: 0.85 }}>{v.expiresLabel}</span>
        {(v.status === "available" || v.status === "expiring") && (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: palette.accent,
              color: "#0B0F1A",
            }}
          >
            Apply →
          </span>
        )}
        {v.status === "locked" && <span>🔒 Locked</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V3 · Scratch to Reveal · teaser cards you tap to reveal the code
// ---------------------------------------------------------------------

function V3ScratchReveal() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(60% 45% at 50% 20%, rgba(255,114,0,0.20), transparent 60%), #050810",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
      }}
    >
      <ShopHeader />
      <div
        style={{
          position: "absolute",
          top: 104,
          left: 12,
          right: 12,
          bottom: 20,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          paddingBottom: 20,
        }}
      >
        {VOUCHERS.map((v, i) => (
          <ScratchCard key={v.id} v={v} scratched={i === 1 || i === 4} />
        ))}
      </div>
    </div>
  );
}

function ScratchCard({ v, scratched }: { v: Voucher; scratched: boolean }) {
  const isLocked = v.status === "locked";
  return (
    <div
      style={{
        aspectRatio: "1 / 1.2",
        borderRadius: 16,
        padding: 12,
        position: "relative",
        overflow: "hidden",
        background: scratched
          ? "linear-gradient(135deg, #FF9033, #FF7200)"
          : "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
        border: scratched
          ? "1px solid rgba(255,255,255,0.35)"
          : "1px solid rgba(255,255,255,0.14)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: scratched ? "#0B0F1A" : "#fff",
        opacity: isLocked ? 0.55 : 1,
      }}
    >
      {!scratched && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontSize: 34,
            opacity: 0.35,
          }}
        >
          {isLocked ? "🔒" : "🎁"}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 800,
            opacity: 0.85,
          }}
        >
          {scratched ? "Revealed" : isLocked ? "Locked" : "Tap to reveal"}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.005em",
          }}
        >
          {v.title}
        </div>
      </div>
      <div style={{ position: "relative", textAlign: "right" }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            filter: scratched ? "none" : "blur(6px)",
          }}
        >
          {v.value}
        </div>
        {scratched && (
          <button
            type="button"
            style={{
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 8,
              background: "#0B0F1A",
              color: "#fff",
              border: "none",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Apply →
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V4 · Neon Stamp · dark bg + neon outlined vouchers · night market
// ---------------------------------------------------------------------

function V4NeonStamp() {
  const neonPink = "#FF3F9F";
  const neonCyan = "#00E5FF";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #0B0316 0%, #1a0729 100%)",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <ShopHeader tint={neonCyan} accent={neonPink} subtle="rgba(0,229,255,0.75)" />
      <div
        style={{
          position: "absolute",
          top: 104,
          left: 12,
          right: 12,
          bottom: 20,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 20,
        }}
      >
        {VOUCHERS.map((v, i) => (
          <NeonVoucher
            key={v.id}
            v={v}
            neon={i % 2 === 0 ? neonPink : neonCyan}
          />
        ))}
      </div>
    </div>
  );
}

function NeonVoucher({ v, neon }: { v: Voucher; neon: string }) {
  const isDim = v.status === "used" || v.status === "locked";
  return (
    <div
      style={{
        position: "relative",
        padding: "12px 14px",
        border: `2px solid ${neon}`,
        borderRadius: 14,
        background: "rgba(0,0,0,0.30)",
        boxShadow: `0 0 18px ${neon}55, inset 0 0 18px ${neon}22`,
        opacity: isDim ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: neon,
          textShadow: `0 0 8px ${neon}, 0 0 14px ${neon}88`,
          flexShrink: 0,
          minWidth: 68,
          textAlign: "center",
        }}
      >
        {v.value}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.02em",
            color: "#fff",
            textShadow: `0 0 8px ${neon}66`,
          }}
        >
          {v.title.toUpperCase()}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 10.5,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.35,
          }}
        >
          {v.note}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: neon,
            fontWeight: 700,
          }}
        >
          {v.expiresLabel}
        </div>
      </div>
      {(v.status === "available" || v.status === "expiring") && (
        <button
          type="button"
          style={{
            padding: "6px 10px",
            borderRadius: 4,
            background: neon,
            color: "#0B0316",
            border: "none",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: `0 0 12px ${neon}`,
            flexShrink: 0,
          }}
        >
          Apply →
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// V5 · Editorial Coupon Book · serif · ivory paper · quiet
// ---------------------------------------------------------------------

function V5Editorial() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#F7F3EC",
        position: "relative",
        overflow: "hidden",
        color: "#1a1a1a",
      }}
    >
      <ShopHeader tint="#1a1a1a" accent="#8b7355" subtle="#7a6a55" />
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 22,
          right: 22,
          bottom: 20,
          overflowY: "auto",
          paddingBottom: 20,
        }}
      >
        <div
          style={{
            marginBottom: 20,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#a08966",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Coupon Book · Issue 03
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {VOUCHERS.map((v, i) => (
            <EditorialCoupon key={v.id} v={v} number={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorialCoupon({ v, number }: { v: Voucher; number: number }) {
  const isDim = v.status === "used" || v.status === "locked";
  return (
    <div style={{ opacity: isDim ? 0.55 : 1 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderTop: "1px solid rgba(58,47,36,0.20)",
          paddingTop: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: "#a08966",
              fontWeight: 700,
            }}
          >
            No. {String(number).padStart(2, "0")}
          </div>
          <h3
            style={{
              margin: "6px 0 4px",
              fontSize: 22,
              fontWeight: 500,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}
          >
            {v.title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#5B4A34",
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            {v.note}
          </p>
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: "#1a1a1a",
            flexShrink: 0,
            paddingLeft: 12,
          }}
        >
          {v.value}
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#7a6a55",
          }}
        >
          {v.expiresLabel}
        </span>
        {(v.status === "available" || v.status === "expiring") && (
          <button
            type="button"
            style={{
              padding: "6px 14px",
              borderRadius: 0,
              background: "#1a1a1a",
              color: "#F7F3EC",
              border: "none",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V6 · Progress Ladder · tiered rewards · spend more, unlock more
// ---------------------------------------------------------------------

function V6ProgressLadder() {
  const tiers = [
    { label: "Order 1", unlocked: true, voucher: VOUCHERS[0]! },
    { label: "Order 3", unlocked: true, voucher: VOUCHERS[1]! },
    { label: "Order 5", unlocked: false, voucher: VOUCHERS[3]! },
    { label: "Order 10", unlocked: false, voucher: VOUCHERS[4]! },
    { label: "Birthday", unlocked: false, voucher: VOUCHERS[5]! },
  ];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #0B1220 0%, #050810 100%)",
        position: "relative",
        overflow: "hidden",
        color: "#F4F7FC",
      }}
    >
      <ShopHeader />
      <div
        style={{
          position: "absolute",
          top: 104,
          left: 16,
          right: 16,
          bottom: 20,
          overflowY: "auto",
          paddingBottom: 20,
        }}
      >
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(255,114,0,0.14), rgba(255,114,0,0.04))",
            border: "1px solid rgba(255,114,0,0.35)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#FFB989",
              fontWeight: 800,
            }}
          >
            Your progress
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 22,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.01em",
            }}
          >
            3 orders · 2 more to unlock
          </div>
          <div
            style={{
              marginTop: 10,
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.10)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "60%",
                height: "100%",
                background: "linear-gradient(90deg, #FF7200, #FF9033)",
                borderRadius: 999,
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tiers.map((t, i) => (
            <TierRow key={i} label={t.label} unlocked={t.unlocked} voucher={t.voucher} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TierRow({ label, unlocked, voucher }: { label: string; unlocked: boolean; voucher: Voucher }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: unlocked ? "rgba(0,175,255,0.10)" : "rgba(255,255,255,0.04)",
        border: unlocked ? "1px solid rgba(0,175,255,0.35)" : "1px solid rgba(255,255,255,0.10)",
        opacity: unlocked ? 1 : 0.72,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: unlocked ? "linear-gradient(135deg, #00AFFF, #0080BF)" : "rgba(255,255,255,0.08)",
          color: unlocked ? "#0B0F1A" : "rgba(255,255,255,0.55)",
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          fontWeight: 900,
          border: unlocked ? "none" : "1px dashed rgba(255,255,255,0.20)",
        }}
      >
        {unlocked ? "✓" : "🔒"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 800,
            color: unlocked ? "#00AFFF" : "rgba(255,255,255,0.55)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.005em",
          }}
        >
          {voucher.title}
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
          {voucher.value} · {voucher.expiresLabel}
        </div>
      </div>
      {unlocked && (
        <button
          type="button"
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "#00AFFF",
            color: "#0B0F1A",
            border: "none",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Apply →
        </button>
      )}
    </div>
  );
}

// =====================================================================
// 12 additional professional-slant prototypes (V7-V18)
// =====================================================================

// ---------------------------------------------------------------------
// V7 · Concierge Folio · dark navy + gold + serif · quiet luxury
// ---------------------------------------------------------------------
function V7Concierge() {
  const gold = "#C9A24C";
  const bg = "#0C1A2E";
  return (
    <div style={{ width: "100%", height: "100%", background: bg, position: "relative", overflow: "hidden", color: "#EFE7D4" }}>
      <ShopHeader tint="#EFE7D4" accent={gold} subtle="rgba(239,231,212,0.65)" />
      <div style={{ position: "absolute", top: 104, left: 22, right: 22, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.30em", textTransform: "uppercase", color: gold, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>
          — In-house folio —
        </div>
        {VOUCHERS.map((v, i) => {
          const isDim = v.status === "used" || v.status === "locked";
          const isLast = i === VOUCHERS.length - 1;
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "flex-start", padding: "16px 0", borderBottom: isLast ? "none" : "1px solid rgba(201,162,76,0.25)", opacity: isDim ? 0.5 : 1 }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase", color: gold, fontWeight: 700 }}>
                  {v.status === "expiring" ? "Priority" : v.status === "locked" ? "Reserved" : "Available"}
                </div>
                <h3 style={{ margin: "6px 0 4px", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.15 }}>
                  {v.title}
                </h3>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(239,231,212,0.7)", lineHeight: 1.5, fontStyle: "italic" }}>
                  {v.note}
                </p>
                <div style={{ marginTop: 6, fontSize: 9, letterSpacing: "0.12em", color: "rgba(239,231,212,0.55)" }}>
                  {v.expiresLabel}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 30, fontWeight: 500, color: gold, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {v.value}
                </div>
                {(v.status === "available" || v.status === "expiring") && (
                  <button type="button" style={{ marginTop: 10, padding: "6px 14px", background: "transparent", border: `1px solid ${gold}`, color: gold, fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer" }}>
                    Redeem
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V8 · Bank Statement · fintech clean · Mercury/Revolut aesthetic
// ---------------------------------------------------------------------
function V8BankStatement() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#FCFCFB", position: "relative", overflow: "hidden", color: "#0B0F1A" }}>
      <ShopHeader tint="#0B0F1A" accent="#0057FF" subtle="rgba(11,15,26,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 16, right: 16, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px 12px", borderBottom: "1px solid #E6E7EA" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6B7280", fontWeight: 700 }}>Credits available</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6B7280" }}>Balance · {VOUCHERS.filter((v) => v.status !== "used").length}</div>
        </div>
        {VOUCHERS.map((v) => {
          const dim = v.status === "used" || v.status === "locked";
          const green = v.status === "available";
          const amber = v.status === "expiring";
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", padding: "14px 4px", borderBottom: "1px solid #EEF0F3", opacity: dim ? 0.5 : 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: green ? "#E3F5E4" : amber ? "#FFF2E0" : "#F1F2F4", color: green ? "#0F7D22" : amber ? "#A65A00" : "#6B7280", display: "grid", placeItems: "center", fontSize: 15, marginRight: 12, flexShrink: 0 }}>
                {green ? "↓" : amber ? "!" : "◔"}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0B0F1A", letterSpacing: "-0.005em" }}>{v.title}</div>
                <div style={{ marginTop: 2, fontSize: 11, color: "#6B7280", fontFamily: "ui-monospace, monospace" }}>{v.code} · {v.expiresLabel.split("·")[0]?.trim()}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: green ? "#0F7D22" : amber ? "#A65A00" : "#6B7280", fontFamily: "ui-monospace, monospace" }}>{v.value}</div>
                {(green || amber) && (
                  <button type="button" style={{ marginTop: 4, padding: "3px 10px", borderRadius: 6, background: "#0057FF", color: "#fff", border: "none", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>
                    Apply →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V9 · Boarding Pass · airline-style with perforated stub
// ---------------------------------------------------------------------
function V9BoardingPass() {
  const palettes = ["#DA291C", "#003399", "#7A1A2F", "#004225", "#B7481B", "#4A0E4E"];
  return (
    <div style={{ width: "100%", height: "100%", background: "#F5EFE4", position: "relative", overflow: "hidden", color: "#1A1A1A" }}>
      <ShopHeader tint="#1A1A1A" accent="#DA291C" subtle="rgba(26,26,26,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 12, right: 12, bottom: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>
        {VOUCHERS.map((v, i) => {
          const accent = palettes[i % palettes.length]!;
          const dim = v.status === "used" || v.status === "locked";
          return (
            <div key={v.id} style={{ display: "flex", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", opacity: dim ? 0.55 : 1 }}>
              <div style={{ flex: 1, padding: "12px 14px" }}>
                <div style={{ height: 4, background: accent, borderRadius: 999, marginBottom: 10 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase", color: "#6B7280", fontWeight: 700 }}>
                  <span>Voucher</span>
                  <span>Code · {v.code}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>{v.title}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6B7280", fontWeight: 700 }}>Value</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: accent, letterSpacing: "-0.02em" }}>{v.value}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6B7280", fontWeight: 700 }}>Valid</div>
                    <div style={{ fontSize: 11, color: "#1A1A1A", fontWeight: 600 }}>{v.expiresLabel.split("·")[0]?.trim()}</div>
                  </div>
                </div>
              </div>
              <div aria-hidden style={{ width: 10, background: "repeating-linear-gradient(180deg, transparent 0 4px, #F5EFE4 4px 8px)", borderLeft: "1px dashed #C7BFAF", borderRight: "1px dashed #C7BFAF" }} />
              <div style={{ width: 80, padding: "12px 8px", background: accent, color: "#fff", display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.85, fontWeight: 700 }}>Apply</div>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>{v.value}</div>
                  <div style={{ marginTop: 6, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.75 }}>
                    {v.status === "available" ? "Ready" : v.status === "expiring" ? "Now" : v.status === "locked" ? "Locked" : "Used"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V10 · Corporate Perks · enterprise HR grid · Workday/Rippling
// ---------------------------------------------------------------------
function V10CorporatePerks() {
  const tints = [
    { bg: "#EAF2FF", fg: "#0057FF" },
    { bg: "#FFF3E5", fg: "#B7481B" },
    { bg: "#E6F7EF", fg: "#0A7A44" },
    { bg: "#F3E9FF", fg: "#5A21A1" },
    { bg: "#FFE9EC", fg: "#B02445" },
    { bg: "#E5F5F8", fg: "#0C6E85" },
  ];
  return (
    <div style={{ width: "100%", height: "100%", background: "#F5F6F8", position: "relative", overflow: "hidden", color: "#0B0F1A" }}>
      <ShopHeader tint="#0B0F1A" accent="#0057FF" subtle="rgba(11,15,26,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 12, right: 12, bottom: 20, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 20 }}>
        {VOUCHERS.map((v, i) => {
          const t = tints[i % tints.length]!;
          const dim = v.status === "used" || v.status === "locked";
          return (
            <div key={v.id} style={{ padding: 14, background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(11,15,26,0.06)", border: "1px solid #E6E8EC", opacity: dim ? 0.55 : 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 160 }}>
              <div>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: t.bg, color: t.fg, display: "grid", placeItems: "center", fontSize: 16, marginBottom: 10 }}>
                  🎁
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0B0F1A", lineHeight: 1.2, letterSpacing: "-0.005em" }}>{v.title}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#6B7280", lineHeight: 1.35 }}>{v.note}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 800, background: t.bg, color: t.fg }}>
                  {v.value}
                </span>
                {(v.status === "available" || v.status === "expiring") && (
                  <button type="button" aria-label="Apply" style={{ width: 28, height: 28, borderRadius: "50%", background: "#0057FF", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}>→</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V11 · Black Card · luxury metallic · gold text · member numbers
// ---------------------------------------------------------------------
function V11BlackCard() {
  const finishes = [
    { bg: "linear-gradient(135deg, #0F0F0F, #1A1A1A)", edge: "#C9A24C" },
    { bg: "linear-gradient(135deg, #0A0A0A, #2A2A2A)", edge: "#B8B8B8" },
    { bg: "linear-gradient(135deg, #050505, #151515)", edge: "#7C5AB8" },
    { bg: "linear-gradient(135deg, #0F0F0F, #1A1A1A)", edge: "#C9A24C" },
    { bg: "linear-gradient(135deg, #0A0A0A, #2A2A2A)", edge: "#B8B8B8" },
    { bg: "linear-gradient(135deg, #050505, #151515)", edge: "#7C5AB8" },
  ];
  return (
    <div style={{ width: "100%", height: "100%", background: "#0A0A0A", position: "relative", overflow: "hidden", color: "#EFE7D4" }}>
      <ShopHeader tint="#EFE7D4" accent="#C9A24C" subtle="rgba(239,231,212,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 16, right: 16, bottom: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>
        {VOUCHERS.map((v, i) => {
          const f = finishes[i % finishes.length]!;
          const dim = v.status === "used" || v.status === "locked";
          return (
            <div key={v.id} style={{ position: "relative", padding: 18, borderRadius: 14, background: f.bg, boxShadow: `0 12px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`, border: `1px solid ${f.edge}44`, opacity: dim ? 0.55 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.30em", textTransform: "uppercase", color: f.edge, fontWeight: 700 }}>
                    {SHOP.name}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 500, color: "#EFE7D4", fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: "-0.005em" }}>
                    {v.title}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, color: f.edge, fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: "-0.02em" }}>
                  {v.value}
                </div>
              </div>
              <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(239,231,212,0.55)", fontWeight: 700 }}>Member</div>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: f.edge, letterSpacing: "0.10em" }}>
                    04 · 892 · {String(1000 + i * 137).padStart(4, "0")}
                  </div>
                </div>
                {(v.status === "available" || v.status === "expiring") && (
                  <button type="button" style={{ padding: "6px 14px", background: f.edge, color: "#0A0A0A", border: "none", borderRadius: 2, fontSize: 9, fontWeight: 800, letterSpacing: "0.20em", textTransform: "uppercase", cursor: "pointer" }}>
                    Redeem
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V12 · Terminal · Bloomberg-style dense mono · amber-on-black
// ---------------------------------------------------------------------
function V12Terminal() {
  const amber = "#F5A623";
  const green = "#4CFF7A";
  const red = "#FF5C4C";
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", position: "relative", overflow: "hidden", color: amber, fontFamily: "ui-monospace, monospace" }}>
      <ShopHeader tint={amber} accent={amber} subtle={`${amber}88`} />
      <div style={{ position: "absolute", top: 104, left: 10, right: 10, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "58px 1fr 44px 42px", gap: 6, padding: "6px 4px", borderBottom: `1px solid ${amber}44`, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: `${amber}AA` }}>
          <span>CODE</span><span>DESCRIPTION</span><span style={{ textAlign: "right" }}>VAL</span><span style={{ textAlign: "right" }}>EXP</span>
        </div>
        {VOUCHERS.map((v) => {
          const dim = v.status === "used" || v.status === "locked";
          const c = v.status === "available" ? green : v.status === "expiring" ? red : v.status === "locked" ? `${amber}66` : `${amber}44`;
          return (
            <div key={v.id} style={{ display: "grid", gridTemplateColumns: "58px 1fr 44px 42px", gap: 6, padding: "10px 4px", borderBottom: `1px solid ${amber}22`, fontSize: 11, opacity: dim ? 0.55 : 1 }}>
              <span style={{ color: c, fontWeight: 700 }}>{v.code}</span>
              <span style={{ color: amber, letterSpacing: "-0.01em" }}>{v.title.toUpperCase()}</span>
              <span style={{ textAlign: "right", color: c, fontWeight: 700 }}>{v.value}</span>
              <span style={{ textAlign: "right", color: `${amber}AA`, fontSize: 9 }}>{v.status === "expiring" ? "3D" : v.status === "locked" ? "🔒" : v.status === "used" ? "USED" : "42D"}</span>
              {(v.status === "available" || v.status === "expiring") && (
                <button type="button" style={{ gridColumn: "1 / -1", marginTop: 6, padding: "4px 8px", background: "transparent", border: `1px solid ${c}`, color: c, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
                  ► Apply {v.code}
                </button>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 12, padding: "8px 4px", borderTop: `1px solid ${amber}44`, fontSize: 9, color: `${amber}88`, letterSpacing: "0.10em" }}>
          NEX/VCH.API · LIVE · {VOUCHERS.filter((v) => v.status === "available").length} READY
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V13 · Editorial Digest · newsletter · serif · drop-cap numbers
// ---------------------------------------------------------------------
function V13EditorialDigest() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#F3EEE4", position: "relative", overflow: "hidden", color: "#1F1912" }}>
      <ShopHeader tint="#1F1912" accent="#7A2B1F" subtle="#7A6A55" />
      <div style={{ position: "absolute", top: 100, left: 22, right: 22, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ textAlign: "center", padding: "12px 0 20px", borderBottom: "2px solid #1F1912" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", fontWeight: 700, color: "#7A6A55" }}>Vol. VII</div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1 }}>The Vouchers Digest</div>
          <div style={{ marginTop: 4, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "#7A6A55" }}>{SHOP.name} · Oct edition</div>
        </div>
        {VOUCHERS.map((v, i) => {
          const dim = v.status === "used" || v.status === "locked";
          return (
            <article key={v.id} style={{ padding: "18px 0", borderBottom: "1px solid rgba(31,25,18,0.20)", opacity: dim ? 0.55 : 1 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 48, lineHeight: 0.9, color: "#7A2B1F", fontWeight: 500, letterSpacing: "-0.04em", flexShrink: 0 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.1 }}>{v.title}</h3>
                  <p style={{ margin: "6px 0 6px", fontSize: 12, fontStyle: "italic", color: "#5B4A34", lineHeight: 1.5 }}>{v.note}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7A2B1F", fontWeight: 700 }}>{v.value} · {v.code}</span>
                    {(v.status === "available" || v.status === "expiring") && (
                      <button type="button" style={{ padding: "5px 12px", background: "transparent", border: "1px solid #1F1912", color: "#1F1912", fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer" }}>
                        Read →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V14 · Muji Neutral · Japanese minimal · warm gray on ivory
// ---------------------------------------------------------------------
function V14Muji() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#FAF9F5", position: "relative", overflow: "hidden", color: "#3B372E" }}>
      <ShopHeader tint="#3B372E" accent="#8A8378" subtle="rgba(59,55,46,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 22, right: 22, bottom: 20, overflowY: "auto", paddingBottom: 20, display: "flex", flexDirection: "column", gap: 22 }}>
        {VOUCHERS.map((v) => {
          const dim = v.status === "used" || v.status === "locked";
          return (
            <div key={v.id} style={{ opacity: dim ? 0.55 : 1 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "#8A8378", fontWeight: 500, fontFamily: "ui-monospace, monospace" }}>
                {v.code}
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.005em" }}>{v.title}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#3B372E", letterSpacing: "-0.01em", flexShrink: 0 }}>{v.value}</div>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#6D665A", lineHeight: 1.5 }}>{v.note}</div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#8A8378" }}>{v.expiresLabel}</span>
                {(v.status === "available" || v.status === "expiring") && (
                  <button type="button" style={{ padding: "6px 14px", background: "#3B372E", color: "#FAF9F5", border: "none", fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", cursor: "pointer" }}>
                    Apply
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V15 · iOS Grouped · system rows · SF · segmented top filter
// ---------------------------------------------------------------------
function V15IOSGrouped() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#F2F2F7", position: "relative", overflow: "hidden", color: "#000", fontFamily: "-apple-system, 'SF Pro Text', BlinkMacSystemFont, sans-serif" }}>
      <ShopHeader tint="#000" accent="#007AFF" subtle="rgba(0,0,0,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 12, right: 12, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ display: "flex", background: "#E4E4EC", borderRadius: 9, padding: 3, marginBottom: 18 }}>
          {["All", "Available", "Locked", "Used"].map((tab, i) => (
            <div key={tab} style={{ flex: 1, textAlign: "center", padding: "5px 0", borderRadius: 7, background: i === 0 ? "#fff" : "transparent", boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,0.10)" : "none", fontSize: 12, fontWeight: 600, color: "#000" }}>
              {tab}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, letterSpacing: "-0.01em", color: "#6B6B70", padding: "0 16px 6px", textTransform: "uppercase", fontWeight: 500 }}>{SHOP.name} · vouchers</div>
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden" }}>
          {VOUCHERS.map((v, i) => {
            const dim = v.status === "used" || v.status === "locked";
            const isLast = i === VOUCHERS.length - 1;
            const tint = v.status === "available" ? "#34C759" : v.status === "expiring" ? "#FF9500" : "#8E8E93";
            return (
              <div key={v.id} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: isLast ? "none" : "0.5px solid #C6C6C8", opacity: dim ? 0.55 : 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: tint, color: "#fff", display: "grid", placeItems: "center", fontSize: 15, marginRight: 12, flexShrink: 0 }}>🎁</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#000", letterSpacing: "-0.01em" }}>{v.title}</div>
                  <div style={{ fontSize: 12, color: "#8E8E93" }}>{v.value} · {v.expiresLabel.split("·")[0]?.trim()}</div>
                </div>
                <span style={{ color: "#C6C6C8", fontSize: 16, marginLeft: 6 }}>›</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#6B6B70", padding: "0 16px", lineHeight: 1.4 }}>
          Tap any voucher to apply. Locked vouchers unlock as you order more from {SHOP.name}.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V16 · Swiss Grid · Bauhaus · red accent · typographic value
// ---------------------------------------------------------------------
function V16SwissGrid() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#FBFBF7", position: "relative", overflow: "hidden", color: "#101010" }}>
      <ShopHeader tint="#101010" accent="#E4002B" subtle="rgba(16,16,16,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 20, right: 20, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ paddingBottom: 12, marginBottom: 16, borderBottom: "3px solid #101010", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, textTransform: "uppercase" }}>Vouchers</div>
          <div style={{ fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", color: "#E4002B", fontWeight: 700 }}>Vol. 06 / 26</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {VOUCHERS.map((v, i) => {
            const dim = v.status === "used" || v.status === "locked";
            return (
              <div key={v.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px", gap: 10, padding: "12px 0", borderBottom: "1px solid #101010", opacity: dim ? 0.55 : 1, alignItems: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#E4002B", letterSpacing: "-0.04em", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{v.title}</div>
                  <div style={{ marginTop: 3, fontSize: 10, color: "#565656", letterSpacing: "0.02em", textTransform: "uppercase", fontWeight: 700 }}>{v.expiresLabel.split("·")[0]?.trim()} · {v.code}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", color: "#101010" }}>{v.value}</div>
                {(v.status === "available" || v.status === "expiring") && (
                  <button type="button" style={{ gridColumn: "1 / -1", marginTop: 6, padding: "8px 12px", background: "#E4002B", color: "#FBFBF7", border: "none", fontSize: 10, fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer" }}>
                    APPLY  →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V17 · Notion Database · table-view rows + tag chips
// ---------------------------------------------------------------------
function V17Notion() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#FBFAF8", position: "relative", overflow: "hidden", color: "#37352F" }}>
      <ShopHeader tint="#37352F" accent="#0369A1" subtle="rgba(55,53,47,0.55)" />
      <div style={{ position: "absolute", top: 104, left: 16, right: 16, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ padding: "0 4px 8px", borderBottom: "1px solid #E9E9E7", display: "grid", gridTemplateColumns: "20px 1fr 60px 60px", gap: 8, fontSize: 10, color: "#78756E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span></span><span>Title</span><span>Value</span><span>Status</span>
        </div>
        {VOUCHERS.map((v) => {
          const dim = v.status === "used" || v.status === "locked";
          const chip = v.status === "available" ? { bg: "#DAF1E1", fg: "#0F7D3C" } : v.status === "expiring" ? { bg: "#FFE6C7", fg: "#A65A00" } : v.status === "locked" ? { bg: "#E6E6E4", fg: "#78756E" } : { bg: "#E6E6E4", fg: "#78756E" };
          return (
            <div key={v.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr 60px 60px", gap: 8, padding: "10px 4px", borderBottom: "1px solid #EEEDEB", alignItems: "center", opacity: dim ? 0.7 : 1 }}>
              <span style={{ fontSize: 14 }}>🎁</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#37352F", textDecoration: dim ? "line-through" : "none", letterSpacing: "-0.005em" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "#78756E", fontFamily: "ui-monospace, monospace" }}>{v.code}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{v.value}</div>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: chip.bg, color: chip.fg, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", whiteSpace: "nowrap" }}>
                {v.status}
              </span>
            </div>
          );
        })}
        <div style={{ marginTop: 12, padding: "6px 4px", color: "#78756E", fontSize: 11 }}>+ New voucher</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// V18 · Aesop Apothecary · numbered product-label · beige + serif
// ---------------------------------------------------------------------
function V18Aesop() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#E8E4DA", position: "relative", overflow: "hidden", color: "#2A251E" }}>
      <ShopHeader tint="#2A251E" accent="#5B4A34" subtle="rgba(42,37,30,0.55)" />
      <div style={{ position: "absolute", top: 100, left: 22, right: 22, bottom: 20, overflowY: "auto", paddingBottom: 20 }}>
        <div style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.36em", textTransform: "uppercase", color: "#5B4A34", fontWeight: 500, marginBottom: 24 }}>
          — Discount labels · a collection —
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {VOUCHERS.map((v, i) => {
            const dim = v.status === "used" || v.status === "locked";
            return (
              <div key={v.id} style={{ padding: "18px 20px", background: "#F5F1E8", border: "1px solid rgba(42,37,30,0.15)", opacity: dim ? 0.55 : 1 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.30em", textTransform: "uppercase", color: "#5B4A34", fontWeight: 500 }}>No. {String(i + 1).padStart(2, "0")}</div>
                <div style={{ marginTop: 10, fontSize: 18, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.15 }}>{v.title}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#5B4A34", lineHeight: 1.55, fontStyle: "italic" }}>{v.note}</div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(42,37,30,0.15)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase", color: "#5B4A34", fontWeight: 500 }}>Value</div>
                    <div style={{ fontSize: 24, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, letterSpacing: "-0.02em", color: "#2A251E" }}>{v.value}</div>
                  </div>
                  {(v.status === "available" || v.status === "expiring") && (
                    <button type="button" style={{ padding: "6px 16px", background: "#2A251E", color: "#F5F1E8", border: "none", fontSize: 10, fontWeight: 500, letterSpacing: "0.30em", cursor: "pointer" }}>
                      Apply
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
