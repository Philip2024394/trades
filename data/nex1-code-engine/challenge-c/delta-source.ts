// data/nex1-code-engine/challenge-c/delta-source.ts
// Capability C fixture · ADVERSARIAL · name matches string heuristic, type is boolean.
export interface Delta {
  readonly key: string;
  readonly title: string;
}
export function makeDelta(titles: readonly string[]): Delta[] {
  return titles.map((title, i) => ({ key: `d${i}`, title }));
}
