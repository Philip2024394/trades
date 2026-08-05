// NEX Brain monitor — live dashboard for the manager + worker pool.
//
// Route: /nex-app/nex-brain
//
// Composes: pool health cards, corpus breakdown, LLM budget consumed,
// contradictions surfaced, "Run one cycle" button for manual testing,
// and a live records list. Reads /api/nex/brain/status on mount and
// after every action.

import { NexBrainShell } from "@/components/nex-app/nex-brain/NexBrainShell";
import "../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Brain · Monitor",
  robots: { index: false },
};

export default function NexBrainPage() {
  return (
    <div className="nex-app-root">
      <NexBrainShell />
    </div>
  );
}
