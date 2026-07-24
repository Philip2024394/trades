// Autonomy-mode resolver.
//
// Default = "manual" (advise-only). Merchants can opt into higher
// modes ONCE per-merchant persistence lands. Today the resolver
// accepts a per-call override so callers can preview higher modes.

import type { AutonomyMode, AutonomySettings, PreparedActionCategory } from "./types";

export const DEFAULT_MODE: AutonomyMode = "manual";
export const DEFAULT_TRUSTED_CATEGORIES: PreparedActionCategory[] = [];

export type ResolveAutonomyInput = {
  merchantSlug:      string;
  /** Optional override for the current request. When set, source =
   *  'merchant_override'. */
  override?:         { mode?: AutonomyMode; trusted_categories?: PreparedActionCategory[] };
};

export function resolveAutonomy(input: ResolveAutonomyInput): AutonomySettings {
  const override = input.override;
  if (override && (override.mode || override.trusted_categories)) {
    return {
      merchant_slug:      input.merchantSlug,
      mode:               override.mode ?? DEFAULT_MODE,
      trusted_categories: override.trusted_categories ?? DEFAULT_TRUSTED_CATEGORIES,
      source:             "merchant_override"
    };
  }
  return {
    merchant_slug:      input.merchantSlug,
    mode:               DEFAULT_MODE,
    trusted_categories: DEFAULT_TRUSTED_CATEGORIES,
    source:             "engine_default"
  };
}

/** Predicate — is this category auto-approvable under the mode?
 *
 *  Rules:
 *    manual     — never
 *    assisted   — never (prepared, merchant approves each)
 *    trusted    — yes IF category is in trusted_categories AND caller
 *                 flagged the action as reversible
 *    enterprise — yes IF category is in trusted_categories (policy
 *                 evaluation is caller-side beyond this scope)
 */
export function isAutoApprovable(
  category: PreparedActionCategory,
  reversible: boolean,
  settings: AutonomySettings
): boolean {
  if (settings.mode === "manual" || settings.mode === "assisted") return false;
  if (!settings.trusted_categories.includes(category)) return false;
  if (settings.mode === "trusted") return reversible;
  // enterprise — accept regardless of reversible, policy handled elsewhere
  return true;
}
