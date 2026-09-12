// data/nex1-code-engine/novel-challenges-d/toggle-source.ts
//
// Novel-challenge fixture · Capability D generalisation · boolean field.

export interface Toggle {
  readonly key: string;
  readonly label: string;
}

export function makeToggles(labels: readonly string[]): Toggle[] {
  return labels.map((label, i) => ({
    key: `k${i}`,
    label,
  }));
}
