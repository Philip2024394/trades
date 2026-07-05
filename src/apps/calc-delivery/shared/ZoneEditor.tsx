// ZoneEditor — 3 cards (green / yellow / red) with radius + price +
// free-toggle. Owner sets these once; customer sees the rings applied.

"use client";

import type { ChangeEvent } from "react";
import { TextInput, Toggle } from "@/platform/ui";
import { DELIVERY_ZONE_COLOURS, DELIVERY_ZONE_LABEL } from "../logic";
import type { DeliveryZone, DeliveryZoneColor } from "../logic";

export type ZoneEditorProps = {
  zones: DeliveryZone[];
  onPatchZone: (color: DeliveryZoneColor, patch: Partial<DeliveryZone>) => void;
};

const ORDER: DeliveryZoneColor[] = ["green", "yellow", "red"];

export function ZoneEditor({ zones, onPatchZone }: ZoneEditorProps) {
  const byColor = new Map(zones.map((z) => [z.color, z]));

  return (
    <div className="flex flex-col gap-2">
      {ORDER.map((color) => {
        const z = byColor.get(color);
        if (!z) return null;
        const c = DELIVERY_ZONE_COLOURS[color];
        return (
          <div
            key={color}
            className="rounded-lg border border-neutral-200 bg-white p-2.5"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <div
                className="h-4 w-4 shrink-0 rounded-full border-2"
                style={{
                  borderColor: c.stroke,
                  backgroundColor: c.fill
                }}
                aria-hidden
              />
              <div className="text-[12px] font-semibold text-neutral-900">
                {DELIVERY_ZONE_LABEL[color]}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
              <TextInput
                id={`zone-radius-${color}`}
                type="number"
                label="Radius"
                value={String(z.radius_km)}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onPatchZone(color, {
                    radius_km: parseFloat(e.currentTarget.value) || 0
                  })
                }
                min={0.1}
                step={0.5}
                suffix={
                  <span className="text-[10px] font-medium text-neutral-500">
                    km
                  </span>
                }
              />
              <TextInput
                id={`zone-price-${color}`}
                type="number"
                label="Price"
                value={String((z.price_pence / 100).toFixed(2))}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const pence = Math.round(
                    (parseFloat(e.currentTarget.value) || 0) * 100
                  );
                  onPatchZone(color, { price_pence: pence });
                }}
                disabled={z.free}
                min={0}
                step={0.5}
                prefix={
                  <span className="text-[11px] font-medium text-neutral-500">
                    £
                  </span>
                }
              />
              <div className="pb-0.5">
                <Toggle
                  id={`zone-free-${color}`}
                  label="Free"
                  checked={z.free}
                  onChange={(v) => onPatchZone(color, { free: v })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
