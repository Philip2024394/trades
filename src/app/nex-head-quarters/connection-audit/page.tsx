// src/app/nex-head-quarters/connection-audit/page.tsx

import { ConnectionAuditClient } from "./ConnectionAuditClient";
import "../workstation/workstation.css";

export const dynamic = "force-dynamic";

export default function ConnectionAuditPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Connection Audit</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          For every capability · does it actually connect to NEX? 22 slots checked · applicable slots per CAP · fully-connected vs gaps. No isolated feature islands.
        </p>
      </header>
      <ConnectionAuditClient />
    </div>
  );
}
