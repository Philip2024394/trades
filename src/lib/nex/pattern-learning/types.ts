// Pattern Learning Engine · types.
//
// Self-learning system. Every analysed image adds knowledge · Nex mines
// co-occurrence patterns like "oak → warm_white 78% · glass_balustrade 62%"
// without human hardcoding.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

export type PatternObservation = {
  observation_id: string;
  captured_at: string;
  source_asset_id?: string;
  features: Record<string, string>;      // e.g. { timber: "oak", lighting: "warm_white", balustrade: "glass", hardware: "matt_black" }
};

export type Pairing = {
  antecedent: { feature: string; value: string };
  consequent: { feature: string; value: string };
  support: number;                       // number of observations that share BOTH
  antecedent_count: number;              // number of observations with the antecedent
  confidence: number;                    // support / antecedent_count
};
