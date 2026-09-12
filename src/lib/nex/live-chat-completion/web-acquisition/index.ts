// src/lib/nex/live-chat-completion/web-acquisition/index.ts
//
// Founder BEGIN Phase 3.5 · env-selected default web provider.
// Founder AIW-2c · extended to compose multiple public data sources.
//
// Selection precedence:
//   NEX_WEB_ACQUISITION=off              → null (feature disabled)
//   NEX_WEB_ACQUISITION_PROVIDER=mock    → mock provider (regression)
//   NEX_WEB_ACQUISITION_PROVIDER=ddg     → DDG + Wikipedia only (legacy default)
//   NEX_WEB_ACQUISITION_PROVIDER=composite → DDG + Wikipedia + Wikidata
//                                             + Nominatim + Open-Meteo
//   default (unset)                      → composite (AI-WiFi default)

import { makeMockWebProvider } from "./mock-provider";
import { makeDdgWikipediaProvider } from "./ddg-wikipedia-provider";
import { makeWikidataProvider } from "./wikidata-provider";
import { makeNominatimProvider } from "./nominatim-provider";
import { makeOpenMeteoProvider } from "./openmeteo-provider";
import { makeCompositeWebProvider } from "./composite-provider";
import type { WebProvider } from "./contract";

export function makeDefaultWebProvider(): WebProvider | null {
  const enabled = process.env.NEX_WEB_ACQUISITION;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  const kind = (process.env.NEX_WEB_ACQUISITION_PROVIDER ?? "composite").toLowerCase();
  if (kind === "mock") return makeMockWebProvider();
  if (kind === "ddg") return makeDdgWikipediaProvider();
  // composite (default): fan out to all public-data providers.
  return makeCompositeWebProvider({
    providers: [
      makeDdgWikipediaProvider(),
      makeWikidataProvider(),
      makeNominatimProvider(),
      makeOpenMeteoProvider(),
    ],
    max_results: 12,
  });
}

/** Explicit accessors for smokes + Observatory. */
export {
  makeDdgWikipediaProvider,
  makeWikidataProvider,
  makeNominatimProvider,
  makeOpenMeteoProvider,
  makeCompositeWebProvider,
  makeMockWebProvider,
};
