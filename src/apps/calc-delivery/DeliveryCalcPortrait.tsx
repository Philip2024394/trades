// DeliveryCalcPortrait — 3:4 tall. Map on top, tabbed content below.

"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { Overline, SurfaceCard } from "@/platform/ui";
import { ConfigForm } from "./shared/ConfigForm";
import { PublicView } from "./shared/PublicView";
import { TabPicker } from "./shared/TabPicker";
import type { DeliveryTab } from "./shared/TabPicker";
import { useDeliveryCalc } from "./useDeliveryCalc";

export type DeliveryCalcPortraitProps = {
  initialLat?: number;
  initialLng?: number;
  initialLabel?: string;
};

export function DeliveryCalcPortrait({
  initialLat,
  initialLng,
  initialLabel
}: DeliveryCalcPortraitProps) {
  const [tab, setTab] = useState<DeliveryTab>("public");
  const calc = useDeliveryCalc({
    initial: {
      ...(typeof initialLat === "number" ? { owner_lat: initialLat } : {}),
      ...(typeof initialLng === "number" ? { owner_lng: initialLng } : {}),
      ...(initialLabel ? { owner_label: initialLabel } : {})
    }
  });
  return (
    <SurfaceCard variant="primary" padding="md" className="w-full">
      <div className="mb-3">
        <Overline icon={MapPin}>Delivery zones</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          Zones · directions · location
        </h3>
        <p className="text-[12px] text-neutral-600">
          3 concentric rings, per-zone pricing, tap-through to Google Maps
        </p>
      </div>
      <div className="mb-3">
        <TabPicker tab={tab} onChange={setTab} />
      </div>
      {tab === "public" ? (
        <PublicView config={calc.config} mapHeightPx={280} />
      ) : (
        <ConfigForm
          config={calc.config}
          onPatchConfig={calc.patchConfig}
          onPatchZone={calc.patchZone}
        />
      )}
    </SurfaceCard>
  );
}
