// Trade config loader — resolves a Brain slug to its UI config.
// Every Brain surface (/nex-app/brains/[brain_slug]) calls this to
// bootstrap. V1: static registry keyed by both the legacy slug
// ("staircase") and the platform Brain slug ("staircases") so old
// links keep working while the platform migrates.
//
// V2: this will merge with the platform Brain registry so a single
// brain.json drives both the composer + the UI config.

import type { TradeConfig } from "./_types";
import { staircaseConfig } from "./configs/staircase";
import { plumberConfig } from "./configs/plumber";
import { generalConfig } from "./configs/general";

const REGISTRY: Record<string, TradeConfig> = {
  // Canonical platform Brain slugs
  general:    generalConfig,
  staircases: staircaseConfig,

  // Legacy aliases — keep every existing link working
  staircase:  staircaseConfig,
  plumber:    plumberConfig,
  plumbing:   plumberConfig
};

export function loadTradeConfig(slug: string): TradeConfig | null {
  return REGISTRY[slug] ?? null;
}

export function listAvailableTrades(): string[] {
  // Canonical Brain slugs only (deduped) for generateStaticParams
  return ["general", "staircases", "plumbing"];
}
