// Platform Runtime — manifest-driven event discovery.
//
// The App Registry knows every installed manifest. Manifests declare
// `events.publishes` (kinds this App emits) and `events.subscribes`
// (kinds this App listens for). This module lets consumers ask
// "which Apps care about event X?" without hardcoding App slugs
// anywhere.
//
// Used by:
//   • The App Store UI ("this App publishes X — 3 other Apps consume it")
//   • The future delivery worker (Phase 6.5) to route persisted events
//     to per-App subscribers
//   • The AI Industry Pack Composer to recognise natural pipelines

import { appRegistry } from "../registry";
import type { FrozenAppManifest } from "../manifest/types";

/** Every App that declares itself as a subscriber to `eventKind`.
 *  Match is exact — no wildcard support in v1 (Apps subscribing to
 *  "cart.*" isn't a real use case yet). */
export function appsSubscribedTo(
  eventKind: string
): FrozenAppManifest[] {
  return appRegistry
    .list()
    .filter((m) => m.events?.subscribes?.includes(eventKind));
}

/** Every App that declares itself as a publisher of `eventKind`. */
export function appsPublishing(
  eventKind: string
): FrozenAppManifest[] {
  return appRegistry
    .list()
    .filter((m) => m.events?.publishes?.includes(eventKind));
}

/** Full topology — every publisher/subscriber relationship declared
 *  across every registered App. Powers "event flow" diagrams in the
 *  admin UI. */
export function eventTopology(): {
  event: string;
  publishers: string[];
  subscribers: string[];
}[] {
  const kinds = new Map<
    string,
    { publishers: Set<string>; subscribers: Set<string> }
  >();
  for (const m of appRegistry.list()) {
    for (const kind of m.events?.publishes ?? []) {
      const bucket = kinds.get(kind) ?? {
        publishers: new Set(),
        subscribers: new Set()
      };
      bucket.publishers.add(m.slug);
      kinds.set(kind, bucket);
    }
    for (const kind of m.events?.subscribes ?? []) {
      const bucket = kinds.get(kind) ?? {
        publishers: new Set(),
        subscribers: new Set()
      };
      bucket.subscribers.add(m.slug);
      kinds.set(kind, bucket);
    }
  }
  const out: {
    event: string;
    publishers: string[];
    subscribers: string[];
  }[] = [];
  for (const [event, { publishers, subscribers }] of kinds) {
    out.push({
      event,
      publishers: Array.from(publishers).sort(),
      subscribers: Array.from(subscribers).sort()
    });
  }
  out.sort((a, b) => a.event.localeCompare(b.event));
  return out;
}

/** True if any registered App publishes this kind. Useful to validate
 *  at publish time — a durable publish of a kind no App declares is
 *  usually a typo. Returns true also for platform-only kinds (prefix
 *  "platform.") that are emitted by the Runtime itself. */
export function isDeclaredEventKind(eventKind: string): boolean {
  if (eventKind.startsWith("platform.")) return true;
  return appsPublishing(eventKind).length > 0;
}
