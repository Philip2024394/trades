// src/lib/nex/live-chat-completion/adapters/business-adapter.ts
// Founder Phase 5 · thin business adapter (Services · Trades · Local business).
import type { DomainAdapter } from "@/lib/nex/live-chat-completion/contract";
import { makeThinAdapter } from "./thin-adapter-factory";

export function makeBusinessAdapter(): DomainAdapter {
  return makeThinAdapter({
    domain: "business",
    handles_re: /\b(business|services|trade|trades|company|companies|shop|store|contractor|plumber|electrician|lawyer|doctor|dentist|clinic|klinik|salon|barber|repair|laundry|kantor)\b/i,
    generic_intent_slug: "business_generic_lookup",
    entity_prefix: "business_entity",
  });
}
