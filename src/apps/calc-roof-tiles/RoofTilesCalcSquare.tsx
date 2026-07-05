// RoofTilesCalcSquare — 1:1 aspect.

"use client";

import { Home } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useRoofTilesCalc } from "./useRoofTilesCalc";

export type RoofTilesCalcSquareProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  hideShoppingList?: boolean;
};

export function RoofTilesCalcSquare({
  product,
  whatsappNumber,
  hideShoppingList
}: RoofTilesCalcSquareProps) {
  const calc = useRoofTilesCalc({ product });
  return (
    <SurfaceCard
      variant="primary"
      padding="md"
      className="flex aspect-square w-full flex-col"
    >
      <div className="mb-2">
        <Overline icon={Home}>Roof calc</Overline>
        <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">
          {calc.scopeLabel}
        </div>
      </div>
      <ScenarioPicker
        scope={calc.scope}
        labels={calc.scopeLabels}
        onChange={calc.changeScope}
        mode="scroll"
      />
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
        <InputForm
          roofShape={calc.roofShape}
          onRoofShapeChange={calc.changeRoofShape}
          scope={calc.scope}
          allowedMaterials={calc.allowedMaterials}
          inputs={calc.inputs}
          onFieldChange={calc.updateField}
          valleyLengthM={calc.valleyLengthM}
          onValleyLengthChange={calc.setValleyLengthM}
          valleyMaterial={calc.valleyMaterial}
          onValleyMaterialChange={calc.setValleyMaterial}
          density="compact"
        />
        <div className="mt-3">
          <ResultPanel result={calc.result} density="condensed" />
        </div>
        {!hideShoppingList ? (
          <div className="mt-3">
            <ShoppingList
              subcategories={calc.crossSellSubcategories}
              density="chips"
            />
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <Handoff
          result={calc.result}
          scope={calc.scope}
          scopeLabel={calc.scopeLabel}
          whatsappNumber={whatsappNumber}
          showAddToCart={false}
          showShare={false}
          stack
        />
      </div>
    </SurfaceCard>
  );
}
