// data/nex1-code-engine/challenge-e/callers/alpha-caller.ts
import type { AlphaShape } from "../shared-types";
export function makeAlphaList(notes: readonly string[]): AlphaShape[] {
  return notes.map((note, i) => ({ key: `a${i}`, note }));
}
