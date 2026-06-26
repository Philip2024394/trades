// Old per-job detail page — soft-killed after the pivot.
// Permanent redirect (308) to the new landing.

import { permanentRedirect } from "next/navigation";

export default function TradeOffJobDetailPage() {
  permanentRedirect("/trade-off");
}
