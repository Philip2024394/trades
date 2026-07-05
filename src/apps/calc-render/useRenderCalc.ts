// useRenderCalc — shared state hook.
//
// The fallback product tracks the render system — sand:cement is
// cheap; K Rend is 3-4× the price. Product swaps automatically when
// the user changes system, unless a caller-provided product is set.

"use client";

import { useMemo, useState } from "react";
import {
  computeRender,
  fallbackProductForSystem,
  RENDER_DEFAULT_INPUTS_BY_SCENARIO,
  RENDER_DEFAULT_SCENARIO,
  RENDER_SCENARIO_LABEL,
  renderComplementarySubcategories
} from "./logic";
import type {
  CalculatorProductRef,
  RenderInputs,
  RenderScenario
} from "./logic";

export type UseRenderCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: RenderScenario;
};

export function useRenderCalc(options?: UseRenderCalcOptions) {
  const [scenario, setScenario] = useState<RenderScenario>(
    options?.initialScenario ?? RENDER_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in RenderScenario]: Extract<RenderInputs, { scenario: K }>;
  }>(RENDER_DEFAULT_INPUTS_BY_SCENARIO);

  const inputs = inputsByScenario[scenario] as RenderInputs;
  const product =
    options?.product ?? fallbackProductForSystem(inputs.system);

  const result = useMemo(
    () => computeRender(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => renderComplementarySubcategories(scenario),
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
    scenarioLabel: RENDER_SCENARIO_LABEL[scenario],
    scenarioLabels: RENDER_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
