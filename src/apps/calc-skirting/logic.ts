// calc-skirting — logic re-exports.

export {
  computeTrimCarpenter,
  DEFAULT_TRIM_RATES,
  enabledTrimServices,
  TRIM_CARPENTER_DEFAULT_INPUTS,
  TRIM_SERVICE_IS_INTEGER,
  TRIM_SERVICE_LABEL,
  TRIM_SERVICE_ORDER,
  TRIM_SERVICE_QTY_NOUN,
  TRIM_SERVICE_UNIT_LABEL,
  ZERO_TRIM_QUANTITIES
} from "@/lib/calculators/trim_carpenter";
export type {
  TrimCarpenterInputs,
  TrimQuantities,
  TrimRates,
  TrimService
} from "@/lib/calculators/trim_carpenter";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";
