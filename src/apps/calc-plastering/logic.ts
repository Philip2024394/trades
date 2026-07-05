// calc-plastering — logic re-exports.

export {
  computePlastering,
  plasteringComplementarySubcategories,
  elevationGrossArea,
  elevationNetArea,
  triangleArea,
  roomWallArea,
  roomCeilingArea,
  newElevation,
  newRoom,
  newOpening,
  DEFAULT_RATES,
  DEFAULT_ELEVATIONS,
  DEFAULT_ROOMS,
  DEFAULT_PROJECT,
  PLASTERING_DEFAULT_INPUTS,
  EXTERNAL_FINISH_LABEL,
  INTERNAL_FINISH_LABEL,
  OPENING_LABEL,
  FEATURE_LABEL,
  INSULATION_LABEL,
  PROJECT_TYPE_LABEL,
  READINESS_LABEL,
  SCENARIO_LABEL
} from "@/lib/calculators/plastering";

export type {
  PlasteringInputs,
  PlasteringScenario,
  WallShape,
  Opening,
  OpeningType,
  Elevation,
  Room,
  RoomFeature,
  RoomInsulation,
  ExternalFinish,
  InternalFinish,
  SubstrateType,
  FeatureType,
  InsulationType,
  ProjectType,
  ReadinessType,
  BeadingRates,
  MyRates,
  ProjectDetails
} from "@/lib/calculators/plastering";

export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** Placeholder product reference — the plastering calc doesn't sell a
 *  material by unit like paint or plasterboard does. It uses the
 *  plasterer's own rate card (My rates). */
export const FALLBACK_PLASTERING_PRODUCT: CalculatorProductRef = {
  id: "fallback-plastering",
  name: "Plastering rate card (reference)",
  price_pence: 0,
  cover_url: null,
  calculator_config: null,
  service_trade_type: "plasterer",
  service_rate_pence: 3500,
  service_rate_unit: "m2"
};
