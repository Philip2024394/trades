// src/app/nex-market/layout.tsx · NEX Market shell (Hammer-quality UX · NEX theme).

import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Market · Yogyakarta" };

export default function NexMarketLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf7f2",
      color: "#1a1a1a",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      <header style={{
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "saturate(180%) blur(8px)",
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/nex-market" style={{ fontWeight: 700, fontSize: 20, color: "#1a1a1a", textDecoration: "none", letterSpacing: "-0.01em" }}>
            NEX <span style={{ fontWeight: 400, color: "#8a8776" }}>Market</span>
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/nex-market/create-listing" style={{
            padding: "9px 16px",
            border: "1px solid #1a1a1a",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            color: "#1a1a1a",
            textDecoration: "none",
            background: "transparent",
          }}>
            + Create listing
          </Link>
        </div>
      </header>
      {children}
      <footer style={{ padding: "40px 24px", textAlign: "center", color: "#8a8776", fontSize: 12 }}>
        NEX Market · Yogyakarta · demo preview · no real payment yet
      </footer>
    </div>
  );
}
