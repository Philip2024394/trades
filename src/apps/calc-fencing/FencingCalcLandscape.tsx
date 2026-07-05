// FencingCalcLandscape — 4:3 / 16:9 wide layout.

"use client";

import { Fence } from "lucide-react";
import { SectionHeader, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useFencingCalc } from "./useFencingCalc";

export type FencingCalcLandscapeProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function FencingCalcLandscape({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: FencingCalcLandscapeProps) {
  const calc = useFencingCalc({ product });
  return (
    <SurfaceCard variant="primary" padding="lg" className="w-full">
      <div className="mb-4">
        <SectionHeader
          overline="Fencing calculator"
          overlineIcon={Fence}
          title="Panels, posts, postcrete + gate hardware"
          subtitle="Straight · L-corner · gated · 1.83 m panels default · 100×100 posts 600 mm deep"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Choose a layout
          </div>
          <ScenarioPicker
            scenario={calc.scenario}
            labels={calc.scenarioLabels}
            onChange={calc.changeScenario}
            mode="grid"
          />
          <div className="mt-5">
            <InputForm
              scenario={calc.scenario}
              inputs={calc.inputs}
              onFieldChange={calc.updateField}
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
              scenario={calc.scenario}
              scenarioLabel={calc.scenarioLabel}
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
