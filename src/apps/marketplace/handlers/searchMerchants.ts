// Marketplace search provider — merchants.

import { MERCHANT_FIXTURES } from "../data/merchants";
import type { SearchResult } from "@/platform/search/orchestrator";

export async function searchMerchants(query: string): Promise<SearchResult[]> {
  const q = query.toLowerCase();
  return MERCHANT_FIXTURES.filter(
    (m) =>
      m.displayName.toLowerCase().includes(q) ||
      m.homeCity.toLowerCase().includes(q)
  ).map((m) => ({
    id: `merchant:${m.slug}`,
    kind: "merchants",
    title: m.displayName,
    subtitle: `${m.homeCity} · ${m.yearsTrading}y trading · trust ${m.trust.score}`,
    href: `/tc/trade-center/merchant/${m.slug}`,
    score: 0.9,
    appSlug: "marketplace",
    payload: m
  }));
}
