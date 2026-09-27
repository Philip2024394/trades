"use client";

// src/app/nex-native/[businessSlug]/_hero-side-panel.tsx
//
// Vertical icon panel docked on the right side of the shop hero
// image. Three icons that open full-screen overlays:
//   · About us         · seller story + description
//   · Order placement  · how ordering works · payment · pickup
//   · SafeTrade        · NEX SafeTrade explainer · platform doctrine
//
// Sealed 2026-09-27.

import * as React from "react";
import { createPortal } from "react-dom";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
};

type PanelKind = "about" | "order" | "safetrade";

interface Props {
  businessName: string;
  businessDescription: string | null;
  address: string | null;
  acceptsCod: boolean;
  acceptsPickup: boolean;
  paymentInstructions: string | null;
  /** Ships-to reach · surfaces in the About + Order overlays so
   *  visitors know whether they can buy from this seller. */
  marketReach: "both" | "export_only" | "local_only";
}

export function HeroSidePanel({
  businessName,
  businessDescription,
  address,
  acceptsCod,
  acceptsPickup,
  paymentInstructions,
  marketReach,
}: Props) {
  const [open, setOpen] = React.useState<PanelKind | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <style>{`
        @keyframes nex-hero-panel-slide {
          from { opacity: 0; transform: translate(6px, -50%); }
          to   { opacity: 1; transform: translate(0, -50%); }
        }
        @keyframes nex-hero-overlay-in {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes nex-hero-fade { from { opacity: 0 } to { opacity: 1 } }
        [data-nex-hero-overlay-scroll] { scrollbar-width: none; }
        [data-nex-hero-overlay-scroll]::-webkit-scrollbar {
          display: none; width: 0; height: 0;
        }
      `}</style>

      {/* Vertical rail · docked to the right side of the hero at
          vertical center · black background, white icons. */}
      <div
        role="toolbar"
        aria-label="Shop info panels"
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 6,
          background: "rgba(0,0,0,0.72)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 22,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
          zIndex: 3,
          animation:
            "nex-hero-panel-slide 320ms cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        <PanelButton
          onClick={() => setOpen("about")}
          ariaLabel="About the seller"
        >
          <InfoIcon />
        </PanelButton>
        <PanelButton
          onClick={() => setOpen("order")}
          ariaLabel="How ordering works"
        >
          <PackageIcon />
        </PanelButton>
        <PanelButton
          onClick={() => setOpen("safetrade")}
          ariaLabel="NEX SafeTrade info"
        >
          <ShieldIcon />
        </PanelButton>
      </div>

      {/* Full-screen overlays · portaled to body */}
      {open && mounted &&
        createPortal(
          <OverlayFrame
            title={overlayTitle(open)}
            eyebrow={overlayEyebrow(open)}
            onClose={() => setOpen(null)}
          >
            {open === "about" && (
              <AboutContent
                businessName={businessName}
                businessDescription={businessDescription}
                address={address}
                marketReach={marketReach}
              />
            )}
            {open === "order" && (
              <OrderContent
                businessName={businessName}
                acceptsCod={acceptsCod}
                acceptsPickup={acceptsPickup}
                paymentInstructions={paymentInstructions}
                marketReach={marketReach}
              />
            )}
            {open === "safetrade" && <SafeTradeContent />}
          </OverlayFrame>,
          document.body,
        )}
    </>
  );
}

function overlayTitle(k: PanelKind): string {
  return k === "about"
    ? "About"
    : k === "order"
      ? "Order Placement"
      : "SafeTrade";
}
function overlayEyebrow(k: PanelKind): string {
  return k === "about"
    ? "Meet the seller"
    : k === "order"
      ? "How ordering works"
      : "NEX SafeTrade";
}

function PanelButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "#FF7200",
        border: "1px solid rgba(255,255,255,0.16)",
        color: "#0B0F1A",
        padding: 0,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        boxShadow:
          "0 4px 10px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
        transition: "transform 120ms ease, filter 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = "brightness(1.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "none";
      }}
    >
      {children}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Overlay frame · full-screen with 16px padding on every side
 * ──────────────────────────────────────────────────────────────── */

