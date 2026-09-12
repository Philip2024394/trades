// src/app/nex-head-quarters/security/page.tsx

import { SecurityHqClient } from "./SecurityHqClient";
import "../workstation/workstation.css";

export const dynamic = "force-dynamic";

export default function SecurityHqPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Security HQ</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Recent HQ Security Agent inspections · verdicts · rejection code frequencies · full audit trail. Every code-write is inspected here before commit.
        </p>
      </header>
      <SecurityHqClient />
    </div>
  );
}
