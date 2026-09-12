// data/nex1-code-engine/challenge-e/shared-types.ts
//
// Capability E fixture · shared interface declarations · file A.
// Callers live in separate files under ./callers/ and import from here.

export interface EpsilonConfig {
  readonly mode: "on" | "off";
  readonly weight: number;
}

export interface AlphaShape {
  readonly key: string;
  readonly note: string;
}

export interface BetaShape {
  readonly key: string;
  readonly note: string;
}

export interface GammaShape {
  readonly key: string;
  readonly note: string;
}

export interface DeltaShape {
  readonly key: string;
  readonly note: string;
}

export interface EpsilonShape {
  readonly key: string;
  readonly note: string;
}