function OverlayFrame({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        role="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.82)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 1100,
          animation: "nex-hero-fade 200ms ease-out both",
        }}
      />
      {/* Frame · fills the viewport minus 16px margin */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          inset: 16,
          background: NEX.bg,
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 22,
          zIndex: 1101,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "nex-hero-overlay-in 260ms cubic-bezier(.2,.7,.2,1) both",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.005em",
              }}
            >
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: NEX.text,
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scroll body */}
        <div
          data-nex-hero-overlay-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 22px 28px",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
 * ABOUT
 * ──────────────────────────────────────────────────────────────── */

function ReachBulletList({
  marketReach,
}: {
  marketReach: "both" | "export_only" | "local_only";
}) {
  const local = marketReach === "both" || marketReach === "local_only";
  const exp = marketReach === "both" || marketReach === "export_only";
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <ReachBulletRow label="Ships to local buyers" on={local} />
      <ReachBulletRow label="Ships internationally (export)" on={exp} />
    </ul>
  );
}

function ReachBulletRow({ label, on }: { label: string; on: boolean }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: on ? "rgba(244,247,252,0.94)" : "rgba(139,169,209,0.55)",
        textDecoration: on ? "none" : "line-through",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: on ? "#16D66B" : "rgba(255,255,255,0.12)",
          color: on ? "#0B0F1A" : "rgba(255,255,255,0.6)",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
          boxShadow: on ? "0 4px 10px rgba(22,214,107,0.35)" : "none",
        }}
      >
        {on ? "✓" : "×"}
      </span>
      <span>{label}</span>
    </li>
  );
}

function AboutContent({
  businessName,
  businessDescription,
  address,
  marketReach,
}: {
  businessName: string;
  businessDescription: string | null;
  address: string | null;
  marketReach: "both" | "export_only" | "local_only";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          {businessName}
        </h3>
        {address && (
          <div
            style={{
              fontSize: 12,
              color: NEX.textDim,
              letterSpacing: "0.02em",
            }}
          >
            📍 {address}
          </div>
        )}
      </div>

      <ReachBulletList marketReach={marketReach} />

      {businessDescription ? (
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.65,
            color: "rgba(244,247,252,0.9)",
            whiteSpace: "pre-wrap",
          }}
        >
          {businessDescription}
        </p>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          The seller hasn&apos;t written an about page yet. Start a chat
          — every question is welcome.
        </p>
      )}

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: "rgba(0,175,255,0.06)",
          border: "1px solid rgba(0,175,255,0.24)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          On NEX
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(244,247,252,0.85)",
          }}
        >
          NEX is where sellers and buyers meet in a single conversation.
          No feeds, no ads, no algorithm. Every message becomes part of
          your history with this seller — questions, negotiations,
          receipts, aftercare.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * ORDER PLACEMENT
 * ──────────────────────────────────────────────────────────────── */

function OrderContent({
  businessName,
  acceptsCod,
  acceptsPickup,
  paymentInstructions,
  marketReach,
}: {
  businessName: string;
  acceptsCod: boolean;
  acceptsPickup: boolean;
  paymentInstructions: string | null;
  marketReach: "both" | "export_only" | "local_only";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.65,
          color: "rgba(244,247,252,0.9)",
        }}
      >
        Ordering on NEX happens in the same chat you use to ask about
        pieces. No cart, no checkout page — just a conversation with{" "}
        <span style={{ color: NEX.orange, fontWeight: 700 }}>
          {businessName}
        </span>
        .
      </p>

      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <OrderStep n={1} title="Tap a product">
          Open any product card, tap <b>Order Now</b> or{" "}
          <b>I want this</b>.
        </OrderStep>
        <OrderStep n={2} title="Confirm details in chat">
          The seller replies with availability, condition notes, and
          shipping options. Ask anything.
        </OrderStep>
        <OrderStep n={3} title="Pick a payment method">
          Bank transfer, e-wallet, cash on delivery — whichever the
          seller supports. NEX doesn&apos;t take a cut.
        </OrderStep>
        <OrderStep n={4} title="Arrange delivery or pickup">
          Courier, meet-up, or drop-off. The chat holds the full record
          for both sides.
        </OrderStep>
      </ol>

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: "rgba(6,15,28,0.72)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Ships to
        </div>
        <div style={{ marginBottom: 14 }}>
          <ReachBulletList marketReach={marketReach} />
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          This seller accepts
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <AcceptChip label="Bank transfer" on />
          <AcceptChip label="E-wallet (GoPay · DANA · OVO)" on />
          <AcceptChip label="Cash on delivery" on={acceptsCod} />
          <AcceptChip label="Local pickup" on={acceptsPickup} />
        </div>
        {paymentInstructions && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              lineHeight: 1.55,
              color: "rgba(244,247,252,0.8)",
              whiteSpace: "pre-wrap",
            }}
          >
            {paymentInstructions}
          </p>
        )}
      </div>
    </div>
  );
}

function OrderStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "34px 1fr",
        gap: 12,
        alignItems: "start",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#FF7200",
          color: "#0B0F1A",
          fontSize: 13,
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 4px 12px rgba(255,114,0,0.35)",
        }}
      >
        {n}
      </div>
      <div style={{ paddingTop: 3 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(244,247,252,0.8)",
          }}
        >
          {children}
        </div>
      </div>
    </li>
  );
}

function AcceptChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        border: on
          ? "1px solid rgba(22,214,107,0.5)"
          : "1px solid rgba(255,255,255,0.14)",
        background: on
          ? "rgba(22,214,107,0.12)"
          : "rgba(255,255,255,0.04)",
        color: on ? "#B8F1CC" : NEX.textMute,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textDecoration: on ? "none" : "line-through",
      }}
    >
      {label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────
 * SAFETRADE
 * ──────────────────────────────────────────────────────────────── */

function SafeTradeContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Identity + one-line frame */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background:
              "linear-gradient(135deg, rgba(22,214,107,0.35), rgba(0,175,255,0.28))",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "grid",
            placeItems: "center",
            color: "#FFFFFF",
          }}
        >
          <ShieldIcon />
        </div>
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.005em",
            }}
          >
            NEX Center Safe Trade
          </div>
          <div
            style={{
              fontSize: 11,
              color: NEX.textDim,
              letterSpacing: "0.02em",
            }}
          >
            Optional protection for buyers
          </div>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.65,
          color: "rgba(244,247,252,0.92)",
        }}
      >
        <b>NEX Center Safe Trade</b> is an <b>optional service</b>{" "}
        available to buyers who want their order physically inspected
        before the supplier receives payment.
      </p>

      {/* Explicit fee-payer callout · the whole reason this exists */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(255,114,0,0.10)",
          border: "1px solid rgba(255,114,0,0.45)",
          fontSize: 13,
          color: "rgba(244,247,252,0.94)",
          lineHeight: 1.6,
        }}
      >
        The <b>buyer chooses</b> whether to use Safe Trade and pays
        the <b style={{ color: NEX.orange }}>NEX Center service fee</b>{" "}
        directly. The <b>supplier does not pay</b> the Safe Trade
        inspection fee.
      </div>

      {/* 7-step flow */}
      <div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          How it works
        </div>
        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <SafeStep
            n={1}
            title="Buyer and supplier agree the order"
            body="Product, quantity, specifications, quality requirements, and any other conditions are agreed between the buyer and supplier in chat."
          />
          <SafeStep
            n={2}
            title="Buyer selects NEX Center Safe Trade"
            body="If the buyer wants the additional inspection service, they select NEX Center Safe Trade and pay the applicable 20% NEX Center service fee."
          />
          <SafeStep
            n={3}
            title="Supplier sends the goods to NEX Center"
            body="The supplier delivers the ordered goods to NEX Center in Yogyakarta City for physical inspection."
          />
          <SafeStep
            n={4}
            title="NEX Center inspects the order"
            body="Goods are checked against the agreed buyer requirements and the supplier's stated product supply — applicable specifications, quantity, condition, quality."
          />
          <SafeStep
            n={5}
            title="Order approval"
            body="If the goods meet the agreed requirements, the Safe Trade inspection is completed and the order proceeds to payment release."
          />
          <SafeStep
            n={6}
            title="Supplier payment is released"
            body="Once the order passes the agreed inspection, the purchase payment is released to the supplier in full, according to the Safe Trade transaction terms."
          />
          <SafeStep
            n={7}
            title="Export & shipping support"
            body="NEX Center can provide available documentation and coordinate storage + freight arrangements where required."
          />
        </ol>
      </div>

      {/* Storage + Freight */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(6,15,28,0.72)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Storage &amp; Freight support
        </div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(244,247,252,0.85)",
          }}
        >
          Following inspection, goods can be held at NEX Center while
          shipping arrangements are completed. NEX Center can coordinate
          with freight and logistics brokers for:
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <FreightPill icon="✈️" label="Air Freight" />
          <FreightPill icon="🌊" label="Sea Freight" />
        </div>
      </div>

      {/* Fee callout */}
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background:
            "linear-gradient(180deg, rgba(255,114,0,0.16) 0%, rgba(255,114,0,0.06) 100%)",
          border: "1px solid rgba(255,114,0,0.45)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          NEX Center Safe Trade Fee
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: NEX.text,
            marginBottom: 10,
          }}
        >
          20% ·{" "}
          <span style={{ color: NEX.orange }}>paid by the buyer</span>{" "}
          directly to NEX Center.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(244,247,252,0.82)",
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          The fee covers the applicable NEX Center Safe Trade services,
          which may include:
        </div>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {[
            "Physical product inspection",
            "Checking goods against agreed buyer specifications",
            "Quantity and condition checking",
            "Inspection documentation",
            "Storage coordination",
            "Export documentation support",
            "Freight broker coordination",
            "Air or sea freight arrangement support",
          ].map((item) => (
            <FeeLine key={item}>{item}</FeeLine>
          ))}
        </ul>
      </div>

      {/* Optional callout */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(22,214,107,0.08)",
          border: "1px solid rgba(22,214,107,0.3)",
          fontSize: 13,
          color: "rgba(244,247,252,0.9)",
          lineHeight: 1.6,
        }}
      >
        <b style={{ color: "#B8F1CC" }}>Safe Trade is completely optional.</b>{" "}
        A buyer may purchase directly from the supplier without using
        NEX Center Safe Trade, subject to the supplier&apos;s normal
        trading terms.
      </div>

      {/* Important disclaimer */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontSize: 12,
          color: "rgba(244,247,252,0.75)",
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.textDim,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Important
        </div>
        NEX Center Safe Trade is an <b>independent inspection and
        trade-support service</b>. The inspection verifies the goods
        against the agreed order requirements at the time and location
        of inspection. It does not replace the buyer&apos;s
        responsibility for import regulations, customs requirements,
        product certifications, or other requirements applicable in
        the destination country.
      </div>
    </div>
  );
}

function SafeStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "34px 1fr",
        gap: 12,
        alignItems: "start",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#FF7200",
          color: "#0B0F1A",
          fontSize: 13,
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 4px 12px rgba(255,114,0,0.35)",
        }}
      >
        {n}
      </div>
      <div style={{ paddingTop: 3 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "rgba(244,247,252,0.8)",
          }}
        >
          {body}
        </div>
      </div>
    </li>
  );
}

function FreightPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 10,
        background: "rgba(0,175,255,0.10)",
        border: "1px solid rgba(0,175,255,0.35)",
        color: NEX.text,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>
        {icon}
      </span>
      {label}
    </span>
  );
}

function FeeLine({ children }: { children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 12.5,
        color: "rgba(244,247,252,0.88)",
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: NEX.orange,
          marginTop: 8,
        }}
      />
      <span>{children}</span>
    </li>
  );
}

function SafeItem({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(6,15,28,0.72)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 4,
          color: NEX.text,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(244,247,252,0.78)",
          lineHeight: 1.55,
        }}
      >
        {body}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Icons
 * ──────────────────────────────────────────────────────────────── */

function InfoIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
