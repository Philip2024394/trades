// FlooringCalcSquare — 1:1 aspect for grid tiles.

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

export type FlooringCalcSquareProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  hideShoppingList?: boolean;
};

export function FlooringCalcSquare({
  product,
  whatsappNumber,
  hideShoppingList
}: FlooringCalcSquareProps) {
  const calc = useFlooringCalc({ product });
  return (
    <SurfaceCard
      variant="primary"
      padding="md"
      className="flex aspect-square w-full flex-col"
    >
      <div className="mb-2">
        <Overline icon={Layers}>Flooring calc</Overline>
        <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">
          {calc.scenarioLabel}
        </div>
      </div>
      <ScenarioPicker
        scenario={calc.scenario}
        labels={calc.scenarioLabels}
        onChange={calc.changeScenario}
        mode="scroll"
      />
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
        <InputForm
          scenario={calc.scenario}
          inputs={calc.inputs}
          onFieldChange={calc.updateField}
          onAddZone={calc.addZone}
          onRemoveZone={calc.removeZone}
          onUpdateZone={calc.updateZone}
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
          scenario={calc.scenario}
          scenarioLabel={calc.scenarioLabel}
          whatsappNumber={whatsappNumber}
          showAddToCart={false}
          showShare={false}
          stack
        />
      </div>
    </SurfaceCard>
  );
}
