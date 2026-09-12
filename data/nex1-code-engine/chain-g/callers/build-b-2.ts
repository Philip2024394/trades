// data/nex1-code-engine/chain-g/callers/build-b-2.ts
import type { B } from "../types-b";
export function buildB2(kinds: readonly string[]): B[] {
  return kinds.map((kind, i) => ({ aId: `b2-${i}`, kind }));
}
