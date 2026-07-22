// Vehicle Intelligence — Module 4 per V3 Q14 + V3 Extended Q20.
// Real panel geometry per van model. Expands from vehicles.ts as we
// add manufacturer body-builder guides.
import type { IntelligenceModule, DesignContext, DesignRule } from ".";

export const VEHICLE_VERSION = "1.0.0";

// Panel-safe zones — placeholder starter data. Full body-builder
// guide integration lands as Phase 2 (per V3 Q20).
const SAFE_ZONES_BY_MODEL: Record<string, { safe: string[]; forbidden: string[] }> = {
  "Ford Transit Custom": {
    safe:      ["driver_door", "sliding_door_left", "rear_door_upper", "bonnet_flat"],
    forbidden: ["wheel_arches", "headlights", "tail_lights", "fuel_cap", "mirrors", "registration_plate", "door_handles"]
  },
  "Mercedes Sprinter": {
    safe:      ["driver_door", "sliding_door_left", "rear_door_upper", "bonnet_flat", "high_side_panel"],
    forbidden: ["wheel_arches", "headlights", "tail_lights", "fuel_cap", "mirrors", "registration_plate", "door_handles"]
  }
};

export const vehicleModule: IntelligenceModule = {
  id: "vehicle", version: VEHICLE_VERSION, category: "surface", supports: ["vehicle"],
  evaluate(ctx: DesignContext): DesignRule[] {
    const model = ctx.ir.vehicle?.model ?? "Ford Transit Custom";
    const zones = SAFE_ZONES_BY_MODEL[model] ?? SAFE_ZONES_BY_MODEL["Ford Transit Custom"];
    return [{
      id: "vehicle.safe-zones", module: "vehicle", version: VEHICLE_VERSION,
      outputs: {
        model,
        safe_zones:      zones.safe,
        forbidden_zones: zones.forbidden,
        phone_area:      "rear-centre",
        logo_width_pct:  ctx.ir.layout.style_anchor?.toLowerCase().includes("luxury") ? 11 : 14,
        rear_door_wrap:  "never" // never cross the rear door shut line
      },
      confidence: 1
    }];
  }
};
