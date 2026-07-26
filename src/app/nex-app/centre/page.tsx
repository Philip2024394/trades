// NEX Trade Centre — live customer-facing marketplace surface.
//
// Phase 7 · Increment 4C: replaces the demo Pinterest feed with the
// live-data NexCentreLiveFeed, which consumes GET /api/nex/centre/feed
// (real published products) with skeleton loading, infinite scroll,
// search, filters and a friendly empty-state fallback.
//
// The old NexPinterestFeed demo component is retained in the file
// system as a design reference but is no longer imported anywhere.

import { NexCentreLiveFeed } from "@/components/nex-app/centre/NexCentreLiveFeed";

export const dynamic = "force-dynamic";

export default function NexCentrePage() {
  return <NexCentreLiveFeed />;
}
