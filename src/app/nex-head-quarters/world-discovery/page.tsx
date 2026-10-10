// NEX World Discovery · Founder Command Centre
// Founder-authorised programme · bounded wave · 2026-09-21.
//
// Standing marketing status line unchanged. This page opens NO send gate.
// Founder-only surface · MAY display individual business email evidence.

import { WorldDiscoveryClient } from "./WorldDiscoveryClient";

export const dynamic = "force-dynamic";

export default function WorldDiscoveryPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>NEX World Discovery</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Live global crawler map. Real DB state · never fabricated activity.
          Every dot flashes only when actual work is in progress.
          Founder-only surface · emails visible to Founder · never member-facing.
        </p>
      </header>
      <WorldDiscoveryClient />
    </div>
  );
}
