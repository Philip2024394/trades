// src/app/nexapp/hq/page.tsx
//
// Founder 2026-09-10 · HQ Live · single page · n8n-style node graph.
//
// Design brief:
//   · Dark background (#0a0d10)
//   · Green flow lines when data is moving (#22c55e), dim grey when idle (#334155)
//   · Nodes: rounded rectangle + icon + label + status dot
//   · Item counts on edges (e.g. "6 items")
//   · Auto-poll every 5 seconds via /api/nex/hq/live
//   · Founder sees TRUTH ONLY · every number is measured, never fabricated
//   · If polling stalls > 15 s a red "stale" banner shows so founder knows

import { HqLiveClient } from "./HqLiveClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NEX · HQ · Live",
  description: "Founder-facing live operations · agents · data feed · growth",
};

export default function HqPage() {
  return <HqLiveClient />;
}
