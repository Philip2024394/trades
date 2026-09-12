// src/app/nex-head-quarters/review-queue/page.tsx
//
// Founder Review Queue · CAP cards awaiting review. Uses Stage 6 shapes ·
// wires to /api/nex/review-queue/list · surfaces preview links · change-request
// form for founder-typed feedback. Founder actions require signature (locked
// server-side · UI provides the input).

import { ReviewQueueClient } from "./ReviewQueueClient";
import "../workstation/workstation.css";

export const dynamic = "force-dynamic";

export default function ReviewQueuePage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Founder Review Queue</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Sections awaiting founder review · type a message on any card to spawn a new revision · preview each candidate before approving.
        </p>
      </header>
      <ReviewQueueClient />
    </div>
  );
}
