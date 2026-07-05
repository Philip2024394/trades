// useTurfCalc — shared state hook.

"use client";

import { useMemo, useState } from "react";
import {
  computeTurf,
  FALLBACK_TURF_PRODUCT,
  TURF_DEFAULT_INPUTS_BY_SCENARIO,
  TURF_DEFAULT_SCENARIO,
  TURF_SCENARIO_LABEL,
  turfComplementarySubcategories
} from "./logic";
import type {
  CalculatorProductRef,
  TurfInputs,
  TurfScenario
} from "./logic";

export type UseTurfCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: TurfScenario;
};

export function useTurfCalc(options?: UseTurfCalcOptions) {
  const [scenario, setScenario] = useState<TurfScenario>(
    options?.initialScenario ?? TURF_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in TurfScenario]: Extract<TurfInputs, { scenario: K }>;
  }>(TURF_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_TURF_PRODUCT;
  const inputs = inputsByScenario[scenario] as TurfInputs;

  const result = useMemo(
    () => computeTurf(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => turfComplementarySubcategories(scenario),
    [scenario]
  );

  const updateField = (field: string, value: unknown) => {
    setInputsByScenario((prev) => ({
      ...prev,
      [scenario]: { ...prev[scenario], [field]: value }
    }));
  };

  return {
    scenario,
    scenarioLabel: TURF_SCENARIO_LABEL[scenario],
    scenarioLabels: TURF_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
