// data/nex1-code-engine/chain-g/callers/build-a.ts
import type { A } from "../types-a";
export function buildA(ids: readonly string[]): A[] {
  return ids.map((aId) => ({ aId }));
}
