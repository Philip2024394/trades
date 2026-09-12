"use client";

// src/app/nexapp/nex-agent/WorkstationClient.tsx
//
// Client-only wrapper for NexAgentWorkstation. Renders a loading skeleton on
// the server and during the first client tick, then swaps in the full
// interactive workstation. Prevents Next 16 Turbopack hydration mismatches
// when the client bundle updates out-of-step with the server bundle.

import { useEffect, useState } from "react";
import { NexAgentWorkstation } from "./NexAgentWorkstation";
import { WorkstationErrorBoundary } from "./ErrorBoundary";

export function WorkstationClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(180deg, #0B1220 0%, #0E1B33 40%, #0B1220 100%)",
        color: "#94A3B8",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 13,
      }}>Loading NEX1 workstation…</div>
    );
  }

  return (
    <WorkstationErrorBoundary>
      <NexAgentWorkstation />
    </WorkstationErrorBoundary>
  );
}
