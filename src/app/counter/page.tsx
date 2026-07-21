// /counter — permanent redirect to the merged Trade Center Live view.
//
// The Counter is no longer a standalone destination — it lives inside
// Trade Center as the "Live" tab (Philip 2026-07-20 merge decision).
// Every legacy /counter link and the CanteenCounterStrip "See all →"
// keep working via this redirect. Search engines follow the 308.

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CounterRedirect() {
  permanentRedirect("/tc/trade-center?view=live");
}
