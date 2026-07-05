// DeliveryCalcLandscape — 4:3 / 16:9 wide layout.
//
// Left: config panel (owner). Right: public view (map + zones +
// directions bar). Live preview — every change reflects immediately.

"use client";

import { MapPin } from "lucide-react";
import { SectionHeader, SurfaceCard } from "@/platform/ui";
import { ConfigForm } from "./shared/ConfigForm";
import { PublicView } from "./shared/PublicView";
import { useDeliveryCalc } from "./useDeliveryCalc";

export type DeliveryCalcLandscapeProps = {
  initialLat?: number;
  initialLng?: number;
  initialLabel?: string;
};

export function DeliveryCalcLandscape({
  initialLat,
  initialLng,
  initialLabel
}: DeliveryCalcLandscapeProps) {
  const calc = useDeliveryCalc({
    initial: {
      ...(typeof initialLat === "number" ? { owner_lat: initialLat } : {}),
      ...(typeof initialLng === "number" ? { owner_lng: initialLng } : {}),
      ...(initialLabel ? { owner_label: initialLabel } : {})
    }
  });
  return (
    <SurfaceCard variant="primary" padding="lg" className="w-full">
      <div className="mb-4">
        <SectionHeader
          overline="Delivery zones"
          overlineIcon={MapPin}
          title="Zones · directions · location"
          subtitle="3 concentric zones with per-zone pricing · Google Maps directions bar · approximate-location privacy toggle"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          <ConfigForm
            config={calc.config}
            onPatchConfig={calc.patchConfig}
            onPatchZone={calc.patchZone}
          />
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Live preview
          </div>
          <PublicView config={calc.config} mapHeightPx={360} />
        </div>
      </div>
    </SurfaceCard>
  );
}
