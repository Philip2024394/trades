// OS Event Bus — subscription registry.
//
// In-memory map of eventType → list of subscribers. Populated at
// module-load time by app subscription modules (each app has one
// `src/lib/<slug>/subscriptions.ts` that calls `register()`).
//
// This module is intentionally small: the runtime store lives in
// memory, but every delivery attempt is persisted in os_event_deliveries
// so a process restart never loses state.
import "server-only";
import type { OsEventType, Subscription } from "./types";

const REGISTRY = new Map<OsEventType, Subscription[]>();
const KNOWN_SLUGS = new Set<string>();

export function register(sub: Subscription): void {
  if (KNOWN_SLUGS.has(sub.subscriberSlug)) {
    // Idempotent — a subscription module reloaded (dev HMR) just
    // replaces the handler in place.
    unregister(sub.subscriberSlug);
  }
  KNOWN_SLUGS.add(sub.subscriberSlug);
  const list = REGISTRY.get(sub.eventType) || [];
  list.push(sub);
  REGISTRY.set(sub.eventType, list);
}

export function unregister(subscriberSlug: string): void {
  KNOWN_SLUGS.delete(subscriberSlug);
  for (const [type, subs] of REGISTRY.entries()) {
    const filtered = subs.filter((s) => s.subscriberSlug !== subscriberSlug);
    if (filtered.length !== subs.length) {
      REGISTRY.set(type, filtered);
    }
  }
}

export function subscribersFor(eventType: OsEventType): Subscription[] {
  return REGISTRY.get(eventType) ?? [];
}

export function findSubscriber(slug: string): Subscription | null {
  for (const subs of REGISTRY.values()) {
    const found = subs.find((s) => s.subscriberSlug === slug);
    if (found) return found;
  }
  return null;
}

export function allSubscribers(): Subscription[] {
  const seen = new Set<string>();
  const out: Subscription[] = [];
  for (const subs of REGISTRY.values()) {
    for (const s of subs) {
      if (seen.has(s.subscriberSlug)) continue;
      seen.add(s.subscriberSlug);
      out.push(s);
    }
  }
  return out;
}
