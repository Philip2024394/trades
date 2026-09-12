// data/nex1-code-engine/challenge-c/eta-source.ts
// Capability C fixture · COMPLEX CUSTOM TYPE · NEX1 must refuse to invent.

export interface EtaConfig {
  readonly mode: "on" | "off";
  readonly weight: number;
}

export interface Eta {
  readonly key: string;
  readonly label: string;
}

export function makeEta(labels: readonly string[]): Eta[] {
  return labels.map((label, i) => ({ key: `h${i}`, label }));
}
