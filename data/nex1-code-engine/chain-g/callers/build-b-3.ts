// data/nex1-code-engine/chain-g/callers/build-b-3.ts
import type { B } from "../types-b";
export function buildB3(kinds: readonly string[]): B[] {
  return kinds.map((kind, i) => ({ aId: `b3-${i}`, kind }));
}
