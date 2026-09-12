// data/nex1-code-engine/challenge-e/callers/epsilon-caller.ts
import type { EpsilonShape } from "../shared-types";
export function makeEpsilonList(notes: readonly string[]): EpsilonShape[] {
  return notes.map((note, i) => ({ key: `e${i}`, note }));
}
