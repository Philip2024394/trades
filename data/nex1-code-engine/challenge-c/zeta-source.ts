// data/nex1-code-engine/challenge-c/zeta-source.ts
// Capability C fixture · array type · declared type number[].
export interface Zeta {
  readonly key: string;
  readonly label: string;
}
export function makeZeta(labels: readonly string[]): Zeta[] {
  return labels.map((label, i) => ({ key: `z${i}`, label }));
}
