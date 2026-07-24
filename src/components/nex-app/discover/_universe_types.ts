// FloatingProfileUniverse — shared types for the bubble universe.
// The universe manages a fixed number of "slots" (bubbles visible on
// screen), each with a profile assignment + animation state. When a
// bubble drifts off the bottom of the viewport its slot is reassigned
// to a new profile.

import type { DiscoverProfile } from "@/lib/nex/discover/_types";

export type UniverseCategory = {
  id:       string;
  label:    string;
  match:    (p: DiscoverProfile) => boolean;   // filter predicate
};

export type BubbleLifecycle = "entering" | "floating" | "selected" | "dismissing";
