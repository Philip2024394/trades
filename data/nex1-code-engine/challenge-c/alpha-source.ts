// data/nex1-code-engine/challenge-c/alpha-source.ts
// Capability C fixture · property name neutral · declared type number.
export interface Alpha {
  readonly key: string;
  readonly note: string;
}
export function makeAlpha(notes: readonly string[]): Alpha[] {
  return notes.map((note, i) => ({ key: `a${i}`, note }));
}
