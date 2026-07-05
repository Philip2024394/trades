// PaintCalcPortrait — 3:4 / 4:5 tall layout.
//
// Vertical stack: overline + title → scenario picker (scroll) →
// input form (compact) → result panel (full) → shopping list (list) →
// handoff (stack).
//
// Ideal for: mobile hero widget, desktop sidebar, sticky floating
// card, PDP right-column.

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

export type PaintCalcPortraitProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function PaintCalcPortrait({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: PaintCalcPortraitProps) {
  const calc = usePaintCalc({ product });

  return (
    <SurfaceCard variant="primary" padding="md" className="w-full">
      <div className="mb-3">
        <Overline icon={Paintbrush}>Paint calculator</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          Estimate paint + labour
        </h3>
        <p className="text-[12px] text-neutral-600">
          UK trade coverage rates · 9 scenarios
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
