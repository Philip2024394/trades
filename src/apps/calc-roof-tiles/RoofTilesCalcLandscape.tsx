// RoofTilesCalcLandscape — 4:3 / 16:9 wide layout.

"use client";

import { Home } from "lucide-react";
import { SectionHeader, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useRoofTilesCalc } from "./useRoofTilesCalc";

export type RoofTilesCalcLandscapeProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function RoofTilesCalcLandscape({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: RoofTilesCalcLandscapeProps) {
  const calc = useRoofTilesCalc({ product });
  return (
    <SurfaceCard variant="primary" padding="lg" className="w-full">
      <div className="mb-4">
        <SectionHeader
          overline="Roof tiles & slate calculator"
          overlineIcon={Home}
          title="Tiles or slates, membrane + battens"
          subtitle="Retile + membrane · Reslate + membrane · Full strip and re-roof · pitch factor 1.04-1.41"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Choose a job scope
          </div>
          <ScenarioPicker
            scope={calc.scope}
            labels={calc.scopeLabels}
            onChange={calc.changeScope}
            mode="grid"
          />
          <div className="mt-5">
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
              density="comfy"
            />
          </div>
        </div>
        <div className="min-w-0">
          <ResultPanel result={calc.result} density="full" />
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
            />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
