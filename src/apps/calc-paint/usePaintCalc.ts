// usePaintCalc — the shared state hook for all 3 size variants.
//
// Owns:
//   • current scenario
//   • current inputs (per-scenario shape)
//   • computed CalculatorOutput
//   • change handlers
//
// The three size variants (Landscape / Square / Portrait) all use
// this hook so the underlying logic and defaults stay identical.

"use client";

import { useMemo, useState } from "react";
import {
  computePaint,
  paintComplementarySubcategories,
  PAINT_DEFAULT_INPUTS_BY_SCENARIO,
  PAINT_DEFAULT_SCENARIO,
  PAINT_SCENARIO_LABEL,
  FALLBACK_PAINT_PRODUCT
} from "./logic";
import type {
  CalculatorProductRef,
  PaintInputs,
  PaintScenario
} from "./logic";

export type UsePaintCalcOptions = {
  /** Optional product feed — falls back to trade defaults. */
  product?: CalculatorProductRef;
  /** Start on a specific scenario. */
  initialScenario?: PaintScenario;
};

export function usePaintCalc(options?: UsePaintCalcOptions) {
  const [scenario, setScenario] = useState<PaintScenario>(
    options?.initialScenario ?? PAINT_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in PaintScenario]: Extract<PaintInputs, { scenario: K }>;
  }>(PAINT_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_PAINT_PRODUCT;

  const inputs = inputsByScenario[scenario] as PaintInputs;

  const result = useMemo(
    () => computePaint(inputs, product),
    [inputs, product]
  );

  const crossSellSubcategories = useMemo(
    () => paintComplementarySubcategories(scenario),
    [scenario]
  );

  /** Change one field on the current scenario's inputs. Typed loosely
   *  because the field set differs per scenario. */
  const updateField = (field: string, value: unknown) => {
    setInputsByScenario((prev) => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        [field]: value
      }
    }));
  };

  const changeScenario = (next: PaintScenario) => setScenario(next);

  return {
    scenario,
    scenarioLabel: PAINT_SCENARIO_LABEL[scenario],
    scenarioLabels: PAINT_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario,
    updateField
  };
}
