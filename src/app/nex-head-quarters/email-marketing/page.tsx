// src/app/nex-head-quarters/email-marketing/page.tsx
//
// HQ Email Marketing surface · wraps the EXISTING backend (nex.marketing_* tables +
// /api/nex/marketing/stats · matrix · policies · campaigns endpoints). Does NOT
// rebuild the working infrastructure. Reads the operational view · surfaces
// contacts · categories · sendable status · data quality · campaign state ·
// bounces · relevant metrics.

import { EmailMarketingHqClient } from "./EmailMarketingHqClient";
import "../workstation/workstation.css";

export const dynamic = "force-dynamic";

export default function EmailMarketingHqPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Email Marketing · HQ</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Operational view of the existing NEX email marketing backend · contacts · category × country matrix · pipeline · campaign state · bounces.
          Founder authoring lives in <a href="/nexapp/lab/marketing">/nexapp/lab/marketing</a> · this HQ page is read-only operational monitoring.
        </p>
      </header>
      <EmailMarketingHqClient />
    </div>
  );
}
