// src/app/nex-shop/layout.tsx · thin shell for the marketplace vertical slice.

import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function NexShopLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf7f2",
      color: "#1a1a1a",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      <header style={{
        borderBottom: "1px solid #eee",
        background: "#fff",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/nex-shop" style={{ fontWeight: 700, fontSize: 20, color: "#1a1a1a", textDecoration: "none" }}>
            NEX <span style={{ fontWeight: 400, color: "#8a8776" }}>Shop</span>
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/nex-shop/create-listing" style={{
            padding: "8px 14px",
            border: "1px solid #1a1a1a",
            borderRadius: 999,
            fontSize: 13,
            color: "#1a1a1a",
            textDecoration: "none",
          }}>
            + Create listing
          </Link>
        </div>
      </header>
      {children}
      <footer style={{ padding: "40px 24px", textAlign: "center", color: "#8a8776", fontSize: 12 }}>
        NEX Marketplace · vertical-slice preview · no real payment · Yogyakarta demo
      </footer>
    </div>
  );
}
