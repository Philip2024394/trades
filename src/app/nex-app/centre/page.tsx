// NEX Centre — mobile-first business + product discovery surface.
// Cream platform base with a dark hero at the top for the "wow"
// moment. Cold-start uses public Companies House data only + a
// claim-your-business flow; WhatsApp messaging is customer-initiated
// via wa.me deep-links (no PECR / GDPR / WhatsApp-ToS exposure).

import { NexCentreShell } from "@/components/nex-app/centre/NexCentreShell";

export const dynamic = "force-dynamic";

export default function NexCentrePage() {
  return <NexCentreShell />;
}
