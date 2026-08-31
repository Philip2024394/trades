// src/lib/nex/brain/world-adapters/index.ts
//
// Stage 3.34 · Phase 27 · World Adapter Registry (Philip 2026-08-31).
//
// One place the Brain dispatches to. Add a vertical here (and its
// adapter file), Presentation and composers pick it up for free.
//
// If a vertical is called that isn't registered, `searchWorld()`
// returns an empty result with `degradedReason:"vertical_unregistered"`.
// The Brain then falls back to editorial knowledge or a boundary reply.

import type {
  WorldAdapter,
  WorldRecord,
  WorldSearchInput,
  WorldSearchResult,
  WorldVertical,
  MarketCode,
} from "./types";
import { AccommodationPostgresAdapter } from "./accommodation-postgres";
import { FoodPostgresAdapter } from "./food-postgres";
import { ServicePostgresAdapter } from "./service-postgres";
import { CommercePostgresAdapter } from "./commerce-postgres";
import { TransportPostgresAdapter } from "./transport-postgres";

// Registry · imports the concrete adapter modules. Stage 3.34d ·
// Phase 27h ships food + commerce + service + transport alongside
// accommodation. `places` still has no `nex.places` table in the
// schema · left unregistered · caller receives honest empty result
// with `degradedReason: "vertical_unregistered"`.
const REGISTRY: Partial<Record<WorldVertical, WorldAdapter>> = {
  accommodation: AccommodationPostgresAdapter,
  food:          FoodPostgresAdapter,
  service:       ServicePostgresAdapter,
  commerce:      CommercePostgresAdapter,
  transport:     TransportPostgresAdapter,
};

/**
 * Canonical Brain-facing entry point. Every composer that needs live
 * World data calls this — never the raw pool, never a table adapter
 * directly. Returns an honest empty result when the vertical isn't
 * wired yet so upstream code doesn't crash.
 */
export async function searchWorld(input: WorldSearchInput): Promise<WorldSearchResult> {
  const adapter = REGISTRY[input.vertical];
  if (!adapter) {
    return {
      vertical: input.vertical,
      market: input.market,
      records: [],
      totalAvailable: 0,
      latencyMs: 0,
      degradedReason: "vertical_unregistered",
    };
  }
  return adapter.search(input);
}

/**
 * Fetch one record by id. Used by Reference Resolution ("book the
 * second one" → resolve to a business id → getWorldRecordById()).
 */
export async function getWorldRecordById(input: {
  vertical: WorldVertical;
  id: string;
  market: MarketCode;
}): Promise<WorldRecord | null> {
  const adapter = REGISTRY[input.vertical];
  if (!adapter?.getById) return null;
  return adapter.getById({ id: input.id, market: input.market });
}

export type {
  WorldAdapter,
  WorldRecord,
  WorldSearchInput,
  WorldSearchResult,
  WorldVertical,
  MarketCode,
} from "./types";
