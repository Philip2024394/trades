// useFlooringCalc — shared state hook for all 3 size variants.

"use client";

import { useMemo, useState } from "react";
import {
  computeFlooring,
  FALLBACK_FLOORING_PRODUCT,
  flooringComplementarySubcategories,
  FLOORING_DEFAULT_INPUTS_BY_SCENARIO,
  FLOORING_DEFAULT_SCENARIO,
  FLOORING_SCENARIO_LABEL
} from "./logic";
import type {
  CalculatorProductRef,
  FlooringInputs,
  FlooringScenario
} from "./logic";

export type UseFlooringCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: FlooringScenario;
};

export function useFlooringCalc(options?: UseFlooringCalcOptions) {
  const [scenario, setScenario] = useState<FlooringScenario>(
    options?.initialScenario ?? FLOORING_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in FlooringScenario]: Extract<FlooringInputs, { scenario: K }>;
  }>(FLOORING_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_FLOORING_PRODUCT;
  const inputs = inputsByScenario[scenario] as FlooringInputs;

  const result = useMemo(
    () => computeFlooring(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => flooringComplementarySubcategories(scenario),
    [scenario]
  );

  const updateField = (field: string, value: unknown) => {
    setInputsByScenario((prev) => ({
      ...prev,
      [scenario]: { ...prev[scenario], [field]: value }
    }));
  };

  /** Multi-room helpers — add / remove / edit a zone. */
  const addZone = () => {
    setInputsByScenario((prev) => {
      const current = prev.multi_room;
      return {
        ...prev,
        multi_room: {
          ...current,
          zones: [
            ...current.zones,
            { name: `Zone ${current.zones.length + 1}`, length_m: 3, width_m: 3 }
          ]
        }
      };
    });
  };

  const removeZone = (index: number) => {
    setInputsByScenario((prev) => {
      const current = prev.multi_room;
      if (current.zones.length <= 1) return prev;
      return {
        ...prev,
        multi_room: {
          ...current,
          zones: current.zones.filter((_, i) => i !== index)
        }
      };
    });
  };

  const updateZone = (
    index: number,
    field: "name" | "length_m" | "width_m",
    value: string | number
  ) => {
    setInputsByScenario((prev) => {
      const current = prev.multi_room;
      const zones = current.zones.map((z, i) =>
        i === index ? { ...z, [field]: value } : z
      );
      return { ...prev, multi_room: { ...current, zones } };
    });
  };

  return {
    scenario,
    scenarioLabel: FLOORING_SCENARIO_LABEL[scenario],
    scenarioLabels: FLOORING_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField,
    addZone,
    removeZone,
    updateZone
  };
}
