// SkirtingCalcSquare — 1:1 aspect.

"use client";

import { Hammer } from "lucide-react";
import { useState } from "react";
import { Overline, SurfaceCard } from "@/platform/ui";
import { Handoff } from "./shared/Handoff";
import { QuoteForm } from "./shared/QuoteForm";
import { RatesForm } from "./shared/RatesForm";
import { ResultPanel } from "./shared/ResultPanel";
import { TabPicker } from "./shared/TabPicker";
import type { TrimTab } from "./shared/TabPicker";
import { useTrimCarpenterCalc } from "./useTrimCarpenterCalc";

export type SkirtingCalcSquareProps = {
  whatsappNumber?: string;
};

export function SkirtingCalcSquare({
  whatsappNumber
}: SkirtingCalcSquareProps) {
  const [tab, setTab] = useState<TrimTab>("quote");
  const calc = useTrimCarpenterCalc();
  return (
    <SurfaceCard
      variant="primary"
      padding="md"
      className="flex aspect-square w-full flex-col"
    >
      <div className="mb-2">
        <Overline icon={Hammer}>Trim carpenter</Overline>
      </div>
      <div className="mb-2">
        <TabPicker tab={tab} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {tab === "quote" ? (
          <QuoteForm
            enabledServices={calc.enabledServices}
            rates={calc.rates}
            quantities={calc.quantities}
            onQuantityChange={calc.setQuantity}
          />
        ) : (
          <RatesForm rates={calc.rates} onRateChange={calc.setRate} />
        )}
        <div className="mt-3">
          <ResultPanel result={calc.result} density="condensed" />
        </div>
      </div>
      <div className="mt-3">
        <Handoff
          result={calc.result}
          whatsappNumber={whatsappNumber}
          showShare={false}
          stack
        />
      </div>
    </SurfaceCard>
  );
}
