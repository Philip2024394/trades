// /admin/red-zone — Thenetworkers operational command centre.
//
// This is the ONE page the admin checks every hour to see whether
// anything is broken, blocking, or waiting for a decision that would
// stop the platform from being fully operational. Anything that could
// hurt merchants, buyers, or the trust surface surfaces here.
//
// Categories tracked:
//   - Site health (uptime, payments, key services, DB)
//   - Blocking issues (CRITICAL severity — page down, checkout broken)
//   - Payment issues (Stripe failures, disputes, failed webhooks)
//   - Washer refund queue (merchant-flagged spam leads)
//   - Content reports (from the /legal contact route)
//   - User-submitted bugs / broken links / feature requests
//
// Phase 5 delivers the UI + section structure with mocked data and
// clear TODO(backend) markers for each real data source. The queries
// become real as their producing systems come online.

import type { Metadata } from "next";
import { RedZoneShell } from "./RedZoneShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "🔴 Red Zone | Thenetworkers Admin",
  robots: { index: false, follow: false }
};

export default async function RedZonePage() {
  return <RedZoneShell />;
}
