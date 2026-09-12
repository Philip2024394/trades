// data/nex1-code-engine/novel-e/reservation-builder.ts
import type { Reservation } from "./schema";
export function buildReservations(locations: readonly string[]): Reservation[] {
  return locations.map((location, i) => ({ reservationId: `r${i}`, location }));
}
