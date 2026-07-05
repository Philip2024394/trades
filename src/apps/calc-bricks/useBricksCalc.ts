// useBricksCalc — shared state hook for all 3 size variants.

"use client";

import { useMemo, useState } from "react";
import {
  computeBricks,
  bricksComplementarySubcategories,
  BRICKS_DEFAULT_INPUTS_BY_SCENARIO,
  BRICKS_DEFAULT_SCENARIO,
  BRICKS_SCENARIO_LABEL,
  FALLBACK_BRICKS_PRODUCT
} from "./logic";
import type {
  BricksInputs,
  BricksScenario,
  CalculatorProductRef
} from "./logic";

export type UseBricksCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: BricksScenario;
};

export function useBricksCalc(options?: UseBricksCalcOptions) {
  const [scenario, setScenario] = useState<BricksScenario>(
    options?.initialScenario ?? BRICKS_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in BricksScenario]: Extract<BricksInputs, { scenario: K }>;
  }>(BRICKS_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_BRICKS_PRODUCT;
  const inputs = inputsByScenario[scenario] as BricksInputs;

  const result = useMemo(
    () => computeBricks(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => bricksComplementarySubcategories(scenario),
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
    scenarioLabel: BRICKS_SCENARIO_LABEL[scenario],
    scenarioLabels: BRICKS_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
