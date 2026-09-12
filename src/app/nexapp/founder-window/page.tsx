// src/app/nexapp/founder-window/page.tsx
//
// Founder's Window · SSR shell. Client owns the live SSE stream.

import { Suspense } from "react";
import FounderWindowClient from "./FounderWindowClient";
import { FounderShell } from "@/components/nex-app/founder-shell/FounderShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function FounderWindowPage() {
  return (
    <FounderShell title="Founder's Window"
      subtitle="Real-time view into NEX. Every count · every event · every status pill is a live signal from real infrastructure. No fake data.">
      <Suspense fallback={<div className="text-neutral-500">Loading…</div>}>
        <FounderWindowClient />
      </Suspense>
    </FounderShell>
  );
}
