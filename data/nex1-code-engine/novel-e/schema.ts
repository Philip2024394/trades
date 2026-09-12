// data/nex1-code-engine/novel-e/schema.ts
//
// Novel Capability E fixture · shared schema · file A.
// Different interface names, different property names, different types,
// different caller filenames from the Capability E training fixtures.

export interface ReservationMeta {
  readonly source: string;
  readonly channel: number;
}

export interface Reservation {
  readonly reservationId: string;
  readonly location: string;
}

export interface Vehicle {
  readonly vin: string;
  readonly location: string;
}

export interface Payment {
  readonly transactionId: string;
  readonly currency: string;
}

export interface LocationRecord {
  readonly locationId: string;
  readonly city: string;
}

export interface WildcardRow {
  readonly recordId: string;
  readonly summary: string;
}
