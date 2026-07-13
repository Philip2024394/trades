// Post Bus — the cross-area publish/subscribe primitive that carries
// composer output from the Universal Composer to whichever area(s)
// should receive it.
//
// Facebook analogy: when a user tags a photo of Group X and posts to
// their own timeline, TWO areas receive the event — Group X sees it in
// the group feed, followers see it in News Feed. Same event, multiple
// subscribers.
//
// Trade Center analogy: when Bob composes a Canteen post AND ticks
// "promote to Yard", TWO areas receive the event. When a merchant
// posts a TC product AND ticks "cross-post to Counter", TWO areas
// receive the event.
//
// Fixture-mode: subscribers register handlers, publisher fans out
// synchronously. Production: Supabase Realtime channel with an events
// table; every area subscribes to the channels it cares about.

import type { ComposerTypeKey } from "@/apps/hub/data/composerTypes";

export type PostEnvelope = {
  id: string;
  composerType: ComposerTypeKey;
  authorSlug: string;
  authorName: string;
  authorInitials: string;
  authorAreaLabel: string;
  authorAreaColour: string;
  body: string;
  imageUrl?: string;
  linkHref?: string;
  linkLabel?: string;
  areas: string[];              // ["trade-center", "canteen", "yard", "counter", ...]
  createdAtIso: string;
  metadata?: Record<string, unknown>;
};

type Subscriber = (post: PostEnvelope) => void;

const subscribers: Map<string, Subscriber[]> = new Map();

export function subscribeToArea(area: string, handler: Subscriber): () => void {
  const existing = subscribers.get(area) ?? [];
  existing.push(handler);
  subscribers.set(area, existing);
  return () => {
    const next = (subscribers.get(area) ?? []).filter((h) => h !== handler);
    subscribers.set(area, next);
  };
}

export function publishPost(post: PostEnvelope): void {
  for (const area of post.areas) {
    const handlers = subscribers.get(area) ?? [];
    for (const h of handlers) {
      try {
        h(post);
      } catch {
        // Subscribers must isolate their own failures.
      }
    }
  }
}

/**
 * Which areas should receive a given composer type by default. The
 * Universal Composer uses this map to fan out to the right subscribers
 * — one post, multiple destinations.
 */
export function defaultAreasFor(composerType: ComposerTypeKey): string[] {
  switch (composerType) {
    case "tc-product":         return ["trade-center", "merchant-feed"];
    case "canteen-post":       return ["canteen"];
    case "notebook-item":      return ["notebook"];
    case "yard-announcement":  return ["yard"];
    case "rate-update":        return ["rate-card", "trade-profile"];
    case "job-diary":          return ["job", "trade-profile-recent"];
    case "site-voice":         return ["site-mode"];
    case "counter-crosspost":  return ["counter", "trade-center"];
  }
}
