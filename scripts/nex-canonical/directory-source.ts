// scripts/nex-canonical/directory-source.ts
//
// NEX Directory · Source interface + a deterministic mock source.
//
// A Source produces Candidates for a specific (country, source_id)
// pair. The runner orchestrates sources · it never talks to the
// outside world directly. Real-world source adapters (legacy PG,
// OSM Overpass, Wikidata, etc.) live in SEPARATE modules that
// implement this interface · they are NOT part of this build.

import type { Candidate } from "./generate-candidates";
import type { SourceCursor } from "./directory-log";

/** The possible outcomes of a `discoverBatch` call. */
export type DiscoverBatchResult =
  /** The source has no more batches · the runner may advance to the
   *  next source. */
  | { readonly kind: "exhausted" }
  /** Returned another batch of candidates · the cursor advances. */
  | {
      readonly kind: "more";
      readonly candidates: readonly Candidate[];
      readonly next_cursor: SourceCursor | null;
    }
  /** A recoverable failure · the runner should retry (with backoff).
   *  retry_after_ms is a hint; the runner may use its own policy. */
  | {
      readonly kind: "temporary_failure";
      readonly reason: string;
      readonly retry_after_ms?: number;
    }
  /** An unrecoverable failure · the runner marks the source failed
   *  and advances to the next one · the country does NOT complete
   *  just because one source failed. */
  | {
      readonly kind: "permanent_failure";
      readonly reason: string;
    };

/** A Source is a producer of Candidates for one (country, source_id). */
export interface DirectorySource {
  readonly source_id: string;
  readonly country: string;
  /** Fetch the next batch given the cursor from the previous batch,
   *  or `null` to start from the beginning. */
  readonly discoverBatch: (
    cursor: SourceCursor | null,
  ) => Promise<DiscoverBatchResult>;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Mock source · deterministic · for tests
// ═════════════════════════════════════════════════════════════════════

export interface MockSourceStep {
  readonly cursor: SourceCursor | null;
  readonly result: DiscoverBatchResult;
}

export interface MockSourceConfig {
  readonly source_id: string;
  readonly country: string;
  readonly steps: readonly MockSourceStep[];
}

/** Build a deterministic mock source. The `steps` list is consulted
 *  in order · the mock matches an incoming cursor against each step's
 *  `cursor` (by stable JSON equality) and returns the first matching
 *  step's `result`. If no match, returns `permanent_failure` ·
 *  mis-wired tests fail loudly instead of silently. */
export function createMockDirectorySource(
  config: MockSourceConfig,
): DirectorySource {
  const stepsRemaining: MockSourceStep[] = [...config.steps];
  return {
    source_id: config.source_id,
    country: config.country,
    discoverBatch: async (cursor) => {
      for (let i = 0; i < stepsRemaining.length; i++) {
        const step = stepsRemaining[i];
        if (cursorsEqual(step.cursor, cursor)) {
          stepsRemaining.splice(i, 1);
          return step.result;
        }
      }
      return {
        kind: "permanent_failure",
        reason: `mock source "${config.source_id}": no step matches cursor=${stableStringify(cursor)}`,
      };
    },
  };
}

function cursorsEqual(a: SourceCursor | null, b: SourceCursor | null): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") return JSON.stringify(obj);
  if (typeof obj === "boolean" || typeof obj === "string")
    return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            stableStringify((obj as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  }
  throw new Error("unsupported stableStringify input");
}
