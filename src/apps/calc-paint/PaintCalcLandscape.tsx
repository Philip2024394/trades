// PaintCalcLandscape — 4:3 / 16:9 wide layout.
//
// Left column: scenario picker (grid) + input form (comfy density).
// Right column: result panel + shopping list + handoff row.
//
// Ideal for: desktop embed inline on a service page, service card
// PDP, dashboard tab.

"use client";

import { SectionHeader, SurfaceCard } from "@/platform/ui";
import { Paintbrush } from "lucide-react";
import type { CalculatorProductRef } from "./logic";
import { InputForm } from "./shared/InputForm";
import { Handoff } from "./shared/Handoff";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { usePaintCalc } from "./usePaintCalc";

export type PaintCalcLandscapeProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function PaintCalcLandscape({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: PaintCalcLandscapeProps) {
  const calc = usePaintCalc({ product });

  return (
    <SurfaceCard variant="primary" padding="lg" className="w-full">
      <div className="mb-4">
        <SectionHeader
          overline="Paint calculator"
          overlineIcon={Paintbrush}
          title="Estimate paint, tins, and labour"
          subtitle="Nine scenarios · UK trade-standard coverage rates · no fluff"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Choose a scenario
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
