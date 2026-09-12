// data/nex1-code-engine/novel-e/location-index.ts
import type { LocationRecord } from "./schema";
export function indexLocations(cities: readonly string[]): LocationRecord[] {
  return cities.map((city, i) => ({ locationId: `l${i}`, city }));
}
