// src/app/nex-native/chat/_trade-agreement-card.tsx
//
// Bridge 17d · Compact safe-trade status line at the top of every
// commerce chat. Simplified 2026-09-28 · Founder direction "keep
// it short - example: Priya has safe trade activated · or · Priya
// has not yet activated safe trade · request activation before
// placing order and follow safe trade at all times on nex".
//
// Binary based on nex_business.safe_trade_activated (migration 073).

import Link from "next/link";

export function TradeAgreementCard({
  sellerName,
  activated,
}: {
  sellerName: string;
  activated: boolean;
}) {
  return (
    <div
      style={{
        margin: "8px auto 16px",
        maxWidth: 360,
        padding: "10px 14px",
        borderRadius: 12,
        background: activated
          ? "rgba(22,214,107,0.10)"
          : "rgba(245,158,11,0.10)",
        border: `1px solid ${
          activated ? "rgba(22,214,107,0.40)" : "rgba(245,158,11,0.42)"
        }`,
        color: activated ? "#B8F1CC" : "#FFE1A8",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        fontSize: 12,
        lineHeight: 1.5,
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        textAlign: "center",
      }}
      data-nex-trade-agreement
    >
      {activated ? (
        <span>
          🛡 <b>{sellerName} has Safe Trade activated.</b>{" "}
          <Link
            href="/nex-native/safe-trade"
            style={{ color: "#16D66B", textDecoration: "underline" }}
          >
            Learn more
          </Link>
        </span>
      ) : (
        <span>
          ⚠ <b>{sellerName} has not yet activated Safe Trade.</b> Ask
          them to activate it before placing an order · always follow{" "}
          <Link
            href="/nex-native/safe-trade"
            style={{ color: "#FFC96B", textDecoration: "underline" }}
          >
            NEX Safe Trade
          </Link>
          .
        </span>
      )}
    </div>
  );
}
