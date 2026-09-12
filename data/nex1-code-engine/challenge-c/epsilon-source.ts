// data/nex1-code-engine/challenge-c/epsilon-source.ts
// Capability C fixture · ADVERSARIAL · name matches number heuristic, type is string.
export interface Epsilon {
  readonly key: string;
  readonly note: string;
}
export function makeEpsilon(notes: readonly string[]): Epsilon[] {
  return notes.map((note, i) => ({ key: `e${i}`, note }));
}
