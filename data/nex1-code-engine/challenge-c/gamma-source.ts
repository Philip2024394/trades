// data/nex1-code-engine/challenge-c/gamma-source.ts
// Capability C fixture · property name suggests boolean · declared type string (adversarial only via type).
export interface Gamma {
  readonly key: string;
  readonly label: string;
}
export function makeGamma(labels: readonly string[]): Gamma[] {
  return labels.map((label, i) => ({ key: `g${i}`, label }));
}
