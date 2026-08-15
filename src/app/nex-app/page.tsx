// /nex-app · NEX Product Front Door (Philip 2026-08-14 · Phase 20).
//
// Two clear choices, minimal chrome. The front door of NEX as a product:
//   - Explore a business  → /nex-app/brains/staircase?state=discover
//     (the pinned 2026-08-12 canonical customer-facing landing)
//   - Create my business app → /nex-app/app-builder
//     (the App Builder chat — start the owner journey)
//
// HISTORY:
//   - 2026-08-12 · pinned canonical landing at /nex-app/brains/staircase?state=discover
//   - 2026-08-14 (Philip · Phase 18) · attempted NexFrontDoor component (rolled back)
//   - 2026-08-14 (Philip · Phase 20) · minimal two-choice hero (this file).
//     Preserves the pinned landing (still reachable via "Explore" card)
//     while making /nex-app a real product entry point.

import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX", robots: { index: false } };

export default function NexFrontDoorPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff",
        display: "flex",
        justifyContent: "center",
        padding: "48px 20px",
        fontFamily: "Inter, system-ui, sans-serif"
      }}
      data-testid="nex-front-door"
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <header style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>
            NEX
          </div>
          <h1 style={{ margin: "12px 0 8px", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#0a0a0a" }}>
            What do you want to do?
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#525252", maxWidth: 520 }}>
            NEX runs locally and powers both sides of every business — the customer experience and the owner workspace.
          </p>
        </header>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr" }}>
          <Link
            href="/nex-app/brains/staircase?state=discover"
            data-testid="front-door-explore"
            style={{
              display: "block",
              padding: "22px 24px",
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 14,
              textDecoration: "none",
              color: "#0a0a0a",
              transition: "border-color 120ms, box-shadow 120ms"
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 48, height: 48, flexShrink: 0,
                background: "#F0FDF4",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24
              }} aria-hidden>🔎</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Explore a business</div>
                <div style={{ fontSize: 13, color: "#666", marginTop: 4, lineHeight: 1.4 }}>
                  Browse the Staircase Brain — designs, materials, regulations, and every UK company already listed with NEX.
                </div>
              </div>
            </div>
          </Link>

          <Link
            href="/nex-app/app-builder"
            data-testid="front-door-create"
            style={{
              display: "block",
              padding: "22px 24px",
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 14,
              textDecoration: "none",
              color: "#0a0a0a",
              transition: "border-color 120ms, box-shadow 120ms"
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 48, height: 48, flexShrink: 0,
                background: "#FEF3EC",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24
              }} aria-hidden>🛠</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Create my business app</div>
                <div style={{ fontSize: 13, color: "#666", marginTop: 4, lineHeight: 1.4 }}>
                  Describe your business in plain English. NEX Studio designs, builds, and publishes a working app you can hand to customers.
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
          NEX™ · local-first · rule-based intent classification (no third-party LLM)
        </div>
      </div>
    </main>
  );
}
