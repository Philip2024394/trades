// Delivery Platform · public exports + default registry seed.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import { register, clearRegistry } from "./registry";
import { SVG_EXPORTER, DEFAULT_STUBS } from "./exporters";

export { register, unregister, get, list, shippedFormats, deliver, clearRegistry, isRegistered } from "./registry";
export type { DeliveryFormat, DeliveryStatus, DeliveryOptions, DeliveryResult, Exporter } from "./types";
export { SVG_EXPORTER, DEFAULT_STUBS } from "./exporters";

/** Register the default exporter set (SVG shipped + 19 stubs). Idempotent. */
export function seedDefaults(): void {
  register(SVG_EXPORTER);
  for (const s of DEFAULT_STUBS) register(s);
}

/** Reset + reseed. Useful for tests. */
export function resetToDefaults(): void {
  clearRegistry();
  seedDefaults();
}
