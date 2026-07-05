// SkirtingCalcLandscape — 4:3 wide layout with tabbed content.

"use client";

import { Hammer } from "lucide-react";
import { useState } from "react";
import { SectionHeader, SurfaceCard } from "@/platform/ui";
import { Handoff } from "./shared/Handoff";
import { QuoteForm } from "./shared/QuoteForm";
import { RatesForm } from "./shared/RatesForm";
import { ResultPanel } from "./shared/ResultPanel";
import { TabPicker } from "./shared/TabPicker";
import type { TrimTab } from "./shared/TabPicker";
import { useTrimCarpenterCalc } from "./useTrimCarpenterCalc";

export type SkirtingCalcLandscapeProps = {
  whatsappNumber?: string;
  onShare?: () => void;
};

export function SkirtingCalcLandscape({
  whatsappNumber,
  onShare
}: SkirtingCalcLandscapeProps) {
  const [tab, setTab] = useState<TrimTab>("quote");
  const calc = useTrimCarpenterCalc();
  return (
    <SurfaceCard variant="primary" padding="lg" className="w-full">
      <div className="mb-4">
        <SectionHeader
          overline="Trim Carpenter calculator"
          overlineIcon={Hammer}
          title="Skirting · door frames · architrave · window boards · loft ladder"
          subtitle="Set your prices in My rates — customer only sees priced services"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <div className="mb-3">
            <TabPicker tab={tab} onChange={setTab} />
          </div>
          <div className="max-h-[600px] overflow-y-auto pr-1">
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
          </div>
        </div>
        <div className="min-w-0">
          <ResultPanel result={calc.result} />
          <div className="mt-4">
            <Handoff
              result={calc.result}
              whatsappNumber={whatsappNumber}
              onShare={onShare}
            />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
