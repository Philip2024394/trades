// usePlasterboardCalc — shared state hook.

"use client";

import { useMemo, useState } from "react";
import {
  computePlasterboard,
  FALLBACK_PLASTERBOARD_PRODUCT,
  plasterboardComplementarySubcategories,
  PLASTERBOARD_DEFAULT_INPUTS_BY_SCENARIO,
  PLASTERBOARD_DEFAULT_SCENARIO,
  PLASTERBOARD_SCENARIO_LABEL
} from "./logic";
import type {
  CalculatorProductRef,
  PlasterboardInputs,
  PlasterboardScenario
} from "./logic";

export type UsePlasterboardCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: PlasterboardScenario;
};

export function usePlasterboardCalc(options?: UsePlasterboardCalcOptions) {
  const [scenario, setScenario] = useState<PlasterboardScenario>(
    options?.initialScenario ?? PLASTERBOARD_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in PlasterboardScenario]: Extract<
      PlasterboardInputs,
      { scenario: K }
    >;
  }>(PLASTERBOARD_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_PLASTERBOARD_PRODUCT;
  const inputs = inputsByScenario[scenario] as PlasterboardInputs;

  const result = useMemo(
    () => computePlasterboard(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => plasterboardComplementarySubcategories(scenario),
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
    scenarioLabel: PLASTERBOARD_SCENARIO_LABEL[scenario],
    scenarioLabels: PLASTERBOARD_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
