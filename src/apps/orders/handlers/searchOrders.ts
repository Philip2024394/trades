// Orders — Universal Search provider handler.

import { searchOrdersFixture } from "../data/orders";
import { MERCHANT_FIXTURES } from "@/apps/tradecenter/data/merchants";
import type { SearchResult } from "@/platform/search/orchestrator";

export async function searchOrders(query: string): Promise<SearchResult[]> {
  const hits = searchOrdersFixture(query);
  return hits.map((o) => {
    const merchant = MERCHANT_FIXTURES.find((m) => m.slug === o.merchantSlug);
    return {
      id: o.id,
      kind: "content",
      title: o.itemsSummary,
      subtitle: merchant
        ? `${merchant.displayName} · £${o.totalGbp} · ${o.status}`
        : `£${o.totalGbp} · ${o.status}`,
      href: `/tc/orders#${o.id}`,
      score: 0.85,
      appSlug: "orders",
      payload: o
    };
  });
}
