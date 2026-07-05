// registryKit — barrel.
//
// Public surface for the shared registry infrastructure. Every existing
// registry (Section, Blueprint, App, Pack, Design, Button, KG) will
// migrate onto this over time. New registries (Container, Layout,
// Theme, Asset, Form) should use this from day one.

export type {
  Deprecation,
  Frozen,
  MarketplaceMetadata,
  RegistrationBase,
  Registry,
  RegistryAnalyticsEvent,
  RegistryComposition,
  RegistryConfig,
  RegistryMetadata,
  RegistryRelationships,
  RegistrySnapshot
} from "./types";

export { createRegistry } from "./createRegistry";
export { deepFreeze } from "./deepFreeze";
export {
  NAMESPACED_ID_RE,
  SEMVER_RE,
  SLUG_RE,
  compareSemver,
  isNamespacedId,
  isSemver,
  isSlug
} from "./validators";
export { searchRegistrations } from "./search";
export { describeRegistration } from "./describe";
export { selfCheckRegistry } from "./selfCheck";
export type { SelfCheckReport } from "./selfCheck";
export { noopTelemetry, safeEmit } from "./telemetry";
