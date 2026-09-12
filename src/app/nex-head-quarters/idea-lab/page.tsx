// src/app/nex-head-quarters/idea-lab/page.tsx

import { IdeaLabClient } from "./IdeaLabClient";
import "../workstation/workstation.css";

export const dynamic = "force-dynamic";

export default function IdeaLabPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>NEX Idea Lab</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Founder types an idea · NEX evaluates across 11 dimensions with visible reasoning ·
          Founder decides <strong style={{ color: "var(--nws-success)" }}>SEND TO CODING</strong> ·
          <strong style={{ color: "var(--nws-warning)" }}> SAVE FOR LATER</strong> ·
          <strong style={{ color: "var(--nws-danger)" }}> REJECT</strong>. Score is advice · your decision is authority.
        </p>
      </header>
      <IdeaLabClient />
    </div>
  );
}
