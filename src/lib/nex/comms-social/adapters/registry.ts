// NEX Comms Centre · Social · adapter registry.
//
// Central lookup from platform → adapter. Adapter modules register
// themselves here at import time. The engine/API layer NEVER imports
// an adapter directly — it always goes through this registry.
//
// Phase 1 registers only the simulator. Real providers (Meta · IG ·
// LinkedIn · TikTok · Google Business) register in Phase 5.

import type { SocialPlatform } from "../types";
import type { SocialProvider } from "./interface";
import { createSimulatorAdapter } from "./simulator";

// Lazy singleton so we can hot-reload adapters in dev.
const adapters = new Map<SocialPlatform, SocialProvider>();

function ensureRegistered(): void {
  if (adapters.size === 0) {
    adapters.set("simulator", createSimulatorAdapter());
    // Phase 5: adapters.set("facebook", createMetaAdapter()) · etc.
  }
}

export function getAdapter(platform: SocialPlatform): SocialProvider {
  ensureRegistered();
  const a = adapters.get(platform);
  if (!a) throw new Error(`comms-social/adapters: no adapter registered for platform '${platform}'`);
  return a;
}

export function listRegisteredPlatforms(): SocialPlatform[] {
  ensureRegistered();
  return Array.from(adapters.keys());
}

// Test-only affordance — reset the registry so tests can inject fakes.
export const __resetAdaptersForTests = () => { adapters.clear(); };
