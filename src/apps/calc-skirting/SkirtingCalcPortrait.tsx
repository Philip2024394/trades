// SkirtingCalcPortrait — 3:4 tall.

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

export type SkirtingCalcPortraitProps = {
  whatsappNumber?: string;
  onShare?: () => void;
};

export function SkirtingCalcPortrait({
  whatsappNumber,
  onShare
}: SkirtingCalcPortraitProps) {
  const [tab, setTab] = useState<TrimTab>("quote");
  const calc = useTrimCarpenterCalc();
  return (
    <SurfaceCard variant="primary" padding="md" className="w-full">
      <div className="mb-3">
        <Overline icon={Hammer}>Trim carpenter</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          One calc · seven services
        </h3>
        <p className="text-[12px] text-neutral-600">
          Skirting · door frames · architrave · window boards · loft ladder
        </p>
      </div>
      <div className="mb-3">
        <TabPicker tab={tab} onChange={setTab} />
      </div>
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
      <div className="mt-4">
        <ResultPanel result={calc.result} />
      </div>
      <div className="mt-4">
        <Handoff
          result={calc.result}
          whatsappNumber={whatsappNumber}
          onShare={onShare}
          stack
        />
      </div>
    </SurfaceCard>
  );
}
