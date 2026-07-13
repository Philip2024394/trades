// Marketplace search provider — categories.

import type { SearchResult } from "@/platform/search/orchestrator";

const CATEGORIES = [
  { slug: "hand-tools", label: "Hand tools" },
  { slug: "power-tools", label: "Power tools" },
  { slug: "site-materials", label: "Site materials" },
  { slug: "safety-ppe", label: "Safety + PPE" }
];

export async function searchCategories(query: string): Promise<SearchResult[]> {
  const q = query.toLowerCase();
  return CATEGORIES.filter((c) => c.label.toLowerCase().includes(q)).map(
    (c) => ({
      id: `category:${c.slug}`,
      kind: "categories",
      title: c.label,
      subtitle: `Browse all ${c.label.toLowerCase()}`,
      href: `/tc/trade-center/${c.slug}`,
      score: 0.7,
      appSlug: "marketplace"
    })
  );
}
