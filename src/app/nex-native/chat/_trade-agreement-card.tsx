// src/app/nex-native/chat/_trade-agreement-card.tsx
//
// Bridge 17c · Compact "Understand Trade Agreement" card.
// -------------------------------------------------------
// Persistent reminder rendered at the top of every commerce chat's
// message stream. Different from the Bridge 16b JIT consent modal ·
// that fires once on the first commerce chat entry and blocks the
// surface. This card is a permanent short summary that sits in the
// bubble stream so buyers can re-read the five safe paths at any
// time · no dismiss needed.
//
// Server Component · zero client-side state · just presents the
// doctrine plainly with links to /terms + /safe-trade.

import Link from "next/link";

const NEX = {
  green: "#16D66B",
  greenSoft: "rgba(22,214,107,0.35)",
  cyan: "#00AFFF",
  text: "#F4F7FC",
  textDim: "rgba(244,247,252,0.85)",
  textMute: "rgba(139,169,209,0.85)",
};

export function TradeAgreementCard({
  sellerName,
}: {
  /** First name of the seller · used in the header for personal tone. */
  sellerName: string;
}) {
  return (
    <div
      style={{
        margin: "8px auto 16px",
        maxWidth: 360,
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(22,214,107,0.08)",
        border: `1px solid ${NEX.greenSoft}`,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        fontSize: 12,
        lineHeight: 1.55,
        boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      data-nex-trade-agreement
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.green,
          fontWeight: 800,
          marginBottom: 6,
        }}
      >
        🛡 Trade Agreement with {sellerName}
      </div>
      <div style={{ color: NEX.textDim, marginBottom: 8 }}>
        You never pay before you receive · unless a third party you
        trust is holding the money.
      </div>
      <ul
        style={{
          margin: 0,
          padding: "0 0 0 16px",
          color: NEX.textDim,
          fontSize: 11,
          lineHeight: 1.65,
        }}
      >
        <li>
          <b style={{ color: NEX.text }}>Five safe paths:</b> COD ·
          QRIS on delivery · Courier COD · Meet in person · Escrow
        </li>
        <li>
          <b style={{ color: NEX.text }}>Off-path payments</b> (direct
          transfer before delivery) are not mediated by NEX.
        </li>
      </ul>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 12,
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <Link
          href="/nex-native/safe-trade"
          target="_blank"
          rel="noopener"
          style={{
            color: NEX.cyan,
            textDecoration: "underline",
            textDecorationColor: "rgba(0,175,255,0.5)",
            textUnderlineOffset: 2,
          }}
        >
          Safe trade
        </Link>
        <Link
          href="/nex-native/terms"
          target="_blank"
          rel="noopener"
          style={{
            color: NEX.textMute,
            textDecoration: "underline",
            textDecorationColor: "rgba(139,169,209,0.35)",
            textUnderlineOffset: 2,
          }}
        >
          Full terms
        </Link>
      </div>
    </div>
  );
}
