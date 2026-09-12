// data/nex1-code-engine/chain-g/types-b.ts
// Capability G fixture · B extends A · plus a nested complex custom type used
// only by the adversarial branch.
import type { A } from "./types-a";

export interface BMetadata {
  readonly source: "seed" | "manual";
  readonly weight: number;
}

export interface B extends A {
  readonly kind: string;
}
