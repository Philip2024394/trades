// ConcreteCalcSquare — 1:1 aspect.

"use client";

import { Container } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { Handoff } from "./shared/Handoff";
import { InputForm } from "./shared/InputForm";
import { ResultPanel } from "./shared/ResultPanel";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ShoppingList } from "./shared/ShoppingList";
import { useConcreteCalc } from "./useConcreteCalc";

export type ConcreteCalcSquareProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  hideShoppingList?: boolean;
};

export function ConcreteCalcSquare({
  product,
  whatsappNumber,
  hideShoppingList
}: ConcreteCalcSquareProps) {
  const calc = useConcreteCalc({ product });
  return (
    <SurfaceCard
      variant="primary"
      padding="md"
      className="flex aspect-square w-full flex-col"
    >
      <div className="mb-2">
        <Overline icon={Container}>Concrete calc</Overline>
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
