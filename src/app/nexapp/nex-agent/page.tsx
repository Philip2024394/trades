// src/app/nexapp/nex-agent/page.tsx
//
// NEX1 Programming Workstation. Interactive workstation runs entirely
// client-side via WorkstationClient (mount-gated) so Next 16 Turbopack
// hydration mismatches can't crash the founder's screen.

import type { Metadata } from "next";
import { WorkstationClient } from "./WorkstationClient";
import "./nex-agent-workstation.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX1 Programming Workstation" };

export default function NexAgentPage() {
  return <WorkstationClient />;
}
