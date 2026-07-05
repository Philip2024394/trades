// useDeckingCalc — shared state hook.

"use client";

import { useMemo, useState } from "react";
import {
  computeDecking,
  DECKING_DEFAULT_INPUTS_BY_SCENARIO,
  DECKING_DEFAULT_SCENARIO,
  DECKING_SCENARIO_LABEL,
  deckingComplementarySubcategories,
  FALLBACK_DECKING_PRODUCT
} from "./logic";
import type {
  CalculatorProductRef,
  DeckingInputs,
  DeckingScenario
} from "./logic";

export type UseDeckingCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: DeckingScenario;
};

export function useDeckingCalc(options?: UseDeckingCalcOptions) {
  const [scenario, setScenario] = useState<DeckingScenario>(
    options?.initialScenario ?? DECKING_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in DeckingScenario]: Extract<DeckingInputs, { scenario: K }>;
  }>(DECKING_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_DECKING_PRODUCT;
  const inputs = inputsByScenario[scenario] as DeckingInputs;

  const result = useMemo(
    () => computeDecking(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => deckingComplementarySubcategories(scenario),
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
    scenarioLabel: DECKING_SCENARIO_LABEL[scenario],
    scenarioLabels: DECKING_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
