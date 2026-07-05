// usePavingCalc — shared state hook.

"use client";

import { useMemo, useState } from "react";
import {
  computePaving,
  FALLBACK_PAVING_PRODUCT,
  PAVING_DEFAULT_INPUTS_BY_SCENARIO,
  PAVING_DEFAULT_SCENARIO,
  PAVING_SCENARIO_LABEL,
  pavingComplementarySubcategories
} from "./logic";
import type {
  CalculatorProductRef,
  PavingInputs,
  PavingScenario
} from "./logic";

export type UsePavingCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: PavingScenario;
};

export function usePavingCalc(options?: UsePavingCalcOptions) {
  const [scenario, setScenario] = useState<PavingScenario>(
    options?.initialScenario ?? PAVING_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in PavingScenario]: Extract<PavingInputs, { scenario: K }>;
  }>(PAVING_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_PAVING_PRODUCT;
  const inputs = inputsByScenario[scenario] as PavingInputs;

  const result = useMemo(
    () => computePaving(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => pavingComplementarySubcategories(scenario),
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
    scenarioLabel: PAVING_SCENARIO_LABEL[scenario],
    scenarioLabels: PAVING_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
