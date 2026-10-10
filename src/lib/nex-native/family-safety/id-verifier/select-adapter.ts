// src/lib/nex-native/family-safety/id-verifier/select-adapter.ts
//
// NEX Family Safety · ID verifier · adapter selector.
// --------------------------------------------------------------------
// The current wave hard-wires `StubPendingVendorAdapter`. When the
// founder picks a real vendor, add a new adapter class and extend the
// selector · the service layer never changes.

import "server-only";

import { StubPendingVendorAdapter } from "./stub-pending-vendor-adapter";
import type { IdVerifierAdapter } from "./types";

/**
 * Pick the adapter for the current wave. The sealed stub is the only
 * supported option · future vendor adapters register here.
 */
export function selectAdapter(): IdVerifierAdapter {
  return new StubPendingVendorAdapter();
}
