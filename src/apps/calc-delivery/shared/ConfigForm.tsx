// ConfigForm — owner's location + display toggles + Zone editor.

"use client";

import type { ChangeEvent } from "react";
import { TextInput, Toggle } from "@/platform/ui";
import { ZoneEditor } from "./ZoneEditor";
import type {
  DeliveryConfig,
  DeliveryZone,
  DeliveryZoneColor
} from "../logic";

export type ConfigFormProps = {
  config: DeliveryConfig;
  onPatchConfig: (patch: Partial<DeliveryConfig>) => void;
  onPatchZone: (color: DeliveryZoneColor, patch: Partial<DeliveryZone>) => void;
};

export function ConfigForm({
  config,
  onPatchConfig,
  onPatchZone
}: ConfigFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Owner location
        </div>
        <div className="flex flex-col gap-2">
          <TextInput
            id="owner_label"
            label="Business name / location label"
            value={config.owner_label}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onPatchConfig({ owner_label: e.currentTarget.value })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              id="owner_lat"
              type="number"
              label="Latitude"
              value={String(config.owner_lat)}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onPatchConfig({
                  owner_lat: parseFloat(e.currentTarget.value) || 0
                })
              }
              step={0.0001}
              hint="From Google Maps: right-click → coords"
            />
            <TextInput
              id="owner_lng"
              type="number"
              label="Longitude"
              value={String(config.owner_lng)}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onPatchConfig({
                  owner_lng: parseFloat(e.currentTarget.value) || 0
                })
              }
              step={0.0001}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Delivery zones (3 rings — closest to farthest)
        </div>
        <ZoneEditor zones={config.zones} onPatchZone={onPatchZone} />
      </section>

      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Display options
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-2.5">
          <Toggle
            id="show_zones"
            label="Show delivery zones"
            description="Colour-coded rings on the map"
            checked={config.show_zones}
            onChange={(v) => onPatchConfig({ show_zones: v })}
          />
          <Toggle
            id="show_directions_bar"
            label="Show directions bar"
            description="Compact strip with a Get directions → Google Maps CTA"
            checked={config.show_directions_bar}
            onChange={(v) => onPatchConfig({ show_directions_bar: v })}
          />
          <Toggle
            id="approximate_location"
            label="Show approximate location only"
            description="Replaces the exact pin with a ~500 m fuzzy area (privacy)"
            checked={config.approximate_location}
            onChange={(v) => onPatchConfig({ approximate_location: v })}
          />
        </div>
      </section>
    </div>
  );
}
