// src/app/nex-app/enter/page.tsx
//
// NEX Glass Gate · entry route · Philip 2026-09-07
//
// The authenticated-entry surface. Renders the Glass Gate for
// unauthenticated visitors; the gate itself performs a client-side
// session check on mount and redirects to /nexapp when a session is
// already present (Journey B · session restore per §24).
//
// Server-side auth check is deliberately skipped here so a Supabase
// outage never blocks the visual atmosphere from loading. If a real
// session exists the client-side check inside GlassGate handles the
// redirect in the first tick after mount.
//
// The parent /nex-app layout mounts NexSectionsNav + CentreFeedPreloader;
// NexSectionsNav suppresses itself on this pathname (see the modify).

import { GlassGate } from "@/components/nex-gate/GlassGate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX",
  description: "Your world is waiting.",
};

export default function GateEntryPage() {
  return <GlassGate />;
}
