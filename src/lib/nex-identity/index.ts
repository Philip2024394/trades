// NEX identity · public barrel.
//
// Concrete instantiation of pinned `project_nex_should_know_not_ask` at
// the onboarding layer. Captures the minimum NEX genuinely needs (name,
// WhatsApp, country) — NEVER language preference (NEX detects it from
// speech per Language-Neutral Brain invariant).

export type { NexCountry } from "./countries";
export {
  NEX_COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  findCountry,
  normaliseE164,
} from "./countries";

export type { NexIdentity, NexIdentityInput } from "./useNexIdentity";
export { useNexIdentity } from "./useNexIdentity";

export type { NexActivation, NexActivationState, UseNexActivationReturn } from "./useNexActivation";
export { useNexActivation } from "./useNexActivation";

export {
  generateInternalId,
  generatePublicNexId,
  normalisePublicNexId,
} from "./nexId";
