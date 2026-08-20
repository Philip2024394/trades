// Trade adapter registry.
//
// Every trade is one file in ./trades/. Adding a trade = one import +
// one line in ADAPTERS. The dispatcher tries each adapter's parse()
// in order; a non-null result wins. Alias matching (e.g. "plaster" →
// plastering) beats parser order when a tradeHint is supplied.

import type { TradeAdapter } from "./types";
import { plasteringAdapter } from "./trades/plastering";
import { concretingAdapter } from "./trades/concreting";
import { pavingAdapter } from "./trades/paving";
import { paintingAdapter } from "./trades/painting";
import { staircaseAdapter } from "./trades/staircase";

export const ADAPTERS: TradeAdapter[] = [
  plasteringAdapter,
  concretingAdapter,
  pavingAdapter,
  paintingAdapter,
  staircaseAdapter
];

export function findAdapter(brief: string, tradeHint?: string): TradeAdapter | null {
  const hint = tradeHint?.toLowerCase().trim();
  if (hint) {
    const byHint = ADAPTERS.find((a) => a.trade === hint || a.aliases.includes(hint));
    if (byHint) return byHint;
  }
  const t = brief.toLowerCase();
  for (const a of ADAPTERS) {
    for (const alias of [a.trade, ...a.aliases]) {
      if (t.includes(alias)) return a;
    }
  }
  return null;
}

export function listTrades(): Array<{ trade: string; label: string }> {
  return ADAPTERS.map((a) => ({ trade: a.trade, label: a.label }));
}
