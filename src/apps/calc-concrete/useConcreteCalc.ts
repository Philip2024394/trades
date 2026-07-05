// useConcreteCalc — shared state hook for all 3 size variants.

"use client";

import { useMemo, useState } from "react";
import {
  computeConcrete,
  concreteComplementarySubcategories,
  CONCRETE_DEFAULT_INPUTS_BY_SCENARIO,
  CONCRETE_DEFAULT_SCENARIO,
  CONCRETE_SCENARIO_LABEL,
  FALLBACK_CONCRETE_PRODUCT
} from "./logic";
import type {
  CalculatorProductRef,
  ConcreteInputs,
  ConcreteScenario
} from "./logic";

export type UseConcreteCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: ConcreteScenario;
};

export function useConcreteCalc(options?: UseConcreteCalcOptions) {
  const [scenario, setScenario] = useState<ConcreteScenario>(
    options?.initialScenario ?? CONCRETE_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in ConcreteScenario]: Extract<ConcreteInputs, { scenario: K }>;
  }>(CONCRETE_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_CONCRETE_PRODUCT;
  const inputs = inputsByScenario[scenario] as ConcreteInputs;

  const result = useMemo(
    () => computeConcrete(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => concreteComplementarySubcategories(scenario),
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
    scenarioLabel: CONCRETE_SCENARIO_LABEL[scenario],
    scenarioLabels: CONCRETE_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
