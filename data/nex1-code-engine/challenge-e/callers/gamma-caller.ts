// data/nex1-code-engine/challenge-e/callers/gamma-caller.ts
import type { GammaShape } from "../shared-types";
export function makeGammaList(notes: readonly string[]): GammaShape[] {
  return notes.map((note, i) => ({ key: `g${i}`, note }));
}
