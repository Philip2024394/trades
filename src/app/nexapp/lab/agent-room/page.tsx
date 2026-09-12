// src/app/nexapp/lab/agent-room/page.tsx
//
// NEX Lab · Agent Room · founder directive 2026-09-12: "display the agent
// flow diagram". Visualises the full NEX1 pipeline (spelling normaliser →
// safety scanner → language detector → intent bridge → clarify/recognise →
// downstream handoffs) with live counts pulled from the deterministic
// language-brain API. Never fabricates.

import { AgentRoomClient } from "./AgentRoomClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Agent Room" };

export default function AgentRoomPage() {
  return <AgentRoomClient />;
}
