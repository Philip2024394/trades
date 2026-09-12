// src/app/nex-head-quarters/section-intervention/page.tsx

import { SectionInterventionClient } from "./SectionInterventionClient";
import "../workstation/workstation.css";

export const dynamic = "force-dynamic";

export default function SectionInterventionPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Section Intervention</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Three-level founder intervention: <strong style={{ color: "var(--nws-warning)" }}>DISABLE</strong> · <strong style={{ color: "var(--nws-orange)" }}>ROLLBACK</strong> · <strong style={{ color: "var(--nws-danger)" }}>REMOVE FROM LIVE</strong>.
          Every action requires signature + reason. Immutable history preserved. Auto-rebuild locked capabilities cannot be autonomously recreated.
        </p>
      </header>
      <SectionInterventionClient />
    </div>
  );
}
