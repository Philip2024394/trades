// Old public live-jobs feed — soft-killed after the pivot to app-for-
// tradies. Permanently redirects (308) to the new landing.

import { permanentRedirect } from "next/navigation";

export default function TradeOffJobsPage() {
  permanentRedirect("/trade-off");
}
