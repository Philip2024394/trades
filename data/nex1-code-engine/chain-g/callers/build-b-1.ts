// data/nex1-code-engine/chain-g/callers/build-b-1.ts
import type { B } from "../types-b";
export function buildB1(kinds: readonly string[]): B[] {
  return kinds.map((kind, i) => ({ aId: `b1-${i}`, kind }));
}
