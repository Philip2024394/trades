// data/nex1-code-engine/novel-e/vehicle-fleet.ts
import type { Vehicle } from "./schema";
export function assembleFleet(locations: readonly string[]): Vehicle[] {
  return locations.map((location, i) => ({ vin: `v${i}`, location }));
}
