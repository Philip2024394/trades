// DeckingCalcLandscape — 4:3 / 16:9 wide layout.

"use client";

import { Rows3 } from "lucide-react";
import { SectionHeader, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useDeckingCalc } from "./useDeckingCalc";

export type DeckingCalcLandscapeProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function DeckingCalcLandscape({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: DeckingCalcLandscapeProps) {
  const calc = useDeckingCalc({ product });
  return (
    <SurfaceCard variant="primary" padding="lg" className="w-full">
      <div className="mb-4">
        <SectionHeader
          overline="Decking calculator"
          overlineIcon={Rows3}
          title="Boards, joists, and screws for UK deck layouts"
          subtitle="Simple rectangle · L-shape · multi-level + steps · 144 mm boards + 5 mm gap · joists @ 400 mm centres"
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
