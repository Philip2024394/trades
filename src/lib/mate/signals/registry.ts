// Static import list of every signal detector. New detector = one
// import + one line in DETECTORS. Runner iterates this array per user.

import type { SignalDetector } from "./types";
import { reviewUnrepliedDetector } from "./detectors/review_unreplied";
import { washerLowDetector } from "./detectors/washer_low";
import { trustLadderNextDetector } from "./detectors/trust_ladder_next";

export const DETECTORS: SignalDetector[] = [
  reviewUnrepliedDetector,
  washerLowDetector,
  trustLadderNextDetector
];

export function detectorsForSurface(surface: "merchant" | "homeowner"): SignalDetector[] {
  return DETECTORS.filter((d) => d.surfaces.includes(surface));
}
