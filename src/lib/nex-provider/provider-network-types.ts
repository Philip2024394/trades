// src/lib/nex-provider/provider-network-types.ts
//
// Shared types for the NEX Driver Network. These mirror the migration 090 enums.
// Kept in one file so every subsystem imports from the same source of truth.

export type DriverStatus =
  | "registered"
  | "documents_pending"
  | "documents_verified"
  | "suspended";

export type DriverAvailabilityState = "offline" | "online" | "on_trip";

export type DriverDocumentKind =
  | "national_id"
  | "driver_licence"
  | "vehicle_registration"
  | "vehicle_insurance"
  | "operator_permit"
  | "health_declaration"
  | "other";

export type DriverDocumentState = "uploaded" | "verified" | "rejected" | "expired";

export type TripJobType =
  // passenger
  | "passenger_car"
  | "passenger_motorbike"
  // parcel
  | "parcel_motorbike"
  | "parcel_car"
  // large goods
  | "large_goods_pickup"
  | "large_goods_small_truck"
  | "large_goods_truck"
  // specialisation labels
  | "hotel_to_airport"
  | "airport_to_hotel"
  | "shopping_pickup"
  | "local_delivery"
  | "luggage"
  | "family"
  | "tourist_trip";

export type TripRequestState =
  | "offered"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled_by_traveller";

export type TripState =
  | "accepted"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled_by_traveller"
  | "cancelled_by_driver"
  | "cancelled_by_system";

export type TripEventKind =
  | "request_offered"
  | "request_accepted"
  | "request_rejected"
  | "request_expired"
  | "driver_dispatched"
  | "driver_arrived"
  | "trip_started"
  | "trip_completed"
  | "trip_cancelled"
  | "fare_calculated"
  | "commission_applied";

export interface CommissionPolicy {
  policyId: string;
  jurisdiction: string;
  jobType: TripJobType | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  freeCompletedTripsPerMonth: number;   // e.g. 3
  rateAfterFree: number;                // 0.0 - 1.0 · e.g. 0.08 = 8%
  minWalletBalanceIdr: number;          // 0 default · dispatch floor for post-allowance drivers
  walletTopupUnitIdr: number;           // 10000 default · UI hint
  currency: "IDR";
  notes: string | null;
}

export type WalletTransactionKind =
  | "topup"
  | "commission_debit"
  | "refund_credit"
  | "admin_adjustment"
  | "payout_debit";

export interface DriverLocationConsent {
  consentId: string;
  driverId: string;
  grantedAt: Date;
  grantedVia: string;
  scope: "availability_only" | "trip_only" | "availability_and_trip";
  revokedAt: Date | null;
  revokedReason: string | null;
  deviceReference: string | null;
  legalNoticeVersion: string;
}
