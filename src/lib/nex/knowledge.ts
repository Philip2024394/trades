// Nex retrieval facade — thin wrapper over the Trade Intelligence
// hybrid search + graph expansion. Kept as a small module so existing
// Nex chat imports (retrieveKnowledge) keep working.

import { hybridSearch } from "./intelligence";
import type { KnowledgeHit } from "./intelligence";

export type { KnowledgeHit } from "./intelligence";

export async function retrieveKnowledge(query: string, limit = 3): Promise<KnowledgeHit[]> {
  return hybridSearch({ query, limit, expand: true });
}
