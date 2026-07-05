// useInsulationCalc — shared state hook.
//
// The FALLBACK product switches per scenario (loft = mineral wool
// roll, cavity = PIR cavity board, floor + roof = PIR sheet).

"use client";

import { useMemo, useState } from "react";
import {
  computeInsulation,
  FALLBACK_INSULATION_PRODUCT_BY_SCENARIO,
  insulationComplementarySubcategories,
  INSULATION_DEFAULT_INPUTS_BY_SCENARIO,
  INSULATION_DEFAULT_SCENARIO,
  INSULATION_SCENARIO_LABEL
} from "./logic";
import type {
  CalculatorProductRef,
  InsulationInputs,
  InsulationScenario
} from "./logic";

export type UseInsulationCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: InsulationScenario;
};

export function useInsulationCalc(options?: UseInsulationCalcOptions) {
  const [scenario, setScenario] = useState<InsulationScenario>(
    options?.initialScenario ?? INSULATION_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in InsulationScenario]: Extract<InsulationInputs, { scenario: K }>;
  }>(INSULATION_DEFAULT_INPUTS_BY_SCENARIO);

  // Product priority: caller-provided override > per-scenario fallback
  const product =
    options?.product ?? FALLBACK_INSULATION_PRODUCT_BY_SCENARIO[scenario];
  const inputs = inputsByScenario[scenario] as InsulationInputs;

  const result = useMemo(
    () => computeInsulation(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => insulationComplementarySubcategories(scenario),
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
    scenarioLabel: INSULATION_SCENARIO_LABEL[scenario],
    scenarioLabels: INSULATION_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
