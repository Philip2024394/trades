// Old customer "post a job" form — soft-killed after the pivot.
// Customers don't post jobs to the platform now; tradies own the
// inbound funnel via their own profile URL. Permanent redirect.

import { permanentRedirect } from "next/navigation";

export default function TradeOffJobsPostPage() {
  permanentRedirect("/trade-off");
}
