// FlooringCalcPortrait — 3:4 tall for sidebars + mobile hero widgets.

"use client";

import { Layers } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useFlooringCalc } from "./useFlooringCalc";

export type FlooringCalcPortraitProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function FlooringCalcPortrait({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: FlooringCalcPortraitProps) {
  const calc = useFlooringCalc({ product });
  return (
    <SurfaceCard variant="primary" padding="md" className="w-full">
      <div className="mb-3">
        <Overline icon={Layers}>Flooring calculator</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          Estimate m² + labour
        </h3>
        <p className="text-[12px] text-neutral-600">
          UK trade waste % · 5 scenarios
        </p>
      </div>
      <ScenarioPicker
        scenario={calc.scenario}
        labels={calc.scenarioLabels}
        onChange={calc.changeScenario}
        mode="scroll"
      />
      <div className="mt-4">
        <InputForm
          scenario={calc.scenario}
          inputs={calc.inputs}
          onFieldChange={calc.updateField}
          onAddZone={calc.addZone}
          onRemoveZone={calc.removeZone}
          onUpdateZone={calc.updateZone}
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
          scenario={calc.scenario}
          scenarioLabel={calc.scenarioLabel}
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
