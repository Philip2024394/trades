// NEX Comms Centre · Social · adapter registry.
//
// Central lookup from platform → adapter. Adapter modules register
// themselves here at import time. The engine/API layer NEVER imports
// an adapter directly — it always goes through this registry.
//
// Phase 5 · real providers are registered CONDITIONALLY based on env
// var presence. Missing creds → adapter simply not registered →
// Phase 3 platform validator returns `fail_closed` on any post that
// targets that platform. This means the app boots in every environment
// (dev, staging, production) without every credential being set — the
// only cost is that specific platforms are marked unavailable.

import type { SocialPlatform } from "../types";
import type { SocialProvider } from "./interface";
import { createSimulatorAdapter } from "./simulator";
import { createMetaAdapter } from "./meta";
import { createInstagramAdapter } from "./instagram";
import { createLinkedInAdapter } from "./linkedin";
import { createTikTokAdapter } from "./tiktok";
import { createGoogleBusinessAdapter } from "./google_business";

// Lazy singleton so we can hot-reload adapters in dev.
const adapters = new Map<SocialPlatform, SocialProvider>();

// Try to construct an adapter; catch the "missing creds" error and
// return null so the registry treats the platform as unavailable
// rather than crashing at boot.
function tryCreate<T>(fn: () => T, name: string): T | null {
  try { return fn(); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("cannot start · missing")) {
      // eslint-disable-next-line no-console
      console.info(`[comms-social/adapters] ${name} not registered · missing env credentials`);
      return null;
    }
    throw e;
  }
}

function ensureRegistered(): void {
  if (adapters.size === 0) {
    // Simulator always registered · other providers only when creds present.
    adapters.set("simulator", createSimulatorAdapter());
    const meta = tryCreate(createMetaAdapter, "meta");
    if (meta) adapters.set("facebook", meta);
    const ig = tryCreate(createInstagramAdapter, "instagram");
    if (ig) adapters.set("instagram", ig);
    const li = tryCreate(createLinkedInAdapter, "linkedin");
    if (li) adapters.set("linkedin", li);
    const tt = tryCreate(createTikTokAdapter, "tiktok");
    if (tt) adapters.set("tiktok", tt);
    const gb = tryCreate(createGoogleBusinessAdapter, "google_business");
    if (gb) adapters.set("google_business", gb);
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
