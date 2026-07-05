// useRoofTilesCalc — shared state hook.
//
// State model:
//   - scope (retile / reslate / full_strip) — top scenario
//   - roofShape (gable / hip) — secondary input, maps to underlying calc's scenario
//   - inputsByShape stores gable + hip inputs separately so switching
//     shape preserves what the user typed
//   - material re-clamps to what the current scope allows

"use client";

import { useMemo, useState } from "react";
import {
  addValleyToResult,
  computeRoofTiles,
  fallbackProductForMaterial,
  filterResultForScope,
  ROOF_JOB_SCOPE_LABEL,
  ROOF_MATERIALS_BY_SCOPE,
  ROOF_TILES_DEFAULT_INPUTS_BY_SCENARIO,
  roofTilesComplementarySubcategories
} from "./logic";
import type {
  CalculatorProductRef,
  RoofJobScope,
  RoofMaterial,
  RoofTilesInputs,
  RoofTilesScenario,
  ValleyMaterial
} from "./logic";

export type UseRoofTilesCalcOptions = {
  product?: CalculatorProductRef;
  initialScope?: RoofJobScope;
};

const DEFAULT_MATERIAL_FOR_SCOPE: Record<RoofJobScope, RoofMaterial> = {
  retile_with_membrane: "concrete_interlocking",
  reslate_with_membrane: "natural_slate",
  full_strip: "concrete_interlocking"
};

export function useRoofTilesCalc(options?: UseRoofTilesCalcOptions) {
  const [scope, setScope] = useState<RoofJobScope>(
    options?.initialScope ?? "retile_with_membrane"
  );
  const [roofShape, setRoofShape] = useState<RoofTilesScenario>("gable");
  const [inputsByShape, setInputsByShape] = useState<{
    [K in RoofTilesScenario]: Extract<RoofTilesInputs, { scenario: K }>;
  }>(ROOF_TILES_DEFAULT_INPUTS_BY_SCENARIO);

  // Valley lining — added at the wrapper level since the lib calc
  // doesn't know about valleys. Zero valleys = zero line + zero cost.
  const [valleyLengthM, setValleyLengthM] = useState(0);
  const [valleyMaterial, setValleyMaterial] =
    useState<ValleyMaterial>("lead_code_4");

  // Product priority: caller-provided > per-material fallback
  const currentMaterial = inputsByShape[roofShape].tile_type as RoofMaterial;
  const product =
    options?.product ?? fallbackProductForMaterial(currentMaterial);
  const inputs = inputsByShape[roofShape] as RoofTilesInputs;

  const rawResult = useMemo(
    () => computeRoofTiles(inputs, product),
    [inputs, product]
  );
  const result = useMemo(() => {
    const filtered = filterResultForScope(rawResult, scope);
    return addValleyToResult(filtered, valleyLengthM, valleyMaterial);
  }, [rawResult, scope, valleyLengthM, valleyMaterial]);
  const crossSellSubcategories = useMemo(
    () => roofTilesComplementarySubcategories(roofShape),
    [roofShape]
  );

  const changeScope = (next: RoofJobScope) => {
    setScope(next);
    // Reclamp material if the current one isn't valid for the new scope
    const allowed = ROOF_MATERIALS_BY_SCOPE[next];
    if (!allowed.includes(currentMaterial)) {
      const nextMaterial = DEFAULT_MATERIAL_FOR_SCOPE[next];
      setInputsByShape((prev) => ({
        ...prev,
        gable: { ...prev.gable, tile_type: nextMaterial },
        hip: { ...prev.hip, tile_type: nextMaterial }
      }));
    }
  };

  const updateField = (field: string, value: unknown) => {
    setInputsByShape((prev) => ({
      ...prev,
      [roofShape]: { ...prev[roofShape], [field]: value }
    }));
  };

  return {
    scope,
    scopeLabel: ROOF_JOB_SCOPE_LABEL[scope],
    scopeLabels: ROOF_JOB_SCOPE_LABEL,
    changeScope,

    roofShape,
    changeRoofShape: setRoofShape,

    inputs,
    result,
    crossSellSubcategories,
    product,
    updateField,

    // Valley lining state — separate from underlying calc inputs
    valleyLengthM,
    valleyMaterial,
    setValleyLengthM,
    setValleyMaterial,

    // The material picker is scope-constrained
    allowedMaterials: ROOF_MATERIALS_BY_SCOPE[scope]
  };
}
