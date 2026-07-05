// RoofTilesCalcPortrait — 3:4 tall.

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

export type RoofTilesCalcPortraitProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function RoofTilesCalcPortrait({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: RoofTilesCalcPortraitProps) {
  const calc = useRoofTilesCalc({ product });
  return (
    <SurfaceCard variant="primary" padding="md" className="w-full">
      <div className="mb-3">
        <Overline icon={Home}>Roof calculator</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          Tiles · slates · membrane · battens
        </h3>
        <p className="text-[12px] text-neutral-600">
          Retile · reslate · full strip and re-roof
        </p>
      </div>
      <ScenarioPicker
        scope={calc.scope}
        labels={calc.scopeLabels}
        onChange={calc.changeScope}
        mode="scroll"
      />
      <div className="mt-4">
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
      </div>
      <div className="mt-4">
        <ResultPanel result={calc.result} density="full" />
      </div>
      <div className="mt-3">
        <ShoppingList
          subcategories={calc.crossSellSubcategories}
          density="list"
        />
      </div>
      <div className="mt-4">
        <Handoff
          result={calc.result}
          scope={calc.scope}
          scopeLabel={calc.scopeLabel}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          showAddToCart={!hideAddToCart}
          stack
        />
      </div>
    </SurfaceCard>
  );
}
