// PaintCalcSquare — 1:1 aspect layout.
//
// Vertical stack: scenario picker (scroll) → input form (compact) →
// result panel (condensed).  Handoff = single WhatsApp button.
// Shopping list = compact chip row above handoff.
//
// Ideal for: feature grid tile, dashboard KPI-adjacent card,
// product-listing tile.

"use client";

import { Paintbrush } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { InputForm } from "./shared/InputForm";
import { Handoff } from "./shared/Handoff";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { usePaintCalc } from "./usePaintCalc";

export type PaintCalcSquareProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  hideShoppingList?: boolean;
};

export function PaintCalcSquare({
  product,
  whatsappNumber,
  hideShoppingList
}: PaintCalcSquareProps) {
  const calc = usePaintCalc({ product });

  return (
    <SurfaceCard variant="primary" padding="md" className="flex aspect-square w-full flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <Overline icon={Paintbrush}>Paint calc</Overline>
          <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">
            {calc.scenarioLabel}
          </div>
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
