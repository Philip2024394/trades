// useDeliveryCalc — shared state hook.
//
// Owner-editable config: location + 3 zones + 3 toggles. Zones are
// kept in the fixed order [green, yellow, red] and sanitised on
// mutation so their radii stay non-overlapping.

"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_DELIVERY_CONFIG,
  sanitiseZones
} from "./logic";
import type {
  DeliveryConfig,
  DeliveryZone,
  DeliveryZoneColor
} from "./logic";

export type UseDeliveryCalcOptions = {
  initial?: Partial<DeliveryConfig>;
};

export function useDeliveryCalc(options?: UseDeliveryCalcOptions) {
  const [config, setConfig] = useState<DeliveryConfig>({
    ...DEFAULT_DELIVERY_CONFIG,
    ...(options?.initial ?? {})
  });

  const patchConfig = useCallback((patch: Partial<DeliveryConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchZone = useCallback(
    (color: DeliveryZoneColor, patch: Partial<DeliveryZone>) => {
      setConfig((prev) => {
        const next = prev.zones.map((z) =>
          z.color === color ? { ...z, ...patch } : z
        );
        return { ...prev, zones: sanitiseZones(next) };
      });
    },
    []
  );

  return {
    config,
    patchConfig,
    patchZone
  };
}

export type UseDeliveryCalcReturn = ReturnType<typeof useDeliveryCalc>;
