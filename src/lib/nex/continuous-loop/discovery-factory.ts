// src/lib/nex/continuous-loop/discovery-factory.ts
//
// UWI · Wave 8.F · Production adapter factory (deliberately empty by default)
// Founder-authorised programme.
//
// **CONSTITUTIONAL POSTURE PRESERVED.** This factory returns NO ADAPTERS
// by default. Adding HF / GitHub / any other ecosystem host to the live
// runtime discovery loop requires a Wave 6 M26 HMAC-signed human-authority
// action to add the host to the constitutional internet-gate allowlist.
//
// The cron route (`/api/cron/nex-continuous-discovery`) uses this factory
// so that scheduling the cron in `vercel.json` is safe: it fires, invokes
// the factory, receives an empty adapter list, and returns a report
// showing zero adapters registered. This proves the wiring works end-to-
// end without silently activating any external ecosystem access.
//
// When a Wave 6 M26 signature authorises live discovery, a follow-up
// implementation task replaces this factory with one that returns the
// authorised adapters. That change is intentionally OUT of Wave 8.F scope.

import type { AdapterSpec } from "./discovery-scheduler";

export interface DiscoveryFactoryConfig {
  /** Absolute count of adapters this factory would return if fully wired.
   *  Reported to operators for observability of the "how far are we from
   *  fully continuous" gap. */
  readonly potential_adapter_count: number;
  readonly notes: ReadonlyArray<string>;
}

export function buildProductionAdapterSpecs(): { specs: ReadonlyArray<AdapterSpec>; meta: DiscoveryFactoryConfig } {
  return {
    specs: [],
    meta: {
      potential_adapter_count: 2,   // HF (Wave 8.B) + GitHub (Wave 8.E) exist as adapter code
      notes: [
        "Wave 8.F cron scaffold shipped · zero adapters registered by default",
        "HF (Wave 8.B) and GitHub (Wave 8.E) adapters exist but their hosts are NOT on the internet-gate allowlist",
        "adding api.huggingface.co / api.github.com to the allowlist requires Wave 6 M26 HMAC-signed human-authority action",
        "cron scheduling in vercel.json is safe · this factory refuses to wire live discovery until authorised",
      ],
    },
  };
}
