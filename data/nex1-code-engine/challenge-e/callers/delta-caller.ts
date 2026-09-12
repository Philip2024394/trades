// data/nex1-code-engine/challenge-e/callers/delta-caller.ts
import type { DeltaShape } from "../shared-types";
export function makeDeltaList(notes: readonly string[]): DeltaShape[] {
  return notes.map((note, i) => ({ key: `d${i}`, note }));
}
