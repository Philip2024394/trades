// src/lib/nex/live-chat-completion/adapters/attractions-adapter.ts
// Founder Phase 5 · thin attractions adapter (Temples · Museums · Parks · Beaches).
import type { DomainAdapter } from "@/lib/nex/live-chat-completion/contract";
import { makeThinAdapter } from "./thin-adapter-factory";

export function makeAttractionsAdapter(): DomainAdapter {
  return makeThinAdapter({
    domain: "attractions",
    handles_re: /\b(attraction|temple|candi|museum|park|beach|pantai|monument|monumen|palace|kraton|waterfall|volcano|gunung|island|pulau|zoo|garden|taman|prambanan|borobudur|malioboro|tugu)\b/i,
    generic_intent_slug: "attractions_generic_lookup",
    entity_prefix: "attractions_entity",
  });
}
