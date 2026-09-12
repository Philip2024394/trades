// src/app/nexapp/lab/marketing/page.tsx
//
// Founder 2026-09-10 · Lab Marketing section · SSR shell.

import { Suspense } from "react";
import MarketingClient from "./MarketingClient";
import { FounderShell } from "@/components/nex-app/founder-shell/FounderShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function LabMarketingPage() {
  return (
    <FounderShell title="Lab · Marketing"
      subtitle="24/7 email marketing built into the Lab. Contacts imported from every source. Sectioned by category × country. Send only under authorized policy.">
      <Suspense fallback={<div className="text-neutral-500">Loading…</div>}>
        <MarketingClient />
      </Suspense>
    </FounderShell>
  );
}
