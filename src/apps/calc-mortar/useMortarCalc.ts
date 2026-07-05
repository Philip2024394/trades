// useMortarCalc — shared state hook.

"use client";

import { useMemo, useState } from "react";
import {
  computeMortar,
  FALLBACK_MORTAR_PRODUCT,
  mortarComplementarySubcategories,
  MORTAR_DEFAULT_INPUTS_BY_SCENARIO,
  MORTAR_DEFAULT_SCENARIO,
  MORTAR_SCENARIO_LABEL
} from "./logic";
import type {
  CalculatorProductRef,
  MortarInputs,
  MortarScenario
} from "./logic";

export type UseMortarCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: MortarScenario;
};

export function useMortarCalc(options?: UseMortarCalcOptions) {
  const [scenario, setScenario] = useState<MortarScenario>(
    options?.initialScenario ?? MORTAR_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in MortarScenario]: Extract<MortarInputs, { scenario: K }>;
  }>(MORTAR_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_MORTAR_PRODUCT;
  const inputs = inputsByScenario[scenario] as MortarInputs;

  const result = useMemo(
    () => computeMortar(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => mortarComplementarySubcategories(scenario),
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
    scenarioLabel: MORTAR_SCENARIO_LABEL[scenario],
    scenarioLabels: MORTAR_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
