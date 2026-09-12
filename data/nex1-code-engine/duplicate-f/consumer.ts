// data/nex1-code-engine/duplicate-f/consumer.ts
// Imports Vehicle from module-a explicitly. NEX1 must resolve to module-a.
import type { Vehicle } from "./module-a/vehicle";
export function buildFleet(plates: readonly string[]): Vehicle[] {
  return plates.map((plate, i) => ({ vin: `x${i}`, plate }));
}
