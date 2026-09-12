// src/lib/nex/live-chat-completion/adapters/markets-adapter.ts
// Founder Phase 5 · thin markets adapter (Pasar · Traditional markets · Malls).
import type { DomainAdapter } from "@/lib/nex/live-chat-completion/contract";
import { makeThinAdapter } from "./thin-adapter-factory";

export function makeMarketsAdapter(): DomainAdapter {
  return makeThinAdapter({
    domain: "markets",
    handles_re: /\b(market|pasar|bazaar|bazar|mall|plaza|shop|shopping|toko|belanja|beringharjo|malioboro|souk|makro|hypermart|indomaret|alfamart)\b/i,
    generic_intent_slug: "markets_generic_lookup",
    entity_prefix: "markets_entity",
  });
}
