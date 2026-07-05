// Booking Registry — barrel.
//
// Import side effect: `./flows` registers the 4 seed booking flows
// (simple, emergency, consultation, quote-only).

import "./flows";

export { bookingRegistry, REGISTRY_METADATA } from "./registry";
export { StrategyAwareBookingFlow } from "./StrategyAwareBookingFlow";
export type { StrategyAwareBookingFlowProps } from "./StrategyAwareBookingFlow";
export type {
  BookingFlowKind,
  BookingIntegrationKind,
  BookingManifest,
  BookingPolicy,
  BookingRendererProps,
  BookingStep,
  BookingStepKind,
  FrozenBookingManifest
} from "./types";
