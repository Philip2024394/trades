// DirectionsBar — compact strip below the map with turn-arrow chips +
// "Get directions" CTA. Tap opens Google Maps with the owner's
// destination — Google fills in the visitor's current location.

"use client";

import {
  ArrowRight,
  ArrowUp,
  CornerDownLeft,
  CornerDownRight,
  Navigation
} from "lucide-react";
import { Button } from "@/platform/ui";
import { googleMapsDirectionsUrl } from "../logic";

export type DirectionsBarProps = {
  ownerLat: number;
  ownerLng: number;
  ownerLabel?: string;
};

export function DirectionsBar({
  ownerLat,
  ownerLng,
  ownerLabel
}: DirectionsBarProps) {
  const openMaps = () => {
    const url = googleMapsDirectionsUrl(ownerLat, ownerLng, ownerLabel);
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener");
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2">
      <div className="flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-1">
        <CornerDownLeft className="h-3.5 w-3.5 text-neutral-600" />
        <ArrowUp className="h-3.5 w-3.5 text-neutral-600" />
        <ArrowRight className="h-3.5 w-3.5 text-neutral-600" />
        <CornerDownRight className="h-3.5 w-3.5 text-neutral-600" />
      </div>
      <div className="min-w-0 flex-1 truncate text-[11px] text-neutral-600">
        Turn-by-turn directions to{" "}
        <span className="font-semibold text-neutral-900">
          {ownerLabel || "owner"}
        </span>
      </div>
      <Button intent="primary" size="sm" icon={Navigation} onClick={openMaps}>
        Get directions
      </Button>
    </div>
  );
}
