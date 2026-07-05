// useTilesCalc — shared state hook for all 3 size variants.

"use client";

import { useMemo, useState } from "react";
import {
  computeTiles,
  FALLBACK_TILES_PRODUCT,
  tilesComplementarySubcategories,
  TILES_DEFAULT_INPUTS_BY_SCENARIO,
  TILES_DEFAULT_SCENARIO,
  TILES_SCENARIO_LABEL
} from "./logic";
import type {
  CalculatorProductRef,
  TilesInputs,
  TilesScenario
} from "./logic";

export type UseTilesCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: TilesScenario;
};

export function useTilesCalc(options?: UseTilesCalcOptions) {
  const [scenario, setScenario] = useState<TilesScenario>(
    options?.initialScenario ?? TILES_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in TilesScenario]: Extract<TilesInputs, { scenario: K }>;
  }>(TILES_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_TILES_PRODUCT;
  const inputs = inputsByScenario[scenario] as TilesInputs;

  const result = useMemo(
    () => computeTiles(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => tilesComplementarySubcategories(scenario),
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
    scenarioLabel: TILES_SCENARIO_LABEL[scenario],
    scenarioLabels: TILES_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
