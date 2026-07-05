// useGravelCalc — shared state hook for all 3 size variants.

"use client";

import { useMemo, useState } from "react";
import {
  computeGravel,
  FALLBACK_GRAVEL_PRODUCT,
  gravelComplementarySubcategories,
  GRAVEL_DEFAULT_INPUTS_BY_SCENARIO,
  GRAVEL_DEFAULT_SCENARIO,
  GRAVEL_SCENARIO_LABEL
} from "./logic";
import type {
  CalculatorProductRef,
  GravelInputs,
  GravelScenario
} from "./logic";

export type UseGravelCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: GravelScenario;
};

export function useGravelCalc(options?: UseGravelCalcOptions) {
  const [scenario, setScenario] = useState<GravelScenario>(
    options?.initialScenario ?? GRAVEL_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in GravelScenario]: Extract<GravelInputs, { scenario: K }>;
  }>(GRAVEL_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_GRAVEL_PRODUCT;
  const inputs = inputsByScenario[scenario] as GravelInputs;

  const result = useMemo(
    () => computeGravel(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => gravelComplementarySubcategories(scenario),
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
    scenarioLabel: GRAVEL_SCENARIO_LABEL[scenario],
    scenarioLabels: GRAVEL_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
