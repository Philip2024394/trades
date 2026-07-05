// BricksCalcLandscape — 4:3 / 16:9 wide layout.

"use client";

import { Boxes } from "lucide-react";
import { SectionHeader, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useBricksCalc } from "./useBricksCalc";

export type BricksCalcLandscapeProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function BricksCalcLandscape({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: BricksCalcLandscapeProps) {
  const calc = useBricksCalc({ product });
  return (
    <SurfaceCard variant="primary" padding="lg" className="w-full">
      <div className="mb-4">
        <SectionHeader
          overline="Bricks + blocks calculator"
          overlineIcon={Boxes}
          title="Estimate bricks, blocks, packs, and mortar"
          subtitle="3 UK scenarios · 60 bricks/m² single skin · 10 blocks/m² · 22 L mortar per m² brickwork face"
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
