// DeliveryCalcSquare — 1:1 aspect. Tabbed between public view + config.

"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { Overline, SurfaceCard } from "@/platform/ui";
import { ConfigForm } from "./shared/ConfigForm";
import { PublicView } from "./shared/PublicView";
import { TabPicker } from "./shared/TabPicker";
import type { DeliveryTab } from "./shared/TabPicker";
import { useDeliveryCalc } from "./useDeliveryCalc";

export type DeliveryCalcSquareProps = {
  initialLat?: number;
  initialLng?: number;
  initialLabel?: string;
};

export function DeliveryCalcSquare({
  initialLat,
  initialLng,
  initialLabel
}: DeliveryCalcSquareProps) {
  const [tab, setTab] = useState<DeliveryTab>("public");
  const calc = useDeliveryCalc({
    initial: {
      ...(typeof initialLat === "number" ? { owner_lat: initialLat } : {}),
      ...(typeof initialLng === "number" ? { owner_lng: initialLng } : {}),
      ...(initialLabel ? { owner_label: initialLabel } : {})
    }
  });
  return (
    <SurfaceCard
      variant="primary"
      padding="md"
      className="flex aspect-square w-full flex-col"
    >
      <div className="mb-2">
        <Overline icon={MapPin}>Delivery zones</Overline>
      </div>
      <div className="mb-2">
        <TabPicker tab={tab} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {tab === "public" ? (
          <PublicView config={calc.config} mapHeightPx={220} />
        ) : (
          <ConfigForm
            config={calc.config}
            onPatchConfig={calc.patchConfig}
            onPatchZone={calc.patchZone}
          />
        )}
      </div>
    </SurfaceCard>
  );
}
