// data/nex1-code-engine/novel-e/wildcard-registry.ts
import type { WildcardRow } from "./schema";
export function registerWildcards(summaries: readonly string[]): WildcardRow[] {
  return summaries.map((summary, i) => ({ recordId: `w${i}`, summary }));
}
