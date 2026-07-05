// useWallpaperCalc — shared state hook.

"use client";

import { useMemo, useState } from "react";
import {
  computeWallpaper,
  FALLBACK_WALLPAPER_PRODUCT,
  WALLPAPER_DEFAULT_INPUTS_BY_SCENARIO,
  WALLPAPER_DEFAULT_SCENARIO,
  WALLPAPER_SCENARIO_LABEL,
  wallpaperComplementarySubcategories
} from "./logic";
import type {
  CalculatorProductRef,
  WallpaperInputs,
  WallpaperScenario
} from "./logic";

export type UseWallpaperCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: WallpaperScenario;
};

export function useWallpaperCalc(options?: UseWallpaperCalcOptions) {
  const [scenario, setScenario] = useState<WallpaperScenario>(
    options?.initialScenario ?? WALLPAPER_DEFAULT_SCENARIO
  );
  const [inputsByScenario, setInputsByScenario] = useState<{
    [K in WallpaperScenario]: Extract<WallpaperInputs, { scenario: K }>;
  }>(WALLPAPER_DEFAULT_INPUTS_BY_SCENARIO);

  const product = options?.product ?? FALLBACK_WALLPAPER_PRODUCT;
  const inputs = inputsByScenario[scenario] as WallpaperInputs;

  const result = useMemo(
    () => computeWallpaper(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => wallpaperComplementarySubcategories(scenario),
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
    scenarioLabel: WALLPAPER_SCENARIO_LABEL[scenario],
    scenarioLabels: WALLPAPER_SCENARIO_LABEL,
    inputs,
    result,
    crossSellSubcategories,
    product,
    changeScenario: setScenario,
    updateField
  };
}
