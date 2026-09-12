// src/lib/nex/live-chat-completion/adapters/travel-adapter.ts
// Founder Phase 5 · thin travel adapter (Trips · Itineraries · Tours · Packages).
import type { DomainAdapter } from "@/lib/nex/live-chat-completion/contract";
import { makeThinAdapter } from "./thin-adapter-factory";

export function makeTravelAdapter(): DomainAdapter {
  return makeThinAdapter({
    domain: "travel",
    handles_re: /\b(travel|trip|itinerary|itineraries|tour|tours|package|honeymoon|holiday|vacation|liburan|wisata|paket|jalan-jalan|traveller|traveler|backpack)\b/i,
    generic_intent_slug: "travel_generic_lookup",
    entity_prefix: "travel_entity",
  });
}
