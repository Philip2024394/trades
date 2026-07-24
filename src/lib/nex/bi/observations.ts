// Cross-domain observation streamer.
//
// The adapters already emit per-domain observations. This module
// unions them, ranks by severity, and returns the top N briefing
// bullets Nex should mention proactively.
//
// The engine caches snapshots per hour, so calling this on every
// chat request is cheap (in-memory hit after the first build).

import { buildBusinessSnapshot } from "./engine";
import type { Observation } from "./types";

export type StreamOptions = {
  merchantSlug: string;
  /** Max bullets to return. Default 5 — briefing stays scannable. */
  limit?:       number;
  /** Rolling window for the underlying snapshot. Default 30. */
  lookbackDays?: number;
  now?:         Date;
};

/** Return the top-severity observations for the merchant right now. */
export async function streamObservations(opts: StreamOptions): Promise<Observation[]> {
  const snapshot = await buildBusinessSnapshot({
    merchantSlug: opts.merchantSlug,
    lookbackDays: opts.lookbackDays ?? 30,
    now:          opts.now
  });
  const limit = opts.limit ?? 5;
  return snapshot.observations.slice(0, limit);
}

/** Formatted briefing-ready bullet lines. Never longer than `limit`. */
export async function briefingBullets(opts: StreamOptions): Promise<string[]> {
  const obs = await streamObservations(opts);
  return obs.map((o) => `- ${o.headline}`);
}
