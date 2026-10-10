// src/lib/nex-native/cross-db-reconciler/feature-flag.ts
//
// NEX Directory · Cross-DB Reconciler · env-driven feature gating.
//
// DEFAULTS
//   NEX_CROSS_DB_RECONCILER_ENABLED        · DEFAULT false
//     Master off switch. When false the reconciler returns
//     `feature_disabled` immediately and writes nothing to the audit
//     log. The founder flips this to "true" when ready to see the
//     reconciler attempt even its simulated path.
//
//   NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY  · DEFAULT true
//     Simulation gate. When true (default) and the master is on, the
//     reconciler logs `link_attempted` with simulated=true and returns
//     `simulation_only` — the Supabase client is NEVER invoked. The
//     operator flips this to "false" ONLY after the Supabase-side
//     migration lands and the founder authorises live writes.
//
// DOCTRINE
//   No module anywhere else may read these env vars directly. Every
//   consumer imports from this module so the activation story stays
//   centralised and auditable.
//
//   `isReconcilerSimulateOnly` returns TRUE by default even if the
//   env var is absent. The ONLY way to get live writes is for both
//   env vars to be explicitly set to their "live" values. This is
//   deliberate: a missing env var MUST never silently promote to the
//   dangerous path.

/**
 * Returns true iff the master kill-switch is explicitly flipped on.
 * All other values (undefined, empty, "false", "0", "no", etc.) keep
 * the reconciler off.
 */
export function isReconcilerEnabled(): boolean {
  return process.env.NEX_CROSS_DB_RECONCILER_ENABLED === "true";
}

/**
 * Returns true (safe default) unless the operator has explicitly set
 * the env var to the literal string "false". Any other value — unset,
 * empty, "FALSE", "0", "no", "disabled" — keeps the reconciler in
 * simulate-only mode. The strictness is intentional: the live path
 * is dangerous and must require an unambiguous opt-in.
 */
export function isReconcilerSimulateOnly(): boolean {
  return process.env.NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY !== "false";
}
