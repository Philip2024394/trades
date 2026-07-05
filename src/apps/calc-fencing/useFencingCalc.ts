// useFencingCalc — shared state hook.

"use client";

import { useMemo, useState } from "react";
import {
  computeFencing,
  FALLBACK_FENCING_PRODUCT,
  FENCING_DEFAULT_INPUTS_BY_SCENARIO,
  FENCING_DEFAULT_SCENARIO,
  FENCING_SCENARIO_LABEL,
  fencingComplementarySubcategories
} from "./logic";
import type {
  CalculatorProductRef,
  FencingInputs,
  FencingScenario
} from "./logic";

export type UseFencingCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: FencingScenario;
};

export function useFencingCalc(options?: UseFencingCalcOptions) {
  const [scenario, setScenario] = useState<FencingScenario>(
    options?.initialScenario ?? FENCING_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in FencingScenario]: Extract<FencingInputs, { scenario: K }>;
  }>(FENCING_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_FENCING_PRODUCT;
  const inputs = inputsByScenario[scenario] as FencingInputs;

  const result = useMemo(
    () => computeFencing(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => fencingComplementarySubcategories(scenario),
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
    scenarioLabel: FENCING_SCENARIO_LABEL[scenario],
    scenarioLabels: FENCING_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
