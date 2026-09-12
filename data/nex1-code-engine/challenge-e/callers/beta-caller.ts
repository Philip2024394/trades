// data/nex1-code-engine/challenge-e/callers/beta-caller.ts
import type { BetaShape } from "../shared-types";
export function makeBetaList(notes: readonly string[]): BetaShape[] {
  return notes.map((note, i) => ({ key: `b${i}`, note }));
}
