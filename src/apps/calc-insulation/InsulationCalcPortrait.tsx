// InsulationCalcPortrait — 3:4 tall.

"use client";

import { Snowflake } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useInsulationCalc } from "./useInsulationCalc";

export type InsulationCalcPortraitProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
};

export function InsulationCalcPortrait({
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart
}: InsulationCalcPortraitProps) {
  const calc = useInsulationCalc({ product });
  return (
    <SurfaceCard variant="primary" padding="md" className="w-full">
      <div className="mb-3">
        <Overline icon={Snowflake}>Insulation calculator</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          Loft · cavity · floor · pitched roof
        </h3>
        <p className="text-[12px] text-neutral-600">
          Part L 2025 UK U-value targets · cross-lay + DPM guidance
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
